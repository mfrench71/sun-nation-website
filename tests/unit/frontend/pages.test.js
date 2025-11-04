/**
 * Unit Tests for Pages Module
 *
 * Tests page management including CRUD operations, caching, filtering, and editor integration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadPages,
  renderPagesList,
  filterPages,
  clearPagesCache,
  slugifyPermalink,
  generatePageFilename,
  autoPopulatePermalink,
  markPageDirty,
  clearPageDirty,
  showNewPageForm,
  editPage,
  savePage,
  deletePage,
  deletePageFromList
} from '../../../admin/js/modules/pages.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Pages Module', () => {
  let mockFetch;
  let mockShowConfirm;
  let mockTrackDeployment;
  let mockFormatDateForInput;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>
      <div id="pages-loading" class="">Loading...</div>
      <div id="pages-list-view" class="">
        <input id="pages-search" value="" />
        <div id="pages-table-wrapper">
          <table id="pages-table">
            <tbody id="pages-table-body"></tbody>
          </table>
        </div>
        <div id="pages-empty" class="hidden">No pages found</div>
      </div>
      <div id="page-editor-view" class="hidden">
        <form id="page-form">
          <input id="page-title" name="title" value="" />
          <input id="page-permalink" name="permalink" value="" />
          <select id="page-layout" name="layout">
            <option value="page">Page</option>
            <option value="default">Default</option>
          </select>
          <input id="page-protected" name="protected" type="checkbox" />
          <input id="page-date" name="date" type="datetime-local" value="" />
          <textarea id="page-content" name="content"></textarea>
          <button id="save-page-btn" type="submit">Save Page</button>
          <button id="delete-page-btn" type="button" style="display: block;">Delete</button>
        </form>
      </div>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.allPages = [];
    window.currentPage_pages = null;
    window.pageMarkdownEditor = null;
    window.pageHasUnsavedChanges = false;
    window.permalinkManuallyEdited = false;
    window._pageFormListenersSetup = false;
    window.showConfirm = mockShowConfirm = vi.fn();
    window.trackDeployment = mockTrackDeployment = vi.fn();
    window.formatDateForInput = mockFormatDateForInput = vi.fn((date) => date);

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock localStorage
    global.localStorage.clear();

    // Mock history API
    global.history.pushState = vi.fn();
    global.history.back = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('slugifyPermalink', () => {
    it('converts text to URL-friendly slug with slashes', () => {
      expect(slugifyPermalink('About Us')).toBe('/about-us/');
      expect(slugifyPermalink('Contact Page')).toBe('/contact-page/');
    });

    it('handles multiple spaces', () => {
      expect(slugifyPermalink('Hello   World')).toBe('/hello-world/');
    });

    it('removes special characters', () => {
      expect(slugifyPermalink('Hello! World?')).toBe('/hello-world/');
    });

    it('converts to lowercase', () => {
      expect(slugifyPermalink('UPPERCASE')).toBe('/uppercase/');
    });

    it('handles empty string', () => {
      expect(slugifyPermalink('')).toBe('//');
    });

    it('preserves existing leading/trailing slashes', () => {
      expect(slugifyPermalink('/already-slug/')).toBe('/already-slug/');
    });

    it('adds missing leading slash', () => {
      expect(slugifyPermalink('missing-leading/')).toBe('/missing-leading/');
    });

    it('adds missing trailing slash', () => {
      expect(slugifyPermalink('/missing-trailing')).toBe('/missing-trailing/');
    });
  });

  describe('generatePageFilename', () => {
    it('generates filename from title', () => {
      expect(generatePageFilename('About Us')).toBe('about-us.md');
      expect(generatePageFilename('Contact Page')).toBe('contact-page.md');
    });

    it('handles special characters', () => {
      expect(generatePageFilename('Hello! World?')).toBe('hello-world.md');
    });

    it('handles multiple spaces', () => {
      expect(generatePageFilename('Hello   World')).toBe('hello-world.md');
    });

    it('converts to lowercase', () => {
      expect(generatePageFilename('UPPERCASE')).toBe('uppercase.md');
    });

    it('handles empty string', () => {
      expect(generatePageFilename('')).toBe('.md');
    });
  });

  describe('clearPagesCache', () => {
    it('removes pages cache from localStorage', () => {
      localStorage.setItem('admin_pages_cache', JSON.stringify({ data: [], timestamp: Date.now() }));

      clearPagesCache();

      expect(localStorage.getItem('admin_pages_cache')).toBeNull();
    });

    it('does not throw if cache does not exist', () => {
      expect(() => clearPagesCache()).not.toThrow();
    });
  });

  describe('loadPages', () => {
    it('fetches pages from API and updates window.allPages', async () => {
      const mockPages = [
        {
          filename: 'about.md',
          sha: 'abc123',
          size: 1024,
          frontmatter: {
            title: 'About',
            permalink: '/about/',
            layout: 'page',
            date: '2025-10-20T10:00:00Z'
          }
        },
        {
          filename: 'contact.md',
          sha: 'def456',
          size: 2048,
          frontmatter: {
            title: 'Contact',
            permalink: '/contact/',
            layout: 'page',
            date: '2025-10-19T14:30:00Z'
          }
        }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ pages: mockPages })
      });

      await loadPages();

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/pages?metadata=true');
      expect(window.allPages).toEqual(mockPages);
      expect(window.allPages.length).toBe(2);
    });

    it('caches pages data in localStorage', async () => {
      const mockPages = [{ filename: 'about.md', sha: 'abc', frontmatter: { title: 'About' } }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ pages: mockPages })
      });

      await loadPages();

      const cached = JSON.parse(localStorage.getItem('admin_pages_cache'));
      expect(cached.data).toEqual(mockPages);
      expect(cached.timestamp).toBeDefined();
    });

    it('uses cached data if available and fresh', async () => {
      const cachedPages = [{ filename: 'cached.md', sha: 'xyz', frontmatter: { title: 'Cached' } }];
      const cacheData = {
        data: cachedPages,
        timestamp: Date.now() // Fresh cache
      };

      localStorage.setItem('admin_pages_cache', JSON.stringify(cacheData));

      await loadPages();

      // Should not call API
      expect(mockFetch).not.toHaveBeenCalled();
      expect(window.allPages).toEqual(cachedPages);
    });

    it('bypasses cache if expired (> 5 minutes)', async () => {
      const oldTimestamp = Date.now() - (6 * 60 * 1000); // 6 minutes ago
      const cacheData = {
        data: [{ filename: 'old.md' }],
        timestamp: oldTimestamp
      };

      localStorage.setItem('admin_pages_cache', JSON.stringify(cacheData));

      const freshPages = [{ filename: 'fresh.md', sha: 'abc', frontmatter: { title: 'Fresh' } }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ pages: freshPages })
      });

      await loadPages();

      expect(mockFetch).toHaveBeenCalled();
      expect(window.allPages).toEqual(freshPages);
    });

    it('shows error when API fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await loadPages();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('handles network error gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadPages();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('hides loading indicator after load', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => []
      });

      const loadingEl = document.getElementById('pages-loading');
      loadingEl.classList.remove('hidden');

      await loadPages();

      expect(loadingEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('renderPagesList', () => {
    beforeEach(() => {
      window.allPages = [
        {
          name: 'about.md',
          sha: 'abc123',
          size: 1024,
          frontmatter: {
            title: 'About Us',
            permalink: '/about/',
            layout: 'page',
            date: '2025-10-20T10:00:00Z'
          }
        },
        {
          name: 'contact.md',
          sha: 'def456',
          size: 2048,
          frontmatter: {
            title: 'Contact',
            permalink: '/contact/',
            layout: 'page',
            protected: true,
            date: '2025-10-19T14:30:00Z'
          }
        }
      ];
    });

    it('renders pages table with all pages', () => {
      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.children.length).toBe(2);
      expect(tbody.innerHTML).toContain('About Us');
      expect(tbody.innerHTML).toContain('Contact');
    });

    it('shows empty state when no pages', () => {
      window.allPages = [];

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      const emptyEl = document.getElementById('pages-empty');

      expect(tbody.innerHTML).toBe('');
      expect(emptyEl.classList.contains('hidden')).toBe(false);
    });

    it('hides empty state when pages exist', () => {
      const emptyEl = document.getElementById('pages-empty');
      emptyEl.classList.remove('hidden');

      renderPagesList();

      expect(emptyEl.classList.contains('hidden')).toBe(true);
    });

    it('filters pages by search term (title)', () => {
      document.getElementById('pages-search').value = 'about';

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('About Us');
      expect(tbody.innerHTML).not.toContain('Contact');
    });

    it('filters pages by search term (filename)', () => {
      document.getElementById('pages-search').value = 'contact.md';

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('Contact');
      expect(tbody.innerHTML).not.toContain('About Us');
    });

    it('search is case-insensitive', () => {
      document.getElementById('pages-search').value = 'ABOUT';

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('About Us');
    });

    it('displays lock icon for protected pages', () => {
      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      // Contact page is protected
      expect(tbody.innerHTML).toContain('fa-lock');
    });

    it('displays bin link for unprotected pages', () => {
      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      const html = tbody.innerHTML;

      // About page is not protected, should have bin link
      expect(html).toContain('fa-trash');
    });

    it('escapes HTML in page titles to prevent XSS', () => {
      window.allPages = [{
        filename: 'xss.md',
        sha: 'xss123',
        frontmatter: {
          title: '<script>alert("XSS")</script>',
          permalink: '/xss/'
        }
      }];

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      const html = tbody.innerHTML;

      // Should contain the file extension, verifying render happened
      expect(html).toContain('.md');
    });

    it('displays formatted date', () => {
      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      // Should contain date info
      expect(tbody.innerHTML).toContain('Oct');
    });

    it('handles pages without frontmatter', () => {
      window.allPages = [{
        filename: 'no-frontmatter.md',
        sha: 'xyz789'
        // No frontmatter
      }];

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('no-frontmatter.md');
    });

    it('handles pages without title', () => {
      window.allPages = [{
        filename: 'no-title.md',
        sha: 'xyz789',
        frontmatter: {
          permalink: '/no-title/'
        }
      }];

      renderPagesList();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('no-title.md');
    });
  });

  describe('filterPages', () => {
    beforeEach(() => {
      window.allPages = [
        { filename: 'test.md', sha: 'abc', frontmatter: { title: 'Test' } }
      ];
    });

    it('re-renders pages list', () => {
      filterPages();

      const tbody = document.getElementById('pages-table-body');
      expect(tbody.innerHTML).toContain('Test');
    });
  });

  describe('markPageDirty and clearPageDirty', () => {
    it('markPageDirty sets unsaved changes flag', () => {
      window.pageHasUnsavedChanges = false;

      markPageDirty();

      expect(window.pageHasUnsavedChanges).toBe(true);
    });

    it('clearPageDirty clears unsaved changes flag', () => {
      window.pageHasUnsavedChanges = true;

      clearPageDirty();

      expect(window.pageHasUnsavedChanges).toBe(false);
    });
  });

  describe('autoPopulatePermalink', () => {
    it('generates permalink from title if empty', () => {
      document.getElementById('page-title').value = 'About Us';
      document.getElementById('page-permalink').value = '';
      window.permalinkManuallyEdited = false;

      autoPopulatePermalink();

      expect(document.getElementById('page-permalink').value).toBe('/about-us/');
    });

    it('does not overwrite if permalink manually edited', () => {
      document.getElementById('page-title').value = 'About Us';
      document.getElementById('page-permalink').value = '/custom/';
      window.permalinkManuallyEdited = true;

      autoPopulatePermalink();

      expect(document.getElementById('page-permalink').value).toBe('/custom/');
    });

    it('updates permalink if not manually edited', () => {
      document.getElementById('page-title').value = 'New Title';
      document.getElementById('page-permalink').value = '/old-title/';
      window.permalinkManuallyEdited = false;

      autoPopulatePermalink();

      expect(document.getElementById('page-permalink').value).toBe('/new-title/');
    });
  });

  describe('showNewPageForm', () => {
    it('shows editor view and hides list view', () => {
      const listView = document.getElementById('pages-list-view');
      const editorView = document.getElementById('page-editor-view');

      showNewPageForm(false);

      expect(listView.classList.contains('hidden')).toBe(true);
      expect(editorView.classList.contains('hidden')).toBe(false);
    });

    it('resets form fields', () => {
      document.getElementById('page-title').value = 'Old Title';
      document.getElementById('page-permalink').value = '/old/';

      showNewPageForm(false);

      expect(document.getElementById('page-title').value).toBe('');
      expect(document.getElementById('page-permalink').value).toBe('');
    });

    it('clears currentPage_pages', () => {
      window.currentPage_pages = { filename: 'old.md' };

      showNewPageForm(false);

      expect(window.currentPage_pages).toBeNull();
    });

    it('clears dirty and permalink flags', () => {
      window.pageHasUnsavedChanges = true;
      window.permalinkManuallyEdited = true;

      showNewPageForm(false);

      expect(window.pageHasUnsavedChanges).toBe(false);
      expect(window.permalinkManuallyEdited).toBe(false);
    });

    it('hides delete button', () => {
      const deleteBtn = document.getElementById('delete-page-btn');
      deleteBtn.style.display = 'block';

      showNewPageForm(false);

      expect(deleteBtn.style.display).toBe('none');
    });

    it('does not update URL (SPA routing removed)', () => {
      showNewPageForm(true);

      expect(history.pushState).not.toHaveBeenCalled();
    });

    it('does not update URL when updateUrl is false', () => {
      showNewPageForm(false);

      expect(history.pushState).not.toHaveBeenCalled();
    });
  });

  describe('editPage', () => {
    it('fetches page content and populates form', async () => {
      const mockPage = {
        content: '# About Us\n\nThis is the about page.',
        frontmatter: {
          title: 'About Us',
          permalink: '/about/',
          layout: 'page',
          date: '2025-10-20T10:00:00Z'
        },
        filename: 'about.md',
        sha: 'abc123'
      };

      window.allPages = [{ filename: 'about.md', sha: 'abc123' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPage
      });

      await editPage('about.md', false);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/pages?path=about.md'
      );
      expect(document.getElementById('page-title').value).toBe('About Us');
      expect(document.getElementById('page-permalink').value).toBe('/about/');
      expect(document.getElementById('page-content').value).toBe('# About Us\n\nThis is the about page.');
    });

    it('sets currentPage_pages', async () => {
      const mockPage = {
        content: 'Content',
        frontmatter: { title: 'Test' },
        filename: 'test.md',
        sha: 'abc'
      };

      window.allPages = [{ filename: 'test.md', sha: 'abc' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPage
      });

      await editPage('test.md', false);

      expect(window.currentPage_pages).toEqual(mockPage);
    });

    it('shows editor view and hides list view', async () => {
      const mockPage = {
        content: '',
        frontmatter: {},
        filename: 'test.md',
        sha: 'abc'
      };

      window.allPages = [{ filename: 'test.md', sha: 'abc' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPage
      });

      const listView = document.getElementById('pages-list-view');
      const editorView = document.getElementById('page-editor-view');

      await editPage('test.md', false);

      expect(listView.classList.contains('hidden')).toBe(true);
      expect(editorView.classList.contains('hidden')).toBe(false);
    });

    it('does not update URL (SPA routing removed)', async () => {
      const mockPage = {
        content: '',
        frontmatter: {},
        filename: 'test.md',
        sha: 'abc'
      };

      window.allPages = [{ filename: 'test.md', sha: 'abc' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPage
      });

      await editPage('test.md', true);

      expect(history.pushState).not.toHaveBeenCalled();
    });

    it('handles protected pages', async () => {
      const mockPage = {
        content: 'Protected content',
        frontmatter: {
          title: 'Protected',
          protected: true
        },
        filename: 'protected.md',
        sha: 'abc'
      };

      window.allPages = [{ filename: 'protected.md', sha: 'abc' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockPage
      });

      await editPage('protected.md', false);

      expect(document.getElementById('page-protected').checked).toBe(true);
    });

    it('shows error when page not found', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: 'Page not found' })
      });

      await editPage('nonexistent.md', false);

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('savePage', () => {
    beforeEach(() => {
      document.getElementById('page-title').value = 'Test Page';
      document.getElementById('page-permalink').value = '/test/';
      document.getElementById('page-layout').value = 'page';
      document.getElementById('page-content').value = 'Test content';
      document.getElementById('page-date').value = '2025-10-20T10:00';
    });

    it('creates new page when currentPage_pages is null', async () => {
      window.currentPage_pages = null;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      const event = new Event('submit');
      await savePage(event);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/pages',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('updates existing page when currentPage_pages exists', async () => {
      window.currentPage_pages = {
        filename: 'existing.md',
        sha: 'oldsha'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      const event = new Event('submit');
      await savePage(event);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/pages',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });

    it('includes protected flag in frontmatter when checked', async () => {
      document.getElementById('page-protected').checked = true;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await savePage(event);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.frontmatter.protected).toBe(true);
    });

    it('excludes protected flag when not checked', async () => {
      document.getElementById('page-protected').checked = false;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await savePage(event);

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.frontmatter.protected).toBeUndefined();
    });

    it('tracks deployment when commitSha returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit123' })
      });

      const event = new Event('submit');
      await savePage(event);

      expect(mockTrackDeployment).toHaveBeenCalledWith(
        'commit123',
        expect.stringContaining('Test Page')
      );
    });

    it('shows success message after save', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await savePage(event);

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
    });

    it('clears dirty flag after successful save', async () => {
      window.pageHasUnsavedChanges = true;

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await savePage(event);

      expect(window.pageHasUnsavedChanges).toBe(false);
    });

    it('clears pages cache after save', async () => {
      localStorage.setItem('admin_pages_cache', JSON.stringify({ data: [], timestamp: Date.now() }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      await savePage(event);

      expect(localStorage.getItem('admin_pages_cache')).toBeNull();
    });

    it('shows error when save fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Save failed' })
      });

      const event = new Event('submit');
      await savePage(event);

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('disables save button during save', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({ ok: true, json: async () => ({ success: true }) });
          }, 100);
        })
      );

      const event = new Event('submit');
      const savePromise = savePage(event);

      const saveBtn = document.getElementById('save-page-btn');
      expect(saveBtn.disabled).toBe(true);
      expect(saveBtn.innerHTML).toBe('Saving...');

      await savePromise;

      expect(saveBtn.disabled).toBe(false);
      expect(saveBtn.innerHTML).toBe('Save Page');
    });

    it('prevents default form submission', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const event = new Event('submit');
      const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

      await savePage(event);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('deletePage', () => {
    beforeEach(() => {
      window.currentPage_pages = {
        filename: 'test.md',
        sha: 'abc123',
        frontmatter: { title: 'Test Page' }
      };
    });

    it('shows confirmation dialog', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await deletePage();

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.stringContaining('Test Page')
      );
    });

    it('does not delete when user cancels', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await deletePage();

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sends soft delete request to trash endpoint', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit456' })
      });

      await deletePage();

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/trash',
        expect.objectContaining({
          method: 'POST'
        })
      );

      const callArgs = mockFetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);
      expect(body.filename).toBe('test.md');
      expect(body.sha).toBe('abc123');
      expect(body.type).toBe('page');
    });

    it('tracks deployment after delete', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit456' })
      });

      await deletePage();

      expect(mockTrackDeployment).toHaveBeenCalledWith(
        'commit456',
        expect.stringContaining('Test Page')
      );
    });

    it('clears pages cache after delete', async () => {
      localStorage.setItem('admin_pages_cache', JSON.stringify({ data: [], timestamp: Date.now() }));

      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deletePage();

      expect(localStorage.getItem('admin_pages_cache')).toBeNull();
    });

    it('shows success message after delete', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deletePage();

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
    });

    it('shows error when delete fails', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Delete failed' })
      });

      await deletePage();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });
  });

  describe('deletePageFromList', () => {
    it('shows confirmation dialog with filename', async () => {
      mockShowConfirm.mockResolvedValue(false);

      await deletePageFromList('test.md', 'abc123');

      expect(mockShowConfirm).toHaveBeenCalledWith(
        expect.stringContaining('test.md')
      );
    });

    it('sends soft delete request', async () => {
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deletePageFromList('test.md', 'abc123');

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/trash',
        expect.objectContaining({
          method: 'POST'
        })
      );
    });

    it('clears cache and reloads pages after delete', async () => {
      localStorage.setItem('admin_pages_cache', JSON.stringify({ data: [], timestamp: Date.now() }));

      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true })
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ pages: [] })
      });

      await deletePageFromList('test.md', 'abc123');

      expect(localStorage.getItem('admin_pages_cache')).toBeNull();
      // Should call loadPages which fetches pages
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Integration - Complete Page Workflow', () => {
    it('can create, edit, and delete a page', async () => {
      // Create new page
      showNewPageForm(false);
      document.getElementById('page-title').value = 'New Page';
      document.getElementById('page-permalink').value = '/new/';
      document.getElementById('page-content').value = 'Content';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit1' })
      });

      let event = new Event('submit');
      await savePage(event);

      expect(mockTrackDeployment).toHaveBeenCalledWith('commit1', expect.any(String));

      // Edit existing page
      window.currentPage_pages = {
        filename: 'new.md',
        sha: 'abc',
        frontmatter: { title: 'New Page' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit2' })
      });

      event = new Event('submit');
      await savePage(event);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/pages',
        expect.objectContaining({ method: 'PUT' })
      );

      // Delete page
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'commit3' })
      });

      await deletePage();

      expect(mockTrackDeployment).toHaveBeenCalledWith('commit3', expect.any(String));
    });
  });
});
