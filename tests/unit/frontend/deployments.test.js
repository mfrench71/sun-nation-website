/**
 * Unit Tests for Deployments Module
 *
 * Tests deployment tracking, polling, history management, and UI updates.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadDeploymentHistory,
  saveDeploymentHistory,
  addToDeploymentHistory,
  getDeploymentHistory,
  trackDeployment,
  showDeploymentBanner,
  hideDeploymentBanner,
  updateDeploymentBanner,
  showDeploymentCompletion,
  getRelativeTime,
  restoreActiveDeployments,
  fetchRecentDeploymentsFromGitHub
} from '../../../admin/js/modules/deployments.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Deployments Module', () => {
  let mockFetch;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>
      <div id="deployment-status-header" class="hidden">
        <i class="fas fa-spinner fa-spin"></i>
        <div id="deployment-status-message"></div>
        <div id="deployment-status-time"></div>
      </div>
      <div id="deployments-card">
        <div class="card-content"></div>
      </div>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.DEPLOYMENT_STATUS_POLL_INTERVAL = 5000;
    window.DEPLOYMENT_HISTORY_POLL_INTERVAL = 10000;
    window.DEPLOYMENT_TIMEOUT = 600;
    window.activeDeployments = [];
    window.deploymentPollInterval = null;
    window.historyPollInterval = null;
    window.loadPosts = vi.fn();
    window.loadPages = vi.fn();
    window.loadTrash = vi.fn();

    // Mock fetch with default response for functions that call updateDashboardDeployments
    mockFetch = vi.fn();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ deployments: [] })
    });
    global.fetch = mockFetch;

    // Mock localStorage
    global.localStorage.clear();

    // Mock timers for polling tests
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    if (window.deploymentPollInterval) {
      clearInterval(window.deploymentPollInterval);
    }
    if (window.historyPollInterval) {
      clearInterval(window.historyPollInterval);
    }
  });

  describe('Storage Functions', () => {
    describe('loadDeploymentHistory', () => {
      it('loads deployment history from localStorage', () => {
        const history = [
          { commitSha: 'abc123', action: 'Create post', status: 'completed' }
        ];
        localStorage.setItem('deploymentHistory', JSON.stringify(history));

        const loaded = loadDeploymentHistory();

        expect(loaded).toEqual(history);
      });

      it('returns empty array when no history', () => {
        const loaded = loadDeploymentHistory();

        expect(loaded).toEqual([]);
      });

      it('handles corrupted localStorage gracefully', () => {
        localStorage.setItem('deploymentHistory', 'invalid json');

        const loaded = loadDeploymentHistory();

        expect(loaded).toEqual([]);
      });
    });

    describe('saveDeploymentHistory', () => {
      it('saves deployment history to localStorage', () => {
        const history = [
          { commitSha: 'abc123', action: 'Create post', status: 'completed' }
        ];

        saveDeploymentHistory(history);

        const saved = JSON.parse(localStorage.getItem('deploymentHistory'));
        expect(saved).toEqual(history);
      });

      it('trims history to last 50 items', () => {
        const history = Array.from({ length: 60 }, (_, i) => ({
          commitSha: `sha${i}`,
          action: 'Test',
          status: 'completed'
        }));

        saveDeploymentHistory(history);

        const saved = JSON.parse(localStorage.getItem('deploymentHistory'));
        expect(saved.length).toBe(50);
        // Should keep the LAST 50 items (newest ones if array is ordered newest-last)
        expect(saved[49].commitSha).toBe('sha59');
      });

      it('handles save errors gracefully', () => {
        // Mock localStorage to throw
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
          throw new Error('Quota exceeded');
        });

        expect(() => saveDeploymentHistory([{ test: 'data' }])).not.toThrow();

        setItemSpy.mockRestore();
      });
    });

    describe('addToDeploymentHistory', () => {
      it('adds deployment to history and calculates duration', () => {
        const startTime = new Date();
        const deployment = {
          commitSha: 'abc123',
          action: 'Create post',
          status: 'completed',
          startedAt: startTime.toISOString()
        };

        addToDeploymentHistory(deployment);

        const history = JSON.parse(localStorage.getItem('deploymentHistory'));
        expect(history.length).toBe(1);
        expect(history[0].commitSha).toBe('abc123');
        expect(history[0].action).toBe('Create post');
        expect(history[0]).toHaveProperty('duration');
        expect(typeof history[0].duration).toBe('number');
      });

      it('appends to existing history', () => {
        const existing = [
          { commitSha: 'old123', action: 'Old', status: 'completed' }
        ];
        localStorage.setItem('deploymentHistory', JSON.stringify(existing));

        const newDeployment = {
          commitSha: 'new456',
          action: 'New',
          status: 'completed',
          startedAt: new Date().toISOString()
        };

        addToDeploymentHistory(newDeployment);

        const history = JSON.parse(localStorage.getItem('deploymentHistory'));
        expect(history.length).toBe(2);
        expect(history[0].commitSha).toBe('old123'); // Old still at index 0
        expect(history[1].commitSha).toBe('new456'); // New appended to end
      });
    });
  });

  describe('getDeploymentHistory', () => {
    it('returns localStorage history when GitHub returns empty', async () => {
      const localHistory = [
        { commitSha: 'abc123', action: 'Test', status: 'completed', startedAt: '2025-10-20T10:00:00Z' }
      ];
      localStorage.setItem('deploymentHistory', JSON.stringify(localHistory));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: [] })
      });

      const result = await getDeploymentHistory();

      expect(result).toEqual(localHistory);
    });

    it('merges localStorage and GitHub data', async () => {
      const localHistory = [
        { commitSha: 'local123', action: 'Local', status: 'pending', startedAt: '2025-10-20T10:00:00Z' }
      ];
      localStorage.setItem('deploymentHistory', JSON.stringify(localHistory));

      const githubDeployments = [
        { commitSha: 'github456', action: 'GitHub', status: 'completed', startedAt: '2025-10-20T11:00:00Z', completedAt: '2025-10-20T11:05:00Z' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: githubDeployments })
      });

      const result = await getDeploymentHistory();

      expect(result.length).toBe(2);
      expect(result[0].commitSha).toBe('github456'); // Most recent first (sorted by date)
      expect(result[1].commitSha).toBe('local123');
    });

    it('GitHub deployment overrides localStorage for same commit', async () => {
      const localHistory = [
        { commitSha: 'abc123', action: 'Test', status: 'pending', startedAt: '2025-10-20T10:00:00Z' }
      ];
      localStorage.setItem('deploymentHistory', JSON.stringify(localHistory));

      const githubDeployments = [
        { commitSha: 'abc123', action: 'Test', status: 'completed', startedAt: '2025-10-20T10:00:00Z', completedAt: '2025-10-20T10:05:00Z' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: githubDeployments })
      });

      const result = await getDeploymentHistory();

      expect(result.length).toBe(1);
      expect(result[0].status).toBe('completed'); // GitHub status wins
    });

    it('sorts by completedAt/startedAt (most recent first)', async () => {
      const localHistory = [
        { commitSha: 'old123', action: 'Old', status: 'completed', completedAt: '2025-10-20T09:00:00Z', startedAt: '2025-10-20T08:55:00Z' },
        { commitSha: 'new123', action: 'New', status: 'completed', completedAt: '2025-10-20T11:00:00Z', startedAt: '2025-10-20T10:55:00Z' }
      ];
      localStorage.setItem('deploymentHistory', JSON.stringify(localHistory));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: [] })
      });

      const result = await getDeploymentHistory();

      expect(result[0].commitSha).toBe('new123'); // Most recent first
      expect(result[1].commitSha).toBe('old123');
    });

    it('handles GitHub API errors gracefully', async () => {
      const localHistory = [
        { commitSha: 'abc123', action: 'Test', status: 'completed' }
      ];
      localStorage.setItem('deploymentHistory', JSON.stringify(localHistory));

      mockFetch.mockRejectedValue(new Error('API error'));

      const result = await getDeploymentHistory();

      expect(result).toEqual(localHistory); // Falls back to localStorage
    });
  });

  describe('trackDeployment', () => {
    it('adds deployment to activeDeployments', () => {
      trackDeployment('abc123', 'Create post: Test', 'test.md');

      expect(window.activeDeployments.length).toBe(1);
      expect(window.activeDeployments[0]).toMatchObject({
        commitSha: 'abc123',
        action: 'Create post: Test',
        itemId: 'test.md',
        status: 'pending'
      });
    });

    it('shows deployment banner', () => {
      trackDeployment('abc123', 'Create post', null);

      const banner = document.getElementById('deployment-status-header');
      expect(banner.classList.contains('hidden')).toBe(false);
    });

    it('starts polling interval', () => {
      trackDeployment('abc123', 'Create post', null);

      expect(window.deploymentPollInterval).not.toBeNull();
    });

    it('handles null itemId', () => {
      expect(() => trackDeployment('abc123', 'Action', null)).not.toThrow();
    });

    it('does not track if commitSha is empty', () => {
      trackDeployment('', 'Action', null);

      expect(window.activeDeployments.length).toBe(0);
    });
  });

  describe('UI Functions', () => {
    describe('showDeploymentBanner', () => {
      it('shows banner', () => {
        window.activeDeployments = [{ commitSha: 'abc123', action: 'Test', startedAt: new Date() }];

        showDeploymentBanner();

        const banner = document.getElementById('deployment-status-header');
        expect(banner.classList.contains('hidden')).toBe(false);
      });

      it('updates banner message', () => {
        window.activeDeployments = [{ commitSha: 'abc123', action: 'Create post', startedAt: new Date() }];

        showDeploymentBanner();

        const message = document.getElementById('deployment-status-message');
        expect(message.textContent).toContain('Publishing');
      });
    });

    describe('hideDeploymentBanner', () => {
      it('hides banner', () => {
        const banner = document.getElementById('deployment-status-header');
        banner.classList.remove('hidden');

        hideDeploymentBanner();

        expect(banner.classList.contains('hidden')).toBe(true);
      });

      it('resets banner styling to defaults', () => {
        const banner = document.getElementById('deployment-status-header');
        banner.className = 'bg-green-500';

        hideDeploymentBanner();

        expect(banner.classList.contains('hidden')).toBe(true);
        expect(banner.classList.contains('bg-gradient-to-r')).toBe(true);
      });
    });

    describe('updateDeploymentBanner', () => {
      it('updates elapsed time display', () => {
        window.activeDeployments = [{
          commitSha: 'abc123',
          action: 'Test',
          startedAt: new Date(Date.now() - 65000) // 65 seconds ago
        }];

        updateDeploymentBanner();

        const timeEl = document.getElementById('deployment-status-time');
        expect(timeEl.textContent).toMatch(/1:05/);
      });

      it('formats time as MM:SS', () => {
        window.activeDeployments = [{
          commitSha: 'abc123',
          action: 'Test',
          startedAt: new Date(Date.now() - 130000) // 2 minutes 10 seconds ago
        }];

        updateDeploymentBanner();

        const timeEl = document.getElementById('deployment-status-time');
        expect(timeEl.textContent).toMatch(/2:10/);
      });

      it('handles multiple deployments by showing oldest', () => {
        window.activeDeployments = [
          { commitSha: 'abc', action: 'First', startedAt: new Date(Date.now() - 30000) },
          { commitSha: 'def', action: 'Second', startedAt: new Date(Date.now() - 60000) }
        ];

        updateDeploymentBanner();

        const messageEl = document.getElementById('deployment-status-message');
        expect(messageEl.textContent).toContain('2 changes');
      });
    });

    describe('showDeploymentCompletion', () => {
      it('shows success banner for successful deployments', () => {
        showDeploymentCompletion(true, [
          { action: 'Create post: test.md' }
        ]);

        const banner = document.getElementById('deployment-status-header');
        expect(banner.classList.contains('from-green-500')).toBe(true);
      });

      it('shows failure banner for failed deployments', () => {
        showDeploymentCompletion(false, [
          { action: 'Create post: test.md' }
        ]);

        const banner = document.getElementById('deployment-status-header');
        expect(banner.classList.contains('from-red-500')).toBe(true);
      });

      it('reloads posts when post action detected', () => {
        showDeploymentCompletion(true, [
          { action: 'Create post: test.md' }
        ]);

        expect(window.loadPosts).toHaveBeenCalled();
      });

      it('reloads pages when page action detected', () => {
        showDeploymentCompletion(true, [
          { action: 'Update page: about.md' }
        ]);

        expect(window.loadPages).toHaveBeenCalled();
      });

      it('reloads trash when restore action detected', () => {
        showDeploymentCompletion(true, [
          { action: 'Restore post: old.md' }
        ]);

        expect(window.loadTrash).toHaveBeenCalled();
      });

      it('handles multiple actions', () => {
        showDeploymentCompletion(true, [
          { action: 'Create post: one.md' },
          { action: 'Update page: two.md' },
          { action: 'Delete post: three.md' }
        ]);

        expect(window.loadPosts).toHaveBeenCalled();
        expect(window.loadPages).toHaveBeenCalled();
        expect(window.loadTrash).toHaveBeenCalled();
      });

      it('changes success icon', () => {
        showDeploymentCompletion(true, [{ action: 'Test' }]);

        const banner = document.getElementById('deployment-status-header');
        const icon = banner.querySelector('i');
        expect(icon.classList.contains('fa-check-circle')).toBe(true);
      });

      it('changes failure icon', () => {
        showDeploymentCompletion(false, [{ action: 'Test' }]);

        const banner = document.getElementById('deployment-status-header');
        const icon = banner.querySelector('i');
        expect(icon.classList.contains('fa-exclamation-circle')).toBe(true);
      });
    });
  });

  describe('getRelativeTime', () => {
    it('returns "just now" for recent times', () => {
      const now = new Date();
      expect(getRelativeTime(now)).toBe('just now');
    });

    it('returns minutes ago for < 1 hour', () => {
      const date = new Date(Date.now() - 120000); // 2 minutes ago
      expect(getRelativeTime(date)).toBe('2m ago');
    });

    it('returns hours ago for < 1 day', () => {
      const date = new Date(Date.now() - 7200000); // 2 hours ago
      expect(getRelativeTime(date)).toBe('2h ago');
    });

    it('returns days ago for < 1 week', () => {
      const date = new Date(Date.now() - 172800000); // 2 days ago
      expect(getRelativeTime(date)).toBe('2d ago');
    });

    it('returns formatted date for old times', () => {
      const date = new Date(Date.now() - 864000000); // 10 days ago
      const result = getRelativeTime(date);
      expect(result).toMatch(/\d{2} \w{3}/); // Format like "12 Oct"
    });
  });

  describe('restoreActiveDeployments', () => {
    it('fetches recent deployments from GitHub', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: [] })
      });

      await restoreActiveDeployments();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/deployment-history')
      );
    });

    it('adds in-progress deployments to activeDeployments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            {
              commitSha: 'abc123',
              action: 'Create post: test.md',
              status: 'in_progress',
              startedAt: new Date().toISOString()
            }
          ]
        })
      });

      await restoreActiveDeployments();

      expect(window.activeDeployments.length).toBe(1);
      expect(window.activeDeployments[0].commitSha).toBe('abc123');
    });

    it('adds pending deployments to activeDeployments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            {
              commitSha: 'abc123',
              action: 'Test',
              status: 'pending',
              startedAt: new Date().toISOString()
            }
          ]
        })
      });

      await restoreActiveDeployments();

      expect(window.activeDeployments.length).toBe(1);
    });

    it('shows banner if deployments found', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            {
              commitSha: 'abc123',
              action: 'Test',
              status: 'pending',
              startedAt: new Date().toISOString()
            }
          ]
        })
      });

      await restoreActiveDeployments();

      const banner = document.getElementById('deployment-status-header');
      expect(banner.classList.contains('hidden')).toBe(false);
    });

    it('does not show banner if no in-progress deployments', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            {
              commitSha: 'abc123',
              action: 'Test',
              status: 'completed',
              startedAt: new Date().toISOString()
            }
          ]
        })
      });

      await restoreActiveDeployments();

      const banner = document.getElementById('deployment-status-header');
      expect(banner.classList.contains('hidden')).toBe(true);
    });

    it('handles API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('API error'));

      await expect(restoreActiveDeployments()).resolves.not.toThrow();
    });
  });

  describe('fetchRecentDeploymentsFromGitHub', () => {
    it('fetches deployments from GitHub API', async () => {
      const mockDeployments = [
        { commitSha: 'abc123', status: 'completed', startedAt: '2025-10-20T10:00:00Z' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ deployments: mockDeployments })
      });

      const result = await fetchRecentDeploymentsFromGitHub();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/deployment-history')
      );
      expect(result).toEqual(mockDeployments);
    });

    it('returns empty array on API error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await fetchRecentDeploymentsFromGitHub();

      expect(result).toEqual([]);
    });

    it('returns empty array on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      const result = await fetchRecentDeploymentsFromGitHub();

      expect(result).toEqual([]);
    });

    it('handles missing deployments property', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}) // No deployments property
      });

      const result = await fetchRecentDeploymentsFromGitHub();

      expect(result).toEqual([]);
    });
  });

  describe('Integration - Deployment Lifecycle', () => {
    it('tracks, updates, and completes deployment', () => {
      // Start tracking
      trackDeployment('abc123', 'Create post: test.md', 'test.md');

      expect(window.activeDeployments.length).toBe(1);
      expect(window.activeDeployments[0].status).toBe('pending');

      const banner = document.getElementById('deployment-status-header');
      expect(banner.classList.contains('hidden')).toBe(false);

      // Update elapsed time
      window.activeDeployments[0].startedAt = new Date(Date.now() - 30000);
      updateDeploymentBanner();

      const timeEl = document.getElementById('deployment-status-time');
      expect(timeEl.textContent).toMatch(/0:30/);

      // Complete deployment
      showDeploymentCompletion(true, [
        { action: 'Create post: test.md' }
      ]);

      expect(window.loadPosts).toHaveBeenCalled();
    });

    it('merges localStorage and GitHub history correctly', async () => {
      // Add to localStorage
      const deployment1 = {
        commitSha: 'local123',
        action: 'Local',
        status: 'completed',
        startedAt: '2025-10-20T09:00:00Z',
        completedAt: '2025-10-20T09:05:00Z'
      };
      addToDeploymentHistory(deployment1);

      // Mock GitHub response
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          deployments: [
            {
              commitSha: 'github456',
              action: 'GitHub',
              status: 'completed',
              startedAt: '2025-10-20T10:00:00Z',
              completedAt: '2025-10-20T10:05:00Z'
            }
          ]
        })
      });

      // Get merged history
      const history = await getDeploymentHistory();

      expect(history.length).toBe(2);
      expect(history[0].commitSha).toBe('github456'); // Most recent
      expect(history[1].commitSha).toBe('local123');
    });
  });
});
