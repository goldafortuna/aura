import { boolean, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';
import { pgTable } from 'drizzle-orm/pg-core';

export const webdavConfigs = pgTable('webdav_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  baseUrl: text('base_url').notNull(),
  username: text('username').notNull(),
  password: text('password').notNull(),
  documentReviewFolder: text('document_review_folder').notNull().default('/'),
  isEnabled: boolean('is_enabled').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WebdavConfig = typeof webdavConfigs.$inferSelect;
export type NewWebdavConfig = typeof webdavConfigs.$inferInsert;
