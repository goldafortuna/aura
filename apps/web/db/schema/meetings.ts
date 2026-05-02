import { date, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const meetingMinutes = pgTable('meeting_minutes', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull(),
  meetingDate: date('meeting_date').notNull(),
  filename: text('filename').notNull().default(''),
  fileType: text('file_type').notNull().default('application/octet-stream'),
  fileSize: integer('file_size').notNull().default(0),
  storagePath: text('storage_path').notNull().default(''),
  participantsCount: integer('participants_count').notNull().default(0),
  /** JSON array of participant email strings */
  participantsEmails: jsonb('participants_emails').$type<string[]>(),
  status: text('status').notNull().default('draft'),
  typoCount: integer('typo_count').notNull().default(0),
  ambiguousCount: integer('ambiguous_count').notNull().default(0),
  ctaCount: integer('cta_count').notNull().default(0),
  findingsJson: jsonb('findings_json').$type<unknown>(),
  /** JSON array of approved finding indices (numbers) */
  approvedFindingsJson: jsonb('approved_findings_json').$type<number[]>(),
  /** Storage path of corrected document (after applying approved findings) */
  correctedStoragePath: text('corrected_storage_path'),
  /** Filename of corrected document */
  correctedFilename: text('corrected_filename'),
  ctasJson: jsonb('ctas_json').$type<unknown>(),
  /** Model AI yang digunakan untuk analisis, misal "claude-sonnet-4-5" */
  aiModel: text('ai_model'),
  analysisError: text('analysis_error'),
  analyzedAt: timestamp('analyzed_at', { withTimezone: true }),
  correctedAt: timestamp('corrected_at', { withTimezone: true }),
  distributedAt: timestamp('distributed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const ctaItems = pgTable('cta_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  meetingMinuteId: uuid('meeting_minute_id')
    .references(() => meetingMinutes.id, { onDelete: 'cascade' })
    .notNull(),
  title: text('title').notNull().default(''),
  action: text('action').notNull(),
  picName: text('pic_name'),
  unit: text('unit'),
  deadline: date('deadline'),
  priority: text('priority').notNull().default('medium'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type MeetingMinute = typeof meetingMinutes.$inferSelect;
export type NewMeetingMinute = typeof meetingMinutes.$inferInsert;
export type CtaItem = typeof ctaItems.$inferSelect;
export type NewCtaItem = typeof ctaItems.$inferInsert;
