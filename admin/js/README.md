# Custom Jekyll Admin - ES6 Modules

Modular JavaScript architecture for the custom admin application using native ES6 modules with multi-page standalone architecture.

## Directory Structure

```
admin/js/
├── standalone-init.js  # Authentication helper for standalone pages
├── components/         # Shared UI components
│   ├── header.js       # Shared header with site title and logout
│   └── sidebar.js      # Shared sidebar navigation
├── core/               # Core utilities and shared functions
│   └── utils.js        # Utility functions (debounce, escapeHtml, etc.)
├── ui/                 # UI components and helpers
│   └── notifications.js # Success/error message system
├── modules/            # Feature modules
│   ├── posts.js        # Posts CRUD operations
│   ├── pages.js        # Pages CRUD operations
│   ├── media.js        # Cloudinary media library integration
│   ├── taxonomy.js     # Categories and tags management
│   ├── trash.js        # Bin/soft delete system
│   ├── settings.js     # Site settings editor
│   └── deployments.js  # GitHub Actions deployment tracking
├── test.html           # Module testing interface
└── README.md           # This file
```

## Standalone Page Helpers ✅

### standalone-init.js

Authentication wrapper for standalone pages that handles Netlify Identity initialization.

**Exports:**
- `waitForAuth()` - Promise-based wrapper that waits for Netlify Identity to initialize
- `initStandalonePage(pageName, initCallback)` - Initialize auth and run page-specific setup

**Features:**
- Waits for Netlify Identity `init` event with fallback polling
- 5-second timeout with graceful handling
- TEST_MODE support for E2E testing (`localStorage.setItem('TEST_MODE', 'true')`)
- Shows/hides auth gate and main app based on authentication status
- Calls page-specific initialization callback after successful auth
- Error handling with user-friendly error messages

**Usage:**
```javascript
import { initStandalonePage } from '/admin/js/standalone-init.js';

const init = async () => {
  await initStandalonePage('posts', async (user) => {
    // User is authenticated - initialize page here
    initHeader();
    initSidebar('posts');
    await loadPosts();
  });
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

**Integration Pattern:**
Every standalone page (posts, pages, media, etc.) uses this helper for consistent authentication handling.

## Shared Components ✅

### components/header.js

Reusable header component with site title and user actions.

**Exports:**
- `initHeader()` - Renders header into `#header-container` on any page

**Features:**
- Displays dynamically loaded site title from settings
- Shows current user email from Netlify Identity
- Logout button that redirects to dashboard
- Consistent header across all standalone pages

**Usage:**
```javascript
import { initHeader } from '/admin/js/components/header.js';

// Call after authentication succeeds
initHeader();
```

**HTML Requirements:**
Page must have `<div id="header-container"></div>` in the layout.

### components/sidebar.js

Reusable sidebar navigation component with active page highlighting.

**Exports:**
- `initSidebar(activePage)` - Renders sidebar into `#sidebar-container` with specified active page

**Features:**
- Navigation links to all admin sections (Dashboard, Posts, Pages, Media, Categories, Tags, Bin, Settings)
- Active page highlighting with teal background
- Font Awesome icons for each section
- Consistent sidebar across all standalone pages
- Responds to sidebar toggle events from header

**Usage:**
```javascript
import { initSidebar } from '/admin/js/components/sidebar.js';

// Highlight 'posts' as active page
initSidebar('posts');
```

**Valid Page Names:**
`'dashboard'`, `'posts'`, `'pages'`, `'media'`, `'categories'`, `'tags'`, `'bin'`, `'settings'`

**HTML Requirements:**
Page must have `<div id="sidebar-container"></div>` in the layout.

## Phase 1: Core Utilities ✅ Complete

### core/utils.js

Shared utility functions used throughout the application.

**Exports:**
- `FETCH_TIMEOUT` - Constant for fetch timeout (30000ms)
- `DEBOUNCE_DELAY` - Constant for debounce delay (300ms)
- `debounce(func, wait)` - Debounce function calls
- `asyncHandler(fn)` - Wrap async functions with error handling
- `fetchWithTimeout(url, options, timeout)` - Fetch with timeout
- `setButtonLoading(button, loading, text)` - Button loading states
- `escapeHtml(text)` - Escape HTML for XSS prevention
- `isValidUrl(string)` - Validate URL strings

**Usage:**
```javascript
import { debounce, escapeHtml } from './core/utils.js';

const debouncedSearch = debounce((query) => {
  console.log('Searching for:', query);
}, 300);

const safe = escapeHtml('<script>alert("XSS")</script>');
```

### ui/notifications.js

User notification system with success and error messages.

**Exports:**
- `initNotifications()` - Initialize notification system (call on DOM ready)
- `showError(message)` - Display error message (auto-dismiss after 5s)
- `showSuccess(message)` - Display success message (auto-dismiss after 5s)
- `hideMessages()` - Hide all notifications

**Usage:**
```javascript
import { initNotifications, showError, showSuccess } from './ui/notifications.js';

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initNotifications();
});

// Show messages
showSuccess('Post saved successfully!');
showError('Failed to save post');
```

## Phase 2: Trash Module ✅ Complete

### modules/trash.js

Trash management functionality for soft-deleted posts and pages.

## Phase 3: Settings Module ✅ Complete

### modules/settings.js

Site configuration settings management from _config.yml.

**Exports:**
- `loadTrash()` - Load all trashed items from backend
- `restoreItem(filename, sha, type)` - Restore item from trash with deployment tracking
- `permanentlyDeleteItem(filename, sha, type)` - Permanently delete item (cannot be undone)
- `getTrashedItems()` - Get current trashed items array (read-only access)

**Features:**
- Fetches trashed items from `/trash` API endpoint
- Renders trash list with restore and delete actions
- Tracks deployments when restoring or permanently deleting items
- Automatically reloads posts or pages list after restore
- Formats timestamps in GB locale
- Type badges (Post/Page) with color coding

**Dependencies:**
- `core/utils.js` - Uses `escapeHtml()` for XSS prevention
- `ui/notifications.js` - Uses `showError()` and `showSuccess()`
- Global `API_BASE` constant
- Global `showConfirm()` function for confirmation dialogs
- Global `trackDeployment()` function for deployment monitoring
- Global `loadPosts()` and `loadPages()` functions for refreshing lists

**Usage:**
```javascript
import {
  loadTrash,
  restoreItem,
  permanentlyDeleteItem
} from './modules/trash.js';

// Load trash items
await loadTrash();

// Restore an item
await restoreItem('my-post.md', 'abc123sha', 'post');

// Permanently delete an item
await permanentlyDeleteItem('old-post.md', 'def456sha', 'post');
```

**Integration:**
The Trash module is loaded in `index.html` and functions are exposed to `window` for onclick handlers:
```javascript
window.loadTrash = loadTrash;
window.restoreItem = restoreItem;
window.permanentlyDeleteItem = permanentlyDeleteItem;
```

## Phase 3: Settings Module ✅ Complete

### modules/settings.js

Site configuration settings management from _config.yml.

**Exports:**
- `loadSettings()` - Load site settings from backend and populate form fields
- `saveSettings(event)` - Save settings with type conversion and deployment tracking

**Features:**
- Loads settings from `/settings` API endpoint
- Populates form inputs with matching IDs (format: `setting-{key}`)
- Converts number fields appropriately (paginate, related_posts_count)
- Tracks deployments when settings are saved
- Updates button states during save operation (Saving.../Save Settings)
- Handles form submission with loading states

**Dependencies:**
- `ui/notifications.js` - Uses `showError()` and `showSuccess()`
- Global `API_BASE` constant
- Global `trackDeployment()` function for deployment monitoring

**Usage:**
```javascript
import {
  loadSettings,
  saveSettings
} from './modules/settings.js';

// Load settings on section switch
await loadSettings();

// Attach save handler to form
document.getElementById('settings-form').addEventListener('submit', saveSettings);
```

**Integration:**
The Settings module is loaded in `index.html` and functions are exposed to `window`:
```javascript
window.loadSettings = loadSettings;
window.saveSettings = saveSettings;
```

## Phase 4: Media Module ✅ Complete

### modules/media.js

Cloudinary media library management with browsing, uploading, and pagination.

**Exports:**
- `loadMedia()` - Load media files from Cloudinary API
- `renderMediaGrid()` - Render paginated grid with thumbnails and actions
- `updateMediaPagination(totalPages)` - Update pagination UI controls
- `changeMediaPage(delta)` - Change current page (+1 for next, -1 for previous)
- `filterMedia()` - Filter media by search term, reset to page 1
- `debouncedFilterMedia` - Debounced version of filterMedia for search input
- `copyMediaUrl(url)` - Copy media URL to clipboard
- `viewMediaFull(url)` - Open media in full-size modal
- `openCloudinaryUpload()` - Open Cloudinary upload widget

**Features:**
- Fetches media from Cloudinary via `/media` API endpoint
- Paginated grid view with 20 items per page
- Search by filename and filter (all/images/recent)
- Thumbnail generation with Cloudinary transformations
- Click to copy URL or view full size
- Upload new images via Cloudinary widget
- Automatic reload after successful upload
- Recent uploads filter (last 7 days)

**Dependencies:**
- `core/utils.js` - Uses `escapeHtml()` and `debounce()`
- `ui/notifications.js` - Uses `showError()` and `showSuccess()`
- Global `API_BASE` constant
- Global state: `allMedia`, `currentMediaPage`, `mediaPerPage`, `cloudinaryUploadWidget`
- Global `handleImageModalEscape()` function (shared with other features)
- External: Cloudinary Upload Widget library (loaded in index.html)

**Usage:**
```javascript
import {
  loadMedia,
  renderMediaGrid,
  filterMedia,
  copyMediaUrl
} from './modules/media.js';

// Load media library
await loadMedia();

// Filter media
document.getElementById('media-search').addEventListener('input', debouncedFilterMedia);

// Copy URL
await copyMediaUrl('https://res.cloudinary.com/.../image.jpg');
```

**Integration:**
The Media module is loaded in `index.html` and all functions are exposed to `window` for onclick handlers:
```javascript
window.loadMedia = loadMedia;
window.renderMediaGrid = renderMediaGrid;
window.copyMediaUrl = copyMediaUrl;
// ... etc
```

## Testing

Open `test.html` in a browser to verify all modules work correctly:

```
http://localhost:8888/admin-custom/js/test.html
```

Or with Netlify Dev:
```bash
netlify dev
```

Tests included:
- ✅ Debounce function
- ✅ Notifications (error/success/hide)
- ✅ Button loading states
- ✅ HTML escaping
- ✅ URL validation
- ✅ Async error handling

## Browser Support

ES6 modules require modern browsers:
- ✅ Chrome/Edge 61+
- ✅ Firefox 60+
- ✅ Safari 11+
- ✅ Opera 48+
- ❌ IE11 (not supported)

## Migration Plan

### Phase 1: Core Utilities ✅ (Current)
- Extract shared utilities
- Extract UI notifications
- Create test suite
- Keep `app.js` intact as backup

### Phase 2: First Module ✅ Complete
- ✅ Extracted Trash module (smallest module)
- ✅ Tested module syntax validation
- ✅ Integrated with existing app via index.html module script
- ✅ Commented out old implementations in app.js

### Phase 3: Settings Module ✅ Complete
- ✅ Extracted Settings module (2 functions)
- ✅ Tested module syntax validation
- ✅ Integrated with index.html module script
- ✅ Commented out old implementations in app.js

### Phase 4: Media Module ✅ Complete
- ✅ Extracted Media module (8 functions + 1 helper)
- ✅ Handled Cloudinary integration and external library
- ✅ Tested module syntax validation
- ✅ Integrated with index.html module script
- ✅ Commented out old implementations in app.js
- ✅ Maintained shared state via window object

### Phase 5: Remaining Modules (Planned)
- Extract remaining modules (Taxonomy, Posts, Pages, Deployments)
- Continue with smallest-first or most-isolated-first strategy
- Eventually remove old `app.js` when all modules extracted

### Phase 6: Optimization (Future)
- Add lazy loading
- Code splitting by route
- Consider TypeScript migration

## Benefits

### Current Benefits (Phase 1)
- ✅ **Reusable code** - Import utilities anywhere
- ✅ **Better organization** - Clear file structure
- ✅ **No build step** - Native browser support
- ✅ **Easy testing** - Test modules in isolation

### Future Benefits (Phase 2+)
- ✅ **Smaller files** - Easier to navigate
- ✅ **Faster development** - Work on isolated modules
- ✅ **Better IDE support** - Autocomplete and navigation
- ✅ **Team collaboration** - Multiple devs, different modules

## Best Practices

### Importing
```javascript
// Named imports (preferred)
import { debounce, escapeHtml } from './core/utils.js';

// Import all (use sparingly)
import * as utils from './core/utils.js';
```

### Exporting
```javascript
// Named exports (preferred for utilities)
export function myFunction() { }
export const MY_CONSTANT = 123;

// Default export (use for main module functionality)
export default class MyClass { }
```

### File Organization
- One module per file
- Group related functions together
- Keep files under 500 lines when possible
- Use clear, descriptive names

### Dependencies
- Minimize dependencies between modules
- Document required global variables
- Use initialization functions where needed

## Troubleshooting

### Module Not Found
**Error:** `Failed to load module script: The server responded with a non-JavaScript MIME type`

**Solution:** Ensure your server sends correct MIME type for `.js` files:
- Content-Type: `application/javascript` or `text/javascript`
- Netlify handles this automatically

### CORS Errors
**Error:** `Access to script at '...' from origin '...' has been blocked by CORS policy`

**Solution:**
- Use a local server (Netlify Dev, http-server, etc.)
- Don't open `file://` URLs directly

### Import Path Issues
**Error:** `Failed to resolve module specifier "./utils.js"`

**Solution:**
- Always use relative paths: `./core/utils.js` not `core/utils.js`
- Include `.js` extension: `./utils.js` not `./utils`
- Check path case sensitivity

## Future Enhancements

Consider adding later:
- **Vite** - Fast dev server with HMR
- **TypeScript** - Type safety and better IDE support
- **Testing Framework** - Jest or Vitest for unit tests
- **Code Splitting** - Lazy load modules by route
- **Bundle Analysis** - Optimize module size

## Resources

- [MDN: JavaScript Modules](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules)
- [ES6 Modules in Browsers](https://caniuse.com/es6-module)
- [V8 Module Loading](https://v8.dev/features/modules)

## Contributing

When adding new modules:
1. Follow existing file structure
2. Add comprehensive JSDoc documentation
3. Export all public functions
4. Add tests to `test.html`
5. Update this README

## Phase 5: Taxonomy Module ✅ Complete

### modules/taxonomy.js

Category and tag taxonomy management with drag-and-drop reordering.

**Exports:**
- `loadTaxonomy()` - Load categories and tags from backend
- `switchTaxonomyTab(tabName)` - Switch between categories/tags tabs
- `renderCategories()` - Render categories list with Sortable.js
- `renderTags()` - Render tags list with Sortable.js
- `showAddCategoryModal()` - Show modal to add new category
- `addCategory()` - Legacy wrapper for showAddCategoryModal()
- `editCategory(index)` - Edit existing category
- `deleteCategory(index)` - Delete category with confirmation
- `showAddTagModal()` - Show modal to add new tag
- `addTag()` - Legacy wrapper for showAddTagModal()
- `editTag(index)` - Edit existing tag
- `deleteTag(index)` - Delete tag with confirmation
- `saveTaxonomy()` - Save taxonomy changes to backend

**Features:**
- Loads taxonomy from `/taxonomy` API endpoint
- Drag-and-drop reordering with Sortable.js integration
- Automatic save after add/edit/delete operations
- Dirty state tracking with visual feedback
- Tab switching between categories and tags
- Modal dialogs for add/edit operations
- Deployment tracking for all save operations

**Dependencies:**
- `core/utils.js` - Uses `escapeHtml()` and `setButtonLoading()`
- `ui/notifications.js` - Uses `showError()`, `showSuccess()`, and `hideMessages()`
- Global `API_BASE` constant
- Global state: `categories`, `tags`, `lastSavedState`, `isDirty`, `sortableInstances`
- Global `showModal()` and `showConfirm()` functions
- Global `trackDeployment()` function
- External: Sortable.js library for drag-and-drop

**Integration:**
The Taxonomy module is loaded in `index.html` and all functions are exposed to `window`:
```javascript
window.loadTaxonomy = loadTaxonomy;
window.switchTaxonomyTab = switchTaxonomyTab;
window.renderCategories = renderCategories;
// ... etc
```

## Phase 6: Posts Module ✅ Complete

### modules/posts.js

Complete posts management with CRUD operations, taxonomy integration, and markdown editing.

**Exports:** 36 functions including:
- `loadPosts()` - Load posts from backend with metadata
- `renderPostsList()` - Render paginated posts table
- `editPost()` - Load post into editor form
- `savePost()` - Save post changes with deployment tracking
- `deletePost()` - Soft delete (move to trash)
- `initMarkdownEditor()` - Initialize EasyMDE for content editing
- `populateTaxonomySelects()` - Populate category/tag selectors
- `initCloudinaryWidget()` - Initialize featured image selector
- Plus pagination, filtering, sorting, and UI helpers

**Features:**
- Full CRUD operations for Jekyll posts
- Markdown editing with EasyMDE
- Taxonomy (categories/tags) integration with autocomplete
- Featured image selection via Cloudinary
- Search and filter with debounce
- Pagination (20 posts per page)
- Sort by date or title
- Deployment tracking for all operations
- Unsaved changes detection

**Dependencies:**
- `core/utils.js` - Utilities (escapeHtml, debounce, etc.)
- `ui/notifications.js` - Success/error messages
- Global state: allPosts, currentPost, markdownEditor, selectedCategories, selectedTags
- External: EasyMDE, Cloudinary Widget

## Phase 7: Pages Module ✅ Complete

### modules/pages.js

Pages management with auto-permalink generation and protected page support.

**Exports:** 18 functions including:
- `loadPages()` - Load pages from backend
- `renderPagesList()` - Render pages table with protected indicators
- `editPage()` - Load page into editor form
- `savePage()` - Save page changes with deployment tracking
- `deletePage()` - Soft delete (protected pages cannot be deleted)
- `initPageMarkdownEditor()` - Initialize EasyMDE for content editing
- `slugifyPermalink()` - Convert title to URL-safe permalink
- `autoPopulatePermalink()` - Auto-generate permalink from title
- Plus filtering and UI helpers

**Features:**
- Full CRUD operations for Jekyll pages
- Auto-generated permalinks from titles
- Protected pages (cannot be deleted)
- Markdown editing with separate EasyMDE instance
- Search and filter
- Manual permalink override tracking
- Deployment tracking for all operations
- Unsaved changes detection

**Dependencies:**
- `core/utils.js` - Utilities (escapeHtml, debounce, etc.)
- `ui/notifications.js` - Success/error messages
- Global state: allPages, currentPage_pages, pageMarkdownEditor, permalinkManuallyEdited
- External: EasyMDE

## Phase 8: Deployments Module ✅ Complete

### modules/deployments.js

GitHub Actions deployment tracking and status monitoring.

**Exports:** 16 functions including:
- `trackDeployment(commitSha, action, itemId)` - Track new deployment
- `restoreActiveDeployments()` - Restore in-progress deployments on page load
- `updateDashboardDeployments()` - Render dashboard deployment widget
- `startDeploymentPolling()` - Poll GitHub Actions for status updates
- `showDeploymentBanner()` - Display live deployment status banner
- `getDeploymentHistory()` - Merge localStorage + GitHub API data
- Plus history management and UI helpers

**Features:**
- Real-time deployment status tracking
- GitHub Actions API integration
- Live deployment banner with elapsed time
- Deployment history with localStorage caching
- Dashboard widget with recent deployments
- Collapsible skipped/cancelled deployments
- Auto-reload affected content on completion
- Relative time formatting ("2m ago", "3h ago")

**Dependencies:**
- `core/utils.js` - Uses escapeHtml()
- Global constants: API_BASE, DEPLOYMENT_STATUS_POLL_INTERVAL, etc.
- Global state: activeDeployments, deploymentPollInterval, historyPollInterval
- Calls loadPosts(), loadPages(), loadTrash() on completion

## Status

- **Standalone Helpers**: ✅ Complete (standalone-init.js - 2 functions)
- **Shared Components**: ✅ Complete (header.js, sidebar.js - 2 functions)
- **Phase 1**: ✅ Complete (Core utilities and UI notifications - 8 functions)
- **Phase 2**: ✅ Complete (Trash module - 4 functions)
- **Phase 3**: ✅ Complete (Settings module - 2 functions)
- **Phase 4**: ✅ Complete (Media module - 9 functions)
- **Phase 5**: ✅ Complete (Taxonomy module - 13 functions)
- **Phase 6**: ✅ Complete (Posts module - 36 functions)
- **Phase 7**: ✅ Complete (Pages module - 18 functions)
- **Phase 8**: ✅ Complete (Deployments module - 16 functions)
- **Phase 9**: 💡 Future (Optimization - TypeScript, lazy loading, code splitting)

**Total:** 110 functions across 10 modules + 2 components

---

**Version:** 10.0.0 (Multi-page standalone architecture complete)
**Last Updated:** October 2025
**Architecture:** Multi-page with shared components
