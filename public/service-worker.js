const CACHE_NAME = 'dibie-v2'
const urlsToCache = [
  '/',
  '/index.html',
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
  const { request } = event

  // Ne gérer que les requêtes GET
  if (request.method !== 'GET') return

  // Navigation : network-first avec fallback vers le cache (offline-first)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          return response
        })
        .catch(() =>
          caches.match(request).then(r => r || caches.match('/index.html'))
        )
    )
    return
  }

  // Assets (JS/CSS/images) : cache-first avec mise à jour en arrière-plan
  event.respondWith(
    caches.match(request).then(cached => {
      const fetchPromise = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone))
          }
          return response
        })
        .catch(() => cached)
      return cached || fetchPromise
    })
  )
})
