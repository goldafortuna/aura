import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/** Pedoman perjadin pimpinan — konten playbook disimpan sebagai JSON agar mudah diperbarui saat SBU berubah. */
export const perjadinGuidelines = pgTable('perjadin_guidelines', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  versionLabel: text('version_label').notNull(),
  status: text('status').notNull().default('published'),
  isActive: boolean('is_active').notNull().default(true),
  content: jsonb('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
