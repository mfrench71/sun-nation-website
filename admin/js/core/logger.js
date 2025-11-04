/**
 * Logger Utility
 * Provides conditional logging that only outputs in development mode
 * Use this instead of console.log to keep production code clean
 */

// Check if we're in development mode
// Development indicators: localhost, file protocol, or debug flag in localStorage
const isDevelopment = () => {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const debugMode = localStorage.getItem('admin_debug_mode') === 'true';

  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('192.168.') ||
    protocol === 'file:' ||
    debugMode
  );
};

/**
 * Logger class with methods matching console API
 */
class Logger {
  constructor() {
    this.isDev = isDevelopment();
  }

  /**
   * Log informational messages (only in development)
   * @param {...any} args - Arguments to log
   */
  log(...args) {
    if (this.isDev) {
      console.log(...args);
    }
  }

  /**
   * Log informational messages (only in development)
   * @param {...any} args - Arguments to log
   */
  info(...args) {
    if (this.isDev) {
      console.info(...args);
    }
  }

  /**
   * Log warning messages (only in development)
   * @param {...any} args - Arguments to log
   */
  warn(...args) {
    if (this.isDev) {
      console.warn(...args);
    }
  }

  /**
   * Log error messages (always logged, even in production)
   * @param {...any} args - Arguments to log
   */
  error(...args) {
    // Always log errors, even in production
    console.error(...args);
  }

  /**
   * Log debug messages (only in development)
   * @param {...any} args - Arguments to log
   */
  debug(...args) {
    if (this.isDev) {
      console.debug(...args);
    }
  }

  /**
   * Start a console group (only in development)
   * @param {string} label - Group label
   */
  group(label) {
    if (this.isDev && console.group) {
      console.group(label);
    }
  }

  /**
   * End a console group (only in development)
   */
  groupEnd() {
    if (this.isDev && console.groupEnd) {
      console.groupEnd();
    }
  }

  /**
   * Log a table (only in development)
   * @param {any} data - Data to display as table
   */
  table(data) {
    if (this.isDev && console.table) {
      console.table(data);
    }
  }

  /**
   * Enable debug mode manually
   */
  enableDebugMode() {
    localStorage.setItem('admin_debug_mode', 'true');
    this.isDev = true;
    this.log('Debug mode enabled. Logging will persist even on production URLs.');
  }

  /**
   * Disable debug mode
   */
  disableDebugMode() {
    localStorage.removeItem('admin_debug_mode');
    this.isDev = isDevelopment();
    console.log('Debug mode disabled.');
  }

  /**
   * Check if currently in development mode
   * @returns {boolean}
   */
  isDevMode() {
    return this.isDev;
  }
}

// Create and export singleton instance
const logger = new Logger();

// Export default instance
export default logger;

// Also export individual methods for convenience
export const { log, info, warn, error, debug, group, groupEnd, table, enableDebugMode, disableDebugMode, isDevMode } = logger;

// Expose logger to window for non-module scripts (like app.js)
if (typeof window !== 'undefined') {
  window.logger = logger;
}
