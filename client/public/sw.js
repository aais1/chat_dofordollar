self.addEventListener('push', function(event) {
  let data = {};
  if (event.data) {
    try { data = event.data.json(); } catch (e) { data = { body: event.data.text() }; }
  }

  const title = data.title || 'New message';
  const options = {
    body: data.body || '',
    data: data,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [100, 50, 100],
    requireInteraction: true,
    silent: false,
    tag: data.chatId || 'chat-message'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const data = event.notification.data || {};
  const url = data.chatId ? `/?chat=${data.chatId}` : '/';

  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
    for (let client of windowClients) {
      if (client.url.includes('chatapp.dofordollars.com') && 'focus' in client) {
        client.postMessage({ type: 'OPEN_CHAT', chatId: data.chatId, messageId: data.messageId });
        return client.focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(url);
  }));
});
