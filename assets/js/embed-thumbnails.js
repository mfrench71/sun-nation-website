/**
 * Embed & Image Thumbnails - Extract embeds and images, create thumbnail gallery with navigation
 * For use with post-adaptive layout
 */

(function() {
  'use strict';

  // Only run on adaptive layout pages
  const adaptiveContainer = document.querySelector('.post-adaptive-three-column, .post-adaptive-two-column');
  if (!adaptiveContainer) {
    return;
  }

  // Global media array and current index for navigation
  let allMedia = [];
  let currentIndex = 0;

  /**
   * Extract all embeds from the post content
   */
  function extractEmbeds() {
    const embeds = [];
    const embedElements = document.querySelectorAll(
      '.post-content [data-embed-type]'
    );

    embedElements.forEach((embedEl) => {
      const embedType = embedEl.getAttribute('data-embed-type');
      const thumbnailUrl = embedEl.getAttribute('data-thumbnail');
      const videoId = embedEl.getAttribute('data-video-id');
      const tweetUrl = embedEl.getAttribute('data-tweet-url');
      const instagramUrl = embedEl.getAttribute('data-instagram-url');
      const tiktokUrl = embedEl.getAttribute('data-tiktok-url');

      embeds.push({
        type: embedType,
        thumbnailUrl: thumbnailUrl,
        element: embedEl,
        videoId: videoId,
        tweetUrl: tweetUrl,
        instagramUrl: instagramUrl,
        tiktokUrl: tiktokUrl,
        mediaType: 'embed'
      });
    });

    return embeds;
  }

  /**
   * Extract all images from the post content
   */
  function extractImages() {
    const images = [];
    const imageElements = document.querySelectorAll(
      '.post-content img:not(.post-author-avatar):not(.gravatar)'
    );

    imageElements.forEach((img) => {
      // Check if image has width/height attributes or loaded dimensions
      const width = img.naturalWidth || parseInt(img.getAttribute('width')) || 0;
      const height = img.naturalHeight || parseInt(img.getAttribute('height')) || 0;

      // Skip very small images (likely icons or decorative elements)
      // If dimensions aren't available yet, include the image anyway
      if (width > 0 && height > 0 && (width < 100 || height < 100)) {
        return;
      }

      // Get the full-size image URL from the parent anchor or the img itself
      let fullUrl = img.src;
      const parentAnchor = img.closest('a');
      if (parentAnchor && parentAnchor.href) {
        const href = parentAnchor.href;
        // Check if anchor href is actually an image
        if (href.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i) ||
            href.includes('cloudinary.com')) {
          fullUrl = href;
        }
      }

      images.push({
        type: 'image',
        thumbnailUrl: img.src,
        fullUrl: fullUrl,
        alt: img.alt || '',
        mediaType: 'image',
        element: img
      });
    });

    return images;
  }

  /**
   * Create thumbnail card HTML
   */
  function createThumbnailCard(item, index) {
    const card = document.createElement('div');
    card.className = 'embed-thumbnail-card';
    card.setAttribute('data-media-index', index);

    // Thumbnail image
    const thumbnail = document.createElement('div');
    thumbnail.className = 'embed-thumbnail-image';

    // Add data attribute to distinguish images from embeds (for CSS styling)
    if (item.mediaType === 'image') {
      thumbnail.setAttribute('data-media-type', 'image');
    }

    // Set background image
    if (item.thumbnailUrl) {
      thumbnail.style.backgroundImage = `url('${item.thumbnailUrl}')`;
    }

    // Platform label (for embeds, not for images)
    if (item.mediaType === 'embed') {
      const platformLabel = document.createElement('span');
      platformLabel.className = `embed-thumbnail-platform ${item.type}`;
      platformLabel.textContent = item.type;
      thumbnail.appendChild(platformLabel);
    }

    card.appendChild(thumbnail);

    // Click handler to open modal at this index
    card.addEventListener('click', () => {
      openModal(index);
    });

    return card;
  }

  /**
   * Open modal with media item at specified index
   */
  function openModal(index) {
    const modal = document.getElementById('embed-modal');
    const modalBody = modal.querySelector('.embed-modal-body');

    if (!modal || !modalBody) {
      return;
    }

    currentIndex = index;
    const item = allMedia[currentIndex];

    // Clear modal body
    modalBody.innerHTML = '';

    if (item.mediaType === 'image') {
      // Create full-size image element
      const img = document.createElement('img');
      img.src = item.fullUrl;
      img.alt = item.alt;
      img.style.maxWidth = '100%';
      img.style.maxHeight = '85vh';
      img.style.display = 'block';
      img.style.margin = '0 auto';
      modalBody.appendChild(img);
    } else if (item.mediaType === 'embed') {
      // Clone the embed element
      const embedClone = item.element.cloneNode(true);
      modalBody.appendChild(embedClone);

      // For Twitter, Instagram, TikTok - reinitialize widgets
      if (item.type === 'twitter' && window.twttr && window.twttr.widgets) {
        window.twttr.widgets.load(modalBody);
      } else if (item.type === 'instagram' && window.instgrm && window.instgrm.Embeds) {
        window.instgrm.Embeds.process();
      } else if (item.type === 'tiktok' && window.tiktokEmbed) {
        // TikTok embed reinitialization if needed
      }
    }

    // Show modal
    modal.style.display = 'flex';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // Update navigation button states
    updateNavigationButtons();
  }

  /**
   * Navigate to previous media item
   */
  function navigatePrevious() {
    if (currentIndex > 0) {
      openModal(currentIndex - 1);
    }
  }

  /**
   * Navigate to next media item
   */
  function navigateNext() {
    if (currentIndex < allMedia.length - 1) {
      openModal(currentIndex + 1);
    }
  }

  /**
   * Update navigation button states
   */
  function updateNavigationButtons() {
    const prevBtn = document.querySelector('.modal-nav-prev');
    const nextBtn = document.querySelector('.modal-nav-next');

    if (prevBtn) {
      prevBtn.style.display = currentIndex > 0 ? 'flex' : 'none';
    }

    if (nextBtn) {
      nextBtn.style.display = currentIndex < allMedia.length - 1 ? 'flex' : 'none';
    }
  }

  /**
   * Close modal
   */
  function closeModal() {
    const modal = document.getElementById('embed-modal');
    if (!modal) {
      return;
    }

    modal.style.display = 'none';
    document.body.style.overflow = '';

    // Clear modal body
    const modalBody = modal.querySelector('.embed-modal-body');
    if (modalBody) {
      modalBody.innerHTML = '';
    }
  }

  /**
   * Get or create thumbnails sidebar
   */
  function getOrCreateSidebar() {
    // Check if sidebar already exists
    let embedsSidebar = document.querySelector('.post-adaptive-embeds');

    if (!embedsSidebar) {
      // Create new sidebar for 2-column layouts
      const container = document.querySelector('.post-adaptive-container');
      if (!container) return null;

      // Convert to 3-column by adding media sidebar
      container.classList.remove('post-adaptive-two-column');
      container.classList.add('post-adaptive-three-column');

      embedsSidebar = document.createElement('div');
      embedsSidebar.className = 'post-adaptive-sidebar post-adaptive-embeds';
      embedsSidebar.innerHTML = `
        <div class="embed-thumbnails-container">
          <h3 class="embed-thumbnails-title">Media</h3>
          <div class="embed-thumbnails-list"></div>
        </div>
      `;

      container.appendChild(embedsSidebar);
    }

    return embedsSidebar.querySelector('.embed-thumbnails-list');
  }

  /**
   * Initialize thumbnail gallery
   */
  function init() {
    const embeds = extractEmbeds();
    const images = extractImages();

    // Combine embeds and images into single media array
    allMedia = [...embeds, ...images];

    if (allMedia.length === 0) {
      // No media found
      return;
    }

    // Get or create thumbnails list
    const thumbnailsList = getOrCreateSidebar();
    if (!thumbnailsList) {
      return;
    }

    // Create thumbnail cards
    allMedia.forEach((item, index) => {
      const card = createThumbnailCard(item, index);
      thumbnailsList.appendChild(card);

      // Hide images from main content on desktop (they're now in sidebar)
      // On mobile, images will show in content since sidebar is hidden
      if (item.mediaType === 'image' && item.element) {
        // Add a class to hide on desktop only
        const parentAnchor = item.element.closest('a');
        if (parentAnchor) {
          parentAnchor.classList.add('hide-on-desktop');
        } else {
          item.element.classList.add('hide-on-desktop');
        }
      }
    });

    // Setup modal close handlers
    const modal = document.getElementById('embed-modal');
    const closeBtn = modal.querySelector('.embed-modal-close');
    const overlay = modal.querySelector('.embed-modal-overlay');
    const prevBtn = modal.querySelector('.modal-nav-prev');
    const nextBtn = modal.querySelector('.modal-nav-next');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeModal);
    }

    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', navigatePrevious);
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', navigateNext);
    }

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (modal.style.display === 'flex') {
        if (e.key === 'Escape') {
          closeModal();
        } else if (e.key === 'ArrowLeft') {
          navigatePrevious();
        } else if (e.key === 'ArrowRight') {
          navigateNext();
        }
      }
    });
  }

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
