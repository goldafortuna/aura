import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../../db';
import { emailConfigs } from '../../../db/schema';
import { decrypt, encrypt } from '../../../lib/encryption';
import { requireApprovedUser } from '../../../lib/middleware/auth';
import {
  maskSecret,
  type SmtpConfigInput,
  type SmtpProvider,
  verifySmtpConfig,
} from '../../../lib/smtpEmail';

const app = new Hono();

const providerSchema = z.enum(['gmail', 'resend', 'custom']);

const emailConfigSchema = z.object({
  provider: providerSchema,
  smtpHost: z.string().min(1),
  smtpPort: z.coerce.number().int().positive(),
  smtpSecure: z.coerce.boolean(),
  smtpUsername: z.string().min(1),
  smtpPassword: z.string().min(8).optional(),
  fromAddress: z.string().email(),
  fromName: z.string().min(1).default('Sekretariat'),
});

function toResponseConfig(cfg: typeof emailConfigs.$inferSelect) {
  const decryptedLegacyPassword = decrypt(cfg.gmailAppPassword);
  const decryptedSmtpPassword = cfg.smtpPassword ? decrypt(cfg.smtpPassword) : '';

  return {
    ...cfg,
    provider: normalizeProvider(cfg.provider),
    smtpHost: cfg.smtpHost ?? inferLegacyHost(cfg.provider),
    smtpPort: cfg.smtpPort ?? inferLegacyPort(cfg.provider),
    smtpSecure: cfg.smtpHost ? cfg.smtpSecure : inferLegacySecure(cfg.provider),
    smtpUsername: cfg.smtpUsername ?? cfg.gmailAddress,
    smtpPassword: maskSecret(decryptedSmtpPassword || decryptedLegacyPassword),
    fromAddress: cfg.fromAddress ?? cfg.gmailAddress,
    fromName: cfg.fromName,
  };
}

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [cfg] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  if (!cfg) return c.json({ data: null });
  return c.json({ data: toResponseConfig(cfg) });
});

app.put('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = emailConfigSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db
    .select()
    .from(emailConfigs)
    .where(eq(emailConfigs.userId, dbUser.id))
    .limit(1);

  const password =
    parsed.data.smtpPassword?.trim() ||
    (existing?.smtpPassword ? decrypt(existing.smtpPassword) : existing ? decrypt(existing.gmailAppPassword) : '');

  if (!password) {
    return c.json({ error: 'Password SMTP wajib diisi.' }, 400);
  }

  const normalized = toStoredConfig(parsed.data, password);

  if (existing) {
    const [updated] = await db
      .update(emailConfigs)
      .set({ ...normalized, updatedAt: new Date() })
      .where(eq(emailConfigs.userId, dbUser.id))
      .returning();
    return c.json({ data: toResponseConfig(updated) });
  }

  const [created] = await db
    .insert(emailConfigs)
    .values({ userId: dbUser.id, ...normalized })
    .returning();
  return c.json({ data: toResponseConfig(created) }, 201);
});

app.post('/verify', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = emailConfigSchema.safeParse(body);
  if (!parsed.success || !parsed.data.smtpPassword) {
    return c.json({ error: 'Validation failed', details: parsed.success ? undefined : parsed.error.flatten() }, 400);
  }

  try {
    await verifySmtpConfig(toRuntimeConfig(parsed.data, parsed.data.smtpPassword));
    return c.json({ data: { ok: true, message: 'Koneksi SMTP berhasil terverifikasi.' } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Verifikasi gagal.';
    return c.json({ error: msg }, 400);
  }
});

function toStoredConfig(data: z.infer<typeof emailConfigSchema>, password: string) {
  return {
    provider: data.provider,
    smtpHost: data.smtpHost.trim(),
    smtpPort: data.smtpPort,
    smtpSecure: data.smtpSecure,
    smtpUsername: data.smtpUsername.trim(),
    smtpPassword: encrypt(password),
    fromAddress: data.fromAddress.trim(),
    fromName: data.fromName.trim() || 'Sekretariat',
    // Tetap isi kolom lama agar record baru tetap kompatibel dengan skema legacy.
    gmailAddress: data.fromAddress.trim(),
    gmailAppPassword: encrypt(password),
  };
}

function toRuntimeConfig(data: z.infer<typeof emailConfigSchema>, password: string): SmtpConfigInput {
  return {
    provider: data.provider,
    smtpHost: data.smtpHost.trim(),
    smtpPort: data.smtpPort,
    smtpSecure: data.smtpSecure,
    smtpUsername: data.smtpUsername.trim(),
    smtpPassword: password,
    fromAddress: data.fromAddress.trim(),
    fromName: data.fromName.trim() || 'Sekretariat',
  };
}

function normalizeProvider(provider: string | null | undefined): SmtpProvider {
  if (provider === 'resend' || provider === 'custom') return provider;
  return 'gmail';
}

function inferLegacyHost(provider: string | null | undefined): string {
  return normalizeProvider(provider) === 'resend' ? 'smtp.resend.com' : 'smtp.gmail.com';
}

function inferLegacyPort(provider: string | null | undefined): number {
  return normalizeProvider(provider) === 'resend' ? 465 : 587;
}

function inferLegacySecure(provider: string | null | undefined): boolean {
  return normalizeProvider(provider) === 'resend';
}

export default app;
