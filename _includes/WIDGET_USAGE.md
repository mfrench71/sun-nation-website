# Tag Cloud Widget Usage

The tag cloud widget can be included anywhere on your site.

## Usage Examples

### In a sidebar (if you add one):
```liquid
{% include tag-cloud.html %}
```

### On the homepage:
Add this to `index.html` before or after the post list:
```liquid
{% include tag-cloud.html %}
```

### On individual pages:
Add to any page like `about.md`:
```liquid
---
layout: default
title: About
---

Your content here...

{% include tag-cloud.html %}
```

### In the footer:
Add to `_includes/footer.html`:
```liquid
{% include tag-cloud.html %}
```

## Customization

The widget automatically:
- Shows all tags with post counts
- Sizes tags based on popularity (small/medium/large)
- Links to individual tag pages
- Displays in a responsive grid

You can customize the appearance by editing:
- `_includes/tag-cloud.html` - Widget structure
- `assets/css/tags.css` - Widget styles (see `.widget` and `.tag-cloud-widget` classes)
