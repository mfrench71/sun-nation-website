/**
 * E2E Tests for Jekyll Site Frontend
 *
 * Tests user-facing functionality including:
 * - Navigation (mobile menu, desktop dropdowns)
 * - Lazy loading post cards
 * - Lightbox functionality
 * - Code copy buttons
 * - Back to top button
 * - Embedded content
 *
 * @requires Playwright
 */

import { test, expect } from '@playwright/test';

test.describe('Jekyll Site - Mobile Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 375, height: 667 }); // Mobile viewport
  });

  test('mobile menu toggle opens drawer', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    const drawer = page.locator('.mobile-drawer');
    const overlay = page.locator('.mobile-drawer-overlay');

    // Initially closed
    await expect(drawer).not.toHaveClass(/active/);

    // Click toggle to open
    await toggle.click();

    // Should be open
    await expect(toggle).toHaveClass(/active/);
    await expect(drawer).toHaveClass(/active/);
    await expect(overlay).toHaveClass(/active/);

    // Body should have overflow hidden
    const bodyOverflow = await page.evaluate(() => document.body.style.overflow);
    expect(bodyOverflow).toBe('hidden');
  });

  test('mobile menu close button closes drawer', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    const drawer = page.locator('.mobile-drawer');
    const closeBtn = page.locator('.mobile-drawer-close');

    // Open drawer
    await toggle.click();
    await expect(drawer).toHaveClass(/active/);

    // Close with button
    await closeBtn.click();

    // Should be closed
    await expect(drawer).not.toHaveClass(/active/);
    await expect(toggle).not.toHaveClass(/active/);
  });

  test('clicking overlay closes mobile drawer', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    const drawer = page.locator('.mobile-drawer');
    const overlay = page.locator('.mobile-drawer-overlay');

    // Open drawer
    await toggle.click();
    await expect(drawer).toHaveClass(/active/);

    // Click overlay
    await overlay.click({ position: { x: 10, y: 10 } });

    // Should be closed
    await expect(drawer).not.toHaveClass(/active/);
  });

  test('escape key closes mobile drawer', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    const drawer = page.locator('.mobile-drawer');

    // Open drawer
    await toggle.click();
    await expect(drawer).toHaveClass(/active/);

    // Press Escape
    await page.keyboard.press('Escape');

    // Should be closed
    await expect(drawer).not.toHaveClass(/active/);
  });

  test('mobile accordion menus toggle correctly', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    await toggle.click();

    const accordions = page.locator('.mobile-accordion-toggle');
    const firstAccordion = accordions.first();

    // Initially not active
    await expect(firstAccordion).not.toHaveClass(/active/);

    // Click to open
    await firstAccordion.click();
    await expect(firstAccordion).toHaveClass(/active/);

    // Content should be visible
    const content = page.locator('.mobile-accordion-toggle.active + *');
    await expect(content.first()).toHaveClass(/active/);

    // Click again to close
    await firstAccordion.click();
    await expect(firstAccordion).not.toHaveClass(/active/);
  });

  test('resizing to desktop closes mobile menu', async ({ page }) => {
    const toggle = page.locator('.mobile-menu-toggle');
    const drawer = page.locator('.mobile-drawer');

    // Open mobile menu
    await toggle.click();
    await expect(drawer).toHaveClass(/active/);

    // Resize to desktop
    await page.setViewportSize({ width: 1200, height: 800 });

    // Wait for resize handler (250ms debounce)
    await page.waitForTimeout(300);

    // Menu should be closed
    await expect(drawer).not.toHaveClass(/active/);
  });
});

test.describe('Jekyll Site - Desktop Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.setViewportSize({ width: 1200, height: 800 }); // Desktop viewport
  });

  test('desktop dropdowns work on hover', async ({ page }) => {
    const dropdown = page.locator('.has-dropdown').first();

    // Should not be visible initially
    const dropdownMenu = dropdown.locator('.dropdown-menu');
    await expect(dropdownMenu).not.toBeVisible();

    // Hover to show
    await dropdown.hover();

    // Dropdown should be visible (CSS :hover)
    await expect(dropdownMenu).toBeVisible();
  });

  test('clicking outside dropdown closes it', async ({ page }) => {
    // This test is for touch devices
    // Simulate touch by checking if dropdown has active class after click
    const dropdown = page.locator('.has-dropdown').first();
    const link = dropdown.locator('.nav-link');

    // Click the link
    await link.click();

    // Click outside
    await page.click('body', { position: { x: 10, y: 10 } });

    // Active class should be removed
    await expect(dropdown).not.toHaveClass(/active/);
  });
});

test.describe('Jekyll Site - Lazy Loading', () => {
  test.beforeEach(async ({ page }) => {
    // Go to a page with post cards (like the blog index)
    await page.goto('/blog/');
  });

  test('post cards have lazy loading class', async ({ page }) => {
    const cards = page.locator('.post-card');
    const firstCard = cards.first();

    // Should have either lazy-card or lazy-card-loaded class
    const hasLazyClass = await firstCard.evaluate(el =>
      el.classList.contains('lazy-card') || el.classList.contains('lazy-card-loaded')
    );

    expect(hasLazyClass).toBe(true);
  });

  test('cards load when scrolled into view', async ({ page }) => {
    const cards = page.locator('.post-card');
    const count = await cards.count();

    if (count > 5) {
      // Scroll down to trigger lazy loading
      await page.evaluate(() => window.scrollBy(0, 1000));

      // Wait for intersection observer
      await page.waitForTimeout(500);

      // Some cards should have loaded class
      const loadedCards = page.locator('.post-card.lazy-card-loaded');
      await expect(loadedCards.first()).toBeVisible();
    }
  });
});

test.describe('Jekyll Site - Back to Top Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('back to top button appears after scrolling', async ({ page }) => {
    const backToTop = page.locator('#back-to-top');

    // Should not be visible initially
    await expect(backToTop).not.toHaveClass(/visible/);

    // Scroll down more than 300px
    await page.evaluate(() => window.scrollBy(0, 400));

    // Wait a bit for scroll handler
    await page.waitForTimeout(100);

    // Should be visible now
    await expect(backToTop).toHaveClass(/visible/);
  });

  test('back to top button scrolls to top when clicked', async ({ page }) => {
    const backToTop = page.locator('#back-to-top');

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 500));
    await page.waitForTimeout(100);

    // Button should be visible
    await expect(backToTop).toHaveClass(/visible/);

    // Click button
    await backToTop.click();

    // Wait for smooth scroll
    await page.waitForTimeout(500);

    // Should be at top
    const scrollY = await page.evaluate(() => window.pageYOffset);
    expect(scrollY).toBeLessThan(50);
  });

  test('back to top button hides when at top', async ({ page }) => {
    const backToTop = page.locator('#back-to-top');

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 400));
    await page.waitForTimeout(100);
    await expect(backToTop).toHaveClass(/visible/);

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(100);

    // Should not be visible
    await expect(backToTop).not.toHaveClass(/visible/);
  });
});

test.describe('Jekyll Site - Code Copy Buttons', () => {
  test('code blocks have copy buttons', async ({ page }) => {
    // Navigate to a post with code blocks
    await page.goto('/');

    // Find code blocks
    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();

    if (count > 0) {
      // Each code block should be wrapped with a copy button
      const wrapper = page.locator('.code-block-wrapper').first();
      await expect(wrapper).toBeVisible();

      const copyButton = wrapper.locator('.copy-code-button');
      await expect(copyButton).toBeVisible();
      await expect(copyButton).toHaveText('Copy');
    }
  });

  test('copy button copies code to clipboard', async ({ page, context }) => {
    // Grant clipboard permissions
    await context.grantPermissions(['clipboard-write', 'clipboard-read']);

    await page.goto('/');

    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();

    if (count > 0) {
      const firstCodeBlock = codeBlocks.first();
      const codeText = await firstCodeBlock.textContent();

      // Find the copy button for this code block
      const wrapper = firstCodeBlock.locator('..').locator('..');
      const copyButton = wrapper.locator('.copy-code-button');

      // Click copy button
      await copyButton.click();

      // Button should show "Copied!"
      await expect(copyButton).toHaveText('Copied!');
      await expect(copyButton).toHaveClass(/copied/);

      // Verify clipboard content
      const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
      expect(clipboardText).toBe(codeText);

      // Wait for reset (2 seconds)
      await page.waitForTimeout(2100);

      // Button should reset to "Copy"
      await expect(copyButton).toHaveText('Copy');
      await expect(copyButton).not.toHaveClass(/copied/);
    }
  });

  test('code blocks are not double-wrapped', async ({ page }) => {
    await page.goto('/');

    const codeBlocks = page.locator('pre code');
    const count = await codeBlocks.count();

    if (count > 0) {
      // Check that wrapper doesn't contain another wrapper
      const nestedWrappers = page.locator('.code-block-wrapper .code-block-wrapper');
      await expect(nestedWrappers).toHaveCount(0);
    }
  });
});

test.describe('Jekyll Site - Lightbox', () => {
  test('image links have glightbox class', async ({ page }) => {
    await page.goto('/');

    const imageLinks = page.locator('figure a');
    const count = await imageLinks.count();

    if (count > 0) {
      const firstLink = imageLinks.first();
      const hasImg = await firstLink.locator('img').count();

      if (hasImg > 0) {
        await expect(firstLink).toHaveClass(/glightbox/);
        await expect(firstLink).toHaveAttribute('data-type', 'image');
      }
    }
  });

  test('gallery images are grouped', async ({ page }) => {
    await page.goto('/');

    const galleries = page.locator('.gallery, .wp-block-gallery');
    const count = await galleries.count();

    if (count > 0) {
      const firstGallery = galleries.first();
      const galleryLinks = firstGallery.locator('figure a img').locator('..');

      const linkCount = await galleryLinks.count();
      if (linkCount > 0) {
        // All links in gallery should have same data-gallery attribute
        const firstGalleryAttr = await galleryLinks.first().getAttribute('data-gallery');
        expect(firstGalleryAttr).toMatch(/^gallery-\d+$/);

        // If there are multiple images, they should share the gallery
        if (linkCount > 1) {
          const secondGalleryAttr = await galleryLinks.nth(1).getAttribute('data-gallery');
          expect(secondGalleryAttr).toBe(firstGalleryAttr);
        }
      }
    }
  });

  test('standalone images get unique galleries', async ({ page }) => {
    await page.goto('/');

    const standaloneLinks = page.locator('figure:not(.gallery figure):not(.wp-block-gallery figure) a');
    const count = await standaloneLinks.count();

    if (count > 1) {
      // Each standalone image should have different gallery attribute
      const firstGallery = await standaloneLinks.first().getAttribute('data-gallery');
      const secondGallery = await standaloneLinks.nth(1).getAttribute('data-gallery');

      expect(firstGallery).toMatch(/^standalone-\d+$/);
      expect(secondGallery).toMatch(/^standalone-\d+$/);
      expect(firstGallery).not.toBe(secondGallery);
    }
  });

  test('lightbox opens when clicking image', async ({ page }) => {
    await page.goto('/');

    const imageLinks = page.locator('figure a.glightbox');
    const count = await imageLinks.count();

    if (count > 0) {
      // Click first image
      await imageLinks.first().click();

      // Lightbox should open
      await expect(page.locator('.glightbox-container')).toBeVisible();
      await expect(page.locator('body')).toHaveClass(/glightbox-open/);
    }
  });

  test('lightbox can be closed with close button', async ({ page }) => {
    await page.goto('/');

    const imageLinks = page.locator('figure a.glightbox');
    const count = await imageLinks.count();

    if (count > 0) {
      // Open lightbox
      await imageLinks.first().click();
      await expect(page.locator('.glightbox-container')).toBeVisible();

      // Close lightbox
      const closeButton = page.locator('.gclose');
      await closeButton.click();

      // Lightbox should be closed
      await expect(page.locator('.glightbox-container')).not.toBeVisible();
      await expect(page.locator('body')).not.toHaveClass(/glightbox-open/);
    }
  });
});

test.describe('Jekyll Site - Image URL Fixes', () => {
  test('WordPress image URLs are rewritten', async ({ page }) => {
    await page.goto('/');

    // Check if any images have /wp-content in src
    const wpImages = page.locator('img[src*="/wp-content"]');
    const count = await wpImages.count();

    if (count > 0) {
      // All should point to circleseven.co.uk
      for (let i = 0; i < count; i++) {
        const src = await wpImages.nth(i).getAttribute('src');
        expect(src).toContain('circleseven.co.uk/wp-content');
        expect(src).toMatch(/^https?:\/\//);
      }
    }
  });

  test('WordPress link URLs are rewritten', async ({ page }) => {
    await page.goto('/');

    const wpLinks = page.locator('a[href*="/wp-content"]');
    const count = await wpLinks.count();

    if (count > 0) {
      for (let i = 0; i < count; i++) {
        const href = await wpLinks.nth(i).getAttribute('href');
        expect(href).toContain('circleseven.co.uk/wp-content');
        expect(href).toMatch(/^https?:\/\//);
      }
    }
  });
});

test.describe('Jekyll Site - Embedded Content', () => {
  test('Sketchfab embeds are wrapped responsively', async ({ page }) => {
    await page.goto('/');

    const sketchfabIframes = page.locator('iframe[src*="sketchfab.com"]');
    const count = await sketchfabIframes.count();

    if (count > 0) {
      // Each iframe should be wrapped
      const wrapper = sketchfabIframes.first().locator('..');
      await expect(wrapper).toHaveClass(/sketchfab-embed/);

      // Iframe should not have width/height attributes
      const hasWidth = await sketchfabIframes.first().getAttribute('width');
      const hasHeight = await sketchfabIframes.first().getAttribute('height');
      expect(hasWidth).toBeNull();
      expect(hasHeight).toBeNull();
    }
  });

  test('Leaflet maps initialize correctly', async ({ page }) => {
    await page.goto('/');

    const leafletMaps = page.locator('.leaflet-map');
    const count = await leafletMaps.count();

    if (count > 0) {
      // Map should have been initialized
      const firstMap = leafletMaps.first();

      // Leaflet adds 'leaflet-container' class when initialized
      await expect(firstMap).toHaveClass(/leaflet-container/);

      // Should have data attributes
      const hasLat = await firstMap.getAttribute('data-lat');
      const hasLng = await firstMap.getAttribute('data-lng');
      const hasZoom = await firstMap.getAttribute('data-zoom');

      expect(hasLat).not.toBeNull();
      expect(hasLng).not.toBeNull();
      expect(hasZoom).not.toBeNull();
    }
  });
});

test.describe('Jekyll Site - Page Load Performance', () => {
  test('page loads without JavaScript errors', async ({ page }) => {
    const errors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no console errors
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('all critical CSS and JS resources load', async ({ page }) => {
    const failedResources = [];

    page.on('requestfailed', request => {
      failedResources.push(request.url());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Should have no failed resources (except maybe optional ones)
    const criticalFailures = failedResources.filter(url =>
      url.endsWith('.css') || url.endsWith('.js')
    );
    expect(criticalFailures).toHaveLength(0);
  });

  test('page is interactive within reasonable time', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const loadTime = Date.now() - startTime;

    // Page should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });
});
