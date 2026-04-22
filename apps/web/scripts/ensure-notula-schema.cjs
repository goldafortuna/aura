/**
 * Tambah kolom notula baru ke tabel meeting_minutes (idempotent).
 * Jalankan dari folder apps/web: node scripts/ensure-notula-schema.cjs
 */
const postgres = require('postgres');
const { config } = require('dotenv');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const ddl = `
-- Kolom dari migration 0001 yang mungkin belum ada (jika migrate pernah gagal)
ALTER TABLE "meeting_minutes"
  ADD COLUMN IF NOT EXISTS "filename" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "file_type" text NOT NULL DEFAULT 'application/octet-stream',
  ADD COLUMN IF NOT EXISTS "file_size" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "storage_path" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "cta_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "findings_json" text,
  ADD COLUMN IF NOT EXISTS "ctas_json" text,
  ADD COLUMN IF NOT EXISTS "analysis_error" text,
  ADD COLUMN IF NOT EXISTS "analyzed_at" timestamp with time zone;

-- Kolom dari fitur notula (tambahan terbaru)
ALTER TABLE "meeting_minutes"
  ADD COLUMN IF NOT EXISTS "participants_emails" text,
  ADD COLUMN IF NOT EXISTS "approved_findings_json" text,
  ADD COLUMN IF NOT EXISTS "corrected_storage_path" text,
  ADD COLUMN IF NOT EXISTS "corrected_filename" text,
  ADD COLUMN IF NOT EXISTS "corrected_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "distributed_at" timestamp with time zone;

-- Kolom dari migration 0001 untuk cta_items
ALTER TABLE "cta_items"
  ADD COLUMN IF NOT EXISTS "title" text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

ALTER TABLE "cta_items" ALTER COLUMN "pic_name" DROP NOT NULL;
ALTER TABLE "cta_items" ALTER COLUMN "unit" DROP NOT NULL;
ALTER TABLE "cta_items" ALTER COLUMN "deadline" DROP NOT NULL;

-- Kolom dari migration 0002 untuk documents
ALTER TABLE "documents"
  ADD COLUMN IF NOT EXISTS "analysis_batch_id" text;

-- Tabel dari migration 0002 (ai_message_batches)
CREATE TABLE IF NOT EXISTS "ai_message_batches" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" text NOT NULL DEFAULT 'anthropic',
  "kind" text NOT NULL DEFAULT 'document_review',
  "processing_status" text NOT NULL DEFAULT 'in_progress',
  "succeeded_count" integer NOT NULL DEFAULT 0,
  "errored_count" integer NOT NULL DEFAULT 0,
  "canceled_count" integer NOT NULL DEFAULT 0,
  "expired_count" integer NOT NULL DEFAULT 0,
  "results_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "synced_at" timestamp with time zone
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ai_message_batches_user_id_users_id_fk') THEN
    ALTER TABLE "ai_message_batches"
    ADD CONSTRAINT "ai_message_batches_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Tabel dari migration 0003 (google_calendar_connections)
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
  "refresh_token" text NOT NULL,
  "access_token" text,
  "access_token_expires_at" timestamp with time zone,
  "account_email" text,
  "reminder_calendar_ids" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_connections_user_id_users_id_fk') THEN
    ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;
  END IF;
END $$;

-- Kolom reminder_calendar_ids dari migration 0004
ALTER TABLE "google_calendar_connections"
  ADD COLUMN IF NOT EXISTS "reminder_calendar_ids" text;

CREATE TABLE IF NOT EXISTS "unit_kerja" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "aliases_json" text NOT NULL DEFAULT '[]',
  "email" text NOT NULL,
  "description" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "unit_kerja_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "email_configs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL UNIQUE,
  "gmail_address" text NOT NULL,
  "gmail_app_password" text NOT NULL,
  "from_name" text NOT NULL DEFAULT 'Sekretariat',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "email_configs_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "wa_reminder_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_reminder_templates_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "wa_reminder_templates"
    ADD CONSTRAINT "wa_reminder_templates_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
  END IF;
END
$$;
`;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL tidak ditemukan. Set di .env atau .env.local.');
    process.exit(1);
  }
  const sql = postgres(url, { max: 1 });
  try {
    await sql.unsafe(ddl);
    console.log('Skema notula berhasil diperbarui (idempotent).');
    console.log('  + participants_emails (text)');
    console.log('  + approved_findings_json (text)');
    console.log('  + corrected_storage_path (text)');
    console.log('  + corrected_filename (text)');
    console.log('  + corrected_at (timestamp with time zone)');
    console.log('  + distributed_at (timestamp with time zone)');
    console.log('  + unit_kerja table (jika belum ada)');
    console.log('  + email_configs table (jika belum ada)');
    console.log('  + wa_reminder_templates table (jika belum ada)');
  } finally {
    await sql.end({ timeout: 3 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
