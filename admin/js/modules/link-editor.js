/**
 * Link Editor Module
 *
 * WordPress-style link insertion/editing for EasyMDE markdown editor.
 * Supports external URLs and internal content linking with search.
 *
 * Features:
 * - URL and link text input
 * - Open in new tab option
 * - Search and link to existing posts/pages
 * - Edit existing links
 * - Recent content suggestions
 *
 * Dependencies:
 * - Global window.allPosts or window.allPages for content search
 *
 * @module modules/link-editor
 */

import { escapeHtml } from '../core/utils.js';
import logger from '../core/logger.js';

/**
 * Slugify a string to match Jekyll's default behavior
 * Converts title to URL-safe slug
 * @param {string} text - Text to slugify
 * @returns {string} Slugified text
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '-')      // Replace non-word chars with -
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start
    .replace(/-+$/, '');            // Trim - from end
}

// State
let currentEditor = null;
let currentSelection = null;
let existingLinkData = null;
let contentItems = [];

/**
 * Initialize the link editor
 * Should be called after posts/pages are loaded
 */
export function initLinkEditor() {
  // This function populates contentItems when called
  // but also re-populate on each modal open for fresh data
  populateContentItems();
}

/**
 * Populate content items for search
 * Called on init and when opening modal (to ensure fresh data)
 */
function populateContentItems() {
  contentItems = [];

  // Add posts
  if (window.allPostsWithMetadata && Array.isArray(window.allPostsWithMetadata)) {
    contentItems = contentItems.concat(
      window.allPostsWithMetadata.map(post => ({
        title: post.frontmatter?.title || post.name,
        url: post.frontmatter?.permalink || `/${slugify(post.frontmatter?.title || post.name)}/`,
        date: post.date,
        type: 'post'
      }))
    );
  }

  // Add pages (use allPages if allPagesWithMetadata doesn't exist)
  const pagesSource = window.allPagesWithMetadata || window.allPages;
  if (pagesSource && Array.isArray(pagesSource)) {
    contentItems = contentItems.concat(
      pagesSource.map(page => ({
        title: page.frontmatter?.title || page.name,
        url: page.frontmatter?.permalink || `/${page.name.replace(/\.md$/, '')}/`,
        date: page.frontmatter?.date ? new Date(page.frontmatter.date) : null,
        type: 'page'
      }))
    );
  }

  // Sort by date (most recent first)
  contentItems.sort((a, b) => (b.date || 0) - (a.date || 0));

  logger.log('Link editor content items populated:', contentItems.length);
}

/**
 * Open link editor modal
 * @param {Object} editor - EasyMDE editor instance
 */
export function openLinkEditor(editor) {
  currentEditor = editor;
  const cm = editor.codemirror;

  // Refresh content items to ensure we have latest data
  populateContentItems();

  // Get current selection
  const selection = cm.getSelection();
  const cursor = cm.getCursor();

  // Check if cursor is on an existing link
  existingLinkData = detectExistingLink(cm, cursor);

  if (existingLinkData) {
    // Editing existing link
    document.getElementById('link-url').value = existingLinkData.url;
    document.getElementById('link-text').value = existingLinkData.text;
    document.getElementById('link-new-tab').checked = existingLinkData.newTab;
    document.getElementById('link-modal-title').textContent = 'Edit Link';
    document.getElementById('link-submit-btn').textContent = 'Update';
  } else {
    // New link
    document.getElementById('link-url').value = '';
    document.getElementById('link-text').value = selection;
    document.getElementById('link-new-tab').checked = true; // Default to new tab for external
    document.getElementById('link-modal-title').textContent = 'Insert Link';
    document.getElementById('link-submit-btn').textContent = 'Insert Link';
  }

  // Clear search
  document.getElementById('link-search').value = '';
  renderContentList();

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('linkEditorModal'));
  modal.show();

  // Focus URL input
  setTimeout(() => {
    document.getElementById('link-url').focus();
  }, 300);
}

/**
 * Detect if cursor is on an existing link
 * @param {Object} cm - CodeMirror instance
 * @param {Object} cursor - Cursor position
 * @returns {Object|null} Link data if found
 */
function detectExistingLink(cm, cursor) {
  const line = cm.getLine(cursor.line);
  const ch = cursor.ch;

  // Regex patterns for markdown and HTML links
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)(?:\{:target="_blank"\})?/g;
  const htmlLinkRegex = /<a\s+href="([^"]+)"(?:\s+target="([^"]+)")?>([^<]+)<\/a>/g;

  let match;

  // Check markdown links
  mdLinkRegex.lastIndex = 0;
  while ((match = mdLinkRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (ch >= start && ch <= end) {
      return {
        text: match[1],
        url: match[2],
        newTab: match[0].includes('{:target="_blank"}'),
        start: { line: cursor.line, ch: start },
        end: { line: cursor.line, ch: end },
        type: 'markdown'
      };
    }
  }

  // Check HTML links
  htmlLinkRegex.lastIndex = 0;
  while ((match = htmlLinkRegex.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;

    if (ch >= start && ch <= end) {
      return {
        url: match[1],
        text: match[3],
        newTab: match[2] === '_blank',
        start: { line: cursor.line, ch: start },
        end: { line: cursor.line, ch: end },
        type: 'html'
      };
    }
  }

  return null;
}

/**
 * Search content items
 */
export function searchContent() {
  const query = document.getElementById('link-search').value.toLowerCase();
  renderContentList(query);
}

/**
 * Render content list
 * @param {string} query - Search query
 */
function renderContentList(query = '') {
  const container = document.getElementById('link-content-list');
  const info = document.getElementById('link-search-info');

  let filtered = contentItems;

  if (query) {
    filtered = contentItems.filter(item =>
      item.title.toLowerCase().includes(query) ||
      item.url.toLowerCase().includes(query)
    );
    info.textContent = filtered.length
      ? `Found ${filtered.length} item${filtered.length !== 1 ? 's' : ''}.`
      : 'No items found.';
  } else {
    filtered = contentItems.slice(0, 10); // Show recent 10
    info.textContent = 'No search term specified. Showing recent items.';
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div class="text-muted p-3 text-center">No content found</div>';
    return;
  }

  container.innerHTML = filtered.map(item => {
    const icon = item.type === 'post' ? 'fa-file-alt' : 'fa-file';
    const dateStr = item.date ? new Date(item.date).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).split('/').reverse().join('/') : '';

    return `
      <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
           style="cursor: pointer;"
           onclick="window.selectContent('${escapeHtml(item.url)}', '${escapeHtml(item.title)}')">
        <div class="flex-grow-1">
          <i class="fas ${icon} me-2 text-muted"></i>
          <span>${escapeHtml(item.title)}</span>
        </div>
        <small class="text-muted">${dateStr}</small>
      </div>
    `;
  }).join('');
}

/**
 * Select content from list
 * @param {string} url - Content URL
 * @param {string} title - Content title
 */
window.selectContent = function(url, title) {
  document.getElementById('link-url').value = url;
  document.getElementById('link-text').value = title; // Always update text when selecting content
  document.getElementById('link-new-tab').checked = false; // Internal links default to same tab
  document.getElementById('link-url').focus();
};

/**
 * Insert or update link
 */
export function submitLink() {
  const url = document.getElementById('link-url').value.trim();
  const text = document.getElementById('link-text').value.trim();
  const newTab = document.getElementById('link-new-tab').checked;

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  if (!text) {
    alert('Please enter link text');
    return;
  }

  const cm = currentEditor.codemirror;

  // Generate link markdown - always use markdown format
  // Use Kramdown/Jekyll syntax for target="_blank"
  let linkMarkdown;

  if (newTab) {
    linkMarkdown = `[${text}](${url}){:target="_blank"}`;
  } else {
    linkMarkdown = `[${text}](${url})`;
  }

  if (existingLinkData) {
    // Replace existing link
    cm.replaceRange(linkMarkdown, existingLinkData.start, existingLinkData.end);
  } else {
    // Insert new link
    cm.replaceSelection(linkMarkdown);
  }

  // Close modal
  bootstrap.Modal.getInstance(document.getElementById('linkEditorModal')).hide();

  // Focus editor
  currentEditor.codemirror.focus();
}

/**
 * Cancel link editing
 */
export function cancelLink() {
  bootstrap.Modal.getInstance(document.getElementById('linkEditorModal')).hide();
}

// Export for window scope (for onclick handlers)
window.submitLink = submitLink;
window.cancelLink = cancelLink;
