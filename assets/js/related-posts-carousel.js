/**
 * Related Posts Carousel - Swiper.js Initialization
 *
 * Initializes a responsive carousel for related posts on post detail pages.
 * Features: Arrow navigation, auto-fit slides, manual control, stops at ends.
 */

document.addEventListener('DOMContentLoaded', function() {
  // Only initialize if Swiper and the related posts carousel exist
  if (typeof Swiper === 'undefined') {
    console.warn('Swiper library not loaded');
    return;
  }

  const carouselElement = document.querySelector('.related-posts-swiper');
  if (!carouselElement) {
    return; // No carousel on this page
  }

  // Initialize Swiper
  const relatedPostsSwiper = new Swiper('.related-posts-swiper', {
    // Responsive breakpoints - slides per view
    slidesPerView: 1,
    spaceBetween: 20,

    breakpoints: {
      // Mobile (>600px)
      600: {
        slidesPerView: 2,
        spaceBetween: 20
      },
      // Tablet (>900px)
      900: {
        slidesPerView: 2,
        spaceBetween: 24
      },
      // Desktop (>1200px)
      1200: {
        slidesPerView: 3,
        spaceBetween: 28
      },
      // Desktop Wide (>1400px)
      1400: {
        slidesPerView: 4,
        spaceBetween: 32
      }
    },

    // Navigation arrows
    navigation: {
      nextEl: '.swiper-button-next',
      prevEl: '.swiper-button-prev',
    },

    // Behavior
    loop: false,                    // Stop at ends (no infinite loop)
    slidesPerGroup: 1,              // Advance one slide at a time
    watchOverflow: true,            // Hide navigation if all slides visible
    allowTouchMove: true,           // Enable swipe gestures
    grabCursor: true,               // Show grab cursor on hover

    // Accessibility
    a11y: {
      prevSlideMessage: 'Previous related post',
      nextSlideMessage: 'Next related post',
    },

    // Performance
    watchSlidesProgress: true,
    updateOnWindowResize: true,

    // Preserve lazy loading
    lazy: {
      loadPrevNext: true,
      loadPrevNextAmount: 1,
    },

    // Animation
    speed: 400,
    effect: 'slide',
  });

  // Optional: Log initialization for debugging
  console.log('Related posts carousel initialized with', relatedPostsSwiper.slides.length, 'slides');
});
