import {
  pgTable, serial, text, varchar, boolean, integer,
  timestamp, uniqueIndex, index, pgEnum
} from 'drizzle-orm/pg-core';

// Enums
export const roleEnum = pgEnum('role', ['user', 'admin']);
export const messageTypeEnum = pgEnum('message_type', ['text', 'image', 'video', 'audio']);
export const contentTypeEnum = pgEnum('content_type', ['image', 'video', 'text']);

// Users table
export const users = pgTable('users', {
  id:             serial('id').primaryKey(),
  name:           varchar('name', { length: 100 }).notNull(),
  phone:          varchar('phone', { length: 30 }).notNull().unique(),
  email:          varchar('email', { length: 200 }),
  pin:            text('pin').notNull(),
  role:           roleEnum('role').default('user').notNull(),
  profilePicture: text('profile_picture'),
  about:          text('about'),
  isBlocked:      boolean('is_blocked').default(false).notNull(),
  isMuted:        boolean('is_muted').default(false).notNull(),
  lastSeen:       timestamp('last_seen'),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
  updatedAt:      timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  phoneIdx: index('users_phone_idx').on(table.phone),
}));

// Chats table (one chat per user, always with admin)
export const chats = pgTable('chats', {
  id:            serial('id').primaryKey(),
  userId:        integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  adminId:       integer('admin_id').notNull().references(() => users.id),
  lastMessage:   text('last_message'),
  lastMessageAt: timestamp('last_message_at'),
  unreadCount:   integer('unread_count').default(0).notNull(),
  isActive:      boolean('is_active').default(true).notNull(),
  isArchived:    boolean('is_archived').default(false).notNull(),
  isPinned:      boolean('is_pinned').default(false).notNull(),
  createdAt:     timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx:        uniqueIndex('chats_user_id_idx').on(table.userId),
  lastMessageAtIdx: index('chats_last_message_at_idx').on(table.lastMessageAt),
}));

// Messages table
export const messages = pgTable('messages', {
  id:          serial('id').primaryKey(),
  chatId:      integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  senderId:    integer('sender_id').notNull().references(() => users.id),
  receiverId:  integer('receiver_id').notNull().references(() => users.id),
  content:     text('content'),
  messageType: messageTypeEnum('message_type').default('text').notNull(),
  mediaUrl:    text('media_url'),
  isDelivered: boolean('is_delivered').default(false).notNull(),
  isRead:      boolean('is_read').default(false).notNull(),
  readAt:      timestamp('read_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  chatIdCreatedAtIdx: index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),
}));

// Statuses table
export const statuses = pgTable('statuses', {
  id:              serial('id').primaryKey(),
  userId:          integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  contentType:     contentTypeEnum('content_type').notNull(),
  mediaUrl:        text('media_url'),
  textContent:     text('text_content'),
  caption:         text('caption'),
  backgroundColor: varchar('background_color', { length: 20 }),
  expiryTime:      timestamp('expiry_time').notNull(),
  duration:        integer('duration').default(1).notNull(), // days: 1, 2, or 3
  viewCount:       integer('view_count').default(0).notNull(),
  createdAt:       timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx:    index('statuses_user_id_idx').on(table.userId),
  expiryIdx:    index('statuses_expiry_time_idx').on(table.expiryTime),
}));

// Status views table
export const statusViews = pgTable('status_views', {
  id:       serial('id').primaryKey(),
  statusId: integer('status_id').notNull().references(() => statuses.id, { onDelete: 'cascade' }),
  viewerId: integer('viewer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  viewedAt: timestamp('viewed_at').defaultNow().notNull(),
}, (table) => ({
  uniqueView: uniqueIndex('status_views_unique_idx').on(table.statusId, table.viewerId),
}));

// Welcome messages table
export const welcomeMessages = pgTable('welcome_messages', {
  id:        serial('id').primaryKey(),
  message:   text('message').notNull(),
  isActive:  boolean('is_active').default(true).notNull(),
  updatedBy: integer('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Labels table
export const labels = pgTable('labels', {
  id:        serial('id').primaryKey(),
  name:      varchar('name', { length: 50 }).notNull().unique(),
  color:     varchar('color', { length: 20 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Chat labels association table
export const chatLabels = pgTable('chat_labels', {
  id:      serial('id').primaryKey(),
  chatId:  integer('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
  labelId: integer('label_id').notNull().references(() => labels.id, { onDelete: 'cascade' }),
}, (table) => ({
  chatLabelIdx: uniqueIndex('chat_labels_unique_idx').on(table.chatId, table.labelId),
}));

// Push Subscriptions table for PWA notifications
export const pushSubscriptions = pgTable('push_subscriptions', {
  id:           serial('id').primaryKey(),
  userId:       integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  subscription: text('subscription').notNull(), // JSON string
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: uniqueIndex('push_sub_user_id_idx').on(table.userId),
}));

