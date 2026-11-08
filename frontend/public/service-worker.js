const CACHE_NAME = 'civicfix-static-v4'
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/civicfix-icon.svg',
  '/icons/civicfix-192.png',
  '/icons/civicfix-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME)
    await cache.addAll(APP_SHELL)
    const html = await (await fetch('/index.html')).text()
    const assets = [...html.matchAll(/(?:src|href)="([^"]*\/assets\/[^"]+)"/g)]
      .map((match) => match[1])
    await cache.addAll([...new Set(assets)])
  })())
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key.startsWith('civicfix-static-') && key !== CACHE_NAME)
        .map((key) => caches.delete(key)),
    )),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/uploads/')) return

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(request)),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/images/') ||
      url.pathname === '/manifest.webmanifest' || url.pathname === '/civicfix-icon.svg') {
    let cacheWrite
    const responsePromise = caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        if (response.ok) {
          cacheWrite = caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()))
        }
        return response
      })
    })
    event.respondWith(responsePromise)
    event.waitUntil(responsePromise.then(() => cacheWrite))
  }
})
