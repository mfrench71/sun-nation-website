/**
 * Settings Module
 *
 * Manages both site configuration and admin application settings.
 *
 * Features:
 * - Load/save site settings from _config.yml via backend API
 * - Load/save admin application settings from localStorage
 * - Populate form fields with current settings
 * - Track deployments when site settings are saved
 * - Reset admin settings to defaults
 *
 * Admin Settings (stored in localStorage):
 * - Deployment status poll interval
 * - Deployment history poll interval
 * - Deployment timeout
 * - Fetch timeout
 * - Debounce delay
 *
 * Dependencies:
 * - ui/notifications.js for showError() and showSuccess()
 * - Global API_BASE constant
 * - Global trackDeployment() function
 *
 * @module modules/settings
 * @version 1.0.4
 */

import { showError, showSuccess } from '../ui/notifications.js';
import logger from '../core/logger.js';

/**
 * Default admin application settings
 * @constant {Object}
 */
const DEFAULT_ADMIN_SETTINGS = {
  deployment_poll_interval: 10000,      // 10 seconds
  deployment_history_poll_interval: 30000, // 30 seconds
  deployment_timeout: 600,              // 10 minutes (in seconds)
  fetch_timeout: 30000,                 // 30 seconds
  debounce_delay: 300                   // 300 milliseconds
};

/**
 * Loads admin settings from localStorage or returns defaults
 *
 * @returns {Object} Admin settings object
 */
function getAdminSettings() {
  try {
    const stored = localStorage.getItem('admin_settings');
    if (stored) {
      return { ...DEFAULT_ADMIN_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (error) {
    logger.warn('Failed to load admin settings from localStorage:', error);
  }
  return { ...DEFAULT_ADMIN_SETTINGS };
}

/**
 * Loads just the site title and updates the admin header
 *
 * Fetches settings from the /settings API endpoint and updates the admin title
 * and dashboard welcome message. This is a lightweight version for initial page load.
 * Uses localStorage to cache the title and display it immediately on subsequent loads.
 *
 * @throws {Error} If settings load fails
 *
 * @example
 * import { loadSiteTitle } from './modules/settings.js';
 * await loadSiteTitle();
 */
export async function loadSiteTitle() {
  // Load cached title immediately to prevent FOUC
  const cachedTitle = localStorage.getItem('site_title');
  if (cachedTitle) {
    updateTitleElements(cachedTitle);
  }

  try {
    const response = await fetch(`${window.API_BASE}/settings`);
    if (!response.ok) {
      // If fetch fails, keep the cached or default title
      return;
    }

    const settings = await response.json();

    // Update admin title with site title
    if (settings.title) {
      // Cache the title for next time
      localStorage.setItem('site_title', settings.title);
      updateTitleElements(settings.title);
    }
  } catch (error) {
    // Silently fail - not critical for app function
    logger.warn('Failed to load site title:', error);
  }
}

/**
 * Updates title elements in the DOM
 *
 * Helper function to update visit site name and welcome message.
 *
 * @param {string} title - Site title
 * @private
 */
function updateTitleElements(title) {
  // Update "Visit Site" link with site name
  const visitSiteName = document.getElementById('visit-site-name');
  if (visitSiteName) {
    visitSiteName.textContent = title;
  }

  const welcomeTitle = document.getElementById('dashboard-welcome-title');
  if (welcomeTitle) {
    welcomeTitle.textContent = `Welcome to ${title} Admin`;
  }
}

/**
 * Loads site configuration and stores it globally
 *
 * Fetches settings from the /settings API endpoint and stores them in window.siteConfig
 * for use across all admin modules. This is a lightweight version that doesn't populate forms.
 *
 * @returns {Promise<Object>} Site configuration object
 * @throws {Error} If settings load fails
 *
 * @example
 * import { loadSiteConfig } from './modules/settings.js';
 * const config = await loadSiteConfig();
 * console.log(config.cloudinary_default_folder);
 */
export async function loadSiteConfig() {
  try {
    const response = await fetch(`${window.API_BASE}/settings`);
    if (!response.ok) throw new Error('Failed to load site config');

    const config = await response.json();

    // Store globally for access by all modules
    window.siteConfig = config;

    return config;
  } catch (error) {
    logger.error('Failed to load site config:', error);
    // Return empty object on error to prevent crashes
    window.siteConfig = {};
    return {};
  }
}

/**
 * Loads site settings from the backend and populates form fields
 *
 * Fetches settings from the /settings API endpoint and populates all form inputs
 * with matching IDs (format: `setting-{key}`).
 *
 * @throws {Error} If settings load fails
 *
 * @example
 * import { loadSettings } from './modules/settings.js';
 * await loadSettings();
 */
export async function loadSettings() {
  try {
    const response = await fetch(`${window.API_BASE}/settings`);
    if (!response.ok) throw new Error('Failed to load settings');

    const settings = await response.json();

    // Populate form fields
    Object.keys(settings).forEach(key => {
      const input = document.getElementById(`setting-${key}`);
      if (input) {
        input.value = settings[key] || '';
      }
    });

    // Update admin title and welcome message with site title
    if (settings.title) {
      // Cache the title
      localStorage.setItem('site_title', settings.title);
      updateTitleElements(settings.title);
    }

    // Load Cloudinary folders after settings are loaded
    await loadCloudinaryFolders();
  } catch (error) {
    showError('Failed to load settings: ' + error.message);
  }
}

/**
 * Loads Cloudinary folders and populates the folder dropdown
 *
 * Fetches the list of folders from Cloudinary via the cloudinary-folders API endpoint
 * and populates the cloudinary_default_folder dropdown in the settings form.
 *
 * @throws {Error} If folders load fails
 *
 * @example
 * import { loadCloudinaryFolders } from './modules/settings.js';
 * await loadCloudinaryFolders();
 */
export async function loadCloudinaryFolders() {
  try {
    const dropdown = document.getElementById('setting-cloudinary_default_folder');
    if (!dropdown) return; // Element doesn't exist on this page

    // Fetch folders from Cloudinary API
    const response = await fetch(`${window.API_BASE}/cloudinary-folders`);
    if (!response.ok) {
      throw new Error('Failed to load Cloudinary folders');
    }

    const data = await response.json();
    const folders = data.folders || [];

    // Clear existing options
    dropdown.innerHTML = '';

    // Add "Root (No Folder)" option
    const rootOption = document.createElement('option');
    rootOption.value = '';
    rootOption.textContent = '(Root - No Folder)';
    dropdown.appendChild(rootOption);

    // Add each folder as an option
    folders.forEach(folder => {
      const option = document.createElement('option');
      option.value = folder.path || folder.name;
      option.textContent = folder.name || folder.path;
      dropdown.appendChild(option);
    });

    // Get the current value from settings and set it
    const response2 = await fetch(`${window.API_BASE}/settings`);
    if (response2.ok) {
      const settings = await response2.json();
      if (settings.cloudinary_default_folder) {
        dropdown.value = settings.cloudinary_default_folder;
      }
    }
  } catch (error) {
    logger.error('Failed to load Cloudinary folders:', error);
    // Don't show error to user, just log it - the dropdown will show "Loading folders..." text
  }
}

/**
 * Saves site settings to the backend with deployment tracking
 *
 * Collects form data, converts number fields appropriately (paginate, related_posts_count),
 * sends a PUT request to the API, and tracks the deployment if successful.
 * Updates button states during the save operation.
 *
 * @param {Event} event - Form submit event
 *
 * @throws {Error} If settings save fails
 *
 * @example
 * import { saveSettings } from './modules/settings.js';
 *
 * // Attach to form submit
 * document.getElementById('settings-form').addEventListener('submit', saveSettings);
 */
export async function saveSettings(event) {
  event.preventDefault();

  const saveBtn = document.getElementById('settings-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = 'Saving...';

  try {
    const form = document.getElementById('settings-form');
    const formData = new FormData(form);
    const settings = {};

    formData.forEach((value, key) => {
      // Convert number fields
      if (['paginate', 'related_posts_count'].includes(key)) {
        settings[key] = parseInt(value, 10);
      } else {
        settings[key] = value;
      }
    });

    const response = await fetch(`${window.API_BASE}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save settings');
    }

    const result = await response.json();
    if (result.commitSha && window.trackDeployment) {
      window.trackDeployment(result.commitSha, 'Update site settings', '_config.yml');
    }

    // Update admin title and welcome message if site title changed
    const newTitle = settings.title;
    if (newTitle) {
      // Cache the title
      localStorage.setItem('site_title', newTitle);
      updateTitleElements(newTitle);
    }

    showSuccess(result.message || 'Settings saved successfully!');
  } catch (error) {
    showError('Failed to save settings: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Settings';
  }
}

/**
 * Loads admin application settings and populates the form
 *
 * Retrieves settings from localStorage and populates form inputs with current values.
 * Falls back to defaults if no stored settings exist.
 * Converts milliseconds to seconds for display in the UI for time-based settings.
 *
 * @example
 * import { loadAdminSettings } from './modules/settings.js';
 * await loadAdminSettings();
 */
export function loadAdminSettings() {
  const settings = getAdminSettings();

  // Fields that need conversion from milliseconds to seconds for display
  const msToSecondsFields = ['deployment_poll_interval', 'deployment_history_poll_interval', 'fetch_timeout'];

  // Populate form fields
  Object.keys(settings).forEach(key => {
    const input = document.getElementById(`admin-setting-${key.replace(/_/g, '-')}`);
    if (input) {
      // Convert milliseconds to seconds for display if needed
      if (msToSecondsFields.includes(key)) {
        input.value = Math.round(settings[key] / 1000);
      } else {
        input.value = settings[key] || '';
      }
    }
  });
}

/**
 * Saves admin application settings to localStorage
 *
 * Collects form data, validates values, stores in localStorage, and updates global constants.
 * Converts seconds to milliseconds for storage for time-based settings.
 * Shows success/error notifications.
 *
 * @param {Event} event - Form submit event
 *
 * @example
 * import { saveAdminSettings } from './modules/settings.js';
 *
 * // Attach to form submit
 * document.getElementById('admin-settings-form').addEventListener('submit', saveAdminSettings);
 */
export function saveAdminSettings(event) {
  event.preventDefault();

  const saveBtn = document.getElementById('admin-settings-save-btn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = 'Saving...';

  try {
    // Get current settings before saving to detect changes
    const oldSettings = getAdminSettings();

    const form = document.getElementById('admin-settings-form');
    const formData = new FormData(form);
    const settings = {};

    // Fields that need conversion from seconds to milliseconds for storage
    const secondsToMsFields = ['deployment_poll_interval', 'deployment_history_poll_interval', 'fetch_timeout'];

    // Collect and parse form values
    formData.forEach((value, key) => {
      const numValue = parseInt(value, 10);
      // Convert seconds to milliseconds for storage if needed
      if (secondsToMsFields.includes(key)) {
        settings[key] = numValue * 1000;
      } else {
        settings[key] = numValue;
      }
    });

    // Check if settings that require refresh have changed
    const needsRefresh =
      settings.fetch_timeout !== oldSettings.fetch_timeout ||
      settings.debounce_delay !== oldSettings.debounce_delay;

    // Save to localStorage
    localStorage.setItem('admin_settings', JSON.stringify(settings));

    // Update global constants that are already in use
    if (window.DEPLOYMENT_STATUS_POLL_INTERVAL !== undefined) {
      window.DEPLOYMENT_STATUS_POLL_INTERVAL = settings.deployment_poll_interval;
    }
    if (window.DEPLOYMENT_HISTORY_POLL_INTERVAL !== undefined) {
      window.DEPLOYMENT_HISTORY_POLL_INTERVAL = settings.deployment_history_poll_interval;
    }
    if (window.DEPLOYMENT_TIMEOUT !== undefined) {
      window.DEPLOYMENT_TIMEOUT = settings.deployment_timeout;
    }

    // Restart polling intervals to apply new settings immediately
    // Stop existing intervals
    if (window.deploymentPollInterval) {
      clearInterval(window.deploymentPollInterval);
      window.deploymentPollInterval = null;
    }
    if (typeof window.stopDeploymentHistoryPolling === 'function') {
      window.stopDeploymentHistoryPolling();
    }

    // Restart with new settings
    // Only restart deployment polling if there are active deployments
    if (window.activeDeployments && window.activeDeployments.length > 0) {
      if (typeof window.startDeploymentPolling === 'function') {
        window.startDeploymentPolling();
      }
    }
    // Always restart history polling if we're on the dashboard
    if (document.getElementById('deployments-card')) {
      if (typeof window.startDeploymentHistoryPolling === 'function') {
        window.startDeploymentHistoryPolling();
      }
    }

    // Show different message based on whether refresh is needed
    if (needsRefresh) {
      showSuccess(`
        <div class="d-flex align-items-center justify-content-between gap-3">
          <span>Admin settings saved! Polling intervals applied immediately. Refresh page to apply timeout and debounce settings.</span>
          <button
            onclick="location.reload()"
            class="btn btn-sm btn-success flex-shrink-0"
          >
            <i class="fas fa-sync-alt me-1"></i>Refresh Page
          </button>
        </div>
      `, true);
    } else {
      showSuccess('Admin settings saved and applied immediately!');
    }
  } catch (error) {
    showError('Failed to save admin settings: ' + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = 'Save Admin Settings';
  }
}

/**
 * Resets admin application settings to default values
 *
 * Reloads the form with default values and notifies the user. Does not save automatically -
 * user must click "Save" to persist the defaults.
 * Converts milliseconds to seconds for display in the UI for time-based settings.
 *
 * @example
 * import { resetAdminSettings } from './modules/settings.js';
 *
 * // Attach to reset button
 * document.getElementById('reset-admin-settings').addEventListener('click', resetAdminSettings);
 */
export function resetAdminSettings() {
  // Fields that need conversion from milliseconds to seconds for display
  const msToSecondsFields = ['deployment_poll_interval', 'deployment_history_poll_interval', 'fetch_timeout'];

  // Populate form with defaults
  Object.keys(DEFAULT_ADMIN_SETTINGS).forEach(key => {
    const input = document.getElementById(`admin-setting-${key.replace(/_/g, '-')}`);
    if (input) {
      // Convert milliseconds to seconds for display if needed
      if (msToSecondsFields.includes(key)) {
        input.value = Math.round(DEFAULT_ADMIN_SETTINGS[key] / 1000);
      } else {
        input.value = DEFAULT_ADMIN_SETTINGS[key];
      }
    }
  });

  showSuccess('Admin settings reset to defaults. Click "Save" to apply.');
}
