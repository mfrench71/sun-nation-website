/**
 * GLightbox Initialization
 * Enables lightbox for all image links in posts
 */

(function() {
  'use strict';

  // Wait for DOM and GLightbox to be ready
  function initLightbox() {
    if (typeof GLightbox === 'undefined') {
      return;
    }

    // Add glightbox class to image links, excluding video embeds
    const imageLinks = document.querySelectorAll('figure a');

    imageLinks.forEach(link => {
      const hasImg = link.querySelector('img');
      const isFigureWithVideo = link.closest('figure').querySelector('iframe, video');

      if (hasImg && !isFigureWithVideo) {
        link.classList.add('glightbox');
        // Force GLightbox to treat this as an image, not external content
        link.setAttribute('data-type', 'image');
      }
    });

    // Group images by post/gallery for better navigation
    groupGalleryImages();

    // Initialize GLightbox - use simple selector
    const lightbox = GLightbox({
      selector: '.glightbox',
      touchNavigation: true,
      loop: true,
      closeOnOutsideClick: true,
      keyboardNavigation: true,
      skin: 'clean',
      width: '95vw',
      height: '90vh',
      zoomable: false,
      draggable: false,

      onOpen: function() {
        document.body.classList.add('glightbox-open');
      },

      onClose: function() {
        document.body.classList.remove('glightbox-open');
      }
    });
  }

  // Initialize on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLightbox);
  } else {
    // DOM already loaded
    initLightbox();
  }

  /**
   * Group images within the same gallery container
   * This enables navigation between images in the same gallery only
   */
  function groupGalleryImages() {
    // Find all gallery containers
    const galleries = document.querySelectorAll('.gallery, .wp-block-gallery');
    let galleryIndex = 0;

    galleries.forEach((gallery) => {
      const allLinks = gallery.querySelectorAll('figure a');
      const imageLinks = [];

      // Filter to only links with img tags (no iframes/videos)
      allLinks.forEach(link => {
        const hasImg = link.querySelector('img');
        const isFigureWithVideo = link.closest('figure').querySelector('iframe, video');
        if (hasImg && !isFigureWithVideo) {
          imageLinks.push(link);
        }
      });

      // Add gallery attribute to group images within this specific gallery
      if (imageLinks.length > 0) {
        imageLinks.forEach(link => {
          link.setAttribute('data-gallery', `gallery-${galleryIndex}`);

          // Try to get description from figcaption or alt text
          const figure = link.closest('figure');
          if (figure) {
            const figcaption = figure.querySelector('figcaption');
            const img = link.querySelector('img');

            if (figcaption && figcaption.textContent.trim()) {
              link.setAttribute('data-glightbox', `description: ${figcaption.textContent.trim()}`);
            } else if (img && img.alt) {
              link.setAttribute('data-glightbox', `description: ${img.alt}`);
            }
          }
        });
        galleryIndex++;
      }
    });

    // Handle standalone images (not in a gallery) - each gets its own gallery
    const postContents = document.querySelectorAll('.post-content, .page-content, article');
    postContents.forEach((content) => {
      const allStandaloneLinks = content.querySelectorAll('figure:not(.gallery figure):not(.wp-block-gallery figure) a');

      allStandaloneLinks.forEach(link => {
        // Only process links with img tags (not iframes/videos)
        const hasImg = link.querySelector('img');
        const isFigureWithVideo = link.closest('figure').querySelector('iframe, video');

        if (hasImg && !isFigureWithVideo) {
          // Each standalone image gets its own unique gallery (no navigation to other images)
          link.setAttribute('data-gallery', `standalone-${galleryIndex}`);

          // Try to get description from figcaption or alt text
          const figure = link.closest('figure');
          if (figure) {
            const figcaption = figure.querySelector('figcaption');
            const img = link.querySelector('img');

            if (figcaption && figcaption.textContent.trim()) {
              link.setAttribute('data-glightbox', `description: ${figcaption.textContent.trim()}`);
            } else if (img && img.alt) {
              link.setAttribute('data-glightbox', `description: ${img.alt}`);
            }
          }
          galleryIndex++;
        }
      });
    });
  }

  // Re-initialize if content is dynamically loaded (e.g., infinite scroll)
  // Use MutationObserver to detect new images
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) { // Element node
            // Find new image links
            const allNewLinks = node.querySelectorAll ? node.querySelectorAll('figure a') : [];
            const newImageLinks = [];

            allNewLinks.forEach(link => {
              const hasImg = link.querySelector('img');
              const isFigureWithVideo = link.closest('figure').querySelector('iframe, video');
              if (hasImg && !isFigureWithVideo) {
                newImageLinks.push(link);
              }
            });

            if (newImageLinks.length > 0) {
              // Add glightbox class to new links
              newImageLinks.forEach(link => {
                link.classList.add('glightbox');
              });

              // Re-run grouping
              setTimeout(() => {
                groupGalleryImages();
                // Reinitialize lightbox
                initLightbox();
              }, 100);
            }
          }
        });
      }
    });
  });

  // Observe the post grid for new content
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      const postGrid = document.querySelector('.post-grid, .post-content, .page-content');
      if (postGrid) {
        observer.observe(postGrid, { childList: true, subtree: true });
      }
    });
  } else {
    const postGrid = document.querySelector('.post-grid, .post-content, .page-content');
    if (postGrid) {
      observer.observe(postGrid, { childList: true, subtree: true });
    }
  }

})();
