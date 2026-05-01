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

  const checklistTemplate = [
    { label: 'Surat Tugas', isRequired: false, sortOrder: 0 },
    { label: 'E-Ticket', isRequired: false, sortOrder: 1 },
    { label: 'Invoice', isRequired: false, sortOrder: 2 },
    { label: 'Boarding Pass', isRequired: false, sortOrder: 3 },
    { label: 'SPPD/Laporan Perjalanan Dinas', isRequired: false, sortOrder: 4 },
    { label: 'Voucher/Invoice Hotel', isRequired: false, sortOrder: 5 },
  ];

  const travelTasks = await sql`
    SELECT id
    FROM "tasks"
    WHERE "kind" = 'travel-accountability'
  `;

  for (const task of travelTasks) {
    for (const item of checklistTemplate) {
      await sql`
        INSERT INTO "task_checklist_items" ("task_id", "label", "is_required", "sort_order")
        SELECT ${task.id}, ${item.label}, ${item.isRequired}, ${item.sortOrder}
        WHERE NOT EXISTS (
          SELECT 1
          FROM "task_checklist_items"
          WHERE "task_id" = ${task.id}
            AND "label" = ${item.label}
        )
      `;

      await sql`
        UPDATE "task_checklist_items"
        SET "is_required" = ${item.isRequired},
            "sort_order" = ${item.sortOrder},
            "updated_at" = now()
        WHERE "task_id" = ${task.id}
          AND "label" = ${item.label}
      `;
    }
  }

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
