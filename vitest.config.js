import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use happy-dom for faster DOM testing (alternative: jsdom)
    environment: 'happy-dom',

    // Setup files to run before tests
    setupFiles: ['./tests/setup.js'],

    // Test file patterns
    include: ['tests/**/*.test.js'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '_site/',
        '.jekyll-cache/',
        'admin/app.js', // Main app file - will be tested via integration
      ],
      include: [
        'admin/js/**/*.js',
        'netlify/functions/**/*.js'
      ],
      // Aim for high coverage
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    },

    // Globals like describe, it, expect available without import
    globals: true,

    // Test timeout
    testTimeout: 10000,

    // Reporter
    reporter: ['verbose', 'html'],

    // Mock localStorage, sessionStorage, etc.
    mockReset: true,
    restoreMocks: true,
  },

  // Resolve module imports
  resolve: {
    alias: {
      '@': '/admin/js',
      '@functions': '/netlify/functions',
    },
  },
});
