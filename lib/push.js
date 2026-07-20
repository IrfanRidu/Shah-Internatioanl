// Web Push Notifications utility
// Install: npm install web-push
// Generate keys: npx web-push generate-vapid-keys

let webpush;
async function getWebPush() {
  if (!webpush) {
    webpush = await import('web-push');
    webpush.setVapidDetails(
      process.env.VAPID_EMAIL || 'mailto:admin@shahintl.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
      process.env.VAPID_PRIVATE_KEY || ''
    );
  }
  return webpush;
}

export async function sendPushNotification(subscription, payload) {
  try {
    const wp = await getWebPush();
    await wp.sendNotification(subscription, JSON.stringify(payload));
    return true;
  } catch (e) {
    console.error('Push notification failed:', e);
    return false;
  }
}

export async function sendPushToMany(subscriptions, payload) {
  const results = await Promise.allSettled(
    subscriptions.map(sub => sendPushNotification(sub, payload))
  );
  return { sent: results.filter(r => r.status === 'fulfilled').length, failed: results.filter(r => r.status === 'rejected').length };
}
