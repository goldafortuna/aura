import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { db } from '../../../../db';
import { googleCalendarConnections } from '../../../../db/schema';
import { requireDbUser } from '../../../../lib/middleware/auth';
import { 
  buildGoogleCalendarAuthUrl, 
  collectTomorrowEventsFromCalendars, 
  canGoogleAccessTokenReadCalendarList,
  exchangeGoogleAuthCode,
  fetchGoogleAccountEmail,
  fetchGoogleCalendarList,
  oauthGrantedScopeIncludesCalendar,
  getMonthRangeInJakarta,
  getPublicAppOrigin,
  getTodayRangeInJakarta,
  getTomorrowRangeInJakarta,
  getWeekRangeInJakarta,
  parseGoogleOAuthState,
  parseStoredCalendarIds,
  refreshGoogleAccessToken,
  renderDateReminderText,
  renderEventReminderText,
  serializeCalendarIds,
  WA_HARI_INI_DEFAULT_TEMPLATE,
  WA_BESOK_DEFAULT_TEMPLATE,
  WA_PER_KEGIATAN_DEFAULT_TEMPLATE
} from '../../../../lib/googleCalendarReminder';
import { decrypt, encrypt } from '../../../../lib/encryption';
import { waReminderTemplates } from '../../../../db/schema';
import { createRateLimitMiddleware } from '../../../../lib/middleware/rateLimit';
import { internalServerError } from '../../../../lib/httpErrors';

const app = new Hono();
const externalApiRateLimit = createRateLimitMiddleware(10, 60_000);
const readHeavyExternalApiRateLimit = createRateLimitMiddleware(5, 60_000);

type MockCalendarEvent = {
  id: string;
  googleEventId: string;
  calendarId: string;
  calendarSummary: string;
  title: string;
  timeRange: string;
  location: string;
  description: string;
  isAllDay: boolean;
  startMs: number;
};

function buildMockPlannerData() {
  const todayRange = getTodayRangeInJakarta();
  const tomorrowRange = getTomorrowRangeInJakarta();
  const weekRange = getWeekRangeInJakarta();
  const monthRange = getMonthRangeInJakarta();

  const todayEvent: MockCalendarEvent = {
    id: 'mock-primary|today-1',
    googleEventId: 'today-1',
    calendarId: 'mock-primary',
    calendarSummary: 'Kalender Pimpinan',
    title: 'Rapat Koordinasi Playwright',
    timeRange: '09:00–10:00',
    location: 'Ruang Rapat Utama',
    description: 'Sinkronisasi agenda pimpinan untuk pengujian E2E.',
    isAllDay: false,
    startMs: todayRange.dateUtcMidnight.getTime() + 9 * 60 * 60 * 1000,
  };

  const tomorrowEvent: MockCalendarEvent = {
    id: 'mock-primary|tomorrow-1',
    googleEventId: 'tomorrow-1',
    calendarId: 'mock-primary',
    calendarSummary: 'Kalender Pimpinan',
    title: 'Audiensi Mitra Strategis',
    timeRange: '13:30–14:30',
    location: 'Ruang Tamu Pimpinan',
    description: 'Pertemuan dengan mitra strategis untuk tindak lanjut program.',
    isAllDay: false,
    startMs: tomorrowRange.dateUtcMidnight.getTime() + (13 * 60 + 30) * 60 * 1000,
  };

  const weekEvent: MockCalendarEvent = {
    id: 'mock-primary|week-1',
    googleEventId: 'week-1',
    calendarId: 'mock-primary',
    calendarSummary: 'Kalender Pimpinan',
    title: 'Peninjauan Lapangan',
    timeRange: '08:00–11:00',
    location: 'Lokasi Proyek A',
    description: 'Kunjungan lapangan pimpinan pada minggu berjalan.',
    isAllDay: false,
    startMs: tomorrowRange.dateUtcMidnight.getTime() + (8 * 60) * 60 * 1000,
  };

  return {
    today: {
      events: [todayEvent],
      warnings: [] as string[],
      tanggalLabel: todayRange.tanggalLabel,
      hariLabel: todayRange.hariLabel,
      tanggalShort: todayRange.tanggalShort,
      dateIso: todayRange.timeMin.slice(0, 10),
    },
    tomorrow: {
      events: [tomorrowEvent],
      warnings: [] as string[],
      tanggalLabel: tomorrowRange.tanggalLabel,
      hariLabel: tomorrowRange.hariLabel,
      tanggalShort: tomorrowRange.tanggalShort,
      dateIso: tomorrowRange.timeMin.slice(0, 10),
    },
    week: {
      events: [todayEvent, tomorrowEvent, weekEvent].sort((a, b) => a.startMs - b.startMs),
      warnings: [] as string[],
      weekLabel: weekRange.weekLabel,
    },
    month: {
      events: [todayEvent, tomorrowEvent, weekEvent].sort((a, b) => a.startMs - b.startMs),
      warnings: [] as string[],
      monthLabel: monthRange.monthLabel,
    },
  };
}

const patchGoogleCalendarSelectionSchema = z.object({
  calendarIds: z.array(z.string().min(1)).min(1).max(40),
});

const eventReminderSchema = z.object({
  title: z.string().min(1),
  timeRange: z.string(),
  location: z.string().optional().default(''),
  description: z.string().optional().default(''),
  hariLabel: z.string(),
  tanggalShort: z.string(),
});

const calendarEventBriefSchema = z.object({
  id: z.string().optional().default(''),
  googleEventId: z.string().optional().default(''),
  calendarId: z.string().optional().default(''),
  calendarSummary: z.string().optional().default(''),
  title: z.string().min(1),
  timeRange: z.string(),
  location: z.string().optional().default(''),
  description: z.string().optional().default(''),
  isAllDay: z.boolean().optional().default(false),
  startMs: z.number(),
});

const renderDateReminderSchema = z.object({
  type: z.enum(['hari_ini', 'besok']),
  hariLabel: z.string().min(1),
  tanggalShort: z.string().min(1),
  dateIso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  events: z.array(calendarEventBriefSchema).max(100),
});

async function refreshGoogleConnectionAccessToken(
  userId: string,
  row: typeof googleCalendarConnections.$inferSelect,
) {
  let accessToken = row.accessToken ? decrypt(row.accessToken) : null;
  let accessTokenExpiresAt = row.accessTokenExpiresAt;
  const nowMs = Date.now();
  const expMs = accessTokenExpiresAt ? accessTokenExpiresAt.getTime() : 0;
  if (!accessToken || expMs < nowMs + 60_000) {
    const refreshed = await refreshGoogleAccessToken(decrypt(row.refreshToken));
    accessToken = refreshed.accessToken;
    accessTokenExpiresAt = refreshed.accessTokenExpiresAt;
    await db
      .update(googleCalendarConnections)
      .set({
        accessToken: encrypt(accessToken),
        accessTokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, userId));
  }
  return accessToken;
}

// ---------------------------------------------------------------------------
// Helper — resolve access token + chosen calendar IDs for current user
// ---------------------------------------------------------------------------
async function resolveCalendarAccess(userId: string) {
  const [row] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, userId))
    .limit(1);
  if (!row) return null;
  const accessToken = await refreshGoogleConnectionAccessToken(userId, row);
  const calendars = await fetchGoogleCalendarList(accessToken);
  const allowed = new Set(calendars.map((x) => x.id));
  const summaryById = new Map(calendars.map((x) => [x.id, x.summary] as const));
  const stored = parseStoredCalendarIds(row.reminderCalendarIds ?? null) ?? ['primary'];
  let chosen = stored.filter((id) => allowed.has(id));
  if (chosen.length === 0) chosen = ['primary'].filter((id) => allowed.has(id));
  if (chosen.length === 0 && calendars[0]) chosen = [calendars[0].id];
  return { accessToken, summaryById, chosen };
}

app.get('/status', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  if (process.env.E2E_MOCK_GOOGLE_CALENDAR === '1') {
    return c.json({
      data: {
        connected: true,
        accountEmail: 'mock-calendar@local.test',
        selectedCalendarIds: ['mock-primary'],
      },
    });
  }

  try {
    const [row] = await db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, dbUser.id))
      .limit(1);

    const stored = parseStoredCalendarIds(row?.reminderCalendarIds ?? null);

    return c.json({
      data: {
        connected: Boolean(row),
        accountEmail: row?.accountEmail ?? null,
        selectedCalendarIds: stored ?? ['primary'],
      },
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    const migrateHint =
      /does not exist|relation|google_calendar|reminder_calendar|Failed query/i.test(raw) || raw.includes('42P01')
        ? ' Pastikan skema DB sudah lengkap: dari folder apps/web jalankan npm run db:migrate. Jika migrate gagal (misalnya tabel users sudah ada tetapi journal Drizzle kosong), jalankan npm run db:ensure-gcal.'
        : '';
    console.error('[google-calendar/status]', err);
    return c.json(
      { error: `Gagal membaca status Google Calendar dari database.${migrateHint}` },
      500,
    );
  }
});

app.get('/auth-url', externalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const redirectUri = `${getPublicAppOrigin()}/api/google/calendar/oauth/callback`;
    const url = buildGoogleCalendarAuthUrl({ userId: dbUser.id, redirectUri });
    return c.json({ data: { url, redirectUri } });
  } catch (err) {
    return internalServerError(c, 'google-calendar/auth-url', err, 'Gagal membuat URL Google. Silakan coba lagi.');
  }
});

app.get('/oauth/callback', async (c) => {
  let dbUser;
  try {
    dbUser = await requireDbUser(c);
  } catch {
    return c.redirect(`${getPublicAppOrigin()}/sign-in?reason=oauth_clerk`);
  }
  if (!dbUser) {
    return c.redirect(`${getPublicAppOrigin()}/sign-in?reason=oauth_signed_out`);
  }

  const code = c.req.query('code');
  const state = c.req.query('state');
  const err = c.req.query('error');

  const origin = getPublicAppOrigin();
  const back = `${origin}/app?calendarConnected=error`;

  if (err || !code || !state) {
    return c.redirect(`${back}&reason=${encodeURIComponent(err || 'missing_code')}`);
  }

  const parsed = parseGoogleOAuthState(state);
  if (!parsed || parsed.userId !== dbUser.id) {
    return c.redirect(`${back}&reason=invalid_state`);
  }

  try {
    const redirectUri = `${getPublicAppOrigin()}/api/google/calendar/oauth/callback`;
    const tokens = await exchangeGoogleAuthCode({ code, redirectUri });
    const calendarOk =
      oauthGrantedScopeIncludesCalendar(tokens.scope) ||
      (await canGoogleAccessTokenReadCalendarList(tokens.accessToken));
    if (!calendarOk) {
      return c.redirect(
        `${back}&reason=${encodeURIComponent(
          'Google menolak akses kalender (scope). Di Google Cloud → OAuth consent screen centang scope Calendar (readonly). Di akun Google → Keamanan hapus akses aplikasi ini; di sini Putuskan lalu Hubungkan lagi.',
        )}`,
      );
    }
    const email = await fetchGoogleAccountEmail(tokens.accessToken);
    const now = new Date();

    const [existing] = await db
      .select()
      .from(googleCalendarConnections)
      .where(eq(googleCalendarConnections.userId, dbUser.id))
      .limit(1);

    // New refresh token from Google (plaintext) → encrypt; no new token → reuse existing (already encrypted).
    const refreshToken = tokens.refreshToken
      ? encrypt(tokens.refreshToken)
      : existing?.refreshToken ?? null;
    if (!refreshToken) {
      return c.redirect(`${back}&reason=${encodeURIComponent('Tidak ada refresh token. Coba cabut akses aplikasi di akun Google lalu hubungkan lagi.')}`);
    }
    const encryptedAccessToken = tokens.accessToken ? encrypt(tokens.accessToken) : null;

    await db
      .insert(googleCalendarConnections)
      .values({
        userId: dbUser.id,
        refreshToken,
        accessToken: encryptedAccessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        accountEmail: email,
        reminderCalendarIds: serializeCalendarIds(['primary']),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [googleCalendarConnections.userId],
        set: {
          refreshToken,
          accessToken: encryptedAccessToken,
          accessTokenExpiresAt: tokens.accessTokenExpiresAt,
          accountEmail: email,
          updatedAt: now,
        },
      });

    return c.redirect(`${origin}/app?calendarConnected=1`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'oauth_failed';
    return c.redirect(`${back}&reason=${encodeURIComponent(msg.slice(0, 180))}`);
  }
});

app.delete('/connection', async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  await db.delete(googleCalendarConnections).where(eq(googleCalendarConnections.userId, dbUser.id));
  return c.json({ data: { ok: true } });
});

app.get('/calendar-list', externalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const [row] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, dbUser.id))
    .limit(1);

  if (!row) {
    return c.json({ error: 'Google Calendar belum dihubungkan.' }, 400);
  }

  try {
    const accessToken = await refreshGoogleConnectionAccessToken(dbUser.id, row);
    const calendars = await fetchGoogleCalendarList(accessToken);
    const allowed = new Set(calendars.map((x) => x.id));
    const stored = parseStoredCalendarIds(row.reminderCalendarIds ?? null) ?? ['primary'];
    const selectedIds = stored.filter((id) => allowed.has(id));
    const effectiveSelected = selectedIds.length ? selectedIds : ['primary'].filter((id) => allowed.has(id));

    return c.json({
      data: {
        calendars: calendars.map((cal) => ({
          id: cal.id,
          summary: cal.summary,
          primary: cal.primary,
          accessRole: cal.accessRole,
          selected: effectiveSelected.includes(cal.id),
        })),
        selectedCalendarIds: effectiveSelected.length ? effectiveSelected : [calendars[0]?.id].filter(Boolean),
      },
    });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/calendar-list',
      err,
      'Gagal memuat daftar kalender. Silakan coba lagi.',
    );
  }
});

app.patch('/selection', externalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const body = await c.req.json();
  const parsed = patchGoogleCalendarSelectionSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
  }

  const [row] = await db
    .select()
    .from(googleCalendarConnections)
    .where(eq(googleCalendarConnections.userId, dbUser.id))
    .limit(1);

  if (!row) {
    return c.json({ error: 'Google Calendar belum dihubungkan.' }, 400);
  }

  try {
    const accessToken = await refreshGoogleConnectionAccessToken(dbUser.id, row);
    const calendars = await fetchGoogleCalendarList(accessToken);
    const allowed = new Set(calendars.map((x) => x.id));
    const filtered = parsed.data.calendarIds.filter((id) => allowed.has(id));
    if (filtered.length === 0) {
      return c.json({ error: 'Tidak ada ID kalender yang valid. Pilih dari daftar yang ditampilkan.' }, 400);
    }

    await db
      .update(googleCalendarConnections)
      .set({
        reminderCalendarIds: serializeCalendarIds(filtered),
        updatedAt: new Date(),
      })
      .where(eq(googleCalendarConnections.userId, dbUser.id));

    return c.json({ data: { selectedCalendarIds: filtered } });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/selection',
      err,
      'Gagal menyimpan pilihan kalender. Silakan coba lagi.',
    );
  }
});

app.get('/tomorrow-reminder', readHeavyExternalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const cal = await resolveCalendarAccess(dbUser.id);
  if (!cal) return c.json({ error: 'Google Calendar belum dihubungkan.' }, 400);
  if (cal.chosen.length === 0) return c.json({ error: 'Tidak ada kalender yang dapat dibaca.' }, 400);

  try {
    const tomorrowRange = getTomorrowRangeInJakarta();
    const { events, warnings } = await collectTomorrowEventsFromCalendars({
      accessToken: cal.accessToken,
      calendarIds: cal.chosen,
      summaryById: cal.summaryById,
      timeMin: tomorrowRange.timeMin,
      timeMax: tomorrowRange.timeMax,
    });

    const [templateRow] = await db
      .select()
      .from(waReminderTemplates)
      .where(
        and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, 'besok')),
      )
      .limit(1);
    const templateContent = templateRow?.content ?? WA_BESOK_DEFAULT_TEMPLATE;

    const text = renderDateReminderText({
      templateContent,
      hariLabel: tomorrowRange.hariLabel,
      tanggalShort: tomorrowRange.tanggalShort,
      events,
      dateUtcMidnight: tomorrowRange.dateUtcMidnight,
    });

    return c.json({
      data: {
        text,
        tanggalLabel: tomorrowRange.tanggalLabel,
        events,
        warnings,
        calendarIdsUsed: cal.chosen,
      },
    });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/tomorrow-reminder',
      err,
      'Gagal memuat agenda besok. Silakan coba lagi.',
    );
  }
});

app.get('/planner-events', readHeavyExternalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  if (process.env.E2E_MOCK_GOOGLE_CALENDAR === '1') {
    return c.json({ data: buildMockPlannerData() });
  }

  const cal = await resolveCalendarAccess(dbUser.id);
  if (!cal) return c.json({ error: 'Google Calendar belum dihubungkan.' }, 400);
  if (cal.chosen.length === 0) return c.json({ error: 'Tidak ada kalender yang dapat dibaca.' }, 400);

  try {
    const todayRange = getTodayRangeInJakarta();
    const tomorrowRange = getTomorrowRangeInJakarta();
    const weekRange = getWeekRangeInJakarta();
    const monthRange = getMonthRangeInJakarta();

    const [todayResult, tomorrowResult, weekResult, monthResult] = await Promise.all([
      collectTomorrowEventsFromCalendars({
        accessToken: cal.accessToken,
        calendarIds: cal.chosen,
        summaryById: cal.summaryById,
        timeMin: todayRange.timeMin,
        timeMax: todayRange.timeMax,
      }),
      collectTomorrowEventsFromCalendars({
        accessToken: cal.accessToken,
        calendarIds: cal.chosen,
        summaryById: cal.summaryById,
        timeMin: tomorrowRange.timeMin,
        timeMax: tomorrowRange.timeMax,
      }),
      collectTomorrowEventsFromCalendars({
        accessToken: cal.accessToken,
        calendarIds: cal.chosen,
        summaryById: cal.summaryById,
        timeMin: weekRange.timeMin,
        timeMax: weekRange.timeMax,
      }),
      collectTomorrowEventsFromCalendars({
        accessToken: cal.accessToken,
        calendarIds: cal.chosen,
        summaryById: cal.summaryById,
        timeMin: monthRange.timeMin,
        timeMax: monthRange.timeMax,
      }),
    ]);

    const pad = (n: number) => String(n).padStart(2, '0');
    const toIso = (d: Date) =>
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

    return c.json({
      data: {
        today: {
          events: todayResult.events,
          warnings: todayResult.warnings,
          tanggalLabel: todayRange.tanggalLabel,
          hariLabel: todayRange.hariLabel,
          tanggalShort: todayRange.tanggalShort,
          dateIso: toIso(todayRange.dateUtcMidnight),
        },
        tomorrow: {
          events: tomorrowResult.events,
          warnings: tomorrowResult.warnings,
          tanggalLabel: tomorrowRange.tanggalLabel,
          hariLabel: tomorrowRange.hariLabel,
          tanggalShort: tomorrowRange.tanggalShort,
          dateIso: toIso(tomorrowRange.dateUtcMidnight),
        },
        week: {
          events: weekResult.events,
          warnings: weekResult.warnings,
          weekLabel: weekRange.weekLabel,
        },
        month: {
          events: monthResult.events,
          warnings: monthResult.warnings,
          monthLabel: monthRange.monthLabel,
        },
      },
    });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/planner-events',
      err,
      'Gagal memuat agenda planner. Silakan coba lagi.',
    );
  }
});

app.get('/today-reminder', readHeavyExternalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  const cal = await resolveCalendarAccess(dbUser.id);
  if (!cal) return c.json({ error: 'Google Calendar belum dihubungkan.' }, 400);
  if (cal.chosen.length === 0) return c.json({ error: 'Tidak ada kalender yang dapat dibaca.' }, 400);

  try {
    const todayRange = getTodayRangeInJakarta();
    const { events, warnings } = await collectTomorrowEventsFromCalendars({
      accessToken: cal.accessToken,
      calendarIds: cal.chosen,
      summaryById: cal.summaryById,
      timeMin: todayRange.timeMin,
      timeMax: todayRange.timeMax,
    });

    const [templateRow] = await db
      .select()
      .from(waReminderTemplates)
      .where(
        and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, 'hari_ini')),
      )
      .limit(1);
    const templateContent = templateRow?.content ?? WA_HARI_INI_DEFAULT_TEMPLATE;

    const text = renderDateReminderText({
      templateContent,
      hariLabel: todayRange.hariLabel,
      tanggalShort: todayRange.tanggalShort,
      events,
      dateUtcMidnight: todayRange.dateUtcMidnight,
    });

    return c.json({
      data: {
        text,
        tanggalLabel: todayRange.tanggalLabel,
        events,
        warnings,
        calendarIdsUsed: cal.chosen,
      },
    });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/today-reminder',
      err,
      'Gagal memuat agenda hari ini. Silakan coba lagi.',
    );
  }
});

app.post('/render-date-reminder', externalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const parsed = renderDateReminderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const [templateRow] = await db
      .select()
      .from(waReminderTemplates)
      .where(
        and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, parsed.data.type)),
      )
      .limit(1);
    const templateContent =
      templateRow?.content ??
      (parsed.data.type === 'hari_ini' ? WA_HARI_INI_DEFAULT_TEMPLATE : WA_BESOK_DEFAULT_TEMPLATE);

    const text = renderDateReminderText({
      templateContent,
      hariLabel: parsed.data.hariLabel,
      tanggalShort: parsed.data.tanggalShort,
      events: parsed.data.events,
      dateUtcMidnight: new Date(`${parsed.data.dateIso}T00:00:00.000Z`),
    });

    return c.json({ data: { text } });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/render-date-reminder',
      err,
      'Gagal membuat reminder agenda. Silakan coba lagi.',
    );
  }
});

app.post('/event-reminder', externalApiRateLimit, async (c) => {
  const dbUser = await requireDbUser(c);
  if (!dbUser) return c.json({ error: 'Unauthorized' }, 401);

  try {
    const body = await c.req.json();
    const parsed = eventReminderSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Validation failed', details: parsed.error.flatten() }, 400);
    }

    const [templateRow] = await db
      .select()
      .from(waReminderTemplates)
      .where(
        and(eq(waReminderTemplates.userId, dbUser.id), eq(waReminderTemplates.type, 'per_kegiatan')),
      )
      .limit(1);
    const templateContent = templateRow?.content ?? WA_PER_KEGIATAN_DEFAULT_TEMPLATE;

    const text = renderEventReminderText({
      templateContent,
      hariLabel: parsed.data.hariLabel,
      tanggalShort: parsed.data.tanggalShort,
      title: parsed.data.title,
      timeRange: parsed.data.timeRange,
      location: parsed.data.location,
      description: parsed.data.description,
    });

    return c.json({ data: { text } });
  } catch (err) {
    return internalServerError(
      c,
      'google-calendar/event-reminder',
      err,
      'Gagal membuat reminder kegiatan. Silakan coba lagi.',
    );
  }
});

export default app;
