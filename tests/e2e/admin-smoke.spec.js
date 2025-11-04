/**
 * E2E Smoke Test for Admin Interface
 *
 * Tests basic navigation and functionality for multi-page admin architecture.
 */

import { test, expect } from '@playwright/test';
import { mockPosts, mockPages, mockTaxonomy, mockDeploymentStatus, mockDeploymentHistory, mockRateLimit, mockTrashItems, mockSettings, mockMedia } from '../fixtures/mock-data.js';

// Helper to setup API mocks for all tests
async function setupApiMocks(page) {
  // Enable test mode (bypass authentication)
  await page.addInitScript(() => {
    localStorage.setItem('TEST_MODE', 'true');
  });

  // Mock Netlify Functions API endpoints
  await page.route('**/.netlify/functions/posts*', async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();

    if (method === 'GET') {
      if (url.searchParams.get('metadata') === 'true') {
        await route.fulfill({ status: 200, body: JSON.stringify({ posts: mockPosts }) });
      } else {
        await route.fulfill({ status: 200, body: JSON.stringify({ posts: mockPosts.map(p => ({ name: p.name, path: p.path, sha: p.sha, size: p.size })) }) });
      }
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  await page.route('**/.netlify/functions/pages*', async (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      await route.fulfill({ status: 200, body: JSON.stringify({ pages: mockPages }) });
    } else {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    }
  });

  await page.route('**/.netlify/functions/taxonomy*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockTaxonomy) });
  });

  await page.route('**/.netlify/functions/deployment-status*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockDeploymentStatus) });
  });

  await page.route('**/.netlify/functions/deployment-history*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ runs: mockDeploymentHistory }) });
  });

  await page.route('**/.netlify/functions/rate-limit*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockRateLimit) });
  });

  await page.route('**/.netlify/functions/trash*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ items: mockTrashItems }) });
  });

  await page.route('**/.netlify/functions/settings*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockSettings) });
  });

  await page.route('**/.netlify/functions/media*', async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify(mockMedia) });
  });
}

test.describe('Admin Interface Smoke Test - Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/');
  });

  test('loads without console errors', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.waitForLoadState('networkidle');

    // Should have no console errors
    expect(errors).toHaveLength(0);
  });

  test('dashboard loads with recent content', async ({ page }) => {
    await expect(page.locator('#section-dashboard')).toBeVisible();

    // Dashboard should have site information
    const siteInfo = page.locator('h3:has-text("Site Information")');
    await expect(siteInfo).toBeVisible();
  });

  test('sidebar navigation links are present', async ({ page }) => {
    // Check that sidebar has links to all sections
    await expect(page.locator('a[href="/admin/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/posts/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/pages/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/media/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/categories/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/tags/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/bin/"]')).toBeVisible();
    await expect(page.locator('a[href="/admin/settings/"]')).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/settings/');
  });

  test('settings page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-settings')).toBeVisible();
    await expect(page.locator('#settings-form')).toBeVisible();
  });

  test('settings fields are prepopulated', async ({ page }) => {
    // Wait for settings to load
    await page.waitForTimeout(500);

    // Check site settings fields have values
    const titleField = page.locator('#setting-title');
    await expect(titleField).toBeVisible();

    const titleValue = await titleField.inputValue();
    expect(titleValue).not.toBe('');
  });
});

test.describe('Admin Interface Smoke Test - Posts Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/posts/');
  });

  test('posts page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-posts')).toBeVisible();
    await expect(page.locator('#posts-table-body')).toBeVisible();
  });

  test('new post button is visible', async ({ page }) => {
    const newPostBtn = page.locator('button:has-text("New Post")');
    await expect(newPostBtn).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Pages Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/pages/');
  });

  test('pages page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-pages')).toBeVisible();
    await expect(page.locator('#pages-table-body')).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Media Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/media/');
  });

  test('media page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-media')).toBeVisible();
    await expect(page.locator('#media-grid')).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Categories Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/categories/');
  });

  test('categories page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-taxonomy')).toBeVisible();
    await expect(page.locator('#categories-list')).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Tags Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/tags/');
  });

  test('tags page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-taxonomy')).toBeVisible();
    await expect(page.locator('#tags-list')).toBeVisible();
  });
});

test.describe('Admin Interface Smoke Test - Bin Page', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/admin/bin/');
  });

  test('bin page loads correctly', async ({ page }) => {
    await expect(page.locator('#section-trash')).toBeVisible();

    // Either trash list or empty message should be visible
    const trashList = page.locator('#trash-list');
    const emptyMessage = page.locator('#trash-empty');
    const listVisible = await trashList.isVisible();
    const emptyVisible = await emptyMessage.isVisible();
    expect(listVisible || emptyVisible).toBe(true);
  });
});
