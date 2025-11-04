/**
 * Shared Header Component
 * Renders the admin header with deployment banner and navigation
 */

export function renderHeader() {
  return `
    <!-- Full Width Header (above sidebar and content) -->
    <header id="main-header" class="bg-white border-bottom position-fixed top-0 start-0 end-0" style="z-index: 1030; transition: background-color 0.3s ease;">
      <div class="px-4 py-2">
        <div class="d-flex justify-content-between align-items-center">
          <!-- Left side: Deployment Status (hidden by default) -->
          <div id="deployment-status-header" class="d-none align-items-center gap-2">
            <i class="fas fa-spinner fa-spin"></i>
            <span id="deployment-status-message" class="fw-medium">Publishing changes...</span>
            <span id="deployment-status-time" class="font-monospace">0:00</span>
          </div>

          <!-- Right side: Always visible actions -->
          <div class="ms-auto d-flex align-items-center gap-3">
            <a href="/" class="btn btn-link text-primary text-decoration-none d-flex align-items-center gap-2" target="_blank" rel="noopener">
              <i class="fas fa-external-link-alt small"></i>
              <span>Matt French</span>
            </a>
            <button onclick="netlifyIdentity.logout()" class="btn btn-link text-secondary text-decoration-none d-flex align-items-center gap-2">
              <i class="fas fa-sign-out-alt"></i>
              Log Out
            </button>
          </div>
        </div>
      </div>
    </header>
  `;
}

/**
 * Initialize header - mount it to the DOM
 */
export function initHeader() {
  const headerContainer = document.getElementById('header-container');
  if (headerContainer) {
    headerContainer.innerHTML = renderHeader();
  }
}
