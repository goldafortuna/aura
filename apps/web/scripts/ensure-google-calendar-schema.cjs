/**
 * Membuat tabel + kolom Google Calendar jika belum ada.
 * Dipakai ketika `npm run db:migrate` gagal (biasanya journal Drizzle kosong
 * padahal tabel inti sudah ada dari `db:push` / setup manual).
 *
 * Jalankan dari folder apps/web: npm run db:ensure-gcal
 */
const postgres = require('postgres');
const { config } = require('dotenv');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const ddl = `
CREATE TABLE IF NOT EXISTS "google_calendar_connections" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token" text,
  "access_token_expires_at" timestamp with time zone,
  "account_email" text,
  "reminder_calendar_ids" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "google_calendar_connections_user_id_unique" UNIQUE("user_id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'google_calendar_connections'
      AND column_name = 'reminder_calendar_ids'
  ) THEN
    ALTER TABLE "google_calendar_connections" ADD COLUMN "reminder_calendar_ids" text;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'google_calendar_connections_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "google_calendar_connections"
    ADD CONSTRAINT "google_calendar_connections_user_id_users_id_fk"
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
    console.log('Skema google_calendar_connections siap (idempotent).');
  } finally {
    await sql.end({ timeout: 3 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
