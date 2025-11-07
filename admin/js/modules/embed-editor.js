/**
 * Embed Editor Module
 *
 * WordPress-style embed insertion for EasyMDE markdown editor.
 * Supports YouTube, Vimeo, Twitter/X, Instagram, and TikTok.
 *
 * Features:
 * - URL input for embed content
 * - Advanced options (alignment, responsive, aspect ratio)
 * - Live preview of embed
 * - Inserts plain URLs that get auto-converted by auto_embed filter
 *
 * @module modules/embed-editor
 */

import logger from '../core/logger.js';

// State
let currentEditor = null;

/**
 * Open embed editor modal
 * @param {Object} editor - EasyMDE editor instance
 */
export function openEmbedEditor(editor) {
  currentEditor = editor;

  // Reset form
  document.getElementById('embed-url').value = '';
  document.getElementById('embed-alignment').value = 'default';
  document.getElementById('embed-responsive').checked = true;
  document.getElementById('embed-aspect-ratio').value = '16-9';
  document.getElementById('embed-preview').classList.add('d-none');
  document.getElementById('embed-preview-content').innerHTML = '';

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('embedModal'));
  modal.show();

  // Focus URL input
  setTimeout(() => {
    document.getElementById('embed-url').focus();
  }, 300);
}

/**
 * Detect embed type from URL
 * @param {string} url - URL to check
 * @returns {string|null} Embed type or null
 */
function detectEmbedType(url) {
  if (!url) return null;

  if (url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/)) {
    return 'youtube';
  }
  if (url.match(/vimeo\.com\/\d+/)) {
    return 'vimeo';
  }
  if (url.match(/(?:twitter|x)\.com\/\w+\/status\/\d+/)) {
    return 'twitter';
  }
  if (url.match(/instagram\.com\/(?:p|reel)\//)) {
    return 'instagram';
  }
  if (url.match(/tiktok\.com/)) {
    return 'tiktok';
  }

  return null;
}

/**
 * Extract video ID from YouTube URL
 * @param {string} url - YouTube URL
 * @returns {string|null} Video ID or null
 */
function getYouTubeID(url) {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

/**
 * Extract video ID from Vimeo URL
 * @param {string} url - Vimeo URL
 * @returns {string|null} Video ID or null
 */
function getVimeoID(url) {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Generate preview HTML for embed
 * @param {string} url - Embed URL
 * @param {string} type - Embed type
 * @returns {string} Preview HTML
 */
function generatePreview(url, type) {
  const aspectRatio = document.getElementById('embed-aspect-ratio').value;
  let ratioClass = '';

  switch (aspectRatio) {
    case '4-3':
      ratioClass = ' ratio-4-3';
      break;
    case '9-16':
      ratioClass = ' ratio-9-16';
      break;
    case '1-1':
      ratioClass = ' ratio-1-1';
      break;
    default:
      ratioClass = ''; // 16:9 is default
  }

  switch (type) {
    case 'youtube': {
      const videoId = getYouTubeID(url);
      if (!videoId) return '<p class="text-muted">Invalid YouTube URL</p>';
      return `
        <div class="embed-container youtube-embed${ratioClass}">
          <iframe src="https://www.youtube-nocookie.com/embed/${videoId}"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>
        </div>
      `;
    }
    case 'vimeo': {
      const videoId = getVimeoID(url);
      if (!videoId) return '<p class="text-muted">Invalid Vimeo URL</p>';
      return `
        <div class="embed-container vimeo-embed${ratioClass}">
          <iframe src="https://player.vimeo.com/video/${videoId}?dnt=1"
                  frameborder="0"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowfullscreen></iframe>
        </div>
      `;
    }
    case 'twitter':
      return `
        <div class="twitter-embed" style="max-width: 550px; margin: 0 auto;">
          <p class="text-muted"><i class="fab fa-twitter"></i> Twitter embed will appear here</p>
          <small class="text-muted">${url}</small>
        </div>
      `;
    case 'instagram':
      return `
        <div class="instagram-embed" style="max-width: 540px; margin: 0 auto;">
          <p class="text-muted"><i class="fab fa-instagram"></i> Instagram embed will appear here</p>
          <small class="text-muted">${url}</small>
        </div>
      `;
    case 'tiktok':
      return `
        <div class="tiktok-embed" style="max-width: 605px; margin: 0 auto;">
          <p class="text-muted"><i class="fab fa-tiktok"></i> TikTok embed will appear here</p>
          <small class="text-muted">${url}</small>
        </div>
      `;
    default:
      return '<p class="text-muted">Unsupported embed type</p>';
  }
}

/**
 * Update preview when URL changes
 */
export function updateEmbedPreview() {
  const url = document.getElementById('embed-url').value.trim();
  const previewContainer = document.getElementById('embed-preview');
  const previewContent = document.getElementById('embed-preview-content');

  if (!url) {
    previewContainer.classList.add('d-none');
    return;
  }

  const embedType = detectEmbedType(url);
  if (!embedType) {
    previewContainer.classList.remove('d-none');
    previewContent.innerHTML = '<p class="text-danger mb-0">Unsupported URL format</p>';
    return;
  }

  previewContainer.classList.remove('d-none');
  previewContent.innerHTML = generatePreview(url, embedType);
}

/**
 * Insert embed into editor
 */
export function submitEmbed() {
  const url = document.getElementById('embed-url').value.trim();
  const alignment = document.getElementById('embed-alignment').value;

  if (!url) {
    alert('Please enter a URL');
    return;
  }

  const embedType = detectEmbedType(url);
  if (!embedType) {
    alert('Unsupported URL format. Please use YouTube, Vimeo, Twitter/X, Instagram, or TikTok URLs.');
    return;
  }

  const cm = currentEditor.codemirror;

  // For auto-embed to work, we just insert the plain URL on its own line
  // The auto_embed Liquid filter will convert it to an embed
  let embedMarkdown = '\n' + url + '\n';

  // Insert at cursor position
  cm.replaceSelection(embedMarkdown);

  // Close modal
  bootstrap.Modal.getInstance(document.getElementById('embedModal')).hide();

  // Focus editor
  currentEditor.codemirror.focus();

  logger.log('Embed inserted:', embedType, url);
}

/**
 * Cancel embed editing
 */
export function cancelEmbed() {
  bootstrap.Modal.getInstance(document.getElementById('embedModal')).hide();
}

// Export for window scope (for onclick handlers and input events)
window.submitEmbed = submitEmbed;
window.cancelEmbed = cancelEmbed;
window.updateEmbedPreview = updateEmbedPreview;

// Add event listener for URL input to update preview in real-time
document.addEventListener('DOMContentLoaded', () => {
  const embedUrlInput = document.getElementById('embed-url');
  const embedAspectRatio = document.getElementById('embed-aspect-ratio');

  if (embedUrlInput) {
    embedUrlInput.addEventListener('input', updateEmbedPreview);
  }

  if (embedAspectRatio) {
    embedAspectRatio.addEventListener('change', updateEmbedPreview);
  }
});
