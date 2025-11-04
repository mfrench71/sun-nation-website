# Cloudinary Migration Guide

## Overview

This guide explains how to migrate WordPress images to Cloudinary with automatic image optimization and responsive images.

## Features

- **Automatic backups**: All files backed up before modification
- **Rollback support**: Easy restoration if needed
- **Dry-run mode**: Preview changes before applying
- **Responsive images**: Automatic srcset generation
- **Cloudinary optimization**: Auto quality and format selection
- **Featured images**: Automatic extraction from posts

## Configuration

Cloudinary settings in `_config.yml`:
```yaml
cloudinary_cloud_name: circleseven
cloudinary_base_url: https://res.cloudinary.com/circleseven/image/upload
```

## Migration Process

### Step 1: Preview Changes (Dry Run)

```bash
python3 scripts/migrate-to-cloudinary.py --cloud-name circleseven --dry-run
```

This shows which files will be modified without making changes.

### Step 2: Run Migration

```bash
python3 scripts/migrate-to-cloudinary.py --cloud-name circleseven
```

This will:
1. Create backups in `.cloudinary-backup/` directory
2. Replace WordPress URLs with Cloudinary URLs
3. Add responsive images with srcset
4. Generate detailed log file

### Step 3: Rollback (If Needed)

If something goes wrong, restore from backups:

```bash
python3 scripts/migrate-to-cloudinary.py --rollback
```

This restores all files from the backup directory.

## Image Transformations

The migration script applies these Cloudinary transformations:

### Post Content Images
- **Thumbnail**: `c_limit,w_800,h_800,q_auto,f_auto`
- **Responsive srcset**:
  - 400w: `c_limit,w_400,q_auto,f_auto`
  - 800w: `c_limit,w_800,q_auto,f_auto`
  - 1200w: `c_limit,w_1200,q_auto,f_auto`

### Featured Images (Post Headers)
- **Desktop**: `c_fill,g_auto,w_1200,h_630,q_auto,f_auto`
- **Mobile**: `c_fill,g_auto,w_600,h_315,q_auto,f_auto`

### Card Thumbnails (Homepage)
- **Standard**: `c_fill,g_auto,w_300,h_200,q_auto,f_auto`
- **Retina**: `c_fill,g_auto,w_600,h_400,q_auto,f_auto`

## Jekyll Includes

### Manual Cloudinary Images

Use the `cloudinary-image.html` include for manual image insertion:

```liquid
{% include cloudinary-image.html
   src="image-filename.jpg"
   alt="Description"
   transformation="c_fill,w_800,h_600"
   caption="Optional caption"
   sizes="(max-width: 768px) 100vw, 800px"
%}
```

### Featured Images

Featured images are automatically extracted:
1. First checks `featured_image` or `image` in front matter
2. Falls back to first image in post content
3. Falls back to default image

To manually set featured image in front matter:

```yaml
---
title: My Post
featured_image: my-image.jpg
---
```

### Post Card Thumbnails

Card images are automatically extracted using `post-card-image.html` include.

## URL Format

Cloudinary URLs are generated as:

```
https://res.cloudinary.com/circleseven/image/upload/{transformation}/{filename}
```

Where:
- `{transformation}`: e.g., `c_fill,w_800,h_600,q_auto,f_auto`
- `{filename}`: Image filename without extension (Cloudinary public_id)

## Testing

After migration:

1. **Build locally**: `bundle exec jekyll serve`
2. **Check images load**: Verify Cloudinary URLs work
3. **Test responsive**: Check different screen sizes
4. **Verify lightbox**: Test gallery functionality
5. **Check social sharing**: Validate Open Graph images

## Troubleshooting

### Images not loading

Check that:
- Images are uploaded to Cloudinary
- Cloud name is correct in `_config.yml`
- Filenames match (case-sensitive)

### Rollback needed

```bash
# Restore from backup
python3 scripts/migrate-to-cloudinary.py --rollback

# Delete backups after confirming
rm -rf .cloudinary-backup
```

### Re-run migration

If you need to re-run migration:

1. Rollback first
2. Fix any issues
3. Run migration again

## Backup Strategy

Before migration:
- Commit all changes to git
- Create branch: `git checkout -b cloudinary-migration`
- Run dry-run first
- Keep backups until confirmed working

## File Changes

Migration modifies these files:
- **46 posts** with WordPress image URLs (303 total images)
- Converts `<figure>` tags to Cloudinary with responsive srcset
- Updates standalone `<img>` tags
- Preserves alt text, captions, and lazy loading

## Performance Benefits

Cloudinary provides:
- Automatic format selection (WebP, AVIF when supported)
- Automatic quality optimization
- Responsive images (right size for device)
- CDN delivery (faster loading)
- Lazy loading support

## Next Steps

After successful migration:
1. Test thoroughly
2. Commit changes: `git add -A && git commit -m "Migrate to Cloudinary"`
3. Push to GitHub: `git push`
4. Netlify will auto-deploy
5. Verify on live site
6. Delete backup directory: `rm -rf .cloudinary-backup`
