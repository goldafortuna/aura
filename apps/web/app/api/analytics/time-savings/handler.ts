import { Hono } from 'hono';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../../../../db';
import { timeSavingsEvents, type TimeSavingsFeature } from '../../../../db/schema';
import { isSuperAdmin, requireApprovedUser } from '../../../../lib/middleware/auth';

const app = new Hono();

type Period = 'daily' | 'monthly' | 'quarterly' | 'yearly';

const FEATURE_LABELS: Record<TimeSavingsFeature, string> = {
  document_review: 'Review Dokumen',
  minutes_cta: 'Notula/CTA',
  wa_reminder: 'WA Reminder',
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function getPeriodRange(period: Period) {
  const now = new Date();
  if (period === 'daily') {
    const start = startOfDay(now);
    return { start, end: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (period === 'monthly') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start, end: addMonths(start, 1) };
  }
  if (period === 'quarterly') {
    const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterStartMonth, 1);
    return { start, end: addMonths(start, 3) };
  }

  const start = new Date(now.getFullYear(), 0, 1);
  return { start, end: new Date(now.getFullYear() + 1, 0, 1) };
}

function parsePeriod(raw: string | undefined): Period {
  return raw === 'daily' || raw === 'monthly' || raw === 'quarterly' || raw === 'yearly'
    ? raw
    : 'monthly';
}

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const period = parsePeriod(c.req.query('period'));
  const { start, end } = getPeriodRange(period);
  const canViewAll = isSuperAdmin(dbUser);

  const where = canViewAll
    ? and(gte(timeSavingsEvents.occurredAt, start), lt(timeSavingsEvents.occurredAt, end))
    : and(
        eq(timeSavingsEvents.userId, dbUser.id),
        gte(timeSavingsEvents.occurredAt, start),
        lt(timeSavingsEvents.occurredAt, end),
      );

  const rows = await db
    .select()
    .from(timeSavingsEvents)
    .where(where)
    .orderBy(desc(timeSavingsEvents.occurredAt));

  const breakdown = (['document_review', 'minutes_cta', 'wa_reminder'] as TimeSavingsFeature[]).map((feature) => {
    const featureRows = rows.filter((row) => row.feature === feature);
    const manualEstimateMinutes = featureRows.reduce((sum, row) => sum + row.manualEstimateMinutes, 0);
    const actualAutomationMinutes = featureRows.reduce((sum, row) => sum + row.actualAutomationMinutes, 0);
    const savedMinutes = featureRows.reduce((sum, row) => sum + row.savedMinutes, 0);

    return {
      feature,
      label: FEATURE_LABELS[feature],
      count: featureRows.length,
      manualEstimateMinutes,
      actualAutomationMinutes,
      savedMinutes,
      savedHours: Number((savedMinutes / 60).toFixed(1)),
    };
  });

  const totalSavedMinutes = rows.reduce((sum, row) => sum + row.savedMinutes, 0);
  const totalManualEstimateMinutes = rows.reduce((sum, row) => sum + row.manualEstimateMinutes, 0);
  const totalActualAutomationMinutes = rows.reduce((sum, row) => sum + row.actualAutomationMinutes, 0);

  return c.json({
    data: {
      period,
      scope: canViewAll ? 'all_users' : 'current_user',
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      totals: {
        events: rows.length,
        manualEstimateMinutes: totalManualEstimateMinutes,
        actualAutomationMinutes: totalActualAutomationMinutes,
        savedMinutes: totalSavedMinutes,
        savedHours: Number((totalSavedMinutes / 60).toFixed(1)),
      },
      breakdown,
    },
  });
});

export default app;
