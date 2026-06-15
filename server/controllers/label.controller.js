import { db } from '../config/db.js';
import { labels, chatLabels } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';

// Generate a random bright color for labels
const generateColor = () => {
  const h = Math.floor(Math.random() * 360);
  return `hsl(${h}, 70%, 50%)`;
};

// GET /api/labels
export const getLabels = async (req, res) => {
  try {
    const allLabels = await db.select().from(labels).where(eq(labels.adminId, req.user.id)).orderBy(labels.createdAt);
    res.json({ labels: allLabels });
  } catch (err) {
    console.error('getLabels error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/labels
export const createLabel = async (req, res) => {
  try {
    const { name, chatIds = [] } = req.body;
    
    if (!name) return res.status(400).json({ message: 'Label name is required' });

    // Check if label exists for this admin
    const existing = await db.select().from(labels).where(and(eq(labels.name, name), eq(labels.adminId, req.user.id)));
    let labelId;

    if (existing.length > 0) {
      labelId = existing[0].id;
    } else {
      const [newLabel] = await db.insert(labels).values({
        name,
        adminId: req.user.id,
        color: generateColor(),
      }).returning();
      labelId = newLabel.id;
    }

    // Attach to provided chats
    if (chatIds.length > 0) {
      const values = chatIds.map(chatId => ({ chatId, labelId }));
      // Use raw SQL to insert and ignore on conflict, as Drizzle SQLite/pg conflict might vary
      // Since it's postgres, we can use simple insert, but if it fails on unique constraint, we'll do one by one or ignore.
      for (const val of values) {
        try {
          await db.insert(chatLabels).values(val);
        } catch (e) {
          // Ignore duplicate constraint errors
          if (e.code !== '23505') {
            console.error('Error inserting chatLabel:', e);
          }
        }
      }
    }

    const [createdOrFound] = await db.select().from(labels).where(eq(labels.id, labelId));
    res.status(201).json({ label: createdOrFound });
  } catch (err) {
    console.error('createLabel error:', err);
    if (err.code === '23505') {
      return res.status(400).json({ message: 'Label already exists' });
    }
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/labels/:labelId/chats
// Add or remove a specific chat from this label
export const toggleChatLabel = async (req, res) => {
  try {
    const { labelId } = req.params;
    const { chatId, attach } = req.body; // attach boolean

    if (attach) {
      try {
        await db.insert(chatLabels).values({ chatId: parseInt(chatId), labelId: parseInt(labelId) });
      } catch (e) {
        if (e.code !== '23505') throw e; // ignore if already attached
      }
    } else {
      // Drizzle ORM does not have a simple compound AND delete out of the box in some versions without AND
      // but we can just use sql tag or try to construct it.
      // Wait, we can delete using and(eq(chatLabels.chatId, chatId), eq(chatLabels.labelId, labelId))
      // It's safer to use a raw query if 'and' is tricky, but let's import `and` from drizzle-orm.
      const { and } = await import('drizzle-orm');
      await db.delete(chatLabels).where(
        and(eq(chatLabels.chatId, parseInt(chatId)), eq(chatLabels.labelId, parseInt(labelId)))
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('toggleChatLabel error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/labels/:labelId
export const deleteLabel = async (req, res) => {
  try {
    const { labelId } = req.params;
    await db.delete(labels).where(and(eq(labels.id, parseInt(labelId)), eq(labels.adminId, req.user.id)));
    res.json({ success: true });
  } catch (err) {
    console.error('deleteLabel error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
