/**
 * Membuat tabel wa_reminder_templates jika belum ada (idempotent).
 * Jalankan dari folder apps/web: npm run db:ensure-wa-templates
 */
const postgres = require('postgres');
const { config } = require('dotenv');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const ddl = `
CREATE TABLE IF NOT EXISTS "wa_reminder_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" text NOT NULL,
  "name" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "wa_reminder_templates_user_id_type_unique" UNIQUE("user_id", "type")
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
    console.log('Skema wa_reminder_templates siap (idempotent).');
  } finally {
    await sql.end({ timeout: 3 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
