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
 * Check if push is supported and current permission status
 */
export async function getPushStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { supported: false, permission: 'unsupported' };
  }
  return { 
    supported: true, 
    permission: Notification.permission 
  };
}

/**
 * Full push registration flow:
 * 1. Get VAPID public key from server
 * 2. Register (or reuse) the service worker
 * 3. Request notification permission (MUST be called from user gesture)
 * 4. Subscribe to push via PushManager
 * 5. POST the subscription object to the server so it can send pushes
 */
export async function setupPushNotifications() {
  try {
    console.log('[Push] Starting setup...');
    
    // Feature detect
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Not supported in this browser.');
      return { success: false, error: 'Not supported' };
    }

    // 1. Request permission first — MUST be from user gesture on mobile
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission status:', permission);
    if (permission !== 'granted') {
      return { success: false, error: 'Permission denied' };
    }

    // 2. Get VAPID public key from server
    const { data } = await api.get('/push/vapidPublicKey');
    const vapidPublicKey = data.publicKey;
    if (!vapidPublicKey) throw new Error('No VAPID public key from server');

    // 3. Wait for the service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    console.log('[Push] Service worker ready');

    // 4. Subscribe (idempotent — returns existing sub if already subscribed)
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    console.log('[Push] Subscription created');

    // 5. Send subscription to server
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });

    console.log('[Push] Subscription saved to server');
    return { success: true };
  } catch (err) {
    console.error('[Push] Setup failed:', err);
    return { success: false, error: err.message };
  }
}
