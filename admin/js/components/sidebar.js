/**
 * Shared Sidebar Component
 * Renders the admin sidebar navigation with active state support
 */

/**
 * Render sidebar HTML
 * @param {string} activePage - The current active page (e.g., 'dashboard', 'taxonomy', 'posts', etc.)
 */
export function renderSidebar(activePage = 'dashboard') {
  // Determine active states
  const isActive = (page) => activePage === page ? 'active' : '';

  return `
    <!-- Left Sidebar Navigation (below header) -->
    <aside id="admin-sidebar" class="border-end d-flex flex-column">
      <!-- Sidebar Navigation -->
      <nav class="flex-grow-1 overflow-auto py-3">
        <ul class="list-unstyled px-2">
          <!-- Dashboard -->
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

          <!-- Posts -->
          <li class="mb-1">
            <a
              href="/admin/posts/"
              class="sidebar-nav-item ${isActive('posts')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Posts"
            >
              <i class="fas fa-file-alt fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Posts</span>
            </a>
          </li>

          <!-- Taxonomy -->
          <li class="mb-1">
            <a
              href="/admin/taxonomy/"
              class="sidebar-nav-item ${isActive('taxonomy')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Taxonomy"
            >
              <i class="fas fa-tags fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Taxonomy</span>
            </a>
          </li>

          <!-- Pages -->
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

          <!-- Media Library -->
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

          <!-- Bin -->
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

          <!-- Appearance -->
          <li class="mb-1">
            <a
              href="/admin/appearance/"
              class="sidebar-nav-item ${isActive('appearance')} d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
              title="Appearance"
            >
              <i class="fas fa-paint-brush fs-5" class="sidebar-icon"></i>
              <span class="sidebar-nav-text">Appearance</span>
            </a>
          </li>

          <!-- Settings -->
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

      <!-- Sidebar Toggle (at bottom) -->
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
 * Initialize sidebar - mount it to the DOM
 * @param {string} activePage - The current active page
 */
export function initSidebar(activePage = 'dashboard') {
  const sidebarContainer = document.getElementById('sidebar-container');
  if (sidebarContainer) {
    sidebarContainer.innerHTML = renderSidebar(activePage);
  }
}

/**
 * Toggle sidebar collapse/expand
 */
window.toggleSidebar = function() {
  const body = document.body;
  // Toggle the collapsed class on body
  body.classList.toggle('sidebar-collapsed');
};
