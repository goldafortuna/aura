/* eslint-disable no-console */
const { config } = require('dotenv');
const fs = require('fs');
const path = require('path');
const postgres = require('postgres');

config({ path: '.env' });
config({ path: '.env.local', override: true });

const SLUG = 'pedoman-pimpinan';
const CONTENT_PATH = path.join(__dirname, 'perjadin-guidelines-content.json');

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const raw = fs.readFileSync(CONTENT_PATH, 'utf8');
  const content = JSON.parse(raw);
  const title = content?.meta?.title ?? 'Pedoman Perjalanan Dinas Pimpinan';
  const versionLabel = content?.meta?.version ?? 'SBU';

  const sql = postgres(connectionString, { prepare: false });

  try {
    console.log('Seeding pedoman perjadin...');

    const upserted = await sql`
      insert into perjadin_guidelines (
        slug,
        title,
        version_label,
        status,
        is_active,
        content
      )
      values (
        ${SLUG},
        ${title},
        ${versionLabel},
        'published',
        true,
        ${sql.json(content)}
      )
      on conflict (slug)
      do update set
        title = excluded.title,
        version_label = excluded.version_label,
        status = excluded.status,
        is_active = true,
        content = excluded.content,
        updated_at = now()
      returning id, slug, version_label
    `;

    console.log('Pedoman perjadin aktif:', upserted[0]);
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
