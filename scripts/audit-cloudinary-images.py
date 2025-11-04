#!/usr/bin/env python3
"""
Audit Cloudinary images to find missing assets

Compares images referenced in posts with images uploaded to Cloudinary
and reports any missing images.
"""

import re
import cloudinary
import cloudinary.api
from pathlib import Path
from collections import defaultdict

class CloudinaryAuditor:
    def __init__(self, cloud_name, api_key, api_secret):
        # Configure Cloudinary
        cloudinary.config(
            cloud_name=cloud_name,
            api_key=api_key,
            api_secret=api_secret,
            secure=True
        )

        self.posts_dir = Path('_posts')
        self.cloudinary_images = set()
        self.referenced_images = defaultdict(list)
        self.stats = {
            'total_posts': 0,
            'total_references': 0,
            'total_cloudinary_assets': 0,
            'missing_images': [],
            'unused_images': []
        }

    def fetch_cloudinary_assets(self):
        """Fetch all assets from Cloudinary"""
        print("Fetching Cloudinary assets...")

        resources = []
        next_cursor = None

        try:
            while True:
                if next_cursor:
                    result = cloudinary.api.resources(
                        type='upload',
                        max_results=500,
                        next_cursor=next_cursor
                    )
                else:
                    result = cloudinary.api.resources(
                        type='upload',
                        max_results=500
                    )

                resources.extend(result['resources'])

                if 'next_cursor' in result:
                    next_cursor = result['next_cursor']
                else:
                    break

            # Extract public_ids
            self.cloudinary_images = {r['public_id'] for r in resources}
            self.stats['total_cloudinary_assets'] = len(self.cloudinary_images)

            print(f"Found {len(self.cloudinary_images)} assets in Cloudinary")

        except Exception as e:
            print(f"Error fetching Cloudinary assets: {e}")

    def extract_cloudinary_references(self):
        """Extract all Cloudinary image references from posts"""
        print(f"\nScanning posts in {self.posts_dir}...")

        # Pattern to match Cloudinary URLs
        # Matches: https://res.cloudinary.com/circleseven/image/upload/{transformations}/{public_id}
        pattern = r'https://res\.cloudinary\.com/circleseven/image/upload/[^/]+/(.+?)(?:["\s<>]|$)'

        for post_file in self.posts_dir.glob('*.md'):
            self.stats['total_posts'] += 1

            with open(post_file, 'r', encoding='utf-8') as f:
                content = f.read()

            # Find all Cloudinary references
            matches = re.findall(pattern, content)

            for public_id in matches:
                # Clean up any trailing quotes or spaces
                public_id = public_id.strip('"\' ')
                self.referenced_images[public_id].append(post_file.name)
                self.stats['total_references'] += 1

        print(f"Scanned {self.stats['total_posts']} posts")
        print(f"Found {len(self.referenced_images)} unique images referenced")
        print(f"Total references: {self.stats['total_references']}")

    def find_missing_images(self):
        """Find images referenced in posts but not in Cloudinary"""
        print("\nChecking for missing images...")

        for public_id, post_files in self.referenced_images.items():
            if public_id not in self.cloudinary_images:
                self.stats['missing_images'].append({
                    'public_id': public_id,
                    'posts': post_files
                })

        if self.stats['missing_images']:
            print(f"\n⚠ Found {len(self.stats['missing_images'])} missing images:")
            for missing in sorted(self.stats['missing_images'], key=lambda x: x['public_id']):
                print(f"\n  Missing: {missing['public_id']}")
                print(f"  Referenced in: {', '.join(missing['posts'][:3])}")
                if len(missing['posts']) > 3:
                    print(f"  ... and {len(missing['posts']) - 3} more posts")
        else:
            print("✓ All referenced images found in Cloudinary!")

    def find_unused_images(self):
        """Find images in Cloudinary not referenced in any posts"""
        print("\nChecking for unused images...")

        referenced_set = set(self.referenced_images.keys())
        unused = self.cloudinary_images - referenced_set

        if unused:
            self.stats['unused_images'] = sorted(unused)
            print(f"\nℹ Found {len(unused)} images in Cloudinary not referenced in posts")
            print("These might be featured images, logos, or other assets")

            # Show first 10
            print("\nFirst 10 unused images:")
            for img in list(self.stats['unused_images'])[:10]:
                print(f"  {img}")

            if len(unused) > 10:
                print(f"  ... and {len(unused) - 10} more")
        else:
            print("✓ All Cloudinary images are referenced in posts!")

    def print_summary(self):
        """Print audit summary"""
        print("\n" + "="*60)
        print("CLOUDINARY AUDIT SUMMARY")
        print("="*60)
        print(f"Posts scanned: {self.stats['total_posts']}")
        print(f"Cloudinary assets: {self.stats['total_cloudinary_assets']}")
        print(f"Unique images referenced: {len(self.referenced_images)}")
        print(f"Total references: {self.stats['total_references']}")
        print(f"\nMissing images: {len(self.stats['missing_images'])}")
        print(f"Unused images: {len(self.stats['unused_images'])}")
        print("="*60)

        if self.stats['missing_images']:
            print("\n⚠ ACTION REQUIRED: Missing images need to be uploaded to Cloudinary")
        else:
            print("\n✓ All referenced images are available in Cloudinary")

    def run(self):
        """Run the audit"""
        self.fetch_cloudinary_assets()
        self.extract_cloudinary_references()
        self.find_missing_images()
        self.find_unused_images()
        self.print_summary()

        return self.stats


def main():
    import argparse

    parser = argparse.ArgumentParser(description='Audit Cloudinary images')
    parser.add_argument('--cloud-name', default='circleseven', help='Cloudinary cloud name')
    parser.add_argument('--api-key', required=True, help='Cloudinary API key')
    parser.add_argument('--api-secret', required=True, help='Cloudinary API secret')

    args = parser.parse_args()

    auditor = CloudinaryAuditor(
        cloud_name=args.cloud_name,
        api_key=args.api_key,
        api_secret=args.api_secret
    )

    auditor.run()


if __name__ == '__main__':
    main()
