import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../../../db';
import { emailConfigs } from '../../../db/schema';
import { requireDbUser } from '../../../lib/middleware/auth';
import { encrypt, decrypt } from '../../../lib/encryption';
import { verifyGmailConfig } from '../../../lib/sendEmailGmail';

const app = new Hono();

const emailConfigSchema = z.object({
  gmailAddress: z.string().email(),
  gmailAppPassword: z.string().min(8),
  fromName: z.string().min(1).default('Sekretariat'),
});

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const [cfg] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);
  if (!cfg) return c.json({ data: null });
  return c.json({
    data: {
      ...cfg,
      gmailAppPassword: `****${decrypt(cfg.gmailAppPassword).slice(-4)}`,
    },
  });
});

app.put('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const parsed = emailConfigSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db
    .select({ id: emailConfigs.id })
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  const encryptedData = { ...parsed.data, gmailAppPassword: encrypt(parsed.data.gmailAppPassword) };

  if (existing) {
    const [updated] = await db
      .update(emailConfigs)
      .set({ ...encryptedData, updatedAt: new Date() })
      .where(eq(emailConfigs.userId, dbUser.id))
      .returning();
    return c.json({ data: { ...updated, gmailAppPassword: `****${decrypt(updated.gmailAppPassword).slice(-4)}` } });
  }

  const [created] = await db
    .insert(emailConfigs)
    .values({ userId: dbUser.id, ...encryptedData })
    .returning();
  return c.json(
    { data: { ...created, gmailAppPassword: `****${decrypt(created.gmailAppPassword).slice(-4)}` } },
    201,
  );
});

app.post('/verify', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const parsed = emailConfigSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  try {
    await verifyGmailConfig(parsed.data.gmailAddress, parsed.data.gmailAppPassword);
    return c.json({ data: { ok: true, message: 'Koneksi Gmail berhasil terverifikasi.' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verifikasi gagal.';
    return c.json({ error: msg }, 400);
  }
});

export default app;