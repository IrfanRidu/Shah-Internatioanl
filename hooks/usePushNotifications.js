'use client';
import { useState, useEffect } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if ('Notification' in window) setPermission(Notification.permission);
    if ('serviceWorker' in navigator && permission === 'granted') {
      navigator.serviceWorker.ready.then(reg => {
        reg.pushManager.getSubscription().then(sub => setSubscribed(!!sub));
      });
    }
  }, [permission]);

  const subscribe = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') return false;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      });
      await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub }),
      });
      setSubscribed(true);
      return true;
    } catch (e) { console.error(e); return false; }
  };

  const unsubscribe = async () => {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      await fetch('/api/notifications/subscribe', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
    }
    setSubscribed(false);
  };

  return { permission, subscribed, subscribe, unsubscribe };
}
