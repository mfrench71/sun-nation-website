#!/usr/bin/env node

/**
 * HTML to Markdown Converter
 * Converts simple HTML tags to markdown while preserving galleries and code blocks
 */

const fs = require('fs');
const path = require('path');

function convertHtmlToMarkdown(content) {
  // Track if we're inside special blocks that should not be converted
  let insideGallery = false;
  let insideFigure = false;
  const lines = content.split('\n');
  const converted = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Track gallery blocks - don't convert anything inside them
    if (line.includes('<div class="gallery">')) {
      insideGallery = true;
      converted.push(line);
      continue;
    }
    if (line.includes('</div>') && insideGallery) {
      // Check if this closes the gallery
      insideGallery = false;
      converted.push(line);
      continue;
    }

    // Track figure blocks - don't convert anything inside them
    if (line.includes('<figure>')) {
      insideFigure = true;
    }
    if (line.includes('</figure>')) {
      insideFigure = false;
      converted.push(line);
      continue;
    }

    // If inside gallery or figure, don't convert
    if (insideGallery || insideFigure) {
      converted.push(line);
      continue;
    }

    // Don't convert lines that are inside code blocks
    if (line.trim().startsWith('```')) {
      converted.push(line);
      continue;
    }

    // Convert <p> tags (simple cases only - not with attributes)
    line = line.replace(/<p>(.*?)<\/p>/g, '$1');

    // Convert <a> tags with target="_blank"
    line = line.replace(/<a\s+href="([^"]+)"\s+target="_blank"[^>]*>(.*?)<\/a>/g, '[$2]($1){:target="_blank"}');

    // Convert simple <a> tags
    line = line.replace(/<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/g, '[$2]($1)');

    // Convert <em> and <i> to *text*
    line = line.replace(/<em>(.*?)<\/em>/g, '*$1*');
    line = line.replace(/<i>(.*?)<\/i>/g, '*$1*');

    // Convert <strong> and <b> to **text**
    line = line.replace(/<strong>(.*?)<\/strong>/g, '**$1**');
    line = line.replace(/<b>(.*?)<\/b>/g, '**$1**');

    // Convert inline <code> to `text` (but not if it's inside a code block marker)
    if (!line.includes('```')) {
      line = line.replace(/<code>(.*?)<\/code>/g, '`$1`');
    }

    converted.push(line);
  }

  return converted.join('\n');
}

function processFile(filePath, dryRun = false) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const converted = convertHtmlToMarkdown(content);

    if (content !== converted) {
      if (dryRun) {
        console.log(`Would convert: ${filePath}`);
        return { changed: true, path: filePath };
      } else {
        fs.writeFileSync(filePath, converted, 'utf8');
        console.log(`✓ Converted: ${filePath}`);
        return { changed: true, path: filePath };
      }
    } else {
      if (dryRun) {
        console.log(`No changes: ${filePath}`);
      }
      return { changed: false, path: filePath };
    }
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { changed: false, path: filePath, error: error.message };
  }
}

function processDirectory(dirPath, dryRun = false) {
  const files = fs.readdirSync(dirPath);
  const results = [];

  for (const file of files) {
    if (file.endsWith('.md')) {
      const filePath = path.join(dirPath, file);
      const result = processFile(filePath, dryRun);
      results.push(result);
    }
  }

  return results;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const testMode = args.includes('--test');

console.log('HTML to Markdown Converter');
console.log('==========================');
console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log('');

if (testMode) {
  // Test mode - process just one file
  const testFile = path.join(__dirname, '../_posts/2018-11-13-dat602-face-recognition-with-azure-face-api-and-javascript.md');
  console.log('TEST MODE: Processing single file');
  console.log(`File: ${testFile}`);
  console.log('');
  processFile(testFile, dryRun);
} else {
  // Process all posts
  const postsDir = path.join(__dirname, '../_posts');
  console.log('Processing _posts directory...');
  const results = processDirectory(postsDir, dryRun);

  const changedCount = results.filter(r => r.changed).length;
  console.log('');
  console.log(`Summary: ${changedCount} files ${dryRun ? 'would be' : 'were'} changed`);
}
