/**
 * Taxonomy Management Netlify Function
 *
 * Manages site-wide taxonomy (categories and tags) stored in _data/taxonomy.yml.
 * Provides read and update operations via GitHub API integration.
 *
 * The taxonomy file uses YAML format with structured lists:
 * categories:
 *   - item: Category Name
 * tags:
 *   - item: Tag Name
 *
 * Supported operations:
 * - GET: Retrieve current categories and tags
 * - PUT: Update taxonomy with new categories and tags lists
 *
 * @module netlify/functions/taxonomy
 */

const https = require('https');
const yaml = require('js-yaml');

// GitHub API configuration
const GITHUB_OWNER = 'mfrench71';
const GITHUB_REPO = 'circleseven-website';
const GITHUB_BRANCH = 'main';
const FILE_PATH = '_data/taxonomy.yml';

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
    const req = https.request({
      hostname: 'api.github.com',
      path: `/repos/${GITHUB_OWNER}/${GITHUB_REPO}${path}`,
      method: options.method || 'GET',
      headers: {
        'User-Agent': 'Netlify-Function',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`,
        ...options.headers
      }
    }, (res) => {
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
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

/**
 * Netlify Function Handler - Taxonomy Management
 *
 * Main entry point for taxonomy management. Handles reading and updating
 * the site's categories and tags taxonomy via REST API.
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, PUT, OPTIONS)
 * @param {string} event.body - Request body (JSON string for PUT)
 * @param {Object} context - Netlify function context
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // GET taxonomy
 * // GET /.netlify/functions/taxonomy
 * // Returns: { categories: ["Tech", "Life"], tags: ["JavaScript", "Travel"] }
 *
 * @example
 * // UPDATE taxonomy
 * // PUT /.netlify/functions/taxonomy
 * // Body: {
 * //   categories: ["Tech", "Life", "Photography"],
 * //   tags: ["JavaScript", "Travel", "Coding"]
 * // }
 * // Returns: { success: true, message: "...", commitSha: "..." }
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
    // GET - Read taxonomy from GitHub
    if (event.httpMethod === 'GET') {
      const fileData = await githubRequest(`/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`);
      const content = Buffer.from(fileData.content, 'base64').toString('utf8');
      const taxonomy = yaml.load(content);

      /**
       * Flattens hierarchical categories to simple string array
       * Maintains backwards compatibility with existing code
       */
      const flattenCategories = (categories) => {
        const flat = [];
        categories.forEach(cat => {
          // Add parent
          const name = typeof cat === 'string' ? cat : cat.item;
          flat.push(name);

          // Add children if they exist
          if (cat.children && Array.isArray(cat.children)) {
            cat.children.forEach(child => {
              flat.push(typeof child === 'string' ? child : child.item);
            });
          }
        });
        return flat;
      };

      /**
       * Extracts strings from flat tag array
       */
      const extractStrings = (arr) => arr.map(item =>
        typeof item === 'string' ? item : (item.item || item)
      );

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          // Flat arrays for backwards compatibility
          categories: flattenCategories(taxonomy.categories || []),
          tags: extractStrings(taxonomy.tags || []),

          // Hierarchical structure for new UI
          categoriesTree: taxonomy.categories || [],
          tagsTree: taxonomy.tags || []
        })
      };
    }

    // PUT - Update taxonomy via GitHub API
    if (event.httpMethod === 'PUT') {
      // Check for GitHub token
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

      const requestBody = JSON.parse(event.body);

      // Accept either flat arrays (backwards compat) or hierarchical trees
      const categoriesTree = requestBody.categoriesTree ||
        (requestBody.categories || []).map(c => ({ item: c, slug: '', children: [] }));
      const tagsTree = requestBody.tagsTree ||
        (requestBody.tags || []).map(t => ({ item: t, slug: '' }));

      // Validate input
      if (!Array.isArray(categoriesTree) || !Array.isArray(tagsTree)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid input: categories and tags must be arrays' })
        };
      }

      // Get current file to get its SHA
      const currentFile = await githubRequest(`/contents/${FILE_PATH}?ref=${GITHUB_BRANCH}`);

      /**
       * Generates YAML for a category with optional children
       */
      const generateCategoryYAML = (cat, indent = 2) => {
        const spaces = ' '.repeat(indent);
        let yaml = `${spaces}- item: ${cat.item}\n`;
        yaml += `${spaces}  slug: ${cat.slug || ''}\n`;

        if (cat.children && cat.children.length > 0) {
          yaml += `${spaces}  children:\n`;
          cat.children.forEach(child => {
            yaml += `${spaces}    - item: ${child.item}\n`;
            yaml += `${spaces}      slug: ${child.slug || ''}\n`;
          });
        } else {
          yaml += `${spaces}  children: []\n`;
        }

        return yaml;
      };

      /**
       * Generates YAML for a tag
       */
      const generateTagYAML = (tag) => {
        return `  - item: ${tag.item}\n    slug: ${tag.slug || ''}\n`;
      };

      // Create YAML with comments and hierarchy
      const yamlContent = `# Site Taxonomy - Manage categories and tags used across the site
# Edit these lists in CMS Settings > Taxonomy (Categories & Tags)
#
# Categories now support hierarchy with parent-child relationships.
# Each category can have optional 'slug' and 'children' fields.
# Children inherit from their parent for organizational purposes.

categories:
${categoriesTree.map(c => generateCategoryYAML(c, 2)).join('')}
tags:
${tagsTree.map(t => generateTagYAML(t)).join('')}
`;

      // Update file via GitHub API
      const updateResponse = await githubRequest(`/contents/${FILE_PATH}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: {
          message: 'Update taxonomy from custom admin',
          content: Buffer.from(yamlContent).toString('base64'),
          sha: currentFile.sha,
          branch: GITHUB_BRANCH
        }
      });

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Taxonomy updated successfully. Netlify will rebuild the site automatically.',
          commitSha: updateResponse.commit?.sha
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Taxonomy function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      })
    };
  }
};
