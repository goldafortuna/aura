require('dotenv').config({ path: '.env.local' });
require('dotenv').config();

const postgres = require('postgres');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is required.');
  process.exit(1);
}

const sql = postgres(connectionString, { max: 1 });

async function columnExists(tableName, columnName) {
  const rows = await sql`
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = ${tableName}
      and column_name = ${columnName}
    limit 1
  `;
  return rows.length > 0;
}

async function dropNotNull(tableName, columnName) {
  if (!(await columnExists(tableName, columnName))) {
    console.log(`skip ${tableName}.${columnName}: column not found`);
    return;
  }

  await sql.unsafe(`alter table "${tableName}" alter column "${columnName}" drop not null`);
  console.log(`ok ${tableName}.${columnName}: nullable`);
}

async function findFirstSuperAdminId() {
  const rows = await sql`
    select id
    from users
    where approval_status = 'approved'
      and (
        role = 'super_admin'
        or coalesce(roles_json, '') like '%super_admin%'
      )
    order by created_at asc
    limit 1
  `;
  return rows[0]?.id ?? null;
}

async function backfillGlobalSettings() {
  const superAdminId = await findFirstSuperAdminId();
  if (!superAdminId) {
    console.log('skip backfill: no approved Super Admin found');
    return;
  }

  await sql`
    insert into ai_prompt_settings (user_id, kind, system_prompt, updated_at)
    select null, source.kind, source.system_prompt, now()
    from ai_prompt_settings source
    where source.user_id = ${superAdminId}
      and not exists (
        select 1
        from ai_prompt_settings global
        where global.user_id is null
          and global.kind = source.kind
      )
  `;
  console.log('ok ai_prompt_settings: global rows backfilled when missing');

  await sql`
    insert into ai_provider_configs (
      user_id, provider, kind, display_name, api_key, base_url, model, is_active, created_at, updated_at
    )
    select
      null,
      source.provider,
      source.kind,
      source.display_name,
      source.api_key,
      source.base_url,
      source.model,
      source.is_active,
      now(),
      now()
    from ai_provider_configs source
    where source.user_id = ${superAdminId}
      and source.provider in ('deepseek', 'openai')
      and not exists (
        select 1
        from ai_provider_configs global
        where global.user_id is null
          and global.provider = source.provider
      )
  `;
  console.log('ok ai_provider_configs: global DeepSeek/GPT rows backfilled when missing');

  const globalUnitRows = await sql`select 1 from unit_kerja where user_id is null limit 1`;
  if (globalUnitRows.length === 0) {
    await sql`
      insert into unit_kerja (user_id, name, aliases_json, email, description, created_at, updated_at)
      select null, name, aliases_json, email, description, now(), now()
      from unit_kerja
      where user_id = ${superAdminId}
    `;
    console.log('ok unit_kerja: global rows backfilled from first Super Admin');
  } else {
    console.log('skip unit_kerja backfill: global rows already exist');
  }
}

async function main() {
  await dropNotNull('ai_provider_configs', 'user_id');
  await dropNotNull('ai_prompt_settings', 'user_id');
  await dropNotNull('unit_kerja', 'user_id');
  await backfillGlobalSettings();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
