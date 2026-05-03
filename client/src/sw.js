import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';

// VitePWA injects the precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ─── Push Notifications ────────────────────────────────────────────────────
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
    // Tag collapses duplicate notifications for the same chat
    tag: `chat-${data.chatId || 'general'}`,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      chatId: data.chatId,
      url: '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification Click ────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/';
  const chatId = event.notification.data?.chatId;

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // If the app is already open, focus it and pass the chatId
        for (const client of clientList) {
          if ('focus' in client) {
            if (chatId) {
              client.postMessage({ type: 'OPEN_CHAT', chatId });
            }
            return client.focus();
          }
        }
        // Otherwise open a new window
        return clients.openWindow(targetUrl);
      })
  );
});

// ─── Skip waiting so new SW activates immediately ─────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
