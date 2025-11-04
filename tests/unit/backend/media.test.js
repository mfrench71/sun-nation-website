/**
 * Unit Tests for Media Netlify Function
 *
 * Tests Cloudinary media library integration.
 * Covers GET operation for retrieving image resources.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Media Function', () => {
  let handler;
  let mockRequest;
  let mockResponse;

  beforeEach(async () => {
    // Clear module cache and reimport
    vi.resetModules();

    // Mock environment variables
    process.env.CLOUDINARY_API_SECRET = 'test-cloudinary-secret-12345';

    // Setup mock request and response
    mockRequest = {
      on: vi.fn(),
      write: vi.fn(),
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
    const module = await import('../../../netlify/functions/media.js');
    handler = module.handler;
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.CLOUDINARY_API_SECRET;
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

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET - Retrieve media resources', () => {
    it('fetches media resources from Cloudinary', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const cloudinaryResources = [
        {
          public_id: 'sample-image-1',
          format: 'jpg',
          version: 1234567890,
          resource_type: 'image',
          type: 'upload',
          created_at: '2025-10-21T10:00:00Z',
          bytes: 125000,
          width: 1920,
          height: 1080,
          url: 'http://res.cloudinary.com/circleseven/image/upload/v1234567890/sample-image-1.jpg',
          secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v1234567890/sample-image-1.jpg'
        },
        {
          public_id: 'sample-image-2',
          format: 'png',
          version: 9876543210,
          resource_type: 'image',
          type: 'upload',
          created_at: '2025-10-20T15:30:00Z',
          bytes: 250000,
          width: 1024,
          height: 768,
          url: 'http://res.cloudinary.com/circleseven/image/upload/v9876543210/sample-image-2.png',
          secure_url: 'https://res.cloudinary.com/circleseven/image/upload/v9876543210/sample-image-2.png'
        }
      ];

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: cloudinaryResources })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.resources).toHaveLength(2);
      expect(body.total).toBe(2);
      expect(body.resources[0].public_id).toBe('sample-image-1');
      expect(body.resources[1].format).toBe('png');
    });

    it('returns resources array and total count', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const cloudinaryResources = [
        { public_id: 'img1', format: 'jpg' },
        { public_id: 'img2', format: 'png' },
        { public_id: 'img3', format: 'gif' }
      ];

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: cloudinaryResources })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body).toHaveProperty('resources');
      expect(body).toHaveProperty('total');
      expect(Array.isArray(body.resources)).toBe(true);
      expect(body.total).toBe(3);
    });

    it('returns empty array when no resources exist', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.resources).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('handles missing resources field in response', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({}) // No resources field
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.resources).toEqual([]);
      expect(body.total).toBe(0);
    });

    it('makes request to Cloudinary with correct authentication', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.cloudinary.com');
      expect(requestOptions.path).toContain('/v1_1/circleseven/resources/image');
      expect(requestOptions.path).toContain('max_results=500');
      expect(requestOptions.method).toBe('GET');

      // Verify Basic Auth header
      expect(requestOptions.headers['Authorization']).toMatch(/^Basic /);
    });

    it('uses Basic Auth with API Key and Secret', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      await handler(event, {});

      const requestOptions = https.request.mock.calls[0][0];
      const authHeader = requestOptions.headers['Authorization'];

      // Verify it's Basic Auth
      expect(authHeader).toContain('Basic ');

      // Decode and verify it contains API key (732138267195618)
      const base64Credentials = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
      expect(credentials).toContain('732138267195618'); // API Key
      expect(credentials).toContain('test-cloudinary-secret-12345'); // Secret
    });

    it('returns 500 when CLOUDINARY_API_SECRET is missing', async () => {
      delete process.env.CLOUDINARY_API_SECRET;

      // Need to re-import after deleting env var
      vi.resetModules();
      const module = await import('../../../netlify/functions/media.js');
      const handlerWithoutSecret = module.handler;

      const event = {
        httpMethod: 'GET'
      };

      const response = await handlerWithoutSecret(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Configuration error');
      expect(body.message).toContain('CLOUDINARY_API_SECRET');
    });

    it('handles Cloudinary API errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 401,
        body: JSON.stringify({ error: { message: 'Invalid credentials' } })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to fetch media');
      expect(body.message).toContain('401');
    });

    it('handles malformed JSON response from Cloudinary', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: 'not valid json{{'
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to fetch media');
      expect(body.message).toContain('parse');
    });

    it('handles network errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      https.request.mockImplementation((options, callback) => {
        mockRequest.end.mockImplementation(() => {
          const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')?.[1];
          if (errorCallback) {
            setTimeout(() => errorCallback(new Error('Network error')), 0);
          }
        });
        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Failed to fetch media');
      expect(body.message).toContain('Network error');
    });

    it('includes error stack in error responses', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 500,
        body: JSON.stringify({ message: 'Internal error' })
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('details');
    });
  });

  describe('Method validation', () => {
    it('returns 405 for POST requests', async () => {
      const event = {
        httpMethod: 'POST'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('returns 405 for PUT requests', async () => {
      const event = {
        httpMethod: 'PUT'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('returns 405 for DELETE requests', async () => {
      const event = {
        httpMethod: 'DELETE'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('returns 405 for PATCH requests', async () => {
      const event = {
        httpMethod: 'PATCH'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });
  });

  describe('Security', () => {
    it('uses HTTPS for Cloudinary API calls', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      await handler(event, {});

      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.cloudinary.com');
      // Verify using https module (not http)
      expect(https.request).toHaveBeenCalled();
    });

    it('does not expose API secret in responses', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 200,
        body: JSON.stringify({ resources: [] })
      });

      const response = await handler(event, {});
      const responseBody = JSON.stringify(response);

      expect(responseBody).not.toContain('test-cloudinary-secret-12345');
      expect(responseBody).not.toContain('CLOUDINARY_API_SECRET');
    });

    it('does not expose API secret in error responses', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupCloudinaryMock({
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      });

      const response = await handler(event, {});
      const responseBody = JSON.stringify(response);

      expect(responseBody).not.toContain('test-cloudinary-secret-12345');
    });
  });

  // Helper function
  function setupCloudinaryMock({ statusCode, body }) {
    mockResponse.statusCode = statusCode;

    https.request.mockImplementation((options, callback) => {
      callback(mockResponse);

      mockRequest.end.mockImplementation(() => {
        const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
        const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

        if (dataCallback) dataCallback(body);
        if (endCallback) endCallback();
      });

      return mockRequest;
    });
  }
});
