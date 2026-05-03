// Custom Service Worker for push notifications
// This file is placed in /public/sw-push.js and imported via importScripts
// VitePWA injects the workbox precache layer; this adds the push handler.

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'New Message', body: event.data.text() };
  }

  const title = data.title || 'ChatApp';
  const options = {
    body: data.body || 'You have a new message.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: `chat-${data.chatId || 'general'}`,   // collapse duplicate notifications per chat
    renotify: true,
    data: {
      chatId: data.chatId,
      url: '/',
    },
    actions: [
      { action: 'open', title: 'Open Chat' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'OPEN_CHAT', chatId: event.notification.data?.chatId });
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
