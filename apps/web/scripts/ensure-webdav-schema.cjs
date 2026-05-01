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
    create table if not exists webdav_configs (
      id uuid primary key default gen_random_uuid(),
      user_id uuid not null unique references users(id) on delete cascade,
      base_url text not null,
      username text not null,
      password text not null,
      document_review_folder text not null default '/',
      is_enabled boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists webdav_configs_user_id_idx
      on webdav_configs (user_id)
  `;

  console.log('ok webdav_configs');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
