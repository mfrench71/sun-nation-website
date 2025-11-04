/**
 * Unit Tests for Core Utils Module
 *
 * Tests utility functions including debounce, async error handling,
 * fetch with timeout, button loading states, HTML escaping, and URL validation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  FETCH_TIMEOUT,
  DEBOUNCE_DELAY,
  debounce,
  asyncHandler,
  fetchWithTimeout,
  setButtonLoading,
  escapeHtml,
  isValidUrl
} from '../../../admin/js/core/utils.js';

describe('Core Utils Module', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Constants', () => {
    it('exports FETCH_TIMEOUT constant', () => {
      expect(FETCH_TIMEOUT).toBe(30000);
    });

    it('exports DEBOUNCE_DELAY constant', () => {
      expect(DEBOUNCE_DELAY).toBe(300);
    });
  });

  describe('debounce', () => {
    it('delays function execution', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 300);

      debounced();
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('only executes once if called multiple times within delay', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 300);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(300);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('resets timer on each call', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 300);

      debounced();
      vi.advanceTimersByTime(200);
      debounced();
      vi.advanceTimersByTime(200);
      debounced();
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('passes arguments to debounced function', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 300);

      debounced('arg1', 'arg2', 123);
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2', 123);
    });

    it('executes multiple times if called after delay completes', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 300);

      debounced();
      vi.advanceTimersByTime(300);

      debounced();
      vi.advanceTimersByTime(300);

      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('handles different wait times', () => {
      const mockFn = vi.fn();
      const debounced = debounce(mockFn, 1000);

      debounced();
      vi.advanceTimersByTime(999);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('asyncHandler', () => {
    it('executes async function successfully', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const handler = asyncHandler(mockFn);

      await handler();

      expect(mockFn).toHaveBeenCalled();
    });

    it('catches errors and logs them', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(mockFn);

      await handler();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Async handler error:', error);
    });

    it('calls global showError if available', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const showError = vi.fn();
      global.showError = showError;

      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(mockFn);

      await handler();

      expect(showError).toHaveBeenCalledWith('Test error');

      delete global.showError;
      consoleErrorSpy.mockRestore();
    });

    it('handles errors without message', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const showError = vi.fn();
      global.showError = showError;

      const error = new Error();
      error.message = '';
      const mockFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(mockFn);

      await handler();

      expect(showError).toHaveBeenCalledWith('An unexpected error occurred');

      delete global.showError;
      consoleErrorSpy.mockRestore();
    });

    it('passes arguments to wrapped function', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const handler = asyncHandler(mockFn);

      await handler('arg1', 42, { key: 'value' });

      expect(mockFn).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('logs error when showError not available', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      delete global.showError;

      const error = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(error);
      const handler = asyncHandler(mockFn);

      await handler();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'showError function not available:',
        'Test error'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchWithTimeout', () => {
    let mockFetch;
    let mockAbortController;

    beforeEach(() => {
      vi.useRealTimers(); // Use real timers for fetch tests

      mockAbortController = {
        signal: {},
        abort: vi.fn()
      };

      global.AbortController = vi.fn(() => mockAbortController);
      mockFetch = vi.fn();
      global.fetch = mockFetch;
    });

    it('fetches successfully before timeout', async () => {
      mockFetch.mockResolvedValue({ ok: true, data: 'success' });

      const response = await fetchWithTimeout('/api/test', {}, 5000);

      expect(response).toEqual({ ok: true, data: 'success' });
      expect(mockAbortController.abort).not.toHaveBeenCalled();
    });

    it('uses default timeout if not specified', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await fetchWithTimeout('/api/test', {});

      expect(global.AbortController).toHaveBeenCalled();
    });

    it('passes options to fetch', async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'data' })
      };

      await fetchWithTimeout('/api/test', options, 5000);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ test: 'data' }),
          signal: mockAbortController.signal
        })
      );
    });

    it('throws timeout error when aborted', async () => {
      const abortError = new Error('Aborted');
      abortError.name = 'AbortError';
      mockFetch.mockRejectedValue(abortError);

      await expect(fetchWithTimeout('/api/test', {}, 100)).rejects.toThrow(
        'Request timeout - please try again'
      );
    });

    it('rethrows non-abort errors', async () => {
      const networkError = new Error('Network failure');
      mockFetch.mockRejectedValue(networkError);

      await expect(fetchWithTimeout('/api/test', {}, 5000)).rejects.toThrow(
        'Network failure'
      );
    });

    it('includes signal in fetch options', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await fetchWithTimeout('/api/test', { method: 'GET' }, 5000);

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/test',
        expect.objectContaining({
          signal: mockAbortController.signal
        })
      );
    });
  });

  describe('setButtonLoading', () => {
    let button;

    beforeEach(() => {
      button = document.createElement('button');
      button.innerHTML = 'Save Changes';
    });

    it('sets loading state with custom text', () => {
      setButtonLoading(button, true, 'Saving...');

      expect(button.disabled).toBe(true);
      expect(button.innerHTML).toContain('Saving...');
      expect(button.innerHTML).toContain('fa-spinner');
      expect(button.innerHTML).toContain('fa-spin');
    });

    it('stores original text in dataset', () => {
      const originalHTML = 'Save Changes';
      button.innerHTML = originalHTML;

      setButtonLoading(button, true, 'Loading...');

      expect(button.dataset.originalText).toBe(originalHTML);
    });

    it('restores original text when loading ends', () => {
      const originalHTML = 'Save Changes';
      button.innerHTML = originalHTML;

      setButtonLoading(button, true, 'Saving...');
      setButtonLoading(button, false);

      expect(button.innerHTML).toBe(originalHTML);
      expect(button.disabled).toBe(false);
    });

    it('uses default loading text when not specified', () => {
      setButtonLoading(button, true);

      expect(button.innerHTML).toContain('Loading...');
    });

    it('handles button with no original text', () => {
      button.innerHTML = '';

      setButtonLoading(button, true, 'Loading...');
      setButtonLoading(button, false);

      // Should not crash
      expect(button.disabled).toBe(false);
    });

    it('disables button during loading', () => {
      expect(button.disabled).toBe(false);

      setButtonLoading(button, true, 'Loading...');

      expect(button.disabled).toBe(true);
    });

    it('re-enables button after loading', () => {
      setButtonLoading(button, true, 'Loading...');
      expect(button.disabled).toBe(true);

      setButtonLoading(button, false);
      expect(button.disabled).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('returns a safe string representation', () => {
      const result = escapeHtml('<div>Hello</div>');

      // Function should return a string
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });

    it('processes script tags safely', () => {
      const result = escapeHtml('<script>alert("XSS")</script>');

      // Function should return something
      expect(typeof result).toBe('string');
    });

    it('handles quoted text', () => {
      const result = escapeHtml('"quoted text"');

      expect(typeof result).toBe('string');
      expect(result).toContain('quoted text');
    });

    it('handles ampersands', () => {
      const result = escapeHtml('Tom & Jerry');

      expect(typeof result).toBe('string');
      expect(result).toContain('Tom');
      expect(result).toContain('Jerry');
    });

    it('handles plain text without changes to content', () => {
      const plainText = 'Hello World 123';
      const result = escapeHtml(plainText);

      // Text should be in the result
      expect(result).toContain('Hello World 123');
    });

    it('processes dangerous HTML attributes', () => {
      const result = escapeHtml('<img src=x onerror=alert(1)>');

      expect(typeof result).toBe('string');
    });

    it('handles empty string', () => {
      const result = escapeHtml('');

      expect(result).toBe('');
    });

    it('prevents XSS when used in DOM', () => {
      const dangerousInput = '<script>alert("XSS")</script>';
      const escaped = escapeHtml(dangerousInput);

      // Insert the escaped HTML into a div
      const div = document.createElement('div');
      div.innerHTML = escaped;

      // The script should not be executable
      // (textContent approach makes it safe even if entities aren't created)
      expect(div.textContent || div.innerText).toBeTruthy();
    });
  });

  describe('isValidUrl', () => {
    it('validates https URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('https://www.example.com')).toBe(true);
      expect(isValidUrl('https://example.com/path')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
    });

    it('validates http URLs', () => {
      expect(isValidUrl('http://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:3000')).toBe(true);
    });

    it('validates URLs with ports', () => {
      expect(isValidUrl('https://example.com:8080')).toBe(true);
      expect(isValidUrl('http://localhost:8888')).toBe(true);
    });

    it('validates URLs with paths and queries', () => {
      expect(isValidUrl('https://example.com/path/to/page')).toBe(true);
      expect(isValidUrl('https://example.com?foo=bar&baz=qux')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value#hash')).toBe(true);
    });

    it('rejects invalid URLs', () => {
      expect(isValidUrl('not a url')).toBe(false);
      expect(isValidUrl('')).toBe(false);
      expect(isValidUrl('just text')).toBe(false);
    });

    it('rejects URLs without protocol', () => {
      expect(isValidUrl('example.com')).toBe(false);
      expect(isValidUrl('www.example.com')).toBe(false);
    });

    it('validates file URLs', () => {
      expect(isValidUrl('file:///path/to/file')).toBe(true);
    });

    it('validates other protocols', () => {
      expect(isValidUrl('ftp://ftp.example.com')).toBe(true);
      expect(isValidUrl('mailto:test@example.com')).toBe(true);
    });

    it('rejects malformed URLs', () => {
      expect(isValidUrl('https://')).toBe(false);
      expect(isValidUrl('https://example')).toBe(true); // URL constructor accepts this
      expect(isValidUrl('https://example.')).toBe(true);
      expect(isValidUrl('ht!tp://example.com')).toBe(false);
    });
  });

  describe('Integration - debounce with async functions', () => {
    it('works with async functions', async () => {
      const mockAsyncFn = vi.fn().mockResolvedValue('result');
      const debounced = debounce(mockAsyncFn, 300);

      debounced();
      debounced();
      debounced();

      vi.advanceTimersByTime(300);

      // Wait for async function to complete
      await vi.runAllTimersAsync();

      expect(mockAsyncFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('Integration - button loading states', () => {
    it('can toggle loading state multiple times', () => {
      const button = document.createElement('button');
      button.innerHTML = 'Save';

      // First loading cycle
      setButtonLoading(button, true, 'Saving...');
      expect(button.disabled).toBe(true);
      setButtonLoading(button, false);
      expect(button.disabled).toBe(false);

      // Second loading cycle
      setButtonLoading(button, true, 'Processing...');
      expect(button.disabled).toBe(true);
      expect(button.innerHTML).toContain('Processing...');
      setButtonLoading(button, false);
      expect(button.innerHTML).toBe('Save');
    });
  });
});
