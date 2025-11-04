/**
 * Mock Data for Tests
 *
 * Provides sample data for testing various modules.
 */

export const mockAdminSettings = {
  deployment_poll_interval: 10000,
  deployment_history_poll_interval: 30000,
  deployment_timeout: 600,
  fetch_timeout: 30000,
  debounce_delay: 300,
};

export const mockSiteSettings = {
  title: 'Circle Seven',
  author: 'Matthew French',
  email: 'test@example.com',
  github_username: 'mfrench71',
  paginate: 10,
  related_posts_count: 3,
  timezone: 'Europe/London',
  lang: 'en-GB',
  description: 'Portfolio and blog of Matthew French',
};

export const mockPost = {
  filename: '2024-01-15-test-post.md',
  frontmatter: {
    title: 'Test Post',
    date: '2024-01-15T10:00:00Z',
    categories: ['Technology'],
    tags: ['testing', 'development'],
    image: 'https://res.cloudinary.com/test/test.jpg',
  },
  content: '# Test Content\n\nThis is a test post.',
};

export const mockPage = {
  filename: 'about.md',
  frontmatter: {
    title: 'About',
    permalink: '/about/',
    layout: 'page',
    date: '2024-01-01T10:00:00Z',
    protected: false,
  },
  content: '# About Page\n\nThis is the about page.',
};

export const mockProtectedPage = {
  filename: 'home.md',
  frontmatter: {
    title: 'Home',
    permalink: '/',
    layout: 'page',
    date: '2024-01-01T10:00:00Z',
    protected: true,
  },
  content: '# Home Page\n\nThis is the home page.',
};

export const mockCategories = [
  { name: 'Technology' },
  { name: 'Design' },
  { name: 'Business' },
];

export const mockTags = [
  { name: 'javascript' },
  { name: 'css' },
  { name: 'testing' },
  { name: 'performance' },
];

export const mockTaxonomy = {
  categories: mockCategories,
  tags: mockTags,
};

export const mockDeployment = {
  commitSha: 'abc123def456',
  message: 'Update site settings',
  timestamp: Date.now(),
  status: 'building',
  files: ['_config.yml'],
};

/**
 * Creates a mock Response object for fetch mocking
 * @param {*} data - Data to return
 * @param {number} status - HTTP status code
 * @returns {Response}
 */
export function mockResponse(data, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

/**
 * Creates a mock fetch function
 * @param {*} responseData - Data to return
 * @param {number} status - HTTP status code
 * @returns {Function}
 */
export function mockFetch(responseData, status = 200) {
  return vi.fn(() => Promise.resolve(mockResponse(responseData, status)));
}

/**
 * Parses frontmatter from markdown content (for testing)
 * @param {string} content - Markdown with frontmatter
 * @returns {Object}
 */
export function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, content };
  }

  const [, frontmatterText, body] = match;
  const frontmatter = {};

  frontmatterText.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length) {
      const value = valueParts.join(':').trim();
      // Handle arrays
      if (value.startsWith('[') && value.endsWith(']')) {
        frontmatter[key.trim()] = JSON.parse(value);
      }
      // Handle booleans
      else if (value === 'true' || value === 'false') {
        frontmatter[key.trim()] = value === 'true';
      }
      // Handle numbers
      else if (!isNaN(value)) {
        frontmatter[key.trim()] = Number(value);
      }
      // String
      else {
        frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '');
      }
    }
  });

  return { frontmatter, content: body.trim() };
}
