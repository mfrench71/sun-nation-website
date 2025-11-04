/**
 * Posts Module
 *
 * Manages blog posts with full CRUD operations, pagination, and featured images.
 * Provides post list display, markdown editing, taxonomy management, and Cloudinary integration.
 *
 * Features:
 * - Load and display posts with metadata
 * - Paginated list view with search and sort
 * - Create and edit posts with markdown editor
 * - Featured image selection via Cloudinary
 * - Category and tag autocomplete
 * - Soft delete to bin
 * - Deployment tracking
 *
 * Dependencies:
 * - core/utils.js for escapeHtml() and debounce()
 * - ui/notifications.js for showError() and showSuccess()
 * - Global API_BASE constant
 * - Global state: allPosts, allPostsWithMetadata, currentPost, currentPage, postsPerPage,
 *                markdownEditor, postHasUnsavedChanges, categories, tags,
 *                selectedCategories, selectedTags, taxonomyAutocompleteCleanup, cloudinaryWidget
 * - Global functions: showConfirm(), trackDeployment()
 * - External: EasyMDE library for markdown editing
 * - External: Cloudinary Media Library for image selection
 *
 * @module modules/posts
 */

import { escapeHtml, debounce } from '../core/utils.js?v=1761123112';
import { showError, showSuccess } from '../ui/notifications.js?v=1761123112';
import { generateGalleryHTML } from './image-chooser.js';
import { initLinkEditor, openLinkEditor, searchContent as linkEditorSearchContent } from './link-editor.js';
import logger from '../core/logger.js';

// Cache configuration
const POSTS_CACHE_KEY = 'admin_posts_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Initialization flag to prevent false dirty flag during post load
let isInitializingPost = false;

/**
 * Gets cached data if still valid
 *
 * @param {string} key - Cache key
 * @returns {Object|null} Cached data or null if missing
 */
function getCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const { data, timestamp } = JSON.parse(cached);

    // Invalidate cache if expired (older than CACHE_DURATION_MS)
    const age = Date.now() - timestamp;
    if (age > CACHE_DURATION_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return data;
  } catch (error) {
    logger.warn('Cache read error:', error);
    return null;
  }
}

/**
 * Sets cache data with timestamp
 *
 * @param {string} key - Cache key
 * @param {*} data - Data to cache
 */
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.warn('Cache write error:', error);
  }
}

/**
 * Clears cache for a specific key or all caches
 *
 * @param {string} [key] - Specific cache key to clear, or clears all if omitted
 */
export function clearCache(key) {
  if (key) {
    localStorage.removeItem(key);
  } else {
    // Clear all admin caches
    localStorage.removeItem(POSTS_CACHE_KEY);
    localStorage.removeItem('admin_pages_cache');
    localStorage.removeItem('admin_taxonomy_cache');
  }
}

/**
 * Populates the category filter dropdown with available categories
 *
 * Collects all unique categories from posts and populates the dropdown
 * in the order they appear in the taxonomy.
 *
 * @example
 * import { populateCategoryFilter } from './modules/posts.js';
 * populateCategoryFilter();
 */
export function populateCategoryFilter() {
  const filterSelect = document.getElementById('posts-category-filter');
  if (!filterSelect) return;

  // Get all unique categories from posts
  const categoriesSet = new Set();
  window.allPostsWithMetadata.forEach(post => {
    if (Array.isArray(post.frontmatter?.categories)) {
      post.frontmatter.categories.forEach(cat => categoriesSet.add(cat));
    }
  });

  // Convert to array and sort by taxonomy order if available
  let categories = Array.from(categoriesSet);
  if (window.categories && Array.isArray(window.categories)) {
    // Sort by taxonomy order
    categories.sort((a, b) => {
      const indexA = window.categories.indexOf(a);
      const indexB = window.categories.indexOf(b);
      if (indexA === -1 && indexB === -1) return a.localeCompare(b);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
  } else {
    // Fallback to alphabetical sort
    categories.sort();
  }

  // Build options HTML
  const options = categories.map(cat =>
    `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`
  ).join('');

  // Preserve current selection
  const currentValue = filterSelect.value;
  filterSelect.innerHTML = '<option value="">All Categories</option>' + options;
  if (currentValue && categories.includes(currentValue)) {
    filterSelect.value = currentValue;
  }
}

/**
 * Sets the category filter and re-renders the posts list
 *
 * Called when clicking a category link in the posts list.
 *
 * @param {string} category - Category name to filter by
 *
 * @example
 * import { filterByCategory } from './modules/posts.js';
 * filterByCategory('Photography');
 */
export function filterByCategory(category) {
  const filterSelect = document.getElementById('posts-category-filter');
  if (filterSelect) {
    filterSelect.value = category;
    filterPosts();
  }
}

/**
 * Loads posts from the backend with metadata
 *
 * Fetches all posts with frontmatter, processes dates, and renders the posts list.
 * Hides loading indicator when complete.
 *
 * @throws {Error} If posts load fails
 *
 * @example
 * import { loadPosts } from './modules/posts.js';
 * await loadPosts();
 */
export async function loadPosts() {
  try {
    // Try to load from cache first
    const cachedData = getCache(POSTS_CACHE_KEY);
    if (cachedData) {
      // Check if cache has new format (object with allPosts and allPostsWithMetadata)
      if (cachedData.allPosts && cachedData.allPostsWithMetadata) {
        window.allPosts = cachedData.allPosts;
        // Deserialize dates from cache (they're stored as ISO strings)
        window.allPostsWithMetadata = cachedData.allPostsWithMetadata.map(post => ({
          ...post,
          date: new Date(post.date)
        }));

        renderPostsList();
        populateTaxonomySelects();
        populateCategoryFilter();
        initLinkEditor();

        document.getElementById('posts-loading')?.classList.add('d-none');
        return;
      } else {
        // Old cache format - clear it and fetch fresh data
        clearCache(POSTS_CACHE_KEY);
      }
    }

    // Cache miss - fetch from API
    const response = await fetch(`${window.API_BASE}/posts?metadata=true`);
    if (!response.ok) throw new Error('Failed to load posts');

    const data = await response.json();
    window.allPosts = data.posts || [];

    // Process all posts with metadata into allPostsWithMetadata
    window.allPostsWithMetadata = window.allPosts.map(post => ({
      ...post,
      frontmatter: post.frontmatter || {},
      date: post.frontmatter?.date
        ? new Date(post.frontmatter.date)
        : new Date(post.name.substring(0, 10))
    }));

    // Cache both the raw posts and processed metadata
    setCache(POSTS_CACHE_KEY, {
      allPosts: window.allPosts,
      allPostsWithMetadata: window.allPostsWithMetadata
    });

    renderPostsList();
    populateTaxonomySelects();
    populateCategoryFilter();
    initLinkEditor();
  } catch (error) {
    logger.error('Error loading posts:', error);
    showError('Failed to load posts: ' + error.message);
  } finally {
    document.getElementById('posts-loading')?.classList.add('d-none');
  }
}

/**
 * Renders the posts list with filtering, sorting, and pagination
 *
 * Applies search filtering, sorts posts by selected criteria, paginates results, and generates HTML table rows with hierarchical category display.
 *
 * @example
 * import { renderPostsList } from './modules/posts.js';
 * renderPostsList();
 */
export function renderPostsList() {
  const tbody = document.getElementById('posts-table-body');
  const emptyEl = document.getElementById('posts-empty');
  const search = document.getElementById('posts-search')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('posts-sort')?.value || 'date-desc';
  const categoryFilter = document.getElementById('posts-category-filter')?.value || '';

  // If the required DOM elements don't exist (e.g., called from bin page), exit early
  if (!tbody || !emptyEl) {
    return;
  }

  // Safety check: ensure allPostsWithMetadata exists and is an array
  if (!window.allPostsWithMetadata || !Array.isArray(window.allPostsWithMetadata)) {
    logger.error('allPostsWithMetadata is not initialized properly');
    window.allPostsWithMetadata = [];
  }

  // Filter posts by search term (search in title and filename) and category
  let filtered = window.allPostsWithMetadata.filter(post => {
    const title = (post.frontmatter?.title || '').toLowerCase();
    const filename = post.name?.toLowerCase() || '';
    const searchTerm = search.toLowerCase();
    const matchesSearch = title.includes(searchTerm) || filename.includes(searchTerm);

    // If category filter is set, check if post has that category
    if (categoryFilter) {
      const hasCategory = Array.isArray(post.frontmatter?.categories) &&
                         post.frontmatter.categories.includes(categoryFilter);
      return matchesSearch && hasCategory;
    }

    return matchesSearch;
  });

  // Sort posts
  filtered = sortPostsList(filtered, sortBy);

  // Pagination
  const totalPosts = filtered.length;
  const totalPages = Math.ceil(totalPosts / window.postsPerPage);
  const startIndex = (window.currentPage - 1) * window.postsPerPage;
  const endIndex = Math.min(startIndex + window.postsPerPage, totalPosts);
  const paginatedPosts = filtered.slice(startIndex, endIndex);

  // Show/hide empty state
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('d-none');
    document.getElementById('posts-pagination')?.classList.add('d-none');
    return;
  }

  emptyEl.classList.add('d-none');

  // Render table rows
  tbody.innerHTML = paginatedPosts.map((post, index) => {
    const rowNumber = startIndex + index + 1; // Calculate actual row number
    const title = post.frontmatter?.title || post.name;
    const date = formatDateShort(post.date);
    const lastModified = post.frontmatter?.last_modified_at
      ? formatDateShort(new Date(post.frontmatter.last_modified_at))
      : date; // Default to published date
    const categories = post.frontmatter?.categories || [];

    // Helper function to escape strings for use in JavaScript context (onclick attributes)
    // This is different from escapeHtml() which creates HTML entities
    const escapeJs = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

    // Display categories as comma-separated clickable links
    let categoriesDisplay = '';
    if (Array.isArray(categories) && categories.length > 0) {
      const categoryLinks = categories.map(cat => {
        return `<button type="button" onclick="window.filterByCategory('${escapeJs(cat)}')" class="btn btn-link text-primary p-0 border-0 text-decoration-none">${escapeHtml(cat)}</button>`;
      }).join(', ');
      categoriesDisplay = categoryLinks;
    } else {
      categoriesDisplay = '<span class="text-muted">-</span>';
    }

    // Get post URL - prefer frontmatter url/permalink, otherwise construct from filename
    let postUrl = post.frontmatter?.url || post.frontmatter?.permalink || '/';

    // If no custom URL in frontmatter, construct from filename using /:title/ permalink structure
    // (YYYY-MM-DD-slug.md -> /slug/)
    if (postUrl === '/' && post.name && post.name.match(/^\d{4}-\d{2}-\d{2}/)) {
      const parts = post.name.split('-');
      const slug = parts.slice(3).join('-').replace(/\.md$/, '');
      postUrl = `/${slug}/`;
    }

    return `
      <tr class="small" data-row-id="cat-row-${rowNumber}">
        <td class="px-3 py-2 text-muted">${rowNumber}</td>
        <td class="px-3 py-2 row-with-actions">
          <div class="fw-medium text-dark"><a href="/admin/posts/edit.html?file=${encodeURIComponent(post.name)}" class="text-dark text-decoration-none">${escapeHtml(title)}</a></div>
          <div class="row-actions">
            <span><button type="button" onclick="window.location.href='/admin/posts/edit.html?file=${encodeURIComponent(post.name)}'" class="btn btn-link text-primary p-0 border-0 text-decoration-none">Edit</button></span> <span class="text-muted">|</span>
            <span><button type="button" onclick="window.deletePostFromList('${escapeJs(post.name)}', '${escapeJs(post.sha)}')" class="btn btn-link text-primary p-0 border-0 text-decoration-none">Bin</button></span> <span class="text-muted">|</span>
            <span><button type="button" onclick="window.open('${escapeJs(postUrl)}', '_blank')" class="btn btn-link text-primary p-0 border-0 text-decoration-none">View</button></span>
          </div>
        </td>
        <td class="px-3 py-2 text-body-secondary text-nowrap">${date}</td>
        <td class="px-3 py-2 text-body-secondary text-nowrap">${lastModified}</td>
        <td class="px-3 py-2">${categoriesDisplay}</td>
      </tr>
    `;
  }).join('');

  // Update pagination
  updatePagination(totalPosts, startIndex + 1, endIndex, totalPages);
}

/**
 * Sorts posts by specified criteria
 *
 * Supports sorting by date (ascending/descending) and title (ascending/descending).
 *
 * @param {Array} posts - Array of post objects to sort
 * @param {string} sortBy - Sort criteria (date-desc, date-asc, title-asc, title-desc)
 *
 * @returns {Array} Sorted array of posts
 *
 * @example
 * import { sortPostsList } from './modules/posts.js';
 * const sorted = sortPostsList(posts, 'date-desc');
 */
export function sortPostsList(posts, sortBy) {
  const sorted = [...posts];

  switch (sortBy) {
    case 'date-desc':
      return sorted.sort((a, b) => b.date - a.date);
    case 'date-asc':
      return sorted.sort((a, b) => a.date - b.date);
    case 'title-asc':
      return sorted.sort((a, b) => {
        const titleA = (a.frontmatter?.title || a.name).toLowerCase();
        const titleB = (b.frontmatter?.title || b.name).toLowerCase();
        return titleA.localeCompare(titleB);
      });
    case 'title-desc':
      return sorted.sort((a, b) => {
        const titleA = (a.frontmatter?.title || a.name).toLowerCase();
        const titleB = (b.frontmatter?.title || b.name).toLowerCase();
        return titleB.localeCompare(titleA);
      });
    default:
      return sorted;
  }
}

/**
 * Toggles visibility of hierarchical categories in posts list
 *
 * Shows or hides remaining categories when a post has multiple categories in its hierarchy.
 *
 * @param {string} rowId - ID of the table row containing categories to toggle
 *
 * @example
 * import { toggleCategories } from './modules/posts.js';
 * toggleCategories('cat-row-1');
 */
export function toggleCategories(rowId) {
  const row = document.querySelector(`[data-row-id="${rowId}"]`);
  if (!row) return;

  const toggleBtn = row.querySelector('.category-toggle');
  const remainingCats = row.querySelector('.category-remaining');
  const chevronDown = toggleBtn.querySelector('.chevron-down');
  const chevronUp = toggleBtn.querySelector('.chevron-up');

  // Toggle visibility
  if (remainingCats.classList.contains('d-none')) {
    remainingCats.classList.remove('d-none');
    chevronDown.classList.add('d-none');
    chevronUp.classList.remove('d-none');
  } else {
    remainingCats.classList.add('d-none');
    chevronDown.classList.remove('d-none');
    chevronUp.classList.add('d-none');
  }
}

/**
 * Updates pagination UI for posts list
 *
 * Updates page numbers, range display, and enables/disables prev/next buttons.
 *
 * @param {number} total - Total number of posts
 * @param {number} start - Starting index of current page
 * @param {number} end - Ending index of current page
 * @param {number} totalPages - Total number of pages
 *
 * @example
 * import { updatePagination } from './modules/posts.js';
 * updatePagination(50, 1, 10, 5);
 */
export function updatePagination(total, start, end, totalPages) {
  const paginationEl = document.getElementById('posts-pagination');
  const paginationTopEl = document.getElementById('posts-pagination-top');
  const prevBtn = document.getElementById('posts-prev-btn');
  const nextBtn = document.getElementById('posts-next-btn');
  const prevBtnTop = document.getElementById('posts-prev-btn-top');
  const nextBtnTop = document.getElementById('posts-next-btn-top');

  if (totalPages <= 1) {
    paginationEl.classList.add('d-none');
    paginationTopEl.classList.add('d-none');
    return;
  }

  paginationEl.classList.remove('d-none');
  paginationTopEl.classList.remove('d-none');

  // Update bottom pagination
  document.getElementById('posts-range-start').textContent = start;
  document.getElementById('posts-range-end').textContent = end;
  document.getElementById('posts-total').textContent = total;

  // Update top pagination
  document.getElementById('posts-range-start-top').textContent = start;
  document.getElementById('posts-range-end-top').textContent = end;
  document.getElementById('posts-total-top').textContent = total;

  // Update button states
  prevBtn.disabled = window.currentPage === 1;
  nextBtn.disabled = window.currentPage === totalPages;
  prevBtnTop.disabled = window.currentPage === 1;
  nextBtnTop.disabled = window.currentPage === totalPages;
}

/**
 * Changes the current page in posts pagination
 *
 * Updates the current page number, modifies the URL, re-renders the posts list, and scrolls to top.
 *
 * @param {number} delta - Page change delta (+1 for next, -1 for previous)
 *
 * @example
 * import { changePage } from './modules/posts.js';
 * changePage(1); // Next page
 * changePage(-1); // Previous page
 */
export function changePage(delta) {
  window.currentPage += delta;

  renderPostsList();
  document.getElementById('posts-list-view').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Triggers posts list re-sort based on dropdown selection
 *
 * Resets to first page and re-renders the posts list with new sort order.
 *
 * @example
 * import { sortPosts } from './modules/posts.js';
 * sortPosts();
 */
export function sortPosts() {
  window.currentPage = 1; // Reset to first page
  renderPostsList();
}

/**
 * Filters posts based on search input
 *
 * Resets to first page and re-renders the posts list with search filter applied.
 *
 * @example
 * import { filterPosts } from './modules/posts.js';
 * filterPosts();
 */
export function filterPosts() {
  window.currentPage = 1; // Reset to first page
  renderPostsList();
}

/**
 * Debounced version of filterPosts for search input
 *
 * Debounces the filterPosts function with 300ms delay to avoid excessive re-renders
 * while user is typing in the search box.
 *
 * @example
 * import { debouncedFilterPosts } from './modules/posts.js';
 * document.getElementById('posts-search').addEventListener('input', debouncedFilterPosts);
 */
export const debouncedFilterPosts = debounce(filterPosts, 300);

/**
 * Resets all post filters to their default values
 *
 * Clears the search input, resets category filter to "All Categories",
 * resets sort to "Newest First", and re-renders the posts list.
 *
 * @example
 * import { resetPostsFilters } from './modules/posts.js';
 * resetPostsFilters();
 */
export function resetPostsFilters() {
  // Clear search input
  const searchInput = document.getElementById('posts-search');
  if (searchInput) {
    searchInput.value = '';
  }

  // Reset category filter
  const categoryFilter = document.getElementById('posts-category-filter');
  if (categoryFilter) {
    categoryFilter.value = '';
  }

  // Reset sort to newest first
  const sortSelect = document.getElementById('posts-sort');
  if (sortSelect) {
    sortSelect.value = 'date-desc';
  }

  // Reset to first page and re-render
  window.currentPage = 1;
  renderPostsList();
}

/**
 * Formats a date for display in short format
 *
 * Converts Date object to DD MMM YYYY HH:MM format (e.g., "21 Oct 2025 14:30").
 *
 * @param {Date|string} date - Date to format
 *
 * @returns {string} Formatted date string
 *
 * @example
 * import { formatDateShort } from './modules/posts.js';
 * formatDateShort(new Date()); // "21 Oct 2025 14:30"
 */
export function formatDateShort(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

/**
 * Initializes the EasyMDE markdown editor for posts
 *
 * Creates the EasyMDE instance if it doesn't exist, configures toolbar and status bar, and sets up change tracking.
 *
 * @example
 * import { initMarkdownEditor } from './modules/posts.js';
 * initMarkdownEditor();
 */
export function initMarkdownEditor() {
  if (!window.markdownEditor) {
    window.markdownEditor = new EasyMDE({
      element: document.getElementById('post-content'),
      spellChecker: false,
      autosave: {
        enabled: false
      },
      previewRender: function(plainText) {
        // Handle Kramdown syntax in preview
        // Convert [text](url){:target="_blank"} to proper HTML
        let processedText = plainText.replace(
          /\[([^\]]+)\]\(([^)]+)\)\{:target="_blank"\}/g,
          '<a href="$2" target="_blank">$1</a>'
        );

        // Use marked for standard markdown rendering
        return this.parent.markdown(processedText);
      },
      toolbar: [
        'bold', 'italic',
        {
          name: 'heading-1',
          action: EasyMDE.toggleHeading1,
          className: 'fa fa-header',
          title: 'Heading 1',
          default: true
        },
        {
          name: 'heading-2',
          action: EasyMDE.toggleHeading2,
          className: 'fa fa-header',
          title: 'Heading 2',
          default: true
        },
        {
          name: 'heading-3',
          action: EasyMDE.toggleHeading3,
          className: 'fa fa-header',
          title: 'Heading 3',
          default: true
        },
        '|',
        'quote', 'unordered-list', 'ordered-list',
        '|',
        {
          name: 'link',
          action: (editor) => {
            openLinkEditor(editor);
          },
          className: 'fa fa-link',
          title: 'Insert/Edit Link',
          default: true
        },
        'image',
        {
          name: 'cloudinary-image',
          action: (editor) => {
            openImageChooserForMarkdown(editor);
          },
          className: 'fa fa-cloud-upload-alt',
          title: 'Insert Image from Cloudinary'
        },
        {
          name: 'cloudinary-gallery',
          action: (editor) => {
            openGalleryChooserForMarkdown(editor);
          },
          className: 'fa fa-images',
          title: 'Insert Gallery from Cloudinary'
        },
        '|',
        'preview', 'side-by-side', 'fullscreen',
        '|',
        'guide'
      ],
      status: ['lines', 'words', 'cursor']
    });

    // Track changes in markdown editor (but not during initialization)
    window.markdownEditor.codemirror.on('change', () => {
      if (!isInitializingPost) {
        window.postHasUnsavedChanges = true;
      }
    });
  }
}

/**
 * Cleans up and destroys the markdown editor instance
 *
 * Converts the EasyMDE editor back to a textarea and nullifies the instance to free memory.
 *
 * @example
 * import { cleanupMarkdownEditor } from './modules/posts.js';
 * cleanupMarkdownEditor();
 */
export function cleanupMarkdownEditor() {
  if (window.markdownEditor) {
    window.markdownEditor.toTextArea();
    window.markdownEditor = null;
  }
}

/**
 * Marks the current post as having unsaved changes
 *
 * Sets the postHasUnsavedChanges flag to trigger browser warning on page close.
 *
 * @example
 * import { markPostDirty } from './modules/posts.js';
 * markPostDirty();
 */
export function markPostDirty() {
  window.postHasUnsavedChanges = true;
}

/**
 * Clears the unsaved changes flag for the current post
 *
 * Resets the postHasUnsavedChanges flag.
 *
 * @example
 * import { clearPostDirty } from './modules/posts.js';
 * clearPostDirty();
 */
export function clearPostDirty() {
  window.postHasUnsavedChanges = false;
}

/**
 * Loads and displays a post for editing
 *
 * Fetches post data from the API, populates the editor form, initializes the markdown editor, sets up change tracking, and updates the URL.
 *
 * @param {string} filename - Name of the post file to edit
 * @param {boolean} [updateUrl=true] - Whether to update browser URL
 *
 * @throws {Error} If post load fails
 *
 * @example
 * import { editPost } from './modules/posts.js';
 * await editPost('2025-10-21-my-post.md');
 */
export async function editPost(filename, updateUrl = true) {
  try {
    // Set initialization flag to prevent false dirty flag
    isInitializingPost = true;

    // Clear any existing post data first to prevent stale state
    window.currentPost = null;

    const response = await fetch(`${window.API_BASE}/posts?path=${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('Failed to load post');

    window.currentPost = await response.json();

    // Populate form
    document.getElementById('post-title').value = window.currentPost.frontmatter.title || '';
    document.getElementById('post-excerpt').value = window.currentPost.frontmatter.excerpt || '';
    document.getElementById('post-date').value = formatDateForInput(window.currentPost.frontmatter.date);
    // Handle both boolean true and string "true" from YAML parser
    document.getElementById('post-featured').checked = window.currentPost.frontmatter.featured === true || window.currentPost.frontmatter.featured === 'true';

    // Display last modified date (read-only, informational)
    const lastModifiedEl = document.getElementById('post-last-modified');
    if (lastModifiedEl && window.currentPost.frontmatter.last_modified_at) {
      const lastModified = new Date(window.currentPost.frontmatter.last_modified_at);
      lastModifiedEl.textContent = lastModified.toLocaleString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
    } else if (lastModifiedEl) {
      lastModifiedEl.textContent = 'Not yet modified';
    }

    // Support both 'image' and 'featured_image' fields
    let imageUrl = window.currentPost.frontmatter.image || window.currentPost.frontmatter.featured_image || '';

    // Convert relative paths to full URLs for HTML5 URL validation
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // Assume it's a partial Cloudinary path and construct full URL
      imageUrl = `https://res.cloudinary.com/circleseven/image/upload/q_auto,f_auto/${imageUrl}`;
    }

    document.getElementById('post-image').value = imageUrl;

    // Update image preview
    updateImagePreview();

    // Initialize markdown editor if needed
    if (!window.markdownEditor) {
      initMarkdownEditor();
    }
    // Ensure editor content is set (use requestAnimationFrame for reliable initialization)
    requestAnimationFrame(() => {
      if (window.markdownEditor && window.markdownEditor.codemirror) {
        window.markdownEditor.value(window.currentPost.body || '');
      }
      // Clear dirty flag and end initialization AFTER editor content is set
      clearPostDirty();
      isInitializingPost = false;
    });

    // Set categories and tags
    setMultiSelect('post-categories', window.currentPost.frontmatter.categories || []);
    setMultiSelect('post-tags', window.currentPost.frontmatter.tags || []);

    // Add change listeners to form inputs
    setupPostFormChangeListeners();
  } catch (error) {
    showError('Failed to load post: ' + error.message);
    isInitializingPost = false;
  }
}

/**
 * Shows the editor form for creating a new post
 *
 * Clears all form fields, initializes the markdown editor, sets current date, and updates the URL.
 *
 * @param {boolean} [updateUrl=true] - Whether to update browser URL
 *
 * @example
 * import { showNewPostForm } from './modules/posts.js';
 * showNewPostForm();
 */
export function showNewPostForm(updateUrl = true) {
  window.currentPost = null;

  // Clear form
  document.getElementById('post-title').value = '';
  document.getElementById('post-excerpt').value = '';
  document.getElementById('post-date').value = formatDateForInput(new Date().toISOString());
  document.getElementById('post-image').value = '';
  document.getElementById('post-featured').checked = false;

  // Clear image preview
  document.getElementById('image-preview').classList.add('d-none');

  // Initialize markdown editor if needed and clear content
  if (!window.markdownEditor) {
    initMarkdownEditor();
  }
  // Ensure editor is cleared (use requestAnimationFrame for reliable initialization)
  requestAnimationFrame(() => {
    if (window.markdownEditor && window.markdownEditor.codemirror) {
      window.markdownEditor.value('');
    }
  });

  setMultiSelect('post-categories', []);
  setMultiSelect('post-tags', []);

  // Clear dirty flag for new post
  clearPostDirty();

  // Add change listeners to form inputs
  setupPostFormChangeListeners();
}

/**
 * Sets up change listeners on post editor form fields
 *
 * Adds input event listeners to mark the post as dirty when any field changes.
 *
 * @example
 * import { setupPostFormChangeListeners } from './modules/posts.js';
 * setupPostFormChangeListeners();
 */
export function setupPostFormChangeListeners() {
  // Only setup once
  if (window._postFormListenersSetup) return;
  window._postFormListenersSetup = true;

  const formInputs = [
    'post-title',
    'post-excerpt',
    'post-date',
    'post-image'
  ];

  formInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', markPostDirty);
    }
  });

  // Add change listener for checkbox
  const featuredCheckbox = document.getElementById('post-featured');
  if (featuredCheckbox) {
    featuredCheckbox.addEventListener('change', markPostDirty);
  }
}

/**
 * Returns to the posts list view from the editor
 *
 * Hides the editor, shows the list view, clears currentPost, updates URL, and optionally reloads posts.
 *
 * @returns {Promise<void>}
 *
 * @example
 * import { showPostsList } from './modules/posts.js';
 * await showPostsList();
 */
export async function showPostsList() {
  // Check for unsaved changes
  if (window.postHasUnsavedChanges) {
    const confirmed = await window.showConfirm('You have unsaved changes. Are you sure you want to leave this page?');
    if (!confirmed) return;
  }

  // Hide editor and show list
  document.getElementById('posts-editor-view').classList.add('d-none');
  document.getElementById('posts-list-view').classList.remove('d-none');
  window.currentPost = null;
  clearPostDirty();
}

/**
 * Saves the current post to the backend
 *
 * Validates required fields, collects form data including frontmatter and content, sends POST/PUT request, handles deployment tracking, and returns to posts list.
 *
 * @param {Event} event - Form submit event
 *
 * @throws {Error} If post save fails
 *
 * @example
 * import { savePost } from './modules/posts.js';
 * document.getElementById('post-form').addEventListener('submit', savePost);
 */
export async function savePost(event) {
  event.preventDefault();

  const saveBtn = document.getElementById('save-post-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = 'Saving...';

  try {
    const title = document.getElementById('post-title').value;
    const excerpt = document.getElementById('post-excerpt').value;
    const date = document.getElementById('post-date').value;
    const image = document.getElementById('post-image').value;
    const content = window.markdownEditor ? window.markdownEditor.value() : document.getElementById('post-content').value;
    const selectedCategories = getMultiSelectValues('post-categories');
    const selectedTags = getMultiSelectValues('post-tags');

    const frontmatter = {
      layout: 'post',
      title,
      date: new Date(date).toISOString(),
      categories: selectedCategories,
      tags: selectedTags
    };

    // Add excerpt if provided
    if (excerpt && excerpt.trim()) {
      frontmatter.excerpt = excerpt.trim();
    }

    if (image) {
      // Preserve the original image field name when editing
      if (window.currentPost && window.currentPost.frontmatter.featured_image) {
        frontmatter.featured_image = image;
      } else {
        frontmatter.image = image;
      }
    }

    // Add featured field if checkbox is checked
    const featured = document.getElementById('post-featured').checked;
    if (featured) {
      frontmatter.featured = true;
    }

    if (window.currentPost) {
      // Update existing post
      const response = await fetch(`${window.API_BASE}/posts`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: window.currentPost.path.replace('_posts/', ''),
          frontmatter,
          body: content,
          sha: window.currentPost.sha
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save post');
      }

      const data = await response.json();
      if (data.commitSha && window.trackDeployment) {
        window.trackDeployment(data.commitSha, `Update post: ${title}`, window.currentPost.path.replace('_posts/', ''));
      }

      showSuccess('Post updated successfully!');
    } else {
      // Create new post
      const filename = generateFilename(title, date);

      const response = await fetch(`${window.API_BASE}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename,
          frontmatter,
          body: content
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create post');
      }

      const data = await response.json();
      if (data.commitSha && window.trackDeployment) {
        window.trackDeployment(data.commitSha, `Create post: ${title}`, filename);
      }

      showSuccess('Post created successfully!');
    }

    // Clear dirty flag after successful save
    clearPostDirty();

    // Clear posts cache to force fresh data on next load
    clearCache(POSTS_CACHE_KEY);

    // Redirect to posts list
    window.location.href = '/admin/posts/';
  } catch (error) {
    showError('Failed to save post: ' + error.message);
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Post';
  }
}

/**
 * Deletes the currently edited post
 *
 * Shows confirmation dialog, sends delete request to backend, tracks deployment, and returns to posts list.
 *
 * @throws {Error} If post deletion fails
 *
 * @example
 * import { deletePost } from './modules/posts.js';
 * await deletePost();
 */
export async function deletePost() {
  if (!window.currentPost) return;

  const title = window.currentPost.frontmatter?.title || window.currentPost.path;
  const confirmed = await window.showConfirm(`Move "${title}" to bin?`);
  if (!confirmed) return;

  try {
    const filename = window.currentPost.path.replace('_posts/', '');

    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: window.currentPost.sha
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to move post to bin');
    }

    const data = await response.json();
    if (data.commitSha && window.trackDeployment) {
      window.trackDeployment(data.commitSha, `Move post to bin: ${title}`, filename);
    }

    showSuccess('Post moved to bin successfully!');

    // Clear posts cache
    clearCache(POSTS_CACHE_KEY);

    // Redirect to posts list
    window.location.href = '/admin/posts/';
  } catch (error) {
    showError('Failed to move post to bin: ' + error.message);
  }
}

/**
 * Deletes a post from the posts list view
 *
 * Shows confirmation dialog, sends delete request to backend with file SHA, tracks deployment, and refreshes the list.
 *
 * @param {string} filename - Name of the post file to delete
 * @param {string} sha - Git SHA of the file
 *
 * @throws {Error} If post deletion fails
 *
 * @example
 * import { deletePostFromList } from './modules/posts.js';
 * await deletePostFromList('2025-10-21-my-post.md', 'abc123');
 */
export async function deletePostFromList(filename, sha) {
  const post = window.allPostsWithMetadata.find(p => p.name === filename);
  const title = post?.frontmatter?.title || filename;

  const confirmed = await window.showConfirm(`Move "${title}" to bin?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: sha
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to move post to bin');
    }

    const data = await response.json();
    if (data.commitSha && window.trackDeployment) {
      window.trackDeployment(data.commitSha, `Move post to bin: ${title}`, filename);
    }

    showSuccess('Post moved to bin successfully!');

    // Clear posts cache
    clearCache(POSTS_CACHE_KEY);

    // Remove from local arrays
    window.allPosts = window.allPosts.filter(p => p.name !== filename);
    window.allPostsWithMetadata = window.allPostsWithMetadata.filter(p => p.name !== filename);

    // Re-render the list
    renderPostsList();
  } catch (error) {
    showError('Failed to move post to bin: ' + error.message);
  }
}

/**
 * Generates a Jekyll post filename from title and date
 *
 * Creates a filename in YYYY-MM-DD-slug.md format by slugifying the title.
 *
 * @param {string} title - Post title
 * @param {string} date - Post date in ISO format
 *
 * @returns {string} Generated filename
 *
 * @example
 * import { generateFilename } from './modules/posts.js';
 * generateFilename('My Post', '2025-10-21'); // "2025-10-21-my-post.md"
 */
export function generateFilename(title, date) {
  const dateObj = new Date(date);
  const dateStr = dateObj.toISOString().split('T')[0];
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${dateStr}-${slug}.md`;
}

/**
 * Formats a date for HTML date input
 *
 * Converts Date object or ISO string to YYYY-MM-DDThh:mm format for input[type="datetime-local"].
 *
 * @param {Date|string} dateStr - Date to format
 *
 * @returns {string} Formatted date string (YYYY-MM-DDThh:mm)
 *
 * @example
 * import { formatDateForInput } from './modules/posts.js';
 * formatDateForInput(new Date()); // "2025-10-21T14:30"
 */
export function formatDateForInput(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

/**
 * Populates taxonomy autocomplete inputs with available options
 *
 * Fetches current categories and tags from global state and initializes autocomplete for both.
 *
 * @example
 * import { populateTaxonomySelects } from './modules/posts.js';
 * populateTaxonomySelects();
 */
export function populateTaxonomySelects() {
  // Initialize autocomplete for categories (only if taxonomy is loaded)
  if (window.categories && Array.isArray(window.categories)) {
    initTaxonomyAutocomplete('categories', window.categories);
  }

  // Initialize autocomplete for tags (only if taxonomy is loaded)
  if (window.tags && Array.isArray(window.tags)) {
    initTaxonomyAutocomplete('tags', window.tags);
  }
}

/**
 * Initializes autocomplete functionality for taxonomy input
 *
 * Sets up dropdown suggestions, keyboard navigation, and item selection for categories or tags input.
 *
 * @param {string} type - Either "categories" or "tags"
 * @param {Array<string>} availableItems - List of available taxonomy items
 *
 * @returns {Function} Cleanup function to remove event listeners
 *
 * @example
 * import { initTaxonomyAutocomplete } from './modules/posts.js';
 * initTaxonomyAutocomplete('categories', ['Tech', 'News']);
 */
export function initTaxonomyAutocomplete(type, availableItems) {
  const input = document.getElementById(`${type}-input`);
  const suggestionsDiv = document.getElementById(`${type}-suggestions`);
  const selectedDiv = document.getElementById(`${type}-selected`);

  // Return early if elements don't exist (e.g., on list pages where editor fields aren't present)
  if (!input || !suggestionsDiv || !selectedDiv) {
    return;
  }

  // Clean up previous event listeners if they exist
  if (window.taxonomyAutocompleteCleanup[type]) {
    window.taxonomyAutocompleteCleanup[type]();
  }

  let selectedItems = type === 'categories' ? window.selectedCategories : window.selectedTags;
  let activeIndex = -1;

  // Handle input changes
  const inputHandler = (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();

    if (searchTerm === '') {
      suggestionsDiv.classList.add('d-none');
      return;
    }

    // Filter items that match search and aren't already selected
    const matches = availableItems.filter(item =>
      item.toLowerCase().includes(searchTerm) &&
      !selectedItems.includes(item)
    );

    if (matches.length === 0) {
      suggestionsDiv.innerHTML = '<div class="taxonomy-suggestion-empty">No matches found</div>';
      suggestionsDiv.classList.remove('d-none');
    } else {
      suggestionsDiv.innerHTML = matches.map((item, index) =>
        `<div class="taxonomy-suggestion-item" data-value="${escapeHtml(item)}" data-index="${index}">
          ${escapeHtml(item)}
        </div>`
      ).join('');
      suggestionsDiv.classList.remove('d-none');
      activeIndex = -1;
    }
  };

  // Handle keyboard navigation
  const keydownHandler = (e) => {
    const items = suggestionsDiv.querySelectorAll('.taxonomy-suggestion-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActiveItem(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, -1);
      updateActiveItem(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && items[activeIndex]) {
        addTaxonomyItem(type, items[activeIndex].dataset.value);
      }
    } else if (e.key === 'Escape') {
      suggestionsDiv.classList.add('d-none');
    }
  };

  function updateActiveItem(items) {
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  // Handle suggestion clicks
  const clickHandler = (e) => {
    const item = e.target.closest('.taxonomy-suggestion-item');
    if (item) {
      addTaxonomyItem(type, item.dataset.value);
    }
  };

  // Close suggestions when clicking outside
  const documentClickHandler = (e) => {
    if (!e.target.closest(`#${type}-input`) && !e.target.closest(`#${type}-suggestions`)) {
      suggestionsDiv.classList.add('d-none');
    }
  };

  // Add event listeners
  input.addEventListener('input', inputHandler);
  input.addEventListener('keydown', keydownHandler);
  suggestionsDiv.addEventListener('click', clickHandler);
  document.addEventListener('click', documentClickHandler);

  // Store cleanup function
  window.taxonomyAutocompleteCleanup[type] = () => {
    input.removeEventListener('input', inputHandler);
    input.removeEventListener('keydown', keydownHandler);
    suggestionsDiv.removeEventListener('click', clickHandler);
    document.removeEventListener('click', documentClickHandler);
  };
}

/**
 * Adds a selected taxonomy item to the post/page
 *
 * Adds the item to the selected list if not already present and renders the updated selection.
 *
 * @param {string} type - Either "categories" or "tags"
 * @param {string} value - Taxonomy item to add
 *
 * @example
 * import { addTaxonomyItem } from './modules/posts.js';
 * addTaxonomyItem('categories', 'Tech');
 */
export function addTaxonomyItem(type, value) {
  const selectedDiv = document.getElementById(`${type}-selected`);
  const input = document.getElementById(`${type}-input`);
  const suggestionsDiv = document.getElementById(`${type}-suggestions`);

  let selectedItems = type === 'categories' ? window.selectedCategories : window.selectedTags;

  if (!selectedItems.includes(value)) {
    selectedItems.push(value);

    // Update the state
    if (type === 'categories') {
      window.selectedCategories = selectedItems;
    } else {
      window.selectedTags = selectedItems;
    }

    renderSelectedTaxonomy(type);

    // Mark post as dirty when taxonomy changes
    markPostDirty();
  }

  input.value = '';
  suggestionsDiv.classList.add('d-none');
}

/**
 * Removes a taxonomy item from the post/page
 *
 * Removes the item from the selected list and renders the updated selection.
 *
 * @param {string} type - Either "categories" or "tags"
 * @param {string} value - Taxonomy item to remove
 *
 * @example
 * import { removeTaxonomyItem } from './modules/posts.js';
 * removeTaxonomyItem('categories', 'Tech');
 */
export function removeTaxonomyItem(type, value) {
  if (type === 'categories') {
    window.selectedCategories = window.selectedCategories.filter(item => item !== value);
  } else {
    window.selectedTags = window.selectedTags.filter(item => item !== value);
  }

  renderSelectedTaxonomy(type);

  // Mark post as dirty when taxonomy changes
  markPostDirty();
}

/**
 * Renders the selected taxonomy items with remove buttons
 *
 * Displays selected categories or tags as pills with × buttons for removal.
 *
 * @param {string} type - Either "categories" or "tags"
 *
 * @example
 * import { renderSelectedTaxonomy } from './modules/posts.js';
 * renderSelectedTaxonomy('categories');
 */
export function renderSelectedTaxonomy(type) {
  const selectedDiv = document.getElementById(`${type}-selected`);
  let selectedItems = type === 'categories' ? window.selectedCategories : window.selectedTags;

  // Defensive check: ensure selectedItems is always an array
  if (!Array.isArray(selectedItems)) {
    logger.warn(`${type} is not an array, resetting to empty array:`, selectedItems);
    selectedItems = [];
    // Update the global state
    if (type === 'categories') {
      window.selectedCategories = [];
    } else {
      window.selectedTags = [];
    }
  }

  // Filter out empty/null/undefined values
  selectedItems = selectedItems.filter(item => item && String(item).trim());

  // Update global state with filtered items
  if (type === 'categories') {
    window.selectedCategories = selectedItems;
  } else {
    window.selectedTags = selectedItems;
  }

  // Helper function to escape strings for JavaScript context (onclick attributes)
  const escapeJs = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  selectedDiv.innerHTML = selectedItems.map(item => `
    <div class="taxonomy-tag">
      <span>${escapeHtml(item)}</span>
      <button
        type="button"
        class="taxonomy-tag-remove"
        onclick="window.removeTaxonomyItem('${type}', '${escapeJs(item)}')"
        title="Remove ${escapeHtml(item)}"
      >
        ×
      </button>
    </div>
  `).join('');
}

/**
 * Sets the selected values for a taxonomy multiselect
 *
 * Updates the global state for selected categories or tags.
 *
 * @param {string} id - Either "post-categories" or "post-tags"
 * @param {Array<string>} values - Array of selected values
 *
 * @example
 * import { setMultiSelect } from './modules/posts.js';
 * setMultiSelect('post-categories', ['Tech', 'News']);
 */
export function setMultiSelect(id, values) {
  const type = id === 'post-categories' ? 'categories' : 'tags';

  if (type === 'categories') {
    window.selectedCategories = values || [];
  } else {
    window.selectedTags = values || [];
  }

  renderSelectedTaxonomy(type);
}

/**
 * Gets the currently selected taxonomy values
 *
 * Retrieves selected categories or tags from global state.
 *
 * @param {string} id - Either "post-categories" or "post-tags"
 *
 * @returns {Array<string>} Array of selected values
 *
 * @example
 * import { getMultiSelectValues } from './modules/posts.js';
 * const categories = getMultiSelectValues('post-categories');
 */
export function getMultiSelectValues(id) {
  const type = id === 'post-categories' ? 'categories' : 'tags';
  return type === 'categories' ? window.selectedCategories : window.selectedTags;
}

/**
 * Initializes the Cloudinary Media Library widget
 *
 * Creates and configures the Cloudinary widget if not already initialized, using credentials from window.cloudinaryConfig.
 *
 * @returns {Object} Cloudinary widget instance
 *
 * @example
 * import { initCloudinaryWidget } from './modules/posts.js';
 * const widget = initCloudinaryWidget();
 */
export function initCloudinaryWidget() {
  if (window.cloudinaryWidget) return window.cloudinaryWidget;

  // Check if Cloudinary library is loaded
  if (typeof cloudinary === 'undefined') {
    logger.error('Cloudinary library not loaded yet');
    return null;
  }

  window.cloudinaryWidget = cloudinary.createMediaLibrary({
    cloud_name: 'circleseven',
    api_key: '732138267195618',
    remove_header: false,
    max_files: 1,
    inline_container: null,
    folder: {
      path: '',
      resource_type: 'image'
    }
  }, {
    insertHandler: function(data) {
      const asset = data.assets[0];
      const imageUrl = asset.secure_url;

      // Update featured image field
      document.getElementById('post-image').value = imageUrl;
      updateImagePreview();
      markPostDirty();
    }
  });

  return window.cloudinaryWidget;
}

/**
 * Opens custom image chooser for selecting a featured image
 *
 * Shows the custom image chooser modal and sets the selected image to the featured image field.
 * The image chooser returns a Cloudinary public_id (filename) which is set in the field.
 * The preview will automatically construct the full URL for display.
 *
 * @example
 * import { selectFeaturedImage } from './modules/posts.js';
 * selectFeaturedImage();
 */
export function selectFeaturedImage() {
  // Use custom image chooser (returns public_id/filename)
  window.openImageChooser((publicId) => {
    document.getElementById('post-image').value = publicId;
    updateImagePreview();
    markPostDirty();
  });
}

/**
 * Opens image chooser for inserting images into markdown editor
 *
 * Opens the Cloudinary image chooser modal and inserts the selected image as a Liquid include
 * with responsive image optimization. This enables srcset, lazy loading, and auto format/quality.
 *
 * @param {Object} editor - EasyMDE editor instance
 *
 * @example
 * import { openImageChooserForMarkdown} from './modules/posts.js';
 * openImageChooserForMarkdown(window.markdownEditor);
 *
 * // Inserts:
 * // {% include cloudinary-image.html src="path/image" alt="Description" %}
 */
export function openImageChooserForMarkdown(editor) {
  window.openImageChooser((publicId) => {
    // Insert Liquid include for responsive, optimized images
    // Note: imageChooser now returns public_id (filename) instead of full URL
    const liquid = `{% include cloudinary-image.html src="${publicId}" alt="Description" %}`;

    // Insert at cursor position
    const cm = editor.codemirror;
    const cursor = cm.getCursor();
    cm.setSelection(cursor, cursor); // Clear any selection
    cm.replaceSelection(`\n${liquid}\n`);

    // Focus editor
    cm.focus();

    // Mark as dirty
    markPostDirty();
  });
}

/**
 * Opens image chooser in multi-select mode for inserting gallery into markdown editor
 *
 * Opens the Cloudinary image chooser modal in multi-select mode. When confirmed,
 * generates gallery HTML and inserts it at the cursor position.
 *
 * @param {Object} editor - EasyMDE editor instance
 *
 * @example
 * import { openGalleryChooserForMarkdown } from './modules/posts.js';
 * openGalleryChooserForMarkdown(window.markdownEditor);
 */
export function openGalleryChooserForMarkdown(editor) {
  // Open image chooser in multi-select mode
  window.openImageChooser((imageUrls) => {
    // Generate gallery HTML from selected images
    const galleryHTML = generateGalleryHTML(imageUrls);

    if (galleryHTML) {
      // Insert gallery HTML at cursor position
      const cm = editor.codemirror;
      const cursor = cm.getCursor();
      cm.setSelection(cursor, cursor); // Clear any selection
      cm.replaceSelection(`\n${galleryHTML}\n`);
      // Focus editor
      cm.focus();
      // Mark as dirty
      markPostDirty();
    }
  }, true); // true = multi-select mode
}

/**
 * Updates the featured image preview
 *
 * Shows or hides the image preview based on whether a valid image URL is entered.
 *
 * @example
 * import { updateImagePreview } from './modules/posts.js';
 * updateImagePreview();
 */
export function updateImagePreview() {
  const imageUrl = document.getElementById('post-image').value.trim();
  const previewDiv = document.getElementById('image-preview');
  const previewImg = document.getElementById('image-preview-img');

  if (imageUrl) {
    // Construct full Cloudinary URL if it's a partial path
    let fullImageUrl = imageUrl;

    // Get default folder from site config
    const folder = window.siteConfig?.cloudinary_default_folder || '';
    const folderPath = folder ? `${folder}/` : '';

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // It's a partial path, construct full URL with folder
      fullImageUrl = `https://res.cloudinary.com/circleseven/image/upload/q_auto,f_auto/${folderPath}${imageUrl}`;
    } else if (folderPath && imageUrl.includes('res.cloudinary.com/circleseven/image/upload/') && !imageUrl.includes(`/${folder}/`)) {
      // It's a full Cloudinary URL but missing the folder, inject it
      fullImageUrl = imageUrl.replace(
        /\/image\/upload\/([^/]+\/)?/,
        `/image/upload/$1${folderPath}`
      );
    }

    // Show preview immediately
    previewDiv.classList.remove('d-none');
    previewImg.src = fullImageUrl;

    // Hide if image fails to load
    previewImg.onerror = () => {
      previewDiv.classList.add('d-none');
    };
  } else {
    previewDiv.classList.add('d-none');
  }
}

/**
 * Opens a full-size image modal
 *
 * Displays the featured image in a Bootstrap modal for full-size viewing.
 * Uses Bootstrap's native modal functionality for open/close/keyboard handling.
 *
 * @example
 * import { openImageModal } from './modules/posts.js';
 * openImageModal();
 */
export function openImageModal() {
  const imageUrl = document.getElementById('post-image').value.trim();
  const modalElement = document.getElementById('imagePreviewModal');
  const modalImg = document.getElementById('image-modal-img');
  const modalLoading = document.getElementById('image-modal-loading');

  if (imageUrl) {
    // Construct full Cloudinary URL if it's a partial path
    let fullImageUrl = imageUrl;

    // Get default folder from site config
    const folder = window.siteConfig?.cloudinary_default_folder || '';
    const folderPath = folder ? `${folder}/` : '';

    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      // It's a partial path, construct full URL with folder
      fullImageUrl = `https://res.cloudinary.com/circleseven/image/upload/q_auto,f_auto/${folderPath}${imageUrl}`;
    } else if (folderPath && imageUrl.includes('res.cloudinary.com/circleseven/image/upload/') && !imageUrl.includes(`/${folder}/`)) {
      // It's a full Cloudinary URL but missing the folder, inject it
      fullImageUrl = imageUrl.replace(
        /\/image\/upload\/([^/]+\/)?/,
        `/image/upload/$1${folderPath}`
      );
    }

    // Reset image state
    if (modalImg) {
      modalImg.classList.add('d-none');
      modalImg.src = '';
    }

    // Show loading spinner
    if (modalLoading) {
      modalLoading.classList.remove('d-none');
    }

    // Load the image
    if (modalImg) {
      modalImg.onload = function() {
        // Hide loading spinner
        if (modalLoading) {
          modalLoading.classList.add('d-none');
        }
        // Show image
        modalImg.classList.remove('d-none');
      };

      modalImg.onerror = function() {
        // Hide loading spinner on error
        if (modalLoading) {
          modalLoading.classList.add('d-none');
        }
        // Try to show the image anyway (fallback)
        modalImg.classList.remove('d-none');
      };

      modalImg.src = fullImageUrl;
    }

    // Open modal using Bootstrap's Modal API
    if (modalElement) {
      const modal = new bootstrap.Modal(modalElement);
      modal.show();
    }
  }
}

// Deprecated: These functions are kept for backwards compatibility but are no longer needed
// Bootstrap handles closing automatically via data-bs-dismiss and Escape key
export function closeImageModal() {
  // No-op: Bootstrap handles this automatically
}

export function handleImageModalEscape(e) {
  // No-op: Bootstrap handles this automatically
}

// Expose link editor search to window for onclick handler
window.linkEditorSearchContent = linkEditorSearchContent;
