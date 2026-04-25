import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { waReminderTemplates, WA_TEMPLATE_TYPES } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';
import { 
  WA_BESOK_DEFAULT_TEMPLATE,
  WA_HARI_INI_DEFAULT_TEMPLATE,
  WA_PER_KEGIATAN_DEFAULT_TEMPLATE
} from '../../../lib/googleCalendarReminder';

const app = new Hono();

const WA_TEMPLATE_DEFAULTS: Record<string, { name: string; content: string }> = {
  besok: { name: 'Reminder Agenda Besok', content: WA_BESOK_DEFAULT_TEMPLATE },
  hari_ini: { name: 'Reminder Agenda Hari Ini', content: WA_HARI_INI_DEFAULT_TEMPLATE },
  per_kegiatan: { name: 'Reminder Per Kegiatan', content: WA_PER_KEGIATAN_DEFAULT_TEMPLATE },
};

const upsertWaTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1),
});

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select()
    .from(waReminderTemplates)
    .where(eq(waReminderTemplates.userId, dbUser.id));

  const result = WA_TEMPLATE_TYPES.map((type) => {
    const row = rows.find((r) => r.type === type);
    const def = WA_TEMPLATE_DEFAULTS[type];
    return {
      type,
      name: row?.name ?? def.name,
      content: row?.content ?? def.content,
      isCustom: Boolean(row),
      id: row?.id ?? null,
    };
  });

  return c.json({ data: result });
});

app.put('/:type', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const type = c.req.param('type');
  if (!WA_TEMPLATE_TYPES.includes(type as any)) {
    return c.json({ error: `Jenis template tidak valid. Pilih: ${WA_TEMPLATE_TYPES.join(', ')}` }, 400);
  }

  const body = await c.req.json();
  const parsed = upsertWaTemplateSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db
    .select()
    .from(waReminderTemplates)
    .where(and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, type as any)))
    .limit(1);

  if (existing) {
    await db
      .update(waReminderTemplates)
      .set({ name: parsed.data.name, content: parsed.data.content, updatedAt: new Date() })
      .where(eq(waReminderTemplates.id, existing.id));
  } else {
    await db.insert(waReminderTemplates).values({
      userId: dbUser.id,
      type: type as any,
      name: parsed.data.name,
      content: parsed.data.content,
    });
  }

  return c.json({ data: { type, name: parsed.data.name, content: parsed.data.content } });
});

app.put('/:type/reset', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const type = c.req.param('type');
  if (!WA_TEMPLATE_TYPES.includes(type as any)) {
    return c.json({ error: 'Jenis template tidak valid.' }, 400);
  }

  await db
    .delete(waReminderTemplates)
    .where(and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, type as any)));

  const def = WA_TEMPLATE_DEFAULTS[type];
  return c.json({ data: { type, ...def, isCustom: false } });
});

export default app;