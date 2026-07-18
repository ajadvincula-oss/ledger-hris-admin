// Ledger HRIS — Service Worker
// Network-first for the app shell (HTML) so updates always show up immediately.
// Cache-first for static assets (fonts, JS libraries) for speed and offline support.

const CACHE_NAME = 'ledger-hris-v3';
const ASSETS_TO_CACHE = [
  'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,600;9..144,700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js'
];

// Install — cache static assets only (not the HTML shell)
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {});
    })
  );
});

// Activate — clean old caches immediately and take control of open pages
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch
self.addEventListener('fetch', event => {
  // Never cache Supabase API calls — always live
  if (event.request.url.includes('supabase.co')) {
    return;
  }

  const isNavigation = event.request.mode === 'navigate' ||
    (event.request.method === 'GET' && event.request.headers.get('accept')?.includes('text/html'));

  if (isNavigation) {
    // Network-first for the HTML app shell — always fetch the latest version
    // when online; only fall back to cache when offline.
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for everything else (fonts, JS libraries, etc.)
  event.respondWith(
    caches.open(CACHE_NAME).then(cache =>
      cache.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok && event.request.method === 'GET') {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(() => cached);
      })
    )
  );
});
