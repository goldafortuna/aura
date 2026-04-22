import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

/** Scope wajib untuk Calendar API (daftar kalender + acara). Tanpa ini Google mengembalikan 403 insufficient scopes. */
const SCOPE_CALENDAR_READ = 'https://www.googleapis.com/auth/calendar.readonly';
const SCOPE_EVENTS_READ = 'https://www.googleapis.com/auth/calendar.events.readonly';
const SCOPE_USERINFO_EMAIL = 'https://www.googleapis.com/auth/userinfo.email';
const SCOPE_OPENID = 'openid';

export const GOOGLE_CALENDAR_SCOPES = [
  SCOPE_CALENDAR_READ,
  SCOPE_EVENTS_READ,
  SCOPE_USERINFO_EMAIL,
  SCOPE_OPENID,
].join(' ');

/** True jika string scope dari token endpoint mencakup akses Calendar API. */
export function oauthGrantedScopeIncludesCalendar(scope: string | null | undefined): boolean {
  if (!scope?.trim()) return false;
  const parts = scope.split(/[\s+]+/).filter(Boolean);
  return parts.some((s) => {
    if (!s.includes('googleapis.com/auth/calendar')) return false;
    return (
      s === SCOPE_CALENDAR_READ ||
      s === SCOPE_EVENTS_READ ||
      s === 'https://www.googleapis.com/auth/calendar' ||
      s === 'https://www.googleapis.com/auth/calendar.events' ||
      s.startsWith('https://www.googleapis.com/auth/calendar.')
    );
  });
}

/**
 * Google tidak selalu mengembalikan field `scope` pada body token; uji langsung ke Calendar API.
 * Satu GET ringan — cukup untuk memutuskan apakah koneksi boleh disimpan.
 */
export async function canGoogleAccessTokenReadCalendarList(accessToken: string): Promise<boolean> {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

const JAKARTA_OFFSET = '+07:00';

/** Besok (H+1) menurut kalender Asia/Jakarta — untuk timeMin/timeMax Google Calendar API. */
export function getTomorrowRangeInJakarta(now = new Date()): {
  timeMin: string;
  timeMax: string;
  tanggalLabel: string;
  hariLabel: string;
  tanggalShort: string;
  dateUtcMidnight: Date;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1));
  const ty = tomorrow.getUTCFullYear();
  const tm = tomorrow.getUTCMonth() + 1;
  const td = tomorrow.getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${ty}-${pad(tm)}-${pad(td)}`;
  const timeMin = `${dateStr}T00:00:00${JAKARTA_OFFSET}`;
  const timeMax = `${dateStr}T23:59:59${JAKARTA_OFFSET}`;
  const tanggalLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(tomorrow);
  const hariLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(tomorrow);
  const tanggalShort = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(tomorrow);
  return { timeMin, timeMax, tanggalLabel, hariLabel, tanggalShort, dateUtcMidnight: tomorrow };
}

export function getPublicAppOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`;
  return 'http://localhost:3000';
}

function stateSecret(): string {
  return process.env.GOOGLE_OAUTH_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || '';
}

export function buildGoogleOAuthState(userId: string): string {
  const secret = stateSecret();
  if (!secret) throw new Error('GOOGLE_OAUTH_STATE_SECRET atau GOOGLE_CLIENT_SECRET harus diset.');

  const payload = {
    userId,
    exp: Date.now() + 10 * 60 * 1000,
    nonce: randomBytes(8).toString('hex'),
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function parseGoogleOAuthState(state: string): { userId: string; exp: number } | null {
  const secret = stateSecret();
  if (!secret) return null;

  const idx = state.lastIndexOf('.');
  if (idx <= 0) return null;
  const body = state.slice(0, idx);
  const sig = state.slice(idx + 1);
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { userId?: string; exp?: number };
    if (!parsed.userId || typeof parsed.exp !== 'number') return null;
    if (parsed.exp < Date.now()) return null;
    return { userId: parsed.userId, exp: parsed.exp };
  } catch {
    return null;
  }
}

export function buildGoogleCalendarAuthUrl(params: { userId: string; redirectUri: string }): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID belum diset.');

  const state = buildGoogleOAuthState(params.userId);
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.searchParams.set('client_id', clientId);
  u.searchParams.set('redirect_uri', params.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', GOOGLE_CALENDAR_SCOPES);
  u.searchParams.set('access_type', 'offline');
  u.searchParams.set('prompt', 'consent');
  // true = gabungkan grant lama; sering menyisakan token hanya email jika user pernah menyetujui app tanpa Calendar.
  u.searchParams.set('include_granted_scopes', 'false');
  u.searchParams.set('state', state);
  return u.toString();
}

export async function exchangeGoogleAuthCode(params: { code: string; redirectUri: string }) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diset.');
  }

  const body = new URLSearchParams({
    code: params.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: 'authorization_code',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new Error(json.error_description || json.error || 'Gagal menukar kode OAuth Google.');
  }

  if (!json.access_token) {
    throw new Error('Respons Google tidak berisi access_token.');
  }

  const expiresAt =
    typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null;

  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    accessTokenExpiresAt: expiresAt,
    scope: typeof json.scope === 'string' ? json.scope : '',
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET belum diset.');
  }

  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  const json = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new Error(json.error_description || json.error || 'Gagal memperbarui token Google.');
  }

  if (!json.access_token) throw new Error('Respons refresh Google tidak berisi access_token.');

  const expiresAt =
    typeof json.expires_in === 'number' ? new Date(Date.now() + json.expires_in * 1000) : null;

  return { accessToken: json.access_token, accessTokenExpiresAt: expiresAt };
}

export async function fetchGoogleAccountEmail(accessToken: string): Promise<string | null> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { email?: string };
  return typeof json.email === 'string' ? json.email : null;
}

export function parseStoredCalendarIds(raw: string | null | undefined): string[] | null {
  if (raw == null || raw.trim() === '') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .filter((x): x is string => typeof x === 'string')
      .map((x) => x.trim())
      .filter(Boolean);
    return ids.length ? [...new Set(ids)] : null;
  } catch {
    return null;
  }
}

export function serializeCalendarIds(ids: string[]): string {
  return JSON.stringify(ids);
}

export type GoogleCalendarListEntry = {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
  accessRole: string;
};

/** Kalender yang terlihat di akun pengguna (termasuk yang di-share ke akun sekretaris). */
export async function fetchGoogleCalendarList(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const out: GoogleCalendarListEntry[] = [];
  let pageToken: string | undefined;

  do {
    const u = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
    u.searchParams.set('maxResults', '250');
    if (pageToken) u.searchParams.set('pageToken', pageToken);

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      if (res.status === 403 && /insufficient authentication scopes|Insufficient Permission/i.test(errText)) {
        throw new Error(
          'Akses kalender ditolak (scope tidak cukup). Di Google Account → Keamanan cabut akses aplikasi ini, lalu di aplikasi klik Putuskan lalu Hubungkan lagi. Pastikan di layar Google muncul izin Kalender, dan di Google Cloud Console → OAuth consent screen scope mencakup Calendar API.',
        );
      }
      throw new Error(`Gagal memuat daftar kalender (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        description?: string;
        primary?: boolean;
        accessRole?: string;
        hidden?: boolean;
        deleted?: boolean;
      }>;
      nextPageToken?: string;
    };

    for (const item of json.items ?? []) {
      if (!item.id || item.deleted) continue;
      if (item.hidden) continue;
      const role = item.accessRole ?? '';
      if (!['owner', 'writer', 'reader', 'freeBusyReader'].includes(role)) continue;

      out.push({
        id: item.id,
        summary: (item.summary ?? item.id).trim() || item.id,
        description: item.description?.trim() || undefined,
        primary: Boolean(item.primary),
        accessRole: role,
      });
    }

    pageToken = json.nextPageToken;
  } while (pageToken);

  out.sort((a, b) => {
    if (a.primary !== b.primary) return a.primary ? -1 : 1;
    return a.summary.localeCompare(b.summary, 'id');
  });

  return out;
}

export type CalendarEventBrief = {
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

function formatClockTwo(d: Date): string {
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function parseEventTimes(item: {
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}): { start: Date; end: Date; isAllDay: boolean; startMs: number } | null {
  const s = item.start?.dateTime ?? item.start?.date;
  const e = item.end?.dateTime ?? item.end?.date;
  if (!s) return null;

  if (item.start?.date && !item.start?.dateTime) {
    const start = new Date(`${item.start.date}T00:00:00${JAKARTA_OFFSET}`);
    const endRaw = item.end?.date ?? item.start.date;
    const end = new Date(`${endRaw}T00:00:00${JAKARTA_OFFSET}`);
    return { start, end, isAllDay: true, startMs: start.getTime() };
  }

  const start = new Date(s);
  const end = e ? new Date(e) : start;
  return { start, end, isAllDay: false, startMs: start.getTime() };
}

export async function listCalendarEventsForRange(params: {
  accessToken: string;
  calendarId: string;
  calendarSummary: string;
  timeMin: string;
  timeMax: string;
}): Promise<CalendarEventBrief[]> {
  const collected: CalendarEventBrief[] = [];
  let pageToken: string | undefined;
  const calPath = encodeURIComponent(params.calendarId);

  do {
    const u = new URL(`https://www.googleapis.com/calendar/v3/calendars/${calPath}/events`);
    u.searchParams.set('singleEvents', 'true');
    u.searchParams.set('orderBy', 'startTime');
    u.searchParams.set('timeMin', params.timeMin);
    u.searchParams.set('timeMax', params.timeMax);
    if (pageToken) u.searchParams.set('pageToken', pageToken);

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${params.accessToken}` },
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`HTTP ${res.status}: ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      items?: Array<{
        id?: string;
        summary?: string;
        description?: string;
        location?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
      nextPageToken?: string;
    };

    for (const item of json.items ?? []) {
      const times = parseEventTimes(item);
      if (!times) continue;
      const title = (item.summary ?? '(Tanpa judul)').trim() || '(Tanpa judul)';
      const location = (item.location ?? '').trim();
      const description = (item.description ?? '').trim();
      const googleEventId = item.id ?? `${title}-${times.startMs}`;

      let timeRange: string;
      if (times.isAllDay) {
        timeRange = 'Sepanjang hari';
      } else {
        timeRange = `${formatClockTwo(times.start)}–${formatClockTwo(times.end)}`;
      }

      collected.push({
        id: `${params.calendarId}|${googleEventId}`,
        googleEventId,
        calendarId: params.calendarId,
        calendarSummary: params.calendarSummary,
        title,
        timeRange,
        location,
        description,
        isAllDay: times.isAllDay,
        startMs: times.startMs,
      });
    }

    pageToken = json.nextPageToken;
  } while (pageToken);

  return collected;
}

export async function collectTomorrowEventsFromCalendars(params: {
  accessToken: string;
  calendarIds: string[];
  summaryById: Map<string, string>;
  timeMin: string;
  timeMax: string;
}): Promise<{ events: CalendarEventBrief[]; warnings: string[] }> {
  const warnings: string[] = [];
  const bucket: CalendarEventBrief[] = [];

  for (const calendarId of params.calendarIds) {
    const summary = params.summaryById.get(calendarId) ?? calendarId;
    try {
      const list = await listCalendarEventsForRange({
        accessToken: params.accessToken,
        calendarId,
        calendarSummary: summary,
        timeMin: params.timeMin,
        timeMax: params.timeMax,
      });
      bucket.push(...list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membaca acara';
      warnings.push(`${summary}: ${msg}`);
    }
  }

  bucket.sort((a, b) => a.startMs - b.startMs || a.title.localeCompare(b.title, 'id'));
  return { events: bucket, warnings };
}

// ---------------------------------------------------------------------------
// Additional date range helpers
// ---------------------------------------------------------------------------

/** Hari ini menurut kalender Asia/Jakarta. */
export function getTodayRangeInJakarta(now = new Date()): {
  timeMin: string;
  timeMax: string;
  tanggalLabel: string;
  hariLabel: string;
  tanggalShort: string;
  dateUtcMidnight: Date;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  const dateUtcMidnight = new Date(Date.UTC(y, m - 1, d));
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${y}-${pad(m)}-${pad(d)}`;
  const timeMin = `${dateStr}T00:00:00${JAKARTA_OFFSET}`;
  const timeMax = `${dateStr}T23:59:59${JAKARTA_OFFSET}`;
  const tanggalLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(dateUtcMidnight);
  const hariLabel = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'Asia/Jakarta',
  }).format(dateUtcMidnight);
  const tanggalShort = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(dateUtcMidnight);
  return { timeMin, timeMax, tanggalLabel, hariLabel, tanggalShort, dateUtcMidnight };
}

/** Minggu ini (Senin–Minggu) menurut kalender Asia/Jakarta. */
export function getWeekRangeInJakarta(now = new Date()): {
  timeMin: string;
  timeMax: string;
  weekLabel: string;
} {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const y = Number(parts.find((p) => p.type === 'year')!.value);
  const m = Number(parts.find((p) => p.type === 'month')!.value);
  const d = Number(parts.find((p) => p.type === 'day')!.value);
  const today = new Date(Date.UTC(y, m - 1, d));
  const dowUtc = today.getUTCDay(); // 0=Sun
  const daysFromMonday = dowUtc === 0 ? 6 : dowUtc - 1;
  const monday = new Date(Date.UTC(y, m - 1, d - daysFromMonday));
  const sunday = new Date(Date.UTC(y, m - 1, d - daysFromMonday + 6));
  const pad = (n: number) => String(n).padStart(2, '0');
  const monStr = `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())}`;
  const sunStr = `${sunday.getUTCFullYear()}-${pad(sunday.getUTCMonth() + 1)}-${pad(sunday.getUTCDate())}`;
  const weekLabel = `${pad(monday.getUTCDate())}–${pad(sunday.getUTCDate())} ${new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(monday)}`;
  return {
    timeMin: `${monStr}T00:00:00${JAKARTA_OFFSET}`,
    timeMax: `${sunStr}T23:59:59${JAKARTA_OFFSET}`,
    weekLabel,
  };
}

// ---------------------------------------------------------------------------
// Javanese pasaran (5-day cycle)
// Reference verified: January 1, 2000 = Legi (index 0)
// April 16, 2026 (Thursday) = Pon (index 2) — matches Kamis Pon in user data
// ---------------------------------------------------------------------------

const PASARAN = ['Legi', 'Pahing', 'Pon', 'Wage', 'Kliwon'] as const;

export function getJavanesePasaran(dateUtcMidnight: Date): string {
  const ref = Date.UTC(2000, 0, 1);
  const daysDiff = Math.floor((dateUtcMidnight.getTime() - ref) / 86400000);
  return PASARAN[((daysDiff % 5) + 5) % 5];
}

export function isKamisPon(dateUtcMidnight: Date): boolean {
  const dayName = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    timeZone: 'UTC',
  }).format(dateUtcMidnight);
  return dayName === 'Kamis' && getJavanesePasaran(dateUtcMidnight) === 'Pon';
}

// ---------------------------------------------------------------------------
// WA reminder templates (default content — stored & customisable in DB)
// Placeholders: {hari} {tanggal} {catatan_khusus} {daftar_agenda}
// ---------------------------------------------------------------------------

export const WA_HARI_INI_DEFAULT_TEMPLATE = `🗓️ *[ Agenda {hari} ]* {tanggal}
{catatan_khusus}
{daftar_agenda}`;

export const WA_BESOK_DEFAULT_TEMPLATE = `🗓️ *[ Agenda {hari} ]* {tanggal}
{catatan_khusus}
{daftar_agenda}`;

/** Placeholder: {hari} {tanggal} {judul} {jam} {tempat} {deskripsi} */
export const WA_PER_KEGIATAN_DEFAULT_TEMPLATE = `📋 *Pengingat Agenda*
🗓️ {hari}, {tanggal}

*{judul}*
⏰ Pukul: {jam}
📍 Tempat: {tempat}{deskripsi}`;

/** Convert timeRange "HH:MM–HH:MM" → "HH.MM - HH.MM" (Indonesian dot notation). */
function timeRangeToDot(timeRange: string): string {
  if (timeRange === 'Sepanjang hari') return timeRange;
  const parts = timeRange.split('–');
  if (parts.length === 2) {
    return `${parts[0].replace(':', '.')} - ${parts[1].replace(':', '.')}`;
  }
  return timeRange.replace(':', '.');
}

/** Render WA text for a date (hari ini or besok) using a given template. */
export function renderDateReminderText(params: {
  templateContent: string;
  hariLabel: string;
  tanggalShort: string;
  events: CalendarEventBrief[];
  dateUtcMidnight: Date;
}): string {
  const catatanKhusus = isKamisPon(params.dateUtcMidnight) ? 'Note: Kamis pon\n' : '';
  const daftarAgenda =
    params.events.length === 0
      ? '_Tidak ada agenda terjadwal._'
      : params.events
          .map((e, i) => {
            const pukul = timeRangeToDot(e.timeRange);
            const tempat = e.location || '-';
            const deskripsiLine = e.description?.trim() ? `\n${e.description.trim()}` : '';
            return `${i + 1}. ${e.title}\n- pukul: ${pukul}\n- tempat: ${tempat}${deskripsiLine}`;
          })
          .join('\n\n');

  return params.templateContent
    .replace('{hari}', params.hariLabel)
    .replace('{tanggal}', params.tanggalShort)
    .replace('{catatan_khusus}', catatanKhusus)
    .replace('{daftar_agenda}', daftarAgenda);
}

/** Render WA text for a single event using per_kegiatan template. */
export function renderEventReminderText(params: {
  templateContent: string;
  hariLabel: string;
  tanggalShort: string;
  title: string;
  timeRange: string;
  location: string;
  description?: string;
}): string {
  const deskripsiBlock = params.description?.trim()
    ? `\n📝 ${params.description.trim()}`
    : '';
  return params.templateContent
    .replace('{hari}', params.hariLabel)
    .replace('{tanggal}', params.tanggalShort)
    .replace('{judul}', params.title)
    .replace('{jam}', timeRangeToDot(params.timeRange))
    .replace('{tempat}', params.location || '-')
    .replace('{deskripsi}', deskripsiBlock);
}

// ---------------------------------------------------------------------------
// Legacy template (kept for backward compat — WhatsAppReminders.tsx import)
// ---------------------------------------------------------------------------

/** Template teks WA untuk semua agenda besok — satu blok salin-tempel. */
export const WA_BESOK_H1_TEMPLATE = `📅 *Pengingat agenda besok*
*Tanggal:* {tanggal_label}

{daftar_agenda}

_Mohon kesiapan dan kehadiran sesuai jadwal._
_— Sekretariat_`;

export function renderWaBesokH1Text(params: { tanggalLabel: string; events: CalendarEventBrief[] }): string {
  const multiSource = new Set(params.events.map((e) => e.calendarId)).size > 1;

  const daftar =
    params.events.length === 0
      ? '_Tidak ada acara terjadwal di kalender terpilih._'
      : params.events
          .map((e) => {
            const loc = e.location ? `\n  📍 ${e.location}` : '';
            const sumber = multiSource ? ` _[${e.calendarSummary}]_` : '';
            return `• *${e.timeRange}* — ${e.title}${sumber}${loc}`;
          })
          .join('\n\n');

  return WA_BESOK_H1_TEMPLATE.replace('{tanggal_label}', params.tanggalLabel).replace('{daftar_agenda}', daftar);
}
