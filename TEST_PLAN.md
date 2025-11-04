# Testing Plan for Circle Seven Admin

## Overview

Recent issues with ES6 module timing, ID mismatches, and runtime errors have highlighted the need for comprehensive testing. This document outlines a testing strategy for both frontend and backend components.

## Issues That Would Have Been Caught By Tests

1. **Module Import Errors** - Missing exports (`addCategory`, `addTag`)
2. **Timing Issues** - ES6 module loading race conditions
3. **ID Mismatches** - HTML element IDs not matching JavaScript selectors
4. **Notification Initialization** - Functions called before DOM elements ready
5. **Settings Prepopulation** - Form fields not being populated

## Testing Strategy

### 1. Frontend Unit Tests

Test individual modules and functions in isolation.

**Framework:** Vitest or Jest with jsdom

**Files to Test:**

#### `admin-custom/js/ui/notifications.js`
```javascript
describe('Notifications Module', () => {
  test('showError displays error message', () => {
    document.body.innerHTML = '<div id="error" class="hidden"><p></p></div>';
    showError('Test error');
    expect(document.getElementById('error').classList.contains('hidden')).toBe(false);
  });

  test('showSuccess auto-initializes if not ready', () => {
    document.body.innerHTML = '<div id="success" class="hidden"><p></p></div>';
    showSuccess('Test success');
    expect(document.getElementById('success').classList.contains('hidden')).toBe(false);
  });

  test('notifications auto-dismiss after 5 seconds', (done) => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="error" class="hidden"><p></p></div>';
    showError('Test');
    jest.advanceTimersByTime(5000);
    expect(document.getElementById('error').classList.contains('hidden')).toBe(true);
    done();
  });
});
```

#### `admin-custom/js/modules/settings.js`
```javascript
describe('Settings Module', () => {
  test('loadAdminSettings populates form fields with correct IDs', () => {
    document.body.innerHTML = `
      <input id="admin-setting-deployment-poll-interval" />
      <input id="admin-setting-deployment-history-poll-interval" />
      <input id="admin-setting-deployment-timeout" />
      <input id="admin-setting-fetch-timeout" />
      <input id="admin-setting-debounce-delay" />
    `;

    localStorage.setItem('admin_settings', JSON.stringify({
      deployment_poll_interval: 10000,
      deployment_history_poll_interval: 30000,
      deployment_timeout: 600,
      fetch_timeout: 30000,
      debounce_delay: 300
    }));

    loadAdminSettings();

    expect(document.getElementById('admin-setting-deployment-poll-interval').value).toBe('10000');
    expect(document.getElementById('admin-setting-deployment-history-poll-interval').value).toBe('30000');
  });

  test('saveAdminSettings stores values in localStorage', () => {
    const form = document.createElement('form');
    form.id = 'admin-settings-form';
    form.innerHTML = `
      <input name="deployment_poll_interval" value="15000" />
      <button type="submit" id="admin-settings-save-btn">Save</button>
    `;
    document.body.appendChild(form);

    const event = new Event('submit');
    saveAdminSettings(event);

    const stored = JSON.parse(localStorage.getItem('admin_settings'));
    expect(stored.deployment_poll_interval).toBe(15000);
  });
});
```

#### `admin-custom/js/modules/taxonomy.js`
```javascript
describe('Taxonomy Module', () => {
  test('exports all required functions', () => {
    expect(typeof loadTaxonomy).toBe('function');
    expect(typeof renderCategories).toBe('function');
    expect(typeof renderTags).toBe('function');
    expect(typeof showAddCategoryModal).toBe('function');
    expect(typeof showAddTagModal).toBe('function');
    expect(typeof editCategory).toBe('function');
    expect(typeof deleteCategory).toBe('function');
    expect(typeof editTag).toBe('function');
    expect(typeof deleteTag).toBe('function');
    // Ensure deprecated functions are NOT exported
    expect(typeof addCategory).toBe('undefined');
    expect(typeof addTag).toBe('undefined');
  });
});
```

### 2. Frontend Integration Tests

Test module interactions and DOM manipulation.

**Framework:** Playwright or Cypress

```javascript
describe('Admin Settings Page', () => {
  beforeEach(() => {
    cy.visit('/admin-custom/');
    cy.get('#nav-settings').click();
  });

  it('loads and displays admin settings correctly', () => {
    cy.get('#admin-setting-deployment-poll-interval').should('have.value', '10000');
    cy.get('#admin-setting-deployment-history-poll-interval').should('have.value', '30000');
    cy.get('#admin-setting-deployment-timeout').should('have.value', '600');
    cy.get('#admin-setting-fetch-timeout').should('have.value', '30000');
    cy.get('#admin-setting-debounce-delay').should('have.value', '300');
  });

  it('saves admin settings to localStorage', () => {
    cy.get('#admin-setting-deployment-poll-interval').clear().type('15000');
    cy.get('#admin-settings-save-btn').click();
    cy.get('#success').should('not.have.class', 'hidden');
    cy.window().then((win) => {
      const settings = JSON.parse(win.localStorage.getItem('admin_settings'));
      expect(settings.deployment_poll_interval).to.equal(15000);
    });
  });

  it('loads site settings from backend', () => {
    cy.get('#setting-title').should('not.be.empty');
    cy.get('#setting-author').should('not.be.empty');
    cy.get('#setting-email').should('not.be.empty');
  });
});

describe('Module Loading', () => {
  it('does not throw module import errors', () => {
    cy.visit('/admin-custom/', {
      onBeforeLoad(win) {
        cy.spy(win.console, 'error').as('consoleError');
      }
    });

    cy.get('@consoleError').should('not.be.called');
  });

  it('handles ES6 module timing correctly', () => {
    cy.visit('/admin-custom/');
    cy.get('#nav-settings').click();

    // Should not have timing errors
    cy.get('#error').should('have.class', 'hidden');

    // Settings should load
    cy.get('#admin-setting-deployment-poll-interval', { timeout: 1000 })
      .should('have.value');
  });
});

describe('Taxonomy Management', () => {
  beforeEach(() => {
    cy.visit('/admin-custom/');
    cy.get('#nav-taxonomy').click();
  });

  it('displays categories and tags', () => {
    cy.get('#categories-list').should('exist');
    cy.get('#tags-list').should('exist');
  });

  it('switches between category and tag tabs', () => {
    cy.get('#tab-tags').click();
    cy.get('#taxonomy-tags-tab').should('not.have.class', 'hidden');
    cy.get('#taxonomy-categories-tab').should('have.class', 'hidden');
  });
});
```

### 3. Backend Unit Tests

Test serverless functions in isolation.

**Framework:** Vitest or Jest

#### `netlify/functions/settings.js`
```javascript
describe('Settings Function', () => {
  test('GET returns _config.yml settings', async () => {
    const event = { httpMethod: 'GET' };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('title');
    expect(body).toHaveProperty('author');
  });

  test('PUT validates whitelisted fields only', async () => {
    const event = {
      httpMethod: 'PUT',
      body: JSON.stringify({
        title: 'New Title',
        malicious_field: 'hacker'
      })
    };
    const response = await handler(event);

    expect(response.statusCode).toBe(200);
    // Verify malicious_field was not written
  });
});
```

#### `netlify/functions/pages.js`
```javascript
describe('Pages Function - parseFrontmatter', () => {
  test('parses boolean values correctly', () => {
    const content = `---
title: Test Page
protected: true
---
Content here`;

    const result = parseFrontmatter(content);
    expect(result.frontmatter.protected).toBe(true);
    expect(typeof result.frontmatter.protected).toBe('boolean');
  });

  test('converts string "true" to boolean', () => {
    const result = parseFrontmatter('---\nprotected: "true"\n---\nContent');
    expect(result.frontmatter.protected).toBe(true);
  });

  test('converts string "false" to boolean', () => {
    const result = parseFrontmatter('---\nprotected: "false"\n---\nContent');
    expect(result.frontmatter.protected).toBe(false);
  });
});

describe('Pages Function - buildFrontmatter', () => {
  test('outputs booleans without quotes', () => {
    const frontmatter = { title: 'Test', protected: true };
    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('protected: true');
    expect(yaml).not.toContain('protected: "true"');
  });
});
```

### 4. End-to-End Tests

Test complete user workflows.

```javascript
describe('Complete Admin Workflow', () => {
  it('can create, edit, and delete a post', () => {
    cy.login(); // Custom command for Netlify Identity login

    cy.visit('/admin-custom/');
    cy.get('#nav-posts').click();

    // Create new post
    cy.contains('Add Post').click();
    cy.get('#post-title').type('Test Post Title');
    cy.get('#post-content').type('# Test Content');
    cy.contains('Save Post').click();

    cy.get('#success').should('contain', 'saved successfully');

    // Edit post
    cy.contains('Test Post Title').parent().find('[title*="Edit"]').click();
    cy.get('#post-title').clear().type('Updated Title');
    cy.contains('Save Post').click();

    cy.get('#success').should('contain', 'saved successfully');

    // Delete post
    cy.contains('Delete Post').click();
    cy.get('#confirm-button').click();

    cy.get('#success').should('contain', 'moved to bin');
  });

  it('handles protected pages correctly', () => {
    cy.login();

    cy.visit('/admin-custom/');
    cy.get('#nav-pages').click();

    // Find a protected page
    cy.get('.fa-lock').first().parents('tr').within(() => {
      // Should NOT have delete button
      cy.get('[title*="Delete"]').should('not.exist');

      // Click edit
      cy.get('[title*="Edit"]').click();
    });

    // Protected checkbox should be checked
    cy.get('#page-protected').should('be.checked');

    // Delete button should be hidden or disabled
    cy.get('#delete-page-btn').should('be.disabled');
  });
});
```

### 5. Manual Smoke Test Checklist

Use this checklist before deploying:

#### Admin Interface Load
- [ ] Page loads without console errors
- [ ] All ES6 modules load successfully
- [ ] No "module does not provide export" errors
- [ ] No "function is not defined" errors

#### Section Navigation
- [ ] Dashboard loads and displays correctly
- [ ] Taxonomy section loads and displays categories/tags
- [ ] Posts section loads and displays posts list
- [ ] Pages section loads and displays pages list
- [ ] Media section loads and displays media grid
- [ ] Bin section loads and displays deleted items
- [ ] Settings section loads and displays forms

#### Settings Prepopulation
- [ ] Admin Settings: Deployment Status Check has value
- [ ] Admin Settings: Deployment History Refresh has value
- [ ] Admin Settings: Deployment Timeout has value
- [ ] Admin Settings: API Request Timeout has value
- [ ] Admin Settings: Search Input Delay has value
- [ ] Site Settings: All fields populated from _config.yml

#### Notifications
- [ ] Error notifications display correctly
- [ ] Success notifications display correctly
- [ ] Notifications auto-dismiss after 5 seconds
- [ ] Multiple notifications can be shown

#### Taxonomy
- [ ] Can switch between Categories and Tags tabs
- [ ] Can add new category
- [ ] Can edit existing category
- [ ] Can delete category
- [ ] Can add new tag
- [ ] Can edit existing tag
- [ ] Can delete tag
- [ ] Drag-and-drop reordering works

#### Posts
- [ ] Posts list displays correctly
- [ ] Search functionality works
- [ ] Sort dropdown works
- [ ] Can create new post
- [ ] Can edit existing post
- [ ] Can delete post
- [ ] Category hierarchy toggle works
- [ ] Featured image upload works
- [ ] Markdown editor initializes

#### Pages
- [ ] Pages list displays correctly
- [ ] Search functionality works
- [ ] Protected pages show lock icon
- [ ] Protected pages cannot be deleted from list
- [ ] Can create new page
- [ ] Can edit existing page
- [ ] Can toggle protected status
- [ ] Delete button disabled when protected checkbox is checked

#### Deployments
- [ ] Deployment banner shows when changes are saved
- [ ] Deployment status updates correctly
- [ ] Timer counts up during deployment
- [ ] Success message shows when deployment completes
- [ ] Banner dismisses after completion

## Test Setup

### Installation

```bash
# Install testing dependencies
npm install --save-dev vitest jsdom @vitest/ui
npm install --save-dev @playwright/test
# OR
npm install --save-dev cypress

# Install for backend testing
npm install --save-dev node-fetch
```

### Configuration

**vitest.config.js** (for unit tests)
```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.js'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.config.js'
      ]
    }
  }
});
```

**playwright.config.js** (for E2E tests)
```javascript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:8888', // Netlify dev server
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'netlify dev',
    port: 8888,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Running Tests

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# All tests
npm test

# With coverage
npm run test:coverage
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "npm run test:unit && npm run test:integration && npm run test:e2e",
    "test:unit": "vitest run",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

## Continuous Integration

### GitHub Actions Workflow

**.github/workflows/test.yml**
```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm run test:unit

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

## Priority

### High Priority (Implement First)
1. ✅ Manual smoke test checklist (use immediately)
2. Backend unit tests for serverless functions
3. Frontend unit tests for settings module
4. Module import/export validation tests

### Medium Priority
1. Integration tests for section navigation
2. Notification system tests
3. Form validation tests

### Low Priority (Nice to Have)
1. Full E2E workflow tests
2. Visual regression tests
3. Performance tests
4. Accessibility tests

## Benefits

1. **Catch Errors Early** - Find bugs before they reach production
2. **Prevent Regressions** - Ensure fixes don't break existing functionality
3. **Document Behavior** - Tests serve as living documentation
4. **Enable Refactoring** - Make changes confidently with test safety net
5. **Improve Code Quality** - Writing testable code leads to better architecture

## Next Steps

1. Start with the manual smoke test checklist
2. Add backend unit tests for critical functions
3. Add frontend tests for recently fixed issues
4. Set up CI/CD pipeline with automated testing
5. Gradually expand test coverage
