// Service Worker for TesterTribe PWA
const CACHE_NAME = 'testertribe-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/css/style.css',
  '/js/main.js',
  '/js/app.js',
  '/js/auth.js',
  '/js/cache.js',
  '/js/constants.js',
  '/js/detail.js',
  '/js/dev-profile.js',
  '/js/home.js',
  '/js/m3-dialog.js',
  '/js/market.js',
  '/js/modals.js',
  '/js/publish.js',
  '/js/router.js',
  '/js/tabs.js',
  '/js/template-loader.js',
  '/js/utils.js',
  '/templates/app-detail.html',
  '/templates/contact.html',
  '/templates/dev-profile.html',
  '/templates/guidelines.html',
  '/templates/header.html',
  '/templates/home.html',
  '/templates/login.html',
  '/templates/market.html',
  '/templates/modals.html',
  '/templates/privacy.html',
  '/templates/publish.html',
  '/templates/terms.html'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - network first for API, cache first for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') return;
  
  // Skip Firebase and external API requests
  if (url.hostname.includes('firebase') || 
      url.hostname.includes('googleapis') ||
      url.hostname.includes('gstatic') ||
      url.hostname.includes('googleusercontent')) {
    return;
  }
  
  // Network first for HTML (SPA navigation)
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  
  // Cache first for static assets (CSS, JS, images)
  if (request.destination === 'style' || 
      request.destination === 'script' || 
      request.destination === 'image' ||
      request.destination === 'font') {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Update cache in background
            fetch(request).then((response) => {
              if (response.ok) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, response));
              }
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return response;
          });
        })
    );
    return;
  }
  
  // Default: network first
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// Handle messages from client
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});