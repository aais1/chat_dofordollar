import { db } from '../config/db.js';
import { users, chats, messages, statuses, statusViews } from '../models/schema.js';
import { eq } from 'drizzle-orm';
import { uploadToCloudinary } from '../services/cloudinary.js';

// GET /api/users  (admin)
export const getAllUsers = async (req, res) => {
  try {
    const all = await db.select({
      id: users.id, name: users.name, phone: users.phone, role: users.role,
      profilePicture: users.profilePicture, isBlocked: users.isBlocked,
      isMuted: users.isMuted, lastSeen: users.lastSeen, createdAt: users.createdAt,
    }).from(users).where(eq(users.role, 'user'));
    res.json({ users: all });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/:userId/block
export const toggleBlock = async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(req.params.userId)));
    if (!user) return res.status(404).json({ message: 'User not found' });
    const [updated] = await db.update(users).set({ isBlocked: !user.isBlocked })
      .where(eq(users.id, user.id)).returning();
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/:userId/mute
export const toggleMute = async (req, res) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, parseInt(req.params.userId)));
    if (!user) return res.status(404).json({ message: 'User not found' });
    const [updated] = await db.update(users).set({ isMuted: !user.isMuted })
      .where(eq(users.id, user.id)).returning();
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/users/:userId (admin)
export const deleteUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    // Cascade: delete statuses, status_views, messages, chats
    const userChats = await db.select().from(chats).where(eq(chats.userId, userId));
    for (const c of userChats) {
      await db.delete(messages).where(eq(messages.chatId, c.id));
    }
    await db.delete(chats).where(eq(chats.userId, userId));
    const userStatuses = await db.select().from(statuses).where(eq(statuses.userId, userId));
    for (const s of userStatuses) {
      await db.delete(statusViews).where(eq(statusViews.statusId, s.id));
    }
    await db.delete(statuses).where(eq(statuses.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    res.json({ success: true });
  } catch (err) {
    console.error('deleteUser error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/:userId/profile-picture  (admin can change user pic, or user changes own)
export const updateProfilePicture = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const { url } = await uploadToCloudinary(req.file.buffer, 'profile_pictures', 'image');
    const [updated] = await db.update(users).set({ profilePicture: url, updatedAt: new Date() })
      .where(eq(users.id, parseInt(req.params.userId))).returning();
    const { pin: _, ...safe } = updated;
    res.json({ user: safe });
  } catch (err) {
    console.error('updateProfilePicture error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/users/:userId/about
export const updateAbout = async (req, res) => {
  try {
    const { about } = req.body;
    // ensure admin can only update their own about, or user their own
    if (req.user.id !== parseInt(req.params.userId)) {
       return res.status(403).json({ message: 'Not authorized' });
    }
    const [updated] = await db.update(users).set({ about, updatedAt: new Date() })
      .where(eq(users.id, parseInt(req.params.userId))).returning();
    const { pin: _, ...safe } = updated;
    res.json({ user: safe });
  } catch (err) {
    console.error('updateAbout error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
