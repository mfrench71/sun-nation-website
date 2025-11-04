# Circle Seven Admin - Features Roadmap

## 🎨 Cloudinary Media Library Integration

### Current State:
- Manual image URL input
- Partial Cloudinary path support
- Basic thumbnail preview
- Full-size modal view

### Proposed Enhancement: Cloudinary Media Library Widget

**Implementation**:
```javascript
// Add Cloudinary Media Library widget
// In index.html head:
<script src="https://media-library.cloudinary.com/global/all.js"></script>

// In app.js:
let cloudinaryWidget = null;

function initCloudinaryWidget() {
  if (cloudinaryWidget) return;

  cloudinaryWidget = cloudinary.createMediaLibrary({
    cloud_name: 'circleseven',
    api_key: 'YOUR_API_KEY',
    username: 'YOUR_USERNAME',
    button_class: 'cloudinary-button',
    button_caption: 'Select Image from Media Library',
    max_files: 1,
    inline_container: '#cloudinary-widget',
    remove_header: false,
    folder: {
      path: 'blog',
      resource_type: 'image'
    }
  }, {
    insertHandler: function(data) {
      const asset = data.assets[0];
      const imageUrl = asset.secure_url;

      // Update featured image field
      document.getElementById('post-image').value = imageUrl;
      updateImagePreview();
      markPostDirty();
    }
  });
}

// In post editor, add button to trigger widget
function selectFeaturedImage() {
  if (!cloudinaryWidget) {
    initCloudinaryWidget();
  }
  cloudinaryWidget.show();
}
```

**HTML Update** (in post editor):
```html
<div class="flex gap-2">
  <input
    type="url"
    id="post-image"
    name="image"
    placeholder="https://res.cloudinary.com/..."
    class="flex-1 px-3 py-2 border border-gray-300 rounded-md"
    oninput="updateImagePreview()"
  />
  <button
    type="button"
    onclick="selectFeaturedImage()"
    class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
  >
    <i class="fas fa-image"></i> Browse Library
  </button>
</div>
```

### WYSIWYG Image Insertion

**EasyMDE Custom Button**:
```javascript
// Add custom toolbar button to EasyMDE
function initMarkdownEditor() {
  if (!markdownEditor) {
    markdownEditor = new EasyMDE({
      element: document.getElementById('post-content'),
      toolbar: [
        'bold', 'italic', 'heading', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link',
        {
          name: 'cloudinary-image',
          action: function(editor) {
            insertCloudinaryImage(editor);
          },
          className: 'fa fa-image',
          title: 'Insert Image from Cloudinary'
        },
        '|',
        'preview', 'side-by-side', 'fullscreen', '|',
        'guide'
      ],
      // ... rest of config
    });
  }
}

function insertCloudinaryImage(editor) {
  cloudinary.createMediaLibrary({
    cloud_name: 'circleseven',
    api_key: 'YOUR_API_KEY',
    max_files: 1,
    inline_container: null
  }, {
    insertHandler: function(data) {
      const asset = data.assets[0];
      const imageUrl = asset.secure_url;
      const altText = asset.public_id.split('/').pop();

      // Insert markdown image syntax
      const cm = editor.codemirror;
      const markdown = `![${altText}](${imageUrl})`;
      cm.replaceSelection(markdown);
      markPostDirty();
    }
  }).show();
}
```

---

## 📝 WordPress-Style Features

### 1. Quick Edit (Inline Editing in Table)

**Feature**: Edit post title, date, categories without opening full editor

**Implementation**:
```javascript
function quickEditPost(filename) {
  const post = allPostsWithMetadata.find(p => p.name === filename);
  const row = document.querySelector(`tr[data-filename="${filename}"]`);

  // Replace row with edit form
  row.innerHTML = `
    <td colspan="5" class="px-4 py-3">
      <div class="quick-edit-form">
        <div class="grid grid-cols-3 gap-4">
          <input type="text" value="${post.frontmatter.title}" id="qe-title" />
          <input type="date" value="${post.frontmatter.date}" id="qe-date" />
          <select id="qe-categories" multiple>
            ${categories.map(cat => `<option ${post.frontmatter.categories.includes(cat) ? 'selected' : ''}>${cat}</option>`)}
          </select>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="saveQuickEdit('${filename}')" class="btn-primary">Update</button>
          <button onclick="cancelQuickEdit()" class="btn-secondary">Cancel</button>
        </div>
      </div>
    </td>
  `;
}
```

### 2. Bulk Actions

**Feature**: Select multiple posts for bulk delete/category assignment

**Implementation**:
```html
<!-- Add checkboxes to table -->
<td class="px-4 py-3">
  <input type="checkbox" class="post-checkbox" data-filename="${post.name}" />
</td>

<!-- Bulk actions dropdown -->
<div class="bulk-actions">
  <select id="bulk-action">
    <option value="">Bulk Actions</option>
    <option value="trash">Move to Trash</option>
    <option value="category">Assign Category</option>
    <option value="tag">Add Tags</option>
  </select>
  <button onclick="applyBulkAction()">Apply</button>
</div>
```

```javascript
function applyBulkAction() {
  const action = document.getElementById('bulk-action').value;
  const selected = Array.from(document.querySelectorAll('.post-checkbox:checked'))
    .map(cb => cb.dataset.filename);

  if (selected.length === 0) {
    showError('Please select posts first');
    return;
  }

  switch(action) {
    case 'trash':
      bulkMoveToTrash(selected);
      break;
    case 'category':
      showBulkCategoryDialog(selected);
      break;
    case 'tag':
      showBulkTagDialog(selected);
      break;
  }
}
```

### 3. Post Status & Scheduling

**Feature**: Draft, Published, Scheduled states

**Schema Addition**:
```yaml
---
layout: post
title: My Post
date: 2025-01-15T10:00:00Z
status: draft  # draft, published, scheduled
publish_date: 2025-02-01T09:00:00Z  # for scheduled posts
---
```

**UI Update**:
```html
<div class="post-status">
  <label>Status</label>
  <select id="post-status">
    <option value="draft">Draft</option>
    <option value="published">Published</option>
    <option value="scheduled">Scheduled</option>
  </select>

  <div id="scheduled-date" class="hidden">
    <label>Publish On</label>
    <input type="datetime-local" id="publish-date" />
  </div>
</div>
```

### 4. Post Revisions

**Feature**: Track post history, restore previous versions

**Implementation Strategy**:
- Use GitHub commit history
- Add "Revisions" tab in post editor
- Show diff between versions
- Restore from previous commit

```javascript
async function loadPostRevisions(filename) {
  // Get commit history for specific file
  const commits = await githubRequest(`/commits?path=_posts/${filename}`);

  return commits.map(commit => ({
    sha: commit.sha,
    date: commit.commit.author.date,
    message: commit.commit.message,
    author: commit.commit.author.name
  }));
}

async function restoreRevision(filename, sha) {
  // Get file content at specific commit
  const fileData = await githubRequest(`/contents/_posts/${filename}?ref=${sha}`);
  const content = Buffer.from(fileData.content, 'base64').toString('utf8');

  // Restore to editor
  const { frontmatter, body } = parseFrontmatter(content);
  loadPostDataIntoEditor(frontmatter, body);
}
```

### 5. Post Duplication

**Feature**: Clone existing post as starting point

```javascript
async function duplicatePost(filename) {
  const post = await fetch(`${API_BASE}/posts?path=${filename}`).then(r => r.json());

  // Modify title
  post.frontmatter.title = `${post.frontmatter.title} (Copy)`;
  post.frontmatter.date = new Date().toISOString();

  // Generate new filename
  const newFilename = generateFilename(post.frontmatter.title, post.frontmatter.date);

  // Create new post
  await fetch(`${API_BASE}/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: newFilename,
      frontmatter: post.frontmatter,
      body: post.body
    })
  });

  showSuccess('Post duplicated successfully!');
  await loadPosts();
}
```

### 6. Custom Fields (Post Meta)

**Feature**: Add arbitrary key-value pairs to posts

**Schema**:
```yaml
---
title: My Post
custom_fields:
  reading_time: "5 min"
  difficulty: "Intermediate"
  related_products: ["product-1", "product-2"]
---
```

**UI**:
```html
<div class="custom-fields">
  <h4>Custom Fields</h4>
  <div id="custom-fields-list">
    <!-- Dynamic rows -->
  </div>
  <button onclick="addCustomField()">+ Add Field</button>
</div>
```

### 7. Permalink Management

**Feature**: Edit post slug independently

```html
<div class="permalink-editor">
  <label>Permalink</label>
  <div class="flex items-center gap-2">
    <span class="text-gray-500">https://circleseven.co.uk/</span>
    <input type="text" id="post-slug" value="my-post-slug" />
    <button onclick="regenerateSlug()">Auto-generate</button>
  </div>
</div>
```

### 8. Featured Image Variations

**Feature**: Select different image sizes/crops

```javascript
// Cloudinary transformations
const imageSizes = {
  thumbnail: 'w_150,h_150,c_fill',
  medium: 'w_300,h_200,c_fill',
  large: 'w_1024,h_768,c_fit',
  hero: 'w_1920,h_1080,c_fill'
};

function generateImageUrl(publicId, size = 'large') {
  const transform = imageSizes[size];
  return `https://res.cloudinary.com/circleseven/image/upload/${transform}/${publicId}`;
}
```

### 9. Categories Hierarchy

**Feature**: Parent-child category relationships

**Schema**:
```javascript
categories: {
  'Photography': {
    children: ['Landscapes', 'Portraits', 'Street']
  },
  'Technology': {
    children: ['Web Development', 'AI', 'Hardware']
  }
}
```

**UI**: Nested sortable lists with drag-drop reordering

### 10. Tag Suggestions

**Feature**: Auto-suggest tags based on content

```javascript
function suggestTags(content) {
  // Simple keyword extraction
  const words = content.toLowerCase()
    .split(/\W+/)
    .filter(w => w.length > 4);

  // Find matches in existing tags
  const suggestions = tags.filter(tag =>
    words.some(w => tag.toLowerCase().includes(w))
  );

  return suggestions.slice(0, 5);
}

// Show suggestions below editor
function showTagSuggestions() {
  const content = markdownEditor.value();
  const suggestions = suggestTags(content);

  document.getElementById('tag-suggestions').innerHTML = `
    <p class="text-sm text-gray-600">Suggested tags:</p>
    ${suggestions.map(tag => `
      <button class="tag-suggestion" onclick="addTag('${tag}')">${tag}</button>
    `).join('')}
  `;
}
```

### 11. Media Gallery Management

**Feature**: Browse, search, and organize media

```html
<div id="section-media" class="section-panel hidden">
  <h2>Media Library</h2>

  <div class="media-filters">
    <input type="search" placeholder="Search images..." />
    <select>
      <option>All Media</option>
      <option>Images</option>
      <option>Recently Uploaded</option>
    </select>
  </div>

  <div class="media-grid">
    <!-- Cloudinary images grid -->
  </div>
</div>
```

### 12. Comment Moderation

**Feature**: Manage comments (if using comments system)

Integration with:
- Disqus API
- GitHub Issues (as comments)
- Custom comment system

---

## 🎯 Priority Recommendations

### High Priority (Immediate Value):
1. ✅ **Cloudinary Widget Integration** - Huge UX improvement
2. **Quick Edit** - Faster workflow
3. **Bulk Actions** - Time saver for content managers

### Medium Priority (Enhanced Features):
4. **Post Status/Scheduling** - Professional CMS feature
5. **Post Duplication** - Common workflow need
6. **Tag Suggestions** - Helps with SEO

### Low Priority (Nice to Have):
7. **Post Revisions** - Complex but valuable
8. **Custom Fields** - Advanced users only
9. **Categories Hierarchy** - Organizational improvement

---

## 📦 Required Dependencies

### For Cloudinary Integration:
```html
<script src="https://media-library.cloudinary.com/global/all.js"></script>
<script src="https://widget.cloudinary.com/v2.0/global/all.js"></script>
```

### For Advanced Features:
- `js-yaml` (already used in settings.js)
- `marked` (for markdown preview enhancements)
- `diff` (for revision comparison)

---

## 🚀 Implementation Phases

### Phase 1: Media & Quick Actions (Week 1-2)
- Cloudinary widget integration
- Quick edit functionality
- Bulk actions

### Phase 2: Status & Organization (Week 3-4)
- Post status (draft/published/scheduled)
- Post duplication
- Permalink management

### Phase 3: Advanced Features (Week 5-6)
- Post revisions
- Custom fields
- Tag suggestions

### Phase 4: Polish & Optimization (Week 7-8)
- Performance tuning
- Mobile responsiveness
- Accessibility improvements
- User documentation

---

## 📝 Notes

All features maintain:
- ✅ GitHub as single source of truth
- ✅ No database required
- ✅ Netlify Function architecture
- ✅ Jekyll compatibility
- ✅ Security best practices
