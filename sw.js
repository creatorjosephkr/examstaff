// Service Worker for KCBA Staff Webapp
// BUILD_VERSION will be replaced at build time by vite.config.ts
const BUILD_VERSION = 'mvgsp0vj';
const CACHE_NAME = `kcba-staff-v-${BUILD_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/assets/sounds/start_click.mp3',
  '/assets/sounds/end_click.mp3',
  '/assets/sounds/pause_click.mp3',
  '/assets/sounds/stop_click.mp3',
  '/assets/sounds/dingdong.mp3',
];

// On install, cache static assets only.
// Hashed JS/CSS will be cached dynamically on first fetch.
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing version: ${BUILD_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const promises = STATIC_ASSETS.map(url =>
        cache.add(new Request(url, { cache: 'reload' })).catch(err => {
          console.warn(`[SW] Failed to cache: ${url}`, err);
        })
      );
      return Promise.all(promises);
    })
  );
});

// On activate, clean up ALL old caches and take control immediately.
self.addEventListener('activate', (event) => {
  console.log(`[SW] Activating version: ${BUILD_VERSION}`);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch strategy: Network-first for navigation, Stale-while-revalidate for assets.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Navigation requests (HTML pages): always try network first for freshness
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // For all other GET requests: stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // Network failed, cachedResponse is our only hope (handled below)
          return undefined;
        });

        return cachedResponse || fetchPromise;
      });
    })
  );
});

// Listen for SKIP_WAITING message from the client to activate new SW immediately.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] Received SKIP_WAITING, activating now.');
    self.skipWaiting();
  }
});
