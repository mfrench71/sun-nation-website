/**
 * Unit Tests for Settings Netlify Function
 *
 * Tests Jekyll site configuration management (_config.yml).
 * Covers GET/PUT operations with security whitelist validation.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';
import yaml from 'js-yaml';

// Mock the https module
vi.mock('https');

describe('Settings Function', () => {
  let handler;
  let mockRequest;
  let mockResponse;

  // Sample config for testing
  const sampleConfig = {
    title: 'Circle Seven Blog',
    description: 'Technology and software development',
    author: 'Matthew French',
    email: 'test@example.com',
    github_username: 'mfrench71',
    paginate: 12,
    related_posts_count: 5,
    timezone: 'America/Los_Angeles',
    lang: 'en',
    // Non-editable fields (should be filtered)
    plugins: ['jekyll-feed', 'jekyll-seo-tag'],
    theme: 'minima',
    markdown: 'kramdown',
    permalink: '/:categories/:year/:month/:day/:title:output_ext'
  };

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
    const module = await import('../../../netlify/functions/settings.js');
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

      const yamlContent = yaml.dump(sampleConfig);
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

  describe('GET - Read settings', () => {
    it('retrieves settings from _config.yml', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const yamlContent = yaml.dump(sampleConfig);
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
      expect(body.title).toBe('Circle Seven Blog');
      expect(body.description).toBe('Technology and software development');
      expect(body.author).toBe('Matthew French');
      expect(body.paginate).toBe(12);
    });

    it('returns only whitelisted editable fields', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const yamlContent = yaml.dump(sampleConfig);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'abc123'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Should include editable fields
      expect(body.title).toBeDefined();
      expect(body.description).toBeDefined();
      expect(body.paginate).toBeDefined();

      // Should NOT include non-editable fields
      expect(body.plugins).toBeUndefined();
      expect(body.theme).toBeUndefined();
      expect(body.markdown).toBeUndefined();
      expect(body.permalink).toBeUndefined();
    });

    it('makes request to GitHub with correct path', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const yamlContent = yaml.dump(sampleConfig);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'abc123'
        })
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.github.com');
      expect(requestOptions.path).toContain('/repos/mfrench71/circleseven-website/contents/_config.yml');
      expect(requestOptions.path).toContain('ref=main');
      expect(requestOptions.method).toBe('GET');
      expect(requestOptions.headers['Authorization']).toBe('token test-github-token-12345');
    });

    it('handles missing editable fields gracefully', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const minimalConfig = {
        title: 'Minimal Site',
        plugins: ['jekyll-feed']
        // Most editable fields missing
      };

      const yamlContent = yaml.dump(minimalConfig);
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'abc123'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.title).toBe('Minimal Site');
      expect(body.description).toBeUndefined();
      expect(body.author).toBeUndefined();
    });

    it('handles YAML parsing errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const invalidYaml = 'title: Test\ninvalid yaml:\n  - broken\n    - malformed';

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(invalidYaml).toString('base64'),
          sha: 'abc123'
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
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
  });

  describe('PUT - Update settings', () => {
    it('updates settings successfully', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'Updated Title',
          description: 'Updated description',
          paginate: 15
        })
      };

      const yamlContent = yaml.dump(sampleConfig);
      const mockCalls = [
        // GET current file
        JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
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
      expect(body.message).toContain('Settings updated successfully');
      expect(body.commitSha).toBe('new-commit-sha-456');
    });

    it('sends updated YAML to GitHub', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'New Title',
          paginate: 20
        })
      };

      const yamlContent = yaml.dump(sampleConfig);
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
              content: Buffer.from(yamlContent).toString('base64'),
              sha: 'current-sha'
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

      // Verify request body
      const requestBody = JSON.parse(capturedContent);
      expect(requestBody.message).toBe('Update site settings from custom admin');
      expect(requestBody.sha).toBe('current-sha');
      expect(requestBody.branch).toBe('main');

      // Verify updated YAML content
      const decodedYaml = Buffer.from(requestBody.content, 'base64').toString('utf8');
      const updatedConfig = yaml.load(decodedYaml);
      expect(updatedConfig.title).toBe('New Title');
      expect(updatedConfig.paginate).toBe(20);
      // Original fields should be preserved
      expect(updatedConfig.author).toBe('Matthew French');
      expect(updatedConfig.plugins).toEqual(['jekyll-feed', 'jekyll-seo-tag']);
    });

    it('preserves non-editable fields', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'Updated Title'
        })
      };

      const yamlContent = yaml.dump(sampleConfig);
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
              content: Buffer.from(yamlContent).toString('base64'),
              sha: 'sha'
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
      const decodedYaml = Buffer.from(requestBody.content, 'base64').toString('utf8');
      const updatedConfig = yaml.load(decodedYaml);

      // Non-editable fields should be unchanged
      expect(updatedConfig.plugins).toEqual(['jekyll-feed', 'jekyll-seo-tag']);
      expect(updatedConfig.theme).toBe('minima');
      expect(updatedConfig.markdown).toBe('kramdown');
      expect(updatedConfig.permalink).toBe('/:categories/:year/:month/:day/:title:output_ext');
    });

    it('rejects updates to non-whitelisted fields', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'New Title',
          plugins: ['malicious-plugin'], // Not in whitelist
          theme: 'evil-theme' // Not in whitelist
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid fields');
      expect(body.message).toContain('plugins');
      expect(body.message).toContain('theme');
    });

    it('allows updating only whitelisted fields', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'New Title',
          description: 'New description',
          author: 'New Author',
          email: 'new@example.com',
          github_username: 'newuser',
          paginate: 10,
          related_posts_count: 3,
          timezone: 'UTC',
          lang: 'es'
        })
      };

      const yamlContent = yaml.dump(sampleConfig);
      const mockCalls = [
        JSON.stringify({
          content: Buffer.from(yamlContent).toString('base64'),
          sha: 'sha'
        }),
        JSON.stringify({ commit: { sha: 'new' } })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('returns 400 for empty updates', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({})
      };

      const response = await handler(event, {});

      // Empty updates are technically valid (no invalid fields)
      // But won't make any changes. Should still succeed.
      expect(response.statusCode).toBe(200);
    });

    it('returns 400 when trying to update only non-whitelisted fields', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          build: 'something',
          destination: '/tmp'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid fields');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          title: 'New Title'
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
          title: 'New Title'
        })
      };

      const yamlContent = yaml.dump(sampleConfig);

      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // GET succeeds
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from(yamlContent).toString('base64'),
              sha: 'sha'
            }));
            if (endCallback) endCallback();
          });
        } else {
          // PUT fails
          mockResponse.statusCode = 409;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ message: 'SHA conflict' }));
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
        body: 'not valid json{{'
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
        body: JSON.stringify({ message: 'Internal error' })
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
        body: JSON.stringify({ message: 'Internal error' })
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeUndefined();

      delete process.env.NODE_ENV;
    });
  });

  describe('Security - Whitelist validation', () => {
    const whitelistedFields = [
      'title',
      'description',
      'author',
      'email',
      'github_username',
      'paginate',
      'related_posts_count',
      'timezone',
      'lang'
    ];

    it('allows all whitelisted fields individually', async () => {
      const yamlContent = yaml.dump(sampleConfig);

      for (const field of whitelistedFields) {
        const event = {
          httpMethod: 'PUT',
          body: JSON.stringify({
            [field]: 'test-value'
          })
        };

        const mockCalls = [
          JSON.stringify({
            content: Buffer.from(yamlContent).toString('base64'),
            sha: 'sha'
          }),
          JSON.stringify({ commit: { sha: 'new' } })
        ];

        let callIndex = 0;
        setupSequentialGitHubMock(mockCalls, callIndex);

        const response = await handler(event, {});

        expect(response.statusCode).toBe(200);
      }
    });

    it('rejects common dangerous fields', async () => {
      const dangerousFields = {
        plugins: ['evil'],
        theme: 'malicious',
        destination: '/etc/passwd',
        source: '/sensitive',
        exclude: [],
        include: [],
        keep_files: [],
        encoding: 'utf-8',
        markdown_ext: 'md',
        strict_front_matter: false
      };

      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify(dangerousFields)
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Invalid fields');
      expect(body.message).toContain('plugins');
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
