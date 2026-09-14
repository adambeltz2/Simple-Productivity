// Notebook service worker (PWA support -- see BACKLOG.md).
//
// Caches the static app shell plus the Dropbox SDK loaded from jsdelivr, so
// a repeat visit -- including fully offline -- works without hitting the
// network again. There's no build step to hash filenames for cache-busting,
// so CACHE_NAME is bumped by hand; do that whenever a shipped file's content
// changes, so the old cache is evicted on the next activate rather than
// silently serving stale bytes forever. Mirrors Simple Gantt's sw.js.
const CACHE_NAME = 'notebook-v0.12.0';

// Same-origin files only -- cache.addAll() fails the whole install if any
// one fetch fails, and a transient CDN hiccup shouldn't block the service
// worker from installing at all. The Dropbox SDK is picked up by the
// runtime cache-first path below on the first real page load instead.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/favicon-16.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only GET is cacheable; everything else (Dropbox's own API calls, made
  // directly from the page, not through this worker) passes through.
  if (event.request.method !== 'GET') return;

  const isSameOrigin = new URL(event.request.url).origin === self.location.origin;
  event.respondWith(isSameOrigin ? networkFirst(event.request) : cacheFirst(event.request));
});

// App shell: network-first, so a redeploy is picked up immediately whenever
// there's connectivity, falling back to cache so the app still opens offline.
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw err;
  }
}

// The Dropbox SDK: cache-first. It's pinned to an exact version with a real
// SRI hash (per CLAUDE.md's dependency rules), so re-fetching it on every
// load buys nothing except breaking offline use, which is the whole point
// of caching it at all.
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, response.clone());
  return response;
}
