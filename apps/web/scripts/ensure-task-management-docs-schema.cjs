/**
 * Jalankan dari folder apps/web: npm run db:ensure-task-docs
 */
require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function main() {
  await sql`
    ALTER TABLE "tasks"
      ADD COLUMN IF NOT EXISTS "kind" text NOT NULL DEFAULT 'general',
      ADD COLUMN IF NOT EXISTS "finance_pic_email" text,
      ADD COLUMN IF NOT EXISTS "finance_email_sent_at" timestamptz
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "task_checklist_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
      "label" text NOT NULL,
      "is_required" boolean NOT NULL DEFAULT true,
      "sort_order" integer NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT now(),
      "updated_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "task_checklist_items_task_id_idx"
      ON "task_checklist_items" ("task_id")
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "task_attachments" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "task_id" uuid NOT NULL REFERENCES "tasks"("id") ON DELETE CASCADE,
      "checklist_item_id" uuid NOT NULL REFERENCES "task_checklist_items"("id") ON DELETE CASCADE,
      "filename" text NOT NULL,
      "file_type" text NOT NULL,
      "file_size" integer NOT NULL,
      "storage_path" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "task_attachments_task_id_idx"
      ON "task_attachments" ("task_id")
  `;

  await sql`
    CREATE INDEX IF NOT EXISTS "task_attachments_checklist_item_id_idx"
      ON "task_attachments" ("checklist_item_id")
  `;

  console.log('ok task management docs schema ensured');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
