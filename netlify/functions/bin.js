/**
 * Bin Management Netlify Function
 *
 * Manages soft-deletion and restoration of posts and pages via a _bin directory.
 * Implements a recycle bin pattern where deleted items can be restored or permanently deleted.
 *
 * Features:
 * - Moves posts/pages to _bin directory instead of immediate deletion
 * - Adds binned_at timestamp to frontmatter for tracking
 * - Handles filename conflicts with timestamp-based renaming
 * - Auto-detects item type (post vs page) based on filename pattern
 * - Supports restore with frontmatter cleanup (removes binned_at)
 *
 * Supported operations:
 * - GET: List all binned items with metadata
 * - POST: Move post or page to bin
 * - PUT: Restore item from bin to original location
 * - DELETE: Permanently delete item from bin
 *
 * @module netlify/functions/bin
 */

const https = require('https');

// GitHub API configuration
const GITHUB_OWNER = 'mfrench71';
const GITHUB_REPO = 'circleseven-website';
const GITHUB_BRANCH = 'main';
const POSTS_DIR = '_posts';
const PAGES_DIR = '_pages';
const BIN_DIR = '_bin';

/**
 * Makes authenticated requests to the GitHub API
 *
 * @param {string} path - GitHub API endpoint path (relative to /repos/{owner}/{repo})
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.headers] - Additional headers
 * @param {Object} [options.body] - Request body (will be JSON stringified)
 * @returns {Promise<Object>} Parsed JSON response from GitHub API
 * @throws {Error} If the GitHub API returns a non-2xx status code
 */
function githubRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const bodyString = options.body ? JSON.stringify(options.body) : '';

    const reqOptions = {
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Netlify-Function',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        ...options.headers
      }
    };

    // Add Content-Length header if there's a body
    if (bodyString) {
      reqOptions.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }

    const req = https.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API error: ${res.statusCode} ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

/**
 * Netlify Function Handler - Bin Management
 *
 * Main entry point for trash management. Handles all operations for the recycle bin
 * including listing, moving to bin, restoring, and permanent deletion.
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, POST, PUT, DELETE, OPTIONS)
 * @param {string} event.body - Request body (JSON string)
 * @param {Object} context - Netlify function context
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // GET - List all binned items
 * // GET /.netlify/functions/bin
 * // Returns: {
 * //   items: [
 * //     {
 * //       name: "2025-10-21-my-post.md",
 * //       path: "_bin/2025-10-21-my-post.md",
 * //       sha: "abc123...",
 * //       type: "post",
 * //       binned_at: "2025-10-21T10:30:00Z"
 * //     }
 * //   ]
 * // }
 *
 * @example
 * // POST - Move item to bin
 * // POST /.netlify/functions/bin
 * // Body: { filename: "2025-10-21-my-post.md", sha: "abc123", type: "post" }
 * // Returns: { success: true, message: "Post moved to bin successfully" }
 *
 * @example
 * // PUT - Restore item from bin
 * // PUT /.netlify/functions/bin
 * // Body: { filename: "2025-10-21-my-post.md", sha: "abc123", type: "post" }
 * // Returns: { success: true, message: "Post restored successfully" }
 *
 * @example
 * // DELETE - Permanently delete item
 * // DELETE /.netlify/functions/bin
 * // Body: { filename: "2025-10-21-my-post.md", sha: "abc123", type: "post" }
 * // Returns: { success: true, message: "Post permanently deleted" }
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET - List all binned items (posts and pages)
    if (event.httpMethod === 'GET') {
      try {
        const files = await githubRequest(`/contents/${BIN_DIR}?ref=${GITHUB_BRANCH}`);

        // Filter to only .md files and categorize by type
        // Fetch content for each file to get binned_at timestamp
        const trashedItemsPromises = files
          .filter(file => file.name.endsWith('.md'))
          .map(async file => {
            // Determine type: posts start with date pattern (YYYY-MM-DD), pages don't
            const isPost = /^\d{4}-\d{2}-\d{2}-/.test(file.name);

            // Fetch file content to extract binned_at timestamp
            let trashedAt = null;
            try {
              const fileData = await githubRequest(`/contents/${BIN_DIR}/${file.name}?ref=${GITHUB_BRANCH}`);
              const content = Buffer.from(fileData.content, 'base64').toString('utf8');
              const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
              if (frontmatterMatch) {
                const trashedAtMatch = frontmatterMatch[1].match(/binned_at:\s*(.+)/);
                if (trashedAtMatch) {
                  trashedAt = trashedAtMatch[1].trim();
                }
              }
            } catch (error) {
              console.error(`Failed to extract binned_at for ${file.name}:`, error);
            }

            return {
              name: file.name,
              path: file.path,
              sha: file.sha,
              size: file.size,
              type: isPost ? 'post' : 'page',
              binned_at: trashedAt
            };
          });

        const trashedItems = await Promise.all(trashedItemsPromises);

        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ items: trashedItems })
        };
      } catch (error) {
        // If _bin folder doesn't exist, return empty array
        if (error.message.includes('404')) {
          return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ items: [] })
          };
        }
        throw error;
      }
    }

    // POST - Move post or page to bin
    if (event.httpMethod === 'POST') {
      if (!process.env.GITHUB_TOKEN) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'GitHub integration not configured',
            message: 'GITHUB_TOKEN environment variable is missing'
          })
        };
      }

      const { filename, sha, type } = JSON.parse(event.body);

      if (!filename || !sha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields',
            message: 'filename and sha are required'
          })
        };
      }

      // Determine source directory based on type (default to posts for backwards compatibility)
      const sourceDir = type === 'page' ? PAGES_DIR : POSTS_DIR;
      const itemType = type === 'page' ? 'page' : 'post';

      // Get current item content
      const itemData = await githubRequest(`/contents/${sourceDir}/${filename}?ref=${GITHUB_BRANCH}`);
      const contentBase64 = itemData.content;
      const currentSha = itemData.sha; // Use the current SHA from GitHub, not the one passed in

      // Decode content to add binned_at timestamp to frontmatter
      const content = Buffer.from(contentBase64, 'base64').toString('utf8');
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      let modifiedContent;
      if (match) {
        const frontmatter = match[1];
        const body = match[2];
        const trashedAt = new Date().toISOString();
        // Add binned_at to frontmatter
        const modifiedFrontmatter = `${frontmatter}\nbinned_at: ${trashedAt}`;
        modifiedContent = `---\n${modifiedFrontmatter}\n---\n${body}`;
      } else {
        // No frontmatter found, use original content
        modifiedContent = content;
      }

      // Re-encode modified content
      const modifiedContentBase64 = Buffer.from(modifiedContent).toString('base64');

      // Check if file already exists in trash
      let existingTrashFile = null;
      let finalFilename = filename;

      try {
        existingTrashFile = await githubRequest(`/contents/${BIN_DIR}/${filename}?ref=${GITHUB_BRANCH}`);
      } catch (error) {
        // File doesn't exist in trash, which is fine
      }

      // If file exists in trash, rename with timestamp to avoid overwriting
      if (existingTrashFile) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2025-01-21T14-30-52
        const nameParts = filename.match(/^(.+)(\.[^.]+)$/); // Split name and extension

        if (nameParts) {
          // Has extension: file.md -> file-2025-01-21T14-30-52.md
          finalFilename = `${nameParts[1]}-${timestamp}${nameParts[2]}`;
        } else {
          // No extension: file -> file-2025-01-21T14-30-52
          finalFilename = `${filename}-${timestamp}`;
        }
      }

      // Create the item in _bin folder (with original or renamed filename)
      const trashBody = {
        message: `Move ${itemType} to bin: ${finalFilename}`,
        content: modifiedContentBase64,
        branch: GITHUB_BRANCH
      };

      const trashResponse = await githubRequest(`/contents/${BIN_DIR}/${finalFilename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: trashBody
      });

      // Delete from source folder using the current SHA from GitHub
      await githubRequest(`/contents/${sourceDir}/${filename}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: `Remove from ${sourceDir} (moved to bin): ${filename}`,
          sha: currentSha, // Use the SHA we just fetched, not the stale one from the client
          branch: GITHUB_BRANCH
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} moved to bin successfully`,
          commitSha: trashResponse.commit?.sha
        })
      };
    }

    // PUT - Restore post or page from bin
    if (event.httpMethod === 'PUT') {
      if (!process.env.GITHUB_TOKEN) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'GitHub integration not configured',
            message: 'GITHUB_TOKEN environment variable is missing'
          })
        };
      }

      const { filename, sha, type } = JSON.parse(event.body);

      if (!filename || !sha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields',
            message: 'filename and sha are required'
          })
        };
      }

      // Determine destination directory based on type
      // If type not provided, auto-detect: posts start with date pattern (YYYY-MM-DD)
      let destDir, itemType;
      if (type) {
        destDir = type === 'page' ? PAGES_DIR : POSTS_DIR;
        itemType = type === 'page' ? 'page' : 'post';
      } else {
        const isPost = /^\d{4}-\d{2}-\d{2}-/.test(filename);
        destDir = isPost ? POSTS_DIR : PAGES_DIR;
        itemType = isPost ? 'post' : 'page';
      }

      // Check if file already exists in destination
      let existingFile = null;
      try {
        existingFile = await githubRequest(`/contents/${destDir}/${filename}?ref=${GITHUB_BRANCH}`);
      } catch (error) {
        // File doesn't exist, which is what we want
        if (!error.message.includes('404')) {
          throw error; // Re-throw if it's not a 404
        }
      }

      if (existingFile) {
        return {
          statusCode: 409,
          headers,
          body: JSON.stringify({
            error: 'File already exists',
            message: `Cannot restore "${filename}" because a file with that name already exists in ${destDir}. Please delete or rename the existing file first.`
          })
        };
      }

      // Get trashed item content
      const trashedData = await githubRequest(`/contents/${BIN_DIR}/${filename}?ref=${GITHUB_BRANCH}`);
      const contentBase64 = trashedData.content;

      // Decode content to remove binned_at timestamp from frontmatter
      const content = Buffer.from(contentBase64, 'base64').toString('utf8');
      const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
      const match = content.match(frontmatterRegex);

      let restoredContent;
      if (match) {
        const frontmatter = match[1];
        const body = match[2];
        // Remove binned_at line from frontmatter
        const cleanedFrontmatter = frontmatter
          .split('\n')
          .filter(line => !line.match(/^\s*binned_at:\s*.+/))
          .join('\n');
        restoredContent = `---\n${cleanedFrontmatter}\n---\n${body}`;
      } else {
        // No frontmatter found, use original content
        restoredContent = content;
      }

      // Re-encode cleaned content
      const restoredContentBase64 = Buffer.from(restoredContent).toString('base64');

      // Restore to appropriate folder
      const restoreResponse = await githubRequest(`/contents/${destDir}/${filename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: `Restore ${itemType} from bin: ${filename}`,
          content: restoredContentBase64,
          branch: GITHUB_BRANCH
        }
      });

      // Delete from _bin folder
      await githubRequest(`/contents/${BIN_DIR}/${filename}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: `Remove from bin (restored): ${filename}`,
          sha: sha,
          branch: GITHUB_BRANCH
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} restored successfully`,
          commitSha: restoreResponse.commit?.sha
        })
      };
    }

    // DELETE - Permanently delete item from bin
    if (event.httpMethod === 'DELETE') {
      if (!process.env.GITHUB_TOKEN) {
        return {
          statusCode: 503,
          headers,
          body: JSON.stringify({
            error: 'GitHub integration not configured',
            message: 'GITHUB_TOKEN environment variable is missing'
          })
        };
      }

      const { filename, sha, type } = JSON.parse(event.body);

      if (!filename || !sha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required fields',
            message: 'filename and sha are required'
          })
        };
      }

      const itemType = type === 'page' ? 'page' : 'post';

      // Permanently delete from _bin folder
      const deleteResponse = await githubRequest(`/contents/${BIN_DIR}/${filename}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: `Permanently delete ${itemType}: ${filename}`,
          sha: sha,
          branch: GITHUB_BRANCH
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} permanently deleted`,
          commitSha: deleteResponse.commit?.sha
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Trash function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        details: error.toString(),
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
