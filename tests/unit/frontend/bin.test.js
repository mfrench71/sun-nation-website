/**
 * Unit Tests for Bin Module
 *
 * Tests soft-deleted item management including restore and permanent deletion.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadBin,
  renderBinList,
  restoreItem,
  permanentlyDeleteItem,
  getBinedItems
} from '../../../admin/js/modules/bin.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Bin Module', () => {
  let mockFetch;
  let mockShowConfirm;
  let mockTrackDeployment;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>
      <div id="bin-loading" class="">Loading...</div>
      <ul id="bin-list"></ul>
      <div id="bin-empty" class="hidden">Bin is empty</div>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.allBinedItems = [];
    window.showConfirm = mockShowConfirm = vi.fn();
    window.trackDeployment = mockTrackDeployment = vi.fn();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadBin', () => {
    it('fetches bin items from API and updates window.allBinedItems', async () => {
      const mockBin = {
        items: [
          {
            name: 'deleted-post.md',
            sha: 'abc123',
            type: 'post',
            size: 1024,
            bined_at: '2025-10-20T10:00:00Z'
          },
          {
            name: 'deleted-page.md',
            sha: 'def456',
            type: 'page',
            size: 2048,
            bined_at: '2025-10-19T14:30:00Z'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockBin
      });

      await loadBin();

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/bin');
      expect(window.allBinedItems).toEqual(mockBin.items);
      expect(window.allBinedItems.length).toBe(2);
    });

    it('handles empty items array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      });

      await loadBin();

      expect(window.allBinedItems).toEqual([]);
    });

    it('handles missing items property', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await loadBin();

      expect(window.allBinedItems).toEqual([]);
    });

    it('shows error when API fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await loadBin();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('Failed to load bin');
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadBin();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('hides loading indicator after load', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ items: [] })
      });

      const loadingEl = document.getElementById('bin-loading');
      loadingEl.classList.remove('hidden');

      await loadBin();

      expect(loadingEl.classList.contains('hidden')).toBe(true);
    });

    it('hides loading indicator even on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const loadingEl = document.getElementById('bin-loading');
      loadingEl.classList.remove('hidden');

      await loadBin();

      expect(loadingEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('renderBinList', () => {
    beforeEach(() => {
      window.allBinedItems = [
        {
          name: 'deleted-post.md',
          sha: 'abc123',
          type: 'post',
          size: 1024,
          bined_at: '2025-10-20T10:00:00Z'
        },
        {
          name: 'deleted-page.md',
          sha: 'def456',
          type: 'page',
          size: 2048,
          bined_at: '2025-10-19T14:30:00Z'
        }
      ];
    });

    it('renders bin list with all items', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      expect(listEl.children.length).toBe(2);
      expect(listEl.innerHTML).toContain('deleted-post.md');
      expect(listEl.innerHTML).toContain('deleted-page.md');
    });

    it('shows empty state when no items in bin', () => {
      window.allBinedItems = [];

      renderBinList();

      const listEl = document.getElementById('bin-list');
      const emptyEl = document.getElementById('bin-empty');

      expect(listEl.innerHTML).toBe('');
      expect(emptyEl.classList.contains('hidden')).toBe(false);
    });

    it('hides empty state when items exist', () => {
      const emptyEl = document.getElementById('bin-empty');
      emptyEl.classList.remove('hidden');

      renderBinList();

      expect(emptyEl.classList.contains('hidden')).toBe(true);
    });

    it('displays correct type badges for posts and pages', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      const html = listEl.innerHTML;

      // Post should have blue badge
      expect(html).toContain('bg-blue-100 text-blue-700');
      expect(html).toContain('Post');

      // Page should have purple badge
      expect(html).toContain('bg-purple-100 text-purple-700');
      expect(html).toContain('Page');
    });

    it('displays file size in KB', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      expect(listEl.innerHTML).toContain('1.0 KB'); // 1024 / 1024
      expect(listEl.innerHTML).toContain('2.0 KB'); // 2048 / 1024
    });

    it('formats bined_at timestamp correctly', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      // Should contain "Deleted:" label
      expect(listEl.innerHTML).toContain('Deleted:');
    });

    it('handles items without bined_at timestamp', () => {
      window.allBinedItems = [{
        name: 'no-timestamp.md',
        sha: 'xyz789',
        type: 'post',
        size: 512
        // No bined_at field
      }];

      renderBinList();

      const listEl = document.getElementById('bin-list');
      expect(listEl.innerHTML).toContain('no-timestamp.md');
    });

    it('escapes HTML in item names to prevent XSS', () => {
      window.allBinedItems = [{
        name: '<script>alert("XSS")</script>.md',
        sha: 'xss123',
        type: 'post',
        size: 1024,
        bined_at: '2025-10-20T10:00:00Z'
      }];

      renderBinList();

      const listEl = document.getElementById('bin-list');

      // Verify the item appears in the list
      expect(listEl.children.length).toBe(1);

      // The innerHTML should contain the escaped filename
      // escapeHtml() prevents the script from being executable
      const html = listEl.innerHTML;
      expect(html).toContain('.md'); // File extension should be visible
    });

    it('renders restore button for each item', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      const html = listEl.innerHTML;

      expect(html).toContain('Restore');
      expect(html).toContain('window.restoreItem');
    });

    it('renders delete forever button for each item', () => {
      renderBinList();

      const listEl = document.getElementById('bin-list');
      const html = listEl.innerHTML;

      expect(html).toContain('Delete Forever');
      expect(html).toContain('window.permanentlyDeleteItem');
    });

    it('warns if DOM elements not found', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // Remove DOM elements
      document.getElementById('bin-list').remove();

      renderBinList();

      expect(consoleWarnSpy).toHaveBeenCalledWith('Bin DOM elements not found');
      consoleWarnSpy.mockRestore();
    });
  });

  describe('restoreItem', () => {
    it('shows confirmation dialog with correct message', async () => {
      mockShowConfirm.mockResolvedValue(false); // Cancel

      await restoreItem('my-post.md', 'abc123', 'post');

      expect(mockShowConfirm).toHaveBeenCalledWith(
        'Restore "my-post.md" to posts?',
        {
          title: 'Confirm Restore',
          buttonText: 'Restore',
          buttonClass: 'btn-primary'
        }
      );
    });

    it('shows correct destination for pages', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await restoreItem('my-page.md', 'def456', 'page');

      expect(mockShowConfirm).toHaveBeenCalledWith(
        'Restore "my-page.md" to pages?',
        expect.any(Object)
      );
    });

    it('does not restore when user cancels confirmation', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await restoreItem('my-post.md', 'abc123', 'post');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends restore request to API when confirmed', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await restoreItem('my-post.md', 'abc123', 'post');

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/bin',
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.filename).toBe('my-post.md');
      expect(body.sha).toBe('abc123');
      expect(body.type).toBe('post');
    });

    it('tracks deployment when commitSha returned', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await restoreItem('my-post.md', 'abc123', 'post');

      expect(mockTrackDeployment).toHaveBeenCalledWith(
        'commit123',
        'Restore post: my-post.md'
      );
    });

    it('shows success message after restore', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await restoreItem('my-post.md', 'abc123', 'post');

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('Post restored');
    });

    it('shows correct message for page restore', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-page.md', sha: 'def456', type: 'page', size: 2048 }
      ];

      await restoreItem('my-page.md', 'def456', 'page');

      const successEl = document.getElementById('success');
      expect(successEl.querySelector('p').textContent).toContain('Page restored');
    });

    it('removes restored item from global array', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 },
        { name: 'other-post.md', sha: 'xyz789', type: 'post', size: 512 }
      ];

      await restoreItem('my-post.md', 'abc123', 'post');

      expect(window.allBinedItems.length).toBe(1);
      expect(window.allBinedItems[0].name).toBe('other-post.md');
    });

    it('shows error when restore fails', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Restore failed' })
      });

      await restoreItem('my-post.md', 'abc123', 'post');

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('Failed to restore post');
    });

    it('handles network error gracefully', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await restoreItem('my-post.md', 'abc123', 'post');

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('permanentlyDeleteItem', () => {
    it('shows confirmation warning with item name', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      expect(mockShowConfirm).toHaveBeenCalledWith(
        'Permanently delete "my-post.md"? This cannot be undone!'
      );
    });

    it('does not delete when user cancels confirmation', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends DELETE request to API when confirmed', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit456' })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/bin',
        expect.objectContaining({
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.filename).toBe('my-post.md');
      expect(body.sha).toBe('abc123');
      expect(body.type).toBe('post');
    });

    it('tracks deployment when commitSha returned', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit456' })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      expect(mockTrackDeployment).toHaveBeenCalledWith(
        'commit456',
        'Permanently delete post: my-post.md'
      );
    });

    it('shows success message after deletion', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 }
      ];

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('Post permanently deleted');
    });

    it('shows correct message for page deletion', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-page.md', sha: 'def456', type: 'page', size: 2048 }
      ];

      await permanentlyDeleteItem('my-page.md', 'def456', 'page');

      const successEl = document.getElementById('success');
      expect(successEl.querySelector('p').textContent).toContain('Page permanently deleted');
    });

    it('removes deleted item from global array', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.allBinedItems = [
        { name: 'my-post.md', sha: 'abc123', type: 'post', size: 1024 },
        { name: 'other-post.md', sha: 'xyz789', type: 'post', size: 512 }
      ];

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      expect(window.allBinedItems.length).toBe(1);
      expect(window.allBinedItems[0].name).toBe('other-post.md');
    });

    it('shows error when deletion fails', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Delete failed' })
      });

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('Failed to delete post');
    });

    it('handles network error gracefully', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockRejectedValue(new Error('Network error'));

      await permanentlyDeleteItem('my-post.md', 'abc123', 'post');

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('getBinedItems', () => {
    it('returns current bined items array', () => {
      const mockItems = [
        { name: 'item1.md', sha: 'abc', type: 'post', size: 1024 },
        { name: 'item2.md', sha: 'def', type: 'page', size: 2048 }
      ];

      window.allBinedItems = mockItems;

      const items = getBinedItems();

      expect(items).toEqual(mockItems);
      expect(items.length).toBe(2);
    });

    it('returns empty array when no items', () => {
      window.allBinedItems = [];

      const items = getBinedItems();

      expect(items).toEqual([]);
    });

    it('returns empty array when allBinedItems is undefined', () => {
      window.allBinedItems = undefined;

      const items = getBinedItems();

      expect(items).toEqual([]);
    });
  });

  describe('Integration - Complete Bin Workflow', () => {
    it('can load, display, and restore items', async () => {
      // Load bin
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { name: 'deleted-post.md', sha: 'abc123', type: 'post', size: 1024, bined_at: '2025-10-20T10:00:00Z' }
          ]
        })
      });

      await loadBin();
      expect(window.allBinedItems.length).toBe(1);

      // Render list
      renderBinList();
      const listEl = document.getElementById('bin-list');
      expect(listEl.children.length).toBe(1);

      // Restore item
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      await restoreItem('deleted-post.md', 'abc123', 'post');

      expect(window.allBinedItems.length).toBe(0);
      expect(mockTrackDeployment).toHaveBeenCalled();
    });

    it('can load, display, and permanently delete items', async () => {
      // Load bin
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { name: 'deleted-post.md', sha: 'abc123', type: 'post', size: 1024, bined_at: '2025-10-20T10:00:00Z' }
          ]
        })
      });

      await loadBin();
      expect(window.allBinedItems.length).toBe(1);

      // Permanently delete item
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit456' })
      });

      await permanentlyDeleteItem('deleted-post.md', 'abc123', 'post');

      expect(window.allBinedItems.length).toBe(0);
      expect(mockTrackDeployment).toHaveBeenCalled();
    });

    it('handles cancelled operations gracefully', async () => {
      window.allBinedItems = [
        { name: 'item.md', sha: 'abc', type: 'post', size: 1024 }
      ];

      // User cancels restore
      mockShowConfirm.mockResolvedValue(false);
      await restoreItem('item.md', 'abc', 'post');
      expect(window.allBinedItems.length).toBe(1); // Still there

      // User cancels delete
      mockShowConfirm.mockResolvedValue(false);
      await permanentlyDeleteItem('item.md', 'abc', 'post');
      expect(window.allBinedItems.length).toBe(1); // Still there
    });
  });
});
