/**
 * Edit Links for Decap CMS
 * Shows edit buttons on posts and cards when user is logged in via Netlify Identity
 */

(function() {
  'use strict';

  // Immediately hide all edit links on page load
  function hideAllEditLinks() {
    const editLinks = document.querySelectorAll('.edit-post-link, .edit-card-link');
    editLinks.forEach(link => {
      link.style.display = 'none';
      link.classList.remove('edit-link-visible');
    });
  }

  // Hide links immediately
  hideAllEditLinks();

  // Initialize when Netlify Identity is ready
  function initializeEditLinks() {
    // Check for test mode first (used in admin for local development)
    if (localStorage.getItem('TEST_MODE') === 'true') {
      console.log('Edit links: Test mode enabled, showing edit links');
      updateEditLinks({ email: 'test@playwright.dev' });
      return;
    }

    if (!window.netlifyIdentity) {
      console.warn('Netlify Identity not loaded');
      return;
    }

    // Check current user
    const currentUser = netlifyIdentity.currentUser();
    if (currentUser) {
      console.log('Edit links: User is logged in', currentUser.email);
      updateEditLinks(currentUser);
    } else {
      console.log('Edit links: No user logged in');
    }

    // Listen for auth events
    netlifyIdentity.on('init', user => {
      console.log('Edit links: init event', user?.email);
      updateEditLinks(user);
    });

    netlifyIdentity.on('login', user => {
      console.log('Edit links: login event', user?.email);
      updateEditLinks(user);
    });

    netlifyIdentity.on('logout', () => {
      console.log('Edit links: logout event');
      updateEditLinks(null);
    });
  }

  // Wait for both DOM and Netlify Identity to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Give Netlify Identity a moment to initialize
      setTimeout(initializeEditLinks, 100);
    });
  } else {
    // DOM already loaded
    setTimeout(initializeEditLinks, 100);
  }

  /**
   * Show or hide edit links based on user authentication
   */
  function updateEditLinks(user) {
    const editLinks = document.querySelectorAll('.edit-post-link, .edit-card-link');

    console.log(`Edit links: Found ${editLinks.length} edit links, user: ${user ? 'logged in' : 'not logged in'}`);

    editLinks.forEach(link => {
      if (user) {
        link.style.display = '';
        link.classList.add('edit-link-visible');
        console.log('Edit links: Showing link', link.href);
      } else {
        link.style.display = 'none';
        link.classList.remove('edit-link-visible');
      }
    });
  }

  /**
   * Generate CMS edit URL for a post
   */
  function getEditUrl(postSlug) {
    // Remove date prefix from slug if it exists (YYYY-MM-DD-)
    const cleanSlug = postSlug.replace(/^\d{4}-\d{2}-\d{2}-/, '');
    return `/admin/#/collections/blog/entries/${postSlug}`;
  }

  // Expose globally for inline use
  window.getEditUrl = getEditUrl;
})();
