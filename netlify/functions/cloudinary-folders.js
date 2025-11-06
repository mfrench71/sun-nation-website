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

// Cloudinary configuration - all values must be set via environment variables
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Validate required environment variables
function validateCloudinaryConfig() {
  const missing = [];
  if (!CLOUDINARY_CLOUD_NAME) missing.push('CLOUDINARY_CLOUD_NAME');
  if (!CLOUDINARY_API_KEY) missing.push('CLOUDINARY_API_KEY');
  if (!CLOUDINARY_API_SECRET) missing.push('CLOUDINARY_API_SECRET');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
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
  // Get origin from request
  const origin = event.headers.origin || event.headers.Origin;
  const headers = getCorsHeaders(origin, ['GET', 'OPTIONS']);

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return handlePreflight(origin, ['GET', 'OPTIONS']);
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
    // Validate all required Cloudinary configuration
    validateCloudinaryConfig();

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
