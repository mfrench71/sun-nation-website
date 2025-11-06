/**
 * Deployment Status Netlify Function
 *
 * Monitors GitHub Actions workflow status for specific commits.
 * Used to track deployment progress after content changes.
 *
 * Queries GitHub Actions API to find workflow runs matching a commit SHA
 * and returns simplified status information for UI display.
 *
 * Supported operations:
 * - GET: Check deployment status for a specific commit
 *
 * @module netlify/functions/deployment-status
 */

const https = require('https');

// Validation utilities
function validateCommitSha(sha) {
  if (!sha || typeof sha !== 'string') return false;
  const validPattern = /^[a-f0-9]{7,40}$/i;
  return validPattern.test(sha);
}

// CORS Configuration
const ALLOWED_ORIGINS = [
  'https://sun-nation.co.uk',
  'https://www.sun-nation.co.uk',
  'http://localhost:4000',
  'http://127.0.0.1:4000',
  'http://localhost:8888',
  'http://127.0.0.1:8888'
];

function getCorsHeaders(origin, allowedMethods = ['GET', 'OPTIONS']) {
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
    'Content-Type': 'application/json',
    'Vary': 'Origin'
  };
}

function handlePreflight(origin, allowedMethods) {
  return {
    statusCode: 200,
    headers: getCorsHeaders(origin, allowedMethods),
    body: ''
  };
}

// GitHub API configuration
const GITHUB_OWNER = 'mfrench71';
const GITHUB_REPO = 'sun-nation-website';
const WORKFLOW_NAME = 'Deploy Jekyll site to GitHub Pages';

/**
 * Makes authenticated requests to the GitHub API
 *
 * @param {string} path - GitHub API endpoint path (relative to /repos/{owner}/{repo})
 * @param {Object} [options={}] - Request options
 * @param {string} [options.method='GET'] - HTTP method
 * @param {Object} [options.headers] - Additional headers
 * @returns {Promise<Object>} Parsed JSON response from GitHub API
 * @throws {Error} If the GitHub API returns a non-2xx status code
 */
function githubRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
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
    req.end();
  });
}

/**
 * Netlify Function Handler - Deployment Status
 *
 * Checks the deployment status for a specific commit by querying
 * GitHub Actions workflow runs.
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, OPTIONS)
 * @param {Object} event.queryStringParameters - URL query parameters
 * @param {string} event.queryStringParameters.sha - Commit SHA to check
 * @param {Object} context - Netlify function context
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // Check deployment status
 * // GET /.netlify/functions/deployment-status?sha=abc123def456
 * // Returns: {
 * //   status: "in_progress",
 * //   message: "Deploying to GitHub Pages...",
 * //   commitSha: "abc123def456",
 * //   workflowUrl: "https://github.com/.../actions/runs/123",
 * //   startedAt: "2025-10-21T10:00:00Z",
 * //   updatedAt: "2025-10-21T10:02:30Z",
 * //   conclusion: null
 * // }
 *
 * @example
 * // Deployment completed successfully
 * // Returns: {
 * //   status: "completed",
 * //   message: "Deployment completed successfully",
 * //   commitSha: "abc123def456",
 * //   workflowUrl: "https://github.com/.../actions/runs/123",
 * //   startedAt: "2025-10-21T10:00:00Z",
 * //   updatedAt: "2025-10-21T10:05:00Z",
 * //   conclusion: "success"
 * // }
 */
exports.handler = async (event, context) => {
  // Get origin from request
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin, ['GET', 'OPTIONS']);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(origin, ['GET', 'OPTIONS']);
  }

  try {
    if (event.httpMethod === 'GET') {
      const commitSha = event.queryStringParameters?.sha;

      if (!commitSha) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Missing required parameter',
            message: 'sha query parameter is required'
          })
        };
      }

      // Validate commit SHA format
      if (!validateCommitSha(commitSha)) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({
            error: 'Invalid commit SHA',
            message: 'SHA must be a valid 7-40 character hex string'
          })
        };
      }

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

      // Get workflow runs for this commit SHA
      // We'll look at the most recent runs and find ones matching our commit
      const runsResponse = await githubRequest(
        `/actions/runs?per_page=20&branch=main`
      );

      // Find workflow runs for this specific commit
      const matchingRuns = runsResponse.workflow_runs.filter(run =>
        run.head_sha === commitSha && run.name === WORKFLOW_NAME
      );

      if (matchingRuns.length === 0) {
        // No workflow run found yet - it may not have started
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({
            status: 'pending',
            message: 'Waiting for deployment to start...',
            commitSha: commitSha
          })
        };
      }

      // Get the most recent run for this commit
      const workflowRun = matchingRuns[0];

      // Map GitHub Actions status to our simplified status
      let deploymentStatus;
      let message;

      switch (workflowRun.status) {
        case 'pending':
          deploymentStatus = 'pending';
          message = 'Deployment pending...';
          break;
        case 'queued':
          deploymentStatus = 'queued';
          message = 'Deployment queued...';
          break;
        case 'in_progress':
          deploymentStatus = 'in_progress';
          message = 'Deploying to GitHub Pages...';
          break;
        case 'completed':
          // Check conclusion to see if it succeeded or failed
          if (workflowRun.conclusion === 'success') {
            deploymentStatus = 'completed';
            message = 'Deployment completed successfully';
          } else if (workflowRun.conclusion === 'failure') {
            deploymentStatus = 'failed';
            message = 'Deployment failed';
          } else if (workflowRun.conclusion === 'cancelled') {
            deploymentStatus = 'cancelled';
            message = 'Deployment cancelled';
          } else if (workflowRun.conclusion === 'skipped') {
            deploymentStatus = 'skipped';
            message = 'Deployment skipped (superseded by newer commit)';
          } else {
            deploymentStatus = 'completed';
            message = `Deployment completed with status: ${workflowRun.conclusion}`;
          }
          break;
        default:
          deploymentStatus = 'unknown';
          message = `Unknown deployment status: ${workflowRun.status}`;
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: deploymentStatus,
          message: message,
          commitSha: commitSha,
          workflowUrl: workflowRun.html_url,
          startedAt: workflowRun.created_at,
          updatedAt: workflowRun.updated_at,
          conclusion: workflowRun.conclusion
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Deployment status function error:', error);
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
