/**
 * Membuat kolom approval + multi-role user jika belum ada (idempotent).
 * Jalankan dari folder apps/web: npm run db:ensure-user-access
 */
const postgres = require('postgres');
const { config } = require('dotenv');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const ddl = `
DO $$
DECLARE
  had_roles_json boolean;
  had_approval_status boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'roles_json'
  ) INTO had_roles_json;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'approval_status'
  ) INTO had_approval_status;

  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roles_json" text DEFAULT '["secretary"]' NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approval_status" text DEFAULT 'pending' NOT NULL;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved_at" timestamp with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "approved_by_user_id" uuid;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejected_at" timestamp with time zone;
  ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "rejected_reason" text;

  IF NOT had_roles_json THEN
    UPDATE "users"
    SET
      "roles_json" = CASE
        WHEN "role" = 'super_admin' THEN '["super_admin"]'
        ELSE '["secretary"]'
      END;
  END IF;

  IF NOT had_approval_status THEN
    UPDATE "users"
    SET
      "approval_status" = 'approved',
      "approved_at" = COALESCE("approved_at", NOW());
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_approved_by_user_id_users_id_fk'
  ) THEN
    ALTER TABLE "users"
    ADD CONSTRAINT "users_approved_by_user_id_users_id_fk"
    FOREIGN KEY ("approved_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
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
    console.log('Skema user approval + roles siap (idempotent).');
  } finally {
    await sql.end({ timeout: 3 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
