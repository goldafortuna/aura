import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { users } from './users';

export const WA_TEMPLATE_TYPES = ['besok', 'hari_ini', 'per_kegiatan'] as const;
export type WaTemplateType = (typeof WA_TEMPLATE_TYPES)[number];

/**
 * Satu baris per jenis template per user.
 * type: 'besok' | 'hari_ini' | 'per_kegiatan'
 */
export const waReminderTemplates = pgTable('wa_reminder_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  name: text('name').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type WaReminderTemplate = typeof waReminderTemplates.$inferSelect;
export type NewWaReminderTemplate = typeof waReminderTemplates.$inferInsert;
