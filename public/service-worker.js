const CACHE_NAME = 'dibie-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/src/main.jsx',
]

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      )
    }).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', event => {
  // Network first strategy
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Clone the response
        const responseClone = response.clone()
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseClone)
        })
        return response
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(event.request)
          .then(response => response || new Response('Offline - Resource not available', {
            status: 503,
            statusText: 'Service Unavailable'
          }))
      })
  )
})
