# Circle Seven Website

[![Netlify Status](https://api.netlify.com/api/v1/badges/96601e8b-600c-4aa5-acd1-e91aa68cafad/deploy-status)](https://app.netlify.com/sites/prismatic-donut-15ed74/deploys)
[![Hosted on Cloudflare](https://img.shields.io/badge/DNS-Cloudflare-F38020?logo=cloudflare&logoColor=white)](https://www.cloudflare.com/)
[![Images on Cloudinary](https://img.shields.io/badge/Images-Cloudinary-3448C5?logo=cloudinary&logoColor=white)](https://cloudinary.com/)
[![Jekyll](https://img.shields.io/badge/Jekyll-3.9+-CC0000?logo=jekyll&logoColor=white)](https://jekyllrb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Portfolio and blog documenting Digital Art and Technology projects, academic work, and creative coding experiments from Plymouth University.

🌐 **Live Site:** [https://circleseven.co.uk](https://circleseven.co.uk)

## Overview

This site showcases coursework and projects from a BA (Hons) Digital Art & Technology degree at Plymouth University (2015-2019), covering:

- Interactive media and physical computing
- Creative coding and generative art
- Digital photography and motion graphics
- Retro computing and game development
- Web technologies and mobile development

## Infrastructure

Modern, performant static site built on free, enterprise-grade services:

| Service | Purpose | Tier |
|---------|---------|------|
| **[Netlify](https://netlify.com)** | Hosting & CDN | Free (100GB/month) |
| **[Cloudflare](https://cloudflare.com)** | DNS & Email Routing | Free |
| **[Cloudinary](https://cloudinary.com)** | Image CDN & Optimization | Free (25GB storage) |
| **[GitHub](https://github.com)** | Source Control & CI/CD | Free |
| **[Decap CMS](https://decapcms.org)** | Content Management (Alternative) | Free |
| **Custom Admin** | Advanced Multi-Page CMS (Jekyll-native) | Free |

### Architecture Flow

```
┌─────────────┐
│   Visitor   │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│   Cloudflare    │ ◄── DNS & Email Routing
│   (DNS/CDN)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│    Netlify      │ ◄── Site Hosting
│  (Static Host)  │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌──────────┐
│ GitHub │ │Cloudinary│ ◄── Images
│(Source)│ │  (CDN)   │
└────────┘ └──────────┘
```

## Technical Stack

- **Generator:** Jekyll 3.9+ static site generator
- **Hosting:** Netlify with automated deployments
- **DNS:** Cloudflare (circleseven.co.uk)
- **Email:** Cloudflare Email Routing → Gmail
- **Images:** Cloudinary CDN with automatic optimization
- **CMS:** Decap CMS + Custom Admin (GitHub-powered)
- **Theme:** Minima (heavily customized)
- **Content:** 79 blog posts across 22 categories

### Key Features

✅ Responsive mega menu navigation
✅ Full-text search with Lunr.js
✅ Category and tag-based organization (21 categories, 31 tags)
✅ Pagination (10 posts per page on site, configurable in admin)
✅ Smart related posts algorithm (3-tier relevance matching)
✅ Embedded content support (YouTube, Vimeo, SoundCloud, Leaflet maps, Sketchfab)
✅ Cloudinary image CDN with automatic optimization
✅ Featured images with lazy loading
✅ Mobile-first responsive design
✅ SEO optimized with structured data (JSON-LD)
✅ WCAG AA accessibility compliance
✅ Custom CMS editor components (maps, galleries, videos)
✅ Checkbox-based taxonomy selection in admin
✅ Deploy status badge in CMS admin

## Directory Structure

```
circleseven-website/
├── _config.yml              # Site configuration
├── _includes/               # Reusable components
│   ├── header.html          # Navigation and menu
│   ├── footer.html          # Footer
│   ├── head.html            # Custom head with Netlify Identity
│   ├── structured-data.html # JSON-LD schemas
│   └── skip-to-content.html # Accessibility skip link
├── _layouts/
│   ├── default.html         # Base layout
│   ├── post.html            # Blog post layout
│   ├── page.html            # Static page layout
│   ├── category.html        # Category archive layout
│   └── tag.html             # Tag archive layout
├── _posts/                  # Blog posts (79 markdown files)
├── assets/
│   ├── css/
│   │   ├── variables.css    # CSS custom properties (teal theme)
│   │   ├── layout.css       # Main layout styles
│   │   ├── menu.css         # Navigation styles
│   │   ├── cards.css        # Post card components
│   │   ├── embeds.css       # Embedded content styles
│   │   ├── gallery.css      # Image gallery styles
│   │   └── tags.css         # Tag cloud styles
│   └── js/
│       ├── menu.js          # Mobile menu interactions
│       ├── embeds.js        # Embed handling (Leaflet, Sketchfab)
│       ├── lightbox.js      # GLightbox integration
│       └── lazy-cards.js    # Lazy loading for post cards
├── category/                # Category landing pages (22 pages)
├── tag/                     # Tag landing pages
├── admin/                   # Custom Admin CMS (GitHub-powered, multi-page)
│   ├── index.html           # Dashboard (main entry point)
│   ├── posts/index.html     # Posts management page
│   ├── pages/index.html     # Pages management page
│   ├── media/index.html     # Media library page
│   ├── categories/index.html# Categories management page
│   ├── tags/index.html      # Tags management page
│   ├── bin/index.html       # Bin (soft-deleted items) page
│   ├── settings/index.html  # Settings editor page
│   ├── js/                  # ES6 modules (110 functions across 10 modules)
│   │   ├── standalone-init.js    # Auth helper for standalone pages
│   │   ├── components/           # Shared header and sidebar
│   │   ├── core/                 # Utilities (debounce, escapeHtml, etc.)
│   │   ├── ui/                   # Notifications system
│   │   └── modules/              # Feature modules (posts, pages, media, etc.)
│   ├── app.js               # Legacy dashboard logic (fully documented)
│   ├── styles.css           # Shared styles (Tailwind-inspired utilities)
│   ├── sw.js                # Service Worker for offline capability
│   └── README.md            # Custom Admin documentation
├── admin-decap/             # Decap CMS (alternative, visual editor)
│   ├── index.html           # CMS entry point
│   ├── config.yml           # CMS configuration
│   ├── cms.js               # Custom editor components
│   └── README.md            # CMS documentation
├── netlify/functions/       # Serverless API endpoints
│   ├── taxonomy.js          # Categories and tags CRUD
│   ├── posts.js             # Blog posts management
│   ├── pages.js             # Static pages management
│   ├── settings.js          # _config.yml editor
│   ├── media.js             # Cloudinary media library
│   ├── trash.js             # Soft delete/restore system
│   ├── deployment-status.js # GitHub Actions monitoring
│   └── deployment-history.js# Deployment history tracking
├── _data/                   # Site data files
│   └── taxonomy.yml         # Categories and tags definitions
├── docs/                    # Documentation
│   ├── EMAIL_MIGRATION_CLOUDFLARE.md
│   ├── CLOUDINARY_MIGRATION.md
│   └── RELATED_POSTS_IMPROVEMENT.md
├── scripts/                 # Maintenance and utility scripts
│   ├── sync-taxonomy.js     # Sync taxonomy to CMS config
│   ├── add-lazy-loading.py  # Add lazy loading to images
│   ├── audit-cloudinary-images.py
│   ├── extract-featured-images.py
│   ├── generate-favicons.py
│   └── README.md            # Scripts documentation
├── index.html               # Homepage with pagination
├── categories.md            # All categories overview
├── tags.md                  # Tag cloud page
├── search.md                # Search page
├── about.md                 # About page
├── contact.md               # Contact page
├── 404.html                 # Custom error page
├── robots.txt               # SEO crawler instructions
└── netlify.toml             # Netlify build configuration
```

## Development Setup

### Prerequisites

- Ruby 2.7+ (check with `ruby -v`)
- Bundler (`gem install bundler`)
- Git

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/mfrench71/circleseven-website.git
   cd circleseven-website
   ```

2. **Install dependencies:**
   ```bash
   bundle install
   ```

3. **Run local server:**
   ```bash
   bundle exec jekyll serve --baseurl ""
   ```

4. **View site:**
   - Open [http://localhost:4000](http://localhost:4000) in your browser
   - Site auto-rebuilds on file changes

### Useful Commands

```bash
# Serve with drafts
bundle exec jekyll serve --drafts

# Serve with future-dated posts
bundle exec jekyll serve --future

# Build for production
bundle exec jekyll build

# Clean build artifacts
bundle exec jekyll clean
```

## Content Management

The site offers two CMS options:

### Custom Admin (Recommended) ⭐

A GitHub-powered, WordPress-style CMS built specifically for Jekyll with a modern multi-page architecture:

**Access:** [https://circleseven.co.uk/admin/](https://circleseven.co.uk/admin/)

#### Features

- **Multi-Page Architecture** - Standalone pages for each section with shared header and sidebar
- **Dashboard** - Quick actions, site stats, and recent deployment history
- **Posts Management** (`/admin/posts/`) - Create, edit, delete with markdown editor and real-time preview
- **Pages Management** (`/admin/pages/`) - Manage static pages with auto-generated permalinks and protected page support
- **Media Library** (`/admin/media/`) - Browse, upload, search Cloudinary images with pagination (20 per page)
- **Categories** (`/admin/categories/`) - Drag-and-drop reordering of post categories
- **Tags** (`/admin/tags/`) - Drag-and-drop reordering of post tags
- **Settings Editor** (`/admin/settings/`) - Modify `_config.yml` through intuitive interface
- **Bin System** (`/admin/bin/`) - Soft delete with restore capability for posts and pages
- **Deployment Tracking** - Real-time GitHub Actions workflow monitoring with live status banners
- **Protected Pages** - Lock indicator for system pages that cannot be deleted
- **ES6 Modules** - Clean, modular architecture with 110 functions across 10 modules + 2 components
- **WordPress-style UX** - Autocomplete taxonomy, collapsible categories, hover actions
- **Offline Capable** - Service Worker caching for faster repeat visits
- **Mobile Responsive** - Works on all devices

#### Quick Start

1. Navigate to `/admin/`
2. Click "Log In" and authenticate with Netlify Identity
3. Select a section from the sidebar:
   - **Dashboard** - Overview and quick actions
   - **Posts** - Create and edit blog posts
   - **Pages** - Manage static pages
   - **Media** - Browse and upload images
   - **Categories** - Manage post categories
   - **Tags** - Manage post tags
   - **Bin** - Restore deleted items
   - **Settings** - Edit site configuration

#### Creating Posts

1. Click **Posts** → **New Post**
2. Fill in title, date, image URL, categories, tags
3. Use **Browse Library** to select featured images from Cloudinary
4. Write content in Markdown (EasyMDE editor with toolbar)
5. Click **Save Post** (auto-commits to GitHub and triggers deployment)

#### Managing Media

1. Click **Media Library** to browse all Cloudinary images
2. Use search to find images by filename
3. Filter by "All Media", "Images Only", or "Recently Uploaded"
4. Click **Upload Image** to add new files via Cloudinary widget
5. Hover over images for quick actions:
   - **Copy URL** - Copy image URL to clipboard
   - **View Full Size** - Open modal with full resolution

#### Environment Setup

The Media Library requires this environment variable in Netlify:

1. Go to **Netlify Dashboard** → **Site Settings** → **Environment Variables**
2. Add `CLOUDINARY_API_SECRET` with your Cloudinary API Secret
3. Also add `GITHUB_TOKEN` for deployment tracking
4. Trigger a redeploy after adding variables

#### Architecture

- **Frontend:** Multi-page standalone architecture with shared components
- **Backend:** Netlify Functions (serverless API endpoints)
- **Storage:** GitHub (all content in version control)
- **Images:** Cloudinary (CDN with automatic optimization)
- **Auth:** Netlify Identity with TEST_MODE support for E2E testing
- **Deployment:** GitHub Actions with real-time status tracking
- **Modules:** 110 functions across 10 ES6 modules + 2 shared components
- **Pattern:** Each page uses `standalone-init.js` for authentication, `initHeader()` and `initSidebar()` for shared UI

See `admin/README.md` and `admin/js/README.md` for detailed documentation.

---

### Decap CMS (Alternative)

Original CMS interface with visual editing:

**Access:** [https://circleseven.co.uk/admin-decap/](https://circleseven.co.uk/admin-decap/)

1. Authenticate with Netlify Identity
2. Create/edit posts visually with rich editor
3. Use custom components:
   - 📍 **Leaflet Map** - Insert interactive maps
   - 🖼️ **Image Gallery** - Create lightbox galleries
   - 🎬 **Vimeo/YouTube** - Embed videos
4. Publish changes (auto-deploys to Netlify)

#### Custom Editor Components

The CMS includes specialized components for rich content:

- **Leaflet Maps:** Insert maps with lat/lng/zoom controls
- **Galleries:** Multi-image galleries with alt text and dimensions
- **Video Embeds:** Vimeo and YouTube with responsive containers
- **Preview Templates:** Live preview styled to match production site

---

### Manual Markdown Editing

1. Create file: `_posts/YYYY-MM-DD-title-slug.md`

2. Add front matter:
   ```yaml
   ---
   layout: post
   title: "Your Post Title"
   date: 2025-01-01 12:00:00 +0000
   categories: ["Category Name"]
   tags: ["tag1", "tag2"]
   image: https://res.cloudinary.com/circleseven/image/upload/featured.jpg
   ---
   ```

3. Write content in Markdown

4. Commit and push:
   ```bash
   git add _posts/2025-01-01-your-post.md
   git commit -m "Add new post"
   git push
   ```

## Deployment

### Automated (Default)

1. Push to `main` branch on GitHub
2. Netlify detects changes
3. Builds site with Jekyll
4. Deploys to CDN globally
5. Live in 2-3 minutes

### Build Configuration

`netlify.toml`:
```toml
[build]
  command = "bundle exec jekyll build"
  publish = "_site"

[build.environment]
  RUBY_VERSION = "3.1.0"
  JEKYLL_ENV = "production"
```

## Email Configuration

Email sent to `@circleseven.co.uk` is handled by Cloudflare Email Routing:

- **Incoming:** Cloudflare MX records → forwards to Gmail
- **Authentication:** SPF, DKIM, DMARC configured
- **Catch-all:** Any address @circleseven.co.uk forwards
- **Sending:** Use Gmail's "Send as" feature or SMTP service

See `docs/EMAIL_MIGRATION_CLOUDFLARE.md` for setup details.

## Embedded Content

### YouTube/Vimeo Videos

```html
<figure>
<div class="embed-container">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen></iframe>
</div>
</figure>
```

### Leaflet Maps

```html
<div class="leaflet-map" data-lat="50.375" data-lng="-4.143" data-zoom="14"></div>
```

### Image Galleries

```html
<div class="gallery">
  <figure><a href="full-size.jpg"><img src="thumb.jpg" alt="Description" loading="lazy"></a></figure>
  <figure><a href="full-size2.jpg"><img src="thumb2.jpg" alt="Description" loading="lazy"></a></figure>
</div>
```

## Performance

Optimized for speed and efficiency:

- ✅ **CSS minification** (Sass compression)
- ✅ **Lazy-loaded images** (native loading="lazy")
- ✅ **Cloudinary CDN** (automatic WebP/AVIF)
- ✅ **Preconnect hints** for external resources
- ✅ **Deferred JavaScript** loading
- ✅ **Netlify CDN** (global edge network)
- ✅ **Gzip/Brotli** compression

**Lighthouse Scores:** 95+ on all metrics

## SEO

Comprehensive SEO optimization:

- ✅ Semantic HTML5 markup
- ✅ Jekyll SEO Tag plugin
- ✅ Structured data (JSON-LD schemas)
- ✅ XML sitemap (auto-generated)
- ✅ RSS feed
- ✅ robots.txt
- ✅ Meta descriptions
- ✅ Open Graph tags
- ✅ Twitter Card tags
- ✅ Canonical URLs

## Accessibility

WCAG AA compliant features:

- ✅ Skip-to-content link
- ✅ Semantic HTML landmarks
- ✅ ARIA labels and roles
- ✅ Keyboard navigation support
- ✅ Focus indicators
- ✅ Color contrast ratios (4.5:1+)
- ✅ Alt text on all images
- ✅ Responsive text sizing

## Browser Support

- ✅ Chrome/Edge (latest 2 versions)
- ✅ Firefox (latest 2 versions)
- ✅ Safari (latest 2 versions)
- ✅ Mobile browsers (iOS Safari, Chrome Android)

## Cost Breakdown

### Current (2025)
- **Hosting:** $0 (Netlify free tier)
- **DNS:** $0 (Cloudflare)
- **Email:** $0 (Cloudflare Email Routing)
- **Images:** $0 (Cloudinary free tier)
- **CMS:** $0 (Decap CMS)
- **Domain:** ~£10/year (123-reg)
- **Total:** ~£10/year

### Previous (WordPress)
- **Hosting:** ~£60-130/year (Krystal)
- **Domain:** ~£10/year
- **Total:** ~£70-140/year

**Annual Savings:** ~£60-130

## Configuration

### CMS Settings

Access **Settings** in the Decap CMS admin at `/admin/#/collections/settings` to configure:

#### Site Configuration
- **Site Title** - Displayed in browser titles and headers
- **Description** - Used in meta tags and SEO
- **Email** - Contact email address
- **URL** - Production site URL (https://circleseven.co.uk)
- **Related Posts Count** - Number of related posts shown (1-10, default: 4)

#### Taxonomy (Categories & Tags)
Manage the list of available categories and tags used throughout the site:

1. Go to **Settings** → **Taxonomy (Categories & Tags)**
2. Add/edit/remove categories and tags using the list interface
3. After saving, run the sync script to update CMS checkboxes:
   ```bash
   npm run sync-taxonomy
   ```
4. Commit and push the updated `admin/config.yml`

**Current Taxonomy:**
- **21 Categories**: Projects, Photography, Retro Computing, Digital Art courses (DAT401-DAT613), INDE601
- **31 Tags**: Photography, Academic, Tutorial, software tools (Photoshop, Blender, Unity), course tags

### Admin Pagination

Control how many posts appear per page in the CMS admin:

1. Edit `admin/config.yml`
2. Find the `pagination:` section under `blog` collection
3. Change `size:` value (recommended: 10-50, current: 20)
4. Commit and push changes

**Note**: Due to Decap CMS limitations, this cannot be configured through the Settings UI.

### Maintenance Scripts

Located in `scripts/` directory (see `scripts/README.md` for details):

#### sync-taxonomy.js
Syncs taxonomy changes from CMS to config file.

```bash
# Install dependencies first
npm install

# Run sync
npm run sync-taxonomy

# Or directly
node scripts/sync-taxonomy.js
```

**When to use**: After updating categories/tags in CMS Settings

#### Python Scripts
```bash
# Add lazy loading to images
python3 scripts/add-lazy-loading.py

# Audit Cloudinary images
python3 scripts/audit-cloudinary-images.py

# Extract featured images from posts
python3 scripts/extract-featured-images.py

# Generate favicon files
python3 scripts/generate-favicons.py
```

**Dependencies**:
```bash
pip install Pillow cloudinary python-dotenv js-yaml
```

### Environment Variables

For Cloudinary scripts, create `.env` in project root:

```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

⚠️ **Never commit `.env` files to version control**

## Documentation

### CMS Documentation
- `admin/README.md` - **Custom Admin** setup and usage guide
- `admin/js/README.md` - ES6 modules architecture documentation (110 functions)
- `admin-decap/README.md` - Decap CMS setup and usage

### Technical Documentation
- `docs/EMAIL_MIGRATION_CLOUDFLARE.md` - Email configuration guide
- `docs/CLOUDINARY_MIGRATION.md` - Cloudinary migration details
- `docs/RELATED_POSTS_IMPROVEMENT.md` - Related posts algorithm
- `scripts/README.md` - Maintenance scripts documentation

### API Documentation
All Netlify Functions and frontend JavaScript files include comprehensive JSDoc documentation:
- `netlify/functions/*.js` - Serverless API endpoints with full JSDoc annotations
- `assets/js/*.js` - Frontend JavaScript with JSDoc documentation
- `admin/app.js` - Dashboard logic (fully documented)
- `admin/js/modules/*.js` - 110 functions across 10 ES6 modules with full JSDoc

## Contributing

This is a personal portfolio site, but if you notice issues:

1. Open an issue describing the problem
2. Or submit a pull request with fixes

## License

**Content:** © Matthew French. All rights reserved.

**Code:** (HTML/CSS/JS/Jekyll templates) available under [MIT License](https://opensource.org/licenses/MIT).

## Contact

- **Website:** [https://circleseven.co.uk](https://circleseven.co.uk)
- **Email:** mail@circleseven.co.uk
- **GitHub:** [@mfrench71](https://github.com/mfrench71)

---

Built with [Jekyll](https://jekyllrb.com) • Hosted on [Netlify](https://netlify.com) • DNS by [Cloudflare](https://cloudflare.com)
