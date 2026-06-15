import { db } from '../config/db.js';
import { welcomeMessages, users, chats } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';
import { uploadToCloudinaryUnsigned } from '../services/cloudinary.js';

// GET /api/welcome
export const getWelcomeMessage = async (req, res) => {
  try {
    let adminId;
    if (req.user.role === 'admin') {
      adminId = req.user.id;
    } else {
      const [chat] = await db.select({ adminId: chats.adminId }).from(chats).where(eq(chats.userId, req.user.id));
      adminId = chat?.adminId;
    }

    const [msg] = adminId
      ? await db.select().from(welcomeMessages).where(and(eq(welcomeMessages.isActive, true), eq(welcomeMessages.adminId, adminId)))
      : await db.select().from(welcomeMessages).where(eq(welcomeMessages.isActive, true));

    res.json({ message: msg?.message || 'Welcome! How can we help you today?' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/welcome  (admin)
export const updateWelcomeMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ message: 'message is required' });

    // Deactivate existing welcome messages for this admin only
    await db.update(welcomeMessages).set({ isActive: false }).where(eq(welcomeMessages.adminId, req.user.id));

    const [updated] = await db.insert(welcomeMessages).values({
      adminId:   req.user.id,
      message,
      isActive:  true,
      updatedBy: req.user.id,
      updatedAt: new Date(),
    }).returning();
    res.json({ welcomeMessage: updated });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/upload
export const uploadMedia = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    const type = req.query.type || 'image';
    const typeMap = {
      image:   { folder: 'chat_media/images',  resource: 'image',  maxSize: 5  * 1024 * 1024 },
      video:   { folder: 'chat_media/videos',  resource: 'video',  maxSize: 50 * 1024 * 1024 },
      audio:   { folder: 'chat_media/audio',   resource: 'raw',    maxSize: 10 * 1024 * 1024 },
      profile: { folder: 'profile_pictures',   resource: 'image',  maxSize: 5  * 1024 * 1024 },
    };

    const config = typeMap[type];
    if (!config) return res.status(400).json({ message: 'Invalid upload type' });
    if (req.file.size > config.maxSize)
      return res.status(413).json({ message: `File too large. Max ${config.maxSize / 1024 / 1024}MB for ${type}` });

    const { url, publicId } = await uploadToCloudinaryUnsigned(req.file.buffer, config.folder, config.resource);
    res.json({ url, publicId });
  } catch (err) {
    console.error('uploadMedia error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
};
