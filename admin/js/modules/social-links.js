/**
 * Social Links Admin Module
 * Manages social media links configuration
 */

import { showSuccess, showError } from '../ui/notifications.js';
import { trackDeployment } from './deployments.js';

// Available social platforms with their Font Awesome icons
const AVAILABLE_PLATFORMS = {
  github: {
    name: 'GitHub',
    icon: `<i class="fab fa-github"></i>`
  },
  twitter: {
    name: 'Twitter / X',
    icon: `<i class="fab fa-x-twitter"></i>`
  },
  linkedin: {
    name: 'LinkedIn',
    icon: `<i class="fab fa-linkedin"></i>`
  },
  facebook: {
    name: 'Facebook',
    icon: `<i class="fab fa-facebook"></i>`
  },
  youtube: {
    name: 'YouTube',
    icon: `<i class="fab fa-youtube"></i>`
  },
  vimeo: {
    name: 'Vimeo',
    icon: `<i class="fab fa-vimeo"></i>`
  },
  flickr: {
    name: 'Flickr',
    icon: `<i class="fab fa-flickr"></i>`
  },
  instagram: {
    name: 'Instagram',
    icon: `<i class="fab fa-instagram"></i>`
  },
  tiktok: {
    name: 'TikTok',
    icon: `<i class="fab fa-tiktok"></i>`
  },
  threads: {
    name: 'Threads',
    icon: `<i class="fab fa-threads"></i>`
  },
  bluesky: {
    name: 'Bluesky',
    icon: `<i class="fas fa-cloud"></i>`
  },
  mastodon: {
    name: 'Mastodon',
    icon: `<i class="fab fa-mastodon"></i>`
  }
};

let currentLinks = [];
let currentSha = null;
let sortable = null;

/**
 * Initialize social links module
 */
export async function initSocialLinks() {
  await loadSocialLinks();
  renderSocialLinks();
  initializeSortable();
  attachEventListeners();
}

/**
 * Load social links from API
 */
async function loadSocialLinks() {
  try {
    const response = await fetch('/.netlify/functions/social-links');

    if (!response.ok) {
      throw new Error(`Failed to load social links: ${response.status}`);
    }

    const data = await response.json();
    currentLinks = data.links || [];
    currentSha = data.sha;

  } catch (error) {
    console.error('Error loading social links:', error);
    showError('Failed to load social links');
    currentLinks = [];
  }
}

/**
 * Save social links to API
 */
async function saveSocialLinks() {
  try {
    const saveBtn = document.getElementById('save-social-links-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Saving...';
    }

    // Collect current data from UI
    const links = [];
    const listItems = document.querySelectorAll('#social-links-list .social-link-item');

    listItems.forEach((item, index) => {
      const slug = item.dataset.slug;
      const url = item.querySelector('.social-url-input').value.trim();
      const enabled = item.querySelector('.social-enabled-toggle').checked;

      if (slug && url) {
        links.push({
          platform: AVAILABLE_PLATFORMS[slug]?.name || slug,
          slug: slug,
          url: url,
          enabled: enabled,
          order: index + 1
        });
      }
    });

    const response = await fetch('/.netlify/functions/social-links', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links, sha: currentSha })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save social links');
    }

    const result = await response.json();

    showSuccess('Social links saved successfully');

    // Track deployment
    if (result.commitSha) {
      trackDeployment(result.commitSha);
    }

    // Reload to get new SHA
    await loadSocialLinks();

  } catch (error) {
    console.error('Error saving social links:', error);
    showError(`Failed to save social links: ${error.message}`);
  } finally {
    const saveBtn = document.getElementById('save-social-links-btn');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes';
    }
  }
}

/**
 * Render social links list
 */
function renderSocialLinks() {
  const listEl = document.getElementById('social-links-list');
  if (!listEl) return;

  // Sort by order
  const sortedLinks = [...currentLinks].sort((a, b) => a.order - b.order);

  listEl.innerHTML = sortedLinks.map(link => `
    <div class="social-link-item card mb-2" data-slug="${link.slug}">
      <div class="card-body p-3">
        <div class="d-flex align-items-center gap-2 flex-wrap">
          <!-- Drag Handle -->
          <div class="drag-handle text-muted" style="cursor: move; flex-shrink: 0;">
            <i class="fas fa-grip-vertical"></i>
          </div>

          <!-- Platform Icon & Name -->
          <div class="social-platform-info d-flex align-items-center gap-2" style="flex: 0 0 auto; min-width: 120px;">
            <span class="social-platform-icon">
              ${getPlatformIcon(link.slug)}
            </span>
            <strong class="text-nowrap">${link.platform}</strong>
          </div>

          <!-- URL Input -->
          <div style="flex: 1 1 300px; min-width: 200px;">
            <input
              type="url"
              class="form-control form-control-sm social-url-input"
              value="${link.url}"
              placeholder="https://..."
              required
            />
          </div>

          <!-- Enable Toggle -->
          <div class="form-check form-switch mb-0" style="flex-shrink: 0;">
            <input
              class="form-check-input social-enabled-toggle"
              type="checkbox"
              ${link.enabled ? 'checked' : ''}
              title="Enable/Disable"
            />
          </div>

          <!-- Remove Button -->
          <button
            type="button"
            class="btn btn-sm btn-outline-danger remove-social-link-btn"
            title="Remove"
            style="flex-shrink: 0;"
          >
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  attachItemEventListeners();
}

/**
 * Get platform icon HTML
 */
function getPlatformIcon(slug) {
  const platform = AVAILABLE_PLATFORMS[slug];
  if (!platform) {
    return `<i class="fas fa-link"></i>`;
  }
  return platform.icon;
}

/**
 * Initialize Sortable.js for drag and drop
 */
function initializeSortable() {
  const listEl = document.getElementById('social-links-list');
  if (!listEl || !window.Sortable) return;

  sortable = new window.Sortable(listEl, {
    animation: 150,
    handle: '.drag-handle',
    ghostClass: 'sortable-ghost',
    onEnd: function() {
      // Order is updated automatically by DOM position
      markAsModified();
    }
  });
}

/**
 * Attach event listeners
 */
function attachEventListeners() {
  // Save button
  const saveBtn = document.getElementById('save-social-links-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveSocialLinks);
  }

  // Add platform button
  const addBtn = document.getElementById('add-social-link-btn');
  if (addBtn) {
    addBtn.addEventListener('click', showAddPlatformModal);
  }
}

/**
 * Attach event listeners to individual items
 */
function attachItemEventListeners() {
  // Remove buttons
  document.querySelectorAll('.remove-social-link-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const item = this.closest('.social-link-item');
      const platform = item.querySelector('strong').textContent;

      if (confirm(`Remove ${platform} from social links?`)) {
        item.remove();
        markAsModified();
      }
    });
  });

  // URL inputs - mark as modified on change
  document.querySelectorAll('.social-url-input').forEach(input => {
    input.addEventListener('input', markAsModified);
  });

  // Enable toggles - mark as modified on change
  document.querySelectorAll('.social-enabled-toggle').forEach(toggle => {
    toggle.addEventListener('change', markAsModified);
  });
}

/**
 * Mark form as modified
 */
function markAsModified() {
  const saveBtn = document.getElementById('save-social-links-btn');
  if (saveBtn) {
    saveBtn.classList.add('btn-warning');
    saveBtn.innerHTML = '<i class="fas fa-save me-2"></i>Save Changes *';
  }
}

/**
 * Show add platform modal
 */
function showAddPlatformModal() {
  // Get platforms not currently in use
  const usedSlugs = Array.from(document.querySelectorAll('.social-link-item')).map(item => item.dataset.slug);
  const availablePlatforms = Object.entries(AVAILABLE_PLATFORMS)
    .filter(([slug]) => !usedSlugs.includes(slug));

  if (availablePlatforms.length === 0) {
    showError('All available platforms have been added');
    return;
  }

  // Create modal HTML
  const modalHTML = `
    <div class="modal fade" id="addPlatformModal" tabindex="-1">
      <div class="modal-dialog">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Add Social Platform</h5>
            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
          </div>
          <div class="modal-body">
            <div class="mb-3">
              <label class="form-label">Select Platform</label>
              <select class="form-select" id="new-platform-select">
                <option value="">Choose a platform...</option>
                ${availablePlatforms.map(([slug, platform]) => `
                  <option value="${slug}">${platform.name}</option>
                `).join('')}
              </select>
            </div>
            <div class="mb-3">
              <label class="form-label">URL</label>
              <input type="url" class="form-control" id="new-platform-url" placeholder="https://..." />
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="confirm-add-platform">Add Platform</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Remove existing modal if any
  const existingModal = document.getElementById('addPlatformModal');
  if (existingModal) existingModal.remove();

  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  // Show modal
  const modalEl = document.getElementById('addPlatformModal');
  const modal = new bootstrap.Modal(modalEl);
  modal.show();

  // Handle add button
  document.getElementById('confirm-add-platform').addEventListener('click', () => {
    const slug = document.getElementById('new-platform-select').value;
    const url = document.getElementById('new-platform-url').value.trim();

    if (!slug || !url) {
      showError('Please select a platform and enter a URL');
      return;
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      showError('Please enter a valid URL');
      return;
    }

    addPlatform(slug, url);
    modal.hide();
  });

  // Clean up on close
  modalEl.addEventListener('hidden.bs.modal', () => {
    modalEl.remove();
  });
}

/**
 * Add new platform to the list
 */
function addPlatform(slug, url) {
  const platform = AVAILABLE_PLATFORMS[slug];
  if (!platform) return;

  const listEl = document.getElementById('social-links-list');
  const newItem = document.createElement('div');
  newItem.className = 'social-link-item card mb-2';
  newItem.dataset.slug = slug;
  newItem.innerHTML = `
    <div class="card-body p-3">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <div class="drag-handle text-muted" style="cursor: move; flex-shrink: 0;">
          <i class="fas fa-grip-vertical"></i>
        </div>
        <div class="social-platform-info d-flex align-items-center gap-2" style="flex: 0 0 auto; min-width: 120px;">
          <span class="social-platform-icon">${platform.icon}</span>
          <strong class="text-nowrap">${platform.name}</strong>
        </div>
        <div style="flex: 1 1 300px; min-width: 200px;">
          <input type="url" class="form-control form-control-sm social-url-input" value="${url}" required />
        </div>
        <div class="form-check form-switch mb-0" style="flex-shrink: 0;">
          <input class="form-check-input social-enabled-toggle" type="checkbox" checked />
        </div>
        <button type="button" class="btn btn-sm btn-outline-danger remove-social-link-btn" title="Remove" style="flex-shrink: 0;">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `;

  listEl.appendChild(newItem);
  attachItemEventListeners();
  markAsModified();

  showSuccess(`Added ${platform.name} to social links`);
}

export { saveSocialLinks, loadSocialLinks };
