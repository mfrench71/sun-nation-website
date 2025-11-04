/**
 * UI Notifications Module
 *
 * Handles user-facing success and error messages with automatic dismissal.
 * Displays messages in predefined DOM containers and auto-hides after 5 seconds.
 *
 * @module ui/notifications
 */

import { escapeHtml } from '../core/utils.js';
import logger from '../core/logger.js';

/**
 * Cached references to notification DOM elements
 * Initialized by initNotifications()
 * @private
 */
let errorElement = null;
let successElement = null;

/**
 * Initializes notification system by caching DOM references
 *
 * Must be called after DOM is loaded and before using notification functions.
 * Caches references to error and success message containers.
 *
 * @example
 * import { initNotifications } from './ui/notifications.js';
 * document.addEventListener('DOMContentLoaded', () => {
 *   initNotifications();
 * });
 */
export function initNotifications() {
  errorElement = document.getElementById('error');
  successElement = document.getElementById('success');

  if (!errorElement || !successElement) {
    logger.warn('Notification elements not found in DOM');
  }
}

/**
 * Displays an error message to the user
 *
 * Shows the error message in a red notification banner that auto-dismisses after 5 seconds.
 * Message is automatically escaped to prevent XSS attacks.
 *
 * @param {string} message - Error message to display
 *
 * @example
 * import { showError } from './ui/notifications.js';
 * showError('Failed to save post');
 */
export function showError(message) {
  // Auto-initialize if not already initialized
  if (!errorElement) {
    initNotifications();
  }

  if (!errorElement) {
    logger.error('Error element not found in DOM:', message);
    return;
  }

  const messageEl = errorElement.querySelector('p');
  if (messageEl) {
    messageEl.textContent = message;
  } else {
    errorElement.innerHTML = `<p class="mb-0">${escapeHtml(message)}</p>`;
  }

  errorElement.classList.remove('d-none');
  setTimeout(() => errorElement.classList.add('d-none'), 5000);
}

/**
 * Displays a success message to the user
 *
 * Shows the success message in a green notification banner that auto-dismisses after 5 seconds.
 * Message is automatically escaped to prevent XSS attacks unless allowHtml is true.
 *
 * @param {string} [message='Operation successful!'] - Success message to display
 * @param {boolean} [allowHtml=false] - If true, message is treated as HTML (use with caution)
 *
 * @example
 * import { showSuccess } from './ui/notifications.js';
 * showSuccess('Post saved successfully!');
 * showSuccess('<div>HTML content</div>', true);
 */
export function showSuccess(message = 'Operation successful!', allowHtml = false) {
  // Auto-initialize if not already initialized
  if (!successElement) {
    initNotifications();
  }

  if (!successElement) {
    logger.error('Success element not found in DOM:', message);
    return;
  }

  const messageEl = successElement.querySelector('p');
  if (allowHtml) {
    // Allow HTML content
    if (messageEl) {
      messageEl.innerHTML = message;
    } else {
      successElement.innerHTML = `<p class="mb-0">${message}</p>`;
    }
  } else {
    // Escape HTML for safety
    if (messageEl) {
      messageEl.textContent = message;
    } else {
      successElement.innerHTML = `<p class="mb-0">${escapeHtml(message)}</p>`;
    }
  }

  successElement.classList.remove('d-none');
  setTimeout(() => successElement.classList.add('d-none'), 5000);
}

/**
 * Hides all notification messages
 *
 * Immediately hides both error and success notification banners.
 * Useful when navigating between sections or before displaying new messages.
 *
 * @example
 * import { hideMessages } from './ui/notifications.js';
 * hideMessages();
 */
export function hideMessages() {
  if (errorElement) {
    errorElement.classList.add('d-none');
  }
  if (successElement) {
    successElement.classList.add('d-none');
  }
}
