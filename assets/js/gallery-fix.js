/**
 * Image URL Fixer
 * Fixes image URLs to point to correct WordPress content directory
 */

(function() {
  'use strict';

  function fixGalleriesAndImages() {
    const postContent = document.querySelector('.post-content, .page-content');
    if (!postContent) return;

    // Fix image URLs only - galleries now use explicit markup
    fixImageUrls(postContent);
  }

  /**
   * Fix image URLs that point to /circleseven-website/wp-content or {{ site.baseurl }}/wp-content
   * Rewrite them to point to https://www.circleseven.co.uk/wp-content
   */
  function fixImageUrls(container) {
    // Fix all links and images
    const links = container.querySelectorAll('a[href*="/wp-content"], a[href*="site.baseurl"]');
    const images = container.querySelectorAll('img[src*="/wp-content"], img[src*="circleseven.co.uk"]');

    links.forEach(link => {
      let href = link.getAttribute('href');

      // Replace {{ site.baseurl }}/wp-content with full URL
      href = href.replace(/\{\{\s*site\.baseurl\s*\}\}\/wp-content/, 'https://www.circleseven.co.uk/wp-content');

      // Replace /circleseven-website/wp-content with full URL
      href = href.replace(/\/circleseven-website\/wp-content/, 'https://www.circleseven.co.uk/wp-content');

      // Replace any other /wp-content paths
      if (href.includes('/wp-content') && !href.startsWith('http')) {
        href = 'https://www.circleseven.co.uk' + href.replace(/^.*?(\/wp-content)/, '$1');
      }

      link.setAttribute('href', href);
    });

    images.forEach(img => {
      let src = img.getAttribute('src');

      // If src already points to circleseven.co.uk, we're good
      if (src.includes('circleseven.co.uk')) {
        return;
      }

      // Replace {{ site.baseurl }}/wp-content with full URL
      src = src.replace(/\{\{\s*site\.baseurl\s*\}\}\/wp-content/, 'https://www.circleseven.co.uk/wp-content');

      // Replace /circleseven-website/wp-content with full URL
      src = src.replace(/\/circleseven-website\/wp-content/, 'https://www.circleseven.co.uk/wp-content');

      // Replace any other /wp-content paths
      if (src.includes('/wp-content') && !src.startsWith('http')) {
        src = 'https://www.circleseven.co.uk' + src.replace(/^.*?(\/wp-content)/, '$1');
      }

      img.setAttribute('src', src);
    });
  }

  // Run once on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fixGalleriesAndImages);
  } else {
    fixGalleriesAndImages();
  }

})();
