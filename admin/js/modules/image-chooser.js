/**
 * Image Chooser Module
 *
 * Bootstrap modal-based image chooser that integrates with the Media Library.
 * Provides a consistent UI for selecting featured images in posts/pages.
 *
 * Features:
 * - Bootstrap modal with media grid
 * - Search and filter capabilities
 * - Pagination support
 * - Callback system for image selection
 * - Consistent styling with admin interface
 *
 * Dependencies:
 * - core/utils.js for escapeHtml()
 * - ui/notifications.js for showError()
 * - Global API_BASE constant
 * - External: Bootstrap 5 (for modal functionality)
 *
 * @module modules/image-chooser
 */

import { escapeHtml } from '../core/utils.js';
import { showError } from '../ui/notifications.js';
import logger from '../core/logger.js';

let chooserCallback = null;
let chooserMedia = [];
let chooserPage = 1;
const chooserPerPage = 12;
let chooserModalInstance = null;
let chooserMultiSelect = false;
let chooserSelectedImages = [];

/**
 * Opens the image chooser modal using Bootstrap
 *
 * Displays a Bootstrap modal with media library grid for selecting an image or multiple images.
 * Calls the provided callback with the selected image URL (single) or array of URLs (multi).
 *
 * @param {Function} callback - Function to call with selected image URL(s)
 * @param {boolean} [multiSelect=false] - Whether to allow multiple image selection
 *
 * @example
 * // Single select
 * import { openImageChooser } from './modules/image-chooser.js';
 * openImageChooser((url) => {
 *   document.getElementById('image-field').value = url;
 * });
 *
 * // Multi select
 * openImageChooser((urls) => {
 *   logger.log('Selected:', urls);
 * }, true);
 */
export async function openImageChooser(callback, multiSelect = false) {
  chooserCallback = callback;
  chooserPage = 1;
  chooserMultiSelect = multiSelect;
  chooserSelectedImages = [];

  // Load media if not already loaded
  try {
    const response = await fetch(`${window.API_BASE}/media`);
    if (!response.ok) throw new Error('Failed to load media');

    const data = await response.json();
    const resources = data.resources || [];

    // Deduplicate by public_id to avoid showing multiple versions of same image
    const uniqueMap = new Map();
    resources.forEach(resource => {
      if (!uniqueMap.has(resource.public_id)) {
        uniqueMap.set(resource.public_id, resource);
      }
    });
    chooserMedia = Array.from(uniqueMap.values());

    // Clear search and folder inputs
    const searchInput = document.getElementById('chooser-search');
    if (searchInput) {
      searchInput.value = '';
    }

    // Populate folder dropdown
    populateFolderDropdown();

    // Show/hide multi-select controls based on mode
    const multiControls = document.getElementById('chooser-multi-controls');
    const modalFooter = document.getElementById('chooser-modal-footer');
    if (multiSelect) {
      if (multiControls) multiControls.classList.remove('d-none');
      if (modalFooter) modalFooter.classList.remove('d-none');
      updateSelectionCounter();
    } else {
      if (multiControls) multiControls.classList.add('d-none');
      if (modalFooter) modalFooter.classList.add('d-none');
    }

    // Render grid and show modal
    renderChooserGrid();

    const modalElement = document.getElementById('imageChooserModal');
    if (modalElement) {
      if (!chooserModalInstance) {
        chooserModalInstance = new bootstrap.Modal(modalElement);
      }
      chooserModalInstance.show();
    }
  } catch (error) {
    showError('Failed to load media: ' + error.message);
  }
}

/**
 * Renders the image chooser grid
 *
 * @private
 */
function renderChooserGrid() {
  const grid = document.getElementById('chooser-grid');
  const emptyEl = document.getElementById('chooser-empty');
  const search = document.getElementById('chooser-search')?.value.toLowerCase() || '';
  const folder = document.getElementById('chooser-folder')?.value.toLowerCase() || '';

  // Filter media
  let filtered = chooserMedia.filter(media => {
    const matchesType = media.resource_type === 'image';
    const matchesSearch = !search || media.public_id.toLowerCase().includes(search);

    // Match exact folder by ensuring the folder path is followed by a '/'
    // This prevents "blog" from matching "blog-archive"
    let matchesFolder = !folder;
    if (folder) {
      const publicIdLower = media.public_id.toLowerCase();
      matchesFolder = publicIdLower.startsWith(folder + '/') || publicIdLower === folder;
    }

    return matchesType && matchesSearch && matchesFolder;
  });

  // Sort by most recent
  filtered = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  // Pagination
  const totalPages = Math.ceil(filtered.length / chooserPerPage);
  const startIndex = (chooserPage - 1) * chooserPerPage;
  const paginatedMedia = filtered.slice(startIndex, startIndex + chooserPerPage);

  // Show/hide empty state
  if (filtered.length === 0) {
    if (grid) grid.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('d-none');
    const paginationEl = document.getElementById('chooser-pagination');
    if (paginationEl) paginationEl.classList.add('d-none');
    return;
  }

  if (emptyEl) emptyEl.classList.add('d-none');

  // Helper function to escape strings for JavaScript context (onclick attributes)
  const escapeJs = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  // Render grid
  if (grid) {
    grid.innerHTML = paginatedMedia.map(media => {
      const thumbnailUrl = media.secure_url.replace('/upload/', '/upload/w_200,h_200,c_fill/');
      const filename = media.public_id.split('/').pop();
      const isSelected = chooserSelectedImages.includes(media.secure_url);
      const selectedClass = isSelected ? 'border-primary border-3' : '';

      if (chooserMultiSelect) {
        // Multi-select mode: Show checkbox and toggle selection
        return `
          <div class="col">
            <button
              onclick="window.toggleChooserImage('${escapeJs(media.secure_url)}');"
              class="chooser-image-btn position-relative bg-light rounded overflow-hidden border ${selectedClass} w-100 p-0"
              title="${escapeHtml(filename)}"
              data-url="${escapeHtml(media.secure_url)}"
            >
              <img
                src="${thumbnailUrl}"
                alt="${escapeHtml(filename)}"
                class="w-100 h-100 object-fit-cover"
                loading="lazy"
              />
              <div class="position-absolute top-0 start-0 m-2">
                <div class="form-check">
                  <input
                    type="checkbox"
                    class="form-check-input"
                    ${isSelected ? 'checked' : ''}
                    onclick="event.stopPropagation();"
                    style="pointer-events: none; width: 1.5rem; height: 1.5rem;"
                  />
                </div>
              </div>
              ${isSelected ? '<div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center chooser-image-overlay bg-primary bg-opacity-25"></div>' : ''}
            </button>
          </div>
        `;
      } else {
        // Single-select mode: Original behavior
        return `
          <div class="col">
            <button
              onclick="window.selectChooserImage('${escapeJs(media.secure_url)}');"
              class="chooser-image-btn position-relative bg-light rounded overflow-hidden border border-2 w-100 p-0"
              title="${escapeHtml(filename)}"
            >
              <img
                src="${thumbnailUrl}"
                alt="${escapeHtml(filename)}"
                class="w-100 h-100 object-fit-cover"
                loading="lazy"
              />
              <div class="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center chooser-image-overlay">
                <i class="fas fa-check-circle text-white fs-2 opacity-0"></i>
              </div>
            </button>
          </div>
        `;
      }
    }).join('');
  }

  // Update pagination
  updateChooserPagination(totalPages);
}

/**
 * Populates folder dropdown with unique folders from media
 *
 * Pre-selects the default folder from site config if available.
 *
 * @private
 */
function populateFolderDropdown() {
  const folderSelect = document.getElementById('chooser-folder');
  if (!folderSelect) return;

  // Extract unique folders from public_ids
  const folders = new Set();
  chooserMedia.forEach(media => {
    const publicId = media.public_id;
    const lastSlashIndex = publicId.lastIndexOf('/');
    if (lastSlashIndex > 0) {
      const folder = publicId.substring(0, lastSlashIndex);
      folders.add(folder);
    }
  });

  // Sort folders alphabetically
  const sortedFolders = Array.from(folders).sort();

  // Get default folder from site config
  const defaultFolder = window.siteConfig?.cloudinary_default_folder || '';

  // Populate select options
  folderSelect.innerHTML = '<option value="">All Folders</option>' +
    sortedFolders.map(folder => `<option value="${escapeHtml(folder)}">${escapeHtml(folder)}</option>`).join('');

  // Pre-select the default folder if it exists
  if (defaultFolder && sortedFolders.includes(defaultFolder)) {
    folderSelect.value = defaultFolder;
  }
}

/**
 * Updates chooser pagination UI
 *
 * @param {number} totalPages - Total number of pages
 * @private
 */
function updateChooserPagination(totalPages) {
  const paginationEl = document.getElementById('chooser-pagination');
  const prevBtn = document.getElementById('chooser-prev');
  const nextBtn = document.getElementById('chooser-next');
  const currentPageEl = document.getElementById('chooser-current-page');
  const totalPagesEl = document.getElementById('chooser-total-pages');

  if (!paginationEl) return;

  if (totalPages <= 1) {
    paginationEl.classList.add('d-none');
    return;
  }

  paginationEl.classList.remove('d-none');
  if (currentPageEl) currentPageEl.textContent = chooserPage;
  if (totalPagesEl) totalPagesEl.textContent = totalPages;
  if (prevBtn) prevBtn.disabled = chooserPage === 1;
  if (nextBtn) nextBtn.disabled = chooserPage === totalPages;
}

/**
 * Changes chooser page
 *
 * @param {number} delta - Page change delta
 */
export function changeChooserPage(delta) {
  chooserPage += delta;
  renderChooserGrid();
}

/**
 * Filters chooser media by search
 */
export function filterChooserMedia() {
  chooserPage = 1;
  renderChooserGrid();
}

/**
 * Selects an image from the chooser
 *
 * Calls the callback with the image public_id (filename) extracted from the Cloudinary URL.
 * This ensures consistent storage format and enables responsive image optimization.
 *
 * @param {string} url - Full Cloudinary image URL
 *
 * @example
 * // Input: https://res.cloudinary.com/circleseven/image/upload/v123/path/image.jpg
 * // Output: path/image
 */
export function selectChooserImage(url) {
  if (chooserCallback) {
    // Extract public_id from Cloudinary URL (removes version, transformations, extension)
    // Matches: /upload/(optional v123/)path/to/image(.ext)
    const publicIdMatch = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    const publicId = publicIdMatch ? publicIdMatch[1] : url;

    // Return just the public_id for consistent storage format
    chooserCallback(publicId);
  }

  // Close modal using Bootstrap
  if (chooserModalInstance) {
    chooserModalInstance.hide();
  }

  chooserCallback = null;
}

/**
 * Toggles image selection in multi-select mode
 *
 * Adds or removes the image from selected images array and re-renders.
 * Note: Multi-select stores full URLs for gallery generation compatibility.
 *
 * @param {string} url - Image URL to toggle
 */
export function toggleChooserImage(url) {
  const index = chooserSelectedImages.indexOf(url);
  if (index > -1) {
    // Remove from selection
    chooserSelectedImages.splice(index, 1);
  } else {
    // Add to selection
    chooserSelectedImages.push(url);
  }

  // Re-render to update UI
  renderChooserGrid();

  // Update selection counter
  updateSelectionCounter();
}

/**
 * Confirms and inserts selected images in multi-select mode
 *
 * Calls the callback with array of selected URLs and closes the modal.
 */
export function confirmChooserSelection() {
  if (chooserCallback && chooserSelectedImages.length > 0) {
    chooserCallback(chooserSelectedImages);
  }

  // Close modal using Bootstrap
  if (chooserModalInstance) {
    chooserModalInstance.hide();
  }

  chooserCallback = null;
  chooserSelectedImages = [];
}

/**
 * Selects all images on current page
 */
export function selectAllChooserImages() {
  // Get all images on current page
  const buttons = document.querySelectorAll('[data-url]');
  buttons.forEach(btn => {
    const url = btn.getAttribute('data-url');
    if (url && !chooserSelectedImages.includes(url)) {
      chooserSelectedImages.push(url);
    }
  });

  renderChooserGrid();
  updateSelectionCounter();
}

/**
 * Clears all selected images
 */
export function clearChooserSelection() {
  chooserSelectedImages = [];
  renderChooserGrid();
  updateSelectionCounter();
}

/**
 * Updates the selection counter display
 *
 * @private
 */
function updateSelectionCounter() {
  const counter = document.getElementById('chooser-selection-count');
  if (counter) {
    const count = chooserSelectedImages.length;
    counter.textContent = count === 0 ? '' : `${count} image${count === 1 ? '' : 's'} selected`;
  }
}

/**
 * Generates gallery HTML markup from selected image URLs
 *
 * Creates a gallery div with figure elements for each image.
 * Applies Cloudinary transformations for optimized display.
 * Includes anchor tags for GLightbox lightbox functionality.
 *
 * @param {string[]} imageUrls - Array of Cloudinary image URLs
 * @returns {string} HTML markup for the gallery
 *
 * @example
 * const urls = [
 *   'https://res.cloudinary.com/circleseven/image/upload/v123/sample1.jpg',
 *   'https://res.cloudinary.com/circleseven/image/upload/v123/sample2.jpg'
 * ];
 * const html = generateGalleryHTML(urls);
 * // Returns:
 * // <div class="gallery">
 * //   <figure>
 * //     <a href="...q_auto,f_auto.../sample1">
 * //       <img src="...w_800,f_auto,q_auto.../sample1" alt="" loading="lazy" />
 * //     </a>
 * //   </figure>
 * //   ...
 * // </div>
 */
export function generateGalleryHTML(imageUrls) {
  if (!imageUrls || imageUrls.length === 0) {
    return '';
  }

  // Generate figure elements for each image
  const figures = imageUrls.map(url => {
    // Remove file extension to get public_id for Cloudinary
    const urlWithoutExt = url.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');

    // Create full-size URL (for lightbox) with basic optimization
    const fullSizeUrl = urlWithoutExt.replace('/upload/', '/upload/q_auto,f_auto/');

    // Create thumbnail URL with width constraint
    const thumbnailUrl = urlWithoutExt.replace('/upload/', '/upload/w_800,f_auto,q_auto/');

    // Extract filename for alt text (basic fallback)
    const filename = url.split('/').pop().split('.')[0];

    return `<figure><a href="${fullSizeUrl}"><img src="${thumbnailUrl}" alt="${filename}" loading="lazy"></a></figure>`;
  }).join('\n');

  // Return complete gallery HTML with blank lines for readability
  return `<div class="gallery">\n\n${figures}\n\n</div>`;
}
