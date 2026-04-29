import { db } from '../config/db.js';
import { welcomeMessages, users } from '../models/schema.js';
import { eq } from 'drizzle-orm';
import { uploadToCloudinaryUnsigned } from '../services/cloudinary.js';

// GET /api/welcome
export const getWelcomeMessage = async (req, res) => {
  try {
    const [msg] = await db.select().from(welcomeMessages).where(eq(welcomeMessages.isActive, true));
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

    // Deactivate all existing
    await db.update(welcomeMessages).set({ isActive: false });

    const [updated] = await db.insert(welcomeMessages).values({
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
