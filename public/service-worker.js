// Service worker de Dibiè. Au build, le module dibieServiceWorker de
// vite.config.js réécrit dans dist/service-worker.js les deux lignes ci-dessous :
// nom de cache versionné et liste complète des fichiers du build. Le script
// change donc à chaque version, ce qui déclenche la mise à jour du navigateur.
// Il n'est pas enregistré en mode développement (src/main.jsx).
const CACHE_NAME = 'dibie-dev'
const urlsToCache = ['/', '/index.html']

// ignoreVary : un serveur qui répond « Vary: Origin » (vite preview, par exemple)
// empêchait de retrouver le JS et le CSS en cache, chargés avec crossorigin :
// page vide hors ligne. Les fichiers ne dépendent pas de l'origine de la requête.
const MATCH_OPTIONS = { ignoreVary: true }

// Tout est mis en cache avant d'activer : hors ligne dès la première visite.
// Si un seul fichier échoue, l'installation échoue : la version précédente et
// son cache restent complets et cohérents (la navigation n'écrit jamais dans le
// cache), et le navigateur réessaiera à la prochaine visite.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache.map(url => new Request(url, { cache: 'reload' }))))
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

  // Navigation : network-first avec fallback vers le cache (offline-first).
  // Une nouvelle version en ligne est donc toujours servie sans attendre.
  // La réponse n'est jamais écrite dans le cache : / et /index.html sont
  // précachés, et un nouveau HTML dans l'ancien cache pointerait vers des
  // fichiers absents (page vide hors ligne après une mise à jour interrompue).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then(cache =>
          cache.match(request, MATCH_OPTIONS).then(r => r || cache.match('/index.html', MATCH_OPTIONS))
        )
      )
    )
    return
  }

  // Assets (JS/CSS/images) : cache-first avec mise à jour en arrière-plan
  event.respondWith(
    caches.open(CACHE_NAME).then(cache => cache.match(request, MATCH_OPTIONS)).then(cached => {
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
