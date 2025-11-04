#!/usr/bin/env python3
"""
Add lazy loading to images in markdown posts that don't have it.
"""

import os
import re
from pathlib import Path

# Posts directory
POSTS_DIR = Path(__file__).parent.parent / "_posts"

def has_images(content):
    """Check if content has img tags."""
    return bool(re.search(r'<img[^>]+>', content))

def has_lazy_loading(content):
    """Check if content already has loading attribute."""
    return bool(re.search(r'loading\s*=', content))

def add_lazy_loading_to_content(content):
    """Add loading='lazy' to all img tags that don't have it."""

    def add_loading_attr(match):
        img_tag = match.group(0)
        # Skip if already has loading attribute
        if 'loading=' in img_tag:
            return img_tag

        # Add loading="lazy" before the closing >
        # Handle self-closing tags (/>)  and regular tags (>)
        if img_tag.endswith('/>'):
            return img_tag[:-2] + ' loading="lazy" />'
        else:
            return img_tag[:-1] + ' loading="lazy">'

    # Replace all img tags
    updated_content = re.sub(r'<img[^>]+/?>', add_loading_attr, content)
    return updated_content

def main():
    """Process all posts."""
    posts_with_images = 0
    posts_already_have_lazy = 0
    posts_updated = 0

    for post_file in sorted(POSTS_DIR.glob("*.md")):
        with open(post_file, 'r', encoding='utf-8') as f:
            content = f.read()

        if not has_images(content):
            continue

        posts_with_images += 1

        if has_lazy_loading(content):
            posts_already_have_lazy += 1
            continue

        # Add lazy loading
        updated_content = add_lazy_loading_to_content(content)

        if updated_content != content:
            with open(post_file, 'w', encoding='utf-8') as f:
                f.write(updated_content)
            print(f"✅ Updated: {post_file.name}")
            posts_updated += 1

    print(f"\n📊 Summary:")
    print(f"   Posts with images: {posts_with_images}")
    print(f"   Already had lazy loading: {posts_already_have_lazy}")
    print(f"   Updated with lazy loading: {posts_updated}")

if __name__ == "__main__":
    main()
