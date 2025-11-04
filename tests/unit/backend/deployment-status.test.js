/**
 * Unit Tests for Deployment Status Netlify Function
 *
 * Tests GitHub Actions workflow status monitoring.
 * Covers GET operation for checking deployment status by commit SHA.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import https from 'https';

// Mock the https module
vi.mock('https');

describe('Deployment Status Function', () => {
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
    const module = await import('../../../netlify/functions/deployment-status.js');
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
        httpMethod: 'GET',
        queryStringParameters: { sha: 'abc123' }
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

  describe('GET - Check deployment status', () => {
    it('returns pending when no workflow run found', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'abc123def456' }
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [] })
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('pending');
      expect(body.message).toBe('Waiting for deployment to start...');
      expect(body.commitSha).toBe('abc123def456');
    });

    it('returns pending status for pending workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'commit-sha-123' }
      };

      const workflowRun = {
        head_sha: 'commit-sha-123',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'pending',
        html_url: 'https://github.com/mfrench71/circleseven-website/actions/runs/123',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:00:30Z',
        conclusion: null
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('pending');
      expect(body.message).toBe('Deployment pending...');
      expect(body.commitSha).toBe('commit-sha-123');
      expect(body.workflowUrl).toBe('https://github.com/mfrench71/circleseven-website/actions/runs/123');
    });

    it('returns queued status for queued workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'sha-abc' }
      };

      const workflowRun = {
        head_sha: 'sha-abc',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'queued',
        html_url: 'https://github.com/actions/runs/456',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:00:15Z',
        conclusion: null
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('queued');
      expect(body.message).toBe('Deployment queued...');
    });

    it('returns in_progress status for running workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'running-sha' }
      };

      const workflowRun = {
        head_sha: 'running-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'in_progress',
        html_url: 'https://github.com/actions/runs/789',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:02:30Z',
        conclusion: null
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('in_progress');
      expect(body.message).toBe('Deploying to GitHub Pages...');
      expect(body.startedAt).toBe('2025-10-21T10:00:00Z');
      expect(body.updatedAt).toBe('2025-10-21T10:02:30Z');
    });

    it('returns completed status for successful workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'success-sha' }
      };

      const workflowRun = {
        head_sha: 'success-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'completed',
        conclusion: 'success',
        html_url: 'https://github.com/actions/runs/999',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:05:00Z'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('completed');
      expect(body.message).toBe('Deployment completed successfully');
      expect(body.conclusion).toBe('success');
    });

    it('returns failed status for failed workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'failed-sha' }
      };

      const workflowRun = {
        head_sha: 'failed-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'completed',
        conclusion: 'failure',
        html_url: 'https://github.com/actions/runs/111',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:03:00Z'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('failed');
      expect(body.message).toBe('Deployment failed');
      expect(body.conclusion).toBe('failure');
    });

    it('returns cancelled status for cancelled workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'cancelled-sha' }
      };

      const workflowRun = {
        head_sha: 'cancelled-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'completed',
        conclusion: 'cancelled',
        html_url: 'https://github.com/actions/runs/222',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:01:00Z'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('cancelled');
      expect(body.message).toBe('Deployment cancelled');
    });

    it('returns skipped status for skipped workflow', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'skipped-sha' }
      };

      const workflowRun = {
        head_sha: 'skipped-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'completed',
        conclusion: 'skipped',
        html_url: 'https://github.com/actions/runs/333',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:00:30Z'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('skipped');
      expect(body.message).toBe('Deployment skipped (superseded by newer commit)');
    });

    it('handles unknown conclusion gracefully', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'unknown-sha' }
      };

      const workflowRun = {
        head_sha: 'unknown-sha',
        name: 'Deploy Jekyll site to GitHub Pages',
        status: 'completed',
        conclusion: 'timed_out',
        html_url: 'https://github.com/actions/runs/444',
        created_at: '2025-10-21T10:00:00Z',
        updated_at: '2025-10-21T10:15:00Z'
      };

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: [workflowRun] })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('completed');
      expect(body.message).toContain('timed_out');
    });

    it('filters workflow runs by commit SHA', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'target-sha' }
      };

      const workflowRuns = [
        {
          head_sha: 'different-sha-1',
          name: 'Deploy Jekyll site to GitHub Pages',
          status: 'completed'
        },
        {
          head_sha: 'target-sha', // This one matches
          name: 'Deploy Jekyll site to GitHub Pages',
          status: 'in_progress',
          html_url: 'https://github.com/actions/runs/555',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:01:00Z',
          conclusion: null
        },
        {
          head_sha: 'different-sha-2',
          name: 'Deploy Jekyll site to GitHub Pages',
          status: 'completed'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.commitSha).toBe('target-sha');
      expect(body.status).toBe('in_progress');
    });

    it('filters workflow runs by workflow name', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'sha-123' }
      };

      const workflowRuns = [
        {
          head_sha: 'sha-123',
          name: 'Different Workflow', // Wrong workflow name
          status: 'completed'
        },
        {
          head_sha: 'sha-123',
          name: 'Deploy Jekyll site to GitHub Pages', // Correct workflow name
          status: 'in_progress',
          html_url: 'https://github.com/actions/runs/666',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:01:00Z',
          conclusion: null
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      expect(body.status).toBe('in_progress');
      expect(body.workflowUrl).toBe('https://github.com/actions/runs/666');
    });

    it('returns most recent run when multiple matches exist', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'multi-sha' }
      };

      const workflowRuns = [
        {
          head_sha: 'multi-sha',
          name: 'Deploy Jekyll site to GitHub Pages',
          status: 'completed',
          conclusion: 'success',
          html_url: 'https://github.com/actions/runs/777',
          created_at: '2025-10-21T10:00:00Z',
          updated_at: '2025-10-21T10:05:00Z'
        },
        {
          head_sha: 'multi-sha',
          name: 'Deploy Jekyll site to GitHub Pages',
          status: 'completed',
          conclusion: 'failure',
          html_url: 'https://github.com/actions/runs/888',
          created_at: '2025-10-21T09:55:00Z',
          updated_at: '2025-10-21T10:00:00Z'
        }
      ];

      setupGitHubMock({
        statusCode: 200,
        body: JSON.stringify({ workflow_runs: workflowRuns })
      });

      const response = await handler(event, {});
      const body = JSON.parse(response.body);

      // Should return the first one (most recent)
      expect(body.workflowUrl).toBe('https://github.com/actions/runs/777');
      expect(body.status).toBe('completed');
      expect(body.conclusion).toBe('success');
    });

    it('makes request to GitHub with correct path', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'test-sha' }
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

    it('returns 400 when sha parameter is missing', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {}
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Missing required parameter');
      expect(body.message).toContain('sha');
    });

    it('returns 503 when GITHUB_TOKEN is missing', async () => {
      delete process.env.GITHUB_TOKEN;

      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'test-sha' }
      };

      const response = await handler(event, {});

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('GitHub integration not configured');
      expect(body.message).toContain('GITHUB_TOKEN');
    });

    it('handles GitHub API errors', async () => {
      const event = {
        httpMethod: 'GET',
        queryStringParameters: { sha: 'test-sha' }
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
        httpMethod: 'GET',
        queryStringParameters: { sha: 'test' }
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
        httpMethod: 'GET',
        queryStringParameters: { sha: 'test' }
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
