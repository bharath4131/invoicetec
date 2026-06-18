const CACHE_NAME = 'invoiceflow-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/variables.css',
  '/css/base.css',
  '/css/components.css',
  '/css/layout.css',
  '/css/pages.css',
  '/css/animations.css',
  '/css/landing.css',
  '/js/db.js',
  '/js/auth.js',
  '/js/sync.js',
  '/js/invoices.js',
  '/js/customers.js',
  '/js/products.js',
  '/js/company.js',
  '/js/ui.js',
  '/js/router.js',
  '/js/dashboard.js',
  '/js/pdf.js',
  '/js/app.js',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event (Cache First falling back to Network)
self.addEventListener('fetch', (e) => {
  // Only handle HTTP/HTTPS protocols (skip chrome-extension, data, etc.)
  if (!e.request.url.startsWith('http')) return;

  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Cache valid responses if they are part of our static asset pack
        const isStaticAsset = ASSETS.some(asset => e.request.url.endsWith(asset));
        if (isStaticAsset && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseToCache);
          });
        }
        return response;
      });
    })
  );
});
