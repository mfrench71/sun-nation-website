/**
 * Unit Tests for Taxonomy Netlify Function
 *
 * Tests site-wide taxonomy management (categories and tags).
 * Covers GET/PUT operations for _data/taxonomy.yml.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';
import yaml from 'js-yaml';

// Mock the https module
vi.mock('https');

describe('Taxonomy Function', () => {
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
    const module = await import('../../../netlify/functions/taxonomy.js');
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
      expect(response.headers['Access-Control-Allow-Methods']).toBe('GET, POST, PUT, DELETE, OPTIONS');
      expect(response.body).toBe('');
    });

    it('includes CORS headers in all responses', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: [
          { item: 'Technology' },
          { item: 'Life' }
        ],
        tags: [
          { item: 'JavaScript' }
        ]
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'abc123'
        })
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET - Read taxonomy', () => {
    it('retrieves categories and tags from taxonomy.yml', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: [
          { item: 'Technology' },
          { item: 'Life' },
          { item: 'Travel' }
        ],
        tags: [
          { item: 'JavaScript' },
          { item: 'Python' }
        ]
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'abc123'
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.categories).toEqual(['Technology', 'Life', 'Travel']);
      expect(body.tags).toEqual(['JavaScript', 'Python']);
    });

    it('extracts strings from object format (item field)', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: [
          { item: 'Tech' },
          { item: 'Life' }
        ],
        tags: [
          { item: 'Coding' }
        ]
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.categories).toEqual(['Tech', 'Life']);
      expect(body.tags).toEqual(['Coding']);
    });

    it('handles plain string format', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: ['Tech', 'Life'],
        tags: ['JavaScript']
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.categories).toEqual(['Tech', 'Life']);
      expect(body.tags).toEqual(['JavaScript']);
    });

    it('handles mixed format (objects and strings)', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: [
          { item: 'Tech' },
          'Life', // Plain string
          { item: 'Travel' }
        ],
        tags: [
          'JavaScript', // Plain string
          { item: 'Python' }
        ]
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.categories).toEqual(['Tech', 'Life', 'Travel']);
      expect(body.tags).toEqual(['JavaScript', 'Python']);
    });

    it('handles empty categories and tags', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        categories: [],
        tags: []
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.categories).toEqual([]);
      expect(body.tags).toEqual([]);
    });

    it('handles missing categories field', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = {
        tags: [{ item: 'JavaScript' }]
        // categories missing
      };

      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.categories).toEqual([]);
      expect(body.tags).toEqual(['JavaScript']);
    });

    it('makes request to GitHub with correct path', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const taxonomy = { categories: [], tags: [] };
      const yamlContent = yaml.dump(taxonomy);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64')
        })
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.github.com');
      expect(requestOptions.path).toContain('/repos/mfrench71/circleseven-website/contents/_data/taxonomy.yml');
      expect(requestOptions.path).toContain('ref=main');
      expect(requestOptions.method).toBe('GET');
      expect(requestOptions.headers['Authorization']).toBe('token test-github-token-12345');
    });

    it('handles GitHub API errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toContain('404');
    });

    it('handles YAML parsing errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const invalidYaml = 'categories:\n  - item: Test\ninvalid:\n  - broken\n    - bad';

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(invalidYaml).toString('base64')
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('PUT - Update taxonomy', () => {
    it('updates taxonomy successfully', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: ['Tech', 'Life', 'Travel'],
          tags: ['JavaScript', 'Python', 'Ruby']
        })
      };

      const mockCalls = [
        // GET current file for SHA
        JSON.stringify({
          content: Buffer.from('old content').toString('base64'),
          sha: 'current-sha-123'
        }),
        // PUT updated file
        JSON.stringify({
          commit: { sha: 'new-commit-sha-456' }
        })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toContain('Taxonomy updated successfully');
      expect(body.commitSha).toBe('new-commit-sha-456');
    });

    it('builds YAML with correct format and comments', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: ['Tech', 'Life'],
          tags: ['JavaScript']
        })
      };

      let capturedContent = '';

      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // GET current file
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from('old').toString('base64'),
              sha: 'sha'
            }));
            if (endCallback) endCallback();
          });
        } else {
          // PUT updated file - capture content
          callback(mockResponse);
          mockRequest.write.mockImplementation((data) => {
            capturedContent = data;
          });
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'new' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Verify YAML format
      const requestBody = JSON.parse(capturedContent);
      const decodedYaml = Buffer.from(requestBody.content, 'base64').toString('utf8');

      expect(decodedYaml).toContain('# Site Taxonomy');
      expect(decodedYaml).toContain('categories:');
      expect(decodedYaml).toContain('  - item: Tech');
      expect(decodedYaml).toContain('  - item: Life');
      expect(decodedYaml).toContain('tags:');
      expect(decodedYaml).toContain('  - item: JavaScript');
    });

    it('sends commit message and SHA to GitHub', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: ['Tech'],
          tags: ['JS']
        })
      };

      let capturedContent = '';

      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              sha: 'original-sha-789'
            }));
            if (endCallback) endCallback();
          });
        } else {
          callback(mockResponse);
          mockRequest.write.mockImplementation((data) => {
            capturedContent = data;
          });
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'new' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      const requestBody = JSON.parse(capturedContent);
      expect(requestBody.message).toBe('Update taxonomy from custom admin');
      expect(requestBody.sha).toBe('original-sha-789');
      expect(requestBody.branch).toBe('main');
    });

    it('handles empty arrays', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: [],
          tags: []
        })
      };

      const mockCalls = [
        JSON.stringify({ sha: 'sha' }),
        JSON.stringify({ commit: { sha: 'new' } })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
    });

    it('returns 400 when categories is not an array', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: 'not-an-array',
          tags: []
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid input');
      expect(body.error).toContain('arrays');
    });

    it('returns 400 when tags is not an array', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: [],
          tags: 'not-an-array'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Invalid input');
    });

    it('returns 400 when categories is missing', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          tags: []
          // categories missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 when tags is missing', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: []
          // tags missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: ['Tech'],
          tags: ['JS']
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
      expect(body.message).toContain('GITHUB_TOKEN');
    });

    it('handles GitHub API errors during update', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          categories: ['Tech'],
          tags: ['JS']
        })
      };

      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // GET succeeds
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ sha: 'sha' }));
            if (endCallback) endCallback();
          });
        } else {
          // PUT fails
          mockResponse.statusCode = 409;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ message: 'Conflict' }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('409');
    });

    it('handles malformed JSON in request body', async () => {
      const event = {
        httpMethod: 'PUT',
        body: 'invalid json{{'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  describe('Error handling', () => {
    it('returns 405 for unsupported methods', async () => {
      const event = {
        httpMethod: 'POST'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('returns 405 for DELETE method', async () => {
      const event = {
        httpMethod: 'DELETE'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('includes stack trace in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 500,
        body: JSON.stringify({ message: 'Error' })
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeDefined();

      delete process.env.NODE_ENV;
    });

    it('hides stack trace in production', async () => {
      process.env.NODE_ENV = 'production';

      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 500,
        body: JSON.stringify({ message: 'Error' })
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeUndefined();

      delete process.env.NODE_ENV;
    });
  });

  // Helper functions
  function setupGitHubMock({ statusCode, body }) {
    mockResponse.statusCode = statusCode;

    https.request.mockImplementation((options, callback) => {
      mockRequest.end.mockImplementation(() => {
        // Call the callback to invoke the response handler
        callback(mockResponse);

        // Use setImmediate to ensure event listeners are registered before triggering events
        setImmediate(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) dataCallback(body);
          if (endCallback) endCallback();
        });
      });

      return mockRequest;
    });
  }

  function setupSequentialGitHubMock(mockCalls, startIndex) {
    let callIndex = startIndex;

    https.request.mockImplementation((options, callback) => {
      const responseData = mockCalls[callIndex++];

      mockRequest.end.mockImplementation(() => {
        // Call the callback to invoke the response handler
        callback(mockResponse);

        // Use setImmediate to ensure event listeners are registered before triggering events
        setImmediate(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) dataCallback(responseData);
          if (endCallback) endCallback();
        });
      });

      return mockRequest;
    });
  }
});
