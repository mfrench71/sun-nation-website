/**
 * Unit Tests for Deployment History Netlify Function
 *
 * Tests retrieval of recent GitHub Actions workflow runs.
 * Covers GET operation for deployment history dashboard display.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Deployment History Function', () => {
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
    const module = await import('../../../netlify/functions/deployment-history.js');
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

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [] })
      });

      const response = await handler(event, {});

      expect(response.headers['Access-Control-Allow-Origin']).toBe('*');
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('GET - Retrieve deployment history', () => {
    it('retrieves and formats workflow runs', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRuns = [
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'abc123',
          display_title: 'Update taxonomy from custom admin',
          status: 'completed',
          conclusion: 'success',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:05:00Z',
          html_url: 'https://github.com/actions/runs/123'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'def456',
          display_title: 'Create post: 2025-10-20-new-post.md',
          status: 'in_progress',
          conclusion: null,
          created_at: '2025-10-21T10:10:00Z',
          updated_at: '2025-10-21T10:12:00Z',
          html_url: 'https://github.com/actions/runs/124'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deployments).toHaveLength(2);
      expect(body.deployments[0].commitSha).toBe('abc123');
      expect(body.deployments[0].action).toBe('Update taxonomy from custom admin');
      expect(body.deployments[0].status).toBe('completed');
      expect(body.deployments[1].status).toBe('in_progress');
    });

    it('filters workflow runs by workflow name', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRuns = [
        {
          name: 'Deploy Jekyll site to GitHub Pages', // Correct workflow
          head_sha: 'sha1',
          display_title: 'Test 1',
          status: 'completed',
          conclusion: 'success',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:05:00Z',
          html_url: 'https://github.com/actions/runs/1'
        },
        {
          name: 'Different Workflow', // Wrong workflow - should be filtered
          head_sha: 'sha2',
          display_title: 'Test 2',
          status: 'completed',
          conclusion: 'success',
          created_at: '2025-10-21T10:05:00Z',
          updated_at: '2025-10-21T10:10:00Z',
          html_url: 'https://github.com/actions/runs/2'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages', // Correct workflow
          head_sha: 'sha3',
          display_title: 'Test 3',
          status: 'in_progress',
          conclusion: null,
          created_at: '2025-10-21T10:15:00Z',
          updated_at: '2025-10-21T10:16:00Z',
          html_url: 'https://github.com/actions/runs/3'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Should only include 2 deployments (filtered out "Different Workflow")
      expect(body.deployments).toHaveLength(2);
      expect(body.deployments[0].commitSha).toBe('sha1');
      expect(body.deployments[1].commitSha).toBe('sha3');
    });

    it('maps status correctly for completed workflows', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRuns = [
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'success-sha',
          display_title: 'Success',
          status: 'completed',
          conclusion: 'success',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:05:00Z',
          html_url: 'https://github.com/actions/runs/1'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'failure-sha',
          display_title: 'Failure',
          status: 'completed',
          conclusion: 'failure',
          created_at: '2025-10-21T10:10:00Z',
          updated_at: '2025-10-21T10:15:00Z',
          html_url: 'https://github.com/actions/runs/2'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'cancelled-sha',
          display_title: 'Cancelled',
          status: 'completed',
          conclusion: 'cancelled',
          created_at: '2025-10-21T10:20:00Z',
          updated_at: '2025-10-21T10:21:00Z',
          html_url: 'https://github.com/actions/runs/3'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'skipped-sha',
          display_title: 'Skipped',
          status: 'completed',
          conclusion: 'skipped',
          created_at: '2025-10-21T10:25:00Z',
          updated_at: '2025-10-21T10:26:00Z',
          html_url: 'https://github.com/actions/runs/4'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].status).toBe('completed');
      expect(body.deployments[1].status).toBe('failed');
      expect(body.deployments[2].status).toBe('cancelled');
      expect(body.deployments[3].status).toBe('skipped');
    });

    it('maps status correctly for in-progress workflows', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRuns = [
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'pending-sha',
          display_title: 'Pending',
          status: 'pending',
          conclusion: null,
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:00:10Z',
          html_url: 'https://github.com/actions/runs/1'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'queued-sha',
          display_title: 'Queued',
          status: 'queued',
          conclusion: null,
          created_at: '2025-10-21T10:05:00Z',
          updated_at: '2025-10-21T10:05:05Z',
          html_url: 'https://github.com/actions/runs/2'
        },
        {
          name: 'Deploy Jekyll site to GitHub Pages',
          head_sha: 'inprogress-sha',
          display_title: 'In Progress',
          status: 'in_progress',
          conclusion: null,
          created_at: '2025-10-21T10:10:00Z',
          updated_at: '2025-10-21T10:12:00Z',
          html_url: 'https://github.com/actions/runs/3'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].status).toBe('pending');
      expect(body.deployments[1].status).toBe('queued');
      expect(body.deployments[2].status).toBe('in_progress');
    });

    it('calculates duration correctly', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'sha',
        display_title: 'Test',
        status: 'completed',
        conclusion: 'success',
        created_at: '2025-10-21T10:00:00.000Z',
        updated_at: '2025-10-21T10:05:00.000Z', // 5 minutes = 300 seconds
        html_url: 'https://github.com/actions/runs/1'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].duration).toBe(300);
    });

    it('sets duration to null for in-progress workflows without updated_at', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'sha',
        display_title: 'Test',
        status: 'queued',
        conclusion: null,
        created_at: '2025-10-21T10:00:00Z',
        updated_at: null,
        html_url: 'https://github.com/actions/runs/1'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].duration).toBeNull();
    });

    it('uses display_title for action description', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'sha',
        display_title: 'Update site settings from custom admin',
        status: 'completed',
        conclusion: 'success',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:05:00Z',
        html_url: 'https://github.com/actions/runs/1'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].action).toBe('Update site settings from custom admin');
    });

    it('uses default action when display_title missing', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'sha',
        display_title: null,
        status: 'completed',
        conclusion: 'success',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:05:00Z',
        html_url: 'https://github.com/actions/runs/1'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].action).toBe('Deploy site');
    });

    it('includes all required fields in deployment objects', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'test-sha-123',
        display_title: 'Test deployment',
        status: 'in_progress',
        conclusion: null,
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:02:00Z',
        html_url: 'https://github.com/actions/runs/999'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      const deployment = body.deployments[0];
      expect(deployment).toHaveProperty('commitSha');
      expect(deployment).toHaveProperty('action');
      expect(deployment).toHaveProperty('itemId');
      expect(deployment).toHaveProperty('status');
      expect(deployment).toHaveProperty('startedAt');
      expect(deployment).toHaveProperty('completedAt');
      expect(deployment).toHaveProperty('duration');
      expect(deployment).toHaveProperty('workflowUrl');
    });

    it('sets itemId to null (not tracked by GitHub)', async () => {
      const event = {
        httpMethod: 'GET'
      };

      const workflowRun = {
        name: 'Deploy Jekyll site to GitHub Pages',
        head_sha: 'sha',
        display_title: 'Test',
        status: 'completed',
        conclusion: 'success',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:05:00Z',
        html_url: 'https://github.com/actions/runs/1'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.deployments[0].itemId).toBeNull();
    });

    it('returns empty array when no workflow runs exist', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [] })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.deployments).toEqual([]);
    });

    it('makes request to GitHub with correct path', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [] })
      });

      await handler(event, {});

      expect(https.request).toHaveBeenCalled();
      const requestOptions = https.request.mock.calls[0][0];
      expect(requestOptions.hostname).toBe('api.github.com');
      expect(requestOptions.path).toContain('/repos/mfrench71/circleseven-website/actions/runs');
      expect(requestOptions.path).toContain('per_page=20');
      expect(requestOptions.path).toContain('branch=main');
      expect(requestOptions.method).toBe('GET');
      expect(requestOptions.headers['Authorization']).toBe('token test-github-token-12345');
    });

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

    it('handles GitHub API errors', async () => {
      const event = {
        httpMethod: 'GET'
      };

      setupGitHubMock({
        statusCode: 403,
        body: JSON.stringify({ message: 'Rate limit exceeded' })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal server error');
      expect(body.message).toContain('403');
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

  // Helper function
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
