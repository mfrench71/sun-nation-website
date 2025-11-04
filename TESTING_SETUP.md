# Testing Setup Instructions

## Prerequisites

You need to fix an npm cache permission issue first:

```bash
sudo chown -R $(whoami) ~/.npm
```

## Installation

1. **Install Test Dependencies**

```bash
npm install
```

This will install:
- `vitest` - Fast unit test runner
- `@vitest/ui` - Web UI for Vitest
- `@vitest/coverage-v8` - Coverage reporting
- `happy-dom` - Fast DOM environment for testing
- `@playwright/test` - E2E browser testing

2. **Install Playwright Browsers**

```bash
npx playwright install chromium
```

Or install all browsers:

```bash
npx playwright install
```

## Running Tests

### Unit Tests

Run all unit tests:
```bash
npm run test:unit
```

Run tests in watch mode (auto-rerun on file changes):
```bash
npm run test:watch
```

Run tests with UI:
```bash
npm run test:ui
```

Then open http://localhost:51204/__vitest__/

### Integration Tests

```bash
npm run test:integration
```

### E2E Tests

**Important:** E2E tests require the dev server to be running.

Option 1 - Automatic (Playwright starts server):
```bash
npm run test:e2e
```

Option 2 - Manual (more control):
```bash
# Terminal 1
netlify dev

# Terminal 2 (after server starts)
npm run test:e2e
```

### All Tests

Run everything:
```bash
npm test
```

### Coverage Report

```bash
npm run test:coverage
```

Coverage report will be generated in `./coverage/` directory.
Open `./coverage/index.html` in your browser to view detailed report.

## Project Structure

```
tests/
├── setup.js                    # Global test setup
├── utils/
│   ├── dom-helpers.js          # DOM manipulation helpers
│   └── mock-data.js            # Mock data and utilities
├── unit/
│   ├── frontend/
│   │   ├── notifications.test.js
│   │   └── settings.test.js
│   └── backend/
│       └── pages.test.js
├── integration/
│   └── (integration tests here)
└── e2e/
    └── admin-smoke.spec.js
```

## Configuration Files

- `vitest.config.js` - Vitest configuration
- `playwright.config.js` - Playwright configuration
- `package.json` - Test scripts and dependencies

## Writing New Tests

### Unit Test Example

```javascript
// tests/unit/frontend/my-module.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { setupDocument } from '../../utils/dom-helpers.js';

describe('My Module', () => {
  beforeEach(() => {
    setupDocument();
  });

  it('does something', () => {
    expect(true).toBe(true);
  });
});
```

### E2E Test Example

```javascript
// tests/e2e/my-feature.spec.js
import { test, expect } from '@playwright/test';

test('feature works', async ({ page }) => {
  await page.goto('/admin-custom/');
  await expect(page.locator('#my-element')).toBeVisible();
});
```

## Continuous Integration

Tests run automatically on every push and pull request via GitHub Actions.

View test results at:
https://github.com/mfrench71/circleseven-website/actions

## Coverage Goals

Current targets (configured in vitest.config.js):
- Lines: 80%
- Functions: 80%
- Branches: 75%
- Statements: 80%

## Troubleshooting

### "Cannot find module" errors

Make sure you ran:
```bash
npm install
```

### Playwright browser not found

Install Playwright browsers:
```bash
npx playwright install
```

### E2E tests timeout

Make sure Netlify Dev is running and accessible at http://localhost:8888:
```bash
netlify dev
```

### npm permission errors

Fix npm cache permissions:
```bash
sudo chown -R $(whoami) ~/.npm
npm cache clean --force
```

### Tests pass locally but fail in CI

- Check that all dependencies are in `package.json`
- Verify tests don't depend on local environment
- Check GitHub Actions logs for specific errors

## Best Practices

1. **Write tests for bugs** - When you fix a bug, write a test that would have caught it
2. **Test user behavior** - Focus on testing what users do, not implementation details
3. **Keep tests fast** - Unit tests should run in milliseconds
4. **Mock external dependencies** - Don't make real API calls in unit tests
5. **Use descriptive test names** - Test names should explain what's being tested

## Next Steps

1. ✅ Run `npm install` to install dependencies
2. ✅ Run `npm run test:unit` to verify setup
3. ✅ Run `npm run test:ui` to see the interactive UI
4. ✅ Review TEST_PLAN.md for comprehensive testing strategy
5. ✅ Review SMOKE_TEST_GUIDE.md for manual testing checklist

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles/)
