/**
 * Bin Module
 *
 * Manages soft-deleted posts and pages with restore and permanent delete capabilities.
 * Provides bin list rendering, item restoration, and permanent deletion.
 *
 * Features:
 * - Load and display binned items
 * - Restore items to posts or pages
 * - Permanently delete items
 * - Track deployments for restore/delete operations
 * - Reload related lists after operations
 *
 * Dependencies:
 * - core/utils.js for escapeHtml()
 * - ui/notifications.js for showError() and showSuccess()
 * - Global API_BASE constant
 * - Global showConfirm() function
 * - Global trackDeployment() function
 * - Global loadPosts() and loadPages() functions
 *
 * @module modules/bin
 */

import { escapeHtml } from '../core/utils.js';
import { showError, showSuccess } from '../ui/notifications.js';
import logger from '../core/logger.js';

/**
 * Access global allBinnedItems array from app.js
 * This is shared state between the module and app.js
 */

/**
 * Loads deleted items from the bin
 *
 * Fetches binned posts and pages from the backend and renders the bin list.
 * Hides the loading indicator when complete.
 *
 * @throws {Error} If bin load fails
 *
 * @example
 * import { loadBin } from './modules/bin.js';
 * await loadBin();
 */
export async function loadBin() {
  try {
    const response = await fetch(`${window.API_BASE}/bin`);
    if (!response.ok) throw new Error('Failed to load bin');

    const data = await response.json();
    window.allBinnedItems = data.items || [];

    renderBinList();
  } catch (error) {
    showError('Failed to load bin: ' + error.message);
  } finally {
    const loadingEl = document.getElementById('bin-loading');
    if (loadingEl) {
      loadingEl.classList.add('d-none');
    }
  }
}

/**
 * Renders the bin list with restore and permanent delete actions
 *
 * Displays all binned items with their type, date, and action buttons.
 * Shows empty state message when no items are in bin.
 *
 * @example
 * import { renderBinList } from './modules/bin.js';
 * renderBinList();
 */
export function renderBinList() {
  const listEl = document.getElementById('bin-list');
  const emptyEl = document.getElementById('bin-empty');

  if (!listEl || !emptyEl) {
    logger.warn('Bin DOM elements not found');
    return;
  }

  const allBinnedItems = window.allBinnedItems || [];

  // Helper function to escape strings for JavaScript context (onclick attributes)
  // This is different from escapeHtml() which creates HTML entities
  const escapeJs = (str) => String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');

  if (allBinnedItems.length === 0) {
    listEl.innerHTML = '';
    emptyEl.classList.remove('d-none');
    return;
  }

  emptyEl.classList.add('d-none');

  listEl.innerHTML = allBinnedItems.map(item => {
    const typeLabel = item.type === 'page' ? 'Page' : 'Post';
    const typeBadgeColor = item.type === 'page' ? 'bg-info bg-opacity-10 text-info' : 'bg-primary bg-opacity-10 text-primary';

    // Format binned_at timestamp
    let binnedAtDisplay = '';
    if (item.binned_at) {
      const binnedDate = new Date(item.binned_at);
      binnedAtDisplay = binnedDate.toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    return `
    <li class="d-flex align-items-center gap-3 p-3 bg-light rounded">
      <svg class="text-secondary flex-shrink-0" style="width: 1.25rem; height: 1.25rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/>
      </svg>
      <div class="flex-fill">
        <div class="fw-medium">${escapeHtml(item.name)}</div>
        ${binnedAtDisplay ? `<div class="small text-muted">Deleted: ${binnedAtDisplay}</div>` : ''}
      </div>
      <span class="badge ${typeBadgeColor} fw-medium">${typeLabel}</span>
      <span class="small text-muted">${(item.size / 1024).toFixed(1)} KB</span>
      <button
        onclick="window.restoreItem('${escapeJs(item.name)}', '${escapeJs(item.sha)}', '${escapeJs(item.type)}');"
        class="btn btn-sm btn-primary"
        title="Restore item from bin"
      >
        Restore
      </button>
      <button
        onclick="window.permanentlyDeleteItem('${escapeJs(item.name)}', '${escapeJs(item.sha)}', '${escapeJs(item.type)}');"
        class="btn btn-sm btn-danger"
        title="Permanently delete item"
      >
        Delete Forever
      </button>
    </li>
  `;
  }).join('');
}

/**
 * Restores a deleted item from bin with deployment tracking
 *
 * Shows confirmation dialog, sends restore request to backend, tracks deployment,
 * and refreshes the bin list. Reloads posts or pages list if applicable.
 *
 * @param {string} filename - Name of the file to restore
 * @param {string} sha - Git SHA of the deleted file
 * @param {string} type - Type of item ("post" or "page")
 *
 * @throws {Error} If restore fails
 *
 * @example
 * import { restoreItem } from './modules/bin.js';
 * await restoreItem('my-post.md', 'abc123', 'post');
 */
export async function restoreItem(filename, sha, type) {
  const itemType = type === 'page' ? 'page' : 'post';
  const destination = type === 'page' ? 'pages' : 'posts';

  const confirmed = await window.showConfirm(`Restore "${filename}" to ${destination}?`, {
    title: 'Confirm Restore',
    buttonText: 'Restore',
    buttonClass: 'btn-primary'
  });

  if (!confirmed) return;

  try {
    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: sha,
        type: type
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to restore ${itemType}`);
    }

    const result = await response.json();

    // Track deployment if commitSha is returned
    if (result.commitSha && window.trackDeployment) {
      window.trackDeployment(result.commitSha, `Restore ${itemType}: ${filename}`);
    }

    showSuccess(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} restored! Changes publishing...`);

    // Remove from global array (optimistic update)
    window.allBinnedItems = window.allBinnedItems.filter(p => p.name !== filename);

    // Re-render bin list immediately
    renderBinList();

    // Clear cache and reload the appropriate list to show the restored item
    if (type === 'page') {
      // Clear pages cache before reloading
      if (typeof window.clearPagesCache === 'function') {
        logger.log('[Bin] Clearing pages cache after restoration');
        window.clearPagesCache();
      }
      if (typeof window.loadPages === 'function') {
        logger.log('[Bin] Reloading pages list after restoration');
        await window.loadPages();
        logger.log('[Bin] Pages reloaded, count:', window.allPages?.length);
      }
    } else if (type === 'post') {
      // Clear posts cache before reloading
      if (typeof window.clearPostsCache === 'function') {
        logger.log('[Bin] Clearing posts cache after restoration');
        window.clearPostsCache();
      }
      if (typeof window.loadPosts === 'function') {
        logger.log('[Bin] Reloading posts list after restoration');
        await window.loadPosts();
        logger.log('[Bin] Posts reloaded, count:', window.allPosts?.length);
      }
    }
  } catch (error) {
    showError(`Failed to restore ${itemType}: ` + error.message);
  }
}

/**
 * Permanently deletes an item from bin
 *
 * Shows confirmation warning, sends permanent delete request to backend,
 * tracks deployment, and refreshes the bin list.
 *
 * Warning: This action cannot be undone.
 *
 * @param {string} filename - Name of the file to delete
 * @param {string} sha - Git SHA of the file
 * @param {string} type - Type of item ("post" or "page")
 *
 * @throws {Error} If permanent deletion fails
 *
 * @example
 * import { permanentlyDeleteItem } from './modules/bin.js';
 * await permanentlyDeleteItem('old-post.md', 'abc123', 'post');
 */
export async function permanentlyDeleteItem(filename, sha, type) {
  const itemType = type === 'page' ? 'page' : 'post';

  const confirmed = await window.showConfirm(`Permanently delete "${filename}"? This cannot be undone!`);
  if (!confirmed) return;

  try {
    const response = await fetch(`${window.API_BASE}/bin`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: filename,
        sha: sha,
        type: type
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to delete ${itemType}`);
    }

    const data = await response.json();

    if (data.commitSha && window.trackDeployment) {
      window.trackDeployment(data.commitSha, `Permanently delete ${itemType}: ${filename}`);
    }

    showSuccess(`${itemType.charAt(0).toUpperCase() + itemType.slice(1)} permanently deleted! Changes publishing...`);

    // Remove from global array (optimistic update)
    window.allBinnedItems = window.allBinnedItems.filter(p => p.name !== filename);

    // Re-render bin list immediately
    renderBinList();
  } catch (error) {
    showError(`Failed to delete ${itemType}: ` + error.message);
  }
}

/**
 * Gets the current binned items array
 *
 * Provides read-only access to the binned items for testing or inspection.
 *
 * @returns {Array<Object>} Array of binned items
 *
 * @example
 * import { getBinnedItems } from './modules/bin.js';
 * const items = getBinnedItems();
 * logger.log(`${items.length} items in bin`);
 */
export function getBinnedItems() {
  return window.allBinnedItems || [];
}
