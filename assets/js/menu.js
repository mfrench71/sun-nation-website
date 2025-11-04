/**
 * Mega Menu & Mobile Drawer JavaScript
 * Handles dropdown interactions and mobile menu behavior
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    initDesktopDropdowns();
    initMobileAccordions();
  });

  /**
   * Initialize mobile menu drawer
   */
  function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const overlay = document.querySelector('.mobile-drawer-overlay');
    const drawer = document.querySelector('.mobile-drawer');
    const closeBtn = document.querySelector('.mobile-drawer-close');

    if (!toggle || !overlay || !drawer) return;

    // Open drawer
    toggle.addEventListener('click', function() {
      toggle.classList.add('active');
      overlay.classList.add('active');
      drawer.classList.add('active');
      document.body.style.overflow = 'hidden'; // Prevent body scroll

      // Collapse all accordions when opening drawer
      collapseAllAccordions();
    });

    // Close drawer
    function closeDrawer() {
      toggle.classList.remove('active');
      overlay.classList.remove('active');
      drawer.classList.remove('active');
      document.body.style.overflow = ''; // Restore body scroll
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', closeDrawer);
    }

    // Close on overlay click
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        closeDrawer();
      }
    });

    // Close on escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && drawer.classList.contains('active')) {
        closeDrawer();
      }
    });
  }

  /**
   * Initialize desktop dropdown menus
   * Relies primarily on CSS :hover with minimal JS for touch devices
   */
  function initDesktopDropdowns() {
    const dropdowns = document.querySelectorAll('.has-dropdown');

    dropdowns.forEach(function(dropdown) {
      // Click toggle for touch devices only
      const link = dropdown.querySelector('.nav-link');
      if (link) {
        link.addEventListener('click', function(e) {
          // On touch devices, prevent navigation and toggle dropdown
          if ('ontouchstart' in window) {
            if (!dropdown.classList.contains('active')) {
              e.preventDefault();
              // Close other dropdowns
              document.querySelectorAll('.has-dropdown.active').forEach(function(other) {
                if (other !== dropdown) {
                  other.classList.remove('active');
                }
              });
              dropdown.classList.add('active');
            }
          }
        });
      }
    });

    // Close dropdowns when clicking outside (touch devices)
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.has-dropdown')) {
        document.querySelectorAll('.has-dropdown.active').forEach(function(dropdown) {
          dropdown.classList.remove('active');
        });
      }
    });
  }

  /**
   * Collapse all mobile accordions
   */
  function collapseAllAccordions() {
    document.querySelectorAll('.mobile-accordion-toggle').forEach(function(accordion) {
      accordion.classList.remove('active');
      if (accordion.nextElementSibling) {
        accordion.nextElementSibling.classList.remove('active');
      }
    });
  }

  /**
   * Initialize mobile accordion menus
   */
  function initMobileAccordions() {
    const accordions = document.querySelectorAll('.mobile-accordion-toggle');

    accordions.forEach(function(accordion) {
      accordion.addEventListener('click', function() {
        const content = this.nextElementSibling;
        const isActive = this.classList.contains('active');

        // Close all accordions
        document.querySelectorAll('.mobile-accordion-toggle').forEach(function(item) {
          item.classList.remove('active');
          item.nextElementSibling.classList.remove('active');
        });

        // Open clicked accordion if it wasn't active
        if (!isActive) {
          this.classList.add('active');
          content.classList.add('active');
        }
      });
    });
  }

  /**
   * Handle window resize - close mobile menu if switching to desktop
   */
  let resizeTimeout;
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      if (window.innerWidth > 900) {
        // Desktop view - close mobile menu
        const toggle = document.querySelector('.mobile-menu-toggle');
        const overlay = document.querySelector('.mobile-drawer-overlay');
        const drawer = document.querySelector('.mobile-drawer');

        if (toggle) toggle.classList.remove('active');
        if (overlay) overlay.classList.remove('active');
        if (drawer) drawer.classList.remove('active');
        document.body.style.overflow = '';
      }
    }, 250);
  });

})();
