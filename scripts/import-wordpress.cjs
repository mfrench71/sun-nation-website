#!/usr/bin/env node

/**
 * WordPress XML to Jekyll Markdown Importer
 *
 * Converts WordPress XML export to Jekyll-compatible markdown files.
 * Handles posts, pages, categories, tags, and Cloudinary image URLs.
 *
 * Usage: node scripts/import-wordpress.cjs path/to/wordpress-export.xml
 */

const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');
const TurndownService = require('turndown');
const cheerio = require('cheerio');

// Configuration
const CLOUDINARY_CLOUD_NAME = 'circleseven';
const CLOUDINARY_FOLDER = 'sun-nation';
const POSTS_DIR = '_posts';
const PAGES_DIR = '_pages';

// Initialize Turndown for HTML to Markdown conversion
const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
});

/**
 * Parse WordPress XML export
 */
async function parseWordPressXML(xmlPath) {
  const xmlContent = fs.readFileSync(xmlPath, 'utf8');
  const parser = new xml2js.Parser({
    explicitArray: false,
    mergeAttrs: true,
    xmlns: true
  });

  const result = await parser.parseStringPromise(xmlContent);
  return result.rss.channel;
}

/**
 * Extract post/page data from WordPress item
 */
function extractPostData(item, namespaces) {
  // Get WordPress-specific fields
  const wpNs = namespaces.wp || 'wp';
  const contentNs = namespaces.content || 'content';
  const excerptNs = namespaces.excerpt || 'excerpt';

  const postType = item[`${wpNs}:post_type`] || 'post';
  const status = item[`${wpNs}:status`] || 'publish';
  const postId = item[`${wpNs}:post_id`] || '';
  const postName = item[`${wpNs}:post_name`] || '';
  const pubDate = item.pubDate || new Date().toISOString();
  const title = item.title || 'Untitled';
  const content = item[`${contentNs}:encoded`] || '';
  const excerpt = item[`${excerptNs}:encoded`] || '';

  // Extract categories and tags
  let categories = [];
  let tags = [];

  if (item.category) {
    const cats = Array.isArray(item.category) ? item.category : [item.category];
    cats.forEach(cat => {
      if (cat.domain === 'category') {
        categories.push(cat._);
      } else if (cat.domain === 'post_tag') {
        tags.push(cat._);
      }
    });
  }

  // Extract featured image
  let featuredImage = '';
  const postMeta = item[`${wpNs}:postmeta`];
  if (postMeta) {
    const metaArray = Array.isArray(postMeta) ? postMeta : [postMeta];
    const thumbnailMeta = metaArray.find(meta =>
      meta[`${wpNs}:meta_key`] === '_thumbnail_id'
    );
    if (thumbnailMeta) {
      featuredImage = thumbnailMeta[`${wpNs}:meta_value`];
    }
  }

  return {
    postType,
    status,
    postId,
    postName,
    pubDate: new Date(pubDate),
    title,
    content,
    excerpt,
    categories,
    tags,
    featuredImage
  };
}

/**
 * Convert WordPress image URLs to Cloudinary URLs
 */
function convertImageURLs(content) {
  const $ = cheerio.load(content);

  $('img').each((i, elem) => {
    const $img = $(elem);
    let src = $img.attr('src');

    if (src && !src.includes('cloudinary.com')) {
      // Extract filename from WordPress URL
      const filename = path.basename(src).replace(/(-\d+x\d+)?(\.\w+)$/, '$2');

      // Construct Cloudinary URL
      const cloudinaryUrl = `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/q_auto,f_auto/${CLOUDINARY_FOLDER}/${filename}`;
      $img.attr('src', cloudinaryUrl);
    } else if (src && src.includes('cloudinary.com') && !src.includes(`/${CLOUDINARY_FOLDER}/`)) {
      // Update existing Cloudinary URLs to use correct folder
      src = src.replace(
        /\/image\/upload\/([^/]+\/)?/,
        `/image/upload/$1${CLOUDINARY_FOLDER}/`
      );
      $img.attr('src', src);
    }

    // Remove srcset if present (we'll let Jekyll handle responsive images)
    $img.removeAttr('srcset');
    $img.removeAttr('sizes');
  });

  return $.html();
}

/**
 * Convert HTML content to Markdown
 */
function htmlToMarkdown(html) {
  // First convert image URLs
  const processedHtml = convertImageURLs(html);

  // Convert to Markdown
  return turndownService.turndown(processedHtml);
}

/**
 * Generate Jekyll frontmatter
 */
function generateFrontmatter(data) {
  const frontmatter = ['---'];

  frontmatter.push(`title: "${data.title.replace(/"/g, '\\"')}"`);
  frontmatter.push(`date: ${data.pubDate.toISOString()}`);

  if (data.categories.length > 0) {
    frontmatter.push('categories:');
    data.categories.forEach(cat => {
      frontmatter.push(`  - ${cat}`);
    });
  }

  if (data.tags.length > 0) {
    frontmatter.push('tags:');
    data.tags.forEach(tag => {
      frontmatter.push(`  - ${tag}`);
    });
  }

  if (data.featuredImage) {
    frontmatter.push(`featured_image: ${data.featuredImage}`);
  }

  if (data.excerpt) {
    const markdownExcerpt = htmlToMarkdown(data.excerpt).trim();
    frontmatter.push(`excerpt: "${markdownExcerpt.replace(/"/g, '\\"')}"`);
  }

  frontmatter.push('---');
  frontmatter.push('');

  return frontmatter.join('\n');
}

/**
 * Generate Jekyll filename
 */
function generateFilename(data) {
  const date = data.pubDate;
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  // Sanitize title for filename
  let slug = data.postName || data.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (data.postType === 'page') {
    return `${slug}.md`;
  } else {
    return `${dateStr}-${slug}.md`;
  }
}

/**
 * Save post/page as Jekyll markdown file
 */
function savePost(data) {
  const outputDir = data.postType === 'page' ? PAGES_DIR : POSTS_DIR;

  // Ensure directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const filename = generateFilename(data);
  const filepath = path.join(outputDir, filename);

  // Generate frontmatter
  const frontmatter = generateFrontmatter(data);

  // Convert content to markdown
  const markdown = htmlToMarkdown(data.content);

  // Combine and save
  const fileContent = frontmatter + markdown;
  fs.writeFileSync(filepath, fileContent, 'utf8');

  console.log(`✓ Created ${data.postType}: ${filepath}`);

  return filepath;
}

/**
 * Main import function
 */
async function importWordPress(xmlPath) {
  console.log('Starting WordPress import...\n');

  if (!fs.existsSync(xmlPath)) {
    console.error(`Error: File not found: ${xmlPath}`);
    process.exit(1);
  }

  try {
    // Parse XML
    console.log('Parsing WordPress XML...');
    const channel = await parseWordPressXML(xmlPath);

    // Get all items
    const items = Array.isArray(channel.item) ? channel.item : [channel.item];

    // Detect namespaces
    const namespaces = {
      wp: 'wp',
      content: 'content',
      excerpt: 'excerpt'
    };

    // Process each item
    let postsCount = 0;
    let pagesCount = 0;

    items.forEach(item => {
      const data = extractPostData(item, namespaces);

      // Only import published posts and pages
      if (data.status === 'publish' && (data.postType === 'post' || data.postType === 'page')) {
        savePost(data);

        if (data.postType === 'post') {
          postsCount++;
        } else {
          pagesCount++;
        }
      }
    });

    console.log('\n✓ Import complete!');
    console.log(`  Posts: ${postsCount}`);
    console.log(`  Pages: ${pagesCount}`);
    console.log('\nNext steps:');
    console.log('1. Review imported files in _posts/ and _pages/');
    console.log('2. Run: npm run fix:content to clean up any formatting issues');
    console.log('3. Run: npm run fix:cloudinary to update image URLs');

  } catch (error) {
    console.error('Error importing WordPress content:', error);
    process.exit(1);
  }
}

// Run import
if (require.main === module) {
  const xmlPath = process.argv[2];

  if (!xmlPath) {
    console.error('Usage: node scripts/import-wordpress.cjs path/to/wordpress-export.xml');
    process.exit(1);
  }

  importWordPress(xmlPath);
}

module.exports = { importWordPress };
