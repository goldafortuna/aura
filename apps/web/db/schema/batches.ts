import { integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const aiMessageBatches = pgTable('ai_message_batches', {
  id: text('id').primaryKey(), // e.g. msgbatch_...
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  provider: text('provider').notNull().default('anthropic'),
  kind: text('kind').notNull().default('document_review'),
  processingStatus: text('processing_status').notNull().default('in_progress'),
  succeededCount: integer('succeeded_count').notNull().default(0),
  erroredCount: integer('errored_count').notNull().default(0),
  canceledCount: integer('canceled_count').notNull().default(0),
  expiredCount: integer('expired_count').notNull().default(0),
  resultsUrl: text('results_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  syncedAt: timestamp('synced_at', { withTimezone: true }),
});

export type AiMessageBatch = typeof aiMessageBatches.$inferSelect;
export type NewAiMessageBatch = typeof aiMessageBatches.$inferInsert;

