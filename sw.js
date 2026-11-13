/* CHUSBC Progressive Web App — service worker
 *
 * Paths are relative to this file, which must live next to index.html
 * (the site root). That keeps it working both on the GitHub Pages preview
 * (/CHUSBC-Website-Redesign/) and later on https://chusbc.org/ (root).
 *
 * Strategies:
 *   - App shell: precached on install
 *   - results-index.json and HTML navigations: network-first (stay fresh)
 *   - Static assets (js/css/images/fonts): cache-first
 *   - directors.html: network-only, never cached (staff portal)
 *   - Offline fallback: offline.html for failed navigations
 *
 * Bump CACHE_VERSION whenever the shell files change so old caches are dropped.
 */
const CACHE_VERSION = 'chusbc-pwa-v3';
const SHELL_CACHE = 'chusbc-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'chusbc-runtime-' + CACHE_VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.webmanifest',
  './js/app.js',
  './js/site-data.js',
  './js/ask-chusbc.js',
  './js/install.js',
  './css/ask-chusbc.css',
  './assets/logo.jpg',
  './assets/chusbc-badge.png',
  './assets/chusbc-badge-512.webp',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-512-maskable.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon-32.png',
  './assets/icons/favicon-16.png',
  './assets/icons/favicon.ico',
  './assets/forest-hill-lanes.jpg',
  './assets/apg-brewner-lanes.jpg',
  './assets/bowl-usbc-logo.svg',
  './assets/bowl-usbc-logo-text.svg',
  './assets/bowl-standing.png',
  './assets/bowl-find-member.png',
  './assets/legacy-computing-logo.jpg'
];

const CDN_HOSTS = new Set([
  'cdn.tailwindcss.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdnjs.cloudflare.com'
]);

function resolve(path) {
  return new URL(path, self.location).href;
}

function sameOrigin(url) {
  return url.origin === self.location.origin;
}

function isDirectors(url) {
  return /\/directors\.html$/i.test(url.pathname);
}

function isResultsIndex(url) {
  return /\/results-index\.json$/i.test(url.pathname);
}

function isNavigation(request, url) {
  if (request.mode === 'navigate') return true;
  if (request.destination === 'document') return true;
  return sameOrigin(url) && (url.pathname.endsWith('.html') || url.pathname.endsWith('/'));
}

function isStaticAsset(url) {
  return /\.(?:js|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|otf|webmanifest)$/i.test(url.pathname);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    // Add one-by-one so a single missing file does not fail the whole install.
    await Promise.all(SHELL_ASSETS.map(async (path) => {
      try {
        await cache.add(new Request(resolve(path), { cache: 'reload' }));
      } catch (err) {
        console.warn('[chusbc-sw] precache skipped', path, err);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const keys = await caches.keys();
    await Promise.all(keys
      .filter((key) => !keep.has(key))
      .map((key) => caches.delete(key)));
    await self.clients.claim();
    // Warm a fresh copy of the results feed (not a precache). If the first
    // page load fetched results before this worker was in control, the data
    // is still available offline until the next network-first refresh.
    try {
      const req = new Request(resolve('./results-index.json'), { cache: 'reload' });
      const res = await fetch(req);
      if (res && res.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cache.put(req, res);
      }
    } catch (err) {
      console.warn('[chusbc-sw] results cache warm failed', err);
    }
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  let url;
  try {
    url = new URL(request.url);
  } catch (err) {
    return;
  }

  // Staff portal: always hit the network, never store a copy.
  if (sameOrigin(url) && isDirectors(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // Certified results feed: network-first so new Prism entries show up promptly.
  if (sameOrigin(url) && isResultsIndex(url)) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  // HTML / navigations: network-first, then cached shell, then offline page.
  if (sameOrigin(url) && isNavigation(request, url)) {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  // Same-origin static files, plus the CDNs the preview currently uses.
  if (isStaticAsset(url) && (sameOrigin(url) || CDN_HOSTS.has(url.hostname))) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }
});

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const index = await caches.match(resolve('./index.html')) || await caches.match(resolve('./'));
    if (index) return index;
    const offline = await caches.match(resolve('./offline.html'));
    if (offline) return offline;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(cacheName);
    cache.put(request, response.clone());
  }
  return response;
}

/* ------------------------------------------------------------------
   Future: Firebase Cloud Messaging (push notifications)

   When the committee approves going live and Firebase Hosting is in
   place, hook push up here. Do not put API keys or sender IDs in this
   file — keep those in Firebase project config loaded at build/deploy.

   Suggested steps (later):
     1. Import the Firebase messaging service-worker build, e.g.
        importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-app-compat.js');
        importScripts('https://www.gstatic.com/firebasejs/10.x.x/firebase-messaging-compat.js');
        firebase.initializeApp({ ... public Firebase config ... });
        firebase.messaging();
     2. Listen for 'push' and show a notification (natural first trigger:
        a new entry in results-index.json / certified tournament results).
     3. Listen for 'notificationclick' and open the app at
        ./#tournaments/results (or a URL in the payload).

   Leave the handlers commented until that work is approved.
   ------------------------------------------------------------------ */
// self.addEventListener('push', (event) => {
//   // TODO: FCM — parse event.data, then self.registration.showNotification(...)
// });
//
// self.addEventListener('notificationclick', (event) => {
//   // TODO: FCM — event.notification.close(); open ./#tournaments/results
// });
