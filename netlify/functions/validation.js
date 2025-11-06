/**
 * Input Validation Utilities for Netlify Functions
 *
 * Provides security validation functions to prevent common attacks
 * like path traversal, XSS, and injection.
 *
 * @module netlify/functions/validation
 */

/**
 * Validates a filename to prevent path traversal attacks
 *
 * @param {string} filename - The filename to validate
 * @returns {boolean} True if valid, false otherwise
 *
 * @example
 * validateFilename('2025-10-21-post.md') // true
 * validateFilename('../../../etc/passwd') // false
 * validateFilename('file/with/slash.md') // false
 */
function validateFilename(filename) {
  if (!filename || typeof filename !== 'string') {
    return false;
  }

  // Check for path traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false;
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return false;
  }

  // Must be alphanumeric with allowed characters: dash, underscore, dot
  // and must end with .md
  const validPattern = /^[a-zA-Z0-9_-]+\.md$/;
  return validPattern.test(filename);
}

/**
 * Validates a folder path to prevent path traversal
 *
 * @param {string} path - The path to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validatePath(path) {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Check for path traversal attempts
  if (path.includes('..')) {
    return false;
  }

  // Check for null bytes
  if (path.includes('\0')) {
    return false;
  }

  // Must be alphanumeric with slashes, dashes, underscores
  const validPattern = /^[a-zA-Z0-9/_-]+$/;
  return validPattern.test(path);
}

/**
 * Validates a Git SHA hash
 *
 * @param {string} sha - The SHA to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSha(sha) {
  if (!sha || typeof sha !== 'string') {
    return false;
  }

  // Git SHA-1 is 40 hex characters
  const validPattern = /^[a-f0-9]{40}$/i;
  return validPattern.test(sha);
}

/**
 * Validates a commit SHA (can be shorter than full SHA)
 *
 * @param {string} sha - The commit SHA to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateCommitSha(sha) {
  if (!sha || typeof sha !== 'string') {
    return false;
  }

  // Commit SHA can be 7-40 hex characters
  const validPattern = /^[a-f0-9]{7,40}$/i;
  return validPattern.test(sha);
}

/**
 * Sanitizes a string to prevent XSS
 *
 * @param {string} str - The string to sanitize
 * @returns {string} Sanitized string
 */
function sanitizeString(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Remove HTML tags and dangerous characters
  return str
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}

/**
 * Validates an object has required fields
 *
 * @param {Object} obj - The object to validate
 * @param {string[]} requiredFields - Array of required field names
 * @returns {Object} Validation result
 * @returns {boolean} .valid - Whether validation passed
 * @returns {string[]} .missing - Array of missing field names
 */
function validateRequiredFields(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, missing: requiredFields };
  }

  const missing = requiredFields.filter(field => {
    return obj[field] === undefined || obj[field] === null || obj[field] === '';
  });

  return {
    valid: missing.length === 0,
    missing
  };
}

/**
 * Validates that a value is one of the allowed options
 *
 * @param {*} value - The value to validate
 * @param {Array} allowedValues - Array of allowed values
 * @returns {boolean} True if valid, false otherwise
 */
function validateEnum(value, allowedValues) {
  return allowedValues.includes(value);
}

module.exports = {
  validateFilename,
  validatePath,
  validateSha,
  validateCommitSha,
  sanitizeString,
  validateRequiredFields,
  validateEnum
};
