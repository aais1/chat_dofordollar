import { db } from '../config/db.js';
import { statuses, statusViews, users } from '../models/schema.js';
import { eq, gt, sql, and } from 'drizzle-orm';

// POST /api/statuses
export const createStatus = async (req, res) => {
  try {
    const { contentType, mediaUrl, textContent, caption, backgroundColor, duration = 1 } = req.body;
    if (!['image', 'video', 'text'].includes(contentType))
      return res.status(400).json({ message: 'Invalid contentType' });
    if (contentType !== 'text' && !mediaUrl)
      return res.status(400).json({ message: 'mediaUrl required for image/video status' });
    if (contentType === 'text' && !textContent)
      return res.status(400).json({ message: 'textContent required for text status' });

    const expiryTime = new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);
    const [status] = await db.insert(statuses).values({
      userId: req.user.id,
      contentType,
      mediaUrl:        mediaUrl || null,
      textContent:     textContent || null,
      caption:         caption || null,
      backgroundColor: backgroundColor || null,
      expiryTime,
      duration:        parseInt(duration),
    }).returning();
    res.status(201).json({ status });
  } catch (err) {
    console.error('createStatus error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/statuses  - active statuses only
export const getStatuses = async (req, res) => {
  try {
    const now = new Date();
    const activeStatuses = await db
      .select({
        id: statuses.id,
        userId: statuses.userId,
        contentType: statuses.contentType,
        mediaUrl: statuses.mediaUrl,
        textContent: statuses.textContent,
        caption: statuses.caption,
        backgroundColor: statuses.backgroundColor,
        expiryTime: statuses.expiryTime,
        duration: statuses.duration,
        viewCount: statuses.viewCount,
        createdAt: statuses.createdAt,
        userName: users.name,
        userProfilePicture: users.profilePicture,
        userRole: users.role,
      })
      .from(statuses)
      .leftJoin(users, eq(statuses.userId, users.id))
      .where(gt(statuses.expiryTime, now));

    // Attach isViewed flag per status for the current user
    const statusIds = activeStatuses.map(s => s.id);
    let viewedIds = new Set();
    if (statusIds.length > 0) {
      const views = await db.select().from(statusViews)
        .where(eq(statusViews.viewerId, req.user.id));
      viewedIds = new Set(views.map(v => v.statusId));
    }

    const result = activeStatuses.map(s => ({ ...s, isViewed: viewedIds.has(s.id) }));
    res.json({ statuses: result });
  } catch (err) {
    console.error('getStatuses error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/statuses/:statusId/views  (admin)
export const getStatusViews = async (req, res) => {
  try {
    const views = await db
      .select({
        viewerId: statusViews.viewerId,
        viewedAt: statusViews.viewedAt,
        viewerName: users.name,
        viewerPhone: users.phone,
      })
      .from(statusViews)
      .leftJoin(users, eq(statusViews.viewerId, users.id))
      .where(eq(statusViews.statusId, parseInt(req.params.statusId)));
    res.json({ views });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/statuses/:statusId/view
export const recordView = async (req, res) => {
  try {
    const statusId = parseInt(req.params.statusId);
    const viewerId = req.user.id;

    const [existing] = await db.select().from(statusViews)
      .where(and(eq(statusViews.statusId, statusId), eq(statusViews.viewerId, viewerId)));

    if (!existing) {
      await db.insert(statusViews).values({ statusId, viewerId });
      await db.update(statuses).set({ viewCount: sql`${statuses.viewCount} + 1` })
        .where(eq(statuses.id, statusId));
    }
    const [status] = await db.select().from(statuses).where(eq(statuses.id, statusId));
    res.json({ viewCount: status?.viewCount });
  } catch (err) {
    // Ignore unique constraint violations (already viewed)
    res.json({ success: true });
  }
};

// DELETE /api/statuses/:statusId
export const deleteStatus = async (req, res) => {
  try {
    const { statusId } = req.params;
    await db.delete(statuses).where(eq(statuses.id, parseInt(statusId)));
    res.json({ success: true });
  } catch (err) {
    console.error('deleteStatus error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
