/**
 * Embedded Content Handler for Jekyll
 * Handles Leaflet maps and Sketchfab embeds
 * Note: WordPress embeds are pre-processed by convert_wordpress_markup.py
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    makeSketchfabResponsive();
    processLeafletMaps();
    loadTwitterEmbeds();
    loadInstagramEmbeds();
    loadTikTokEmbeds();
  });

  /**
   * Make Sketchfab iframes responsive
   */
  function makeSketchfabResponsive() {
    const sketchfabIframes = document.querySelectorAll('iframe[src*="sketchfab.com"]');

    sketchfabIframes.forEach(function(iframe) {
      // Skip if already wrapped
      if (iframe.parentElement.classList.contains('sketchfab-embed')) {
        return;
      }

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'sketchfab-embed';

      // Wrap the iframe
      iframe.parentNode.insertBefore(wrapper, iframe);
      wrapper.appendChild(iframe);

      // Remove inline width/height attributes
      iframe.removeAttribute('width');
      iframe.removeAttribute('height');
    });
  }

  /**
   * Fix Vimeo embeds with inline styles
   */
  function fixVimeoInlineStyles() {
    const vimeoContainers = document.querySelectorAll('.wp-block-vimeo-create');

    vimeoContainers.forEach(function(container) {
      const wrapper = document.createElement('div');
      wrapper.className = 'embed-container';

      const iframe = container.querySelector('iframe');
      if (iframe) {
        container.parentNode.insertBefore(wrapper, container);
        wrapper.appendChild(iframe);
        container.remove();
      }
    });
  }

  /**
   * Process Leaflet maps from clean markup
   * Initializes maps from <div class="leaflet-map" data-*> elements
   */
  function processLeafletMaps() {
    // Check if Leaflet is loaded
    if (typeof L === 'undefined') {
      return;
    }

    const leafletDivs = document.querySelectorAll('.leaflet-map');

    leafletDivs.forEach(function(mapDiv, index) {
      const lat = parseFloat(mapDiv.getAttribute('data-lat'));
      const lng = parseFloat(mapDiv.getAttribute('data-lng'));
      const zoom = parseInt(mapDiv.getAttribute('data-zoom'));

      if (!lat || !lng || !zoom) return;

      // Create unique map ID
      const mapId = 'leaflet-map-' + index;
      mapDiv.id = mapId;

      // Initialize map (Leaflet will add 'leaflet-container' class automatically)
      setTimeout(function() {
        initializeLeafletMap(mapId, lat, lng, zoom);
      }, 100);
    });
  }

  /**
   * Initialize a Leaflet map with given parameters
   */
  function initializeLeafletMap(mapId, lat, lng, zoom) {
    const mapElement = document.getElementById(mapId);
    if (!mapElement) return;

    try {
      // Create map
      const map = L.map(mapId).setView([lat, lng], zoom);

      // Add OpenStreetMap tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }).addTo(map);

      // Add marker at the location
      L.marker([lat, lng]).addTo(map)
        .bindPopup('Location')
        .openPopup();

      // Fix map rendering issues
      setTimeout(function() {
        map.invalidateSize();
      }, 100);

    } catch (error) {
      mapElement.innerHTML = '<div class="wordpress-embed-placeholder">Map could not be loaded</div>';
    }
  }

  /**
   * Load Twitter embed script if Twitter embeds are present
   */
  function loadTwitterEmbeds() {
    const twitterEmbeds = document.querySelectorAll('.twitter-embed');
    if (twitterEmbeds.length === 0) return;

    // Check if script is already loaded
    if (window.twttr) {
      window.twttr.widgets.load();
      return;
    }

    // Load Twitter widget script
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    document.head.appendChild(script);
  }

  /**
   * Load Instagram embed script if Instagram embeds are present
   */
  function loadInstagramEmbeds() {
    const instagramEmbeds = document.querySelectorAll('.instagram-embed');
    if (instagramEmbeds.length === 0) return;

    // Check if script is already loaded
    if (window.instgrm) {
      window.instgrm.Embeds.process();
      return;
    }

    // Load Instagram embed script
    const script = document.createElement('script');
    script.src = 'https://www.instagram.com/embed.js';
    script.async = true;
    document.head.appendChild(script);
  }

  /**
   * Load TikTok embed script if TikTok embeds are present
   */
  function loadTikTokEmbeds() {
    const tiktokEmbeds = document.querySelectorAll('.tiktok-embed');
    if (tiktokEmbeds.length === 0) return;

    // Check if script is already loaded
    if (window.tiktokEmbed) {
      return;
    }

    // Load TikTok embed script
    const script = document.createElement('script');
    script.src = 'https://www.tiktok.com/embed.js';
    script.async = true;
    document.head.appendChild(script);
    window.tiktokEmbed = true;
  }

})();
