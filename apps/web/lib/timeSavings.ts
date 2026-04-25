import { and, eq } from 'drizzle-orm';
import { db } from '../db';
import { timeSavingsEvents, timeSavingsSettings, type TimeSavingsFeature } from '../db/schema';

export type TimeSavingsFormula = typeof timeSavingsSettings.$inferSelect;

export const DEFAULT_TIME_SAVINGS_FORMULA = {
  documentReviewBaseMinutes: 20,
  documentReviewPerFindingMinutes: 3,
  minutesReviewBaseMinutes: 30,
  minutesReviewPerFindingMinutes: 2,
  minutesReviewPerCtaMinutes: 5,
  waReminderBaseMinutes: 5,
  waReminderPerEventMinutes: 2,
} as const;

export type TimeSavingsFormulaInput = {
  [K in keyof typeof DEFAULT_TIME_SAVINGS_FORMULA]: number;
};

export async function loadTimeSavingsFormula() {
  const [row] = await db
    .select()
    .from(timeSavingsSettings)
    .where(eq(timeSavingsSettings.scope, 'global'))
    .limit(1);

  return row ?? {
    id: '',
    scope: 'global',
    ...DEFAULT_TIME_SAVINGS_FORMULA,
    updatedAt: new Date(),
  };
}

export async function upsertTimeSavingsFormula(values: TimeSavingsFormulaInput) {
  const now = new Date();
  const [existing] = await db
    .select()
    .from(timeSavingsSettings)
    .where(eq(timeSavingsSettings.scope, 'global'))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(timeSavingsSettings)
      .set({ ...values, updatedAt: now })
      .where(eq(timeSavingsSettings.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(timeSavingsSettings)
    .values({ scope: 'global', ...values, updatedAt: now })
    .returning();
  return created;
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value));
}

export function automationMinutesFromStartedAt(startedAtMs: number) {
  const elapsedMs = Math.max(0, Date.now() - startedAtMs);
  return Math.max(1, Math.ceil(elapsedMs / 60_000));
}

export async function recordTimeSavingsEvent(input: {
  userId: string;
  feature: TimeSavingsFeature;
  sourceId: string;
  manualEstimateMinutes: number;
  actualAutomationMinutes: number;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const manualEstimateMinutes = clampMinutes(input.manualEstimateMinutes);
  const actualAutomationMinutes = Math.max(1, clampMinutes(input.actualAutomationMinutes));
  const savedMinutes = Math.max(0, manualEstimateMinutes - actualAutomationMinutes);
  const occurredAt = input.occurredAt ?? new Date();

  const [existing] = await db
    .select()
    .from(timeSavingsEvents)
    .where(
      and(
        eq(timeSavingsEvents.userId, input.userId),
        eq(timeSavingsEvents.feature, input.feature),
        eq(timeSavingsEvents.sourceId, input.sourceId),
      ),
    )
    .limit(1);

  const values = {
    manualEstimateMinutes,
    actualAutomationMinutes,
    savedMinutes,
    metadataJson: input.metadata ?? null,
    occurredAt,
  };

  if (existing) {
    const [updated] = await db
      .update(timeSavingsEvents)
      .set(values)
      .where(eq(timeSavingsEvents.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(timeSavingsEvents)
    .values({
      userId: input.userId,
      feature: input.feature,
      sourceId: input.sourceId,
      ...values,
    })
    .returning();
  return created;
}

export async function recordDocumentReviewSavings(input: {
  userId: string;
  documentId: string;
  typoCount: number;
  ambiguousCount: number;
  actualAutomationMinutes: number;
  filename?: string;
}) {
  const formula = await loadTimeSavingsFormula();
  const findings = input.typoCount + input.ambiguousCount;
  const manualEstimateMinutes =
    formula.documentReviewBaseMinutes + findings * formula.documentReviewPerFindingMinutes;

  return recordTimeSavingsEvent({
    userId: input.userId,
    feature: 'document_review',
    sourceId: input.documentId,
    manualEstimateMinutes,
    actualAutomationMinutes: input.actualAutomationMinutes,
    metadata: {
      filename: input.filename,
      typoCount: input.typoCount,
      ambiguousCount: input.ambiguousCount,
      findings,
    },
  });
}

export async function recordMinutesCtaSavings(input: {
  userId: string;
  meetingMinuteId: string;
  typoCount: number;
  ambiguousCount: number;
  ctaCount: number;
  actualAutomationMinutes: number;
  title?: string;
}) {
  const formula = await loadTimeSavingsFormula();
  const findings = input.typoCount + input.ambiguousCount;
  const manualEstimateMinutes =
    formula.minutesReviewBaseMinutes +
    findings * formula.minutesReviewPerFindingMinutes +
    input.ctaCount * formula.minutesReviewPerCtaMinutes;

  return recordTimeSavingsEvent({
    userId: input.userId,
    feature: 'minutes_cta',
    sourceId: input.meetingMinuteId,
    manualEstimateMinutes,
    actualAutomationMinutes: input.actualAutomationMinutes,
    metadata: {
      title: input.title,
      typoCount: input.typoCount,
      ambiguousCount: input.ambiguousCount,
      ctaCount: input.ctaCount,
      findings,
    },
  });
}

export async function recordWaReminderSavings(input: {
  userId: string;
  sourceId: string;
  eventCount: number;
  actualAutomationMinutes: number;
  reminderType: string;
}) {
  const formula = await loadTimeSavingsFormula();
  const manualEstimateMinutes =
    formula.waReminderBaseMinutes + input.eventCount * formula.waReminderPerEventMinutes;

  return recordTimeSavingsEvent({
    userId: input.userId,
    feature: 'wa_reminder',
    sourceId: input.sourceId,
    manualEstimateMinutes,
    actualAutomationMinutes: input.actualAutomationMinutes,
    metadata: {
      reminderType: input.reminderType,
      eventCount: input.eventCount,
    },
  });
}
