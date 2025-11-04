# Custom Jekyll Admin

A lightweight, GitHub-powered content management system for Jekyll sites with a modern multi-page architecture.

## 🎯 Overview

This custom admin provides a WordPress-style interface for managing your Jekyll blog without requiring a database. All content is stored in GitHub, ensuring version control and seamless integration with your existing workflow.

### Key Features

- ✅ **Multi-Page Architecture** - Standalone pages for Posts, Pages, Media, Categories, Tags, Bin, and Settings
- ✅ **Post Management** - Create, edit, and delete blog posts with markdown editor
- ✅ **Page Management** - Create and manage Jekyll pages with auto-generated permalinks
- ✅ **Media Library** - Browse, upload, search, and manage Cloudinary images with pagination
- ✅ **Category Management** - Organize categories with drag-and-drop sorting
- ✅ **Tag Management** - Manage tags with drag-and-drop reordering
- ✅ **Settings Editor** - Modify `_config.yml` through an intuitive interface
- ✅ **Bin System** - Soft delete with restore capability for posts and pages
- ✅ **Protected Pages** - Special indicator for pages that cannot be deleted
- ✅ **Deployment Tracking** - Real-time GitHub Actions deployment monitoring with live status
- ✅ **Image Previews** - Cloudinary integration with thumbnail and full-size modal
- ✅ **WordPress-style UX** - Autocomplete taxonomy, collapsible categories, unsaved changes protection
- ✅ **Shared Components** - Reusable header and sidebar across all pages
- ✅ **Mobile Responsive** - Works on all devices
- ✅ **ES6 Modules** - Clean, modular JavaScript architecture with 110 functions across 10 modules + 2 components

---

## 🚀 Getting Started

### Access the Admin

- **Production**: https://yourdomain.com/admin/
- **Local**: http://localhost:8888/admin/ (with Netlify Dev)

### Authentication

1. Navigate to `/admin/`
2. Click "Log In"
3. Authenticate with Netlify Identity

### Environment Setup

The Media Library requires the following environment variable in Netlify:

1. Go to **Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. Add `CLOUDINARY_API_SECRET` with your Cloudinary API Secret
3. Find your API Secret at: https://console.cloudinary.com/settings/api-keys
4. Trigger a redeploy after adding the variable

---

## 📚 Quick Guide

### Dashboard
- Access the main dashboard at `/admin/`
- View recent posts, pages, and deployment status
- Navigate to different sections via the sidebar

### Posts (`/admin/posts/`)
- Browse all posts in a sortable, paginated table
- Click **New Post** to create a post
- Fill in title, date, image, categories, tags
- Use **Browse Library** button to select featured images from Cloudinary
- Write content in Markdown with EasyMDE editor
- Click **Save Post** to commit changes
- Delete posts to move them to the bin

### Pages (`/admin/pages/`)
- Browse all Jekyll pages in a filterable list
- Click **New Page** to create a page
- Permalinks are auto-generated from titles (can be manually overridden)
- Protected pages show a lock icon and cannot be deleted
- Write content in Markdown with dedicated EasyMDE editor
- Click **Save Page** to commit changes

### Media Library (`/admin/media/`)
- Browse all images from Cloudinary in a paginated grid (20 per page)
- Use search to find images by filename
- Filter by "All Media", "Images Only", or "Recently Uploaded"
- Click **Upload Image** to add new files via Cloudinary widget
- Click images to copy URL or view full size
- Navigate between pages with pagination controls

### Categories (`/admin/categories/`)
- View and manage all post categories
- Drag and drop to reorder categories
- Click **Add Category** to create new categories
- Edit or delete existing categories
- Changes are saved immediately to `_data/categories.yml`

### Tags (`/admin/tags/`)
- View and manage all post tags
- Drag and drop to reorder tags
- Click **Add Tag** to create new tags
- Edit or delete existing tags
- Changes are saved immediately to `_data/tags.yml`

### Bin (`/admin/bin/`)
- View all soft-deleted posts and pages
- Click **Restore** to restore items back to their original location
- Click **Permanently Delete** to remove items permanently (cannot be undone)
- Empty bin shows helpful empty state

### Settings (`/admin/settings/`)
- Modify site configuration from `_config.yml`
- Edit site title, description, social links, and other settings
- Click **Save Settings** to commit changes (triggers rebuild)

---

## 📁 File Structure

```
/admin/
├── index.html                      # Dashboard (main entry point)
├── posts/
│   └── index.html                  # Posts management page
├── pages/
│   └── index.html                  # Pages management page
├── media/
│   └── index.html                  # Media library page
├── categories/
│   └── index.html                  # Categories management page
├── tags/
│   └── index.html                  # Tags management page
├── bin/
│   └── index.html                  # Bin (soft-deleted items) page
├── settings/
│   └── index.html                  # Settings editor page
├── js/
│   ├── standalone-init.js          # Auth helper for standalone pages
│   ├── components/
│   │   ├── header.js               # Shared header component
│   │   └── sidebar.js              # Shared sidebar component
│   ├── core/
│   │   └── utils.js                # Core utilities (debounce, escapeHtml, etc.)
│   ├── ui/
│   │   └── notifications.js        # Success/error notification system
│   └── modules/
│       ├── posts.js                # Posts CRUD operations
│       ├── pages.js                # Pages CRUD operations
│       ├── media.js                # Cloudinary media management
│       ├── taxonomy.js             # Categories and tags management
│       ├── trash.js                # Bin/trash functionality
│       ├── settings.js             # Settings editor
│       └── deployments.js          # GitHub Actions tracking
├── app.js                          # Legacy application logic (dashboard only)
├── styles.css                      # Shared styles (Tailwind-inspired utilities)
├── sw.js                           # Service Worker (caching)
├── README.md                       # This file
├── OPTIMIZATION-GUIDE.md           # Performance documentation
└── FEATURES-ROADMAP.md             # Future features roadmap
```

### Architecture

The admin uses a **multi-page standalone architecture**:

- Each section (Posts, Pages, Media, etc.) is a separate HTML page with its own route
- Shared components (header, sidebar) are loaded via ES6 modules
- Authentication is handled by `standalone-init.js` which wraps Netlify Identity
- All pages use the same base styles from `styles.css`
- ES6 modules provide clean separation of concerns (110 functions across 10 modules + 2 components)

---

## 🏗️ Technical Details

### Standalone Page Pattern

Each standalone page (`/admin/posts/`, `/admin/pages/`, etc.) follows this pattern:

1. **HTML Structure**: Includes auth gate, main app container, header/sidebar containers, and section-specific content
2. **ES6 Module Imports**: Import required modules (standalone-init, components, feature modules)
3. **Initialization**: Call `initStandalonePage(pageName, initCallback)` with page-specific setup
4. **Authentication**: `waitForAuth()` handles Netlify Identity with TEST_MODE support for E2E testing
5. **Shared UI**: `initHeader()` and `initSidebar(activePage)` render consistent navigation

**Example**:
```javascript
import { initStandalonePage } from '/admin/js/standalone-init.js';
import { initHeader } from '/admin/js/components/header.js';
import { initSidebar } from '/admin/js/components/sidebar.js';
import { loadPosts } from '/admin/js/modules/posts.js';

const init = async () => {
  await initStandalonePage('posts', async (user) => {
    initHeader();
    initSidebar('posts');
    await loadPosts();
  });
};
```

### Deployment Tracking

All content changes (posts, pages, settings, taxonomy) trigger GitHub Actions deployments:

- **Real-time Status**: Live deployment banner shows progress with elapsed time
- **History Tracking**: Dashboard widget displays recent deployments with status badges
- **Auto-reload**: Content lists automatically refresh when deployments complete
- **Persistence**: Active deployments are stored in localStorage and restored on page reload
- **Polling**: GitHub Actions API is polled every 10 seconds for status updates

### Sitemap Generation

Sitemap is automatically generated and updated via the `jekyll-sitemap` plugin:

- **Auto-generation**: Sitemap is created on every Jekyll build
- **Location**: Available at `/sitemap.xml`
- **Format**: Standard XML sitemap protocol with lastmod dates
- **Updates**: Automatically updated whenever content changes trigger a rebuild

### Test Mode

For E2E testing without real authentication:

```javascript
localStorage.setItem('TEST_MODE', 'true');
// Bypass authentication with mock user
```

---

## 🔧 Documentation

- **Main Guide**: This README
- **JS Modules**: [js/README.md](./js/README.md) - Detailed ES6 module documentation
- **Optimizations**: [OPTIMIZATION-GUIDE.md](./OPTIMIZATION-GUIDE.md)
- **Future Features**: [FEATURES-ROADMAP.md](./FEATURES-ROADMAP.md)

---

**Version**: 2.0.0 | **Status**: Production Ready ✅
**Architecture**: Multi-page standalone | **Modules**: 110 functions across 10 ES6 modules + 2 components
