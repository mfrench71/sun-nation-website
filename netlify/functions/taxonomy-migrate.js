/**
 * Taxonomy Migration Netlify Function
 *
 * Provides bulk operations for taxonomy management:
 * - Find all posts/pages using a specific category or tag
 * - Rename categories/tags across all content
 * - Merge multiple categories/tags into one
 * - Preview affected content before making changes
 *
 * This is useful for:
 * - Reorganizing taxonomy structure
 * - Fixing typos or inconsistencies
 * - Consolidating similar categories/tags
 * - Migrating from flat to hierarchical categories
 *
 * @module netlify/functions/taxonomy-migrate
 */

const https = require('https');
const yaml = require('js-yaml');

// GitHub API configuration
const GITHUB_OWNER = 'mfrench71';
const GITHUB_REPO = 'circleseven-website';
const GITHUB_BRANCH = 'main';

/**
 * Makes authenticated requests to the GitHub API
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
 * Parses front matter from markdown content
 */
function parseFrontMatter(content) {
  const fmRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(fmRegex);

  if (!match) {
    return { frontMatter: {}, body: content, hasFrontMatter: false };
  }

  try {
    const frontMatter = yaml.load(match[1]);
    return { frontMatter, body: match[2], hasFrontMatter: true };
  } catch (error) {
    return { frontMatter: {}, body: content, hasFrontMatter: false };
  }
}

/**
 * Serializes front matter back to YAML
 */
function serializeFrontMatter(frontMatter, body) {
  const yamlStr = yaml.dump(frontMatter, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false
  });

  return `---\n${yamlStr}---\n${body}`;
}

/**
 * Gets all files from a directory via GitHub API
 */
async function getDirectoryFiles(path) {
  try {
    const response = await githubRequest(`/contents/${path}?ref=${GITHUB_BRANCH}`);
    return Array.isArray(response) ? response : [];
  } catch (error) {
    console.error(`Error fetching directory ${path}:`, error.message);
    return [];
  }
}

/**
 * Gets file content from GitHub
 */
async function getFileContent(path) {
  try {
    const fileData = await githubRequest(`/contents/${path}?ref=${GITHUB_BRANCH}`);
    return Buffer.from(fileData.content, 'base64').toString('utf8');
  } catch (error) {
    console.error(`Error fetching file ${path}:`, error.message);
    return null;
  }
}

/**
 * Updates file content on GitHub
 */
async function updateFileContent(path, content, message, sha) {
  return await githubRequest(`/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: {
      message,
      content: Buffer.from(content).toString('base64'),
      sha,
      branch: GITHUB_BRANCH
    }
  });
}

/**
 * Finds all posts/pages using specific taxonomy terms
 */
async function findContentWithTaxonomy(type, terms) {
  const termSet = new Set(terms.map(t => t.toLowerCase()));
  const affected = [];

  // Search in _posts and _pages directories
  const directories = ['_posts', '_pages'];

  for (const dir of directories) {
    const files = await getDirectoryFiles(dir);

    for (const file of files) {
      if (!file.name.endsWith('.md')) continue;

      const content = await getFileContent(file.path);
      if (!content) continue;

      const { frontMatter } = parseFrontMatter(content);

      // Check if this file uses any of the specified terms
      const fileTerms = type === 'category'
        ? (frontMatter.categories || [])
        : (frontMatter.tags || []);

      const matchingTerms = fileTerms.filter(term =>
        termSet.has(term.toLowerCase())
      );

      if (matchingTerms.length > 0) {
        affected.push({
          path: file.path,
          name: file.name,
          sha: file.sha,
          matchingTerms,
          allTerms: fileTerms
        });
      }
    }
  }

  return affected;
}

/**
 * Renames a taxonomy term across all content
 */
async function renameTaxonomy(type, oldName, newName) {
  const affected = await findContentWithTaxonomy(type, [oldName]);
  const updated = [];
  const errors = [];

  for (const file of affected) {
    try {
      const content = await getFileContent(file.path);
      const { frontMatter, body } = parseFrontMatter(content);

      // Update the taxonomy term
      const key = type === 'category' ? 'categories' : 'tags';
      if (frontMatter[key]) {
        frontMatter[key] = frontMatter[key].map(term =>
          term.toLowerCase() === oldName.toLowerCase() ? newName : term
        );
      }

      // Serialize and update
      const newContent = serializeFrontMatter(frontMatter, body);
      const response = await updateFileContent(
        file.path,
        newContent,
        `Rename ${type}: "${oldName}" → "${newName}"`,
        file.sha
      );

      updated.push({
        path: file.path,
        commitSha: response.commit?.sha
      });
    } catch (error) {
      errors.push({
        path: file.path,
        error: error.message
      });
    }
  }

  return { updated, errors, totalAffected: affected.length };
}

/**
 * Merges multiple taxonomy terms into one
 */
async function mergeTaxonomy(type, sourceTerms, targetTerm) {
  const affected = await findContentWithTaxonomy(type, sourceTerms);
  const updated = [];
  const errors = [];

  for (const file of affected) {
    try {
      const content = await getFileContent(file.path);
      const { frontMatter, body } = parseFrontMatter(content);

      // Merge taxonomy terms
      const key = type === 'category' ? 'categories' : 'tags';
      if (frontMatter[key]) {
        const sourceSet = new Set(sourceTerms.map(t => t.toLowerCase()));

        // Replace all source terms with target term
        const newTerms = frontMatter[key].map(term =>
          sourceSet.has(term.toLowerCase()) ? targetTerm : term
        );

        // Remove duplicates and assign
        frontMatter[key] = [...new Set(newTerms)];
      }

      // Serialize and update
      const newContent = serializeFrontMatter(frontMatter, body);
      const response = await updateFileContent(
        file.path,
        newContent,
        `Merge ${type}s: [${sourceTerms.join(', ')}] → "${targetTerm}"`,
        file.sha
      );

      updated.push({
        path: file.path,
        commitSha: response.commit?.sha
      });
    } catch (error) {
      errors.push({
        path: file.path,
        error: error.message
      });
    }
  }

  return { updated, errors, totalAffected: affected.length };
}

/**
 * Main handler
 */
exports.handler = async (event, context) => {
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

    const body = JSON.parse(event.body || '{}');
    const { operation, type, terms, oldName, newName, sourceTerms, targetTerm } = body;

    // Validate type
    if (!['category', 'tag'].includes(type)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid type. Must be "category" or "tag"' })
      };
    }

    // Handle different operations
    switch (operation) {
      case 'find':
        // Find all content using specified terms
        if (!terms || !Array.isArray(terms) || terms.length === 0) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing or invalid "terms" array' })
          };
        }

        const affected = await findContentWithTaxonomy(type, terms);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            operation: 'find',
            type,
            terms,
            totalAffected: affected.length,
            affected
          })
        };

      case 'rename':
        // Rename a taxonomy term across all content
        if (!oldName || !newName) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing "oldName" or "newName"' })
          };
        }

        const renameResult = await renameTaxonomy(type, oldName, newName);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            operation: 'rename',
            type,
            oldName,
            newName,
            ...renameResult
          })
        };

      case 'merge':
        // Merge multiple terms into one
        if (!sourceTerms || !Array.isArray(sourceTerms) || !targetTerm) {
          return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Missing "sourceTerms" array or "targetTerm"' })
          };
        }

        const mergeResult = await mergeTaxonomy(type, sourceTerms, targetTerm);
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            operation: 'merge',
            type,
            sourceTerms,
            targetTerm,
            ...mergeResult
          })
        };

      default:
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid operation',
            validOperations: ['find', 'rename', 'merge']
          })
        };
    }

  } catch (error) {
    console.error('Taxonomy migrate function error:', error);
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
