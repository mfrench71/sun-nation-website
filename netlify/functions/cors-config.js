/**
 * CORS Configuration Module
 *
 * Centralizes CORS header management for all Netlify Functions.
 * Implements origin whitelisting for security.
 *
 * @module netlify/functions/cors-config
 */

/**
 * Allowed origins for CORS requests
 * Add your production and development domains here
 */
const ALLOWED_ORIGINS = [
  'https://sun-nation.co.uk',
  'https://www.sun-nation.co.uk',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
];

/**
 * Get CORS headers for a given origin
 *
 * @param {string} origin - The origin from the request headers
 * @param {string[]} allowedMethods - HTTP methods to allow (e.g., ['GET', 'POST'])
 * @returns {Object} CORS headers object
 */
function getCorsHeaders(origin, allowedMethods = ['GET', 'OPTIONS']) {
  // Check if origin is in whitelist
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': allowedMethods.join(', '),
    'Content-Type': 'application/json',
    'Vary': 'Origin' // Important: tells caches that response varies by origin
  };
}

/**
 * Handle CORS preflight request
 *
 * @param {string} origin - The origin from the request headers
 * @param {string[]} allowedMethods - HTTP methods to allow
 * @returns {Object} Response object for preflight request
 */
function handlePreflight(origin, allowedMethods) {
  return {
    statusCode: 200,
    headers: getCorsHeaders(origin, allowedMethods),
    body: ''
  };
}

module.exports = {
  ALLOWED_ORIGINS,
  getCorsHeaders,
  handlePreflight
};
