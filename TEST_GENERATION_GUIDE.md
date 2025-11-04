# Automatic Test Generation Guide

## How to Request Tests During Development

I can automatically generate comprehensive tests as you develop new features. Here's how:

## 🔄 Test Generation Workflow

### Pattern 1: After Writing Code

**You say:**
> "I just added a new function `validateEmail()` in utils.js. Generate tests for it."

**I will:**
1. Read the new code
2. Identify edge cases
3. Generate unit tests
4. Create test file in correct location
5. Run tests to verify they pass

### Pattern 2: Before Writing Code (TDD)

**You say:**
> "I want to add password validation. Generate tests first."

**I will:**
1. Create test file with expected behavior
2. Tests will fail (red)
3. You write the implementation
4. Tests pass (green)

### Pattern 3: For Bug Fixes

**You say:**
> "Bug: Users can submit empty forms. Add a test that would have caught this, then fix it."

**I will:**
1. Write a failing test that reproduces the bug
2. Fix the code
3. Verify test now passes

### Pattern 4: Bulk Generation

**You say:**
> "Generate tests for all functions in admin-custom/js/core/utils.js"

**I will:**
1. Analyze all exported functions
2. Generate comprehensive test suite
3. Include edge cases, errors, happy paths

## 📋 What to Tell Me

For best results, provide:

### Minimal (I'll infer the rest)
```
"Add tests for the new deployment tracking feature"
```

### Better (More specific)
```
"Add tests for deployments.js:
- Test startDeploymentPolling()
- Test deployment timeout handling
- Test status updates"
```

### Best (Very specific)
```
"Add tests for deployments.js startDeploymentPolling():
- Should poll every 10 seconds
- Should stop after timeout
- Should update UI on status change
- Should handle network errors gracefully
- Should cleanup on unmount"
```

## 🎯 Test Types I Can Generate

### 1. Unit Tests
- Individual function testing
- Mocked dependencies
- Fast execution

**Example request:**
> "Generate unit tests for parseMarkdown() function"

### 2. Integration Tests
- Multiple modules working together
- Minimal mocking
- Real-ish scenarios

**Example request:**
> "Generate integration tests for the settings save flow"

### 3. E2E Tests
- Full user workflows
- Browser automation
- End-to-end scenarios

**Example request:**
> "Generate E2E test for creating and publishing a blog post"

### 4. Regression Tests
- Prevent bugs from returning
- Based on actual bugs

**Example request:**
> "We fixed the ID mismatch bug. Generate a regression test."

## 🚀 Quick Commands

### After Adding a Feature
```
"I added [feature name]. Generate tests."
```

### After Fixing a Bug
```
"I fixed [bug description]. Add regression test."
```

### For Existing Code
```
"Generate tests for [file/module/function]"
```

### For New Code (TDD)
```
"I want to add [feature]. Write tests first."
```

## 📁 Where Tests Go

I'll automatically put tests in the right location:

```
Frontend code:     tests/unit/frontend/
Backend code:      tests/unit/backend/
Integration:       tests/integration/
E2E:              tests/e2e/
```

## 🔍 What I Test Automatically

### For Functions
- ✅ Happy path (normal usage)
- ✅ Edge cases (empty input, null, undefined)
- ✅ Error cases (invalid input, exceptions)
- ✅ Return values
- ✅ Side effects

### For UI Components
- ✅ Renders correctly
- ✅ Handles user interactions
- ✅ Shows error states
- ✅ Displays loading states
- ✅ Accessibility (ARIA labels)

### For API Functions
- ✅ Success responses
- ✅ Error responses
- ✅ Network failures
- ✅ Timeout handling
- ✅ Data validation

### For Forms
- ✅ Validation rules
- ✅ Submit handling
- ✅ Error messages
- ✅ Success states
- ✅ Field prepopulation

## 💡 Examples

### Example 1: New Utility Function

**Your code:**
```javascript
// admin-custom/js/core/utils.js
export function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');
}
```

**You say:**
> "Generate tests for the new slugify function"

**I generate:**
```javascript
// tests/unit/frontend/utils.test.js
import { describe, it, expect } from 'vitest';
import { slugify } from '@/core/utils.js';

describe('slugify', () => {
  it('converts text to lowercase', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('foo bar baz')).toBe('foo-bar-baz');
  });

  it('removes special characters', () => {
    expect(slugify('Hello! World?')).toBe('hello-world');
  });

  it('handles multiple spaces', () => {
    expect(slugify('hello    world')).toBe('hello-world');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles unicode characters', () => {
    expect(slugify('Café résumé')).toBe('caf-rsum');
  });
});
```

### Example 2: API Integration

**Your code:**
```javascript
// admin-custom/js/api/posts.js
export async function publishPost(postId) {
  const response = await fetch(`/api/posts/${postId}/publish`, {
    method: 'POST'
  });

  if (!response.ok) {
    throw new Error('Failed to publish post');
  }

  return response.json();
}
```

**You say:**
> "Add tests for publishPost API function"

**I generate:**
```javascript
// tests/unit/frontend/posts-api.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { publishPost } from '@/api/posts.js';

describe('publishPost', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it('makes POST request to correct endpoint', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true })
    });

    await publishPost('post-123');

    expect(fetch).toHaveBeenCalledWith(
      '/api/posts/post-123/publish',
      { method: 'POST' }
    );
  });

  it('returns response data on success', async () => {
    const mockData = { success: true, id: 'post-123' };
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => mockData
    });

    const result = await publishPost('post-123');

    expect(result).toEqual(mockData);
  });

  it('throws error on failed response', async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      status: 500
    });

    await expect(publishPost('post-123'))
      .rejects.toThrow('Failed to publish post');
  });

  it('handles network errors', async () => {
    global.fetch.mockRejectedValue(new Error('Network error'));

    await expect(publishPost('post-123'))
      .rejects.toThrow('Network error');
  });
});
```

### Example 3: E2E User Flow

**You say:**
> "Generate E2E test for the complete post creation workflow"

**I generate:**
```javascript
// tests/e2e/create-post.spec.js
import { test, expect } from '@playwright/test';

test.describe('Create Post Workflow', () => {
  test('user can create and publish a post', async ({ page }) => {
    // Login (assuming auth is handled)
    await page.goto('/admin-custom/');

    // Navigate to posts
    await page.click('#nav-posts');

    // Click add post
    await page.click('button:has-text("Add Post")');

    // Fill in post details
    await page.fill('#post-title', 'My Test Post');
    await page.fill('#post-content', '# Test Content\n\nThis is a test.');

    // Add category
    await page.click('#categories-input');
    await page.fill('#categories-input', 'Technology');
    await page.click('text="Technology"');

    // Save post
    await page.click('button:has-text("Save Post")');

    // Verify success
    await expect(page.locator('#success')).toBeVisible();
    await expect(page.locator('#success'))
      .toContainText('Post saved successfully');

    // Verify post appears in list
    await page.click('button:has-text("Back to Posts")');
    await expect(page.locator('text="My Test Post"')).toBeVisible();
  });
});
```

## 🎨 Advanced Patterns

### Generate Tests for Entire Module

**You say:**
> "Analyze admin-custom/js/modules/taxonomy.js and generate complete test coverage"

**I will:**
1. Read the entire module
2. Identify all exported functions
3. Analyze dependencies
4. Generate tests for each function
5. Include integration tests for module interactions
6. Aim for >90% coverage

### Generate Tests from User Story

**You say:**
> "User story: As an admin, I want to bulk delete posts so I can clean up old content. Generate tests."

**I will:**
1. Break down into test scenarios
2. Write E2E tests for the workflow
3. Write unit tests for bulk delete logic
4. Write integration tests for UI updates
5. Include error handling tests

### Generate Tests from Bug Report

**You say:**
> "Bug: When editing a protected page, the delete button should be disabled but it's clickable. Generate regression test."

**I will:**
1. Write a test that reproduces the bug
2. Verify test fails with current code
3. Suggest the fix
4. Verify test passes after fix

## ⚙️ Configuration

### Test Coverage Goals

You can adjust coverage targets in `vitest.config.js`:
```javascript
coverage: {
  lines: 80,      // Increase to 90 for critical code
  functions: 80,
  branches: 75,
  statements: 80,
}
```

### Test Patterns

Common patterns I follow:
- **AAA**: Arrange, Act, Assert
- **Given-When-Then**: BDD style
- **Happy path first**: Then edge cases
- **One assertion per test**: Clear failures

## 🔄 Continuous Generation

### During Feature Development

```
You: "I'm adding a new feature to export posts as PDF"
Me: "Great! Let me create the test structure first..."
[Generates test files with test cases]
You: [Implement the feature]
Me: "Let's run the tests and see what passes"
[Tests guide the implementation]
```

### During Code Review

```
You: "Review this pull request and add any missing tests"
Me: [Analyzes code changes]
Me: [Identifies untested scenarios]
Me: [Generates additional tests]
```

### During Refactoring

```
You: "I'm refactoring the deployment module. Make sure tests still cover everything."
Me: [Runs existing tests]
Me: [Identifies gaps in coverage]
Me: [Generates additional tests for new code paths]
```

## 📊 Measuring Success

After I generate tests, you can check:

```bash
# Coverage report
npm run test:coverage

# Should see:
Coverage: 85.6% Lines | 82.3% Branches | 87.2% Functions
```

## 🚨 When to Request Tests

### Always Request
- ✅ New features
- ✅ Bug fixes
- ✅ API changes
- ✅ Complex logic

### Consider Requesting
- 🤔 Simple utilities (if time permits)
- 🤔 UI tweaks (E2E might be overkill)
- 🤔 Configuration changes

### Don't Need Tests
- ❌ CSS-only changes
- ❌ Documentation updates
- ❌ Comment additions

## 💬 Example Conversations

### Conversation 1: New Feature
```
You: "I want to add a feature to schedule posts for future publication"
Me: "Great! Let me start with tests. I'll create tests for:
     1. Scheduling a post for a future date
     2. Validating the date is in the future
     3. Not publishing before scheduled time
     4. Auto-publishing when time arrives

     Should I proceed?"
You: "Yes, and also test timezone handling"
Me: [Generates comprehensive test suite]
Me: "Tests created! Now implement the feature to make them pass."
```

### Conversation 2: Bug Fix
```
You: "Bug found: Settings don't save when server is slow"
Me: "Let me write a test that reproduces this with a slow server response..."
[Generates test with timeout simulation]
Me: "Test fails as expected. Now let's fix it with a loading state."
[Fixes code]
Me: "Test now passes! Also added tests for other timeout scenarios."
```

### Conversation 3: Refactoring
```
You: "I'm splitting taxonomy.js into smaller modules"
Me: "Let me run existing tests first..."
[Runs tests - all pass]
Me: "Good! Tests pass. After refactoring, let me update test imports..."
[You refactor]
You: "Done refactoring"
Me: [Updates test imports, runs tests]
Me: "All tests still pass! Refactoring successful."
```

## 🎯 Best Practices

1. **Request tests early** - Easier to add tests during development
2. **Be specific** - Tell me what scenarios to test
3. **Run tests often** - `npm run test:watch` for instant feedback
4. **Review generated tests** - Make sure they test what you expect
5. **Expand coverage gradually** - Start with critical paths

## 📞 How to Invoke

Just say any of these:
- "Generate tests for [X]"
- "Add tests for the new feature"
- "I need tests for [X]"
- "Write tests first for [X]" (TDD)
- "Add regression test for [bug]"
- "Test coverage for [module]"

I'll automatically:
1. ✅ Identify what needs testing
2. ✅ Create appropriate test files
3. ✅ Generate comprehensive test cases
4. ✅ Run tests to verify they work
5. ✅ Commit with descriptive message
6. ✅ Report coverage improvements

---

**Let's build a fully-tested codebase together!** 🚀
