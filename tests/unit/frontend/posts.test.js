/**
 * Unit Tests for Posts Module
 *
 * Tests blog post management including CRUD operations, caching, taxonomy,
 * markdown editing, and Cloudinary image integration.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  generateFilename,
  formatDateShort,
  formatDateForInput,
  sortPostsList,
  setMultiSelect,
  getMultiSelectValues,
  loadPosts,
  renderPostsList,
  savePost,
  deletePost,
  editPost,
  showNewPostForm
} from '../../../admin/js/modules/posts.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

// Mock Cloudinary
global.cloudinary = {
  createMediaLibrary: vi.fn((config, handlers) => ({
    show: vi.fn(),
    hide: vi.fn()
  }))
};

// Mock EasyMDE
global.EasyMDE = vi.fn().mockImplementation((config) => ({
  value: vi.fn().mockReturnValue(''),
  toTextArea: vi.fn(),
  codemirror: {
    on: vi.fn()
  }
}));

describe('Posts Module', () => {
  let mockFetch;
  let mockShowConfirm;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>

      <!-- List View -->
      <div id="posts-list-view">
        <div id="posts-loading" class="hidden">Loading...</div>
        <input id="posts-search" type="text" />
        <select id="posts-sort">
          <option value="date-desc">Date (Newest)</option>
          <option value="date-asc">Date (Oldest)</option>
          <option value="title-asc">Title (A-Z)</option>
          <option value="title-desc">Title (Z-A)</option>
        </select>
        <table>
          <tbody id="posts-table-body"></tbody>
        </table>
        <div id="posts-empty" class="hidden">No posts found</div>
        <div id="posts-pagination">
          <button id="posts-prev-btn">Previous</button>
          <span>
            <span id="posts-range-start">1</span>-<span id="posts-range-end">10</span>
            of <span id="posts-total">0</span>
          </span>
          <button id="posts-next-btn">Next</button>
        </div>
      </div>

      <!-- Editor View -->
      <div id="posts-editor-view" class="hidden">
        <h2 id="post-editor-title">New Post</h2>
        <form id="post-form">
          <input id="post-title" type="text" required />
          <input id="post-date" type="datetime-local" required />
          <input id="post-image" type="text" />
          <textarea id="post-content"></textarea>

          <!-- Taxonomy -->
          <input id="post-categories" type="hidden" />
          <input id="categories-input" type="text" />
          <div id="categories-suggestions" class="hidden"></div>
          <div id="categories-selected"></div>

          <input id="post-tags" type="hidden" />
          <input id="tags-input" type="text" />
          <div id="tags-suggestions" class="hidden"></div>
          <div id="tags-selected"></div>

          <button id="save-post-btn" type="submit">Save Post</button>
          <button id="delete-post-btn" type="button" style="display: block;">Delete</button>
        </form>

        <!-- Image Preview -->
        <div id="image-preview" class="hidden">
          <img id="image-preview-img" />
        </div>
      </div>

      <!-- Image Modal -->
      <div id="image-modal-overlay" class="hidden">
        <img id="image-modal-img" />
      </div>
    `;

    // Initialize notifications
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.allPosts = [];
    window.allPostsWithMetadata = [];
    window.currentPost = null;
    window.currentPage = 1;
    window.postsPerPage = 10;
    window.postHasUnsavedChanges = false;
    window.categories = ['Technology', 'Design', 'Business'];
    window.tags = ['javascript', 'css', 'html'];
    window.selectedCategories = [];
    window.selectedTags = [];
    window.taxonomyAutocompleteCleanup = {};
    window.markdownEditor = null;
    window.cloudinaryWidget = null;
    window._postFormListenersSetup = false;

    // Mock functions
    mockShowConfirm = vi.fn();
    window.showConfirm = mockShowConfirm;
    window.trackDeployment = vi.fn();

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock localStorage
    global.localStorage.clear();

    // Mock scrollIntoView
    Element.prototype.scrollIntoView = vi.fn();

    // Mock history API
    window.history.pushState = vi.fn();
    window.history.back = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  describe('Utility Functions', () => {
    describe('generateFilename', () => {
      it('generates filename in YYYY-MM-DD-slug.md format', () => {
        const date = '2025-10-22T10:30:00';
        const title = 'My New Blog Post';

        const filename = generateFilename(title, date);

        expect(filename).toBe('2025-10-22-my-new-blog-post.md');
      });

      it('handles special characters in title', () => {
        const date = '2025-10-22T10:30:00';
        const title = 'Hello World! & Special @#$ Characters';

        const filename = generateFilename(title, date);

        expect(filename).toMatch(/^2025-10-22-[a-z0-9-]+\.md$/);
        expect(filename).not.toContain('!');
        expect(filename).not.toContain('&');
        expect(filename).not.toContain('@');
      });

      it('handles multiple spaces and dashes', () => {
        const date = '2025-10-22T10:30:00';
        const title = 'Multiple   Spaces  -  And - Dashes';

        const filename = generateFilename(title, date);

        expect(filename).toBe('2025-10-22-multiple-spaces-and-dashes.md');
      });

      it('converts to lowercase', () => {
        const date = '2025-10-22T10:30:00';
        const title = 'UPPERCASE Title';

        const filename = generateFilename(title, date);

        expect(filename).toBe('2025-10-22-uppercase-title.md');
      });

      it('handles empty title', () => {
        const date = '2025-10-22T10:30:00';
        const title = '';

        const filename = generateFilename(title, date);

        expect(filename).toMatch(/^2025-10-22-.+\.md$/);
      });

      it('uses date from Date object', () => {
        const date = new Date('2025-12-25T15:45:00');
        const title = 'Christmas Post';

        const filename = generateFilename(title, date);

        expect(filename).toBe('2025-12-25-christmas-post.md');
      });
    });

    describe('formatDateShort', () => {
      it('formats date as DD MMM YYYY', () => {
        const date = new Date('2025-10-22T10:30:00');

        const formatted = formatDateShort(date);

        expect(formatted).toMatch(/^\d{2} \w{3} \d{4}$/);
        expect(formatted).toContain('Oct');
        expect(formatted).toContain('2025');
      });

      it('handles string dates', () => {
        const dateStr = '2025-10-22T10:30:00';

        const formatted = formatDateShort(dateStr);

        expect(formatted).toContain('Oct');
        expect(formatted).toContain('2025');
      });

      it('handles empty/null dates', () => {
        expect(() => formatDateShort(null)).not.toThrow();
        expect(() => formatDateShort(undefined)).not.toThrow();
        expect(() => formatDateShort('')).not.toThrow();
      });
    });

    describe('formatDateForInput', () => {
      it('formats date for datetime-local input (YYYY-MM-DDThh:mm)', () => {
        const date = '2025-10-22T10:30:00';

        const formatted = formatDateForInput(date);

        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(formatted).toBe('2025-10-22T10:30');
      });

      it('handles Date objects', () => {
        const date = new Date('2025-10-22T10:30:00');

        const formatted = formatDateForInput(date);

        expect(formatted).toContain('2025-10-22');
        expect(formatted).toContain('10:30');
      });

      it('pads single-digit values', () => {
        const date = new Date('2025-03-05T09:05:00');

        const formatted = formatDateForInput(date);

        expect(formatted).toBe('2025-03-05T09:05');
      });
    });
  });

  describe('Sorting & Filtering', () => {
    describe('sortPostsList', () => {
      it('sorts by date descending (newest first)', () => {
        const posts = [
          { title: 'Old Post', date: new Date('2025-01-01') },
          { title: 'New Post', date: new Date('2025-12-31') },
          { title: 'Mid Post', date: new Date('2025-06-15') }
        ];

        const sorted = sortPostsList(posts, 'date-desc');

        expect(sorted[0].title).toBe('New Post');
        expect(sorted[2].title).toBe('Old Post');
      });

      it('sorts by date ascending (oldest first)', () => {
        const posts = [
          { title: 'New Post', date: new Date('2025-12-31') },
          { title: 'Old Post', date: new Date('2025-01-01') }
        ];

        const sorted = sortPostsList(posts, 'date-asc');

        expect(sorted[0].title).toBe('Old Post');
        expect(sorted[1].title).toBe('New Post');
      });

      it('sorts by title ascending (A-Z)', () => {
        const posts = [
          { title: 'Zebra Post', date: new Date() },
          { title: 'Apple Post', date: new Date() },
          { title: 'Mango Post', date: new Date() }
        ];

        const sorted = sortPostsList(posts, 'title-asc');

        expect(sorted[0].title).toBe('Apple Post');
        expect(sorted[2].title).toBe('Zebra Post');
      });

      it('sorts by title descending (Z-A)', () => {
        const posts = [
          { title: 'Apple Post', date: new Date() },
          { title: 'Zebra Post', date: new Date() }
        ];

        const sorted = sortPostsList(posts, 'title-desc');

        expect(sorted[0].title).toBe('Zebra Post');
        expect(sorted[1].title).toBe('Apple Post');
      });

      it('handles posts without titles (uses filename)', () => {
        const posts = [
          { name: 'zzz-post.md', date: new Date() },
          { name: 'aaa-post.md', date: new Date() }
        ];

        const sorted = sortPostsList(posts, 'title-asc');

        expect(sorted[0].name).toBe('aaa-post.md');
      });

      it('handles missing dates gracefully', () => {
        const posts = [
          { title: 'No Date Post', date: null },
          { title: 'Has Date Post', date: new Date('2025-10-22') }
        ];

        expect(() => sortPostsList(posts, 'date-desc')).not.toThrow();
      });
    });
  });

  describe('Taxonomy Functions', () => {
    describe('setMultiSelect / getMultiSelectValues', () => {
      it('sets and gets category values', () => {
        setMultiSelect('post-categories', ['Technology', 'Design']);

        const values = getMultiSelectValues('post-categories');

        expect(values).toEqual(['Technology', 'Design']);
        expect(window.selectedCategories).toEqual(['Technology', 'Design']);
      });

      it('sets and gets tag values', () => {
        setMultiSelect('post-tags', ['javascript', 'css']);

        const values = getMultiSelectValues('post-tags');

        expect(values).toEqual(['javascript', 'css']);
        expect(window.selectedTags).toEqual(['javascript', 'css']);
      });

      it('updates hidden input value', () => {
        setMultiSelect('post-categories', ['Tech', 'Design']);

        const input = document.getElementById('post-categories');
        expect(input.value).toBe('Tech,Design');
      });

      it('handles empty values', () => {
        setMultiSelect('post-categories', []);

        const values = getMultiSelectValues('post-categories');
        expect(values).toEqual([]);
      });
    });
  });

  describe('Data Loading', () => {
    describe('loadPosts', () => {
      it('fetches posts from API when cache is empty', async () => {
        const mockPosts = [
          {
            name: '2025-10-22-test-post.md',
            path: '_posts/2025-10-22-test-post.md',
            sha: 'abc123',
            size: 1024
          }
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ posts: mockPosts })
        });

        await loadPosts();

        expect(mockFetch).toHaveBeenCalledWith(
          '/.netlify/functions/posts?metadata=true'
        );
        expect(window.allPosts).toHaveLength(1);
      });

      it('uses cached data when available and fresh', async () => {
        const cachedData = {
          data: [{ name: 'cached-post.md' }],
          timestamp: Date.now()
        };
        localStorage.setItem('admin_posts_cache', JSON.stringify(cachedData));

        await loadPosts();

        expect(mockFetch).not.toHaveBeenCalled();
        expect(window.allPosts).toHaveLength(1);
      });

      it('refetches when cache is expired (>5 minutes)', async () => {
        const cachedData = {
          data: [{ name: 'old-post.md' }],
          timestamp: Date.now() - 400000 // 6+ minutes ago
        };
        localStorage.setItem('admin_posts_cache', JSON.stringify(cachedData));

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ posts: [{ name: 'new-post.md' }] })
        });

        await loadPosts();

        expect(mockFetch).toHaveBeenCalled();
      });

      it('processes dates from frontmatter', async () => {
        const mockPosts = [
          {
            name: '2025-10-22-test.md',
            frontmatter: {
              title: 'Test Post',
              date: '2025-10-22 10:30:00'
            }
          }
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ posts: mockPosts })
        });

        await loadPosts();

        expect(window.allPostsWithMetadata[0].date).toBeInstanceOf(Date);
      });

      it('falls back to filename date when frontmatter missing', async () => {
        const mockPosts = [
          {
            name: '2025-10-22-test.md',
            frontmatter: {}
          }
        ];

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ posts: mockPosts })
        });

        await loadPosts();

        expect(window.allPostsWithMetadata[0].date).toBeInstanceOf(Date);
        expect(window.allPostsWithMetadata[0].date.getFullYear()).toBe(2025);
      });

      it('handles API errors gracefully', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await loadPosts();

        const errorEl = document.getElementById('error');
        expect(errorEl.classList.contains('hidden')).toBe(false);
      });
    });

    describe('renderPostsList', () => {
      beforeEach(() => {
        window.allPostsWithMetadata = [
          {
            name: '2025-10-22-test-post.md',
            title: 'Test Post',
            date: new Date('2025-10-22'),
            categories: ['Technology'],
            sha: 'abc123'
          },
          {
            name: '2025-10-21-another-post.md',
            title: 'Another Post',
            date: new Date('2025-10-21'),
            categories: [],
            sha: 'def456'
          }
        ];
      });

      it('renders posts in table', () => {
        renderPostsList();

        const tbody = document.getElementById('posts-table-body');
        expect(tbody.children.length).toBeGreaterThan(0);
      });

      it('shows empty state when no posts', () => {
        window.allPostsWithMetadata = [];

        renderPostsList();

        const emptyEl = document.getElementById('posts-empty');
        expect(emptyEl.classList.contains('hidden')).toBe(false);
      });

      it('displays post titles and dates', () => {
        renderPostsList();

        const tbody = document.getElementById('posts-table-body');
        const html = tbody.innerHTML;

        expect(html).toContain('Test Post');
        expect(html).toContain('Another Post');
      });

      it('paginates posts correctly', () => {
        window.postsPerPage = 1;
        window.currentPage = 1;

        renderPostsList();

        const tbody = document.getElementById('posts-table-body');
        // Should only show 1 post per page
        const rows = tbody.querySelectorAll('tr:not(.category-row)');
        expect(rows.length).toBe(1);
      });

      it('displays categories when present', () => {
        renderPostsList();

        const tbody = document.getElementById('posts-table-body');
        expect(tbody.innerHTML).toContain('Technology');
      });

      it('escapes HTML in titles to prevent XSS', () => {
        window.allPostsWithMetadata = [{
          name: 'xss-post.md',
          title: '<script>alert("XSS")</script>',
          date: new Date(),
          sha: 'xss123'
        }];

        renderPostsList();

        const tbody = document.getElementById('posts-table-body');
        expect(tbody.innerHTML).not.toContain('<script>');
        expect(tbody.innerHTML).toContain('&lt;script&gt;');
      });
    });
  });

  describe('CRUD Operations', () => {
    describe('editPost', () => {
      it('loads post data and populates form', async () => {
        const mockPost = {
          path: '_posts/2025-10-22-test.md',
          frontmatter: {
            title: 'Test Post',
            date: '2025-10-22 10:30:00',
            categories: ['Technology'],
            tags: ['javascript'],
            image: 'https://example.com/image.jpg'
          },
          body: '# Test Content',
          sha: 'abc123'
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockPost
        });

        await editPost('2025-10-22-test.md');

        expect(document.getElementById('post-title').value).toBe('Test Post');
        expect(document.getElementById('post-content').value).toBe('# Test Content');
      });

      it('updates URL with filename', async () => {
        const mockPost = {
          path: '_posts/test.md',
          frontmatter: { title: 'Test' },
          body: 'Content',
          sha: 'abc123'
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockPost
        });

        await editPost('test.md', true);

        expect(window.history.pushState).toHaveBeenCalledWith(
          {},
          '',
          expect.stringContaining('edit/test.md')
        );
      });

      it('handles both image and featured_image fields', async () => {
        const mockPost = {
          path: '_posts/test.md',
          frontmatter: {
            title: 'Test',
            featured_image: 'https://example.com/featured.jpg'
          },
          body: 'Content',
          sha: 'abc123'
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => mockPost
        });

        await editPost('test.md');

        expect(document.getElementById('post-image').value).toContain('featured.jpg');
      });

      it('handles API errors', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 404
        });

        await editPost('nonexistent.md');

        const errorEl = document.getElementById('error');
        expect(errorEl.classList.contains('hidden')).toBe(false);
      });
    });

    describe('savePost', () => {
      beforeEach(() => {
        document.getElementById('post-title').value = 'New Test Post';
        document.getElementById('post-date').value = '2025-10-22T10:30';
        document.getElementById('post-content').value = '# Content';
        window.selectedCategories = ['Technology'];
        window.selectedTags = ['javascript'];
      });

      it('creates new post with correct filename', async () => {
        window.currentPost = null;

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, commitSha: 'abc123' })
        });

        const event = new Event('submit');
        await savePost(event);

        expect(mockFetch).toHaveBeenCalledWith(
          '/.netlify/functions/posts',
          expect.objectContaining({
            method: 'POST'
          })
        );

        const callArgs = mockFetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.filename).toMatch(/^2025-10-22-.+\.md$/);
      });

      it('updates existing post with sha', async () => {
        window.currentPost = {
          name: '2025-10-22-existing.md',
          sha: 'oldsha123'
        };

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, commitSha: 'newsha456' })
        });

        const event = new Event('submit');
        await savePost(event);

        expect(mockFetch).toHaveBeenCalledWith(
          '/.netlify/functions/posts',
          expect.objectContaining({
            method: 'PUT'
          })
        );

        const callArgs = mockFetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.sha).toBe('oldsha123');
      });

      it('includes categories and tags in frontmatter', async () => {
        window.currentPost = null;

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const event = new Event('submit');
        await savePost(event);

        const callArgs = mockFetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.frontmatter.categories).toEqual(['Technology']);
        expect(body.frontmatter.tags).toEqual(['javascript']);
      });

      it('tracks deployment with commitSha', async () => {
        window.currentPost = null;

        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, commitSha: 'deploy123' })
        });

        const event = new Event('submit');
        await savePost(event);

        expect(window.trackDeployment).toHaveBeenCalledWith(
          'deploy123',
          expect.stringContaining('New Test Post'),
          expect.any(String)
        );
      });

      it('handles save errors with user-friendly messages', async () => {
        window.currentPost = null;

        mockFetch.mockResolvedValue({
          ok: false,
          json: async () => ({ message: 'Save failed' })
        });

        const event = new Event('submit');
        await savePost(event);

        const errorEl = document.getElementById('error');
        expect(errorEl.classList.contains('hidden')).toBe(false);
      });

      it('prevents default form submission', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true })
        });

        const event = new Event('submit');
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        await savePost(event);

        expect(preventDefaultSpy).toHaveBeenCalled();
      });
    });

    describe('deletePost', () => {
      beforeEach(() => {
        window.currentPost = {
          name: '2025-10-22-test.md',
          sha: 'abc123'
        };
      });

      it('shows confirmation dialog', async () => {
        mockShowConfirm.mockResolvedValue(false);

        await deletePost();

        expect(mockShowConfirm).toHaveBeenCalledWith(
          expect.stringContaining('delete')
        );
      });

      it('sends delete request to trash endpoint when confirmed', async () => {
        mockShowConfirm.mockResolvedValue(true);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, commitSha: 'delete123' })
        });

        await deletePost();

        expect(mockFetch).toHaveBeenCalledWith(
          '/.netlify/functions/trash',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
        );

        const callArgs = mockFetch.mock.calls[0][1];
        const body = JSON.parse(callArgs.body);
        expect(body.filename).toBe('2025-10-22-test.md');
        expect(body.sha).toBe('abc123');
      });

      it('does not delete when user cancels', async () => {
        mockShowConfirm.mockResolvedValue(false);

        await deletePost();

        expect(mockFetch).not.toHaveBeenCalled();
      });

      it('tracks deployment after delete', async () => {
        mockShowConfirm.mockResolvedValue(true);
        mockFetch.mockResolvedValue({
          ok: true,
          json: async () => ({ success: true, commitSha: 'delete456' })
        });

        await deletePost();

        expect(window.trackDeployment).toHaveBeenCalledWith(
          'delete456',
          expect.stringContaining('Delete'),
          '2025-10-22-test.md'
        );
      });
    });
  });

  describe('Editor Workflow', () => {
    describe('showNewPostForm', () => {
      it('clears all form fields', () => {
        // Pre-fill form
        document.getElementById('post-title').value = 'Old Title';
        document.getElementById('post-content').value = 'Old Content';
        document.getElementById('post-image').value = 'old-image.jpg';

        showNewPostForm();

        expect(document.getElementById('post-title').value).toBe('');
        expect(document.getElementById('post-content').value).toBe('');
        expect(document.getElementById('post-image').value).toBe('');
      });

      it('sets current date in date field', () => {
        showNewPostForm();

        const dateInput = document.getElementById('post-date');
        expect(dateInput.value).toBeTruthy();
        expect(dateInput.value).toContain(new Date().getFullYear().toString());
      });

      it('updates URL to /posts/new', () => {
        showNewPostForm(true);

        expect(window.history.pushState).toHaveBeenCalledWith(
          {},
          '',
          expect.stringContaining('/posts/new')
        );
      });

      it('clears current post', () => {
        window.currentPost = { name: 'test.md' };

        showNewPostForm();

        expect(window.currentPost).toBeNull();
      });

      it('shows editor view and hides list view', () => {
        showNewPostForm();

        const editorView = document.getElementById('posts-editor-view');
        const listView = document.getElementById('posts-list-view');

        expect(editorView.classList.contains('hidden')).toBe(false);
        expect(listView.classList.contains('hidden')).toBe(true);
      });
    });
  });

  describe('Integration - Complete Post Workflow', () => {
    it('can create, edit, and delete a post', async () => {
      // Create new post
      showNewPostForm();

      document.getElementById('post-title').value = 'Integration Test Post';
      document.getElementById('post-date').value = '2025-10-22T10:30';
      document.getElementById('post-content').value = '# Test Content';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'create123' })
      });

      const createEvent = new Event('submit');
      await savePost(createEvent);

      expect(window.trackDeployment).toHaveBeenCalledWith(
        'create123',
        expect.stringContaining('Integration Test Post'),
        expect.stringContaining('.md')
      );

      // Edit post
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          path: '_posts/2025-10-22-integration-test-post.md',
          frontmatter: {
            title: 'Integration Test Post',
            date: '2025-10-22 10:30:00'
          },
          body: '# Test Content',
          sha: 'create123'
        })
      });

      await editPost('2025-10-22-integration-test-post.md');

      document.getElementById('post-title').value = 'Updated Post Title';

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'update456' })
      });

      const updateEvent = new Event('submit');
      await savePost(updateEvent);

      expect(window.trackDeployment).toHaveBeenCalledWith(
        'update456',
        expect.stringContaining('Updated Post Title'),
        expect.stringContaining('.md')
      );

      // Delete post
      mockShowConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, commitSha: 'delete789' })
      });

      await deletePost();

      expect(window.trackDeployment).toHaveBeenCalledWith(
        'delete789',
        expect.stringContaining('Delete'),
        expect.stringContaining('.md')
      );
    });
  });
});
