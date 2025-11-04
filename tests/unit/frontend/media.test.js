/**
 * Unit Tests for Media Module
 *
 * Tests Cloudinary media library browsing, uploading, and pagination functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadMedia,
  renderMediaGrid,
  updateMediaPagination,
  changeMediaPage,
  filterMedia,
  debouncedFilterMedia,
  copyMediaUrl,
  viewMediaFull,
  openCloudinaryUpload
} from '../../../admin/js/modules/media.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Media Module', () => {
  let mockFetch;
  let mockClipboard;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>
      <div id="media-loading" class="">Loading...</div>
      <div id="media-grid"></div>
      <div id="media-empty" class="hidden">No media found</div>
      <input id="media-search" value="" />
      <select id="media-filter"><option value="all">All</option></select>
      <div id="media-pagination" class="hidden">
        <button id="media-prev-btn">Previous</button>
        <span id="media-current-page">1</span> / <span id="media-total-pages">1</span>
        <button id="media-next-btn">Next</button>
      </div>
      <div id="section-media"></div>
      <div id="image-modal-overlay" class="hidden">
        <img id="image-modal-img" src="" />
      </div>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.allMedia = [];
    window.currentMediaPage = 1;
    window.mediaPerPage = 20;
    window.cloudinaryUploadWidget = null;
    window.handleImageModalEscape = vi.fn();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock clipboard
    mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined)
    };
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true
    });

    // Mock cloudinary global
    global.cloudinary = {
      createUploadWidget: vi.fn((config, callback) => ({
        open: vi.fn(),
        close: vi.fn()
      }))
    };

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadMedia', () => {
    it('fetches media from API and updates window.allMedia', async () => {
      const mockMedia = {
        resources: [
          {
            public_id: 'folder/image1',
            secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/folder/image1.jpg',
            resource_type: 'image',
            width: 1920,
            height: 1080,
            bytes: 245760,
            created_at: '2025-10-20T10:00:00Z'
          },
          {
            public_id: 'folder/image2',
            secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/folder/image2.jpg',
            resource_type: 'image',
            width: 800,
            height: 600,
            bytes: 102400,
            created_at: '2025-10-19T10:00:00Z'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMedia
      });

      await loadMedia();

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/media');
      expect(window.allMedia).toEqual(mockMedia.resources);
      expect(window.allMedia.length).toBe(2);
    });

    it('handles empty resources array', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ resources: [] })
      });

      await loadMedia();

      expect(window.allMedia).toEqual([]);
    });

    it('handles missing resources property', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await loadMedia();

      expect(window.allMedia).toEqual([]);
    });

    it('shows error when API fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await loadMedia();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadMedia();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('hides loading indicator after load', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ resources: [] })
      });

      const loadingEl = document.getElementById('media-loading');
      loadingEl.classList.remove('hidden');

      await loadMedia();

      expect(loadingEl.classList.contains('hidden')).toBe(true);
    });

    it('hides loading indicator even on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const loadingEl = document.getElementById('media-loading');
      loadingEl.classList.remove('hidden');

      await loadMedia();

      expect(loadingEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('renderMediaGrid', () => {
    const mockMediaItems = [
      {
        public_id: 'folder/recent-image',
        secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/folder/recent-image.jpg',
        resource_type: 'image',
        width: 1920,
        height: 1080,
        bytes: 245760,
        created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() // 2 days ago
      },
      {
        public_id: 'folder/old-image',
        secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/folder/old-image.jpg',
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 102400,
        created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days ago
      },
      {
        public_id: 'folder/video',
        secure_url: 'https://res.cloudinary.com/circleseven/video/upload/v1234567890/folder/video.mp4',
        resource_type: 'video',
        width: 1280,
        height: 720,
        bytes: 1048576,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];

    beforeEach(() => {
      window.allMedia = [...mockMediaItems];
      window.currentMediaPage = 1;
      window.mediaPerPage = 20;
    });

    it('renders media grid with all items', () => {
      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      expect(grid.children.length).toBe(3);
      expect(grid.innerHTML).toContain('recent-image');
      expect(grid.innerHTML).toContain('old-image');
      expect(grid.innerHTML).toContain('video');
    });

    it('sorts media by most recent first', () => {
      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      const html = grid.innerHTML;

      // Most recent should appear before older items
      const recentPos = html.indexOf('recent-image');
      const oldPos = html.indexOf('old-image');
      expect(recentPos).toBeLessThan(oldPos);
    });

    it('filters media by search term', () => {
      document.getElementById('media-search').value = 'video';

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      expect(grid.innerHTML).toContain('video');
      expect(grid.innerHTML).not.toContain('recent-image');
    });

    it('filters media by type (images only)', () => {
      const filterEl = document.getElementById('media-filter');
      filterEl.innerHTML = `
        <option value="all">All</option>
        <option value="images" selected>Images</option>
        <option value="recent">Recent</option>
      `;
      filterEl.value = 'images';

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      // Should show images
      expect(grid.children.length).toBe(2);
      const filenames = grid.textContent;
      expect(filenames).toContain('recent-image');
      expect(filenames).toContain('old-image');
    });

    it('filters media by recent uploads (last 7 days)', () => {
      const filterEl = document.getElementById('media-filter');
      filterEl.innerHTML = `
        <option value="all">All</option>
        <option value="images">Images</option>
        <option value="recent" selected>Recent</option>
      `;
      filterEl.value = 'recent';

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      expect(grid.innerHTML).toContain('recent-image');
      expect(grid.innerHTML).not.toContain('old-image');
    });

    it('shows empty state when no media matches', () => {
      document.getElementById('media-search').value = 'nonexistent';

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      const emptyEl = document.getElementById('media-empty');

      expect(grid.innerHTML).toBe('');
      expect(emptyEl.classList.contains('hidden')).toBe(false);
    });

    it('hides empty state when media exists', () => {
      const emptyEl = document.getElementById('media-empty');
      emptyEl.classList.remove('hidden');

      renderMediaGrid();

      expect(emptyEl.classList.contains('hidden')).toBe(true);
    });

    it('escapes HTML in filenames', () => {
      window.allMedia = [{
        public_id: 'folder/<script>alert("XSS")</script>',
        secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/folder/image.jpg',
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 102400,
        created_at: new Date().toISOString()
      }];

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      // Should not contain executable script
      expect(grid.querySelector('script')).toBeNull();
    });

    it('displays file dimensions and size', () => {
      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      expect(grid.innerHTML).toContain('1920 × 1080');
      expect(grid.innerHTML).toContain('240.0 KB');
    });

    it('generates thumbnail URLs with transformations', () => {
      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      expect(grid.innerHTML).toContain('/upload/w_300,h_300,c_fill/');
    });

    it('paginates media when more than mediaPerPage items', () => {
      // Create 25 items
      window.allMedia = Array.from({ length: 25 }, (_, i) => ({
        public_id: `image-${i}`,
        secure_url: `https://cloudinary.com/image-${i}.jpg`,
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 102400,
        created_at: new Date().toISOString()
      }));
      window.mediaPerPage = 20;
      window.currentMediaPage = 1;

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      // Should only show first 20 items
      expect(grid.children.length).toBe(20);
    });

    it('shows correct page of paginated media', () => {
      window.allMedia = Array.from({ length: 25 }, (_, i) => ({
        public_id: `image-${i}`,
        secure_url: `https://cloudinary.com/image-${i}.jpg`,
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 102400,
        created_at: new Date().toISOString()
      }));
      window.mediaPerPage = 20;
      window.currentMediaPage = 2;

      renderMediaGrid();

      const grid = document.getElementById('media-grid');
      // Page 2 should show remaining 5 items
      expect(grid.children.length).toBe(5);
    });
  });

  describe('updateMediaPagination', () => {
    it('hides pagination when only one page', () => {
      const paginationEl = document.getElementById('media-pagination');
      paginationEl.classList.remove('hidden');

      updateMediaPagination(1);

      expect(paginationEl.classList.contains('hidden')).toBe(true);
    });

    it('shows pagination when multiple pages', () => {
      const paginationEl = document.getElementById('media-pagination');

      updateMediaPagination(3);

      expect(paginationEl.classList.contains('hidden')).toBe(false);
    });

    it('updates page numbers', () => {
      window.currentMediaPage = 2;

      updateMediaPagination(5);

      const currentPageEl = document.getElementById('media-current-page');
      const totalPagesEl = document.getElementById('media-total-pages');

      expect(currentPageEl.textContent).toBe('2');
      expect(totalPagesEl.textContent).toBe('5');
    });

    it('disables prev button on first page', () => {
      window.currentMediaPage = 1;

      updateMediaPagination(3);

      const prevBtn = document.getElementById('media-prev-btn');
      expect(prevBtn.disabled).toBe(true);
    });

    it('enables prev button when not on first page', () => {
      window.currentMediaPage = 2;

      updateMediaPagination(3);

      const prevBtn = document.getElementById('media-prev-btn');
      expect(prevBtn.disabled).toBe(false);
    });

    it('disables next button on last page', () => {
      window.currentMediaPage = 3;

      updateMediaPagination(3);

      const nextBtn = document.getElementById('media-next-btn');
      expect(nextBtn.disabled).toBe(true);
    });

    it('enables next button when not on last page', () => {
      window.currentMediaPage = 2;

      updateMediaPagination(3);

      const nextBtn = document.getElementById('media-next-btn');
      expect(nextBtn.disabled).toBe(false);
    });
  });

  describe('changeMediaPage', () => {
    it('increments page by delta', () => {
      window.currentMediaPage = 2;
      window.allMedia = Array.from({ length: 50 }, () => ({
        public_id: 'test',
        secure_url: 'test.jpg',
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 100000,
        created_at: new Date().toISOString()
      }));

      changeMediaPage(1);

      expect(window.currentMediaPage).toBe(3);
    });

    it('decrements page by negative delta', () => {
      window.currentMediaPage = 3;

      changeMediaPage(-1);

      expect(window.currentMediaPage).toBe(2);
    });

    it('scrolls to media section', () => {
      const section = document.getElementById('section-media');
      const scrollSpy = vi.spyOn(section, 'scrollIntoView');

      changeMediaPage(1);

      expect(scrollSpy).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'start'
      });
    });
  });

  describe('filterMedia', () => {
    it('resets to first page', () => {
      window.currentMediaPage = 5;

      filterMedia();

      expect(window.currentMediaPage).toBe(1);
    });

    it('re-renders media grid', () => {
      window.allMedia = [{
        public_id: 'test',
        secure_url: 'test.jpg',
        resource_type: 'image',
        width: 800,
        height: 600,
        bytes: 100000,
        created_at: new Date().toISOString()
      }];

      filterMedia();

      const grid = document.getElementById('media-grid');
      expect(grid.innerHTML).toContain('test');
    });
  });

  describe('debouncedFilterMedia', () => {
    it('is a debounced function', () => {
      expect(typeof debouncedFilterMedia).toBe('function');
    });
  });

  describe('copyMediaUrl', () => {
    it('copies URL to clipboard', async () => {
      const url = 'https://cloudinary.com/image.jpg';

      await copyMediaUrl(url);

      expect(mockClipboard.writeText).toHaveBeenCalledWith(url);
    });

    it('shows success message after copying', async () => {
      await copyMediaUrl('https://cloudinary.com/image.jpg');

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('copied');
    });

    it('shows error when clipboard write fails', async () => {
      mockClipboard.writeText.mockRejectedValue(new Error('Permission denied'));

      await copyMediaUrl('https://cloudinary.com/image.jpg');

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('viewMediaFull', () => {
    it('sets modal image source', () => {
      const url = 'https://cloudinary.com/full-size.jpg';

      viewMediaFull(url);

      const modalImg = document.getElementById('image-modal-img');
      expect(modalImg.src).toBe(url);
    });

    it('shows modal overlay', () => {
      const modalOverlay = document.getElementById('image-modal-overlay');
      modalOverlay.classList.add('hidden');

      viewMediaFull('https://cloudinary.com/image.jpg');

      expect(modalOverlay.classList.contains('hidden')).toBe(false);
    });

    it('attaches keyboard escape handler', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      viewMediaFull('https://cloudinary.com/image.jpg');

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        'keydown',
        window.handleImageModalEscape
      );
    });
  });

  describe('openCloudinaryUpload', () => {
    it('shows error when Cloudinary library not loaded', () => {
      global.cloudinary = undefined;

      openCloudinaryUpload();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('still loading');
    });

    it('creates upload widget on first use', () => {
      openCloudinaryUpload();

      expect(global.cloudinary.createUploadWidget).toHaveBeenCalled();
      expect(window.cloudinaryUploadWidget).toBeDefined();
    });

    it('reuses existing widget on subsequent calls', () => {
      const mockWidget = { open: vi.fn() };
      window.cloudinaryUploadWidget = mockWidget;

      openCloudinaryUpload();

      expect(global.cloudinary.createUploadWidget).not.toHaveBeenCalled();
      expect(mockWidget.open).toHaveBeenCalled();
    });

    it('opens widget', () => {
      const mockWidget = { open: vi.fn(), close: vi.fn() };
      global.cloudinary.createUploadWidget.mockReturnValue(mockWidget);

      openCloudinaryUpload();

      expect(mockWidget.open).toHaveBeenCalled();
    });

    it('configures widget with correct settings', () => {
      openCloudinaryUpload();

      expect(global.cloudinary.createUploadWidget).toHaveBeenCalledWith(
        expect.objectContaining({
          cloudName: 'circleseven',
          uploadPreset: 'ml_default',
          multiple: true,
          maxFiles: 10,
          resourceType: 'image'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Integration - Complete Media Workflow', () => {
    it('can load, search, and paginate media', async () => {
      // Load media
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          resources: Array.from({ length: 50 }, (_, i) => ({
            public_id: `image-${i}`,
            secure_url: `https://cloudinary.com/image-${i}.jpg`,
            resource_type: 'image',
            width: 800,
            height: 600,
            bytes: 100000,
            created_at: new Date().toISOString()
          }))
        })
      });

      await loadMedia();
      expect(window.allMedia.length).toBe(50);

      // Render first page
      renderMediaGrid();
      let grid = document.getElementById('media-grid');
      expect(grid.children.length).toBe(20);

      // Search
      document.getElementById('media-search').value = 'image-1';
      filterMedia();
      grid = document.getElementById('media-grid');
      expect(grid.children.length).toBeLessThan(20); // Filtered results

      // Clear search
      document.getElementById('media-search').value = '';
      filterMedia();

      // Go to next page
      changeMediaPage(1);
      expect(window.currentMediaPage).toBe(2);
    });

    it('can copy URL and view full size', async () => {
      const url = 'https://cloudinary.com/test.jpg';

      // Copy URL
      await copyMediaUrl(url);
      expect(mockClipboard.writeText).toHaveBeenCalledWith(url);

      // View full size
      viewMediaFull(url);
      const modalImg = document.getElementById('image-modal-img');
      expect(modalImg.src).toBe(url);
    });
  });
});
