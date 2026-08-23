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
  // The tag is the PushKind (lib/pushBudget.ts) — the sender sets both to the
  // same string.
  const kind = event.notification.tag

  // Report the open before navigating. push_sends.opened_at is what turns the
  // budget's back-off into a two-way signal: without it consecutiveIgnored only
  // ever grows, so a user who opens every notification is eventually treated
  // exactly like one who ignores them all. Same-origin fetch, so the session
  // cookie rides along and the route knows who this is. Failure is silent by
  // design — a missed stamp costs one notification, a thrown error costs the
  // navigation.
  const reportOpen = kind
    ? fetch('/api/push/opened', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      }).catch(() => {})
    : Promise.resolve()

  const focusOrOpen = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
    })

  event.waitUntil(Promise.all([reportOpen, focusOrOpen]))
})
