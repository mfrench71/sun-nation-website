/**
 * Taxonomy Module
 *
 * Manages categories and tags taxonomy with CRUD operations, drag-and-drop reordering,
 * and automatic saving functionality.
 *
 * Features:
 * - Load categories and tags from backend
 * - Add, edit, and delete categories and tags
 * - Drag-and-drop reordering with Sortable.js
 * - Automatic save after each operation
 * - Dirty state tracking for unsaved changes
 * - Tab switching between categories and tags
 *
 * Dependencies:
 * - core/utils.js for escapeHtml() and setButtonLoading()
 * - ui/notifications.js for showError(), showSuccess(), and hideMessages()
 * - Global API_BASE constant
 * - Global state: categories, tags, lastSavedState, isDirty, sortableInstances
 * - Global showModal() and showConfirm() functions
 * - Global trackDeployment() function
 * - External: Sortable.js library for drag-and-drop
 *
 * @module modules/taxonomy
 */

import { escapeHtml, setButtonLoading } from '../core/utils.js';
import { showError, showSuccess, hideMessages } from '../ui/notifications.js';
import logger from '../core/logger.js';

// Cache configuration
const TAXONOMY_CACHE_KEY = 'admin_taxonomy_cache_v2'; // v2: Added hierarchical structure support

/**
 * Gets cached taxonomy data
 */
function getCache(key) {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;
    const { data } = JSON.parse(cached);
    return data;
  } catch (error) {
    logger.warn('Taxonomy cache read error:', error);
    return null;
  }
}

/**
 * Sets taxonomy cache data
 */
function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (error) {
    logger.warn('Taxonomy cache write error:', error);
  }
}

/**
 * Clears taxonomy cache
 */
export function clearTaxonomyCache() {
  localStorage.removeItem(TAXONOMY_CACHE_KEY);
}

/**
 * Loads taxonomy data from the backend
 *
 * Fetches categories and tags from the API, updates global state arrays,
 * stores the initial saved state, and renders both lists.
 *
 * @throws {Error} If taxonomy load fails
 *
 * @example
 * import { loadTaxonomy } from './modules/taxonomy.js';
 * await loadTaxonomy();
 */
export async function loadTaxonomy() {
  try {
    // Try to load from cache first
    const cachedData = getCache(TAXONOMY_CACHE_KEY);
    if (cachedData) {
      // Flat arrays for backwards compatibility
      window.categories = cachedData.categories || [];
      window.tags = cachedData.tags || [];

      // Hierarchical structures for tree view UI
      window.categoriesTree = cachedData.categoriesTree || [];
      window.tagsTree = cachedData.tagsTree || [];

      // Store initial state as "saved"
      window.lastSavedState = JSON.stringify({
        categories: window.categories,
        tags: window.tags,
        categoriesTree: window.categoriesTree,
        tagsTree: window.tagsTree
      });
      window.isDirty = false;

      renderCategories();
      renderTags();
      updateSaveButton();

      // Initialize to show Categories tab by default
      switchTaxonomyTab('categories');
      return;
    }

    // Cache miss - fetch from API
    const response = await fetch(`${window.API_BASE}/taxonomy`);
    if (!response.ok) throw new Error('Failed to load taxonomy');

    const data = await response.json();

    // Flat arrays for backwards compatibility
    window.categories = data.categories || [];
    window.tags = data.tags || [];

    // Hierarchical structures for future tree view UI
    window.categoriesTree = data.categoriesTree || [];
    window.tagsTree = data.tagsTree || [];

    // Cache all formats
    setCache(TAXONOMY_CACHE_KEY, {
      categories: window.categories,
      tags: window.tags,
      categoriesTree: window.categoriesTree,
      tagsTree: window.tagsTree
    });

    // Store initial state as "saved"
    window.lastSavedState = JSON.stringify({
      categories: window.categories,
      tags: window.tags,
      categoriesTree: window.categoriesTree,
      tagsTree: window.tagsTree
    });
    window.isDirty = false;

    renderCategories();
    renderTags();
    updateSaveButton();

    // Initialize to show Categories tab by default
    switchTaxonomyTab('categories');
  } catch (error) {
    showError('Failed to load taxonomy: ' + error.message);
  }
}

/**
 * Switches between categories and tags tabs
 *
 * Updates tab button styles, badge colors, tab content visibility, and
 * add item button visibility based on the selected tab.
 *
 * @param {string} tabName - Either 'categories' or 'tags'
 *
 * @example
 * import { switchTaxonomyTab } from './modules/taxonomy.js';
 * switchTaxonomyTab('tags');
 */
export function switchTaxonomyTab(tabName) {
  // Update tab buttons (Bootstrap nav-link)
  const categoriesTab = document.getElementById('tab-categories');
  const tagsTab = document.getElementById('tab-tags');

  if (!categoriesTab || !tagsTab) return;

  // Remove active class from both
  categoriesTab.classList.remove('active');
  tagsTab.classList.remove('active');

  // Add active to selected tab
  if (tabName === 'categories') {
    categoriesTab.classList.add('active');
  } else {
    tagsTab.classList.add('active');
  }

  // Update tab content visibility
  const categoriesContent = document.getElementById('taxonomy-categories-tab');
  const tagsContent = document.getElementById('taxonomy-tags-tab');

  if (categoriesContent && tagsContent) {
    if (tabName === 'categories') {
      categoriesContent.classList.remove('d-none');
      tagsContent.classList.add('d-none');
    } else {
      tagsContent.classList.remove('d-none');
      categoriesContent.classList.add('d-none');
    }
  }

  // Update add item buttons
  const addCategoryDiv = document.getElementById('taxonomy-add-category');
  const addTagDiv = document.getElementById('taxonomy-add-tag');

  if (addCategoryDiv && addTagDiv) {
    if (tabName === 'categories') {
      addCategoryDiv.classList.remove('d-none');
      addTagDiv.classList.add('d-none');
    } else {
      addTagDiv.classList.remove('d-none');
      addCategoryDiv.classList.add('d-none');
    }
  }
}

/**
 * Checks if a taxonomy item has been modified since last save
 *
 * Compares the current state of a category or tag at the given index
 * with the last saved state to determine if it has been modified.
 *
 * @param {string} type - Either 'category' or 'tag'
 * @param {number} index - Index of the item to check
 * @returns {boolean} True if item has been modified, false otherwise
 *
 * @private
 */
function isItemDirty(type, index) {
  if (!window.lastSavedState) return false;
  const saved = JSON.parse(window.lastSavedState);
  const current = type === 'category' ? window.categories : window.tags;
  const savedList = type === 'category' ? saved.categories : saved.tags;

  // Check if item exists in saved state and matches
  return current[index] !== savedList[index];
}

/**
 * Marks taxonomy as having unsaved changes
 *
 * Sets the isDirty flag and updates the save button state to indicate
 * that there are pending changes that need to be saved.
 *
 * @private
 */
function markDirty() {
  window.isDirty = true;
  updateSaveButton();
}

/**
 * Updates the taxonomy save button state based on unsaved changes
 *
 * Compares current taxonomy state with last saved state and enables/disables
 * the save button accordingly, updating its text and styling.
 *
 * @private
 */
function updateSaveButton() {
  const saveBtn = document.getElementById('save-btn');
  if (!saveBtn) return;

  const currentState = JSON.stringify({
    categories: window.categories,
    tags: window.tags,
    categoriesTree: window.categoriesTree,
    tagsTree: window.tagsTree
  });
  const hasChanges = currentState !== window.lastSavedState;

  if (hasChanges) {
    saveBtn.textContent = 'Save Changes';
    saveBtn.classList.remove('opacity-50');
    saveBtn.disabled = false;
  } else {
    saveBtn.textContent = 'All Saved ✓';
    saveBtn.classList.add('opacity-50');
    saveBtn.disabled = true;
  }
}

/**
 * Toggles visibility of child categories
 *
 * @param {number} parentIndex - Index of parent category
 */
export function toggleCategoryChildren(parentIndex) {
  // Only select child rows, not the parent row itself
  const children = document.querySelectorAll(`.taxonomy-tree-child[data-parent-index="${parentIndex}"]`);
  const expandBtn = document.querySelector(`[data-expand-btn="${parentIndex}"]`);

  children.forEach(child => {
    child.classList.toggle('d-none');
  });

  if (expandBtn) {
    expandBtn.classList.toggle('collapsed');
  }
}

/**
 * Renders the categories list with hierarchical tree view
 *
 * Generates the HTML table rows for all categories in a tree structure with
 * expand/collapse functionality for parents. Updates the category count badge.
 * Each row includes edit and delete buttons.
 *
 * @example
 * import { renderCategories } from './modules/taxonomy.js';
 * renderCategories();
 */
export function renderCategories() {
  const tbody = document.getElementById('categories-list');
  const countBadge = document.getElementById('categories-count-badge');

  if (!tbody || !countBadge) {
    logger.error('renderCategories: Missing tbody or countBadge elements');
    return;
  }

  const categoriesTree = window.categoriesTree || [];
  const categories = window.categories || [];

  // Remove loading spinner if it exists
  const loadingRow = document.getElementById('categories-loading');
  if (loadingRow) {
    loadingRow.remove();
  }

  // If no categories, show empty state
  if (categoriesTree.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="3" class="p-5 text-center text-muted">
          <i class="fas fa-folder-open fa-3x mb-3 text-secondary"></i>
          <p class="mb-0">No categories yet. Click "Add Category" to create one.</p>
        </td>
      </tr>
    `;
    countBadge.textContent = '0';
    return;
  }

  // Generate rows with hierarchy
  let rowNumber = 1;
  const rows = [];

  categoriesTree.forEach((parent, parentIndex) => {
    const hasChildren = parent.children && parent.children.length > 0;

    // Parent row
    rows.push(`
      <tr class="small taxonomy-tree-parent" data-parent-index="${parentIndex}">
        <td class="px-3 py-2 text-muted">${rowNumber++}</td>
        <td class="px-3 py-2">
          <div class="d-flex align-items-center gap-2">
            ${hasChildren ? `
              <button
                class="taxonomy-tree-expand-btn"
                data-expand-btn="${parentIndex}"
                onclick="window.toggleCategoryChildren(${parentIndex})"
                title="Expand/collapse children"
              >
                <i class="fas fa-chevron-down"></i>
              </button>
            ` : '<span style="width: 1.75rem; display: inline-block;"></span>'}
            <i class="fas fa-bars text-secondary flex-shrink-0"></i>
            <span class="fw-medium text-dark">${escapeHtml(parent.item)}</span>
            ${hasChildren ? `<span class="badge bg-secondary ms-2">${parent.children.length}</span>` : ''}
          </div>
        </td>
        <td class="px-3 py-2 text-end text-nowrap">
          <button
            onclick="window.editCategoryByName('${escapeHtml(parent.item).replace(/'/g, "\\'")}')"
            class="btn-icon-edit"
            title="Edit category"
          >
            <i class="fas fa-edit"></i>
          </button>
          <button
            onclick="window.deleteCategoryByName('${escapeHtml(parent.item).replace(/'/g, "\\'")}')"
            class="btn-icon-delete"
            title="Delete category"
          >
            <i class="fas fa-trash"></i>
          </button>
        </td>
      </tr>
    `);

    // Child rows
    if (hasChildren) {
      parent.children.forEach((child, childIndex) => {
        rows.push(`
          <tr class="small taxonomy-tree-child" data-parent-index="${parentIndex}" data-child-index="${childIndex}">
            <td class="px-3 py-2 text-muted">${rowNumber++}</td>
            <td class="px-3 py-2 taxonomy-tree-indent">
              <div class="d-flex align-items-center gap-2">
                <i class="fas fa-level-up-alt fa-rotate-90 text-secondary flex-shrink-0" style="font-size: 0.75rem;"></i>
                <span class="text-dark">${escapeHtml(child.item)}</span>
              </div>
            </td>
            <td class="px-3 py-2 text-end text-nowrap">
              <button
                onclick="window.editCategoryByName('${escapeHtml(child.item).replace(/'/g, "\\'")}')"
                class="btn-icon-edit"
                title="Edit category"
              >
                <i class="fas fa-edit"></i>
              </button>
              <button
                onclick="window.deleteCategoryByName('${escapeHtml(child.item).replace(/'/g, "\\'")}')"
                class="btn-icon-delete"
                title="Delete category"
              >
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `);
      });
    }
  });

  tbody.innerHTML = rows.join('');
  countBadge.textContent = categories.length;

  // Destroy previous Sortable instance if it exists
  if (window.sortableInstances && window.sortableInstances.categories) {
    window.sortableInstances.categories.destroy();
  }

  // Initialize hierarchical drag-and-drop
  if (typeof Sortable !== 'undefined') {
    if (!window.sortableInstances) {
      window.sortableInstances = { categories: null, tags: null };
    }

    window.sortableInstances.categories = new Sortable(tbody, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      handle: 'tr',

      // Control what can be moved where
      onMove: (evt) => {
        const draggedRow = evt.dragged;
        const relatedRow = evt.related;

        const isDraggingParent = draggedRow.classList.contains('taxonomy-tree-parent');
        const isDraggingChild = draggedRow.classList.contains('taxonomy-tree-child');
        const isRelatedParent = relatedRow.classList.contains('taxonomy-tree-parent');
        const isRelatedChild = relatedRow.classList.contains('taxonomy-tree-child');

        // Parents can only be dropped relative to other parents
        if (isDraggingParent && isRelatedChild) {
          return false;
        }

        // Children can only be dropped relative to siblings (same parent)
        if (isDraggingChild && isRelatedChild) {
          const draggedParentIdx = draggedRow.getAttribute('data-parent-index');
          const relatedParentIdx = relatedRow.getAttribute('data-parent-index');
          if (draggedParentIdx !== relatedParentIdx) {
            return false; // Different parent - not allowed for now
          }
        }

        // Children cannot be dropped relative to parents
        if (isDraggingChild && isRelatedParent) {
          return false;
        }

        return true;
      },

      // Update data structure after drag
      onEnd: (evt) => {
        const draggedRow = evt.item;
        const isDraggingParent = draggedRow.classList.contains('taxonomy-tree-parent');
        const isDraggingChild = draggedRow.classList.contains('taxonomy-tree-child');

        if (isDraggingParent) {
          // Reordering parent categories
          const oldParentIndex = parseInt(draggedRow.getAttribute('data-parent-index'));

          // Calculate new index by counting parent rows before this one
          let newParentIndex = 0;
          const allRows = Array.from(tbody.children);
          const draggedRowIndex = allRows.indexOf(draggedRow);

          for (let i = 0; i < draggedRowIndex; i++) {
            if (allRows[i].classList.contains('taxonomy-tree-parent')) {
              newParentIndex++;
            }
          }

          // Move in categoriesTree
          const movedParent = window.categoriesTree.splice(oldParentIndex, 1)[0];
          window.categoriesTree.splice(newParentIndex, 0, movedParent);

          // Rebuild flat categories array
          rebuildFlatCategories();

          // Re-render to update data attributes and row numbers
          renderCategories();
          markDirty();

        } else if (isDraggingChild) {
          // Reordering children within same parent
          const parentIndex = parseInt(draggedRow.getAttribute('data-parent-index'));
          const oldChildIndex = parseInt(draggedRow.getAttribute('data-child-index'));

          // Calculate new child index within parent
          let newChildIndex = 0;
          const allRows = Array.from(tbody.children);
          const draggedRowIndex = allRows.indexOf(draggedRow);

          for (let i = 0; i < draggedRowIndex; i++) {
            const row = allRows[i];
            if (row.classList.contains('taxonomy-tree-child') &&
                row.getAttribute('data-parent-index') === String(parentIndex)) {
              newChildIndex++;
            }
          }

          // Move in categoriesTree children array
          const parent = window.categoriesTree[parentIndex];
          if (parent && parent.children) {
            const movedChild = parent.children.splice(oldChildIndex, 1)[0];
            parent.children.splice(newChildIndex, 0, movedChild);

            // Rebuild flat categories array
            rebuildFlatCategories();

            // Re-render to update data attributes and row numbers
            renderCategories();
            markDirty();
          }
        }
      }
    });
  }
}

/**
 * Rebuilds the flat categories array from the hierarchical categoriesTree
 * Maintains backwards compatibility with code expecting flat array
 *
 * @private
 */
function rebuildFlatCategories() {
  window.categories = [];

  window.categoriesTree.forEach(parent => {
    // Add parent
    window.categories.push(parent.item);

    // Add children
    if (parent.children && parent.children.length > 0) {
      parent.children.forEach(child => {
        window.categories.push(child.item);
      });
    }
  });
}

/**
 * Renders the tags list with drag-and-drop sorting
 *
 * Generates the HTML table rows for all tags, initializes Sortable.js
 * for drag-and-drop reordering, and updates the tag count badge.
 * Each row includes edit and delete buttons.
 *
 * @example
 * import { renderTags } from './modules/taxonomy.js';
 * renderTags();
 */
export function renderTags() {
  const tbody = document.getElementById('tags-list');
  const countBadge = document.getElementById('tags-count-badge');

  if (!tbody || !countBadge) return;

  const tags = window.tags || [];

  // Remove loading spinner if it exists
  const loadingRow = document.getElementById('tags-loading');
  if (loadingRow) {
    loadingRow.remove();
  }

  tbody.innerHTML = tags.map((tag, index) => {
    return `
    <tr class="small" class="cursor-move" data-index="${index}">
      <td class="px-3 py-2 text-muted">${index + 1}</td>
      <td class="px-3 py-2">
        <div class="d-flex align-items-center gap-2">
          <i class="fas fa-bars text-secondary flex-shrink-0"></i>
          <span class="fw-medium text-dark">${escapeHtml(tag)}</span>
        </div>
      </td>
      <td class="px-3 py-2 text-end text-nowrap">
        <button
          onclick="window.editTag(${index})"
          class="btn-icon-edit"
          title="Edit tag"
        >
          <i class="fas fa-edit"></i>
        </button>
        <button
          onclick="window.deleteTag(${index})"
          class="btn-icon-delete"
          title="Delete tag"
        >
          <i class="fas fa-trash"></i>
        </button>
      </td>
    </tr>
  `;
  }).join('');

  countBadge.textContent = tags.length;

  // Destroy previous Sortable instance if it exists
  if (window.sortableInstances && window.sortableInstances.tags) {
    window.sortableInstances.tags.destroy();
  }

  // Initialize sortable
  if (typeof Sortable !== 'undefined') {
    if (!window.sortableInstances) {
      window.sortableInstances = { categories: null, tags: null };
    }

    window.sortableInstances.tags = new Sortable(tbody, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      dragClass: 'sortable-drag',
      handle: 'tr',
      onEnd: (evt) => {
        const item = window.tags.splice(evt.oldIndex, 1)[0];
        window.tags.splice(evt.newIndex, 0, item);
        markDirty();
        // Don't call renderTags() here - causes excessive re-rendering
        // Sortable already updated the DOM visually
      }
    });
  }
}

/**
 * Finds a category by name in the tree and edits it
 *
 * @param {string} categoryName - Name of the category to edit
 */
export async function editCategoryByName(categoryName) {
  try {
    // Find the category in the tree
    let found = null;
    let isParent = false;
    let parentIndex = -1;
    let childIndex = -1;

    window.categoriesTree.forEach((parent, pIdx) => {
      if (parent.item === categoryName) {
        found = parent;
        isParent = true;
        parentIndex = pIdx;
      } else if (parent.children) {
        parent.children.forEach((child, cIdx) => {
          if (child.item === categoryName) {
            found = child;
            isParent = false;
            parentIndex = pIdx;
            childIndex = cIdx;
          }
        });
      }
    });

    if (!found) {
      showError('Category not found');
      return;
    }

    const newValue = await window.showModal('Edit Category', found.item);
    if (newValue === null) return;

    const trimmed = newValue.trim();
    if (!trimmed) {
      showError('Category name cannot be empty');
      return;
    }

    // Check for duplicates in flat list
    if (window.categories.includes(trimmed) && trimmed !== found.item) {
      showError('Category already exists');
      return;
    }

    // Update in tree
    if (isParent) {
      window.categoriesTree[parentIndex].item = trimmed;
    } else {
      window.categoriesTree[parentIndex].children[childIndex].item = trimmed;
    }

    // Rebuild flat array and re-render
    rebuildFlatCategories();
    renderCategories();
    hideMessages();

    // Auto-save
    await saveTaxonomy();
  } catch (error) {
    logger.error('Error editing category:', error);
    showError('Failed to edit category: ' + error.message);
  }
}

/**
 * Finds a category by name in the tree and deletes it
 *
 * @param {string} categoryName - Name of the category to delete
 */
export async function deleteCategoryByName(categoryName) {
  try {
    // Find the category in the tree
    let found = null;
    let isParent = false;
    let parentIndex = -1;
    let childIndex = -1;
    let hasChildren = false;

    window.categoriesTree.forEach((parent, pIdx) => {
      if (parent.item === categoryName) {
        found = parent;
        isParent = true;
        parentIndex = pIdx;
        hasChildren = parent.children && parent.children.length > 0;
      } else if (parent.children) {
        parent.children.forEach((child, cIdx) => {
          if (child.item === categoryName) {
            found = child;
            isParent = false;
            parentIndex = pIdx;
            childIndex = cIdx;
          }
        });
      }
    });

    if (!found) {
      showError('Category not found');
      return;
    }

    // Warn if deleting parent with children
    let confirmMessage = `Are you sure you want to delete "${categoryName}"?`;
    if (hasChildren) {
      confirmMessage = `Delete "${categoryName}" and all ${hasChildren} child ${hasChildren === 1 ? 'category' : 'categories'}?`;
    }

    const confirmed = await window.showConfirm(confirmMessage);
    if (!confirmed) return;

    // Delete from tree
    if (isParent) {
      window.categoriesTree.splice(parentIndex, 1);
    } else {
      window.categoriesTree[parentIndex].children.splice(childIndex, 1);
    }

    // Rebuild flat array and re-render
    rebuildFlatCategories();
    renderCategories();
    hideMessages();

    // Auto-save
    await saveTaxonomy();
  } catch (error) {
    logger.error('Error deleting category:', error);
    showError('Failed to delete category: ' + error.message);
  }
}

/**
 * Shows modal to add a new category
 *
 * Displays a modal dialog for entering a new category name, validates the input
 * (checks for empty names and duplicates), adds the category to the hierarchical tree,
 * and automatically saves changes to the backend.
 *
 * New categories are added as top-level parents with empty children arrays.
 *
 * @throws {Error} If category addition fails
 *
 * @example
 * import { showAddCategoryModal} from './modules/taxonomy.js';
 * await showAddCategoryModal();
 */
export async function showAddCategoryModal() {
  try {
    const newValue = await window.showModal('Add Category', '');
    if (newValue === null) return;

    const trimmed = newValue.trim();
    if (!trimmed) {
      showError('Category name cannot be empty');
      return;
    }

    if (window.categories.includes(trimmed)) {
      showError('Category already exists');
      return;
    }

    // Add to hierarchical tree as top-level parent
    window.categoriesTree.push({
      item: trimmed,
      slug: '',
      children: []
    });

    // Rebuild flat array and re-render
    rebuildFlatCategories();
    renderCategories();
    hideMessages();

    // Auto-save after adding
    await saveTaxonomy();
  } catch (error) {
    logger.error('Error adding category:', error);
    showError('Failed to add category: ' + error.message);
  }
}

/**
 * Shows modal to edit an existing category
 *
 * Displays a modal dialog pre-filled with the current category name, validates
 * the edited input (checks for empty names and duplicates), updates the category,
 * and automatically saves changes to the backend.
 *
 * @param {number} index - Index of the category to edit
 *
 * @throws {Error} If category update fails
 *
 * @example
 * import { editCategory } from './modules/taxonomy.js';
 * await editCategory(0);
 */
export async function editCategory(index) {
  const newValue = await window.showModal('Edit Category', window.categories[index]);
  if (newValue === null) return;

  const trimmed = newValue.trim();
  if (!trimmed) {
    showError('Category name cannot be empty');
    return;
  }

  if (window.categories.includes(trimmed) && trimmed !== window.categories[index]) {
    showError('Category already exists');
    return;
  }

  window.categories[index] = trimmed;
  renderCategories();
  hideMessages();

  // Auto-save after editing
  await saveTaxonomy();
}

/**
 * Deletes a category after user confirmation
 *
 * Shows a confirmation dialog, removes the category from the list if confirmed,
 * and automatically saves changes to the backend.
 *
 * @param {number} index - Index of the category to delete
 *
 * @throws {Error} If category deletion fails
 *
 * @example
 * import { deleteCategory } from './modules/taxonomy.js';
 * await deleteCategory(0);
 */
export async function deleteCategory(index) {
  const confirmed = await window.showConfirm(`Are you sure you want to delete "${window.categories[index]}"?`);
  if (!confirmed) return;

  window.categories.splice(index, 1);
  renderCategories();
  hideMessages();

  // Auto-save after deleting
  await saveTaxonomy();
}

/**
 * Shows modal to add a new tag
 *
 * Displays a modal dialog for entering a new tag name, validates the input
 * (checks for empty names and duplicates), adds the tag to the list,
 * and automatically saves changes to the backend.
 *
 * @throws {Error} If tag addition fails
 *
 * @example
 * import { showAddTagModal } from './modules/taxonomy.js';
 * await showAddTagModal();
 */
export async function showAddTagModal() {
  try {
    const newValue = await window.showModal('Add Tag', '');
    if (newValue === null) return;

    const trimmed = newValue.trim();
    if (!trimmed) {
      showError('Tag name cannot be empty');
      return;
    }

    if (window.tags.includes(trimmed)) {
      showError('Tag already exists');
      return;
    }

    window.tags.push(trimmed);
    renderTags();
    hideMessages();

    // Auto-save after adding
    await saveTaxonomy();
  } catch (error) {
    logger.error('Error adding tag:', error);
    showError('Failed to add tag: ' + error.message);
  }
}

/**
 * Shows modal to edit an existing tag
 *
 * Displays a modal dialog pre-filled with the current tag name, validates
 * the edited input (checks for empty names and duplicates), updates the tag,
 * and automatically saves changes to the backend.
 *
 * @param {number} index - Index of the tag to edit
 *
 * @throws {Error} If tag update fails
 *
 * @example
 * import { editTag } from './modules/taxonomy.js';
 * await editTag(0);
 */
export async function editTag(index) {
  const newValue = await window.showModal('Edit Tag', window.tags[index]);
  if (newValue === null) return;

  const trimmed = newValue.trim();
  if (!trimmed) {
    showError('Tag name cannot be empty');
    return;
  }

  if (window.tags.includes(trimmed) && trimmed !== window.tags[index]) {
    showError('Tag already exists');
    return;
  }

  window.tags[index] = trimmed;
  renderTags();
  hideMessages();

  // Auto-save after editing
  await saveTaxonomy();
}

/**
 * Deletes a tag after user confirmation
 *
 * Shows a confirmation dialog, removes the tag from the list if confirmed,
 * and automatically saves changes to the backend.
 *
 * @param {number} index - Index of the tag to delete
 *
 * @throws {Error} If tag deletion fails
 *
 * @example
 * import { deleteTag } from './modules/taxonomy.js';
 * await deleteTag(0);
 */
export async function deleteTag(index) {
  const confirmed = await window.showConfirm(`Are you sure you want to delete "${window.tags[index]}"?`);
  if (!confirmed) return;

  window.tags.splice(index, 1);
  renderTags();
  hideMessages();

  // Auto-save after deleting
  await saveTaxonomy();
}

/**
 * Saves taxonomy changes to the backend
 *
 * Sends a PUT request with current categories and tags to the API, handles
 * deployment tracking if changes result in a Git commit, and updates the UI state.
 *
 * @throws {Error} If save operation fails
 *
 * @example
 * import { saveTaxonomy } from './modules/taxonomy.js';
 * await saveTaxonomy();
 */
export async function saveTaxonomy() {
  const saveBtn = document.getElementById('save-btn');
  setButtonLoading(saveBtn, true, 'Saving...');

  try {
    const response = await fetch(`${window.API_BASE}/taxonomy`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        // Send both flat (backwards compat) and hierarchical data
        categories: window.categories,
        tags: window.tags,
        categoriesTree: window.categoriesTree,
        tagsTree: window.tagsTree
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save');
    }

    const data = await response.json();

    if (data.commitSha && window.trackDeployment) {
      window.trackDeployment(data.commitSha, 'Update taxonomy', 'taxonomy.yml');
    }

    // Update cache with all data formats
    setCache(TAXONOMY_CACHE_KEY, {
      categories: window.categories,
      tags: window.tags,
      categoriesTree: window.categoriesTree,
      tagsTree: window.tagsTree
    });

    // Update saved state
    window.lastSavedState = JSON.stringify({
      categories: window.categories,
      tags: window.tags,
      categoriesTree: window.categoriesTree,
      tagsTree: window.tagsTree
    });
    window.isDirty = false;

    showSuccess('Taxonomy saved successfully!');
    renderCategories();
    renderTags();
    updateSaveButton();
  } catch (error) {
    showError('Failed to save taxonomy: ' + error.message);
  } finally {
    setButtonLoading(saveBtn, false);
  }
}

/**
 * ===========================================================================
 * BULK TOOLS FUNCTIONS
 * ===========================================================================
 */

/**
 * Displays bulk tools results
 */
function showBulkResults(html) {
  const resultsArea = document.getElementById('bulk-tools-results');
  const resultsContent = document.getElementById('bulk-tools-results-content');

  if (resultsArea && resultsContent) {
    resultsContent.innerHTML = html;
    resultsArea.classList.remove('d-none');
  }
}

/**
 * Find all posts/pages using specific taxonomy terms
 */
export async function findTaxonomyUsage() {
  try {
    const type = document.getElementById('find-type').value;
    const termsInput = document.getElementById('find-terms').value.trim();

    if (!termsInput) {
      showError('Please enter search terms');
      return;
    }

    const terms = termsInput.split(',').map(t => t.trim()).filter(t => t);

    if (terms.length === 0) {
      showError('Please enter valid search terms');
      return;
    }

    hideMessages();

    const response = await fetch(`${window.API_BASE}/taxonomy-migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'find',
        type,
        terms
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to find usage');
    }

    const data = await response.json();

    // Build results HTML
    let html = `
      <div class="mb-3">
        <h6 class="fw-bold">Found ${data.totalAffected} ${data.totalAffected === 1 ? 'file' : 'files'} using: ${terms.join(', ')}</h6>
      </div>
    `;

    if (data.totalAffected > 0) {
      html += '<div class="table-responsive"><table class="table table-sm table-hover">';
      html += '<thead><tr><th>File</th><th>Matching Terms</th><th>All Terms</th></tr></thead>';
      html += '<tbody>';

      data.affected.forEach(file => {
        html += `<tr>
          <td><code class="small">${escapeHtml(file.path)}</code></td>
          <td><span class="badge bg-primary">${file.matchingTerms.map(escapeHtml).join('</span> <span class="badge bg-primary">')}</span></td>
          <td><small>${file.allTerms.map(escapeHtml).join(', ')}</small></td>
        </tr>`;
      });

      html += '</tbody></table></div>';
    } else {
      html += '<p class="text-muted">No files found using these terms.</p>';
    }

    showBulkResults(html);
  } catch (error) {
    logger.error('Error finding taxonomy usage:', error);
    showError('Failed to find usage: ' + error.message);
  }
}

/**
 * Rename a taxonomy term across all content
 */
export async function renameTaxonomy() {
  try {
    const type = document.getElementById('rename-type').value;
    const oldName = document.getElementById('rename-old').value.trim();
    const newName = document.getElementById('rename-new').value.trim();

    if (!oldName || !newName) {
      showError('Please enter both old and new names');
      return;
    }

    if (oldName === newName) {
      showError('Old and new names must be different');
      return;
    }

    // Confirm before proceeding
    const confirmed = await window.showConfirm(
      `Rename "${oldName}" to "${newName}" across all content?\n\nThis will update all posts and pages using this ${type}.`
    );

    if (!confirmed) return;

    hideMessages();

    const response = await fetch(`${window.API_BASE}/taxonomy-migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'rename',
        type,
        oldName,
        newName
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to rename');
    }

    const data = await response.json();

    // Build results HTML
    let html = `
      <div class="alert alert-success mb-3">
        <i class="fas fa-check-circle me-2"></i>
        Successfully renamed "${oldName}" to "${newName}" in ${data.updated.length} ${data.updated.length === 1 ? 'file' : 'files'}
      </div>
    `;

    if (data.updated.length > 0) {
      html += '<h6 class="fw-bold mb-2">Updated Files:</h6>';
      html += '<ul class="list-unstyled">';
      data.updated.forEach(file => {
        html += `<li><i class="fas fa-check text-success me-2"></i><code class="small">${escapeHtml(file.path)}</code></li>`;
      });
      html += '</ul>';
    }

    if (data.errors && data.errors.length > 0) {
      html += '<div class="alert alert-warning mt-3">';
      html += `<strong>Errors (${data.errors.length}):</strong><ul>`;
      data.errors.forEach(err => {
        html += `<li><code>${escapeHtml(err.path)}</code>: ${escapeHtml(err.error)}</li>`;
      });
      html += '</ul></div>';
    }

    showBulkResults(html);

    // Reload taxonomy to show updated list
    await loadTaxonomy();

    // Clear form
    document.getElementById('rename-old').value = '';
    document.getElementById('rename-new').value = '';
  } catch (error) {
    logger.error('Error renaming taxonomy:', error);
    showError('Failed to rename: ' + error.message);
  }
}

/**
 * Merge multiple taxonomy terms into one
 */
export async function mergeTaxonomy() {
  try {
    const type = document.getElementById('merge-type').value;
    const sourceInput = document.getElementById('merge-source').value.trim();
    const targetTerm = document.getElementById('merge-target').value.trim();

    if (!sourceInput || !targetTerm) {
      showError('Please enter source terms and target term');
      return;
    }

    const sourceTerms = sourceInput.split(',').map(t => t.trim()).filter(t => t);

    if (sourceTerms.length === 0) {
      showError('Please enter valid source terms');
      return;
    }

    if (sourceTerms.includes(targetTerm)) {
      showError('Target term cannot be in source terms');
      return;
    }

    // Confirm before proceeding
    const confirmed = await window.showConfirm(
      `Merge [${sourceTerms.join(', ')}] into "${targetTerm}" across all content?\n\nThis will replace all occurrences of the source ${type}s with the target ${type}.`
    );

    if (!confirmed) return;

    hideMessages();

    const response = await fetch(`${window.API_BASE}/taxonomy-migrate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operation: 'merge',
        type,
        sourceTerms,
        targetTerm
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to merge');
    }

    const data = await response.json();

    // Build results HTML
    let html = `
      <div class="alert alert-success mb-3">
        <i class="fas fa-check-circle me-2"></i>
        Successfully merged [${sourceTerms.join(', ')}] into "${targetTerm}" in ${data.updated.length} ${data.updated.length === 1 ? 'file' : 'files'}
      </div>
    `;

    if (data.updated.length > 0) {
      html += '<h6 class="fw-bold mb-2">Updated Files:</h6>';
      html += '<ul class="list-unstyled">';
      data.updated.forEach(file => {
        html += `<li><i class="fas fa-check text-success me-2"></i><code class="small">${escapeHtml(file.path)}</code></li>`;
      });
      html += '</ul>';
    }

    if (data.errors && data.errors.length > 0) {
      html += '<div class="alert alert-warning mt-3">';
      html += `<strong>Errors (${data.errors.length}):</strong><ul>`;
      data.errors.forEach(err => {
        html += `<li><code>${escapeHtml(err.path)}</code>: ${escapeHtml(err.error)}</li>`;
      });
      html += '</ul></div>';
    }

    showBulkResults(html);

    // Reload taxonomy to show updated list
    await loadTaxonomy();

    // Clear form
    document.getElementById('merge-source').value = '';
    document.getElementById('merge-target').value = '';
  } catch (error) {
    logger.error('Error merging taxonomy:', error);
    showError('Failed to merge: ' + error.message);
  }
}
