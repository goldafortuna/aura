import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { webdavConfigs } from '../../../db/schema';
import { requireApprovedUser } from '../../../lib/middleware/auth';
import { decrypt, encrypt } from '../../../lib/encryption';
import { normalizeWebdavFolder, verifyWebdavConnection } from '../../../lib/webdav';

const app = new Hono();

const webdavConfigSchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1).optional(),
  documentReviewFolder: z.string().default('/'),
  isEnabled: z.boolean().default(false),
});

const webdavVerifySchema = z.object({
  baseUrl: z.string().url(),
  username: z.string().min(1),
  password: z.string().min(1),
  documentReviewFolder: z.string().default('/'),
});

function toResponseRow(row: typeof webdavConfigs.$inferSelect) {
  const plainPassword = decrypt(row.password);
  return {
    ...row,
    password: `****${plainPassword.slice(-4)}`,
  };
}

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [cfg] = await db
    .select()
    .from(webdavConfigs)
    .where(eq(webdavConfigs.userId, dbUser.id))
    .limit(1);

  if (!cfg) return c.json({ data: null });
  return c.json({ data: toResponseRow(cfg) });
});

app.put('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = webdavConfigSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db
    .select()
    .from(webdavConfigs)
    .where(eq(webdavConfigs.userId, dbUser.id))
    .limit(1);

  const normalizedFolder = normalizeWebdavFolder(parsed.data.documentReviewFolder);
  const nextPassword = parsed.data.password?.trim()
    ? encrypt(parsed.data.password.trim())
    : existing?.password;

  if (!nextPassword) {
    return c.json({ error: 'Password WebDAV wajib diisi saat konfigurasi pertama.' }, 400);
  }

  const payload = {
    baseUrl: parsed.data.baseUrl.trim(),
    username: parsed.data.username.trim(),
    password: nextPassword,
    documentReviewFolder: normalizedFolder,
    isEnabled: parsed.data.isEnabled,
  };

  if (existing) {
    const [updated] = await db
      .update(webdavConfigs)
      .set({ ...payload, updatedAt: new Date() })
      .where(eq(webdavConfigs.userId, dbUser.id))
      .returning();
    return c.json({ data: toResponseRow(updated) });
  }

  const [created] = await db
    .insert(webdavConfigs)
    .values({ userId: dbUser.id, ...payload })
    .returning();
  return c.json({ data: toResponseRow(created) }, 201);
});

app.post('/verify', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = webdavVerifySchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  try {
    const result = await verifyWebdavConnection({
      baseUrl: parsed.data.baseUrl.trim(),
      username: parsed.data.username.trim(),
      password: parsed.data.password,
      documentReviewFolder: normalizeWebdavFolder(parsed.data.documentReviewFolder),
    });

    if (!result.ok) return c.json({ error: result.message, data: { status: result.status } }, 400);

    return c.json({
      data: {
        ok: true,
        message: result.message,
        folderUrl: result.resolved.folderUrl,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verifikasi WebDAV gagal.';
    return c.json({ error: msg }, 400);
  }
});

export default app;
