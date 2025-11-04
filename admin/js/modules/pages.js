/**
 * Pages Module
 *
 * Manages site pages with CRUD operations, markdown editing, and permalink management.
 * Provides page list rendering, editor functionality, and protected page support.
 *
 * Features:
 * - Load and display all pages
 * - Search and filter pages
 * - Create, edit, and delete pages
 * - Markdown editor integration (EasyMDE)
 * - Auto-populate permalinks from titles
 * - Protected page support
 * - Soft delete (move to bin)
 * - Deployment tracking
 * - Unsaved changes detection
 *
 * Dependencies:
 * - core/utils.js for escapeHtml() and debounce()
 * - ui/notifications.js for showError() and showSuccess()
 * - Global API_BASE constant
 * - Global state: allPages, currentPage_pages, pageMarkdownEditor, pageHasUnsavedChanges, permalinkManuallyEdited
 * - Global functions: showConfirm(), trackDeployment(), formatDateForInput()
 * - External: EasyMDE library for markdown editing
 *
 * @module modules/pages
 */

import { escapeHtml, debounce } from '../core/utils.js';
import { showError, showSuccess } from '../ui/notifications.js';
import { generateGalleryHTML } from './image-chooser.js';
import { initLinkEditor, openLinkEditor, searchContent as linkEditorSearchContent } from './link-editor.js';
import logger from '../core/logger.js';

// Cache configuration
const PAGES_CACHE_KEY = 'admin_pages_cache';
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Initialization flag to prevent false dirty flag during page load
let isInitializingPage = false;

/**
 * Gets cached data if still valid
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
 * Clears pages cache
 */
export function clearPagesCache() {
  localStorage.removeItem(PAGES_CACHE_KEY);
}

/**
 * Access global pages state from app.js
 * These are shared between the module and app.js for state management
 */

/**
 * Loads all pages from the backend
 *
 * Fetches the list of pages with metadata and renders the pages list.
 * Hides loading indicator when complete.
 *
 * @throws {Error} If pages load fails
 *
 * @example
 * import { loadPages } from './modules/pages.js';
 * await loadPages();
 */
export async function loadPages() {
  try {
    // Try to load from cache first
    const cachedPages = getCache(PAGES_CACHE_KEY);
    if (cachedPages) {
      window.allPages = cachedPages;
      renderPagesList();
      initLinkEditor();
      document.getElementById('pages-loading')?.classList.add('d-none');
      return;
    }

    // Cache miss - fetch from API
    const response = await fetch(`${window.API_BASE}/pages?metadata=true`);
    if (!response.ok) throw new Error('Failed to load pages');

    const data = await response.json();
    window.allPages = data.pages || [];

    // Cache the results
    setCache(PAGES_CACHE_KEY, window.allPages);

    renderPagesList();
    initLinkEditor();
  } catch (error) {
    showError('Failed to load pages: ' + error.message);
  } finally {
    document.getElementById('pages-loading')?.classList.add('d-none');
  }
}

/**
 * Renders the pages list with search filtering
 *
 * Filters pages by search term and generates HTML table rows with edit/delete actions.
 * Shows empty state when no pages match the search.
 *
 * @example
 * import { renderPagesList } from './modules/pages.js';
 * renderPagesList();
 */
export function renderPagesList() {
  const tbody = document.getElementById('pages-table-body');
  const emptyEl = document.getElementById('pages-empty');
  const search = document.getElementById('pages-search')?.value.toLowerCase() || '';
  const sortBy = document.getElementById('pages-sort')?.value || 'title-asc';

  // If the required DOM elements don't exist (e.g., called from bin page), exit early
  if (!tbody || !emptyEl) {
    return;
  }

  const allPages = window.allPages || [];

  // Helper function to escape strings for JavaScript context (onclick attributes)
  // This is different from escapeHtml() which creates HTML entities
  const escapeJs = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // Filter pages by search term
  let filtered = allPages.filter(page => {
    const title = (page.frontmatter?.title || '').toLowerCase();
    const filename = page.name.toLowerCase();
    return title.includes(search) || filename.includes(search);
  });

  // Sort pages
  switch (sortBy) {
    case 'title-asc':
      filtered.sort((a, b) => {
        const titleA = (a.frontmatter?.title || a.name).toLowerCase();
        const titleB = (b.frontmatter?.title || b.name).toLowerCase();
        return titleA.localeCompare(titleB);
      });
      break;
    case 'title-desc':
      filtered.sort((a, b) => {
        const titleA = (a.frontmatter?.title || a.name).toLowerCase();
        const titleB = (b.frontmatter?.title || b.name).toLowerCase();
        return titleB.localeCompare(titleA);
      });
      break;
    case 'date-desc':
      filtered.sort((a, b) => {
        const dateA = a.frontmatter?.date ? new Date(a.frontmatter.date) : new Date(0);
        const dateB = b.frontmatter?.date ? new Date(b.frontmatter.date) : new Date(0);
        return dateB - dateA;
      });
      break;
    case 'date-asc':
      filtered.sort((a, b) => {
        const dateA = a.frontmatter?.date ? new Date(a.frontmatter.date) : new Date(0);
        const dateB = b.frontmatter?.date ? new Date(b.frontmatter.date) : new Date(0);
        return dateA - dateB;
      });
      break;
  }

  // Pagination
  const totalPages = filtered.length;
  const totalPaginationPages = Math.ceil(totalPages / window.pagesPerPage);
  const startIndex = (window.currentPage - 1) * window.pagesPerPage;
  const endIndex = Math.min(startIndex + window.pagesPerPage, totalPages);
  const paginatedPages = filtered.slice(startIndex, endIndex);

  // Show/hide empty state
  if (filtered.length === 0) {
    tbody.innerHTML = '';
    emptyEl.classList.remove('d-none');
    document.getElementById('pages-pagination')?.classList.add('d-none');
    document.getElementById('pages-pagination-top')?.classList.add('d-none');
    return;
  }

  emptyEl.classList.add('d-none');

  // Render table rows
  tbody.innerHTML = paginatedPages.map((page, index) => {
    const rowNumber = startIndex + index + 1;
    const title = page.frontmatter?.title || page.name;
    const permalink = page.frontmatter?.permalink || '-';
    const isProtected = page.frontmatter?.protected === true;

    // Protected pages don't show delete link
    const deleteLink = isProtected
      ? ''
      : ` <span class="text-muted">|</span> <span><button type="button" onclick="window.deletePageFromList('${escapeJs(page.name)}', '${escapeJs(page.sha)}')" class="btn btn-link text-primary p-0 border-0 text-decoration-none">Bin</button></span>`;

    // Get date from frontmatter or file metadata
    const datePublished = page.frontmatter?.date || '-';
    const formattedDate = datePublished !== '-'
      ? new Date(datePublished).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      : '-';

    // Get last modified date - default to published date if not present
    const lastModified = page.frontmatter?.last_modified_at
      ? new Date(page.frontmatter.last_modified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
      : formattedDate; // Default to published date

    // Protected page indicator
    const protectedIndicator = isProtected
      ? '<i class="fas fa-lock text-muted me-2" title="Protected page"></i>'
      : '';

    return `
      <tr class="small">
        <td class="px-3 py-2 text-muted">${rowNumber}</td>
        <td class="px-3 py-2 row-with-actions">
          <div class="fw-medium text-dark">${protectedIndicator}${escapeHtml(title)}</div>
          <div class="row-actions">
            <span><button type="button" onclick="window.location.href='/admin/pages/edit.html?file=${encodeURIComponent(page.name)}'" class="btn btn-link text-primary p-0 border-0 text-decoration-none">Edit</button></span>${deleteLink} <span class="text-muted">|</span>
            <span><button type="button" onclick="window.open('${escapeJs(permalink)}', '_blank')" class="btn btn-link text-primary p-0 border-0 text-decoration-none">View</button></span>
          </div>
        </td>
        <td class="px-3 py-2 text-body-secondary">${escapeHtml(permalink)}</td>
        <td class="px-3 py-2 text-body-secondary">${formattedDate}</td>
        <td class="px-3 py-2 text-body-secondary">${lastModified}</td>
      </tr>
    `;
  }).join('');

  // Update pagination
  updatePagesPagination(totalPages, startIndex + 1, endIndex, totalPaginationPages);
}

/**
 * Filters pages based on search input
 *
 * Re-renders the pages list with search filter applied.
 *
 * @example
 * import { filterPages } from './modules/pages.js';
 * filterPages();
 */
export function filterPages() {
  renderPagesList();
}

/**
 * Debounced version of filterPages for search input
 *
 * Debounces the filterPages function with 300ms delay to avoid excessive re-renders
 * while user is typing in the search box.
 *
 * @example
 * import { debouncedFilterPages } from './modules/pages.js';
 * document.getElementById('pages-search').addEventListener('input', debouncedFilterPages);
 */
export const debouncedFilterPages = debounce(filterPages, 300);

/**
 * Triggers pages list re-sort based on dropdown selection
 *
 * Resets to first page and re-renders the pages list with new sort order.
 *
 * @example
 * import { sortPages } from './modules/pages.js';
 * sortPages();
 */
export function sortPages() {
  window.currentPage = 1; // Reset to first page
  renderPagesList();
}

/**
 * Resets all page filters to their default values
 *
 * Clears the search input, resets sort to default, and re-renders the pages list.
 *
 * @example
 * import { resetPagesFilters } from './modules/pages.js';
 * resetPagesFilters();
 */
export function resetPagesFilters() {
  // Clear search input
  const searchInput = document.getElementById('pages-search');
  if (searchInput) {
    searchInput.value = '';
  }

  // Reset sort to default (title A-Z)
  const sortSelect = document.getElementById('pages-sort');
  if (sortSelect) {
    sortSelect.value = 'title-asc';
  }

  // Reset to first page and re-render
  window.currentPage = 1;
  renderPagesList();
}

/**
 * Updates pagination UI for pages list
 *
 * Updates page numbers, range display, and enables/disables prev/next buttons.
 *
 * @param {number} total - Total number of pages
 * @param {number} start - Starting index of current page
 * @param {number} end - Ending index of current page
 * @param {number} totalPages - Total number of pages
 *
 * @example
 * import { updatePagesPagination } from './modules/pages.js';
 * updatePagesPagination(50, 1, 20, 3);
 */
export function updatePagesPagination(total, start, end, totalPages) {
  const paginationEl = document.getElementById('pages-pagination');
  const paginationTopEl = document.getElementById('pages-pagination-top');
  const prevBtn = document.getElementById('pages-prev-btn');
  const nextBtn = document.getElementById('pages-next-btn');
  const prevBtnTop = document.getElementById('pages-prev-btn-top');
  const nextBtnTop = document.getElementById('pages-next-btn-top');

  if (totalPages <= 1) {
    paginationEl?.classList.add('d-none');
    paginationTopEl?.classList.add('d-none');
    return;
  }

  paginationEl?.classList.remove('d-none');
  paginationTopEl?.classList.remove('d-none');

  // Update bottom pagination
  const rangeStart = document.getElementById('pages-range-start');
  const rangeEnd = document.getElementById('pages-range-end');
  const pagesTotal = document.getElementById('pages-total');
  if (rangeStart) rangeStart.textContent = start;
  if (rangeEnd) rangeEnd.textContent = end;
  if (pagesTotal) pagesTotal.textContent = total;

  // Update top pagination
  const rangeStartTop = document.getElementById('pages-range-start-top');
  const rangeEndTop = document.getElementById('pages-range-end-top');
  const pagesTotalTop = document.getElementById('pages-total-top');
  if (rangeStartTop) rangeStartTop.textContent = start;
  if (rangeEndTop) rangeEndTop.textContent = end;
  if (pagesTotalTop) pagesTotalTop.textContent = total;

  // Update button states
  if (prevBtn) prevBtn.disabled = window.currentPage === 1;
  if (nextBtn) nextBtn.disabled = window.currentPage === totalPages;
  if (prevBtnTop) prevBtnTop.disabled = window.currentPage === 1;
  if (nextBtnTop) nextBtnTop.disabled = window.currentPage === totalPages;
}

/**
 * Changes the current page in pages pagination
 *
 * Updates the current page number, re-renders the pages list, and scrolls to top.
 *
 * @param {number} delta - Page change delta (+1 for next, -1 for previous)
 *
 * @example
 * import { changePagesPagination } from './modules/pages.js';
 * changePagesPagination(1); // Next page
 * changePagesPagination(-1); // Previous page
 */
export function changePagesPagination(delta) {
  window.currentPage += delta;
  renderPagesList();
  // Scroll to top of pages section
  const pagesSection = document.getElementById('section-pages');
  if (pagesSection) {
    pagesSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

/**
 * Opens image chooser for inserting images into markdown editor
 *
 * Opens the Cloudinary image chooser modal and inserts the selected image as markdown syntax at the cursor position.
 *
 * @param {Object} editor - EasyMDE editor instance
 *
 * @example
 * import { openImageChooserForMarkdown } from './modules/pages.js';
 * openImageChooserForMarkdown(window.pageMarkdownEditor);
 */
export function openImageChooserForMarkdown(editor) {
  window.openImageChooser((imageUrl) => {
    // Insert markdown image syntax at cursor position
    const cm = editor.codemirror;
    const cursor = cm.getCursor();
    cm.setSelection(cursor, cursor); // Clear any selection
    cm.replaceSelection(`![](${imageUrl})`);
    // Focus editor
    cm.focus();
    // Mark as dirty
    window.pageHasUnsavedChanges = true;
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
 * import { openGalleryChooserForMarkdown } from './modules/pages.js';
 * openGalleryChooserForMarkdown(window.pageMarkdownEditor);
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
      window.pageHasUnsavedChanges = true;
    }
  }, true); // true = multi-select mode
}

/**
 * Initializes the EasyMDE markdown editor for pages
 *
 * Creates the EasyMDE instance for page content editing if it doesn't exist, and sets up change tracking.
 *
 * @example
 * import { initPageMarkdownEditor } from './modules/pages.js';
 * initPageMarkdownEditor();
 */
export function initPageMarkdownEditor() {
  if (!window.pageMarkdownEditor) {
    window.pageMarkdownEditor = new EasyMDE({
      element: document.getElementById('page-content'),
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
    window.pageMarkdownEditor.codemirror.on('change', () => {
      if (!isInitializingPage) {
        window.pageHasUnsavedChanges = true;
      }
    });
  }
}

/**
 * Cleans up and destroys the page markdown editor instance
 *
 * Converts the EasyMDE editor back to a textarea and nullifies the instance.
 *
 * @example
 * import { cleanupPageMarkdownEditor } from './modules/pages.js';
 * cleanupPageMarkdownEditor();
 */
export function cleanupPageMarkdownEditor() {
  if (window.pageMarkdownEditor) {
    window.pageMarkdownEditor.toTextArea();
    window.pageMarkdownEditor = null;
  }
}

/**
 * Marks the current page as having unsaved changes
 *
 * Sets the pageHasUnsavedChanges flag.
 *
 * @example
 * import { markPageDirty } from './modules/pages.js';
 * markPageDirty();
 */
export function markPageDirty() {
  window.pageHasUnsavedChanges = true;
}

/**
 * Clears the unsaved changes flag for the current page
 *
 * Resets the pageHasUnsavedChanges flag.
 *
 * @example
 * import { clearPageDirty } from './modules/pages.js';
 * clearPageDirty();
 */
export function clearPageDirty() {
  window.pageHasUnsavedChanges = false;
}

/**
 * Converts text to a URL-friendly slug
 *
 * Converts to lowercase, replaces spaces with hyphens, removes special characters.
 * Adds leading and trailing slashes for permalink format.
 *
 * @param {string} text - Text to slugify
 *
 * @returns {string} URL-friendly slug with slashes
 *
 * @example
 * import { slugifyPermalink } from './modules/pages.js';
 * const slug = slugifyPermalink('About Us'); // Returns: '/about-us/'
 */
export function slugifyPermalink(text) {
  return '/' + text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .replace(/^-|-$/g, '')     // Remove leading/trailing hyphens
    + '/';
}

/**
 * Auto-populates permalink field from page title
 *
 * Slugifies the title and sets it as the permalink, adding leading slash.
 * Only auto-populates if permalink is empty or hasn't been manually edited.
 *
 * @example
 * import { autoPopulatePermalink } from './modules/pages.js';
 * autoPopulatePermalink();
 */
export function autoPopulatePermalink() {
  const titleInput = document.getElementById('page-title');
  const permalinkInput = document.getElementById('page-permalink');

  if (!titleInput || !permalinkInput) return;

  // Only auto-populate if:
  // 1. Permalink is empty, OR
  // 2. Permalink hasn't been manually edited
  if (permalinkInput.value === '' || !window.permalinkManuallyEdited) {
    const slugified = slugifyPermalink(titleInput.value);
    permalinkInput.value = slugified;
  }
}

/**
 * Loads and displays a page for editing
 *
 * Fetches page data from the API, populates the editor form, initializes the markdown editor, and updates the URL.
 *
 * @param {string} filename - Name of the page file to edit
 * @param {boolean} [updateUrl=true] - Whether to update browser URL
 *
 * @throws {Error} If page load fails
 *
 * @example
 * import { editPage } from './modules/pages.js';
 * await editPage('about.md');
 */
export async function editPage(filename, updateUrl = true) {
  try {
    // Set initialization flag to prevent false dirty flag
    isInitializingPage = true;

    // Clear any existing page data first to prevent stale state
    window.currentPage_pages = null;
    window.permalinkManuallyEdited = false; // Reset flag when loading existing page

    const response = await fetch(`${window.API_BASE}/pages?path=${encodeURIComponent(filename)}`);
    if (!response.ok) throw new Error('Failed to load page');

    window.currentPage_pages = await response.json();

    // Populate form
    document.getElementById('page-title').value = window.currentPage_pages.frontmatter.title || '';
    document.getElementById('page-permalink').value = window.currentPage_pages.frontmatter.permalink || '';
    document.getElementById('page-layout').value = window.currentPage_pages.frontmatter.layout || 'default';
    document.getElementById('page-protected').checked = window.currentPage_pages.frontmatter.protected === true;

    // Set date field - use existing date or default to current date/time
    const dateValue = window.currentPage_pages.frontmatter.date || new Date().toISOString();
    document.getElementById('page-date').value = window.formatDateForInput(dateValue);

    // Display last modified date (read-only, informational)
    const lastModifiedEl = document.getElementById('page-last-modified');
    if (lastModifiedEl && window.currentPage_pages.frontmatter.last_modified_at) {
      const lastModified = new Date(window.currentPage_pages.frontmatter.last_modified_at);
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

    // Initialize markdown editor if needed
    if (!window.pageMarkdownEditor) {
      initPageMarkdownEditor();
    }
    // Ensure editor content is set (use requestAnimationFrame for reliable initialization)
    requestAnimationFrame(() => {
      if (window.pageMarkdownEditor && window.pageMarkdownEditor.codemirror) {
        window.pageMarkdownEditor.value(window.currentPage_pages.body || '');
      }
      // Clear dirty flag and end initialization AFTER editor content is set
      clearPageDirty();
      isInitializingPage = false;
    });

    // Show editor (if these elements exist - they may not on standalone editor page)
    const listView = document.getElementById('pages-list-view');
    const editorView = document.getElementById('pages-editor-view');
    if (listView) listView.classList.add('d-none');
    if (editorView) editorView.classList.remove('d-none');

    const editorTitle = document.getElementById('page-editor-title');
    const deleteBtn = document.getElementById('delete-page-btn');
    if (editorTitle) editorTitle.textContent = `Edit: ${filename}`;

    // Hide delete button for protected pages
    if (deleteBtn) {
      const isProtected = window.currentPage_pages?.frontmatter?.protected === true;
      if (isProtected) {
        deleteBtn.style.display = 'none';
        deleteBtn.disabled = true;
      } else {
        deleteBtn.style.display = 'block';
        deleteBtn.disabled = false;
      }
    }

    // Add change listeners to form inputs
    setupPageFormChangeListeners();
  } catch (error) {
    showError('Failed to load page: ' + error.message);
    isInitializingPage = false;
  }
}

/**
 * Shows the editor form for creating a new page
 *
 * Clears all form fields, initializes the markdown editor, and updates the URL.
 *
 * @param {boolean} [updateUrl=true] - Whether to update browser URL
 *
 * @example
 * import { showNewPageForm } from './modules/pages.js';
 * showNewPageForm();
 */
export function showNewPageForm(updateUrl = true) {
  window.currentPage_pages = null;
  window.permalinkManuallyEdited = false; // Reset flag for new page

  // Clear form
  document.getElementById('page-title').value = '';
  document.getElementById('page-permalink').value = '';
  document.getElementById('page-layout').value = 'default';
  document.getElementById('page-protected').checked = false;

  // Set current date/time as default for new pages
  document.getElementById('page-date').value = window.formatDateForInput(new Date().toISOString());

  // Reset last modified display for new pages
  const lastModifiedEl = document.getElementById('page-last-modified');
  if (lastModifiedEl) {
    lastModifiedEl.textContent = 'Not yet modified';
  }

  // Initialize markdown editor if needed and clear content
  if (!window.pageMarkdownEditor) {
    initPageMarkdownEditor();
  }
  // Ensure editor is cleared (use requestAnimationFrame for reliable initialization)
  requestAnimationFrame(() => {
    if (window.pageMarkdownEditor && window.pageMarkdownEditor.codemirror) {
      window.pageMarkdownEditor.value('');
    }
  });

  // Show editor (if these elements exist - they may not on standalone editor page)
  const listView = document.getElementById('pages-list-view');
  const editorView = document.getElementById('pages-editor-view');
  if (listView) listView.classList.add('d-none');
  if (editorView) editorView.classList.remove('d-none');

  const editorTitle = document.getElementById('page-editor-title');
  const deleteBtn = document.getElementById('delete-page-btn');
  if (editorTitle) editorTitle.textContent = 'New Page';
  if (deleteBtn) deleteBtn.style.display = 'none';

  // Clear dirty flag for new page
  clearPageDirty();

  // Add change listeners to form inputs
  setupPageFormChangeListeners();
}

/**
 * Sets up change listeners on page editor form fields
 *
 * Adds input event listeners to mark the page as dirty when any field changes.
 * Also sets up auto-populate permalink from title functionality.
 *
 * @example
 * import { setupPageFormChangeListeners } from './modules/pages.js';
 * setupPageFormChangeListeners();
 */
export function setupPageFormChangeListeners() {
  // Only setup once
  if (window._pageFormListenersSetup) return;
  window._pageFormListenersSetup = true;

  const formInputs = [
    'page-title',
    'page-permalink',
    'page-date',
    'page-layout',
    'page-protected'
  ];

  formInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', markPageDirty);
      input.addEventListener('change', markPageDirty);
    }
  });

  // Auto-populate permalink from title
  const titleInput = document.getElementById('page-title');
  if (titleInput) {
    titleInput.addEventListener('input', autoPopulatePermalink);
  }

  // Track manual edits to permalink
  const permalinkInput = document.getElementById('page-permalink');
  if (permalinkInput) {
    permalinkInput.addEventListener('input', () => {
      window.permalinkManuallyEdited = true;
    });
  }
}

/**
 * Returns to the pages list view from the editor
 *
 * Hides the editor, shows the list view, clears currentPage, updates URL, and optionally reloads pages.
 * Prompts user if there are unsaved changes.
 *
 * @returns {Promise<void>}
 *
 * @example
 * import { showPagesList } from './modules/pages.js';
 * await showPagesList();
 */
export async function showPagesList() {
  // Check for unsaved changes
  if (window.pageHasUnsavedChanges) {
    const confirmed = await window.showConfirm('You have unsaved changes. Are you sure you want to leave this page?');
    if (!confirmed) return;
  }

  // Hide editor and show list
  document.getElementById('pages-editor-view').classList.add('d-none');
  document.getElementById('pages-list-view').classList.remove('d-none');
  window.currentPage_pages = null;
  clearPageDirty();
}

/**
 * Saves the current page to the backend
 *
 * Validates required fields, collects form data, sends POST/PUT request, handles deployment tracking, and returns to pages list.
 *
 * @param {Event} event - Form submit event
 *
 * @throws {Error} If page save fails
 *
 * @example
 * import { savePage } from './modules/pages.js';
 * document.getElementById('page-form').addEventListener('submit', savePage);
 */
export async function savePage(event) {
  event.preventDefault();

  const saveBtn = document.getElementById('save-page-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = 'Saving...';

  try {
    const title = document.getElementById('page-title').value;
    const permalink = document.getElementById('page-permalink').value;
    const layout = document.getElementById('page-layout').value;
    const protected_page = document.getElementById('page-protected').checked;
    const date = document.getElementById('page-date').value;
    const content = window.pageMarkdownEditor ? window.pageMarkdownEditor.value() : document.getElementById('page-content').value;

    const frontmatter = {
      layout,
      title,
      permalink
    };

    // Add date if provided
    if (date) {
      frontmatter.date = date;
    }

    // Only add protected field if it's true
    if (protected_page) {
      frontmatter.protected = true;
    }

    if (window.currentPage_pages) {
      // Update existing page
      const response = await fetch(`${window.API_BASE}/pages`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: window.currentPage_pages.path.replace('_pages/', ''),
          frontmatter,
          body: content,
          sha: window.currentPage_pages.sha
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to save page');
      }

      const data = await response.json();
      if (data.commitSha) {
        window.trackDeployment(data.commitSha, `Update page: ${title}`, window.currentPage_pages.path.replace('_pages/', ''));
      }

      showSuccess('Page updated successfully!');
    } else {
      // Create new page
      const filename = generatePageFilename(title);

      const response = await fetch(`${window.API_BASE}/pages`, {
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
        throw new Error(error.message || 'Failed to create page');
      }

      const data = await response.json();
      if (data.commitSha) {
        window.trackDeployment(data.commitSha, `Create page: ${title}`, filename);
      }

      showSuccess('Page created successfully!');
    }

    // Clear dirty flag after successful save
    clearPageDirty();

    // Clear pages cache to force fresh data on next load
    clearPagesCache();

    // Reload pages and go back to list
    await loadPages();
    showPagesList();
  } catch (error) {
    showError('Failed to save page: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Page';
  }
}

/**
 * Deletes the currently edited page (move to bin)
 *
 * Shows confirmation dialog, validates that protected pages aren't deleted, sends delete request, and returns to pages list.
 *
 * @throws {Error} If page deletion fails
 *
 * @example
 * import { deletePage } from './modules/pages.js';
 * await deletePage();
 */
export async function deletePage() {
  if (!window.currentPage_pages) return;

  const title = window.currentPage_pages.frontmatter?.title || window.currentPage_pages.path;
  const confirmed = await window.showConfirm(`Move "${title}" to bin?`);
  if (!confirmed) return;

  try {
    const filename = window.currentPage_pages.path.replace('_pages/', '');

    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: window.currentPage_pages.sha,
        type: 'page'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to move page to bin');
    }

    const data = await response.json();
    if (data.commitSha) {
      window.trackDeployment(data.commitSha, `Move page to bin: ${title}`, filename);
    }

    showSuccess('Page moved to bin successfully!');

    // Clear pages cache
    clearPagesCache();

    await loadPages();
    showPagesList();
  } catch (error) {
    showError('Failed to move page to bin: ' + error.message);
  }
}

/**
 * Deletes a page from the pages list view (move to bin)
 *
 * Shows confirmation dialog, validates protected pages, sends delete request with SHA, tracks deployment, and refreshes the list.
 *
 * @param {string} filename - Name of the page file to delete
 * @param {string} sha - Git SHA of the file
 *
 * @throws {Error} If page deletion fails
 *
 * @example
 * import { deletePageFromList } from './modules/pages.js';
 * await deletePageFromList('about.md', 'abc123sha');
 */
export async function deletePageFromList(filename, sha) {
  const allPages = window.allPages || [];
  const page = allPages.find(p => p.name === filename);
  const title = page?.frontmatter?.title || filename;

  const confirmed = await window.showConfirm(`Move "${title}" to bin?`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: sha,
        type: 'page'
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to move page to bin');
    }

    const data = await response.json();
    if (data.commitSha) {
      window.trackDeployment(data.commitSha, `Move page to bin: ${title}`, filename);
    }

    showSuccess('Page moved to bin successfully!');

    // Clear pages cache
    clearPagesCache();

    // Remove from local array
    window.allPages = allPages.filter(p => p.name !== filename);

    // Re-render the list
    renderPagesList();
  } catch (error) {
    showError('Failed to move page to bin: ' + error.message);
  }
}

/**
 * Generates a filename from page title
 *
 * Slugifies the title and adds .md extension.
 *
 * @param {string} title - Page title
 *
 * @returns {string} Generated filename
 *
 * @example
 * import { generatePageFilename } from './modules/pages.js';
 * const filename = generatePageFilename('About Us'); // Returns: 'about-us.md'
 */
export function generatePageFilename(title) {
  const slug = title.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}.md`;
}

// Expose link editor search to window for onclick handler
window.linkEditorSearchContent = linkEditorSearchContent;
