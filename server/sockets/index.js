import { socketAuth } from '../middleware/auth.js';
import { db } from '../config/db.js';
import { messages, chats, users } from '../models/schema.js';
import { eq, and } from 'drizzle-orm';

// Map userId -> socketId for online tracking
const onlineUsers = new Map();

export const initSocket = (io) => {
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${user.name} (${user.id})`);

    // Store online
    onlineUsers.set(user.id, socket.id);

    // If user, join their chat room; if admin, join all user rooms
    if (user.role === 'user') {
      const [chat] = await db.select().from(chats).where(eq(chats.userId, user.id));
      if (chat) {
        socket.join(`chat:${chat.id}`);
        socket.chatId = chat.id;
        console.log(`[Socket] User ${user.name} joined room chat:${chat.id}`);
      }
      // Notify admin user is online
      io.emit('user-online', { userId: user.id });
    } else {
      // Admin joins all active chat rooms
      const allChats = await db.select().from(chats);
      console.log(`[Socket] Admin ${user.name} joining ${allChats.length} rooms`);
      for (const c of allChats) {
        socket.join(`chat:${c.id}`);
      }
      io.emit('admin-online');
    }

    // --- send-message ---
    socket.on('send-message', async (data, ack) => {
      try {
        const { chatId, content, messageType = 'text', mediaUrl } = data;
        const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
        if (!chat) return ack?.({ error: 'Chat not found' });

        // Block check
        if (user.role === 'user') {
          const [u] = await db.select().from(users).where(eq(users.id, user.id));
          if (u.isBlocked) return ack?.({ error: 'You are blocked' });
        }

        const receiverId = user.role === 'admin' ? chat.userId : chat.adminId;

        const [msg] = await db.insert(messages).values({
          chatId,
          senderId:    user.id,
          receiverId,
          content:     content || null,
          messageType,
          mediaUrl:    mediaUrl || null,
          isDelivered: onlineUsers.has(receiverId),
        }).returning();

        // Update chat last message
        const lastMsg = content || `[${messageType}]`;
        await db.update(chats).set({
          lastMessage:   lastMsg,
          lastMessageAt: new Date(),
        }).where(eq(chats.id, chatId));

        // Emit to room
        io.to(`chat:${chatId}`).emit('receive-message', { ...msg, senderName: user.name });

        // Mark delivered if receiver is online
        if (onlineUsers.has(receiverId)) {
          await db.update(messages).set({ isDelivered: true }).where(eq(messages.id, msg.id));
          io.to(`chat:${chatId}`).emit('message-delivered', { messageId: msg.id });
        }

        ack?.({ success: true, message: msg });
      } catch (err) {
        console.error('[Socket] send-message error:', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    // --- typing ---
    socket.on('typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', { userId: user.id, userName: user.name });
    });

    // --- stop-typing ---
    socket.on('stop-typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-stop-typing', { userId: user.id });
    });

    // --- message-read ---
    socket.on('message-read', async ({ chatId, messageIds }) => {
      try {
        if (!messageIds?.length) return;
        for (const msgId of messageIds) {
          await db.update(messages).set({ isRead: true, readAt: new Date() })
            .where(eq(messages.id, msgId));
        }
        await db.update(chats).set({ unreadCount: 0 }).where(eq(chats.id, chatId));
        socket.to(`chat:${chatId}`).emit('message-read', { messageIds, chatId });
      } catch (err) {
        console.error('[Socket] message-read error:', err);
      }
    });

    // --- join-chat (for admin dynamically joining a new user chat room) ---
    socket.on('join-chat', ({ chatId }) => {
      console.log(`[Socket] Socket ${socket.id} (User: ${user.name}) explicitly joining room chat:${chatId}`);
      socket.join(`chat:${chatId}`);
    });

    // --- disconnect ---
    socket.on('disconnect', async () => {
      onlineUsers.delete(user.id);
      const lastSeen = new Date();
      await db.update(users).set({ lastSeen }).where(eq(users.id, user.id));
      io.emit('user-offline', { userId: user.id, lastSeen });
      console.log(`[Socket] Disconnected: ${user.name}`);
    });
  });

  return { onlineUsers };
};

export { onlineUsers };
