/**
 * Shared Layout Module
 *
 * Provides shared header and sidebar rendering for all admin pages
 * in the multi-page architecture.
 */

/**
 * Initialize the admin layout
 * @param {string} activePage - The current active page (e.g., 'dashboard', 'posts', 'pages')
 */
export function initLayout(activePage = 'dashboard') {
  // Render header and sidebar first so elements exist
  renderHeader();
  renderSidebar(activePage);

  // Check authentication and update UI
  if (!checkAuth()) {
    return; // Auth gate will be shown instead
  }
}

/**
 * Check if user is authenticated
 * @returns {boolean} True if authenticated
 */
function checkAuth() {
  // Test mode for E2E tests
  if (localStorage.getItem('TEST_MODE') === 'true') {
    showMainApp({ email: 'test@playwright.dev', user_metadata: { full_name: 'Test User' } });
    return true;
  }

  // Check Netlify Identity
  if (typeof netlifyIdentity === 'undefined') {
    logger.error('Netlify Identity widget not loaded');
    return false;
  }

  const user = netlifyIdentity.currentUser();
  if (user) {
    showMainApp(user);
    return true;
  }

  // Show auth gate
  showAuthGate();
  return false;
}

/**
 * Show the authentication gate
 */
function showAuthGate() {
  const authGate = document.getElementById('auth-gate');
  const mainApp = document.getElementById('main-app');

  if (authGate) authGate.classList.remove('d-none');
  if (mainApp) mainApp.classList.add('d-none');
}

/**
 * Show the main app (hide auth gate)
 * @param {Object} user - Netlify Identity user object
 */
function showMainApp(user) {
  const authGate = document.getElementById('auth-gate');
  const mainApp = document.getElementById('main-app');

  if (authGate) authGate.classList.add('d-none');
  if (mainApp) mainApp.classList.remove('d-none');

  // Update user display
  const userDisplay = document.getElementById('user-display');
  if (userDisplay && user) {
    const userName = user.user_metadata?.full_name || user.email;
    userDisplay.textContent = userName;
  }
}

/**
 * Render the admin header
 */
function renderHeader() {
  const headerContainer = document.getElementById('header-container');
  if (!headerContainer) return;

  headerContainer.innerHTML = `
    <header id="main-header" class="border-bottom">
      <div class="h-100 px-3 d-flex align-items-center justify-content-between">
        <div class="d-flex align-items-center gap-3">
          <a href="/admin/" class="d-flex align-items-center gap-2 text-decoration-none text-dark">
            <i class="fas fa-cog text-primary fs-5"></i>
            <h1 class="fs-5 fw-semibold mb-0">Admin</h1>
          </a>
        </div>
        <div class="d-flex align-items-center gap-3">
          <a href="/" target="_blank" class="text-muted text-decoration-none d-flex align-items-center gap-2 small">
            <i class="fas fa-external-link-alt"></i>
            <span>View Site</span>
          </a>
          <div class="d-flex align-items-center gap-2">
            <span class="small text-muted" id="user-display">Loading...</span>
            <button
              onclick="netlifyIdentity.logout()"
              class="btn btn-sm btn-link text-muted p-0"
              title="Log out"
            >
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

/**
 * Render the admin sidebar
 * @param {string} activePage - The current active page
 */
function renderSidebar(activePage = 'dashboard') {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (!sidebarContainer) return;

  const isActive = (page) => activePage === page ? 'active' : '';

  sidebarContainer.innerHTML = `
    <aside id="admin-sidebar" class="border-end d-flex flex-column">
      <nav class="flex-grow-1 overflow-auto py-3">
        <ul class="list-unstyled px-2">
          <li class="mb-1">
            <a
              href="/admin/"
              class="sidebar-nav-item ${isActive('dashboard')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Dashboard"
            >
              <i class="fas fa-tachometer-alt fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Dashboard</span>
            </a>
          </li>

          <li class="mb-1 sidebar-nav-item-with-flyout">
            <a
              href="/admin/posts/"
              class="sidebar-nav-item ${isActive('posts')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Posts"
            >
              <i class="fas fa-file-alt fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Posts</span>
            </a>
            <div class="sidebar-flyout-menu card shadow-sm">
              <div class="card-body p-0">
                <a href="/admin/taxonomy/" class="d-block px-3 py-2 text-decoration-none text-secondary small ${activePage === 'taxonomy' ? 'active' : ''}" title="Categories & Tags">
                  <i class="fas fa-folder me-2"></i>
                  <span>Categories & Tags</span>
                </a>
              </div>
            </div>
          </li>

          <li class="mb-1">
            <a
              href="/admin/pages/"
              class="sidebar-nav-item ${isActive('pages')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Pages"
            >
              <i class="fas fa-file fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Pages</span>
            </a>
          </li>

          <li class="mb-1">
            <a
              href="/admin/media/"
              class="sidebar-nav-item ${isActive('media')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Media Library"
            >
              <i class="fas fa-image fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Media Library</span>
            </a>
          </li>

          <li class="mb-1">
            <a
              href="/admin/bin/"
              class="sidebar-nav-item ${isActive('bin')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Bin"
            >
              <i class="fas fa-trash-alt fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Bin</span>
            </a>
          </li>

          <li class="mb-1">
            <a
              href="/admin/settings/"
              class="sidebar-nav-item ${isActive('settings')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Settings"
            >
              <i class="fas fa-cog fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Settings</span>
            </a>
          </li>
        </ul>
      </nav>

      <div class="border-top p-2">
        <button onclick="toggleSidebar()" class="sidebar-toggle-btn btn btn-link w-100 d-flex align-items-center justify-content-center gap-2 text-secondary text-decoration-none" title="Collapse sidebar">
          <i class="fas fa-angles-left sidebar-collapse-icon fs-5"></i>
          <span class="sidebar-nav-text small">Collapse</span>
        </button>
      </div>
    </aside>
  `;
}

/**
 * Toggle sidebar collapse/expand
 */
window.toggleSidebar = function() {
  const body = document.body;

  // Toggle the collapsed class on body
  body.classList.toggle('sidebar-collapsed');
};

/**
 * Initialize Netlify Identity
 */
export function initAuth() {
  if (typeof netlifyIdentity === 'undefined') {
    logger.error('Netlify Identity widget not loaded');
    return;
  }

  // Only set up event listeners if not already initialized
  if (!window._netlifyIdentityInitialized) {
    window._netlifyIdentityInitialized = true;
    window._isInitialLoad = true;

    netlifyIdentity.on('login', () => {
      // Use a flag to prevent reload loop on initialization
      if (!window._isInitialLoad) {
        window.location.reload();
      }
    });

    netlifyIdentity.on('logout', () => {
      window.location.href = '/admin/';
    });

    netlifyIdentity.init();

    // Clear the initial load flag after init completes
    setTimeout(() => {
      window._isInitialLoad = false;
    }, 100);
  }
}
