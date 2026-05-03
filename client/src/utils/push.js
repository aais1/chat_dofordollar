// Helper to register service worker and subscribe to push
export async function registerServiceWorkerAndSubscribe(vapidPublicKey) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return null;

    // Convert VAPID key
    const urlBase64ToUint8Array = (base64String) => {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    return { subscription: sub.toJSON(), registration: reg };
  } catch (err) {
    console.error('push subscribe failed', err);
    return null;
  }
}
