/**
 * Core Utility Functions
 *
 * Shared utility functions used throughout the admin application.
 * Provides debouncing, async error handling, timeout handling, and DOM utilities.
 *
 * @module core/utils
 */

/**
 * Fetch timeout constant (30 seconds)
 * @constant {number}
 */
export const FETCH_TIMEOUT = 30000;

/**
 * Debounce delay constant (300ms)
 * @constant {number}
 */
export const DEBOUNCE_DELAY = 300;

/**
 * Creates a debounced function that delays execution until after wait milliseconds
 *
 * Useful for limiting the rate of function calls on events like scroll, resize, or input.
 * The debounced function will only execute after the specified wait period has elapsed
 * since the last time it was invoked.
 *
 * @param {Function} func - The function to debounce
 * @param {number} wait - The number of milliseconds to delay
 * @returns {Function} Debounced function
 *
 * @example
 * import { debounce } from './core/utils.js';
 * const debouncedSearch = debounce(performSearch, 300);
 * searchInput.addEventListener('input', debouncedSearch);
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Wraps async functions to handle errors and display them to the user
 *
 * Useful for onclick handlers and other event handlers that call async functions.
 * Catches any errors thrown by the function and displays them via showError().
 *
 * NOTE: Depends on showError() being available in the global scope or imported.
 *
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 *
 * @example
 * import { asyncHandler } from './core/utils.js';
 * button.onclick = asyncHandler(async () => {
 *   await savePost();
 * });
 */
export function asyncHandler(fn) {
  return async function(...args) {
    try {
      await fn.apply(this, args);
    } catch (error) {
      logger.error('Async handler error:', error);
      // Note: showError must be available in global scope or imported
      if (typeof showError === 'function') {
        showError(error.message || 'An unexpected error occurred');
      } else {
        logger.error('showError function not available:', error.message);
      }
    }
  };
}

/**
 * Fetches a URL with a configurable timeout
 *
 * Wraps the fetch API to abort requests that take longer than the specified timeout.
 * Uses AbortController to cancel in-flight requests.
 *
 * @param {string} url - URL to fetch
 * @param {Object} [options={}] - Fetch options (method, headers, body, etc.)
 * @param {number} [timeout=FETCH_TIMEOUT] - Timeout in milliseconds (default: 30000)
 * @returns {Promise<Response>} Fetch response
 * @throws {Error} If request times out or fetch fails
 *
 * @example
 * import { fetchWithTimeout } from './core/utils.js';
 * const response = await fetchWithTimeout('/api/data', { method: 'GET' }, 10000);
 */
export async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please try again');
    }
    throw error;
  }
}

/**
 * Sets the loading state of a button with spinner animation
 *
 * When enabled, disables the button, stores its original text, and displays a spinner
 * with custom loading text. When disabled, restores the button to its original state.
 *
 * @param {HTMLButtonElement} button - Button element to update
 * @param {boolean} loading - Whether to show loading state
 * @param {string} [loadingText='Loading...'] - Text to display during loading
 *
 * @example
 * import { setButtonLoading } from './core/utils.js';
 * const saveBtn = document.getElementById('save-btn');
 * setButtonLoading(saveBtn, true, 'Saving...');
 * await saveData();
 * setButtonLoading(saveBtn, false);
 */
export function setButtonLoading(button, loading, loadingText = 'Loading...') {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

/**
 * Escapes HTML special characters to prevent XSS attacks
 *
 * Converts HTML special characters to their entity equivalents to safely display
 * user-generated content without risk of script injection.
 *
 * @param {string} text - Text to escape
 * @returns {string} HTML-escaped text
 *
 * @example
 * import { escapeHtml } from './core/utils.js';
 * const userInput = '<script>alert("XSS")</script>';
 * const safe = escapeHtml(userInput);
 * // Returns: '&lt;script&gt;alert("XSS")&lt;/script&gt;'
 */
export function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Validates whether a string is a valid URL
 *
 * Uses the URL constructor to validate URL format. Returns true for valid URLs,
 * false for invalid ones.
 *
 * @param {string} string - String to validate
 * @returns {boolean} True if valid URL, false otherwise
 *
 * @example
 * import { isValidUrl } from './core/utils.js';
 * isValidUrl('https://example.com'); // true
 * isValidUrl('not a url'); // false
 */
export function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}
