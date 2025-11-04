/**
 * Lazy Load Post Cards
 * Uses Intersection Observer to load cards as they come into viewport
 */

(function() {
  'use strict';

  // Configuration
  const config = {
    rootMargin: '200px', // Start loading 200px before card enters viewport
    threshold: 0.01
  };

  function initLazyCards() {
    const cards = document.querySelectorAll('.post-card');

    if (!cards.length) return;

    // Check if Intersection Observer is supported
    if ('IntersectionObserver' in window) {
      const cardObserver = new IntersectionObserver(onIntersection, config);

      cards.forEach(card => {
        // Add lazy class to mark unloaded cards
        card.classList.add('lazy-card');
        cardObserver.observe(card);
      });
    } else {
      // Fallback for browsers without Intersection Observer
      cards.forEach(card => {
        card.classList.add('lazy-card-loaded');
      });
    }
  }

  function onIntersection(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const card = entry.target;

        // Load the card
        loadCard(card);

        // Stop observing this card
        observer.unobserve(card);
      }
    });
  }

  function loadCard(card) {
    // Remove lazy class and add loaded class
    card.classList.remove('lazy-card');
    card.classList.add('lazy-card-loaded');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLazyCards);
  } else {
    initLazyCards();
  }

})();
