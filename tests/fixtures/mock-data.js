/**
 * Mock Data for E2E Tests
 *
 * Provides realistic test data for GitHub API responses to avoid
 * requiring actual GitHub API credentials during testing.
 */

export const mockPosts = [
  {
    name: '2025-10-20-test-post-1.md',
    path: '_posts/2025-10-20-test-post-1.md',
    sha: 'abc123',
    size: 1234,
    frontmatter: {
      title: 'Test Post 1',
      date: '2025-10-20 12:00:00 +0000',
      categories: ['Technology', 'JavaScript'],
      tags: ['testing', 'playwright'],
      layout: 'post',
      image: 'https://res.cloudinary.com/circleseven/image/upload/test.jpg'
    }
  },
  {
    name: '2025-10-19-test-post-2.md',
    path: '_posts/2025-10-19-test-post-2.md',
    sha: 'def456',
    size: 2345,
    frontmatter: {
      title: 'Test Post 2',
      date: '2025-10-19 10:00:00 +0000',
      categories: ['Photography'],
      tags: ['art'],
      layout: 'post'
    }
  }
];

export const mockPages = [
  {
    name: 'about.md',
    path: '_pages/about.md',
    sha: 'ghi789',
    size: 567,
    frontmatter: {
      title: 'About',
      permalink: '/about/',
      layout: 'page'
    }
  },
  {
    name: 'contact.md',
    path: '_pages/contact.md',
    sha: 'jkl012',
    size: 432,
    frontmatter: {
      title: 'Contact',
      permalink: '/contact/',
      layout: 'page',
      protected: true
    }
  }
];

export const mockTaxonomy = {
  categories: [
    'Technology',
    'Photography',
    'JavaScript',
    'Projects',
    'Academic'
  ],
  tags: [
    'testing',
    'playwright',
    'art',
    'coding',
    'tutorial'
  ]
};

export const mockDeploymentStatus = {
  status: 'success',
  conclusion: 'success',
  workflow_name: 'Jekyll CI/CD',
  started_at: new Date(Date.now() - 300000).toISOString(),
  completed_at: new Date().toISOString(),
  html_url: 'https://github.com/mfrench71/circleseven-website/actions/runs/123456'
};

export const mockDeploymentHistory = [
  {
    id: 123456,
    status: 'completed',
    conclusion: 'success',
    workflow_name: 'Jekyll CI/CD',
    created_at: new Date(Date.now() - 3600000).toISOString(),
    html_url: 'https://github.com/mfrench71/circleseven-website/actions/runs/123456',
    head_commit: {
      message: 'Update post content'
    }
  },
  {
    id: 123455,
    status: 'completed',
    conclusion: 'success',
    workflow_name: 'Jekyll CI/CD',
    created_at: new Date(Date.now() - 7200000).toISOString(),
    html_url: 'https://github.com/mfrench71/circleseven-website/actions/runs/123455',
    head_commit: {
      message: 'Add new post'
    }
  }
];

export const mockRateLimit = {
  rate: {
    limit: 5000,
    remaining: 4850,
    reset: Math.floor(Date.now() / 1000) + 3600,
    used: 150
  }
};

export const mockTrashItems = [
  {
    type: 'post',
    path: '_trash/posts/2025-10-15-deleted-post.md',
    originalPath: '_posts/2025-10-15-deleted-post.md',
    deletedAt: new Date(Date.now() - 86400000).toISOString(),
    sha: 'trash123',
    frontmatter: {
      title: 'Deleted Post',
      date: '2025-10-15 12:00:00 +0000'
    }
  }
];

export const mockSettings = {
  title: 'Circle Seven',
  description: 'Test site description',
  url: 'https://circleseven.co.uk',
  email: 'mail@circleseven.co.uk',
  author: 'Matthew French',
  timezone: 'Europe/London',
  paginate: 10,
  related_posts_count: 3
};

export const mockMedia = {
  resources: [
    {
      public_id: 'test-image-1',
      format: 'jpg',
      width: 1920,
      height: 1080,
      bytes: 234567,
      url: 'https://res.cloudinary.com/circleseven/image/upload/test-image-1.jpg',
      secure_url: 'https://res.cloudinary.com/circleseven/image/upload/test-image-1.jpg',
      created_at: new Date(Date.now() - 86400000).toISOString()
    },
    {
      public_id: 'test-image-2',
      format: 'png',
      width: 1024,
      height: 768,
      bytes: 123456,
      url: 'https://res.cloudinary.com/circleseven/image/upload/test-image-2.png',
      secure_url: 'https://res.cloudinary.com/circleseven/image/upload/test-image-2.png',
      created_at: new Date(Date.now() - 172800000).toISOString()
    }
  ],
  next_cursor: null
};
