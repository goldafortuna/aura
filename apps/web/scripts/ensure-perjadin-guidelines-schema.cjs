/**
 * Jalankan dari folder apps/web: npm run db:ensure-perjadin-guidelines
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
    create table if not exists perjadin_guidelines (
      id uuid primary key default gen_random_uuid(),
      slug text not null unique,
      title text not null,
      version_label text not null,
      status text not null default 'published',
      is_active boolean not null default true,
      content jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

  await sql`
    create index if not exists perjadin_guidelines_active_idx
      on perjadin_guidelines (is_active, status)
  `;

  console.log('perjadin_guidelines schema OK');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => sql.end());
