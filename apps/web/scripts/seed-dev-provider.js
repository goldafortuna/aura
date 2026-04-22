#!/usr/bin/env node
// Seed a dev user and ai provider directly into Neon via pg
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

(async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not set in .env.local');
    process.exit(1);
  }

  const devEmail = process.env.DEV_BYPASS_EMAIL || 'dev@local.test';
  const apiKey = process.env.DEV_SEED_API_KEY || 'sk_dev_123';
  const provider = 'deepseek';

  const client = new Client({ connectionString });
  await client.connect();
  try {
    // Find or create user
    let res = await client.query('SELECT id FROM users WHERE email=$1 LIMIT 1', [devEmail]);
    let userId;
    if (res.rows.length > 0) {
      userId = res.rows[0].id;
      console.log('Found existing user', userId);
    } else {
      // generate a fake clerk id
      const fakeClerkId = 'dev-clerk-' + Date.now();
      res = await client.query(
        'INSERT INTO users (clerk_user_id, email, full_name, role) VALUES ($1,$2,$3,$4) RETURNING id',
        [fakeClerkId, devEmail, 'Dev User', 'secretary'],
      );
      userId = res.rows[0].id;
      console.log('Created user', userId);
    }

    // Upsert provider
    const upsertSql = `INSERT INTO ai_provider_configs (user_id, provider, kind, display_name, api_key, base_url, model, is_active, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,true, now(), now())
      ON CONFLICT (user_id, provider) DO UPDATE SET api_key=EXCLUDED.api_key, base_url=EXCLUDED.base_url, model=EXCLUDED.model, is_active=true, updated_at=now()
      RETURNING id`;

    const baseUrl = 'https://api.deepseek.com/v1';
    const model = 'deepseek-chat';

    res = await client.query(upsertSql, [userId, provider, 'openai_compatible', 'DeepSeek (dev)', apiKey, baseUrl, model]);
    console.log('Upserted provider, id=', res.rows[0].id);

    console.log('Seed complete');
  } catch (e) {
    console.error('Error seeding:', e.message || e);
  } finally {
    await client.end();
  }
})();
