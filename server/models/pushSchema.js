import { pgTable, serial, integer, text, timestamp } from 'drizzle-orm/pg-core';

export const pushSubscriptions = pgTable('push_subscriptions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  subscription: text('subscription').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
