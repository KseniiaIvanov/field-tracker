const CACHE_NAME = 'field-tracker-v4'

const STATIC_ASSETS = [
  '/field-tracker/',
  '/field-tracker/index.html',
  '/field-tracker/manifest.json',
  '/field-tracker/favicon.svg'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting()
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    )
  )
  self.clients.claim()
})

// Fetch event - network-first for ALL same-origin requests
// This ensures JS codec chunks (geotiff, lzw, deflate, etc.) are always fresh
// and never served from a stale cache after a new deploy.
// Falls back to cache only when offline.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Skip cross-origin (fonts, CDN, etc.)
  if (url.origin !== location.origin) return

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((c) => c.put(request, clone))
        }
        return response
      })
      .catch(() => {
        // Offline fallback - serve from cache
        return caches.match(request)
      })
  )
})

// Handle skip-waiting messages
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
