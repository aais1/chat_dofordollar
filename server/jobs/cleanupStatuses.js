import cron from 'node-cron';
import { db } from '../config/db.js';
import { statuses, statusViews } from '../models/schema.js';
import { lt, eq } from 'drizzle-orm';
import { deleteFromCloudinary } from '../services/cloudinary.js';

export const startStatusCleanupJob = () => {
  // Run every 6 hours
  cron.schedule('0 */6 * * *', async () => {
    try {
      const now = new Date();
      const expired = await db.select().from(statuses).where(lt(statuses.expiryTime, now));

      if (!expired.length) {
        console.log('[Cron] No expired statuses to clean.');
        return;
      }

      for (const status of expired) {
        // Delete from Cloudinary
        if (status.mediaUrl) {
          try {
            // Extract public ID from URL
            const parts = status.mediaUrl.split('/');
            const publicId = parts.slice(-2).join('/').split('.')[0];
            const resourceType = status.contentType === 'video' ? 'video' : 'image';
            await deleteFromCloudinary(publicId, resourceType);
          } catch (e) {
            console.warn('[Cron] Could not delete from Cloudinary:', e.message);
          }
        }
        // Delete status views
        await db.delete(statusViews).where(eq(statusViews.statusId, status.id));
      }

      // Delete all expired statuses
      const result = await db.delete(statuses).where(lt(statuses.expiryTime, now));
      console.log(`[Cron] Cleaned ${expired.length} expired status(es).`);
    } catch (err) {
      console.error('[Cron] Status cleanup failed:', err);
    }
  });

  console.log('[Cron] Status cleanup job started (every 6 hours).');
};
