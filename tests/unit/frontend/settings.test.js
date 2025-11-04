/**
 * Unit Tests for Settings Module
 *
 * Tests both site configuration and admin application settings management.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadSettings,
  saveSettings,
  loadAdminSettings,
  saveAdminSettings,
  resetAdminSettings
} from '../../../admin/js/modules/settings.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Settings Module', () => {
  let mockFetch;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>

      <!-- Site Settings Form -->
      <form id="settings-form">
        <input id="setting-title" name="title" value="" />
        <input id="setting-description" name="description" value="" />
        <input id="setting-url" name="url" value="" />
        <input id="setting-paginate" name="paginate" value="" />
        <input id="setting-related_posts_count" name="related_posts_count" value="" />
        <button id="settings-save-btn">Save Settings</button>
      </form>

      <!-- Admin Settings Form -->
      <form id="admin-settings-form">
        <input id="admin-setting-deployment-poll-interval" name="deployment_poll_interval" value="" />
        <input id="admin-setting-deployment-history-poll-interval" name="deployment_history_poll_interval" value="" />
        <input id="admin-setting-deployment-timeout" name="deployment_timeout" value="" />
        <input id="admin-setting-fetch-timeout" name="fetch_timeout" value="" />
        <input id="admin-setting-debounce-delay" name="debounce_delay" value="" />
        <button id="admin-settings-save-btn">Save Admin Settings</button>
      </form>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.trackDeployment = vi.fn();
    window.DEPLOYMENT_STATUS_POLL_INTERVAL = 10000;
    window.DEPLOYMENT_HISTORY_POLL_INTERVAL = 30000;
    window.DEPLOYMENT_TIMEOUT = 600;

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadSettings (Site Configuration)', () => {
    it('fetches settings from API and populates form', async () => {
      const mockSettings = {
        title: 'My Blog',
        description: 'A test blog',
        url: 'https://example.com',
        paginate: '10',
        related_posts_count: '5'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSettings
      });

      await loadSettings();

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/settings');
      expect(document.getElementById('setting-title').value).toBe('My Blog');
      expect(document.getElementById('setting-description').value).toBe('A test blog');
      expect(document.getElementById('setting-url').value).toBe('https://example.com');
    });

    it('handles API error gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await loadSettings();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadSettings();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('populates empty values for missing settings', async () => {
      const mockSettings = {
        title: 'My Blog'
        // description is missing
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSettings
      });

      await loadSettings();

      expect(document.getElementById('setting-title').value).toBe('My Blog');
      expect(document.getElementById('setting-description').value).toBe('');
    });

    it('only populates fields that exist in DOM', async () => {
      const mockSettings = {
        title: 'My Blog',
        nonexistent_field: 'value'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockSettings
      });

      // Should not throw error for nonexistent field
      await expect(loadSettings()).resolves.not.toThrow();
    });
  });

  describe('saveSettings (Site Configuration)', () => {
    it('saves settings to API', async () => {
      document.getElementById('setting-title').value = 'New Title';
      document.getElementById('setting-description').value = 'New Description';
      document.getElementById('setting-paginate').value = '15';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Settings saved!' })
      });

      const event = new Event('submit');
      await saveSettings(event);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/settings',
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.title).toBe('New Title');
      expect(body.description).toBe('New Description');
      expect(body.paginate).toBe(15); // Should be converted to number
    });

    it('converts number fields to integers', async () => {
      document.getElementById('setting-paginate').value = '20';
      document.getElementById('setting-related_posts_count').value = '8';

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await saveSettings(event);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(typeof body.paginate).toBe('number');
      expect(body.paginate).toBe(20);
      expect(typeof body.related_posts_count).toBe('number');
      expect(body.related_posts_count).toBe(8);
    });

    it('tracks deployment when commit SHA returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          commitSha: 'abc123',
          message: 'Settings saved!'
        })
      });

      const event = new Event('submit');
      await saveSettings(event);

      expect(window.trackDeployment).toHaveBeenCalledWith(
        'abc123',
        'Update site settings',
        '_config.yml'
      );
    });

    it('shows success message after save', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, message: 'Saved!' })
      });

      const event = new Event('submit');
      await saveSettings(event);

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
    });

    it('shows error message when save fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Save failed' })
      });

      const event = new Event('submit');
      await saveSettings(event);

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('disables button during save', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ ok: true, json: async () => ({ success: true }) });
          }, 100);
        })
      );

      const event = new Event('submit');
      const savePromise = saveSettings(event);

      const saveBtn = document.getElementById('settings-save-btn');
      expect(saveBtn.disabled).toBe(true);
      expect(saveBtn.innerHTML).toBe('Saving...');

      await savePromise;

      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.innerHTML).toBe('Save Settings');
    });

    it('re-enables button even on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const event = new Event('submit');
      await saveSettings(event);

      const saveBtn = document.getElementById('settings-save-btn');
      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.innerHTML).toBe('Save Settings');
    });

    it('prevents default form submission', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      await saveSettings(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('loadAdminSettings', () => {
    it('loads default admin settings when none stored', () => {
      loadAdminSettings();

      // Values are converted from milliseconds to seconds for display
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10'); // 10000ms -> 10s
      expect(document.getElementById('admin-setting-deployment-history-poll-interval').value).toBe('30'); // 30000ms -> 30s
      expect(document.getElementById('admin-setting-deployment-timeout').value).toBe('600'); // Already in seconds
      expect(document.getElementById('admin-setting-fetch-timeout').value).toBe('30'); // 30000ms -> 30s
      expect(document.getElementById('admin-setting-debounce-delay').value).toBe('300'); // Already in milliseconds
    });

    it('loads stored admin settings from localStorage', () => {
      const customSettings = {
        deployment_poll_interval: 20000,
        deployment_history_poll_interval: 60000,
        deployment_timeout: 1200,
        fetch_timeout: 60000,
        debounce_delay: 500
      };

      localStorage.setItem('admin_settings', JSON.stringify(customSettings));

      loadAdminSettings();

      // Values are converted from milliseconds to seconds for display
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('20'); // 20000ms -> 20s
      expect(document.getElementById('admin-setting-deployment-history-poll-interval').value).toBe('60'); // 60000ms -> 60s
      expect(document.getElementById('admin-setting-deployment-timeout').value).toBe('1200'); // Already in seconds
    });

    it('merges stored settings with defaults', () => {
      const partialSettings = {
        deployment_poll_interval: 15000
        // Other settings missing
      };

      localStorage.setItem('admin_settings', JSON.stringify(partialSettings));

      loadAdminSettings();

      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('15'); // 15000ms -> 15s
      expect(document.getElementById('admin-setting-deployment-history-poll-interval').value).toBe('30'); // Default 30000ms -> 30s
    });

    it('handles corrupt localStorage data gracefully', () => {
      localStorage.setItem('admin_settings', 'not valid json');

      // Should not throw
      expect(() => loadAdminSettings()).not.toThrow();

      // Should load defaults
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10'); // 10000ms -> 10s
    });

    it('converts underscore keys to dash IDs correctly (regression test)', () => {
      loadAdminSettings();

      // Test the ID matching that was previously broken
      const expectedIds = [
        'admin-setting-deployment-poll-interval',
        'admin-setting-deployment-history-poll-interval',
        'admin-setting-deployment-timeout',
        'admin-setting-fetch-timeout',
        'admin-setting-debounce-delay',
      ];

      expectedIds.forEach(id => {
        const element = document.getElementById(id);
        expect(element).not.toBeNull();
        expect(element.value).toBeTruthy();
      });
    });
  });

  describe('saveAdminSettings', () => {
    it('saves admin settings to localStorage', () => {
      // Form values are in seconds, converted to milliseconds when saved
      document.getElementById('admin-setting-deployment-poll-interval').value = '25'; // 25 seconds
      document.getElementById('admin-setting-deployment-history-poll-interval').value = '45'; // 45 seconds
      document.getElementById('admin-setting-deployment-timeout').value = '800'; // Already in seconds

      const event = new Event('submit');
      saveAdminSettings(event);

      const stored = JSON.parse(localStorage.getItem('admin_settings'));
      expect(stored.deployment_poll_interval).toBe(25000); // 25s -> 25000ms
      expect(stored.deployment_history_poll_interval).toBe(45000); // 45s -> 45000ms
      expect(stored.deployment_timeout).toBe(800); // No conversion
    });

    it('updates global constants', () => {
      // Form values are in seconds, converted to milliseconds when saved
      document.getElementById('admin-setting-deployment-poll-interval').value = '15'; // 15 seconds
      document.getElementById('admin-setting-deployment-history-poll-interval').value = '50'; // 50 seconds
      document.getElementById('admin-setting-deployment-timeout').value = '900'; // Already in seconds

      const event = new Event('submit');
      saveAdminSettings(event);

      expect(window.DEPLOYMENT_STATUS_POLL_INTERVAL).toBe(15000); // 15s -> 15000ms
      expect(window.DEPLOYMENT_HISTORY_POLL_INTERVAL).toBe(50000); // 50s -> 50000ms
      expect(window.DEPLOYMENT_TIMEOUT).toBe(900); // No conversion
    });

    it('shows success message', () => {
      const event = new Event('submit');
      saveAdminSettings(event);

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('Admin settings saved');
    });

    it('shows simple message when only polling intervals change', () => {
      // Load initial settings
      loadAdminSettings();

      // Change only polling interval (doesn't require refresh)
      document.getElementById('admin-setting-deployment-poll-interval').value = '25';

      const event = new Event('submit');
      saveAdminSettings(event);

      const successEl = document.getElementById('success');
      const message = successEl.querySelector('p').textContent;
      expect(message).toContain('applied immediately');
      expect(message).not.toContain('Refresh page');
    });

    it('shows refresh button when fetch_timeout changes', () => {
      // Load initial settings
      loadAdminSettings();

      // Change fetch_timeout (requires refresh)
      document.getElementById('admin-setting-fetch-timeout').value = '60'; // Different from default 30s

      const event = new Event('submit');
      saveAdminSettings(event);

      const successEl = document.getElementById('success');
      const message = successEl.querySelector('p').innerHTML;
      expect(message).toContain('Refresh page');
      expect(message).toContain('button');
    });

    it('shows refresh button when debounce_delay changes', () => {
      // Load initial settings
      loadAdminSettings();

      // Change debounce_delay (requires refresh)
      document.getElementById('admin-setting-debounce-delay').value = '500'; // Different from default 300ms

      const event = new Event('submit');
      saveAdminSettings(event);

      const successEl = document.getElementById('success');
      const message = successEl.querySelector('p').innerHTML;
      expect(message).toContain('Refresh page');
      expect(message).toContain('button');
    });

    it('disables button during save', () => {
      const event = new Event('submit');
      saveAdminSettings(event);

      const saveBtn = document.getElementById('admin-settings-save-btn');
      // Button gets re-enabled in finally block
      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.innerHTML).toBe('Save Admin Settings');
    });

    it('prevents default form submission', () => {
      const event = new Event('submit');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      saveAdminSettings(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('parses all values as integers', () => {
      // Form values in seconds, converted to milliseconds when saved
      document.getElementById('admin-setting-deployment-poll-interval').value = '12'; // 12 seconds
      document.getElementById('admin-setting-fetch-timeout').value = '67'; // 67 seconds

      const event = new Event('submit');
      saveAdminSettings(event);

      const stored = JSON.parse(localStorage.getItem('admin_settings'));
      expect(typeof stored.deployment_poll_interval).toBe('number');
      expect(typeof stored.fetch_timeout).toBe('number');
      expect(stored.deployment_poll_interval).toBe(12000); // 12s -> 12000ms
    });
  });

  describe('resetAdminSettings', () => {
    it('resets form fields to default values', () => {
      // Set custom values first
      document.getElementById('admin-setting-deployment-poll-interval').value = '99999';
      document.getElementById('admin-setting-deployment-history-poll-interval').value = '88888';

      resetAdminSettings();

      // Values are displayed in seconds (converted from milliseconds)
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10'); // 10000ms -> 10s
      expect(document.getElementById('admin-setting-deployment-history-poll-interval').value).toBe('30'); // 30000ms -> 30s
      expect(document.getElementById('admin-setting-deployment-timeout').value).toBe('600'); // Already in seconds
      expect(document.getElementById('admin-setting-fetch-timeout').value).toBe('30'); // 30000ms -> 30s
      expect(document.getElementById('admin-setting-debounce-delay').value).toBe('300'); // Already in milliseconds
    });

    it('does not save automatically', () => {
      resetAdminSettings();

      // localStorage should not be updated
      expect(localStorage.getItem('admin_settings')).toBeNull();
    });

    it('shows success message indicating user must save', () => {
      resetAdminSettings();

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('Click "Save"');
    });
  });

  describe('Integration - Complete Settings Workflow', () => {
    it('can load, modify, and save site settings', async () => {
      // Load existing settings
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'Old Title' })
      });

      await loadSettings();
      expect(document.getElementById('setting-title').value).toBe('Old Title');

      // Modify and save
      document.getElementById('setting-title').value = 'New Title';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Saved!' })
      });

      const event = new Event('submit');
      await saveSettings(event);

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
    });

    it('can load, modify, and save admin settings', () => {
      // Load defaults
      loadAdminSettings();
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10'); // 10000ms -> 10s

      // Modify (in seconds)
      document.getElementById('admin-setting-deployment-poll-interval').value = '20'; // 20 seconds

      // Save
      const event = new Event('submit');
      saveAdminSettings(event);

      // Verify saved (converted to milliseconds)
      const stored = JSON.parse(localStorage.getItem('admin_settings'));
      expect(stored.deployment_poll_interval).toBe(20000); // 20s -> 20000ms

      // Load again to verify persistence (displayed in seconds)
      document.getElementById('admin-setting-deployment-poll-interval').value = '';
      loadAdminSettings();
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('20'); // 20000ms -> 20s
    });

    it('can reset admin settings and then save', () => {
      // Set custom values (in seconds)
      document.getElementById('admin-setting-deployment-poll-interval').value = '99'; // 99 seconds
      const event1 = new Event('submit');
      saveAdminSettings(event1);

      // Reset (displays in seconds)
      resetAdminSettings();
      expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10'); // 10000ms -> 10s

      // Save the defaults
      const event2 = new Event('submit');
      saveAdminSettings(event2);

      const stored = JSON.parse(localStorage.getItem('admin_settings'));
      expect(stored.deployment_poll_interval).toBe(10000); // 10s -> 10000ms
    });
  });
});
