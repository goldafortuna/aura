import { Hono } from 'hono';
import { db } from '../../../../db';
import { aiProviderConfigs } from '../../../../db/schema';
import { requireDbUser } from '../../../../lib/middleware/auth';
import { resolveDevBypassDbUser } from '../../../../lib/devDbUser';
import { assertLocalDevEndpointAllowed } from '../../../../lib/devEndpointAccess';
import { encrypt } from '../../../../lib/encryption';

const app = new Hono();

app.post('/', async (c) => {
  const access = assertLocalDevEndpointAllowed(c.req.raw);
  if (!access.ok) {
    return new Response(JSON.stringify({ error: access.error }), {
      status: access.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let dbUser = null as any;

  dbUser = await resolveDevBypassDbUser();
  if (!dbUser) {
    dbUser = await requireDbUser(c);
    if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  }

  const provider = 'deepseek';
  const apiKey = process.env.DEV_SEED_API_KEY || 'sk_test_dev_000000';

  const encryptedKey = encrypt(apiKey);

  const [saved] = await db
    .insert(aiProviderConfigs)
    .values({
      userId: dbUser.id,
      provider,
      kind: 'openai_compatible',
      displayName: 'DeepSeek (dev)',
      apiKey: encryptedKey,
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [aiProviderConfigs.userId, aiProviderConfigs.provider],
      set: {
        apiKey: encryptedKey,
        baseUrl: 'https://api.deepseek.com/v1',
        model: 'deepseek-chat',
        updatedAt: new Date(),
        isActive: true,
      },
    })
    .returning();

  return c.json({ data: { provider: saved.provider, isActive: saved.isActive } });
});

export default app;
