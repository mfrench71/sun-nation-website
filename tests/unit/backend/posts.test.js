/**
 * Unit Tests for Posts Netlify Function
 *
 * Tests CRUD operations for Jekyll post files via GitHub API integration.
 * Covers GET (list/single), POST (create), PUT (update), DELETE operations.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Posts Function', () => {
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
    const module = await import('../../../netlify/functions/posts.js');
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
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      // Mock successful GitHub response
      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify([
          { name: '2025-10-21-test-post.md', path: '_posts/2025-10-21-test-post.md', sha: 'abc123', size: 500 }
        ])
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET - List all posts', () => {
    it('lists all markdown posts from _posts directory', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      const mockFiles = [
        { name: '2025-10-21-first-post.md', path: '_posts/2025-10-21-first-post.md', sha: 'sha1', size: 500 },
        { name: '2025-10-22-second-post.md', path: '_posts/2025-10-22-second-post.md', sha: 'sha2', size: 600 },
        { name: 'README.txt', path: '_posts/README.txt', sha: 'sha3', size: 100 } // Should be filtered
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify(mockFiles)
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.posts).toHaveLength(2);
      expect(body.posts[0].name).toBe('2025-10-21-first-post.md');
      expect(body.posts[1].name).toBe('2025-10-22-second-post.md');
      // Verify README.txt was filtered out
      expect(body.posts.some(p => p.name === 'README.txt')).toBe(false);
    });

    it('makes request to GitHub with correct path', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify([])
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.github.com');
      expect(requestOptions.path).toContain('/repos/mfrench71/circleseven-website/contents/_posts');
      expect(requestOptions.path).toContain('ref=main');
      expect(requestOptions.method).toBe('GET');
      expect(requestOptions.headers['Authorization']).toBe('token test-github-token-12345');
    });

    it('returns only name, path, sha, and size for each post', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      const mockFiles = [
        {
          name: '2025-10-21-post.md',
          path: '_posts/2025-10-21-post.md',
          sha: 'abc123',
          size: 500,
          url: 'https://api.github.com/...',  // Should be filtered
          git_url: 'https://...',  // Should be filtered
          html_url: 'https://...'  // Should be filtered
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify(mockFiles)
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.posts[0]).toEqual({
        name: '2025-10-21-post.md',
        path: '_posts/2025-10-21-post.md',
        sha: 'abc123',
        size: 500
      });
      expect(body.posts[0].url).toBeUndefined();
      expect(body.posts[0].git_url).toBeUndefined();
    });
  });

  describe('GET - List posts with metadata', () => {
    it('fetches frontmatter for each post when metadata=true', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { metadata: 'true' }
      };

      // First call: list posts
      // Second call onwards: get each post's content
      const mockCalls = [
        // List posts response
        JSON.stringify([
          { name: '2025-10-21-post.md', path: '_posts/2025-10-21-post.md', sha: 'sha1', size: 500 }
        ]),
        // Individual post content
        JSON.stringify({
          name: '2025-10-21-post.md',
          sha: 'sha1',
          content: Buffer.from('---\ntitle: Test Post\ndate: 2025-10-21\n---\nPost content').toString('base64')
        })
      ];

      let callIndex = 0;
      https.request.mockImplementation((options, callback) => {
        const responseData = mockCalls[callIndex++];
        callback(mockResponse);

        mockRequest.end.mockImplementation(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) dataCallback(responseData);
          if (endCallback) endCallback();
        });

        return mockRequest;
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.posts[0].frontmatter).toEqual({
        title: 'Test Post',
        date: '2025-10-21'
      });
      expect(https.request).toHaveBeenCalledTimes(2); // List + 1 individual post
    });

    it('handles metadata fetch errors gracefully', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { metadata: 'true' }
      };

      const mockCalls = [
        // List posts
        JSON.stringify([
          { name: 'post1.md', path: '_posts/post1.md', sha: 'sha1', size: 500 },
          { name: 'post2.md', path: '_posts/post2.md', sha: 'sha2', size: 600 }
        ]),
        // Post 1 succeeds
        JSON.stringify({
          content: Buffer.from('---\ntitle: Post 1\n---\nContent').toString('base64')
        })
        // Post 2 will fail (simulate error)
      ];

      let callIndex = 0;
      https.request.mockImplementation((options, callback) => {
        if (callIndex === 2) {
          // Simulate error on second post
          mockRequest.end.mockImplementation(() => {
            const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')?.[1];
            if (errorCallback) {
              setTimeout(() => errorCallback(new Error('Network error')), 0);
            }
          });
          callIndex++;
          return mockRequest;
        }

        const responseData = mockCalls[callIndex++];
        callback(mockResponse);

        mockRequest.end.mockImplementation(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) dataCallback(responseData);
          if (endCallback) endCallback();
        });

        return mockRequest;
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Should return both posts, but post2 without metadata
      expect(body.posts).toHaveLength(2);
      expect(body.posts[0].frontmatter).toBeDefined();
      expect(body.posts[1].frontmatter).toBeUndefined();
    });

    it('does not fetch metadata when metadata=false', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { metadata: 'false' }
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify([
          { name: 'post.md', path: '_posts/post.md', sha: 'sha1', size: 500 }
        ])
      });

      const response = await handler(event, {});

      // Only 1 call for listing, no individual post fetches
      expect(https.request).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET - Single post', () => {
    it('retrieves single post with frontmatter and body', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: '2025-10-21-test-post.md' }
      };

      const postContent = `---
title: My Test Post
date: 2025-10-21
categories:
  - Technology
  - JavaScript
tags:
  - coding
---
This is the post body content.`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          name: '2025-10-21-test-post.md',
          sha: 'abc123',
          content: Buffer.from(postContent).toString('base64')
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.path).toBe('2025-10-21-test-post.md');
      expect(body.sha).toBe('abc123');
      expect(body.frontmatter.title).toBe('My Test Post');
      expect(body.frontmatter.date).toBe('2025-10-21');
      expect(body.frontmatter.categories).toEqual(['Technology', 'JavaScript']);
      expect(body.frontmatter.tags).toEqual(['coding']);
      expect(body.body).toBe('This is the post body content.');
    });

    it('makes request to correct GitHub path for single post', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: '2025-10-21-my-post.md' }
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from('---\ntitle: Test\n---\nBody').toString('base64'),
          sha: 'abc123'
        })
      });

      await handler(event, {});

      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.path).toContain('/contents/_posts/2025-10-21-my-post.md');
      expect(requestOptions.path).toContain('ref=main');
    });

    it('handles post with no frontmatter', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'simple-post.md' }
      };

      const postContent = 'Just plain markdown content, no frontmatter.';

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(postContent).toString('base64'),
          sha: 'def456'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter).toEqual({});
      expect(body.body).toBe(postContent);
    });

    it('handles post not found (404)', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'nonexistent-post.md' }
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

  describe('POST - Create new post', () => {
    it('creates new post successfully', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: '2025-10-22-new-post.md',
          frontmatter: {
            title: 'New Post',
            date: '2025-10-22',
            categories: ['Tech'],
            tags: ['test']
          },
          body: 'This is the new post content.'
        })
      };

      setupGitHubMock({
        statusCode: 201,
        body: JSON.stringify({
          commit: { sha: 'commit-sha-123' }
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post created successfully');
      expect(body.commitSha).toBe('commit-sha-123');
    });

    it('sends correct data to GitHub API', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: '2025-10-22-test.md',
          frontmatter: {
            title: 'Test Post',
            date: '2025-10-22'
          },
          body: 'Post body'
        })
      };

      setupGitHubMock({
        statusCode: 201,
        body: JSON.stringify({ commit: { sha: 'abc' } })
      });

      await handler(event, {});

      // Verify request details
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.method).toBe('PUT'); // GitHub uses PUT for file creation
      expect(requestOptions.path).toContain('/contents/_posts/2025-10-22-test.md');

      // Verify request body
      const writtenData = mockRequest.write.mock.calls[0][0];
      const requestBody = JSON.parse(writtenData);
      expect(requestBody.message).toBe('Create post: 2025-10-22-test.md');
      expect(requestBody.branch).toBe('main');

      // Verify content is base64 encoded markdown with frontmatter
      const decodedContent = Buffer.from(requestBody.content, 'base64').toString('utf8');
      expect(decodedContent).toContain('---\ntitle: Test Post');
      expect(decodedContent).toContain('Post body');
    });

    it('builds frontmatter correctly with arrays', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          frontmatter: {
            title: 'Test',
            categories: ['Tech', 'JavaScript'],
            tags: []
          },
          body: 'Body'
        })
      };

      setupGitHubMock({
        statusCode: 201,
        body: JSON.stringify({ commit: { sha: 'abc' } })
      });

      await handler(event, {});

      const writtenData = mockRequest.write.mock.calls[0][0];
      const requestBody = JSON.parse(writtenData);
      const decodedContent = Buffer.from(requestBody.content, 'base64').toString('utf8');

      expect(decodedContent).toContain('categories:\n  - Tech\n  - JavaScript');
      expect(decodedContent).toContain('tags: []');
    });

    it('returns 400 when filename is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          frontmatter: { title: 'Test' },
          body: 'Body'
          // filename missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
      expect(body.message).toContain('filename');
    });

    it('returns 400 when frontmatter is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          body: 'Body'
          // frontmatter missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
    });

    it('returns 400 when body is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          frontmatter: { title: 'Test' }
          // body missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
    });

    it('allows empty string body', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          frontmatter: { title: 'Test' },
          body: ''
        })
      };

      setupGitHubMock({
        statusCode: 201,
        body: JSON.stringify({ commit: { sha: 'abc' } })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(201);
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
      expect(body.message).toContain('GITHUB_TOKEN');
    });

    it('handles GitHub API error during creation', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body'
        })
      };

      setupGitHubMock({
        statusCode: 409,
        body: JSON.stringify({ message: 'File already exists' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toContain('409');
    });
  });

  describe('PUT - Update existing post', () => {
    it('updates post successfully', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          path: '2025-10-21-existing-post.md',
          frontmatter: {
            title: 'Updated Title',
            date: '2025-10-21'
          },
          body: 'Updated content',
          sha: 'current-sha-123'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          commit: { sha: 'new-commit-sha-456' }
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post updated successfully');
      expect(body.commitSha).toBe('new-commit-sha-456');
    });

    it('sends SHA for conflict detection', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          path: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body',
          sha: 'original-sha-abc123'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ commit: { sha: 'new-sha' } })
      });

      await handler(event, {});

      const writtenData = mockRequest.write.mock.calls[0][0];
      const requestBody = JSON.parse(writtenData);
      expect(requestBody.sha).toBe('original-sha-abc123');
      expect(requestBody.message).toBe('Update post: test.md');
    });

    it('returns 400 when path is missing', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          frontmatter: { title: 'Test' },
          body: 'Body',
          sha: 'abc123'
          // path missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
      expect(body.message).toContain('path');
    });

    it('returns 400 when sha is missing', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          path: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body'
          // sha missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('sha');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          path: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body',
          sha: 'abc123'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
    });

    it('handles SHA conflict (409)', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          path: 'test.md',
          frontmatter: { title: 'Test' },
          body: 'Body',
          sha: 'old-sha'
        })
      };

      setupGitHubMock({
        statusCode: 409,
        body: JSON.stringify({ message: 'SHA does not match' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('409');
    });
  });

  describe('DELETE - Delete post', () => {
    it('deletes post successfully', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          path: '2025-10-21-old-post.md',
          sha: 'file-sha-123'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          commit: { sha: 'delete-commit-sha' }
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post deleted successfully');
      expect(body.commitSha).toBe('delete-commit-sha');
    });

    it('sends correct delete request to GitHub', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          path: 'test-post.md',
          sha: 'sha-to-delete'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ commit: { sha: 'commit' } })
      });

      await handler(event, {});

      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.method).toBe('DELETE');
      expect(requestOptions.path).toContain('/contents/_posts/test-post.md');

      const writtenData = mockRequest.write.mock.calls[0][0];
      const requestBody = JSON.parse(writtenData);
      expect(requestBody.message).toBe('Delete post: test-post.md');
      expect(requestBody.sha).toBe('sha-to-delete');
      expect(requestBody.branch).toBe('main');
    });

    it('returns 400 when path is missing', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          sha: 'abc123'
          // path missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
      expect(body.message).toContain('path');
    });

    it('returns 400 when sha is missing', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          path: 'test.md'
          // sha missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('sha');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          path: 'test.md',
          sha: 'abc123'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
    });

    it('handles post not found during delete', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          path: 'nonexistent.md',
          sha: 'abc123'
        })
      };

      setupGitHubMock({
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('404');
    });
  });

  describe('Frontmatter parsing', () => {
    it('parses simple key-value pairs', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: Simple Post
date: 2025-10-21
author: John Doe
---
Body content`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter.title).toBe('Simple Post');
      expect(body.frontmatter.date).toBe('2025-10-21');
      expect(body.frontmatter.author).toBe('John Doe');
    });

    it('parses arrays with dash syntax', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: Test
categories:
  - Technology
  - JavaScript
  - Web Development
tags:
  - coding
---
Body`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter.categories).toEqual(['Technology', 'JavaScript', 'Web Development']);
      expect(body.frontmatter.tags).toEqual(['coding']);
    });

    it('parses arrays with bracket syntax', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: Test
categories: [Tech, JavaScript]
tags: ['coding', 'tutorial']
---
Body`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter.categories).toEqual(['Tech', 'JavaScript']);
      expect(body.frontmatter.tags).toEqual(['coding', 'tutorial']);
    });

    it('removes quotes from values', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: "Quoted Title"
author: 'Single Quoted'
description: "Value with: colon"
---
Body`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter.title).toBe('Quoted Title');
      expect(body.frontmatter.author).toBe('Single Quoted');
      expect(body.frontmatter.description).toBe('Value with: colon');
    });

    it('preserves colons in values', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: Post Title
url: https://example.com:8080/path
---
Body`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.frontmatter.url).toBe('https://example.com:8080/path');
    });

    it('separates body from frontmatter', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { path: 'test.md' }
      };

      const content = `---
title: Test Post
---
# Heading

Paragraph with content.

More content here.`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(content).toString('base64'),
          sha: 'abc'
        })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.body).toBe('# Heading\n\nParagraph with content.\n\nMore content here.');
      expect(body.body).not.toContain('---');
      expect(body.body).not.toContain('title:');
    });
  });

  describe('Error handling', () => {
    it('returns 405 for unsupported methods', async () => {
      const event = {
        httpMethod: 'PATCH'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(405);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Method not allowed');
    });

    it('handles network errors', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      https.request.mockImplementation((options, callback) => {
        mockRequest.end.mockImplementation(() => {
          const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')?.[1];
          if (errorCallback) {
            setTimeout(() => errorCallback(new Error('Network connection failed')), 0);
          }
        });
        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toContain('Network connection failed');
    });

    it('includes stack trace in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      https.request.mockImplementation(() => {
        throw new Error('Test error with stack');
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeDefined();

      delete process.env.NODE_ENV;
    });

    it('hides stack trace in production', async () => {
      process.env.NODE_ENV = 'production';

      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      https.request.mockImplementation(() => {
        throw new Error('Test error');
      });

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeUndefined();

      delete process.env.NODE_ENV;
    });

    it('handles malformed JSON in request body', async () => {
      const event = {
        httpMethod: 'POST',
        body: 'not valid json{{'
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
    });
  });

  // Helper function to setup GitHub API mock
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
});
