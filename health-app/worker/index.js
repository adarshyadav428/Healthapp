// Custom service worker source, merged into the generated Workbox sw.js by
// @ducanh2912/next-pwa (see customWorkerSrc in next.config.js). Plain JS on
// purpose — this runs in the ServiceWorkerGlobalScope, which the main app's
// tsconfig (DOM lib only) doesn't type, and .js files aren't swept into the
// project-wide `tsc --noEmit` check.

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'GetInShape', body: event.data.text() }
  }

  const { title, body, url, tag } = payload

  event.waitUntil(
    self.registration.showNotification(title || 'GetInShape', {
      body,
      tag,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })
  )
})
