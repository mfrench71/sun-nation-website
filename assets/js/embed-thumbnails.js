/**
 * Embed Thumbnails - Extract embeds and create thumbnail gallery
 * For use with post-adaptive layout
 */

(function() {
  'use strict';

  // Only run on adaptive layout pages
  const adaptiveContainer = document.querySelector('.post-adaptive-three-column');
  if (!adaptiveContainer) {
    return;
  }

  const thumbnailsList = document.querySelector('.embed-thumbnails-list');
  if (!thumbnailsList) {
    return;
  }

  /**
   * Extract all embeds from the post content
   */
  function extractEmbeds() {
    const embeds = [];
    const embedElements = document.querySelectorAll(
      '.post-content [data-embed-type]'
    );

    embedElements.forEach((embedEl, index) => {
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
        index: index,
        videoId: videoId,
        tweetUrl: tweetUrl,
        instagramUrl: instagramUrl,
        tiktokUrl: tiktokUrl
      });
    });

    return embeds;
  }

  /**
   * Create thumbnail card HTML
   */
  function createThumbnailCard(embed) {
    const card = document.createElement('div');
    card.className = 'embed-thumbnail-card';
    card.setAttribute('data-embed-index', embed.index);

    // Platform label
    const platformLabel = document.createElement('span');
    platformLabel.className = `embed-thumbnail-platform ${embed.type}`;
    platformLabel.textContent = embed.type;

    // Thumbnail image
    const thumbnail = document.createElement('div');
    thumbnail.className = 'embed-thumbnail-image';

    // Set background image
    if (embed.thumbnailUrl) {
      thumbnail.style.backgroundImage = `url('${embed.thumbnailUrl}')`;
    }

    thumbnail.appendChild(platformLabel);
    card.appendChild(thumbnail);

    // Click handler to open modal
    card.addEventListener('click', () => {
      openEmbedModal(embed);
    });

    return card;
  }

  /**
   * Open modal with full embed
   */
  function openEmbedModal(embed) {
    const modal = document.getElementById('embed-modal');
    const modalBody = modal.querySelector('.embed-modal-body');

    if (!modal || !modalBody) {
      return;
    }

    // Clone the embed element
    const embedClone = embed.element.cloneNode(true);

    // Clear modal body and insert embed
    modalBody.innerHTML = '';
    modalBody.appendChild(embedClone);

    // Show modal
    modal.style.display = 'flex';

    // Prevent body scroll
    document.body.style.overflow = 'hidden';

    // For Twitter, Instagram, TikTok - reinitialize widgets
    if (embed.type === 'twitter' && window.twttr && window.twttr.widgets) {
      window.twttr.widgets.load(modalBody);
    } else if (embed.type === 'instagram' && window.instgrm && window.instgrm.Embeds) {
      window.instgrm.Embeds.process();
    } else if (embed.type === 'tiktok' && window.tiktokEmbed) {
      // TikTok embed reinitialization if needed
    }
  }

  /**
   * Close modal
   */
  function closeEmbedModal() {
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
   * Initialize thumbnail gallery
   */
  function init() {
    const embeds = extractEmbeds();

    if (embeds.length === 0) {
      // No embeds found, hide the sidebar
      const embedsSidebar = document.querySelector('.post-adaptive-embeds');
      if (embedsSidebar) {
        embedsSidebar.style.display = 'none';
      }
      return;
    }

    // Create thumbnail cards
    embeds.forEach(embed => {
      const card = createThumbnailCard(embed);
      thumbnailsList.appendChild(card);
    });

    // Setup modal close handlers
    const modal = document.getElementById('embed-modal');
    const closeBtn = modal.querySelector('.embed-modal-close');
    const overlay = modal.querySelector('.embed-modal-overlay');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeEmbedModal);
    }

    if (overlay) {
      overlay.addEventListener('click', closeEmbedModal);
    }

    // Close on ESC key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        closeEmbedModal();
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
