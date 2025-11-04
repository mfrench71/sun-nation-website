# Related Posts Improvement

## Current Implementation Problem

**File:** `_layouts/post.html:50-71`

The current related posts implementation uses Jekyll's built-in `site.related_posts`:

```liquid
{%- if site.related_posts.size > 0 -%}
<aside class="related-posts">
  <h2>Related Posts</h2>
  <ul class="post-list">
    {%- for post in site.related_posts limit:3 -%}
    ...
    {%- endfor -%}
  </ul>
</aside>
{%- endif -%}
```

### The Issue

Jekyll's `site.related_posts` is **NOT truly related** unless you enable LSI (Latent Semantic Indexing):

- **Without LSI (current):** Returns the 10 most **recent** posts (chronological, not related)
- **With LSI:** Requires `classifier-reborn` gem and significantly slows build time

So currently, the "Related Posts" section just shows the 3 most recent posts from the entire site - completely ignoring tags, categories, or content similarity.

## Why This Matters

**Example Problem:**
- Reading a post about "Unity Game Development" (tagged: Unity, DAT612)
- "Related Posts" shows:
  1. "Photoshop Tutorial" (most recent)
  2. "Arduino Project" (second most recent)
  3. "Photography Tips" (third most recent)

**None are actually related!**

## Recommended Solution

Implement **tag-based** and **category-based** related posts using Liquid filters:

### Option 1: Tag-Based Related Posts (Recommended)

```liquid
{%- comment -%} Find posts with matching tags {%- endcomment -%}
{%- assign related_posts = '' | split: '' -%}
{%- assign current_tags = page.tags -%}

{%- for post in site.posts -%}
  {%- if post.url == page.url -%}
    {%- continue -%}
  {%- endif -%}

  {%- assign common_tags = post.tags | where_exp: "tag", "current_tags contains tag" -%}
  {%- if common_tags.size > 0 -%}
    {%- assign related_posts = related_posts | push: post -%}
  {%- endif -%}
{%- endfor -%}

{%- if related_posts.size > 0 -%}
<aside class="related-posts">
  <h2>Related Posts</h2>
  <ul class="post-list">
    {%- for post in related_posts limit:3 -%}
    <li class="post-item-compact">
      <div class="post-info">
        <a href="{{ post.url | relative_url }}" class="post-title-link">{{ post.title | escape }}</a>
        <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
      </div>
    </li>
    {%- endfor -%}
  </ul>
</aside>
{%- endif -%}
```

### Option 2: Category + Tag Weighted (Advanced)

```liquid
{%- comment -%} Score posts by category match (3 pts) + tag match (1 pt each) {%- endcomment -%}
{%- assign scored_posts = '' | split: '' -%}

{%- for post in site.posts -%}
  {%- if post.url == page.url -%}
    {%- continue -%}
  {%- endif -%}

  {%- assign score = 0 -%}

  {%- comment -%} Same category = 3 points {%- endcomment -%}
  {%- if post.categories.first == page.categories.first -%}
    {%- assign score = score | plus: 3 -%}
  {%- endif -%}

  {%- comment -%} Each matching tag = 1 point {%- endcomment -%}
  {%- for tag in post.tags -%}
    {%- if page.tags contains tag -%}
      {%- assign score = score | plus: 1 -%}
    {%- endif -%}
  {%- endfor -%}

  {%- comment -%} Only include if score > 0 {%- endcomment -%}
  {%- if score > 0 -%}
    {%- assign post_with_score = post | append: '|' | append: score -%}
    {%- assign scored_posts = scored_posts | push: post_with_score -%}
  {%- endif -%}
{%- endfor -%}

{%- comment -%} Sort by score (requires custom sort logic) {%- endcomment -%}
{%- comment -%} This is a simplified version - full implementation would sort by score {%- endcomment -%}
```

### Option 3: Category Fallback

```liquid
{%- comment -%} Try tags first, fall back to same category {%- endcomment -%}
{%- assign related_by_tag = site.posts | where_exp: "post", "post.tags contains page.tags.first" | where_exp: "post", "post.url != page.url" -%}

{%- if related_by_tag.size >= 3 -%}
  {%- assign related_posts = related_by_tag -%}
{%- else -%}
  {%- assign same_category = site.posts | where: "categories", page.categories | where_exp: "post", "post.url != page.url" -%}
  {%- assign related_posts = related_by_tag | concat: same_category | uniq -%}
{%- endif -%}

{%- if related_posts.size > 0 -%}
<aside class="related-posts">
  <h2>Related Posts</h2>
  <ul class="post-list">
    {%- for post in related_posts limit:3 -%}
    <li class="post-item-compact">
      <div class="post-info">
        <a href="{{ post.url | relative_url }}" class="post-title-link">{{ post.title | escape }}</a>
        <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
        {%- if post.tags.size > 0 -%}
        <div class="post-tags-small">
          {%- for tag in post.tags limit:2 -%}
            <span class="tag-badge">{{ tag }}</span>
          {%- endfor -%}
        </div>
        {%- endif -%}
      </div>
    </li>
    {%- endfor -%}
  </ul>
</aside>
{%- endif -%}
```

## Performance Considerations

### Build Time Impact

- **Current (chronological):** Very fast (~0ms per page)
- **Tag-based:** Moderate (~10-50ms per page with 78 posts)
- **Weighted scoring:** Slower (~50-200ms per page)

**For 78 posts:**
- Tag-based: +0.78 - 3.9 seconds total build time
- Weighted: +3.9 - 15.6 seconds total build time

This is **acceptable** for a personal blog (total build still < 30 seconds).

### Liquid Limitations

Jekyll's Liquid doesn't have:
- Numeric sorting of custom arrays
- Easy score tracking
- Hash/dictionary data structures

**Workaround:** Keep it simple with tag matching or use Jekyll plugins.

## Recommended Implementation Steps

1. **Backup current layout:**
   ```bash
   cp _layouts/post.html _layouts/post.html.backup
   ```

2. **Implement Option 3 (Category Fallback)** - Best balance of relevance and simplicity

3. **Test with a few posts:**
   ```bash
   bundle exec jekyll serve
   # Visit various posts and check "Related Posts" section
   ```

4. **Verify build time:**
   ```bash
   time bundle exec jekyll build
   # Should still be under 30 seconds
   ```

5. **Monitor for false positives:**
   - Posts with very generic tags (e.g., "Tutorial") might show as related when they're not
   - Solution: Use more specific tags

## Alternative: Jekyll Plugin

For more sophisticated relatedness, consider:

### `jekyll-related-posts` Plugin

```ruby
# Gemfile
gem 'jekyll-related-posts'
```

```yaml
# _config.yml
plugins:
  - jekyll-related-posts

related_posts:
  max: 3
  weights:
    categories: 3.0
    tags: 1.0
```

This plugin:
- ✅ Calculates true similarity scores
- ✅ Weighted by categories and tags
- ✅ Caches results for faster builds
- ❌ Adds external dependency

## Benefits of Fixing This

1. **Better User Experience:** Readers find actually relevant content
2. **Improved SEO:** Stronger internal linking between related content
3. **Higher Engagement:** Users read more posts per visit
4. **Lower Bounce Rate:** Relevant suggestions keep users on site
5. **Content Discovery:** Surface older content that's still relevant

## Example Results

**Before (chronological):**
```
Related Posts:
• Photoshop Tutorial (Oct 2024)
• Arduino Project (Sep 2024)
• Photography Tips (Aug 2024)
```

**After (tag-based):**
```
Related Posts:
• Unity Environment Setup (DAT612, Unity)
• Photogrammetry with Unity (DAT612, Unity)
• Final Year Project Proposal (DAT612)
```

Much better!

## Implementation File

Update: `_layouts/post.html` (lines 50-71)

Choose one of the three options above and replace the current `site.related_posts` loop.
