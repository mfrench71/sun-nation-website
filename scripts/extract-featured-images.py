#!/usr/bin/env python3
"""
Extract featured images from WordPress XML export and add to Jekyll post front matter

Reads WordPress XML export, maps _thumbnail_id to attachment URLs,
then updates Jekyll post front matter with featured_image field.
"""

import xml.etree.ElementTree as ET
import re
from pathlib import Path
import yaml

class FeaturedImageExtractor:
    def __init__(self, xml_path, posts_dir='_posts'):
        self.xml_path = xml_path
        self.posts_dir = Path(posts_dir)
        self.attachments = {}  # Map attachment ID to URL
        self.post_thumbnails = {}  # Map post title/slug to thumbnail ID
        self.stats = {
            'posts_found': 0,
            'posts_updated': 0,
            'posts_skipped': 0,
            'errors': []
        }

    def parse_xml(self):
        """Parse WordPress XML and extract attachments and thumbnail mappings"""
        print("Parsing WordPress XML...")

        tree = ET.parse(self.xml_path)
        root = tree.getroot()

        # WordPress namespace
        namespaces = {
            'wp': 'http://wordpress.org/export/1.2/',
            'content': 'http://purl.org/rss/1.0/modules/content/'
        }

        # Find all items (posts and attachments)
        for item in root.findall('.//item'):
            post_type = item.find('wp:post_type', namespaces)
            if post_type is None:
                continue

            post_type_text = post_type.text

            # Extract attachment URLs
            if post_type_text == 'attachment':
                post_id = item.find('wp:post_id', namespaces)
                attachment_url = item.find('wp:attachment_url', namespaces)

                if post_id is not None and attachment_url is not None:
                    self.attachments[post_id.text] = attachment_url.text

            # Extract post featured image IDs
            elif post_type_text == 'post':
                title = item.find('title')
                post_name = item.find('wp:post_name', namespaces)

                # Look for _thumbnail_id in postmeta
                for postmeta in item.findall('wp:postmeta', namespaces):
                    meta_key = postmeta.find('wp:meta_key', namespaces)
                    if meta_key is not None and meta_key.text == '_thumbnail_id':
                        meta_value = postmeta.find('wp:meta_value', namespaces)
                        if meta_value is not None and title is not None:
                            # Store by both title and post_name for matching
                            if post_name is not None:
                                self.post_thumbnails[post_name.text] = meta_value.text
                            self.post_thumbnails[title.text] = meta_value.text

        print(f"Found {len(self.attachments)} attachments")
        print(f"Found {len(self.post_thumbnails)} posts with featured images")

    def get_thumbnail_url(self, post_slug, post_title):
        """Get thumbnail URL for a post by slug or title"""
        # Try slug first (more reliable)
        thumbnail_id = self.post_thumbnails.get(post_slug)

        # Fall back to title
        if not thumbnail_id:
            thumbnail_id = self.post_thumbnails.get(post_title)

        if thumbnail_id:
            return self.attachments.get(thumbnail_id)

        return None

    def extract_front_matter(self, content):
        """Extract YAML front matter from markdown file"""
        if not content.startswith('---'):
            return None, content

        # Find second ---
        end_match = re.search(r'\n---\n', content[3:])
        if not end_match:
            return None, content

        yaml_content = content[3:end_match.start() + 3]
        rest_content = content[end_match.end() + 3:]

        try:
            front_matter = yaml.safe_load(yaml_content)
            return front_matter, rest_content
        except Exception as e:
            print(f"Error parsing YAML: {e}")
            return None, content

    def update_post(self, post_path):
        """Update a single post with featured image"""
        self.stats['posts_found'] += 1

        # Read post
        with open(post_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # Extract front matter
        front_matter, body = self.extract_front_matter(content)
        if not front_matter:
            self.stats['posts_skipped'] += 1
            return False

        # Skip if already has featured_image or image
        if 'featured_image' in front_matter or 'image' in front_matter:
            self.stats['posts_skipped'] += 1
            return False

        # Get post slug from filename
        post_slug = post_path.stem.split('-', 3)[-1] if '-' in post_path.stem else post_path.stem
        post_title = front_matter.get('title', '')

        # Get thumbnail URL
        thumbnail_url = self.get_thumbnail_url(post_slug, post_title)

        if not thumbnail_url:
            self.stats['posts_skipped'] += 1
            return False

        # Extract filename from WordPress URL with folder structure
        # WordPress URLs: /wp-content/uploads/YYYY/MM/filename.ext
        # Cloudinary public_id: MM/filename (without extension)
        url_match = re.search(r'/wp-content/uploads/(\d{4})/(\d{2})/([^/]+)$', thumbnail_url)
        if url_match:
            year = url_match.group(1)
            month = url_match.group(2)
            filename = url_match.group(3)
            # Remove extension
            filename_no_ext = re.sub(r'\.(jpg|jpeg|png|gif|webp)$', '', filename, flags=re.IGNORECASE)
            public_id = f"{month}/{filename_no_ext}"
        else:
            # Fallback: just filename without path
            filename = thumbnail_url.split('/')[-1]
            public_id = re.sub(r'\.(jpg|jpeg|png|gif|webp)$', '', filename, flags=re.IGNORECASE)

        # Add featured_image to front matter (without extension, with folder)
        front_matter['featured_image'] = public_id

        # Rebuild file content
        new_content = '---\n'
        new_content += yaml.dump(front_matter, default_flow_style=False, allow_unicode=True, sort_keys=False)
        new_content += '---\n'
        new_content += body

        # Write back
        with open(post_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

        self.stats['posts_updated'] += 1
        print(f"✓ Updated: {post_path.name} -> {public_id}")
        return True

    def run(self):
        """Process all posts"""
        self.parse_xml()
        print(f"\nProcessing posts in {self.posts_dir}...\n")

        for post_file in sorted(self.posts_dir.glob('*.md')):
            try:
                self.update_post(post_file)
            except Exception as e:
                error_msg = f"Error processing {post_file.name}: {e}"
                self.stats['errors'].append(error_msg)
                print(f"✗ {error_msg}")

        # Print summary
        print(f"\nSummary:")
        print(f"Posts found: {self.stats['posts_found']}")
        print(f"Posts updated: {self.stats['posts_updated']}")
        print(f"Posts skipped: {self.stats['posts_skipped']}")

        if self.stats['errors']:
            print(f"\nErrors: {len(self.stats['errors'])}")
            for error in self.stats['errors']:
                print(f"  - {error}")

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Extract featured images from WordPress XML')
    parser.add_argument('--xml', default='matthewfrench.WordPress.2025-10-17.xml',
                        help='Path to WordPress XML export')
    parser.add_argument('--posts-dir', default='_posts',
                        help='Path to Jekyll posts directory')

    args = parser.parse_args()

    extractor = FeaturedImageExtractor(args.xml, args.posts_dir)
    extractor.run()

if __name__ == '__main__':
    main()
