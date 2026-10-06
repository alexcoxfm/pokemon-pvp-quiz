// sw.js — Service worker with three-tier caching strategy
//
// Bump CACHE_VERSION whenever app-shell files change so installed copies
// pick up the new code (the app shell is network-first, but this also clears
// out old caches).

const CACHE_VERSION = 'v2';
const APP_CACHE = `app-shell-${CACHE_VERSION}`;
const DATA_CACHE = `pvpoke-data-${CACHE_VERSION}`;
const IMAGE_CACHE = `pokemon-images-${CACHE_VERSION}`;
const IMAGE_CACHE_LIMIT = 500;

// App shell files to precache
const APP_SHELL = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/data.js',
  './js/form-map.js',
  './js/pokemon-mapper.js',
  './js/quiz.js',
  './js/type-chart.js',
  './js/ui.js',
  './manifest.json',
  './img/icon-192.png',
  './img/icon-512.png',
];

// Install: precache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== APP_CACHE && key !== DATA_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch: three-tier strategy
self.addEventListener('fetch', (event) => {
  // The Cache API only stores GET requests (HEAD checks etc. go straight to network)
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Tier 1: App Shell — network-first so deploys show up, cache when offline
  if (isAppShell(url, event.request)) {
    event.respondWith(networkFirst(event.request, APP_CACHE));
    return;
  }

  // Tier 2: PvPoke data — network-first. data.js already keeps its own
  // 24h IndexedDB copy, so a stale SW copy would just delay meta updates.
  if (isPvpokeData(url)) {
    event.respondWith(networkFirst(event.request, DATA_CACHE));
    return;
  }

  // Tier 3: Pokemon Images — cache-first with LRU
  if (isPokemonImage(url)) {
    event.respondWith(cacheFirstWithLRU(event.request, IMAGE_CACHE));
    return;
  }

  // Default: let the browser handle it
});

// === URL matchers ===

function isAppShell(url, request) {
  if (url.origin !== self.location.origin) return false;
  const path = url.pathname;
  return path.endsWith('.html') || path.endsWith('.css') || path.endsWith('.js') ||
         path.endsWith('.png') || path.endsWith('.json') || path === '/' ||
         path.endsWith('/');
}

function isPvpokeData(url) {
  return url.hostname === 'raw.githubusercontent.com' &&
         url.pathname.includes('/pvpoke/');
}

function isPokemonImage(url) {
  return url.hostname === 'raw.githubusercontent.com' &&
         url.pathname.includes('/PokeAPI/');
}

// === Caching strategies ===

async function cacheFirstWithLRU(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    // <img> requests are no-cors, which gives an opaque response (status 0,
    // never .ok) that would never be cached. GitHub raw serves CORS headers,
    // so ask for a CORS response instead.
    const response = await fetch(request.url, { mode: 'cors', credentials: 'omit' });
    if (response.ok) {
      // Evict old entries if over limit
      const keys = await cache.keys();
      if (keys.length >= IMAGE_CACHE_LIMIT) {
        // Remove oldest entries (first in list)
        const toRemove = keys.length - IMAGE_CACHE_LIMIT + 1;
        for (let i = 0; i < toRemove; i++) {
          await cache.delete(keys[i]);
        }
      }
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 404 });
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request, { ignoreSearch: true });
    return cached || new Response('Offline', { status: 503 });
  }
}
