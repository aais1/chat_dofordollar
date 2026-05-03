import api from './api.js';

/**
 * Convert a base64url VAPID key to Uint8Array (required by PushManager.subscribe)
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Full push registration flow:
 * 1. Get VAPID public key from server
 * 2. Register (or reuse) the service worker
 * 3. Request notification permission
 * 4. Subscribe to push via PushManager
 * 5. POST the subscription object to the server so it can send pushes
 *
 * Safe to call multiple times — PushManager.subscribe() returns the existing
 * subscription if one already exists for this SW + key combination.
 */
export async function setupPushNotifications() {
  try {
    // Feature detect
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[Push] Not supported in this browser.');
      return false;
    }

    // 1. Request permission first — don't proceed if denied
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('[Push] Permission denied.');
      return false;
    }

    // 2. Get VAPID public key from server
    const { data } = await api.get('/push/vapidPublicKey');
    const vapidPublicKey = data.publicKey;
    if (!vapidPublicKey) throw new Error('No VAPID public key from server');

    // 3. Wait for the service worker to be ready
    const registration = await navigator.serviceWorker.ready;

    // 4. Subscribe (idempotent — returns existing sub if already subscribed)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });

    // 5. Send subscription to server
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });

    console.log('[Push] Subscription saved successfully.');
    return true;
  } catch (err) {
    console.error('[Push] Setup failed:', err);
    return false;
  }
}
