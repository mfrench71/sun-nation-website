/**
 * Deployments Module
 *
 * GitHub Actions deployment tracking and status monitoring
 *
 * Features:
 * - Track active deployments with SHA and action
 * - Poll GitHub Actions for deployment status
 * - Display deployment banner with live updates
 * - Maintain deployment history in localStorage
 * - Dashboard deployment history card
 * - Auto-reload affected content on completion
 *
 * Dependencies:
 * - core/utils.js (escapeHtml)
 * - Global constants: API_BASE, DEPLOYMENT_STATUS_POLL_INTERVAL, DEPLOYMENT_HISTORY_POLL_INTERVAL, DEPLOYMENT_TIMEOUT
 * - Global state: activeDeployments, deploymentPollInterval, historyPollInterval
 * - Other modules: loadPosts(), loadPages(), loadBin()
 *
 * @version 1.0.5
 */

import { escapeHtml } from '../core/utils.js';
import logger from '../core/logger.js';

const MAX_DEPLOYMENT_HISTORY = 50; // Keep last 50 deployments

/**
 * Loads deployment history from localStorage
 *
 * Retrieves and parses the stored deployment history.
 *
 * @returns {Array} Array of deployment objects
 */
export function loadDeploymentHistory() {
  try {
    const stored = localStorage.getItem('deploymentHistory');
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    logger.error('Failed to load deployment history:', error);
    return [];
  }
}

// Track last error time to prevent spamming console
let lastErrorTime = 0;
const ERROR_LOG_THROTTLE = 60000; // Only log errors once per minute

/**
 * Fetches recent GitHub Actions workflow runs
 *
 * Queries the GitHub API for recent deployments and returns the list.
 *
 * @returns {Promise<Array>} Array of recent deployments
 *
 * @throws {Error} If GitHub API request fails
 */
export async function fetchRecentDeploymentsFromGitHub() {
  try {
    const response = await fetch(`${window.API_BASE}/deployment-history`);
    if (!response.ok) {
      // Only log if enough time has passed since last error
      const now = Date.now();
      if (now - lastErrorTime > ERROR_LOG_THROTTLE) {
        logger.warn('Deployment history endpoint not available:', response.status);
        lastErrorTime = now;
      }
      return [];
    }

    const data = await response.json();
    return data.deployments || [];
  } catch (error) {
    // Only log if enough time has passed since last error
    const now = Date.now();
    if (now - lastErrorTime > ERROR_LOG_THROTTLE) {
      logger.warn('Failed to fetch deployment history:', error.message);
      lastErrorTime = now;
    }
    return [];
  }
}

/**
 * Gets deployment history, merging localStorage with GitHub data
 *
 * Fetches from GitHub if stale, merges with local history, and limits to most recent deployments.
 *
 * @returns {Promise<Array>} Array of deployment objects
 */
export async function getDeploymentHistory() {
  const localHistory = loadDeploymentHistory();
  const githubHistory = await fetchRecentDeploymentsFromGitHub();

  // Create a map of GitHub deployments by commitSha for quick lookup
  const githubMap = new Map(githubHistory.map(d => [d.commitSha, d]));

  // Merge: prioritize GitHub status over localStorage (GitHub is source of truth)
  const merged = localHistory.map(localDep => {
    const githubDep = githubMap.get(localDep.commitSha);
    if (githubDep) {
      // GitHub has this deployment - use GitHub's status (more current)
      githubMap.delete(localDep.commitSha); // Remove from map so we don't add it again
      return githubDep;
    }
    // No GitHub record - keep local (might be old/archived)
    return localDep;
  });

  // Add any remaining GitHub deployments that weren't in localStorage
  githubMap.forEach(deployment => {
    merged.push(deployment);
  });

  // Sort by completedAt/startedAt (most recent first)
  merged.sort((a, b) => new Date(b.completedAt || b.startedAt) - new Date(a.completedAt || a.startedAt));

  return merged;
}

/**
 * Saves deployment history to localStorage
 *
 * Persists the deployment history array and update timestamp.
 *
 * @param {Array} history - Deployment history array to save
 */
export function saveDeploymentHistory(history) {
  try {
    // Auto-archive: keep only the most recent MAX_DEPLOYMENT_HISTORY items
    // History is sorted newest-first, so take the first N items
    const trimmed = history.slice(0, MAX_DEPLOYMENT_HISTORY);
    localStorage.setItem('deploymentHistory', JSON.stringify(trimmed));
  } catch (error) {
    logger.error('Failed to save deployment history:', error);
  }
}

/**
 * Adds a new deployment to history
 *
 * Prepends the deployment to history, removes duplicates, limits to 50 items, and persists.
 *
 * @param {Object} deployment - Deployment object to add
 */
export function addToDeploymentHistory(deployment) {
  const history = loadDeploymentHistory();
  history.push({
    commitSha: deployment.commitSha,
    action: deployment.action,
    itemId: deployment.itemId,
    status: deployment.status,
    startedAt: deployment.startedAt,
    completedAt: new Date(),
    duration: Math.floor((new Date() - new Date(deployment.startedAt)) / 1000)
  });
  saveDeploymentHistory(history);
  updateDashboardDeployments(); // Refresh display
}

/**
 * Restores in-progress deployments from GitHub on page load
 *
 * Queries GitHub for currently running workflows and adds them to active deployments.
 *
 * @returns {Promise<void>}
 */
export async function restoreActiveDeployments() {
  try {
    // Initialize array if not exists
    if (!window.activeDeployments) {
      window.activeDeployments = [];
    }

    const githubDeployments = await fetchRecentDeploymentsFromGitHub();

    // Find any in-progress deployments
    const inProgressDeployments = githubDeployments.filter(d =>
      d.status === 'pending' || d.status === 'queued' || d.status === 'in_progress'
    );

    if (inProgressDeployments.length > 0) {
      // Add them to activeDeployments (converting GitHub format to our format)
      inProgressDeployments.forEach(deployment => {
        window.activeDeployments.push({
          commitSha: deployment.commitSha,
          action: deployment.action,
          itemId: deployment.itemId || null,
          startedAt: new Date(deployment.startedAt),
          status: deployment.status
        });
      });

      // Show banner and start polling if we have active deployments
      if (window.activeDeployments.length > 0) {
        showDeploymentBanner();
        startDeploymentPolling();
      }
    }
  } catch (error) {
    logger.error('Failed to restore active deployments:', error);
  }
}

/**
 * Tracks a new deployment
 *
 * Adds deployment to active tracking, shows deployment banner, and adds to history.
 *
 * @param {string} commitSha - Git commit SHA
 * @param {string} action - Description of the action
 * @param {string} [itemId=null] - Optional item identifier
 */
export function trackDeployment(commitSha, action, itemId = null) {
  if (!commitSha) return;

  // Initialize array if not exists
  if (!window.activeDeployments) {
    window.activeDeployments = [];
  }

  window.activeDeployments.push({
    commitSha,
    action,
    itemId, // Track which item this deployment is for (e.g., filename)
    startedAt: new Date(),
    status: 'pending'
  });

  showDeploymentBanner();
  startDeploymentPolling();
  updateDashboardDeployments();
}

/**
 * Shows the deployment status banner
 *
 * Displays the banner with deployment progress information.
 */
export function showDeploymentBanner() {
  const deploymentStatus = document.getElementById('deployment-status-header');
  const greeting = document.getElementById('header-greeting');
  const mainHeader = document.getElementById('main-header');
  const links = mainHeader?.querySelectorAll('a, button');

  if (deploymentStatus) {
    // Show deployment status, hide greeting
    deploymentStatus.classList.remove('d-none');
    deploymentStatus.classList.add('d-flex');
    if (greeting) greeting.classList.add('d-none');

    // Change header to teal background with white text
    if (mainHeader) {
      mainHeader.classList.remove('bg-white');
      mainHeader.classList.add('bg-primary', 'text-white');
    }

    // Update link colors to white
    links?.forEach(link => {
      link.classList.remove('text-primary', 'text-secondary');
      link.classList.add('text-white');
    });

    updateDeploymentBanner();
  } else {
    logger.error('deployment-status-header element not found in DOM!');
  }
}

/**
 * Updates the deployment banner with current status
 *
 * Refreshes the banner content based on active deployments.
 */
export function updateDeploymentBanner() {
  const messageEl = document.getElementById('deployment-status-message');
  const timeEl = document.getElementById('deployment-status-time');

  if (!window.activeDeployments || window.activeDeployments.length === 0) return;

  const oldest = window.activeDeployments[0];
  const elapsed = Math.floor((new Date() - oldest.startedAt) / 1000);
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;

  if (messageEl) {
    const count = window.activeDeployments.length;
    const action = oldest.action || 'changes';
    if (count === 1) {
      messageEl.textContent = `Publishing: ${action}`;
    } else {
      messageEl.textContent = `Publishing ${count} changes to GitHub Pages`;
    }
  }

  if (timeEl) {
    timeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

/**
 * Shows deployment completion message
 *
 * Displays success or failure message in the banner.
 * Automatically reloads posts/pages lists if deployments affected them.
 *
 * @param {boolean} [success=true] - Whether deployment succeeded
 * @param {Array<Object>} [completedDeployments=[]] - Array of completed deployment objects
 */
export function showDeploymentCompletion(success = true, completedDeployments = []) {
  const deploymentStatus = document.getElementById('deployment-status-header');
  const mainHeader = document.getElementById('main-header');
  const messageEl = document.getElementById('deployment-status-message');
  const timeEl = document.getElementById('deployment-status-time');
  const iconEl = deploymentStatus?.querySelector('i');

  if (!deploymentStatus) return;

  // Update header styling for success/failure
  if (mainHeader) {
    mainHeader.classList.remove('bg-primary', 'bg-success', 'bg-danger');
    mainHeader.classList.add(success ? 'bg-success' : 'bg-danger');
  }

  // Update icon
  if (iconEl) {
    iconEl.className = success ? 'fas fa-check-circle' : 'fas fa-exclamation-circle';
  }

  // Update message
  if (messageEl) {
    messageEl.textContent = success
      ? 'Changes published successfully!'
      : 'Deployment failed';
  }

  // Hide time
  if (timeEl) {
    timeEl.style.display = 'none';
  }

  // Auto-reload affected lists when deployment succeeds
  if (success && completedDeployments.length > 0) {
    const hasPostChanges = completedDeployments.some(d =>
      d.action && d.action.toLowerCase().includes('post')
    );
    const hasPageChanges = completedDeployments.some(d =>
      d.action && d.action.toLowerCase().includes('page')
    );

    // Reload posts list if any post-related deployments completed
    if (hasPostChanges && typeof window.loadPosts === 'function') {
      window.loadPosts();
    }

    // Reload pages list if any page-related deployments completed
    if (hasPageChanges && typeof window.loadPages === 'function') {
      window.loadPages();
    }

    // Reload bin list if restore/delete operations completed
    const hasBinChanges = completedDeployments.some(d =>
      d.action && (d.action.toLowerCase().includes('restore') || d.action.toLowerCase().includes('delete'))
    );
    if (hasBinChanges && typeof window.loadBin === 'function') {
      window.loadBin();
    }
  }

  // Auto-hide after 5 seconds for success, 8 seconds for failure
  const hideDelay = success ? 5000 : 8000;
  setTimeout(() => {
    hideDeploymentBanner();
  }, hideDelay);
}

/**
 * Hides the deployment status banner
 *
 * Removes the banner from view with fade-out animation.
 */
export function hideDeploymentBanner() {
  const deploymentStatus = document.getElementById('deployment-status-header');
  const greeting = document.getElementById('header-greeting');
  const mainHeader = document.getElementById('main-header');
  const timeEl = document.getElementById('deployment-status-time');
  const links = mainHeader?.querySelectorAll('a, button');

  if (deploymentStatus) {
    // Hide deployment status, show greeting
    deploymentStatus.classList.add('d-none');
    deploymentStatus.classList.remove('d-flex');
    if (greeting) greeting.classList.remove('d-none');

    // Reset header to white background
    if (mainHeader) {
      mainHeader.classList.remove('bg-primary', 'bg-success', 'bg-danger', 'text-white');
      mainHeader.classList.add('bg-white');
    }

    // Reset link colors
    links?.forEach((link, index) => {
      link.classList.remove('text-white');
      // First link is "Visit Site" (primary), second is "Log Out" (secondary)
      link.classList.add(index === 0 ? 'text-primary' : 'text-secondary');
    });

    // Reset icon
    const iconEl = deploymentStatus.querySelector('i');
    if (iconEl) {
      iconEl.className = 'fas fa-spinner fa-spin';
    }

    // Show time again
    if (timeEl) {
      timeEl.style.display = '';
    }
  }
}

/**
 * Updates the deployment history display on dashboard
 *
 * Fetches recent deployments and renders them in the dashboard widget.
 *
 * @returns {Promise<void>}
 */
export async function updateDashboardDeployments() {
  const card = document.getElementById('deployments-card');
  if (!card) return; // Not on dashboard

  // Get elements but don't manipulate visibility yet (prevents flash)
  const loadingEl = document.getElementById('deployments-loading');
  const contentEl = document.getElementById('deployments-content');

  const cardContent = contentEl || card.querySelector('.card-content');
  if (!cardContent) return;

  // Get deployment history
  const history = await getDeploymentHistory();
  const recentHistory = history.slice(0, 10); // Show last 10

  // Initialize array if not exists
  if (!window.activeDeployments) {
    window.activeDeployments = [];
  }

  // Get commit SHAs of active deployments to avoid duplicates
  const activeShas = new Set(window.activeDeployments.map(d => d.commitSha));

  // Combine active and history for table display
  // Show: active deployments + all non-skipped/cancelled from history (excluding duplicates)
  const mainDeployments = [
    ...window.activeDeployments.map(d => ({ ...d, isActive: true })),
    ...recentHistory
      .filter(d =>
        !activeShas.has(d.commitSha) && // Not already in active deployments
        d.status !== 'skipped' &&
        d.status !== 'cancelled'
      )
      .map(d => ({ ...d, isActive: false }))
  ];

  // Separate skipped/cancelled for collapsible section
  const hiddenDeployments = recentHistory.filter(d => d.status === 'skipped' || d.status === 'cancelled');

  // Show empty state if no deployments at all
  if (mainDeployments.length === 0 && hiddenDeployments.length === 0) {
    // Hide loading and show content now that we have the final HTML
    if (loadingEl) loadingEl.classList.add('d-none');
    if (contentEl) contentEl.classList.remove('d-none');

    cardContent.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-rocket fa-3x mb-2 text-secondary"></i>
        <p class="mb-0">No deployments yet</p>
        <p class="small mt-1">Make a change to see deployment history</p>
      </div>
    `;
    return;
  }

  // Build compact table
  let html = `
    <div class="table-responsive">
      <table class="table table-sm table-hover mb-0">
        <thead class="table-light">
          <tr>
            <th class="text-uppercase small fw-medium text-muted">Status</th>
            <th class="text-uppercase small fw-medium text-muted">Action</th>
            <th class="text-uppercase small fw-medium text-muted text-end">Duration</th>
            <th class="text-uppercase small fw-medium text-muted text-end">Deployed</th>
          </tr>
        </thead>
        <tbody>
  `;

  mainDeployments.forEach((deployment, index) => {
    let statusIcon, statusColor, statusText, rowBg, textColor = '';
    let hoverClass = ''; // Only add hover for non-colored rows

    if (deployment.isActive) {
      // Active deployments - all status rows pulse
      let animationClass = ''; // Remove animate-pulse (not in Bootstrap)

      if (deployment.status === 'in_progress') {
        statusIcon = 'fa-spinner fa-spin';
        statusColor = 'text-white';
        statusText = 'Deploying';
        rowBg = 'bg-primary';
        textColor = 'text-white';
      } else if (deployment.status === 'queued') {
        statusIcon = 'fa-clock';
        statusColor = 'text-white';
        statusText = 'Queued';
        rowBg = 'bg-warning';
        textColor = 'text-white';
      } else {
        statusIcon = 'fa-hourglass-half';
        statusColor = 'text-white';
        statusText = 'Pending';
        rowBg = 'bg-secondary';
        textColor = 'text-white';
      }

      const elapsed = Math.floor((new Date() - new Date(deployment.startedAt)) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

      html += `
        <tr class="${rowBg} ${textColor} small">
          <td>
            <div class="d-flex align-items-center gap-2">
              <i class="fas ${statusIcon} ${statusColor}"></i>
              <span class="${statusColor} fw-medium">${statusText}</span>
            </div>
          </td>
          <td>
            <div class="text-truncate" style="max-width: 300px;">${escapeHtml(deployment.action)}</div>
            ${deployment.itemId ? `<div class="small ${textColor} opacity-75 text-truncate">${escapeHtml(deployment.itemId)}</div>` : ''}
          </td>
          <td class="text-end font-monospace ${textColor} opacity-75">${timeStr}</td>
          <td class="text-end ${textColor} opacity-75">live</td>
        </tr>
      `;
    } else {
      // Historical deployments (from GitHub)
      let animationClass = '';

      // Check if deployment completed recently (within last 10 seconds)
      const completedRecently = deployment.status === 'completed' &&
        deployment.completedAt &&
        (Date.now() - new Date(deployment.completedAt).getTime()) < 10000;

      if (deployment.status === 'completed') {
        statusIcon = 'fa-check-circle';
        statusColor = 'text-success';
        statusText = 'Success';
        // First row: show green background for 10 seconds after completion, then revert to normal
        // Other rows: alternating white/gray
        if (index === 0 && completedRecently) {
          rowBg = 'bg-success';
          statusColor = 'text-white';
          textColor = 'text-white';
          hoverClass = ''; // No hover effect on colored background
        } else {
          rowBg = index % 2 === 0 ? '' : 'table-light';
          textColor = ''; // Use default text colors
          hoverClass = ''; // Bootstrap table-hover provides this
        }
      } else if (deployment.status === 'failed') {
        statusIcon = 'fa-times-circle';
        statusColor = 'text-danger';
        statusText = 'Failed';
        // First row: show red background to highlight failure
        // Other rows: alternating white/gray
        if (index === 0) {
          rowBg = 'bg-danger';
          statusColor = 'text-white';
          textColor = 'text-white';
          hoverClass = ''; // No hover effect on colored background
        } else {
          rowBg = index % 2 === 0 ? '' : 'table-light';
          textColor = ''; // Use default text colors
          hoverClass = ''; // Bootstrap table-hover provides this
        }
      } else if (deployment.status === 'in_progress') {
        statusIcon = 'fa-spinner fa-spin';
        statusColor = 'text-primary';
        statusText = 'Deploying';
        if (index === 0) {
          rowBg = 'bg-primary';
          statusColor = 'text-white';
          textColor = 'text-white';
          hoverClass = ''; // No hover effect on colored background
        } else {
          rowBg = 'table-primary';
          textColor = ''; // Use default text colors
          hoverClass = ''; // Bootstrap table-hover provides this
        }
        animationClass = ''; // Remove animate-pulse (not in Bootstrap)
      } else if (deployment.status === 'queued') {
        statusIcon = 'fa-clock';
        statusColor = 'text-warning';
        statusText = 'Queued';
        if (index === 0) {
          rowBg = 'bg-warning';
          statusColor = 'text-white';
          textColor = 'text-white';
          hoverClass = ''; // No hover effect on colored background
        } else {
          rowBg = 'table-warning';
          textColor = ''; // Use default text colors
          hoverClass = ''; // Bootstrap table-hover provides this
        }
      } else if (deployment.status === 'pending') {
        statusIcon = 'fa-hourglass-half';
        statusColor = 'text-body-secondary';
        statusText = 'Pending';
        if (index === 0) {
          rowBg = 'bg-secondary';
          statusColor = 'text-white';
          textColor = 'text-white';
          hoverClass = ''; // No hover effect on colored background
        } else {
          rowBg = 'table-light';
          textColor = ''; // Use default text colors
          hoverClass = ''; // Bootstrap table-hover provides this
        }
      } else if (deployment.status === 'cancelled') {
        statusIcon = 'fa-ban';
        statusColor = 'text-warning';
        statusText = 'Cancelled';
        rowBg = index % 2 === 0 ? '' : 'table-light';
        textColor = ''; // Use default text colors
        hoverClass = ''; // Bootstrap table-hover provides this
      } else if (deployment.status === 'skipped') {
        statusIcon = 'fa-forward';
        statusColor = 'text-primary';
        statusText = 'Skipped';
        rowBg = index % 2 === 0 ? '' : 'table-light';
        textColor = ''; // Use default text colors
        hoverClass = ''; // Bootstrap table-hover provides this
      } else {
        statusIcon = 'fa-circle';
        statusColor = 'text-body-secondary';
        statusText = deployment.status;
        rowBg = index % 2 === 0 ? '' : 'table-light';
        textColor = ''; // Use default text colors
        hoverClass = ''; // Bootstrap table-hover provides this
      }

      // Format relative time
      const completedAt = new Date(deployment.completedAt || deployment.startedAt);
      const relativeTime = getRelativeTime(completedAt);

      // Format duration
      let durationStr = '-';
      if (deployment.duration) {
        const minutes = Math.floor(deployment.duration / 60);
        const seconds = deployment.duration % 60;
        durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }

      html += `
        <tr class="${rowBg} ${textColor} small">
          <td>
            <div class="d-flex align-items-center gap-2">
              <i class="fas ${statusIcon} ${statusColor}"></i>
              <span class="${statusColor} fw-medium">${statusText}</span>
            </div>
          </td>
          <td>
            <div class="text-truncate ${textColor ? textColor : 'text-dark'}" style="max-width: 300px;">${escapeHtml(deployment.action)}</div>
            ${deployment.itemId ? `<div class="small ${textColor ? textColor : 'text-muted'} text-truncate">${escapeHtml(deployment.itemId)}</div>` : ''}
          </td>
          <td class="text-end font-monospace ${textColor ? textColor : 'text-muted'}">${durationStr}</td>
          <td class="text-end ${textColor ? textColor : 'text-secondary'}">${relativeTime}</td>
        </tr>
      `;
    }
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  // Add collapsible section for skipped/cancelled if any
  if (hiddenDeployments.length > 0) {
    html += `
      <details class="mt-3">
        <summary class="cursor-pointer small text-muted py-2 px-3 bg-light rounded d-flex align-items-center justify-content-between">
          <span>
            <i class="fas fa-chevron-right me-2 small"></i>
            Skipped/Cancelled Deployments (${hiddenDeployments.length})
          </span>
        </summary>
        <div class="mt-2 table-responsive">
          <table class="table table-sm mb-0">
            <tbody>
    `;

    hiddenDeployments.forEach((deployment, index) => {
      let statusIcon, statusColor, statusText;

      if (deployment.status === 'cancelled') {
        statusIcon = 'fa-ban';
        statusColor = 'text-warning';
        statusText = 'Cancelled';
      } else {
        statusIcon = 'fa-forward';
        statusColor = 'text-primary';
        statusText = 'Skipped';
      }

      const rowBg = index % 2 === 0 ? '' : 'table-light';
      const completedAt = new Date(deployment.completedAt || deployment.startedAt);
      const relativeTime = getRelativeTime(completedAt);

      let durationStr = '-';
      if (deployment.duration) {
        const minutes = Math.floor(deployment.duration / 60);
        const seconds = deployment.duration % 60;
        durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
      }

      html += `
        <tr class="opacity-75 small">
          <td>
            <div class="d-flex align-items-center gap-2">
              <i class="fas ${statusIcon} ${statusColor}"></i>
              <span class="${statusColor} fw-medium">${statusText}</span>
            </div>
          </td>
          <td>
            <div class="text-truncate" style="max-width: 300px;">${escapeHtml(deployment.action)}</div>
            ${deployment.itemId ? `<div class="small text-muted text-truncate">${escapeHtml(deployment.itemId)}</div>` : ''}
          </td>
          <td class="text-end font-monospace text-muted">${durationStr}</td>
          <td class="text-end text-secondary">${relativeTime}</td>
        </tr>
      `;
    });

    html += `
            </tbody>
          </table>
        </div>
      </details>
    `;
  }

  // Hide loading and show content now that we have the final HTML
  if (loadingEl) loadingEl.classList.add('d-none');
  if (contentEl) contentEl.classList.remove('d-none');

  cardContent.innerHTML = html;

  // Add event listener to rotate chevron on details toggle
  const details = cardContent.querySelector('details');
  if (details) {
    details.addEventListener('toggle', (e) => {
      const chevron = e.target.querySelector('.fa-chevron-right');
      if (chevron) {
        chevron.style.transform = e.target.open ? 'rotate(90deg)' : 'rotate(0deg)';
      }
    });
  }
}

/**
 * Converts a date to relative time string
 *
 * Returns human-readable relative time (e.g., "2 minutes ago", "3 hours ago").
 *
 * @param {Date} date - Date to convert
 *
 * @returns {string} Relative time string
 */
export function getRelativeTime(date) {
  const now = new Date();
  const diffSeconds = Math.floor((now - date) / 1000);

  if (diffSeconds < 60) return 'just now';
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;

  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

/**
 * Starts background polling for deployment history
 *
 * Sets up interval to refresh deployment history every 10 seconds.
 */
export function startDeploymentHistoryPolling() {
  if (window.historyPollInterval) return; // Already polling

  // Run initial update immediately
  const dashboardCard = document.getElementById('deployments-card');
  if (dashboardCard) {
    updateDashboardDeployments();
  }

  // Poll every 10 seconds to refresh history (includes code pushes, not just admin changes)
  // More frequent polling ensures users see deployment status updates quickly
  window.historyPollInterval = setInterval(async () => {
    // Initialize array if not exists
    if (!window.activeDeployments) {
      window.activeDeployments = [];
    }

    // Check for new in-progress deployments from GitHub and add to tracking
    try {
      const githubDeployments = await fetchRecentDeploymentsFromGitHub();
      const inProgressDeployments = githubDeployments.filter(d =>
        d.status === 'pending' || d.status === 'queued' || d.status === 'in_progress'
      );

      // Add any new deployments that aren't already being tracked
      inProgressDeployments.forEach(githubDep => {
        const alreadyTracking = window.activeDeployments.some(d => d.commitSha === githubDep.commitSha);
        if (!alreadyTracking) {
          window.activeDeployments.push({
            commitSha: githubDep.commitSha,
            action: githubDep.action,
            itemId: null,
            startedAt: new Date(githubDep.startedAt),
            status: githubDep.status
          });
          showDeploymentBanner();
          startDeploymentPolling();
        }
      });
    } catch (error) {
      logger.error('Failed to check for new deployments:', error);
    }

    // Update dashboard deployments (fetches from GitHub via getDeploymentHistory)
    const dashboardCard = document.getElementById('deployments-card');
    if (dashboardCard) {
      await updateDashboardDeployments();
    }
  }, window.DEPLOYMENT_HISTORY_POLL_INTERVAL);
}

/**
 * Stops deployment history polling
 *
 * Clears the polling interval.
 */
export function stopDeploymentHistoryPolling() {
  if (window.historyPollInterval) {
    clearInterval(window.historyPollInterval);
    window.historyPollInterval = null;
  }
}

/**
 * Starts polling for active deployment status
 *
 * Sets up interval to check deployment status every 5 seconds and handles completion.
 */
export function startDeploymentPolling() {
  if (window.deploymentPollInterval) return; // Already polling

  window.deploymentPollInterval = setInterval(async () => {
    try {
      // Defensive check: ensure activeDeployments array exists
      if (!window.activeDeployments || window.activeDeployments.length === 0) {
        hideDeploymentBanner();
        return;
      }

      // Update time display
      updateDeploymentBanner();

      // Check status of each deployment
      for (let i = window.activeDeployments.length - 1; i >= 0; i--) {
        const deployment = window.activeDeployments[i];

        // Timeout after configured duration
        const elapsed = Math.floor((new Date() - deployment.startedAt) / 1000);
        if (elapsed > window.DEPLOYMENT_TIMEOUT) {
          // Deployment timed out - mark as failed and add to history
          deployment.status = 'failed';
          addToDeploymentHistory(deployment);
          window.activeDeployments.splice(i, 1);

          if (window.activeDeployments.length === 0) {
            // Show timeout as failure, not success
            showDeploymentCompletion(false, [deployment]);
          }
          continue;
        }

        try {
          const response = await fetch(`${window.API_BASE}/deployment-status?sha=${deployment.commitSha}`);
          if (!response.ok) {
            logger.warn(`Deployment status check failed: ${response.status}`);
            continue;
          }

          const data = await response.json();

          // Update deployment status
          deployment.status = data.status;
          deployment.updatedAt = new Date();
          updateDashboardDeployments();

          if (data.status === 'completed') {
            // Deployment successful
            addToDeploymentHistory(deployment);
            window.activeDeployments.splice(i, 1);
            updateDashboardDeployments();

            // Only update banner when ALL deployments are complete
            if (window.activeDeployments.length === 0) {
              showDeploymentCompletion(true, [deployment]);
            }
          } else if (data.status === 'failed') {
            // Deployment failed
            addToDeploymentHistory(deployment);
            window.activeDeployments.splice(i, 1);
            updateDashboardDeployments();

            if (window.activeDeployments.length === 0) {
              showDeploymentCompletion(false, [deployment]);
            }
          } else if (data.status === 'cancelled' || data.status === 'skipped') {
            // Deployment cancelled or skipped (superseded by newer commit)
            addToDeploymentHistory(deployment);
            window.activeDeployments.splice(i, 1);
            updateDashboardDeployments();

            // Don't show error for cancelled/skipped - this is normal when multiple changes are queued
            // The newer deployment will include all changes from this one
            if (window.activeDeployments.length === 0) {
              hideDeploymentBanner();
            }
          }
          // pending, queued, in_progress continue polling
        } catch (error) {
          logger.error('Failed to check deployment status:', error);
        }
      }
    } catch (error) {
      logger.error('Error in deployment polling interval:', error);
      // Don't stop polling even on error
    }
  }, window.DEPLOYMENT_STATUS_POLL_INTERVAL);
}
