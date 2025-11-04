# Scripts Directory

Utility scripts for maintaining the Circle Seven website.

## Active Scripts (Keep These)

### `add-lazy-loading.py`
**Purpose:** Adds `loading="lazy"` attribute to all images in posts
**Usage:** `python3 scripts/add-lazy-loading.py`
**When to use:** When adding new posts with images or bulk-updating existing posts
**Status:** ✅ Active maintenance script

### `audit-cloudinary-images.py`
**Purpose:** Audits Cloudinary image usage and identifies missing/broken images
**Usage:** `python3 scripts/audit-cloudinary-images.py`
**When to use:** Periodic content audits to verify all images are accessible
**Status:** ✅ Active maintenance script

### `extract-featured-images.py`
**Purpose:** Extracts featured images from post content and updates front matter
**Usage:** `python3 scripts/extract-featured-images.py`
**When to use:** When migrating posts or updating featured image metadata
**Status:** ✅ Active maintenance script

### `generate-favicons.py`
**Purpose:** Generates favicon files in multiple sizes from a source SVG/PNG
**Usage:** `python3 scripts/generate-favicons.py`
**When to use:** When updating site branding or favicon
**Dependencies:** Requires PIL/Pillow (`pip install Pillow`)
**Status:** ✅ Active utility script

### `sync-taxonomy.js`
**Purpose:** Syncs categories and tags from `_data/taxonomy.yml` to CMS config checkboxes
**Usage:** `node scripts/sync-taxonomy.js` or `npm run sync-taxonomy`
**When to use:** After updating taxonomy in CMS Settings > Taxonomy (Categories & Tags)
**What it does:**
- Reads categories and tags from `_data/taxonomy.yml`
- Updates checkbox options in `admin/config.yml`
- Preserves YAML formatting and handles special characters
**Note:** After running, commit the updated `admin/config.yml` file
**Status:** ✅ Active maintenance script

## Migration Scripts (Deleted)

The following scripts were used during the WordPress → Jekyll migration and have been removed as they are no longer needed:

- ~~`fix-image-paths.py`~~ - Fixed image URLs during migration
- ~~`fix-image-paths-v2.py`~~ - Updated version of image path fixer
- ~~`fix-headings.py`~~ - Normalized heading styles
- ~~`fix-enlighterjs-code.py`~~ - Converted EnlighterJS code blocks
- ~~`fix-html-entities-in-code.py`~~ - Fixed HTML entity encoding
- ~~`fix-youtube-embeds.py`~~ - Standardized YouTube embed code
- ~~`fix-href-paths.py`~~ - Fixed internal link paths
- ~~`fix-all-remaining-paths.py`~~ - Catch-all path fixer
- ~~`remove-scaled-suffix.py`~~ - Removed WordPress scaled image suffixes
- ~~`fix-safe-scaled-images.py`~~ - Safe scaled image renaming
- ~~`verify-scaled-images.py`~~ - Verified scaled image fixes
- ~~`match-missing-images.py`~~ - Matched missing images to Cloudinary
- ~~`migrate-to-cloudinary.py`~~ - Migrated images to Cloudinary CDN
- ~~`upload-to-cloudinary.py`~~ - Batch uploaded images to Cloudinary

**Date deleted:** 2025-10-20
**Reason:** Migration complete, no longer needed

## Contributing

When adding new scripts:

1. Add clear docstring explaining purpose
2. Include usage instructions
3. Update this README with script description
4. Mark as maintenance script or one-time utility
5. Add to `.gitignore` if it contains sensitive data (API keys, etc.)

## Dependencies

Some scripts require Python packages:

```bash
pip install Pillow cloudinary python-dotenv
```

Create a `.env` file in the root directory with Cloudinary credentials if using image scripts:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

⚠️ **Never commit `.env` files to version control**
