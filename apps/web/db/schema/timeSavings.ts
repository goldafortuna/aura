import { integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const timeSavingsFeatureEnum = ['document_review', 'minutes_cta', 'wa_reminder'] as const;
export type TimeSavingsFeature = (typeof timeSavingsFeatureEnum)[number];

export const timeSavingsSettings = pgTable(
  'time_savings_settings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    scope: text('scope').notNull().default('global'),
    documentReviewBaseMinutes: integer('document_review_base_minutes').notNull().default(20),
    documentReviewPerFindingMinutes: integer('document_review_per_finding_minutes').notNull().default(3),
    minutesReviewBaseMinutes: integer('minutes_review_base_minutes').notNull().default(30),
    minutesReviewPerFindingMinutes: integer('minutes_review_per_finding_minutes').notNull().default(2),
    minutesReviewPerCtaMinutes: integer('minutes_review_per_cta_minutes').notNull().default(5),
    waReminderBaseMinutes: integer('wa_reminder_base_minutes').notNull().default(5),
    waReminderPerEventMinutes: integer('wa_reminder_per_event_minutes').notNull().default(2),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqScope: uniqueIndex('time_savings_settings_scope_uidx').on(t.scope),
  }),
);

export const timeSavingsEvents = pgTable(
  'time_savings_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    feature: text('feature').$type<TimeSavingsFeature>().notNull(),
    sourceId: text('source_id').notNull(),
    manualEstimateMinutes: integer('manual_estimate_minutes').notNull(),
    actualAutomationMinutes: integer('actual_automation_minutes').notNull(),
    savedMinutes: integer('saved_minutes').notNull(),
    metadataJson: jsonb('metadata_json').$type<Record<string, unknown>>(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    uniqUserFeatureSource: uniqueIndex('time_savings_events_user_feature_source_uidx').on(
      t.userId,
      t.feature,
      t.sourceId,
    ),
  }),
);

export type TimeSavingsSetting = typeof timeSavingsSettings.$inferSelect;
export type NewTimeSavingsSetting = typeof timeSavingsSettings.$inferInsert;
export type TimeSavingsEvent = typeof timeSavingsEvents.$inferSelect;
export type NewTimeSavingsEvent = typeof timeSavingsEvents.$inferInsert;
