import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { unitKerja } from '../../../db/schema';
import { requireDbUser } from '../../../lib/middleware/auth';

const app = new Hono();

const unitKerjaSchema = z.object({
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  email: z.string().email(),
  description: z.string().optional(),
});

app.get('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const rows = await db
    .select()
    .from(unitKerja)
    .where(eq(unitKerja.userId, dbUser.id))
    .orderBy(unitKerja.name);
  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const body = await c.req.json();
  const parsed = unitKerjaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const [created] = await db
    .insert(unitKerja)
    .values({
      userId: dbUser.id,
      name: parsed.data.name,
      aliasesJson: JSON.stringify(parsed.data.aliases),
      email: parsed.data.email,
      description: parsed.data.description ?? null,
    })
    .returning();
  return c.json({ data: created }, 201);
});

app.patch('/:id', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = unitKerjaSchema.partial().safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  const { aliases, ...rest } = parsed.data;
  const [updated] = await db
    .update(unitKerja)
    .set({
      ...rest,
      ...(aliases !== undefined ? { aliasesJson: JSON.stringify(aliases) } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(unitKerja.id, id), eq(unitKerja.userId, dbUser.id)))
    .returning();
  if (!updated) return c.json({ error: 'Unit kerja not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/:id', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  const [deleted] = await db
    .delete(unitKerja)
    .where(and(eq(unitKerja.id, id), eq(unitKerja.userId, dbUser.id)))
    .returning();
  if (!deleted) return c.json({ error: 'Unit kerja not found' }, 404);
  return c.json({ data: deleted });
});

export default app;