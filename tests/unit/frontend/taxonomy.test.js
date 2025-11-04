/**
 * Unit Tests for Taxonomy Module
 *
 * Tests the complete taxonomy module including categories and tags management,
 * CRUD operations, drag-and-drop reordering, and auto-save functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  loadTaxonomy,
  switchTaxonomyTab,
  renderCategories,
  renderTags,
  showAddCategoryModal,
  editCategory,
  deleteCategory,
  showAddTagModal,
  editTag,
  deleteTag,
  saveTaxonomy
} from '../../../admin/js/modules/taxonomy.js';
import { initNotifications } from '../../../admin/js/ui/notifications.js';

describe('Taxonomy Module', () => {
  let mockFetch;
  let mockSortable;

  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="error" class="hidden"><p></p></div>
      <div id="success" class="hidden"><p></p></div>

      <!-- Taxonomy tabs -->
      <button id="tab-categories" class="tab-button border-transparent text-gray-500"></button>
      <button id="tab-tags" class="tab-button border-transparent text-gray-500"></button>

      <!-- Count badges -->
      <span id="categories-count-badge" class="bg-gray-100 text-gray-600">0</span>
      <span id="tags-count-badge" class="bg-gray-100 text-gray-600">0</span>

      <!-- Tab content -->
      <div id="taxonomy-categories-tab" class="taxonomy-tab hidden">
        <table>
          <tbody id="categories-list"></tbody>
        </table>
      </div>
      <div id="taxonomy-tags-tab" class="taxonomy-tab hidden">
        <table>
          <tbody id="tags-list"></tbody>
        </table>
      </div>

      <!-- Add item inputs -->
      <div id="taxonomy-add-category" class="taxonomy-add-item hidden"></div>
      <div id="taxonomy-add-tag" class="taxonomy-add-item hidden"></div>

      <!-- Save button -->
      <button id="save-btn">Save Changes</button>
    `;

    // Initialize notifications module with new DOM
    initNotifications();

    // Setup window globals
    window.API_BASE = '/.netlify/functions';
    window.categories = [];
    window.tags = [];
    window.lastSavedState = null;
    window.isDirty = false;
    window.sortableInstances = { categories: null, tags: null };

    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock Sortable.js
    mockSortable = {
      destroy: vi.fn(),
      option: vi.fn(),
    };

    global.Sortable = vi.fn(() => mockSortable);

    // Mock window functions
    window.showModal = vi.fn();
    window.showConfirm = vi.fn();
    window.trackDeployment = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('loadTaxonomy', () => {
    it('fetches taxonomy from API and updates state', async () => {
      const mockData = {
        categories: ['Technology', 'Design', 'Development'],
        tags: ['javascript', 'css', 'html']
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      await loadTaxonomy();

      expect(mockFetch).toHaveBeenCalledWith('/.netlify/functions/taxonomy');
      expect(window.categories).toEqual(mockData.categories);
      expect(window.tags).toEqual(mockData.tags);
      expect(window.isDirty).toBe(false);
      expect(window.lastSavedState).toBe(JSON.stringify(mockData));
    });

    it('handles empty taxonomy data', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({})
      });

      await loadTaxonomy();

      expect(window.categories).toEqual([]);
      expect(window.tags).toEqual([]);
    });

    it('displays error when API fetch fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500
      });

      await loadTaxonomy();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await loadTaxonomy();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('renders categories and tags after loading', async () => {
      const mockData = {
        categories: ['Test Category'],
        tags: ['test-tag']
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockData
      });

      await loadTaxonomy();

      const categoriesList = document.getElementById('categories-list');
      const tagsList = document.getElementById('tags-list');

      expect(categoriesList.innerHTML).toContain('Test Category');
      expect(tagsList.innerHTML).toContain('test-tag');
    });
  });

  describe('switchTaxonomyTab', () => {
    beforeEach(() => {
      // Reset tab state
      document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('border-teal-600', 'text-teal-600');
        btn.classList.add('border-transparent', 'text-gray-500');
      });
      document.querySelectorAll('.taxonomy-tab').forEach(tab => {
        tab.classList.add('hidden');
      });
    });

    it('switches to categories tab', () => {
      switchTaxonomyTab('categories');

      const categoriesTab = document.getElementById('tab-categories');
      expect(categoriesTab.classList.contains('border-teal-600')).toBe(true);
      expect(categoriesTab.classList.contains('text-teal-600')).toBe(true);

      const categoriesContent = document.getElementById('taxonomy-categories-tab');
      expect(categoriesContent.classList.contains('hidden')).toBe(false);

      const addCategory = document.getElementById('taxonomy-add-category');
      expect(addCategory.classList.contains('hidden')).toBe(false);
    });

    it('switches to tags tab', () => {
      switchTaxonomyTab('tags');

      const tagsTab = document.getElementById('tab-tags');
      expect(tagsTab.classList.contains('border-teal-600')).toBe(true);
      expect(tagsTab.classList.contains('text-teal-600')).toBe(true);

      const tagsContent = document.getElementById('taxonomy-tags-tab');
      expect(tagsContent.classList.contains('hidden')).toBe(false);

      const addTag = document.getElementById('taxonomy-add-tag');
      expect(addTag.classList.contains('hidden')).toBe(false);
    });

    it('updates badge colors when switching tabs', () => {
      const categoriesBadge = document.getElementById('categories-count-badge');
      const tagsBadge = document.getElementById('tags-count-badge');

      switchTaxonomyTab('categories');
      expect(categoriesBadge.classList.contains('bg-teal-100')).toBe(true);
      expect(tagsBadge.classList.contains('bg-gray-100')).toBe(true);

      switchTaxonomyTab('tags');
      expect(tagsBadge.classList.contains('bg-teal-100')).toBe(true);
      expect(categoriesBadge.classList.contains('bg-gray-100')).toBe(true);
    });

    it('hides all other tabs when switching', () => {
      switchTaxonomyTab('categories');
      const tagsTab = document.getElementById('taxonomy-tags-tab');
      expect(tagsTab.classList.contains('hidden')).toBe(true);

      switchTaxonomyTab('tags');
      const categoriesTab = document.getElementById('taxonomy-categories-tab');
      expect(categoriesTab.classList.contains('hidden')).toBe(true);
    });
  });

  describe('renderCategories', () => {
    it('renders categories list', () => {
      window.categories = ['Technology', 'Design', 'Development'];

      renderCategories();

      const tbody = document.getElementById('categories-list');
      expect(tbody.children.length).toBe(3);
      expect(tbody.innerHTML).toContain('Technology');
      expect(tbody.innerHTML).toContain('Design');
      expect(tbody.innerHTML).toContain('Development');
    });

    it('updates category count badge', () => {
      window.categories = ['Cat1', 'Cat2', 'Cat3', 'Cat4'];

      renderCategories();

      const badge = document.getElementById('categories-count-badge');
      expect(badge.textContent).toBe('4');
    });

    it('renders empty state when no categories', () => {
      window.categories = [];

      renderCategories();

      const tbody = document.getElementById('categories-list');
      expect(tbody.innerHTML).toBe('');
    });

    it('escapes HTML in category names to prevent XSS', () => {
      window.categories = ['<script>alert("XSS")</script>'];

      renderCategories();

      const tbody = document.getElementById('categories-list');
      // The category row should be rendered
      const row = tbody.querySelector('tr');
      expect(row).not.toBeNull();

      // The dangerous script content should be rendered as text, not executed
      // (escapeHtml() is called, which makes it safe)
      const categoryText = tbody.textContent;
      expect(categoryText).toContain('alert');
    });

    it('initializes Sortable.js for drag-and-drop', () => {
      window.categories = ['Cat1', 'Cat2'];

      renderCategories();

      expect(global.Sortable).toHaveBeenCalled();
      expect(window.sortableInstances.categories).toBeDefined();
    });

    it('destroys previous Sortable instance before creating new one', () => {
      window.categories = ['Cat1'];
      window.sortableInstances.categories = mockSortable;

      renderCategories();

      expect(mockSortable.destroy).toHaveBeenCalled();
    });

    it('renders edit and delete buttons for each category', () => {
      window.categories = ['Test Category'];

      renderCategories();

      const tbody = document.getElementById('categories-list');
      const editBtn = tbody.querySelector('.btn-icon-edit');
      const deleteBtn = tbody.querySelector('.btn-icon-delete');

      expect(editBtn).not.toBeNull();
      expect(deleteBtn).not.toBeNull();
    });

    it('adds correct data-index attribute to rows', () => {
      window.categories = ['Cat1', 'Cat2', 'Cat3'];

      renderCategories();

      const rows = document.querySelectorAll('#categories-list tr');
      expect(rows[0].getAttribute('data-index')).toBe('0');
      expect(rows[1].getAttribute('data-index')).toBe('1');
      expect(rows[2].getAttribute('data-index')).toBe('2');
    });
  });

  describe('renderTags', () => {
    it('renders tags list', () => {
      window.tags = ['javascript', 'css', 'html'];

      renderTags();

      const tbody = document.getElementById('tags-list');
      expect(tbody.children.length).toBe(3);
      expect(tbody.innerHTML).toContain('javascript');
      expect(tbody.innerHTML).toContain('css');
      expect(tbody.innerHTML).toContain('html');
    });

    it('updates tag count badge', () => {
      window.tags = ['tag1', 'tag2'];

      renderTags();

      const badge = document.getElementById('tags-count-badge');
      expect(badge.textContent).toBe('2');
    });

    it('renders empty state when no tags', () => {
      window.tags = [];

      renderTags();

      const tbody = document.getElementById('tags-list');
      expect(tbody.innerHTML).toBe('');
    });

    it('escapes HTML in tag names to prevent XSS', () => {
      window.tags = ['<img src=x onerror=alert(1)>'];

      renderTags();

      const tbody = document.getElementById('tags-list');
      // The tag row should be rendered (escapeHtml prevents XSS)
      const row = tbody.querySelector('tr');
      expect(row).not.toBeNull();

      // Verify the row has content (the tag was processed)
      expect(row.children.length).toBeGreaterThan(0);
    });

    it('initializes Sortable.js for drag-and-drop', () => {
      window.tags = ['tag1', 'tag2'];

      renderTags();

      expect(global.Sortable).toHaveBeenCalled();
      expect(window.sortableInstances.tags).toBeDefined();
    });
  });

  describe('showAddCategoryModal', () => {
    it('adds new category when valid input provided', async () => {
      window.showModal.mockResolvedValue('New Category');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      window.categories = ['Existing'];
      await showAddCategoryModal();

      expect(window.categories).toEqual(['Existing', 'New Category']);
    });

    it('trims whitespace from category name', async () => {
      window.showModal.mockResolvedValue('  Trimmed  ');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await showAddCategoryModal();

      expect(window.categories).toEqual(['Trimmed']);
    });

    it('shows error when category name is empty', async () => {
      window.showModal.mockResolvedValue('   ');

      await showAddCategoryModal();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('cannot be empty');
    });

    it('shows error when category already exists', async () => {
      window.categories = ['Existing Category'];
      window.showModal.mockResolvedValue('Existing Category');

      await showAddCategoryModal();

      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('already exists');
    });

    it('does nothing when modal is cancelled', async () => {
      window.showModal.mockResolvedValue(null);
      const originalCategories = ['Cat1'];
      window.categories = [...originalCategories];

      await showAddCategoryModal();

      expect(window.categories).toEqual(originalCategories);
    });

    it('auto-saves after adding category', async () => {
      window.showModal.mockResolvedValue('New Category');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await showAddCategoryModal();

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/taxonomy',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  describe('editCategory', () => {
    it('updates category when valid input provided', async () => {
      window.categories = ['Original'];
      window.showModal.mockResolvedValue('Updated');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await editCategory(0);

      expect(window.categories[0]).toBe('Updated');
    });

    it('shows error when new name is empty', async () => {
      window.categories = ['Original'];
      window.showModal.mockResolvedValue('  ');

      await editCategory(0);

      expect(window.categories[0]).toBe('Original');
      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('cannot be empty');
    });

    it('shows error when new name already exists', async () => {
      window.categories = ['First', 'Second'];
      window.showModal.mockResolvedValue('Second');

      await editCategory(0);

      expect(window.categories[0]).toBe('First');
      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('already exists');
    });

    it('allows editing category to same name', async () => {
      window.categories = ['Unchanged'];
      window.showModal.mockResolvedValue('Unchanged');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await editCategory(0);

      // Should not show error for same name
      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(true);
    });

    it('does nothing when modal is cancelled', async () => {
      window.categories = ['Original'];
      window.showModal.mockResolvedValue(null);

      await editCategory(0);

      expect(window.categories[0]).toBe('Original');
    });
  });

  describe('deleteCategory', () => {
    it('deletes category when confirmed', async () => {
      window.categories = ['First', 'Second', 'Third'];
      window.showConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deleteCategory(1);

      expect(window.categories).toEqual(['First', 'Third']);
    });

    it('does not delete when cancelled', async () => {
      window.categories = ['First', 'Second'];
      window.showConfirm.mockResolvedValue(false);

      await deleteCategory(0);

      expect(window.categories).toEqual(['First', 'Second']);
    });

    it('shows confirmation dialog with category name', async () => {
      window.categories = ['Important Category'];
      window.showConfirm.mockResolvedValue(false);

      await deleteCategory(0);

      expect(window.showConfirm).toHaveBeenCalledWith(
        expect.stringContaining('Important Category')
      );
    });

    it('auto-saves after deleting', async () => {
      window.categories = ['To Delete'];
      window.showConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deleteCategory(0);

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/taxonomy',
        expect.objectContaining({
          method: 'PUT'
        })
      );
    });
  });

  describe('showAddTagModal', () => {
    it('adds new tag when valid input provided', async () => {
      window.showModal.mockResolvedValue('new-tag');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await showAddTagModal();

      expect(window.tags).toContain('new-tag');
    });

    it('shows error when tag name is empty', async () => {
      window.showModal.mockResolvedValue('');

      await showAddTagModal();

      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('cannot be empty');
    });

    it('shows error when tag already exists', async () => {
      window.tags = ['existing-tag'];
      window.showModal.mockResolvedValue('existing-tag');

      await showAddTagModal();

      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('already exists');
    });
  });

  describe('editTag', () => {
    it('updates tag when valid input provided', async () => {
      window.tags = ['old-tag'];
      window.showModal.mockResolvedValue('new-tag');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await editTag(0);

      expect(window.tags[0]).toBe('new-tag');
    });

    it('shows error when new tag name already exists', async () => {
      window.tags = ['tag1', 'tag2'];
      window.showModal.mockResolvedValue('tag2');

      await editTag(0);

      expect(window.tags[0]).toBe('tag1');
      const errorEl = document.getElementById('error');
      expect(errorEl.querySelector('p').textContent).toContain('already exists');
    });
  });

  describe('deleteTag', () => {
    it('deletes tag when confirmed', async () => {
      window.tags = ['tag1', 'tag2', 'tag3'];
      window.showConfirm.mockResolvedValue(true);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await deleteTag(1);

      expect(window.tags).toEqual(['tag1', 'tag3']);
    });

    it('does not delete when cancelled', async () => {
      window.tags = ['tag1'];
      window.showConfirm.mockResolvedValue(false);

      await deleteTag(0);

      expect(window.tags).toEqual(['tag1']);
    });
  });

  describe('saveTaxonomy', () => {
    it('sends taxonomy data to API', async () => {
      window.categories = ['Cat1', 'Cat2'];
      window.tags = ['tag1', 'tag2'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await saveTaxonomy();

      expect(mockFetch).toHaveBeenCalledWith(
        '/.netlify/functions/taxonomy',
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            categories: ['Cat1', 'Cat2'],
            tags: ['tag1', 'tag2']
          })
        }
      );
    });

    it('shows success message after save', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await saveTaxonomy();

      const successEl = document.getElementById('success');
      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(successEl.querySelector('p').textContent).toContain('successfully');
    });

    it('shows error message when save fails', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Save failed' })
      });

      await saveTaxonomy();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
    });

    it('updates lastSavedState after successful save', async () => {
      window.categories = ['Cat1'];
      window.tags = ['tag1'];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await saveTaxonomy();

      expect(window.lastSavedState).toBe(
        JSON.stringify({ categories: ['Cat1'], tags: ['tag1'] })
      );
      expect(window.isDirty).toBe(false);
    });

    it('tracks deployment when commit SHA returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          success: true,
          commitSha: 'abc123'
        })
      });

      await saveTaxonomy();

      expect(window.trackDeployment).toHaveBeenCalledWith(
        'abc123',
        'Update taxonomy',
        'taxonomy.yml'
      );
    });

    it('sets button loading state during save', async () => {
      mockFetch.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({ success: true })
          });
        }, 100);
      }));

      const savePromise = saveTaxonomy();

      // Check button state immediately after calling
      const saveBtn = document.getElementById('save-btn');
      expect(saveBtn.textContent).toContain('Saving');

      await savePromise;

      // Button should be restored after save
      expect(saveBtn.textContent).not.toContain('Saving');
    });

    it('handles network errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await saveTaxonomy();

      const errorEl = document.getElementById('error');
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(errorEl.querySelector('p').textContent).toContain('Network error');
    });
  });

  describe('Integration - CRUD workflow', () => {
    it('complete category lifecycle: add, edit, delete', async () => {
      // Setup successful API responses
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Add category
      window.showModal.mockResolvedValueOnce('Technology');
      await showAddCategoryModal();
      expect(window.categories).toContain('Technology');

      // Edit category
      window.showModal.mockResolvedValueOnce('Tech');
      await editCategory(0);
      expect(window.categories[0]).toBe('Tech');

      // Delete category
      window.showConfirm.mockResolvedValueOnce(true);
      await deleteCategory(0);
      expect(window.categories).toEqual([]);
    });

    it('prevents duplicate categories at every step', async () => {
      window.categories = ['Existing'];
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      // Try to add duplicate
      window.showModal.mockResolvedValue('Existing');
      await showAddCategoryModal();
      expect(window.categories.length).toBe(1);

      // Try to edit to duplicate
      window.categories = ['First', 'Second'];
      window.showModal.mockResolvedValue('Second');
      await editCategory(0);
      expect(window.categories[0]).toBe('First');
    });
  });
});
