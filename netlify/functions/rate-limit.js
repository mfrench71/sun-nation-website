/**
 * GitHub API Rate Limit Netlify Function
 *
 * Fetches the current GitHub API rate limit status for the authenticated token.
 * Returns remaining calls, limit, reset time, and usage percentage.
 *
 * @module netlify/functions/rate-limit
 */

const https = require('https');

/**
 * Makes authenticated request to GitHub rate_limit API
 *
 * @returns {Promise<Object>} GitHub rate limit response
 * @throws {Error} If GitHub API request fails
 */
function fetchRateLimit() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: '/rate_limit',
      method: 'GET',
      headers: {
        'User-Agent': 'Netlify-Function',
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${process.env.GITHUB_TOKEN}`
      }
    };

    const req = https.request(options, (res) => {
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
 * Netlify Function Handler - GitHub Rate Limit
 *
 * Returns current GitHub API rate limit status including:
 * - Core API limit and remaining calls
 * - Reset timestamp
 * - Usage percentage
 * - Time until reset
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, OPTIONS)
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // GET rate limit status
 * // GET /.netlify/functions/rate-limit
 * // Returns: {
 * //   limit: 5000,
 * //   remaining: 4850,
 * //   reset: 1634567890,
 * //   used: 150,
 * //   usedPercent: 3,
 * //   resetDate: "2021-10-18T12:34:50.000Z",
 * //   minutesUntilReset: 42
 * // }
 */
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    if (event.httpMethod === 'GET') {
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

      const rateLimitData = await fetchRateLimit();

      // Extract core API rate limit (most relevant for our use case)
      const core = rateLimitData.resources.core;
      const now = Math.floor(Date.now() / 1000);
      const secondsUntilReset = core.reset - now;
      const minutesUntilReset = Math.max(0, Math.ceil(secondsUntilReset / 60));
      const usedPercent = Math.round(((core.limit - core.remaining) / core.limit) * 100);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          limit: core.limit,
          remaining: core.remaining,
          reset: core.reset,
          used: core.used,
          usedPercent: usedPercent,
          resetDate: new Date(core.reset * 1000).toISOString(),
          minutesUntilReset: minutesUntilReset
        })
      };
    }

    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };

  } catch (error) {
    console.error('Rate limit function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message,
        details: error.toString()
      })
    };
  }
};
