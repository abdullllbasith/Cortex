self.addEventListener('push', (event) => {
  let payload = { title: 'SAIOS', body: 'New notification', url: '/notifications', severity: 'INFO' }
  try {
    if (event.data) payload = { ...payload, ...JSON.parse(event.data.text()) }
  } catch {
    /* use defaults */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: payload.url },
      tag: 'saios-notification',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/notifications'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) return client.navigate(url)
        }
      }
      if (clients.openWindow) return clients.openWindow(url)
    }),
  )
})
