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

})();
