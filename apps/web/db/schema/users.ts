import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  clerkUserId: text('clerk_user_id').notNull().unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name'),
  role: text('role').notNull().default('secretary'),
  rolesJson: text('roles_json').notNull().default('["secretary"]'),
  approvalStatus: text('approval_status').notNull().default('pending'),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
  approvedByUserId: uuid('approved_by_user_id'),
  rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  rejectedReason: text('rejected_reason'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
