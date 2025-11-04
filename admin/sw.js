// Service Worker for Admin Interface
// Provides offline capability and faster repeat visits

const CACHE_NAME = 'admin-v6';

// Only cache same-origin resources during install
const urlsToCache = [
  '/admin/',
  '/admin/index.html',
  '/admin/app.js',
  '/admin/admin.css'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Cache same-origin resources only
        return cache.addAll(urlsToCache);
      })
      .catch(err => {
        console.error('Cache installation failed:', err);
      })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control immediately
  return self.clients.claim();
});

// Fetch event - strategy depends on resource type
self.addEventListener('fetch', event => {
  // Skip cross-origin requests, API calls, and non-GET requests
  if (!event.request.url.startsWith(self.location.origin) ||
      event.request.url.includes('/.netlify/functions/') ||
      event.request.method !== 'GET') {
    return;
  }

  // Network-first strategy for JavaScript modules (always get fresh code)
  if (event.request.url.includes('/admin/js/')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh response for offline use
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, fallback to cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // Cache-first strategy for other resources (HTML, CSS, images)
  event.respondWith(
    caches.match(event.request, { ignoreSearch: false })
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(response => {
          // Check if valid response
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone the response
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(cache => {
              cache.put(event.request, responseToCache);
            });

          return response;
        });
      })
  );
});
