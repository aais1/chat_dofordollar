import { socketAuth } from '../middleware/auth.js';
import { db } from '../config/db.js';
import { messages, chats, users } from '../models/schema.js';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { setIO } from './broadcast.js';
import { sendPushToUser } from '../controllers/push.controller.js';

// Map userId -> socketId for online tracking
const onlineUsers = new Map();
// Track admin socket ids so we can notify admin dashboards even if they are not in specific chat rooms
const adminSockets = new Set();

export const initSocket = (io) => {
  // expose io for REST controllers to broadcast events
  setIO(io);
  io.use(socketAuth);

  io.on('connection', async (socket) => {
    const user = socket.user;
    console.log(`[Socket] Connected: ${user.name} (${user.id})`);

    // Store online
    // Single session policy for admin: disconnect old session if exists
    if (user.role === 'admin') {
      const existingSocketId = onlineUsers.get(user.id);
      if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`[Socket] Admin ${user.name} logged in elsewhere. Disconnecting old session: ${existingSocketId}`);
        io.to(existingSocketId).emit('force-logout', { 
          reason: 'You have been logged in from another device/browser.' 
        });
        // Give some time for the event to reach the client before disconnecting
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) {
          oldSocket.disconnect(true);
        }
      }
    }

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
      // Admin connects: do NOT auto-join all chat rooms. Admin will join rooms on demand
      // (when they open a chat). We still notify presence and will push unread messages below.
      console.log(`[Socket] Admin ${user.name} connected`);
      io.emit('admin-online');
      adminSockets.add(socket.id);

      // On admin connect, mark any previously undelivered messages (to this admin) as delivered
      try {
        const undelivered = await db.select().from(messages).where(and(eq(messages.receiverId, user.id), eq(messages.isDelivered, false)));
        if (undelivered.length > 0) {
          const ids = undelivered.map(m => m.id);
          await db.update(messages).set({ isDelivered: true }).where(inArray(messages.id, ids));
          // Notify admin socket about delivered messages
          for (const id of ids) {
            io.to(socket.id).emit('message-delivered', { messageId: id });
          }
        }
      } catch (e) {
        console.error('[Socket] admin deliver-mark failed:', e);
      }
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

        // Decide delivery/unread behavior based on whether receiver is connected and in the chat room
        const receiverSocketId = onlineUsers.get(receiverId);
        let delivered = false;
        let incrementUnread = true;
        if (receiverSocketId) {
          delivered = true; // receiver has a socket connection
          const recvSock = io.sockets.sockets.get(receiverSocketId);
          if (recvSock && recvSock.rooms && recvSock.rooms.has(`chat:${chatId}`)) {
            // Receiver is currently in the chat room -> they will see the message; don't increment unread
            incrementUnread = false;
          }
        }

        const [msg] = await db.insert(messages).values({
          chatId,
          senderId:    user.id,
          receiverId,
          content:     content || null,
          messageType,
          mediaUrl:    mediaUrl || null,
          isDelivered: delivered,
        }).returning();

        // Update chat last message and conditionally increment unread count
        const lastMsg = content || `[${messageType}]`;
        await db.update(chats).set({
          lastMessage:   lastMsg,
          lastMessageAt: new Date(),
          isActive:      true,
          unreadCount:   incrementUnread ? sql`${chats.unreadCount} + 1` : chats.unreadCount,
        }).where(eq(chats.id, chatId));

        // Emit to room (for clients who have joined)
        io.to(`chat:${chatId}`).emit('receive-message', { ...msg, senderName: user.name });

        // If receiver has a socket, decide whether to send directly or rely on room delivery
        if (receiverSocketId) {
          try {
            const recvSock = io.sockets.sockets.get(receiverSocketId);
            const inRoom = recvSock && recvSock.rooms && recvSock.rooms.has(`chat:${chatId}`);

            if (!inRoom) {
              // Receiver not in the room: send directly so they get the message live
              io.to(receiverSocketId).emit('receive-message', { ...msg, senderName: user.name });
            }

            // Notify the sender socket that the message was delivered (so sender UI updates)
            io.to(socket.id).emit('message-delivered', { messageId: msg.id });

            // Mark delivered in DB if not already
            if (!delivered) {
              await db.update(messages).set({ isDelivered: true }).where(eq(messages.id, msg.id));
            }

            // Best-effort: send web-push too
            try { await sendPushToUser(receiverId, { title: `New message from ${user.name}`, body: content || `[${messageType}]`, chatId, messageId: msg.id }); } catch (e) { console.error('push send error (socket):', e); }
          } catch (e) {
            console.error('[Socket] failed to notify receiver directly:', e);
          }
        }

        // Notify admin dashboards (all admin sockets) so admin sees live updates in chat list
        try {
          for (const adminSocketId of adminSockets) {
            io.to(adminSocketId).emit('receive-message', { ...msg, senderName: user.name });
          }
        } catch (e) { console.error('notify admins error:', e); }

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

    // --- delete-message ---
    socket.on('delete-message', async ({ messageId, chatId }, ack) => {
      try {
        if (user.role !== 'admin') {
          ack?.({ error: 'Admin permission required' });
          return;
        }

        const [msg] = await db.select().from(messages).where(eq(messages.id, messageId));
        if (!msg) {
          ack?.({ error: 'Message not found' });
          return;
        }

        await db.delete(messages).where(eq(messages.id, messageId));

        // Update chat's last message info
        const [lastMsg] = await db.select()
          .from(messages)
          .where(eq(messages.chatId, chatId))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const updates = lastMsg 
          ? { lastMessage: lastMsg.content || `[${lastMsg.messageType}]`, lastMessageAt: lastMsg.createdAt }
          : { lastMessage: null, lastMessageAt: null };

        await db.update(chats).set(updates).where(eq(chats.id, chatId));

        // Notify all in room
        io.to(`chat:${chatId}`).emit('message-deleted', { 
          messageId, 
          chatId, 
          lastMessage: updates.lastMessage, 
          lastMessageAt: updates.lastMessageAt 
        });

        ack?.({ success: true });
      } catch (err) {
        console.error('[Socket] delete-message error:', err);
        ack?.({ error: 'Server error' });
      }
    });

    // --- join-chat (for admin dynamically joining a new user chat room) ---
    socket.on('join-chat', ({ chatId }) => {
      console.log(`[Socket] Socket ${socket.id} (User: ${user.name}) explicitly joining room chat:${chatId}`);
      socket.join(`chat:${chatId}`);
    });

    // --- profile-update ---
    socket.on('update-profile', (data) => {
      io.emit('profile-updated', { userId: user.id, updates: data });
    });

    // --- disconnect ---
    socket.on('disconnect', async () => {
      if (onlineUsers.get(user.id) === socket.id) {
        onlineUsers.delete(user.id);
        const lastSeen = new Date();
        await db.update(users).set({ lastSeen }).where(eq(users.id, user.id));
        io.emit('user-offline', { userId: user.id, lastSeen });
      }
      // Remove from adminSockets if present
      if (adminSockets.has(socket.id)) adminSockets.delete(socket.id);
      console.log(`[Socket] Disconnected: ${user.name}`);
    });
  });

  return { onlineUsers };
};

export { onlineUsers };
export { adminSockets };
