/**
 * Recently Published Content Netlify Function
 *
 * Fetches the 10 most recently modified posts and pages from GitHub for dashboard display.
 *
 * @module netlify/functions/recently-published
 */

const https = require('https');

// GitHub API configuration
const GITHUB_OWNER = 'mfrench71';
const GITHUB_REPO = 'circleseven-website';

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
 * Fetches recently modified files from a directory
 */
async function getRecentFiles(folder, type) {
  try {
    const contents = await githubRequest(`/contents/${folder}`);

    if (!Array.isArray(contents)) {
      return [];
    }

    // Filter markdown files
    const mdFiles = contents.filter(f => f.name.endsWith('.md'));

    // Fetch commit date for each file
    const filesWithDates = await Promise.all(
      mdFiles.map(async (file) => {
        try {
          const commits = await githubRequest(`/commits?path=${folder}/${file.name}&per_page=1`);
          const lastCommitDate = commits[0]?.commit?.committer?.date || new Date(0).toISOString();

          // Extract title from filename
          let title = file.name.replace(/\.md$/, '');
          // Remove date prefix if present (YYYY-MM-DD-)
          title = title.replace(/^\d{4}-\d{2}-\d{2}-/, '');
          // Convert hyphens to spaces and capitalize
          title = title.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

          return {
            name: file.name,
            type,
            folder,
            title,
            lastModified: new Date(lastCommitDate).toISOString()
          };
        } catch (error) {
          console.error(`Failed to fetch commit date for ${file.name}:`, error);
          return {
            name: file.name,
            type,
            folder,
            title: file.name,
            lastModified: new Date(0).toISOString()
          };
        }
      })
    );

    return filesWithDates;
  } catch (error) {
    console.error(`Failed to fetch files from ${folder}:`, error);
    return [];
  }
}

/**
 * Main handler function
 */
exports.handler = async (event, context) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Fetch both posts and pages in parallel
    const [posts, pages] = await Promise.all([
      getRecentFiles('_posts', 'Post'),
      getRecentFiles('_pages', 'Page')
    ]);

    // Combine and sort by last modified date (newest first)
    const allFiles = [...posts, ...pages];
    allFiles.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));

    // Return top 10
    const recentFiles = allFiles.slice(0, 10);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      },
      body: JSON.stringify(recentFiles)
    };
  } catch (error) {
    console.error('Error fetching recently published:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch recently published content' })
    };
  }
};
