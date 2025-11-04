/**
 * Back to Top Button
 *
 * Creates and manages a floating "back to top" button that appears when scrolling down.
 * Provides smooth scroll-to-top functionality with visibility toggling based on scroll position.
 *
 * Features:
 * - Dynamically creates and injects button into DOM
 * - Shows button after scrolling 300px down
 * - Smooth scroll animation when clicked
 * - Accessible with ARIA labels
 * - SVG arrow icon
 *
 * @module assets/js/back-to-top
 */

(function() {
  'use strict';

  // Create and inject the back to top button
  const backToTopButton = document.createElement('button');
  backToTopButton.id = 'back-to-top';
  backToTopButton.setAttribute('aria-label', 'Back to top');
  backToTopButton.setAttribute('title', 'Back to top');
  backToTopButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';

  document.body.appendChild(backToTopButton);

  /**
   * Shows or hides the back-to-top button based on scroll position
   *
   * Button becomes visible when user scrolls more than 300px down from the top.
   * Uses CSS class 'visible' to trigger fade-in/fade-out transition.
   */
  function toggleBackToTop() {
    if (window.pageYOffset > 300) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  }

  /**
   * Smoothly scrolls the page to the top
   *
   * Uses native smooth scroll behavior for better performance and accessibility.
   *
   * @param {Event} e - Click event
   */
  function scrollToTop(e) {
    e.preventDefault();
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Event listeners
  window.addEventListener('scroll', toggleBackToTop, { passive: true });
  backToTopButton.addEventListener('click', scrollToTop);

  // Initial check
  toggleBackToTop();
})();
