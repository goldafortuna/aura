import { boolean, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

/**
 * Daftar unit kerja beserta nama lengkap, alias/singkatan, dan email.
 * Alias disimpan sebagai JSON array string, digunakan untuk matching
 * nama unit di notula/CTA (misal: "DSDM", "DitSDM" → Direktorat SDM).
 */
export const unitKerja = pgTable('unit_kerja', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' }),
  /** Nama lengkap unit kerja */
  name: text('name').notNull(),
  /** JSON array of alias/singkatan strings, e.g. ["DSDM","DitSDM"] */
  aliasesJson: text('aliases_json').notNull().default('[]'),
  /** Email resmi unit kerja */
  email: text('email').notNull(),
  /** Deskripsi singkat (opsional) */
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type UnitKerja = typeof unitKerja.$inferSelect;
export type NewUnitKerja = typeof unitKerja.$inferInsert;

/**
 * Konfigurasi email pengirim (Gmail SMTP via App Password).
 * Satu record per user — upsert saat save.
 */
export const emailConfigs = pgTable('email_configs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  /** Gmail address yang digunakan sebagai pengirim */
  gmailAddress: text('gmail_address').notNull(),
  /** Gmail App Password (bukan password akun utama) */
  gmailAppPassword: text('gmail_app_password').notNull(),
  /** Provider preset untuk bantu autofill UI */
  provider: text('provider').notNull().default('gmail'),
  smtpHost: text('smtp_host'),
  smtpPort: integer('smtp_port'),
  smtpSecure: boolean('smtp_secure').notNull().default(false),
  smtpUsername: text('smtp_username'),
  smtpPassword: text('smtp_password'),
  fromAddress: text('from_address'),
  /** Nama tampil pengirim, misal "Sekretariat Rapim" */
  fromName: text('from_name').notNull().default('Sekretariat'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export type EmailConfig = typeof emailConfigs.$inferSelect;
export type NewEmailConfig = typeof emailConfigs.$inferInsert;
