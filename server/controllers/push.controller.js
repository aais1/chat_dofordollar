import webpush from 'web-push';
import { db } from '../config/db.js';
import { pushSubscriptions } from '../models/schema.js';
import { eq } from 'drizzle-orm';

export const getVapidPublicKey = (req, res) => {
  // Return the same hardcoded public key used at server startup
  const key = 'BDJFeCC1ilNK1w8J-IvPFsCDF8brufd8uxPpmb12hFj8_GXE_tbSBoP1hfEvsFMV1fHA96yiQVHP-CAvocj8dXY';
  res.json({ publicKey: key });
};

// Save subscription for a user
export const saveSubscription = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) return res.status(400).json({ message: 'Subscription required' });
    // Upsert subscription by userId
    const existing = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, req.user.id));
    if (existing.length) {
      await db.update(pushSubscriptions).set({ subscription: JSON.stringify(subscription) }).where(eq(pushSubscriptions.userId, req.user.id));
    } else {
      await db.insert(pushSubscriptions).values({ userId: req.user.id, subscription: JSON.stringify(subscription) });
    }
    res.json({ success: true });
  } catch (err) {
    console.error('saveSubscription error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Send a push notification to a specific user (used internally)
export const sendPushToUser = async (userId, payload) => {
  try {
    const [row] = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    if (!row) {
      console.log(`[Push] No subscription found for userId: ${userId}`);
      return;
    }
    const sub = JSON.parse(row.subscription);
    console.log(`[Push] Sending notification to userId: ${userId}...`);
    await webpush.sendNotification(sub, JSON.stringify(payload));
    console.log(`[Push] Notification sent successfully to userId: ${userId}`);
  } catch (err) {
    console.error(`[Push] Error sending to userId ${userId}:`, err);
  }
};

export default { saveSubscription, sendPushToUser };
