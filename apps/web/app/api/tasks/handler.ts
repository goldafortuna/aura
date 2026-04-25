import { Hono } from 'hono';
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../../db';
import { tasks } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';

const app = new Hono();

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  dueDate: z.string().nullable().optional(),
});

function parseDueDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('Format tenggat waktu tidak valid.');
  }
  return parsed;
}

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const rows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, dbUser.id))
    .orderBy(desc(tasks.createdAt));

  return c.json({ data: rows });
});

app.post('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  let dueDate: Date | null | undefined;
  try {
    dueDate = parseDueDate(parsed.data.dueDate);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Format tenggat waktu tidak valid.' }, 400);
  }

  const [created] = await db
    .insert(tasks)
    .values({
      userId: dbUser.id,
      title: parsed.data.title,
      description: parsed.data.description,
      status: parsed.data.status ?? 'todo',
      priority: parsed.data.priority ?? 'medium',
      dueDate,
    })
    .returning();

  return c.json({ data: created }, 201);
});

app.get('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [row] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, dbUser.id)));

  if (!row) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: row });
});

app.patch('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }
  let dueDate: Date | null | undefined;
  try {
    dueDate = parseDueDate(parsed.data.dueDate);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Format tenggat waktu tidak valid.' }, 400);
  }
  const { dueDate: _dueDate, ...rest } = parsed.data;
  const values = {
    ...rest,
    ...(dueDate !== undefined ? { dueDate } : {}),
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(tasks)
    .set(values)
    .where(and(eq(tasks.id, id), eq(tasks.userId, dbUser.id)))
    .returning();

  if (!updated) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: updated });
});

app.delete('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const [deleted] = await db
    .delete(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, dbUser.id)))
    .returning();

  if (!deleted) return c.json({ error: 'Task not found' }, 404);
  return c.json({ data: deleted });
});

export default app;
