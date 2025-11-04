/**
 * Test Setup File
 *
 * Runs before all tests to configure the testing environment.
 */

import { vi } from 'vitest';

// Mock localStorage
const storage = {};
const localStorageMock = {
  getItem: vi.fn((key) => storage[key] || null),
  setItem: vi.fn((key, value) => { storage[key] = value; }),
  removeItem: vi.fn((key) => { delete storage[key]; }),
  clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
};

global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

global.sessionStorage = sessionStorageMock;

// Mock window.alert, window.confirm, window.prompt
global.alert = vi.fn();
global.confirm = vi.fn(() => true);
global.prompt = vi.fn(() => '');

// Mock console methods to reduce noise (optional)
// Uncomment if you want to suppress console output in tests
// global.console = {
//   ...console,
//   log: vi.fn(),
//   debug: vi.fn(),
//   info: vi.fn(),
//   warn: vi.fn(),
//   error: vi.fn(),
// };

// Set up global API_BASE for tests
global.API_BASE = '/.netlify/functions';

// Mock window object properties
global.window = global.window || {};
global.window.API_BASE = '/.netlify/functions';

/**
 * Mock EasyMDE (Markdown Editor)
 *
 * Provides a minimal mock that satisfies the interface used by
 * posts.js and pages.js modules.
 */
class MockEasyMDE {
  constructor(options) {
    this.element = options.element;
    this._value = '';

    // Mock CodeMirror instance
    this.codemirror = {
      on: vi.fn(),
      off: vi.fn(),
      getValue: () => this._value,
      setValue: (val) => { this._value = val; }
    };
  }

  value(val) {
    if (val !== undefined) {
      this._value = val;
      return;
    }
    return this._value;
  }

  toTextArea() {
    // Convert back to textarea (cleanup)
  }
}

// Make EasyMDE available globally
global.EasyMDE = MockEasyMDE;

/**
 * Mock window.showConfirm
 *
 * Used by delete operations to confirm actions
 */
global.showConfirm = vi.fn().mockResolvedValue(true);

/**
 * Mock window.showPrompt
 *
 * Used for text input dialogs
 */
global.showPrompt = vi.fn().mockResolvedValue('test-input');

/**
 * Mock formatDateForInput
 *
 * Utility function used by pages and posts modules
 */
global.formatDateForInput = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toISOString().slice(0, 16);
};

// Reset mocks before each test
beforeEach(() => {
  // Clear storage objects
  Object.keys(storage).forEach(key => delete storage[key]);

  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();

  // Reset global state
  if (global.window) {
    global.window.markdownEditor = null;
    global.window.pageMarkdownEditor = null;
    global.window.postHasUnsavedChanges = false;
    global.window.pageHasUnsavedChanges = false;
    global.window.allPages = [];
    global.window.allPosts = [];
  }
});

// Clean up after each test
afterEach(() => {
  vi.restoreAllMocks();
});
