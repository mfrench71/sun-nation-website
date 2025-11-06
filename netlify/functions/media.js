/**
 * Media Library Netlify Function
 *
 * Provides read-only access to Cloudinary media library resources.
 * Fetches image metadata from Cloudinary Admin API for use in the media browser.
 *
 * Security: Uses Basic Authentication with API Key and Secret.
 * Only GET requests are allowed - no upload or delete operations.
 *
 * Supported operations:
 * - GET: Retrieve list of media resources from Cloudinary
 *
 * @module netlify/functions/media
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
 * Netlify Function Handler - Media Library
 *
 * Main entry point for media library access. Fetches media resources from
 * Cloudinary Admin API with pagination support (max 500 results).
 *
 * @param {Object} event - Netlify function event object
 * @param {string} event.httpMethod - HTTP method (GET, OPTIONS)
 * @param {Object} context - Netlify function context
 * @returns {Promise<Object>} Response object with statusCode, headers, and body
 *
 * @example
 * // GET media resources
 * // GET /.netlify/functions/media
 * // Returns: {
 * //   resources: [
 * //     {
 * //       public_id: "image1",
 * //       format: "jpg",
 * //       width: 1920,
 * //       height: 1080,
 * //       secure_url: "https://res.cloudinary.com/..."
 * //     },
 * //     ...
 * //   ],
 * //   total: 25
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

    // Fetch resources from Cloudinary Admin API
    const resources = await fetchCloudinaryResources();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        resources: resources,
        total: resources.length
      })
    };
  } catch (error) {
    console.error('Media fetch error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to fetch media',
        message: error.message,
        details: error.stack
      })
    };
  }
};

/**
 * Fetches media resources from Cloudinary Admin API
 *
 * Makes authenticated request to Cloudinary using Basic Auth.
 * Retrieves up to 500 image resources with metadata including URLs,
 * dimensions, format, and public IDs.
 *
 * @returns {Promise<Array>} Array of Cloudinary resource objects
 * @throws {Error} If Cloudinary API request fails or response cannot be parsed
 *
 * @example
 * const resources = await fetchCloudinaryResources();
 * // Returns: [{
 * //   public_id: "sample",
 * //   format: "jpg",
 * //   version: 1234567890,
 * //   resource_type: "image",
 * //   type: "upload",
 * //   created_at: "2025-10-21T10:00:00Z",
 * //   bytes: 125000,
 * //   width: 1920,
 * //   height: 1080,
 * //   url: "http://...",
 * //   secure_url: "https://..."
 * // }, ...]
 */
function fetchCloudinaryResources() {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${CLOUDINARY_API_KEY}:${CLOUDINARY_API_SECRET}`).toString('base64');

    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD_NAME}/resources/image?max_results=500&type=upload`,
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
            resolve(parsed.resources || []);
          } catch (error) {
            reject(new Error('Failed to parse Cloudinary response'));
          }
        } else {
          reject(new Error(`Cloudinary API error: ${res.statusCode}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}
