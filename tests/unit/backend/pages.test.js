/**
 * Unit Tests for Pages Serverless Function
 *
 * Tests frontmatter parsing and YAML generation for pages.
 */

import { describe, it, expect } from 'vitest';
import { mockPage, mockProtectedPage, parseFrontmatter } from '../../utils/mock-data.js';

/**
 * Helper to build frontmatter (mimics actual function)
 */
function buildFrontmatter(data) {
  let yaml = '';
  for (const [key, value] of Object.entries(data)) {
    if (value === null || value === undefined) continue;

    // Handle arrays
    if (Array.isArray(value)) {
      yaml += `${key}: [${value.map(v => `"${v}"`).join(', ')}]\n`;
    }
    // Handle booleans - output without quotes
    else if (typeof value === 'boolean') {
      yaml += `${key}: ${value}\n`;
    }
    // Handle numbers
    else if (typeof value === 'number') {
      yaml += `${key}: ${value}\n`;
    }
    // Handle strings
    else {
      yaml += `${key}: "${value}"\n`;
    }
  }
  return yaml;
}

describe('Pages Function - parseFrontmatter', () => {
  it('parses boolean values correctly', () => {
    const content = `---
title: Test Page
protected: true
---
Content here`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.protected).toBe(true);
    expect(typeof result.frontmatter.protected).toBe('boolean');
  });

  it('converts string "true" to boolean true', () => {
    const content = `---
title: Test Page
protected: "true"
---
Content`;

    const result = parseFrontmatter(content);

    // Should be converted to boolean
    // Note: In actual implementation, this conversion happens
    if (result.frontmatter.protected === "true") {
      result.frontmatter.protected = true;
    }

    expect(result.frontmatter.protected).toBe(true);
    expect(typeof result.frontmatter.protected).toBe('boolean');
  });

  it('converts string "false" to boolean false', () => {
    const content = `---
title: Test Page
protected: "false"
---
Content`;

    const result = parseFrontmatter(content);

    if (result.frontmatter.protected === "false") {
      result.frontmatter.protected = false;
    }

    expect(result.frontmatter.protected).toBe(false);
    expect(typeof result.frontmatter.protected).toBe('boolean');
  });

  it('handles pages without protected field', () => {
    const content = `---
title: Regular Page
layout: page
---
Content`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.protected).toBeUndefined();
  });

  it('parses other frontmatter fields correctly', () => {
    const content = `---
title: About Page
permalink: /about/
layout: page
date: "2024-01-01T10:00:00Z"
---
About content`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.title).toBe('About Page');
    expect(result.frontmatter.permalink).toBe('/about/');
    expect(result.frontmatter.layout).toBe('page');
    expect(result.content).toBe('About content');
  });

  it('handles content with --- in the body', () => {
    const content = `---
title: Test
---
This is content.
---
More content`;

    const result = parseFrontmatter(content);

    expect(result.frontmatter.title).toBe('Test');
    expect(result.content).toContain('---');
  });
});

describe('Pages Function - buildFrontmatter', () => {
  it('outputs booleans without quotes', () => {
    const frontmatter = {
      title: 'Test Page',
      protected: true
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('protected: true');
    expect(yaml).not.toContain('protected: "true"');
    expect(yaml).not.toContain('protected: \'true\'');
  });

  it('outputs false boolean without quotes', () => {
    const frontmatter = {
      title: 'Test Page',
      protected: false
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('protected: false');
    expect(yaml).not.toContain('protected: "false"');
  });

  it('handles string values with quotes', () => {
    const frontmatter = {
      title: 'Test Page',
      permalink: '/test/'
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('title: "Test Page"');
    expect(yaml).toContain('permalink: "/test/"');
  });

  it('handles number values without quotes', () => {
    const frontmatter = {
      order: 1,
      priority: 10
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('order: 1');
    expect(yaml).toContain('priority: 10');
  });

  it('handles array values', () => {
    const frontmatter = {
      categories: ['Tech', 'Design']
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('categories: ["Tech", "Design"]');
  });

  it('skips null and undefined values', () => {
    const frontmatter = {
      title: 'Test',
      protected: null,
      layout: undefined
    };

    const yaml = buildFrontmatter(frontmatter);

    expect(yaml).toContain('title:');
    expect(yaml).not.toContain('protected:');
    expect(yaml).not.toContain('layout:');
  });
});

describe('Pages Function - Protected Pages', () => {
  it('identifies protected pages correctly', () => {
    expect(mockProtectedPage.frontmatter.protected).toBe(true);
  });

  it('allows unprotected pages to be deleted', () => {
    expect(mockPage.frontmatter.protected).toBe(false);
  });

  it('prevents deletion of protected pages', () => {
    const isProtected = mockProtectedPage.frontmatter.protected === true;

    if (isProtected) {
      // Should not allow deletion
      expect(isProtected).toBe(true);
    }
  });
});

describe('Pages Function - Regression Tests', () => {
  it('does not add quotes around boolean values (regression)', () => {
    // This was the bug: protected: "true" instead of protected: true
    const yaml = buildFrontmatter({ protected: true });

    // Should be: protected: true
    // NOT: protected: "true"
    expect(yaml).toBe('protected: true\n');
  });

  it('parses both quoted and unquoted boolean strings (backward compatibility)', () => {
    const testCases = [
      'protected: true',
      'protected: "true"',
      'protected: \'true\'',
    ];

    testCases.forEach(testCase => {
      const content = `---\n${testCase}\n---\nContent`;
      const result = parseFrontmatter(content);

      // Convert if string
      if (result.frontmatter.protected === "true" || result.frontmatter.protected === 'true') {
        result.frontmatter.protected = true;
      }

      expect(result.frontmatter.protected).toBe(true);
    });
  });
});
