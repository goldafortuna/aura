import { Hono } from 'hono';
import { z } from 'zod';
import { requireSuperAdmin } from '../../../../lib/middleware/auth';
import {
  DEFAULT_TIME_SAVINGS_FORMULA,
  loadTimeSavingsFormula,
  upsertTimeSavingsFormula,
} from '../../../../lib/timeSavings';

const app = new Hono();

const formulaSchema = z.object({
  documentReviewBaseMinutes: z.number().int().min(0).max(480),
  documentReviewPerFindingMinutes: z.number().int().min(0).max(120),
  minutesReviewBaseMinutes: z.number().int().min(0).max(480),
  minutesReviewPerFindingMinutes: z.number().int().min(0).max(120),
  minutesReviewPerCtaMinutes: z.number().int().min(0).max(120),
  waReminderBaseMinutes: z.number().int().min(0).max(240),
  waReminderPerEventMinutes: z.number().int().min(0).max(120),
});

app.get('/', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Forbidden' }, 403);

  const formula = await loadTimeSavingsFormula();
  return c.json({
    data: {
      ...DEFAULT_TIME_SAVINGS_FORMULA,
      ...formula,
    },
  });
});

app.put('/', async (c) => {
  const dbUser = await requireSuperAdmin(c);
  if (!dbUser) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json();
  const parsed = formulaSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);

  const saved = await upsertTimeSavingsFormula(parsed.data);
  return c.json({ data: saved });
});

export default app;
