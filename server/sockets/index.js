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

    // Single session policy for admin: disconnect old session if exists
    if (user.role === 'admin') {
      const existingSocketId = onlineUsers.get(user.id);
      if (existingSocketId && existingSocketId !== socket.id) {
        console.log(`[Socket] Admin ${user.name} logged in elsewhere. Disconnecting old session: ${existingSocketId}`);
        io.to(existingSocketId).emit('force-logout', {
          reason: 'You have been logged in from another device/browser.'
        });
        const oldSocket = io.sockets.sockets.get(existingSocketId);
        if (oldSocket) oldSocket.disconnect(true);
      }
    }

    onlineUsers.set(user.id, socket.id);

    if (user.role === 'user') {
      // User: join their chat room
      const [chat] = await db.select().from(chats).where(eq(chats.userId, user.id));
      if (chat) {
        socket.join(`chat:${chat.id}`);
        socket.chatId = chat.id;
        console.log(`[Socket] User ${user.name} joined room chat:${chat.id}`);
      }
      io.emit('user-online', { userId: user.id });
    } else {
      // Admin: notify presence
      console.log(`[Socket] Admin ${user.name} connected`);
      io.emit('admin-online');
      adminSockets.add(socket.id);

      // Mark undelivered messages as delivered now that admin is online
      try {
        const undelivered = await db
          .select()
          .from(messages)
          .where(and(eq(messages.receiverId, user.id), eq(messages.isDelivered, false)));

        if (undelivered.length > 0) {
          const ids = undelivered.map(m => m.id);
          await db.update(messages).set({ isDelivered: true }).where(inArray(messages.id, ids));

          // Notify the senders that their messages are now delivered (double gray tick)
          // Group by chatId so we can find the right room to broadcast to
          const grouped = {};
          for (const m of undelivered) {
            if (!grouped[m.chatId]) grouped[m.chatId] = [];
            grouped[m.chatId].push(m.id);
          }
          for (const [chatId, msgIds] of Object.entries(grouped)) {
            io.to(`chat:${chatId}`).emit('messages-delivered', { messageIds: msgIds, chatId: Number(chatId) });
          }
        }
      } catch (e) {
        console.error('[Socket] admin deliver-mark failed:', e);
      }
    }

    // -------------------------------------------------------------------
    // send-message
    // -------------------------------------------------------------------
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

        // Delivered = receiver is currently connected (has a socket)
        const receiverSocketId = onlineUsers.get(receiverId);
        const delivered = !!receiverSocketId;

        const [msg] = await db.insert(messages).values({
          chatId,
          senderId:    user.id,
          receiverId,
          content:     content || null,
          messageType,
          mediaUrl:    mediaUrl || null,
          isDelivered: delivered,
          isRead:      false,   // NEVER set isRead on send — only IntersectionObserver sets it
        }).returning();

        // Update chat last message
        // Only increment unreadCount if USER is sending to ADMIN (admin sees unread badge)
        const lastMsgText = content || `[${messageType}]`;
        const incrementUnread = user.role === 'user';

        await db.update(chats).set({
          lastMessage:   lastMsgText,
          lastMessageAt: new Date(),
          isActive:      true,
          unreadCount:   incrementUnread
            ? sql`${chats.unreadCount} + 1`
            : chats.unreadCount,
        }).where(eq(chats.id, chatId));

        // Emit the new message to everyone in the room
        io.to(`chat:${chatId}`).emit('receive-message', { ...msg, senderName: user.name });

        // Handle real-time delivery and push notifications
        let shouldSendPush = true;

        if (receiverSocketId) {
          try {
            const recvSock = io.sockets.sockets.get(receiverSocketId);
            const inRoom = recvSock?.rooms?.has(`chat:${chatId}`);
            if (!inRoom) {
              io.to(receiverSocketId).emit('receive-message', { ...msg, senderName: user.name });
            } else {
              // User is actively in the chat room, don't send a push notification
              shouldSendPush = false;
            }

            // Tell the SENDER their message was delivered (gray double tick)
            io.to(socket.id).emit('messages-delivered', { messageIds: [msg.id], chatId });

            // Persist delivery flag
            if (!delivered) {
              await db.update(messages).set({ isDelivered: true }).where(eq(messages.id, msg.id));
            }
          } catch (e) {
            console.error('[Socket] failed to notify receiver directly:', e);
          }
        }

        // Push notification (best-effort)
        if (shouldSendPush) {
          try {
            await sendPushToUser(receiverId, {
              title: `New message from ${user.name}`,
              body: content || `[${messageType}]`,
              chatId,
              messageId: msg.id,
            });
          } catch (e) { console.error('push send error (socket):', e); }
        }

        // Notify all admin sockets so the chat list updates in real time
        try {
          for (const adminSocketId of adminSockets) {
            // Avoid double-emit if admin is in the room already
            const adminSock = io.sockets.sockets.get(adminSocketId);
            if (!adminSock?.rooms?.has(`chat:${chatId}`)) {
              io.to(adminSocketId).emit('receive-message', { ...msg, senderName: user.name });
            }
          }
        } catch (e) { console.error('notify admins error:', e); }

        ack?.({ success: true, message: msg });
      } catch (err) {
        console.error('[Socket] send-message error:', err);
        ack?.({ error: 'Failed to send message' });
      }
    });

    // -------------------------------------------------------------------
    // typing indicators
    // -------------------------------------------------------------------
    socket.on('typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-typing', { userId: user.id, userName: user.name });
    });

    socket.on('stop-typing', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('user-stop-typing', { userId: user.id });
    });

    // -------------------------------------------------------------------
    // message-read
    // Fired by the RECEIVER when messages scroll into their viewport.
    // Updates DB and notifies the SENDER so their ticks turn blue.
    // -------------------------------------------------------------------
    socket.on('message-read', async ({ chatId, messageIds }) => {
      try {
        if (!messageIds?.length) return;

        // Only mark messages that were sent TO this user (never self-mark)
        const toMark = await db
          .select({ id: messages.id })
          .from(messages)
          .where(
            and(
              inArray(messages.id, messageIds),
              eq(messages.receiverId, user.id),
              eq(messages.isRead, false)
            )
          );

        if (toMark.length === 0) return;

        const confirmedIds = toMark.map(m => m.id);

        await db
          .update(messages)
          .set({ isRead: true, readAt: new Date() })
          .where(inArray(messages.id, confirmedIds));

        // Decrement unread count (only meaningful when admin reads user messages)
        if (user.role === 'admin') {
          await db
            .update(chats)
            .set({ unreadCount: sql`GREATEST(0, ${chats.unreadCount} - ${confirmedIds.length})` })
            .where(eq(chats.id, Number(chatId)));
        }

        // Broadcast read receipt to everyone in the room so the SENDER's ticks turn blue
        io.to(`chat:${chatId}`).emit('message-read', { messageIds: confirmedIds, chatId: Number(chatId) });
      } catch (err) {
        console.error('[Socket] message-read error:', err);
      }
    });

    // -------------------------------------------------------------------
    // delete-message
    // -------------------------------------------------------------------
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

        const [lastMsg] = await db
          .select()
          .from(messages)
          .where(eq(messages.chatId, chatId))
          .orderBy(desc(messages.createdAt))
          .limit(1);

        const updates = lastMsg
          ? { lastMessage: lastMsg.content || `[${lastMsg.messageType}]`, lastMessageAt: lastMsg.createdAt }
          : { lastMessage: null, lastMessageAt: null };

        await db.update(chats).set(updates).where(eq(chats.id, chatId));

        io.to(`chat:${chatId}`).emit('message-deleted', {
          messageId,
          chatId,
          lastMessage: updates.lastMessage,
          lastMessageAt: updates.lastMessageAt,
        });

        ack?.({ success: true });
      } catch (err) {
        console.error('[Socket] delete-message error:', err);
        ack?.({ error: 'Server error' });
      }
    });

    // -------------------------------------------------------------------
    // join-chat (admin joins a specific user room on demand)
    // -------------------------------------------------------------------
    socket.on('join-chat', ({ chatId }) => {
      console.log(`[Socket] ${user.name} joining room chat:${chatId}`);
      socket.join(`chat:${chatId}`);
    });

    // -------------------------------------------------------------------
    // profile-update
    // -------------------------------------------------------------------
    socket.on('update-profile', (data) => {
      io.emit('profile-updated', { userId: user.id, updates: data });
    });

    // -------------------------------------------------------------------
    // disconnect
    // -------------------------------------------------------------------
    socket.on('disconnect', async () => {
      if (onlineUsers.get(user.id) === socket.id) {
        onlineUsers.delete(user.id);
        const lastSeen = new Date();
        await db.update(users).set({ lastSeen }).where(eq(users.id, user.id));
        io.emit('user-offline', { userId: user.id, lastSeen });
      }
      if (adminSockets.has(socket.id)) adminSockets.delete(socket.id);
      console.log(`[Socket] Disconnected: ${user.name}`);
    });
  });

  return { onlineUsers };
};

export { onlineUsers };
export { adminSockets };
