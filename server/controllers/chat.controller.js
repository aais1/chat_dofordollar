import { db } from '../config/db.js';
import { chats, messages, users } from '../models/schema.js';
import { eq, desc, asc, lt, and, sql } from 'drizzle-orm';

// GET /api/chats/my-chat  (user)
export const getMyChat = async (req, res) => {
  try {
    const [chat] = await db.select().from(chats).where(eq(chats.userId, req.user.id));
    if (!chat) return res.status(404).json({ message: 'Chat not found' });
    const [admin] = await db.select({
      id: users.id, name: users.name, profilePicture: users.profilePicture, lastSeen: users.lastSeen
    }).from(users).where(eq(users.id, chat.adminId));
    res.json({ chat: { ...chat, admin } });
  } catch (err) {
    console.error('getMyChat error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chats  (admin)
export const getAllChats = async (req, res) => {
  try {
    const allChats = await db
      .select({
        id: chats.id,
        userId: chats.userId,
        adminId: chats.adminId,
        lastMessage: chats.lastMessage,
        lastMessageAt: chats.lastMessageAt,
        unreadCount: chats.unreadCount,
        isActive: chats.isActive,
        createdAt: chats.createdAt,
        userName: users.name,
        userPhone: users.phone,
        userProfilePicture: users.profilePicture,
        userIsBlocked: users.isBlocked,
        userIsMuted: users.isMuted,
        userLastSeen: users.lastSeen,
      })
      .from(chats)
      .leftJoin(users, eq(chats.userId, users.id))
      .orderBy(desc(chats.lastMessageAt));
    res.json({ chats: allChats });
  } catch (err) {
    console.error('getAllChats error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/chats/:chatId/messages
export const getMessages = async (req, res) => {
  try {
    const { chatId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = parseInt(req.query.skip)  || 0;

    const chat = await db.select().from(chats).where(eq(chats.id, parseInt(chatId)));
    if (!chat.length) return res.status(404).json({ message: 'Chat not found' });

    // Authorization: user can only access their own chat
    if (req.user.role !== 'admin' && chat[0].userId !== req.user.id)
      return res.status(403).json({ message: 'Access denied' });

    const msgs = await db
      .select({
        id: messages.id,
        chatId: messages.chatId,
        senderId: messages.senderId,
        receiverId: messages.receiverId,
        content: messages.content,
        messageType: messages.messageType,
        mediaUrl: messages.mediaUrl,
        isDelivered: messages.isDelivered,
        isRead: messages.isRead,
        readAt: messages.readAt,
        createdAt: messages.createdAt,
        senderName: users.name,
        senderPicture: users.profilePicture,
      })
      .from(messages)
      .leftJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.chatId, parseInt(chatId)))
      .orderBy(desc(messages.createdAt))
      .limit(limit)
      .offset(skip);

    res.json({ messages: msgs.reverse() });
  } catch (err) {
    console.error('getMessages error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/chats/:chatId/messages
export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, messageType = 'text', mediaUrl } = req.body;

    const [chat] = await db.select().from(chats).where(eq(chats.id, parseInt(chatId)));
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Determine receiver
    const receiverId = req.user.role === 'admin' ? chat.userId : chat.adminId;

    // Check if user is blocked
    if (req.user.role === 'user') {
      const [u] = await db.select().from(users).where(eq(users.id, req.user.id));
      if (u.isBlocked) return res.status(403).json({ message: 'You are blocked from sending messages' });
    }

    const [msg] = await db.insert(messages).values({
      chatId:      parseInt(chatId),
      senderId:    req.user.id,
      receiverId,
      content:     content || null,
      messageType,
      mediaUrl:    mediaUrl || null,
    }).returning();

    // Update chat's last message
    await db.update(chats).set({
      lastMessage:   content || `[${messageType}]`,
      lastMessageAt: new Date(),
      unreadCount:   sql`${chats.unreadCount} + 1`,
    }).where(eq(chats.id, parseInt(chatId)));

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/chats/:chatId/read
export const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    await db.update(messages).set({
      isRead: true,
      readAt: new Date(),
    }).where(
      and(eq(messages.chatId, parseInt(chatId)), eq(messages.receiverId, req.user.id))
    );
    await db.update(chats).set({ unreadCount: 0 }).where(eq(chats.id, parseInt(chatId)));
    res.json({ success: true });
  } catch (err) {
    console.error('markAsRead error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/chats/:chatId  (admin)
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    await db.delete(messages).where(eq(messages.chatId, parseInt(chatId)));
    await db.update(chats).set({ lastMessage: null, lastMessageAt: null, unreadCount: 0 })
      .where(eq(chats.id, parseInt(chatId)));
    res.json({ success: true });
  } catch (err) {
    console.error('deleteChat error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
