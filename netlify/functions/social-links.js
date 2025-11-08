/**
 * Social Links Netlify Function
 * Manages social media links stored in _data/social.yml
 *
 * GET  - Fetch current social links
 * PUT  - Update social links
 */

const fs = require('fs');
const path = require('path');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'mfrench71';
const GITHUB_REPO = process.env.GITHUB_REPO || 'sun-nation-website';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const SOCIAL_FILE_PATH = '_data/social.yml';
const IS_LOCAL = process.env.NETLIFY_DEV === 'true' || !process.env.NETLIFY;

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Content-Type': 'application/json'
};

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Note: Authentication is handled by Netlify Identity at deployment
  // In local dev, context.clientContext may not be available
  // So we skip auth check in development for convenience

  try {
    if (event.httpMethod === 'GET') {
      return await handleGet();
    } else if (event.httpMethod === 'PUT') {
      return await handlePut(event);
    } else {
      return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
      };
    }
  } catch (error) {
    console.error('Social links function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

async function handleGet() {
  try {
    let content, sha;

    // In local development, read from file system
    if (IS_LOCAL) {
      const filePath = path.join(process.cwd(), SOCIAL_FILE_PATH);
      content = fs.readFileSync(filePath, 'utf8');
      sha = 'local-dev'; // Dummy SHA for local dev
    } else {
      // In production, read from GitHub
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SOCIAL_FILE_PATH}?ref=${GITHUB_BRANCH}`;

      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const data = await response.json();
      content = Buffer.from(data.content, 'base64').toString('utf8');
      sha = data.sha;
    }

    // Parse YAML manually (simple parser for this specific structure)
    const links = parseSimpleYAML(content);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        links,
        sha
      })
    };
  } catch (error) {
    console.error('Error fetching social links:', error);
    throw error;
  }
}

async function handlePut(event) {
  try {
    const { links, sha } = JSON.parse(event.body);

    if (!Array.isArray(links)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid links data' })
      };
    }

    // Validate links
    for (const link of links) {
      if (!link.platform || !link.slug || !link.url || typeof link.enabled !== 'boolean' || typeof link.order !== 'number') {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: 'Invalid link structure' })
        };
      }

      // Validate URL format
      try {
        new URL(link.url);
      } catch (e) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: `Invalid URL for ${link.platform}: ${link.url}` })
        };
      }
    }

    // Generate YAML content
    const yamlContent = generateYAML(links);

    let commitSha = 'local-dev';

    // In local development, write to file system
    if (IS_LOCAL) {
      const filePath = path.join(process.cwd(), SOCIAL_FILE_PATH);
      fs.writeFileSync(filePath, yamlContent, 'utf8');
    } else {
      // In production, update file on GitHub
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${SOCIAL_FILE_PATH}`;

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: 'Update social media links via admin\n\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n\nCo-Authored-By: Claude <noreply@anthropic.com>',
          content: Buffer.from(yamlContent).toString('base64'),
          sha: sha,
          branch: GITHUB_BRANCH
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`GitHub API error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      const result = await response.json();
      commitSha = result.commit.sha;
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Social links updated successfully',
        commitSha
      })
    };
  } catch (error) {
    console.error('Error updating social links:', error);
    throw error;
  }
}

/**
 * Simple YAML parser for social links structure
 */
function parseSimpleYAML(content) {
  const links = [];
  const lines = content.split('\n');
  let currentLink = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (!trimmed || trimmed.startsWith('#')) continue;

    // New link item
    if (trimmed.startsWith('- platform:')) {
      if (currentLink) links.push(currentLink);
      currentLink = { platform: trimmed.split(':', 2)[1].trim() };
    }
    // Properties of current link
    else if (currentLink && trimmed.includes(':')) {
      const [key, ...valueParts] = trimmed.split(':');
      const value = valueParts.join(':').trim();

      if (key === 'slug') currentLink.slug = value;
      else if (key === 'url') currentLink.url = value;
      else if (key === 'enabled') currentLink.enabled = value === 'true';
      else if (key === 'order') currentLink.order = parseInt(value);
    }
  }

  // Add last link
  if (currentLink) links.push(currentLink);

  return links;
}

/**
 * Generate YAML content from links array
 */
function generateYAML(links) {
  let yaml = '# Social Media Links Configuration\n';
  yaml += '# Managed via Admin > Appearance > Social Media Links\n\n';
  yaml += 'links:\n';

  for (const link of links) {
    yaml += `  - platform: ${link.platform}\n`;
    yaml += `    slug: ${link.slug}\n`;
    yaml += `    url: ${link.url}\n`;
    yaml += `    enabled: ${link.enabled}\n`;
    yaml += `    order: ${link.order}\n\n`;
  }

  return yaml;
}
