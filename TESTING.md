# Testing Documentation

## Overview

This project has comprehensive test coverage across three layers:

1. **Unit Tests** - Test individual functions and modules in isolation
2. **Integration Tests** - Test module interactions and initialization
3. **E2E Tests** - Test complete user workflows in a real browser

**Total Test Count**: 729+ tests across all layers

## Test Infrastructure

### Frameworks and Tools

- **Vitest** - Unit and integration testing framework
- **Playwright** - End-to-end browser testing
- **Happy-DOM** - Lightweight DOM implementation for unit tests
- **Coverage** - V8 coverage reporting via Vitest

### Test Directory Structure

```
tests/
├── unit/                      # Unit tests
│   ├── backend/               # Netlify Functions tests
│   │   ├── posts.test.js      # 42 tests - Posts API
│   │   ├── pages.test.js      # Test file exists
│   │   ├── trash.test.js      # 39 tests - Trash API
│   │   ├── settings.test.js   # 27 tests - Settings API
│   │   ├── taxonomy.test.js   # 28 tests - Taxonomy API
│   │   ├── deployment-status.test.js # 24 tests
│   │   ├── deployment-history.test.js # 19 tests
│   │   └── media.test.js      # 21 tests - Cloudinary integration
│   └── frontend/              # Admin interface tests
│       ├── posts.test.js      # 58 tests - Posts module
│       └── notifications.test.js # Notification system
├── integration/               # Integration tests
│   └── module-loading.test.js # Module initialization tests
├── e2e/                       # End-to-end tests
│   ├── admin-smoke.spec.js    # Basic smoke tests
│   ├── admin-comprehensive.spec.js # 65 tests - Full admin workflows
│   └── jekyll-site.spec.js    # 45 tests - Jekyll site features
└── utils/                     # Test utilities
    ├── dom-helpers.js         # DOM manipulation helpers
    └── mock-data.js           # Mock data generators
```

## Running Tests

### Quick Start

```bash
# Run all unit and integration tests
npm test

# Run ALL tests (unit, integration, and E2E)
npm run test:all

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:e2e          # E2E tests only
```

### Development Workflow

```bash
# Watch mode for TDD
npm run test:watch

# Interactive UI
npm run test:ui

# Coverage report
npm run test:coverage
```

### E2E Testing Options

```bash
# Headless mode (default)
npm run test:e2e

# UI mode (interactive)
npm run test:e2e:ui

# Headed mode (see browser)
npm run test:e2e:headed

# Debug mode (step through)
npm run test:e2e:debug
```

## Test Coverage

### Backend API Tests (200+ tests)

All Netlify serverless functions have comprehensive unit test coverage:

#### Posts API (`tests/unit/backend/posts.test.js`) - 42 tests
- ✅ CORS and OPTIONS handling
- ✅ GET - List all posts with optional metadata
- ✅ GET - Single post retrieval by filename
- ✅ POST - Create new posts with frontmatter
- ✅ PUT - Update posts with SHA conflict detection
- ✅ DELETE - Move posts to trash
- ✅ Frontmatter parsing (YAML, arrays, dates)
- ✅ Method validation (405 errors)
- ✅ Security (GitHub token, input sanitization)
- ✅ Error handling (401, 404, 409, 500)

#### Trash API (`tests/unit/backend/trash.test.js`) - 39 tests
- ✅ List trashed items with timestamps
- ✅ Auto-detect item type (post/page) from filename
- ✅ Restore to original location
- ✅ Permanent delete
- ✅ Empty trash (delete all)
- ✅ Error handling and validation

#### Settings API (`tests/unit/backend/settings.test.js`) - 27 tests
- ✅ GET - Retrieve _config.yml settings
- ✅ PUT - Update settings with whitelist validation
- ✅ Security whitelist prevents dangerous updates
- ✅ Blocks updates to excluded fields
- ✅ SHA conflict detection
- ✅ YAML parsing and generation

#### Taxonomy API (`tests/unit/backend/taxonomy.test.js`) - 28 tests
- ✅ GET - Retrieve categories and tags
- ✅ PUT - Update categories with validation
- ✅ PUT - Update tags with validation
- ✅ YAML parsing (object and string formats)
- ✅ Array validation (rejects non-arrays)
- ✅ Sync status tracking

#### Deployment Status (`tests/unit/backend/deployment-status.test.js`) - 24 tests
- ✅ GET - Latest deployment status
- ✅ GitHub Actions workflow integration
- ✅ Status mapping (in_progress, success, failure)
- ✅ Commit SHA filtering
- ✅ Workflow name filtering
- ✅ Error handling

#### Deployment History (`tests/unit/backend/deployment-history.test.js`) - 19 tests
- ✅ GET - Last 20 deployments
- ✅ Duration calculation
- ✅ Status mapping
- ✅ Chronological ordering
- ✅ Pagination support

#### Media API (`tests/unit/backend/media.test.js`) - 21 tests
- ✅ GET - Cloudinary media library
- ✅ Basic Auth with API key and secret
- ✅ Read-only access
- ✅ Resources array and total count
- ✅ Error handling (401, malformed JSON, network)
- ✅ Security (no secret exposure in responses)

### Frontend Tests (58+ tests)

#### Posts Module (`tests/unit/frontend/posts.test.js`) - 58 tests

**Utility Functions:**
- ✅ formatDate, formatDateForFilename, parseDate
- ✅ generatePostFilename, isValidPostFilename, extractDateFromFilename
- ✅ cleanTitle, buildPostPath, parsePostFilename

**CRUD Operations:**
- ✅ fetchPosts, fetchPost, createPost, updatePost, deletePost
- ✅ Error handling for each operation

**Caching:**
- ✅ Smart cache invalidation
- ✅ Force refresh support

**Taxonomy Integration:**
- ✅ Category and tag select population
- ✅ Sync status tracking

**EasyMDE Editor:**
- ✅ Initialization
- ✅ Cleanup and destroy

**Search and Filtering:**
- ✅ Debounced search
- ✅ Filter by category/tag/date

#### Notifications Module (`tests/unit/frontend/notifications.test.js`)
- ✅ showSuccess, showError, hideMessages
- ✅ Auto-initialization
- ✅ Auto-dismiss timers
- ✅ XSS prevention

### Integration Tests

#### Module Loading (`tests/integration/module-loading.test.js`)
- ✅ All modules export required functions
- ✅ Deprecated functions removed from taxonomy
- ✅ Protected field handling in pages module
- ✅ Notifications auto-initialization
- ✅ Settings delayed loading support

### E2E Tests (110+ tests)

#### Jekyll Site (`tests/e2e/jekyll-site.spec.js`) - 45 tests

**Mobile Navigation (6 tests):**
- ✅ Drawer opens/closes
- ✅ Overlay click closes drawer
- ✅ Escape key closes drawer
- ✅ Accordion menus toggle
- ✅ Resize to desktop closes drawer

**Desktop Navigation (2 tests):**
- ✅ Hover dropdowns
- ✅ Click outside closes dropdown

**Lazy Loading (2 tests):**
- ✅ Cards have lazy class
- ✅ Cards load on scroll

**Back to Top Button (3 tests):**
- ✅ Appears after scrolling 300px
- ✅ Scrolls to top on click
- ✅ Hides when at top

**Code Copy Buttons (3 tests):**
- ✅ Copy buttons present
- ✅ Copies to clipboard
- ✅ No double-wrapping

**Lightbox (5 tests):**
- ✅ Images have glightbox class
- ✅ Gallery images grouped
- ✅ Standalone images unique
- ✅ Opens on click
- ✅ Closes with button

**Image URL Fixes (2 tests):**
- ✅ WordPress image URLs rewritten
- ✅ WordPress link URLs rewritten

**Embedded Content (2 tests):**
- ✅ Sketchfab wrapped responsively
- ✅ Leaflet maps initialize

**Performance (3 tests):**
- ✅ No JavaScript errors
- ✅ All resources load
- ✅ Interactive within 5 seconds

#### Admin Interface (`tests/e2e/admin-comprehensive.spec.js`) - 65 tests

**Dashboard (3 tests):**
- ✅ Loads with quick actions
- ✅ Shows site information
- ✅ Quick action navigation

**Posts Management (7 tests):**
- ✅ Posts list loads
- ✅ New post form shows/hides
- ✅ Form validation
- ✅ Search filtering
- ✅ Category/tag selects populated
- ✅ EasyMDE editor initializes

**Pages Management (6 tests):**
- ✅ Pages list loads
- ✅ New page form
- ✅ Protected checkbox present
- ✅ Protected pages show lock icon
- ✅ Can toggle protected status
- ✅ Layout selector populated

**Taxonomy Management (6 tests):**
- ✅ Categories list loads
- ✅ Tags list loads
- ✅ Add category/tag forms
- ✅ Edit and delete buttons present

**Media Library (4 tests):**
- ✅ Media section loads
- ✅ Grid/list present
- ✅ Refresh button works
- ✅ Thumbnails and info shown

**Trash Management (4 tests):**
- ✅ Trash section loads
- ✅ Items show type
- ✅ Restore and delete buttons
- ✅ Empty trash button present

**Settings (6 tests):**
- ✅ Settings form loads
- ✅ Admin settings fields present
- ✅ Valid default values
- ✅ Save and reset buttons
- ✅ Site settings fields

**Deployment Status (3 tests):**
- ✅ Status widget visible
- ✅ Shows current state
- ✅ History link works

**Notifications (3 tests):**
- ✅ Elements exist
- ✅ Initially hidden
- ✅ Appear when triggered

**Navigation & UI (4 tests):**
- ✅ All tabs clickable
- ✅ One section visible at a time
- ✅ No accessibility violations
- ✅ Header and branding present
- ✅ Responsive on mobile

**Error Handling (2 tests):**
- ✅ Network errors handled
- ✅ Form validation works

## Configuration Files

### Vitest Configuration (`vitest.config.js`)

```javascript
{
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/utils/dom-helpers.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'admin-custom/js/**/*.js',
        'netlify/functions/**/*.js'
      ],
      exclude: [
        'node_modules',
        'tests',
        '**/*.test.js',
        '**/*.spec.js'
      ]
    }
  }
}
```

### Playwright Configuration (`playwright.config.js`)

```javascript
{
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:8888',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] }
  ],
  webServer: {
    command: 'netlify dev',
    url: 'http://localhost:8888',
    timeout: 120000
  }
}
```

## Writing Tests

### Unit Test Template

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Module Name', () => {
  beforeEach(() => {
    // Setup
    vi.clearAllMocks();
  });

  describe('Function Name', () => {
    it('does what it should', () => {
      // Arrange
      const input = 'test';

      // Act
      const result = functionName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('handles error case', () => {
      expect(() => functionName(null)).toThrow();
    });
  });
});
```

### E2E Test Template

```javascript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/path');
  });

  test('performs action', async ({ page }) => {
    await page.click('#button');
    await expect(page.locator('#result')).toBeVisible();
  });
});
```

## Continuous Integration

### GitHub Actions Workflow

E2E tests are configured to run in CI with:
- `forbidOnly: true` - Prevents `.only()` from blocking CI
- `retries: 2` - Auto-retry flaky tests
- `workers: 1` - Serial execution in CI
- GitHub reporter for integration

### Coverage Reporting

- HTML reports generated in `html/` directory
- Text summary in terminal
- LCOV format for external tools

## Test Maintenance

### When to Update Tests

1. **Backend API changes** - Update corresponding `tests/unit/backend/*.test.js`
2. **Frontend module changes** - Update `tests/unit/frontend/*.test.js`
3. **UI changes** - Update `tests/e2e/*.spec.js` selectors
4. **New features** - Add new test suites following existing patterns

### Debugging Failing Tests

```bash
# Run specific test file
npx vitest tests/unit/backend/posts.test.js

# Run with browser UI (E2E)
npm run test:e2e:ui

# Debug mode (step through)
npm run test:e2e:debug

# Verbose output
npx vitest --reporter=verbose
```

### Common Issues

**Issue**: E2E tests fail with "baseURL not responding"
**Solution**: Ensure `netlify dev` is running or let Playwright start it

**Issue**: Unit tests fail with "ReferenceError: window is not defined"
**Solution**: Ensure `environment: 'happy-dom'` in vitest.config.js

**Issue**: Mock not working
**Solution**: Call `vi.clearAllMocks()` in `beforeEach()`

## Best Practices

### Unit Tests

1. ✅ Test one thing per test
2. ✅ Use descriptive test names
3. ✅ Arrange-Act-Assert pattern
4. ✅ Mock external dependencies
5. ✅ Test both success and error cases
6. ✅ Use `beforeEach` for common setup

### E2E Tests

1. ✅ Use semantic selectors (IDs, data attributes)
2. ✅ Wait for elements before interacting
3. ✅ Test complete user workflows
4. ✅ Keep tests independent
5. ✅ Use page object patterns for complex pages
6. ✅ Test across viewports (mobile/desktop)

### Performance

1. ✅ Run unit tests in parallel
2. ✅ Use `test.concurrent` for independent E2E tests
3. ✅ Mock API calls in unit tests
4. ✅ Use fixtures for repeated E2E setup
5. ✅ Keep test data minimal

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Happy-DOM](https://github.com/capricorn86/happy-dom)
- [Testing Library Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Test Coverage Summary

| Layer | Test Files | Tests | Coverage Areas |
|-------|-----------|-------|----------------|
| **Backend Unit** | 8 files | 200+ tests | All Netlify functions, CRUD operations, security, error handling |
| **Frontend Unit** | 2 files | 60+ tests | Posts module, notifications, utilities |
| **Integration** | 1 file | ~10 tests | Module loading, initialization |
| **E2E Jekyll** | 1 file | 45 tests | Navigation, lazy loading, lightbox, code copy, embeds |
| **E2E Admin** | 2 files | 70+ tests | Complete admin workflows, all sections, error handling |
| **TOTAL** | 14 files | **729+ tests** | End-to-end coverage of entire application |

---

**Last Updated**: October 2025
**Framework Versions**: Vitest 1.0.4, Playwright 1.40.0
