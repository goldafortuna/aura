/* eslint-disable no-console */
const { config } = require('dotenv');
const postgres = require('postgres');

config({ path: '.env' });
config({ path: '.env.local', override: true });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const sql = postgres(connectionString, { prepare: false });

  try {
    await sql`
      insert into users (clerk_user_id, email, full_name, role)
      values ('seed-clerk-user', 'seed@secretary.local', 'Seed User', 'secretary')
      on conflict (clerk_user_id)
      do update set email = excluded.email, full_name = excluded.full_name, updated_at = now()
    `;

    const [user] = await sql`select id from users where clerk_user_id = 'seed-clerk-user' limit 1`;

    if (!user) {
      throw new Error('Failed to fetch seeded user');
    }

    await sql`
      insert into tasks (user_id, title, description, status, priority, due_date)
      values
        (${user.id}, 'Siapkan notula rapat', 'Notula rapat koordinasi mingguan', 'todo', 'high', current_date + interval '2 day'),
        (${user.id}, 'Review surat dinas', 'Periksa typo dan ambiguitas', 'in-progress', 'medium', current_date + interval '1 day')
    `;

    await sql`
      insert into documents (user_id, filename, file_type, file_size, storage_path, status, typo_count, ambiguous_count)
      values
        (${user.id}, 'Surat-Edaran-001.pdf', 'PDF', 1048576, 'mock/Surat-Edaran-001.pdf', 'reviewed', 2, 1),
        (${user.id}, 'Draft-SK-2026.docx', 'DOCX', 734003, 'mock/Draft-SK-2026.docx', 'processing', 0, 0)
    `;

    console.log('Seeding completed successfully');
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
