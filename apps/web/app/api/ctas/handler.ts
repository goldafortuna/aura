import { Hono } from 'hono';
import { z } from 'zod';
import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../../db';
import { ctaItems, meetingMinutes } from '../../../db/schema';
import { requireSecretary } from '../../../lib/middleware/auth';
import { parseIsoDateOrNull } from '../../../lib/utils/date';

const app = new Hono();

const updateCtaSchema = z.object({
  title: z.string().min(1).optional(),
  action: z.string().min(1).optional(),
  picName: z.string().nullable().optional(),
  unit: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  status: z.enum(['pending', 'in-progress', 'completed']).optional(),
});

app.get('/', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const { unit, status, priority, meetingDateFrom, meetingDateTo } = c.req.query();

  const conditions = [eq(meetingMinutes.userId, dbUser.id)];

  if (unit && unit !== 'all') {
    conditions.push(eq(ctaItems.unit, unit));
  }
  if (status && status !== 'all') {
    conditions.push(eq(ctaItems.status, status));
  }
  if (priority && priority !== 'all') {
    conditions.push(eq(ctaItems.priority, priority));
  }
  /** Filter tanggal pelaksanaan rapat (kolom meeting_minutes.meeting_date), format YYYY-MM-DD */
  if (meetingDateFrom && /^\d{4}-\d{2}-\d{2}$/.test(meetingDateFrom)) {
    conditions.push(gte(meetingMinutes.meetingDate, meetingDateFrom));
  }
  if (meetingDateTo && /^\d{4}-\d{2}-\d{2}$/.test(meetingDateTo)) {
    conditions.push(lte(meetingMinutes.meetingDate, meetingDateTo));
  }

  const rows = await db
    .select({
      id: ctaItems.id,
      meetingMinuteId: ctaItems.meetingMinuteId,
      title: ctaItems.title,
      action: ctaItems.action,
      picName: ctaItems.picName,
      unit: ctaItems.unit,
      deadline: ctaItems.deadline,
      priority: ctaItems.priority,
      status: ctaItems.status,
      createdAt: ctaItems.createdAt,
      updatedAt: ctaItems.updatedAt,
      meetingTitle: meetingMinutes.title,
      meetingDate: meetingMinutes.meetingDate,
    })
    .from(ctaItems)
    .innerJoin(meetingMinutes, eq(ctaItems.meetingMinuteId, meetingMinutes.id))
    .where(and(...conditions))
    .orderBy(asc(ctaItems.deadline), desc(ctaItems.createdAt));

  return c.json({ data: rows });
});

app.patch('/:id', async (c) => {
  const dbUser = await requireSecretary(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const id = c.req.param('id');
  const body = await c.req.json();
  const parsed = updateCtaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const [existing] = await db.select().from(ctaItems).where(eq(ctaItems.id, id)).limit(1);
  if (!existing) return c.json({ error: 'CTA not found' }, 404);

  const [minute] = await db
    .select()
    .from(meetingMinutes)
    .where(and(eq(meetingMinutes.id, existing.meetingMinuteId), eq(meetingMinutes.userId, dbUser.id)))
    .limit(1);
  if (!minute) return c.json({ error: 'Unauthorized' }, 401);

  const next = {
    ...parsed.data,
    deadline: 'deadline' in parsed.data ? parseIsoDateOrNull(parsed.data.deadline ?? null) : undefined,
    updatedAt: new Date(),
  };

  const [updated] = await db.update(ctaItems).set(next).where(eq(ctaItems.id, id)).returning();
  return c.json({ data: updated });
});

export default app;