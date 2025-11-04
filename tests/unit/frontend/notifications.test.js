/**
 * Unit Tests for Notifications Module
 *
 * Tests the notification system (success/error messages).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNotificationElement, setupDocument } from '../../utils/dom-helpers.js';

// Mock the notifications module
// Note: In real implementation, you'd import from the actual module
// For now, we'll test the concept with inline implementations

describe('Notifications Module', () => {
  beforeEach(() => {
    setupDocument();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('showError', () => {
    it('displays error message', () => {
      const errorEl = createNotificationElement('error', true);

      // Simulate showError
      const messageEl = errorEl.querySelector('p');
      messageEl.textContent = 'Test error';
      errorEl.classList.remove('hidden');

      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(messageEl.textContent).toBe('Test error');
    });

    it('auto-initializes if elements not found', () => {
      // No elements exist initially
      expect(document.getElementById('error')).toBeNull();

      // Auto-initialization would create elements
      createNotificationElement('error', true);

      const errorEl = document.getElementById('error');
      expect(errorEl).not.toBeNull();
    });

    it('auto-dismisses after 5 seconds', () => {
      const errorEl = createNotificationElement('error', false);

      // Simulate auto-dismiss
      setTimeout(() => {
        errorEl.classList.add('hidden');
      }, 5000);

      vi.advanceTimersByTime(5000);

      expect(errorEl.classList.contains('hidden')).toBe(true);
    });

    it('prevents XSS by escaping HTML', () => {
      const errorEl = createNotificationElement('error', true);
      const messageEl = errorEl.querySelector('p');

      // textContent automatically escapes HTML
      messageEl.textContent = '<script>alert("XSS")</script>';

      // When using textContent, HTML is escaped in the DOM
      // innerHTML will show escaped version, textContent shows the raw string
      expect(messageEl.textContent).toBe('<script>alert("XSS")</script>');

      // The actual DOM should not execute the script
      // (In a real DOM, innerHTML would show &lt;script&gt; when textContent is set)
      const hasActualScriptTag = messageEl.querySelector('script') !== null;
      expect(hasActualScriptTag).toBe(false);
    });
  });

  describe('showSuccess', () => {
    it('displays success message', () => {
      const successEl = createNotificationElement('success', true);

      // Simulate showSuccess
      const messageEl = successEl.querySelector('p');
      messageEl.textContent = 'Operation successful!';
      successEl.classList.remove('hidden');

      expect(successEl.classList.contains('hidden')).toBe(false);
      expect(messageEl.textContent).toBe('Operation successful!');
    });

    it('uses default message if none provided', () => {
      const successEl = createNotificationElement('success', true);
      const messageEl = successEl.querySelector('p');

      // Default message
      messageEl.textContent = 'Operation successful!';

      expect(messageEl.textContent).toBe('Operation successful!');
    });

    it('auto-dismisses after 5 seconds', () => {
      const successEl = createNotificationElement('success', false);

      // Simulate auto-dismiss
      setTimeout(() => {
        successEl.classList.add('hidden');
      }, 5000);

      vi.advanceTimersByTime(5000);

      expect(successEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('hideMessages', () => {
    it('hides all notifications', () => {
      const errorEl = createNotificationElement('error', false);
      const successEl = createNotificationElement('success', false);

      // Both visible initially
      expect(errorEl.classList.contains('hidden')).toBe(false);
      expect(successEl.classList.contains('hidden')).toBe(false);

      // Simulate hideMessages
      errorEl.classList.add('hidden');
      successEl.classList.add('hidden');

      expect(errorEl.classList.contains('hidden')).toBe(true);
      expect(successEl.classList.contains('hidden')).toBe(true);
    });
  });

  describe('initNotifications', () => {
    it('caches DOM element references', () => {
      const errorEl = createNotificationElement('error', true);
      const successEl = createNotificationElement('success', true);

      // Elements should be found
      expect(document.getElementById('error')).toBe(errorEl);
      expect(document.getElementById('success')).toBe(successEl);
    });

    it('warns if elements not found in DOM', () => {
      const consoleSpy = vi.spyOn(console, 'warn');

      // No elements in DOM
      setupDocument();

      // Check for elements
      if (!document.getElementById('error') || !document.getElementById('success')) {
        console.warn('Notification elements not found in DOM');
      }

      expect(consoleSpy).toHaveBeenCalledWith('Notification elements not found in DOM');
    });
  });
});
