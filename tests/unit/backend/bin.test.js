/**
 * Unit Tests for Bin Netlify Function
 *
 * Tests soft-deletion and restoration system for posts and pages.
 * Covers bin operations: list, move to bin, restore, permanent delete.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Bin Function', () => {
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
    const module = await import('../../../netlify/functions/bin.js');
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

      setupGitHubMock({
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' })
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET - List bined items', () => {
    it('lists all bined markdown files', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockBinFiles = [
        { name: '2025-10-21-post.md', path: '_bin/2025-10-21-post.md', sha: 'sha1', size: 500 },
        { name: 'about.md', path: '_bin/about.md', sha: 'sha2', size: 300 },
        { name: 'README.txt', path: '_bin/README.txt', sha: 'sha3', size: 100 } // Should be filtered
      ];

      // First call: list bin directory
      // Subsequent calls: get each file's content for bined_at
      const mockCalls = [
        JSON.stringify(mockBinFiles),
        JSON.stringify({
          content: Buffer.from('---\ntitle: Post\nbined_at: 2025-10-21T10:00:00Z\n---\nContent').toString('base64')
        }),
        JSON.stringify({
          content: Buffer.from('---\ntitle: About\nbined_at: 2025-10-22T15:30:00Z\n---\nContent').toString('base64')
        })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toHaveLength(2);
      expect(body.items[0].name).toBe('2025-10-21-post.md');
      expect(body.items[0].type).toBe('post');
      expect(body.items[0].bined_at).toBe('2025-10-21T10:00:00Z');
      expect(body.items[1].name).toBe('about.md');
      expect(body.items[1].type).toBe('page');
      // Verify .txt file was filtered out
      expect(body.items.some(item => item.name === 'README.txt')).toBe(false);
    });

    it('auto-detects item type based on filename pattern', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockCalls = [
        JSON.stringify([
          { name: '2025-10-21-my-post.md', path: '_bin/2025-10-21-my-post.md', sha: 'sha1', size: 500 },
          { name: 'contact.md', path: '_bin/contact.md', sha: 'sha2', size: 300 },
          { name: '2024-12-01-old-post.md', path: '_bin/2024-12-01-old-post.md', sha: 'sha3', size: 400 }
        ]),
        JSON.stringify({ content: Buffer.from('---\ntitle: Post 1\nbined_at: 2025-10-21\n---\n').toString('base64') }),
        JSON.stringify({ content: Buffer.from('---\ntitle: Contact\nbined_at: 2025-10-21\n---\n').toString('base64') }),
        JSON.stringify({ content: Buffer.from('---\ntitle: Old\nbined_at: 2024-12-01\n---\n').toString('base64') })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Files starting with YYYY-MM-DD- are posts
      expect(body.items[0].type).toBe('post');
      expect(body.items[2].type).toBe('post');
      // Files without date prefix are pages
      expect(body.items[1].type).toBe('page');
    });

    it('returns empty array when bin directory does not exist', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 404,
        body: JSON.stringify({ message: 'Not Found' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.items).toEqual([]);
    });

    it('handles missing bined_at gracefully', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockCalls = [
        JSON.stringify([
          { name: 'test.md', path: '_bin/test.md', sha: 'sha1', size: 500 }
        ]),
        JSON.stringify({
          content: Buffer.from('---\ntitle: Test\n---\nNo bined_at field').toString('base64')
        })
      ];

      let callIndex = 0;
      setupSequentialGitHubMock(mockCalls, callIndex);

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.items[0].bined_at).toBeNull();
    });

    it('handles error fetching bined_at for individual files', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const mockCalls = [
        JSON.stringify([
          { name: 'file1.md', path: '_bin/file1.md', sha: 'sha1', size: 500 },
          { name: 'file2.md', path: '_bin/file2.md', sha: 'sha2', size: 600 }
        ]),
        JSON.stringify({ content: Buffer.from('---\nbined_at: 2025-10-21\n---\n').toString('base64') })
        // file2 will error (no mock for second file fetch)
      ];

      let callIndex = 0;
      https.request.mockImplementation((options, callback) => {
        if (callIndex === 0) {
          // First call: list directory
          const responseData = mockCalls[callIndex++];
          callback(mockResponse);

          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(responseData);
            if (endCallback) endCallback();
          });
        } else if (callIndex === 1) {
          // Second call: file1 succeeds
          const responseData = mockCalls[callIndex++];
          callback(mockResponse);

          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(responseData);
            if (endCallback) endCallback();
          });
        } else {
          // Third call: file2 errors
          mockRequest.end.mockImplementation(() => {
            const errorCallback = mockRequest.on.mock.calls.find(call => call[0] === 'error')?.[1];
            if (errorCallback) {
              setTimeout(() => errorCallback(new Error('Network error')), 0);
            }
          });
        }

        return mockRequest;
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Should still return both files, file2 with null bined_at
      expect(body.items).toHaveLength(2);
      expect(body.items[0].bined_at).toBe('2025-10-21');
      expect(body.items[1].bined_at).toBeNull();
    });
  });

  describe('POST - Move to bin', () => {
    it('moves post to bin successfully', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: '2025-10-21-test-post.md',
          sha: 'old-sha-123',
          type: 'post'
        })
      };

      const originalContent = `---
title: Test Post
date: 2025-10-21
---
Post content here`;

      const mockCalls = [
        // Get original file
        JSON.stringify({
          content: Buffer.from(originalContent).toString('base64'),
          sha: 'current-sha-456'
        }),
        // Check if exists in bin (404)
        null, // Will error (doesn't exist)
        // Create in bin
        JSON.stringify({ commit: { sha: 'bin-commit-sha' } }),
        // Delete from source
        JSON.stringify({ commit: { sha: 'delete-commit-sha' } })
      ];

      let callIndex = 0;
      https.request.mockImplementation((options, callback) => {
        if (callIndex === 1) {
          // Check bin existence - return 404
          mockResponse.statusCode = 404;
          callback(mockResponse);

          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ message: 'Not Found' }));
            if (endCallback) endCallback();
          });

          mockResponse.statusCode = 200; // Reset
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

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post moved to bin successfully');
      expect(body.commitSha).toBe('bin-commit-sha');
    });

    it('adds bined_at timestamp to frontmatter', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      const originalContent = `---
title: Test
---
Content`;

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          content: Buffer.from(originalContent).toString('base64'),
          sha: 'current-sha'
        })
      });

      // Capture the written content
      let binedContent = '';
      mockRequest.write.mockImplementation((data) => {
        binedContent = data;
      });

      // Mock remaining calls
      let callCount = 0;
      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // Get original file
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from(originalContent).toString('base64'),
              sha: 'current-sha'
            }));
            if (endCallback) endCallback();
          });
        } else if (callCount === 2) {
          // Check bin (404)
          mockResponse.statusCode = 404;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            if (endCallback) endCallback();
          });
          mockResponse.statusCode = 200;
        } else if (callCount === 3) {
          // Create in bin - capture content
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'abc' } }));
            if (endCallback) endCallback();
          });
        } else {
          // Delete from source
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'def' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Verify bined_at was added
      const requestBody = JSON.parse(binedContent);
      const decodedContent = Buffer.from(requestBody.content, 'base64').toString('utf8');
      expect(decodedContent).toContain('bined_at:');
      expect(decodedContent).toMatch(/bined_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('renames file with timestamp if already exists in bin', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'existing-post.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      let capturedPath = '';
      let callCount = 0;

      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // Get original file
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from('---\ntitle: Test\n---\nContent').toString('base64'),
              sha: 'current'
            }));
            if (endCallback) endCallback();
          });
        } else if (callCount === 2) {
          // Check bin - file EXISTS
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              name: 'existing-post.md',
              sha: 'exists'
            }));
            if (endCallback) endCallback();
          });
        } else if (callCount === 3) {
          // Create in bin with renamed file - capture path
          capturedPath = options.path;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'abc' } }));
            if (endCallback) endCallback();
          });
        } else {
          // Delete from source
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'def' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Verify filename was renamed with timestamp
      expect(capturedPath).toContain('_bin/existing-post-');
      expect(capturedPath).toMatch(/_bin\/existing-post-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.md$/);
    });

    it('uses post directory for type=post', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: '2025-10-21-post.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      let sourcePath = '';

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('_posts') || options.path.includes('_pages')) {
          sourcePath = options.path;
        }

        // Simple mock - just track the path
        callback(mockResponse);
        mockRequest.end.mockImplementation(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) {
            if (options.path.includes('_posts')) {
              dataCallback(JSON.stringify({
                content: Buffer.from('---\ntitle: Test\n---\n').toString('base64'),
                sha: 'abc'
              }));
            } else {
              dataCallback(JSON.stringify({ commit: { sha: 'commit' } }));
            }
          }
          if (endCallback) endCallback();
        });

        return mockRequest;
      });

      await handler(event, {});

      expect(sourcePath).toContain('_posts');
    });

    it('uses page directory for type=page', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'about.md',
          sha: 'sha123',
          type: 'page'
        })
      };

      let sourcePath = '';

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('_pages') || options.path.includes('_posts')) {
          sourcePath = options.path;
        }

        callback(mockResponse);
        mockRequest.end.mockImplementation(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) {
            if (options.path.includes('_pages')) {
              dataCallback(JSON.stringify({
                content: Buffer.from('---\ntitle: Test\n---\n').toString('base64'),
                sha: 'abc'
              }));
            } else {
              dataCallback(JSON.stringify({ commit: { sha: 'commit' } }));
            }
          }
          if (endCallback) endCallback();
        });

        return mockRequest;
      });

      await handler(event, {});

      expect(sourcePath).toContain('_pages');
    });

    it('defaults to posts directory when type not specified', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123'
          // type not specified
        })
      };

      let sourcePath = '';

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('_posts') || options.path.includes('_pages')) {
          sourcePath = options.path;
        }

        callback(mockResponse);
        mockRequest.end.mockImplementation(() => {
          const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
          const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

          if (dataCallback) {
            if (options.path.includes('_posts')) {
              dataCallback(JSON.stringify({
                content: Buffer.from('---\ntitle: Test\n---\n').toString('base64'),
                sha: 'abc'
              }));
            } else {
              dataCallback(JSON.stringify({ commit: { sha: 'commit' } }));
            }
          }
          if (endCallback) endCallback();
        });

        return mockRequest;
      });

      await handler(event, {});

      expect(sourcePath).toContain('_posts');
    });

    it('returns 400 when filename is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          sha: 'sha123',
          type: 'post'
          // filename missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required fields');
      expect(body.message).toContain('filename');
    });

    it('returns 400 when sha is missing', async () => {
      const event = {
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          type: 'post'
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
        httpMethod: 'POST',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
    });
  });

  describe('PUT - Restore from bin', () => {
    it('restores post from bin successfully', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: '2025-10-21-restored-post.md',
          sha: 'bin-sha-123',
          type: 'post'
        })
      };

      const binedContent = `---
title: Restored Post
date: 2025-10-21
bined_at: 2025-10-21T10:00:00Z
---
Content`;

      let callCount = 0;

      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // Check if exists in destination (404 - doesn't exist, which is good)
          mockResponse.statusCode = 404;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            if (endCallback) endCallback();
          });
          mockResponse.statusCode = 200;
        } else if (callCount === 2) {
          // Get bined item
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from(binedContent).toString('base64'),
              sha: 'bin-sha-123'
            }));
            if (endCallback) endCallback();
          });
        } else if (callCount === 3) {
          // Restore to destination
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'restore-commit' } }));
            if (endCallback) endCallback();
          });
        } else {
          // Delete from bin
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'delete-commit' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post restored successfully');
      expect(body.commitSha).toBe('restore-commit');
    });

    it('removes bined_at from frontmatter when restoring', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      const binedContent = `---
title: Test
date: 2025-10-21
bined_at: 2025-10-21T10:00:00Z
categories:
  - Tech
---
Content`;

      let restoredContent = '';
      let callCount = 0;

      https.request.mockImplementation((options, callback) => {
        callCount++;

        if (callCount === 1) {
          // Check destination (404)
          mockResponse.statusCode = 404;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            if (endCallback) endCallback();
          });
          mockResponse.statusCode = 200;
        } else if (callCount === 2) {
          // Get bined item
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from(binedContent).toString('base64')
            }));
            if (endCallback) endCallback();
          });
        } else if (callCount === 3) {
          // Restore - capture content
          callback(mockResponse);
          mockRequest.write.mockImplementation((data) => {
            restoredContent = data;
          });
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'abc' } }));
            if (endCallback) endCallback();
          });
        } else {
          // Delete from bin
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'def' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Verify bined_at was removed
      const requestBody = JSON.parse(restoredContent);
      const decodedContent = Buffer.from(requestBody.content, 'base64').toString('utf8');
      expect(decodedContent).not.toContain('bined_at');
      expect(decodedContent).toContain('title: Test');
      expect(decodedContent).toContain('categories:');
    });

    it('auto-detects type from filename when type not provided', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: '2025-10-21-auto-detected-post.md',
          sha: 'sha123'
          // type not provided - should auto-detect as post
        })
      };

      let destPath = '';
      let callCount = 0;

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('_posts') || options.path.includes('_pages')) {
          destPath = options.path;
        }

        callCount++;

        if (callCount === 1) {
          mockResponse.statusCode = 404;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            if (endCallback) endCallback();
          });
          mockResponse.statusCode = 200;
        } else if (callCount === 2) {
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from('---\ntitle: Test\n---\n').toString('base64')
            }));
            if (endCallback) endCallback();
          });
        } else {
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'abc' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Filename starts with YYYY-MM-DD-, so should go to _posts
      expect(destPath).toContain('_posts');
    });

    it('auto-detects page type from filename without date', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: 'about.md',
          sha: 'sha123'
          // type not provided - should auto-detect as page
        })
      };

      let destPath = '';
      let callCount = 0;

      https.request.mockImplementation((options, callback) => {
        if (options.path.includes('_pages') || options.path.includes('_posts')) {
          destPath = options.path;
        }

        callCount++;

        if (callCount === 1) {
          mockResponse.statusCode = 404;
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];
            if (endCallback) endCallback();
          });
          mockResponse.statusCode = 200;
        } else if (callCount === 2) {
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({
              content: Buffer.from('---\ntitle: About\n---\n').toString('base64')
            }));
            if (endCallback) endCallback();
          });
        } else {
          callback(mockResponse);
          mockRequest.end.mockImplementation(() => {
            const dataCallback = mockResponse.on.mock.calls.find(call => call[0] === 'data')?.[1];
            const endCallback = mockResponse.on.mock.calls.find(call => call[0] === 'end')?.[1];

            if (dataCallback) dataCallback(JSON.stringify({ commit: { sha: 'abc' } }));
            if (endCallback) endCallback();
          });
        }

        return mockRequest;
      });

      await handler(event, {});

      // Filename doesn't start with date, so should go to _pages
      expect(destPath).toContain('_pages');
    });

    it('returns 409 when file already exists in destination', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: '2025-10-21-existing.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({
          name: '2025-10-21-existing.md',
          sha: 'already-exists'
        })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(409);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('File already exists');
      expect(body.message).toContain('already exists');
    });

    it('returns 400 when filename is missing', async () => {
      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          sha: 'sha123',
          type: 'post'
          // filename missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('filename');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'PUT',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
    });
  });

  describe('DELETE - Permanent delete', () => {
    it('permanently deletes item from bin', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          filename: '2025-10-21-deleted.md',
          sha: 'bin-sha-123',
          type: 'post'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ commit: { sha: 'delete-commit-sha' } })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.message).toBe('Post permanently deleted');
      expect(body.commitSha).toBe('delete-commit-sha');
    });

    it('sends delete request to bin directory', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123',
          type: 'post'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ commit: { sha: 'abc' } })
      });

      await handler(event, {});

      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.method).toBe('DELETE');
      expect(requestOptions.path).toContain('_bin/test.md');

      const writtenData = mockRequest.write.mock.calls[0][0];
      const requestBody = JSON.parse(writtenData);
      expect(requestBody.message).toContain('Permanently delete');
      expect(requestBody.sha).toBe('sha123');
    });

    it('capitalizes item type in message', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          filename: 'about.md',
          sha: 'sha123',
          type: 'page'
        })
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ commit: { sha: 'abc' } })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.message).toBe('Page permanently deleted');
    });

    it('returns 400 when filename is missing', async () => {
      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          sha: 'sha123'
          // filename missing
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toContain('filename');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'DELETE',
        body: JSON.stringify({
          filename: 'test.md',
          sha: 'sha123'
        })
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
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

    it('includes error details in development mode', async () => {
      process.env.NODE_ENV = 'development';

      const event = {
        httpMethod: 'POST',
        body: 'invalid json{{'
      };

      const response = await handler(event, {});

      const body = JSON.parse(response.body);
      expect(body.stack).toBeDefined();

      delete process.env.NODE_ENV;
    });

    it('hides stack trace in production', async () => {
      process.env.NODE_ENV = 'production';

      const event = {
        httpMethod: 'POST',
        body: 'invalid json'
      };

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
