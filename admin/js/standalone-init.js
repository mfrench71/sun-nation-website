/**
 * Standalone Page Initialization Helper
 *
 * Provides a promise-based wrapper for Netlify Identity initialization
 * that works correctly with standalone pages.
 */

/**
 * Wait for Netlify Identity to initialize and return the current user
 * @returns {Promise<Object|null>} User object if authenticated, null otherwise
 */
export function waitForAuth() {
  return new Promise((resolve) => {
    // Test mode bypass for E2E tests (same as dashboard)
    if (localStorage.getItem('TEST_MODE') === 'true') {
      resolve({ email: 'test@playwright.dev', user_metadata: { full_name: 'Test User' } });
      return;
    }

    if (typeof netlifyIdentity === 'undefined') {
      logger.error('Netlify Identity script not loaded');
      resolve(null);
      return;
    }

    // First check if user is already available (init might have already completed)
    let user = netlifyIdentity.currentUser();

    if (user) {
      resolve(user);
      return;
    }

    let resolved = false;
    let pollInterval = null;

    const resolveOnce = (value) => {
      if (!resolved) {
        resolved = true;
        if (pollInterval) clearInterval(pollInterval);
        resolve(value);
      }
    };

    // Set up a timeout in case init never completes
    const timeout = setTimeout(() => {
      user = netlifyIdentity.currentUser();
      resolveOnce(user);
    }, 5000);

    // Listen for the init event
    netlifyIdentity.on('init', (user) => {
      clearTimeout(timeout);
      if (pollInterval) clearInterval(pollInterval);
      resolveOnce(user);
    });

    // Call init() - if it was already called, this is a no-op
    netlifyIdentity.init();

    // Wait 500ms before starting to poll, giving init() time to fire its event
    setTimeout(() => {
      let attempts = 0;
      pollInterval = setInterval(() => {
        user = netlifyIdentity.currentUser();
        attempts++;

        if (user) {
          clearTimeout(timeout);
          clearInterval(pollInterval);
          resolveOnce(user);
        } else if (attempts >= 9) {
          clearInterval(pollInterval);
        }
      }, 500);
    }, 500);
  });
}

/**
 * Initialize authentication for a standalone page
 * Shows/hides auth gate and main app based on authentication status
 * @param {string} pageName - Name of the page for sidebar highlighting (e.g., 'posts', 'pages')
 * @param {Function} initCallback - Async function to run after authentication succeeds
 */
export async function initStandalonePage(pageName, initCallback) {
  try {
    // Initialize deployment polling constants if not already set
    if (window.DEPLOYMENT_STATUS_POLL_INTERVAL === undefined) {
      window.DEPLOYMENT_STATUS_POLL_INTERVAL = 10000; // 10 seconds
    }
    if (window.DEPLOYMENT_HISTORY_POLL_INTERVAL === undefined) {
      window.DEPLOYMENT_HISTORY_POLL_INTERVAL = 30000; // 30 seconds
    }
    if (window.DEPLOYMENT_TIMEOUT === undefined) {
      window.DEPLOYMENT_TIMEOUT = 300; // 5 minutes in seconds
    }

    // Wait for auth to initialize
    const user = await waitForAuth();

    if (!user) {
      // Not authenticated - show auth gate
      document.getElementById('auth-gate')?.classList.remove('d-none');
      document.getElementById('main-app')?.classList.add('d-none');
      return;
    }

    // User is authenticated - show main app
    document.getElementById('auth-gate')?.classList.add('d-none');
    document.getElementById('main-app')?.classList.remove('d-none');

    // Run the page-specific initialization
    if (typeof initCallback === 'function') {
      await initCallback(user);
    }

    // Hide loading indicator (if it exists - some pages use section-specific loaders)
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.add('d-none');
    }

  } catch (error) {
    logger.error('Standalone page initialization error:', error);
    // Show error state
    const errorEl = document.getElementById('error');
    if (errorEl) {
      errorEl.classList.remove('d-none');
      errorEl.querySelector('p').textContent = 'Failed to initialize page: ' + error.message;
    }
  }
}
