import { Hono } from 'hono';
import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../../../../db';
import { timeSavingsEvents, type TimeSavingsFeature } from '../../../../db/schema';
import { isSuperAdmin, requireApprovedUser } from '../../../../lib/middleware/auth';

const app = new Hono();

type Period = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
type QuarterFilter = 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'FULL';

const FEATURE_LABELS: Record<TimeSavingsFeature, string> = {
  document_review: 'Review Dokumen',
  minutes_cta: 'Notula/CTA',
  wa_reminder: 'WA Reminder',
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function startOfWeek(date: Date) {
  const start = startOfDay(date);
  const diff = (start.getDay() + 6) % 7;
  return addDays(start, -diff);
}

function getDashboardRange(year: number, quarter: QuarterFilter) {
  if (quarter === 'Q1') return { start: new Date(year, 0, 1), end: new Date(year, 3, 1) };
  if (quarter === 'Q2') return { start: new Date(year, 3, 1), end: new Date(year, 6, 1) };
  if (quarter === 'Q3') return { start: new Date(year, 6, 1), end: new Date(year, 9, 1) };
  if (quarter === 'Q4') return { start: new Date(year, 9, 1), end: new Date(year + 1, 0, 1) };
  return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
}

function getBucketKey(date: Date, period: Period) {
  if (period === 'daily') {
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
  }
  if (period === 'weekly') {
    const weekStart = startOfWeek(date);
    return `${weekStart.getFullYear()}-${weekStart.getMonth()}-${weekStart.getDate()}`;
  }
  if (period === 'quarterly') {
    return `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
  }
  if (period === 'monthly') {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }
  return `${date.getFullYear()}`;
}

function parsePeriod(raw: string | undefined): Period {
  return raw === 'daily' || raw === 'weekly' || raw === 'monthly' || raw === 'quarterly' || raw === 'yearly'
    ? raw
    : 'monthly';
}

function parseQuarter(raw: string | undefined): QuarterFilter {
  return raw === 'Q1' || raw === 'Q2' || raw === 'Q3' || raw === 'Q4' || raw === 'FULL'
    ? raw
    : 'FULL';
}

function parseYear(raw: string | undefined) {
  const value = Number(raw);
  const currentYear = new Date().getFullYear();
  return Number.isInteger(value) && value >= 2000 && value <= 2100 ? value : currentYear;
}

function roundMetric(value: number, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

app.get('/', async (c) => {
  const dbUser = await requireApprovedUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const period = parsePeriod(c.req.query('period'));
  const year = parseYear(c.req.query('year'));
  const quarter = parseQuarter(c.req.query('quarter'));
  const { start, end } = getDashboardRange(year, quarter);
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

  const bucketCount = rows.length > 0
    ? new Set(rows.map((row) => getBucketKey(new Date(row.occurredAt), period))).size
    : 0;
  const divisor = bucketCount || 1;

  const breakdown = (['document_review', 'minutes_cta', 'wa_reminder'] as TimeSavingsFeature[]).map((feature) => {
    const featureRows = rows.filter((row) => row.feature === feature);
    const manualEstimateMinutes = featureRows.reduce((sum, row) => sum + row.manualEstimateMinutes, 0);
    const actualAutomationMinutes = featureRows.reduce((sum, row) => sum + row.actualAutomationMinutes, 0);
    const savedMinutes = featureRows.reduce((sum, row) => sum + row.savedMinutes, 0);
    const count = featureRows.length;

    return {
      feature,
      label: FEATURE_LABELS[feature],
      count: roundMetric(count / divisor, 1),
      manualEstimateMinutes: roundMetric(manualEstimateMinutes / divisor),
      actualAutomationMinutes: roundMetric(actualAutomationMinutes / divisor),
      savedMinutes: roundMetric(savedMinutes / divisor),
      savedHours: roundMetric((savedMinutes / divisor) / 60, 1),
    };
  });

  const totalSavedMinutes = rows.reduce((sum, row) => sum + row.savedMinutes, 0);
  const totalManualEstimateMinutes = rows.reduce((sum, row) => sum + row.manualEstimateMinutes, 0);
  const totalActualAutomationMinutes = rows.reduce((sum, row) => sum + row.actualAutomationMinutes, 0);

  return c.json({
    data: {
      period,
      year,
      quarter,
      scope: canViewAll ? 'all_users' : 'current_user',
      range: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      aggregation: {
        bucketCount,
      },
      totals: {
        events: roundMetric(rows.length / divisor, 1),
        manualEstimateMinutes: roundMetric(totalManualEstimateMinutes / divisor),
        actualAutomationMinutes: roundMetric(totalActualAutomationMinutes / divisor),
        savedMinutes: roundMetric(totalSavedMinutes / divisor),
        savedHours: roundMetric((totalSavedMinutes / divisor) / 60, 1),
      },
      breakdown,
    },
  });
});

export default app;
