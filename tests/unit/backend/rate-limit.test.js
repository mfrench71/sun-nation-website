/**
 * Unit Tests for Rate Limit Netlify Function
 *
 * Tests GitHub API rate limit checking functionality.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Rate Limit Function', () => {
  let handler;
  let mockRequest;
  let mockResponse;

  beforeEach(async () => {
    // Clear module cache and reimport
    vi.resetModules();

    // Mock environment variables
    process.env.GITHUB_TOKEN = 'test-github-token-12345';

    // Setup mock request and response
    mockRequest = {
      on: vi.fn(),
      end: vi.fn()
    };

    mockResponse = {
      statusCode: 200,
      on: vi.fn(),
      setEncoding: vi.fn()
    };

    // Mock https.request
    https.request = vi.fn().mockReturnValue(mockRequest);

    // Import handler after mocking
    const module = await import('../../../netlify/functions/rate-limit.js');
    handler = module.handler;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.GITHUB_TOKEN;
  });

  describe('CORS and OPTIONS', () => {
    it('handles OPTIONS preflight request', async () => {
      const event = {
        httpMethod: 'OPTIONS'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, OPTIONS');
      expect(response.body).toBe('');
    });

    it('includes CORS headers in all responses', async () => {
      const event = {
        httpMethod: 'GET'
      };

      // Mock successful GitHub response
      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 150
          }
        }
      });

      // Setup mock response
      mockRequest.on.mockImplementation((event, callback) => {
        if (event === 'error') return mockRequest;
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET rate limit', () => {
    it('fetches and returns rate limit data', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const resetTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: resetTime,
            used: 150
          }
        }
      });

      // Setup successful response
      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.limit).toBe(5000);
      expect(body.remaining).toBe(4850);
      expect(body.used).toBe(150);
      expect(body.usedPercent).toBe(3);
      expect(body).toHaveProperty('resetDate');
      expect(body).toHaveProperty('minutesUntilReset');
    });

    it('makes request to GitHub with correct headers', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 150
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        // Verify request options
        expect(options.hostname).toBe('api.github.com');
        expect(options.path).toBe('/rate_limit');
        expect(options.method).toBe('GET');
        expect(options.headers['User-Agent']).toBe('Netlify-Function');
        expect(options.headers['Authorization']).toBe('token test-github-token-12345');
        expect(options.headers['Accept']).toBe('application/vnd.github.v3+json');

        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
    });

    it('calculates usedPercent correctly', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 3000, // 2000 used = 40%
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 2000
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.usedPercent).toBe(40);
    });

    it('calculates minutesUntilReset correctly', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const resetTime = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: resetTime,
            used: 150
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.minutesUntilReset).toBeGreaterThan(25);
      expect(body.minutesUntilReset).toBeLessThanOrEqual(30);
    });

    it('formats resetDate as ISO string', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const resetTime = 1634567890;
      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: resetTime,
            used: 150
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.resetDate).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(body.resetDate).getTime()).toBe(resetTime * 1000);
    });
  });

  describe('Error handling', () => {
    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'GET'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
      expect(body.message).toContain('GITHUB_TOKEN');
    });

    it('returns 405 for unsupported methods', async () => {
      const event = {
        httpMethod: 'POST'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('handles GitHub API errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      mockResponse.statusCode = 403;
      const errorData = JSON.stringify({ message: 'Rate limit exceeded' });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(errorData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });

    it('handles network errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      https.request.mockImplementation((options, callback) => {
        return mockRequest;
      });

      mockRequest.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('Network error')), 0);
        }
        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toContain('Network error');
    });

    it('handles malformed JSON from GitHub', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const invalidData = 'not valid json';

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(invalidData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('Edge cases', () => {
    it('handles reset time in the past (shows 0 minutes)', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const resetTime = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 4850,
            reset: resetTime,
            used: 150
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.minutesUntilReset).toBe(0);
    });

    it('handles 100% usage', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 0,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 5000
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.remaining).toBe(0);
      expect(body.usedPercent).toBe(100);
    });

    it('handles 0% usage (brand new limit)', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockData = JSON.stringify({
        resources: {
          core: {
            limit: 5000,
            remaining: 5000,
            reset: Math.floor(Date.now() / 1000) + 3600,
            used: 0
          }
        }
      });

      https.request.mockImplementation((options, callback) => {
        callback(mockResponse);
        return mockRequest;
      });

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(mockData);
        if (endCallback) endCallback();
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.remaining).toBe(5000);
      expect(body.usedPercent).toBe(0);
    });
  });
});
