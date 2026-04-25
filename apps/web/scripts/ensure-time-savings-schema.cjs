/**
 * Jalankan dari folder apps/web: npm run db:ensure-time-savings
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
    create table if not exists time_savings_settings (
      id uuid primary key default gen_random_uuid(),
      scope text not null default 'global',
      document_review_base_minutes integer not null default 20,
      document_review_per_finding_minutes integer not null default 3,
      minutes_review_base_minutes integer not null default 30,
      minutes_review_per_finding_minutes integer not null default 2,
      minutes_review_per_cta_minutes integer not null default 5,
      wa_reminder_base_minutes integer not null default 5,
      wa_reminder_per_event_minutes integer not null default 2,
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create unique index if not exists time_savings_settings_scope_uidx
      on time_savings_settings (scope)
  `;

  await sql`
    insert into time_savings_settings (scope)
    values ('global')
    on conflict (scope) do nothing
  `;

  await sql`
    create table if not exists time_savings_events (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null references users(id) on delete cascade,
      feature text not null,
      source_id text not null,
      manual_estimate_minutes integer not null,
      actual_automation_minutes integer not null,
      saved_minutes integer not null,
      metadata_json jsonb,
      occurred_at timestamptz not null default now(),
      created_at timestamptz not null default now()
    )
  `;

  await sql`
    create unique index if not exists time_savings_events_user_feature_source_uidx
      on time_savings_events (user_id, feature, source_id)
  `;

  await sql`
    create index if not exists time_savings_events_occurred_at_idx
      on time_savings_events (occurred_at)
  `;

  console.log('ok time savings schema ensured');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
