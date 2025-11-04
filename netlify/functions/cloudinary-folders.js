/**
 * Cloudinary Folders Netlify Function
 *
 * Provides read-only access to Cloudinary folder list.
 * Fetches folder structure from Cloudinary Admin API for use in settings dropdown.
 *
 * Security: Uses Basic Authentication with API Key and Secret.
 * Only GET requests are allowed.
 *
 * Supported operations:
 * - GET: Retrieve list of folders from Cloudinary
 *
 * @module netlify/functions/cloudinary-folders
 */

const https = require('https');

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'circleseven';
const CLOUDINARY_API_KEY = '732138267195618';
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Check for required environment variables
if (!CLOUDINARY_API_SECRET) {
  console.error('CLOUDINARY_API_SECRET environment variable is not set');
}

/**
 * Netlify Function Handler - Cloudinary Folders
 *
 * Main entry point for fetching folder list from Cloudinary.
 * Returns a list of all folders in the Cloudinary account.
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, OPTIONS)
 * @param {Object} context - Netlify function context
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // GET folders
 * // GET /.netlify/functions/cloudinary-folders
 * // Returns: {
 * //   folders: [
 * //     { name: "circle-seven", path: "circle-seven" },
 * //     { name: "blog", path: "blog" },
 * //     ...
 * //   ]
 * // }
 */
exports.handler = async (event, context) => {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Check if API secret is configured
    if (!CLOUDINARY_API_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({
          error: 'Configuration error',
          message: 'CLOUDINARY_API_SECRET environment variable is not set. Please add it to Netlify environment variables.'
        })
      };
    }

    // Fetch folders from Cloudinary Admin API
    const folders = await fetchCloudinaryFolders();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        folders: folders
      })
    };
  } catch (error) {
    console.error('Cloudinary folders error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch folders from Cloudinary',
        message: error.message,
        details: error.stack
      })
    };
  }
};

/**
 * Fetches folder list from Cloudinary Admin API
 *
 * Makes authenticated request to Cloudinary using Basic Auth.
 * Retrieves list of all folders in the Cloudinary account.
 *
 * @returns {Promise<Array>} Array of folder objects with name and path
 * @throws {Error} If Cloudinary API request fails or response cannot be parsed
 *
 * @example
 * const folders = await fetchCloudinaryFolders();
 * // Returns: [{
 * //   name: "circle-seven",
 * //   path: "circle-seven"
 * // }, ...]
 */
function fetchCloudinaryFolders() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD_NAME}/folders`,
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            // Extract folder paths from the response
            // Cloudinary returns { folders: [ { name: "folder1", path: "folder1" }, ... ] }
            resolve(parsed.folders || []);
          } catch (error) {
            reject(new Error('Failed to parse Cloudinary response'));
          }
        } else {
          reject(new Error(`Cloudinary API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}
