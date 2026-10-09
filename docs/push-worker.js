self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const options = {
    body: data.body || 'Há uma nova atualização.',
    data: { url: data.url || '/' },
    tag: data.tag || 'automacao-notification',
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(data.title || 'Automação', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data.url));
});
