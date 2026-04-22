import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Copy,
  Check,
  Loader2,
  Link2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { format, addDays, startOfWeek, isSameDay, isToday, isTomorrow } from 'date-fns';
import { id } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface CalendarEvent {
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
}

interface DayMeta {
  events: CalendarEvent[];
  warnings: string[];
  tanggalLabel: string;
  hariLabel: string;
  tanggalShort: string;
  dateIso: string;
}

interface WeekMeta {
  events: CalendarEvent[];
  warnings: string[];
  weekLabel: string;
}

interface PlannerData {
  today: DayMeta;
  tomorrow: DayMeta;
  week: WeekMeta;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function readApiError(res: Response, fallback: string) {
  const text = await res.text();
  if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown };
    const msg =
      (typeof json.error === 'string' && json.error) ||
      (typeof json.message === 'string' && json.message) ||
      '';
    return msg || `${fallback} (HTTP ${res.status})`;
  } catch {
    return `${fallback} (HTTP ${res.status}): ${text.slice(0, 200)}`;
  }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

// ---------------------------------------------------------------------------
// WA Result Modal
// ---------------------------------------------------------------------------
const WaModal: React.FC<{
  title: string;
  text: string;
  onClose: () => void;
}> = ({ title, text, onClose }) => {
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  const handleCopy = async () => {
    try {
      await copyText(text);
      setCopyState('ok');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('fail');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-800">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <textarea
            readOnly
            value={text}
            rows={14}
            className="mb-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleCopy()}
              disabled={!text.trim()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {copyState === 'ok' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copyState === 'ok' ? 'Disalin!' : copyState === 'fail' ? 'Gagal salin' : 'Salin ke clipboard'}
            </button>
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              Tutup
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ---------------------------------------------------------------------------
// Event card (single agenda item row)
// ---------------------------------------------------------------------------
const EventRow: React.FC<{
  event: CalendarEvent;
  index: number;
  hariLabel: string;
  tanggalShort: string;
  showWaBtn?: boolean;
  onWaClick?: (text: string) => void;
}> = ({ event, index, hariLabel, tanggalShort, showWaBtn, onWaClick }) => {
  const [loading, setLoading] = useState(false);

  const handleWa = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/google/calendar/event-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: event.title,
          timeRange: event.timeRange,
          location: event.location,
          description: event.description,
          hariLabel,
          tanggalShort,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal generate'));
      const json = (await res.json()) as { data?: { text?: string } };
      onWaClick?.(json.data?.text ?? '');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Gagal generate WA reminder.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary-700">
        {index + 1}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold leading-tight text-gray-800">{event.title}</p>
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {event.isAllDay ? 'Sepanjang hari' : `pukul: ${event.timeRange.replace('–', ' - ')}`}
        </p>
        {event.location ? (
          <p className="flex items-center gap-1.5 text-xs text-gray-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            {event.location}
          </p>
        ) : null}
        {event.description ? (
          <p className="line-clamp-2 text-xs italic text-gray-400">{event.description}</p>
        ) : null}
      </div>
      {showWaBtn ? (
        <button
          disabled={loading}
          onClick={() => void handleWa()}
          title="Generate WA reminder untuk acara ini"
          className="shrink-0 rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <MessageSquare className="h-4 w-4" />
          )}
        </button>
      ) : null}
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Day card (Hari Ini / Besok)
// ---------------------------------------------------------------------------
const DayCard: React.FC<{
  label: string;
  meta: DayMeta;
  reminderType: 'hari_ini' | 'besok';
  reminderLabel: string;
  showPerEventWa?: boolean;
  onWaText: (text: string, title: string) => void;
}> = ({ label, meta, reminderType, reminderLabel, showPerEventWa, onWaText }) => {
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateWa = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
      // Use already-loaded events — no extra GCal fetch, renders instantly
      const res = await fetch('/api/google/calendar/render-date-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: reminderType,
          hariLabel: meta.hariLabel,
          tanggalShort: meta.tanggalShort,
          dateIso: meta.dateIso,
          events: meta.events,
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal generate'));
      const json = (await res.json()) as { data?: { text?: string } };
      onWaText(json.data?.text ?? '', reminderLabel);
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Gagal generate WA.');
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</span>
          <h3 className="mt-0.5 font-bold text-gray-800">{meta.hariLabel}, {meta.tanggalShort}</h3>
        </div>
        <button
          disabled={genLoading}
          onClick={() => void handleGenerateWa()}
          title={reminderLabel}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-60"
        >
          {genLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageSquare className="h-3.5 w-3.5" />
          )}
          WA
        </button>
      </div>

      {genError ? (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{genError}</p>
      ) : null}

      {meta.warnings.length > 0 ? (
        <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          <p className="flex items-center gap-1 text-xs font-semibold text-amber-800">
            <AlertCircle className="h-3.5 w-3.5" /> Peringatan
          </p>
          {meta.warnings.map((w) => (
            <p key={w} className="mt-0.5 text-xs text-amber-700">
              {w}
            </p>
          ))}
        </div>
      ) : null}

      <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 320 }}>
        {meta.events.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Tidak ada agenda.</p>
        ) : (
          meta.events.map((ev, i) => (
            <EventRow
              key={ev.id}
              event={ev}
              index={i}
              hariLabel={meta.hariLabel}
              tanggalShort={meta.tanggalShort}
              showWaBtn={showPerEventWa}
              onWaClick={(text) => onWaText(text, `WA — ${ev.title}`)}
            />
          ))
        )}
      </div>

      <p className="mt-3 text-right text-xs text-gray-400">
        {meta.events.length} agenda
      </p>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Week card (Agenda Minggu Ini)
// ---------------------------------------------------------------------------
const WeekCard: React.FC<{ meta: WeekMeta }> = ({ meta }) => {
  const byDay = meta.events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const d = new Date(ev.startMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
    if (!acc[d]) acc[d] = [];
    acc[d].push(ev);
    return acc;
  }, {});

  const days = Object.keys(byDay).sort();

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Minggu Ini</span>
        <h3 className="mt-0.5 font-bold text-gray-800">{meta.weekLabel}</h3>
      </div>

      {meta.warnings.length > 0 ? (
        <div className="mb-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          {meta.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700">{w}</p>
          ))}
        </div>
      ) : null}

      <div className="space-y-3 overflow-y-auto" style={{ maxHeight: 360 }}>
        {days.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">Tidak ada agenda minggu ini.</p>
        ) : (
          days.map((dateStr) => {
            const d = new Date(`${dateStr}T00:00:00+07:00`);
            const label = d.toLocaleDateString('id-ID', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              timeZone: 'Asia/Jakarta',
            });
            const todayFlag = isToday(d);
            const tomorrowFlag = isTomorrow(d);
            return (
              <div key={dateStr}>
                <p
                  className={`mb-1.5 text-xs font-semibold ${
                    todayFlag
                      ? 'text-primary-600'
                      : tomorrowFlag
                        ? 'text-secondary-600'
                        : 'text-gray-500'
                  }`}
                >
                  {label}
                  {todayFlag ? ' · Hari ini' : tomorrowFlag ? ' · Besok' : ''}
                </p>
                <div className="space-y-1.5 pl-2">
                  {byDay[dateStr].map((ev) => (
                    <div
                      key={ev.id}
                      className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
                    >
                      <p className="truncate text-xs font-medium text-gray-800">{ev.title}</p>
                      {!ev.isAllDay ? (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="h-3 w-3" />
                          {ev.timeRange.replace('–', ' - ')}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-right text-xs text-gray-400">{meta.events.length} total agenda</p>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Mini calendar (week view) — kept at bottom
// ---------------------------------------------------------------------------
const MiniWeekCalendar: React.FC<{ weekEvents: CalendarEvent[] }> = ({ weekEvents }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const getEventsForDay = (day: Date) =>
    weekEvents.filter((ev) => {
      const d = new Date(`${new Date(ev.startMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })}T00:00:00+07:00`);
      return isSameDay(d, day);
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
    >
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentDate(addDays(currentDate, -7))}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <ChevronLeft className="h-4 w-4 text-gray-600" />
          </button>
          <span className="font-bold text-gray-800">
            {format(weekStart, 'MMMM yyyy', { locale: id })}
          </span>
          <button
            onClick={() => setCurrentDate(addDays(currentDate, 7))}
            className="rounded-lg p-2 transition-colors hover:bg-gray-100"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        </div>
        <button
          onClick={() => setCurrentDate(new Date())}
          className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          Hari Ini
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day, i) => {
          const dayEvs = getEventsForDay(day);
          const isDay = isToday(day);
          return (
            <div
              key={i}
              className={`min-h-[120px] rounded-xl border-2 p-2 ${
                isDay
                  ? 'border-primary-400 bg-gradient-to-br from-primary/5 to-secondary/5'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="mb-2 text-center">
                <p className="text-[10px] uppercase text-gray-400">
                  {format(day, 'EEE', { locale: id })}
                </p>
                <p
                  className={`text-lg font-bold ${isDay ? 'text-primary-600' : 'text-gray-700'}`}
                >
                  {format(day, 'd')}
                </p>
              </div>
              <div className="space-y-1">
                {dayEvs.slice(0, 3).map((ev) => (
                  <div
                    key={ev.id}
                    className="truncate rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-800"
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvs.length > 3 ? (
                  <p className="text-[10px] text-gray-400">+{dayEvs.length - 3} lagi</p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const AgendaPlanner: React.FC = () => {
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);

  const [waModal, setWaModal] = useState<{ text: string; title: string } | null>(null);

  const fetchRef = useRef(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await fetch('/api/google/calendar/status', { cache: 'no-store' });
      if (!statusRes.ok) throw new Error(await readApiError(statusRes, 'Gagal cek koneksi'));
      const statusJson = (await statusRes.json()) as { data?: { connected?: boolean } };
      const connected = Boolean(statusJson.data?.connected);
      setCalendarConnected(connected);

      if (!connected) {
        setLoading(false);
        return;
      }

      const plannerRes = await fetch('/api/google/calendar/planner-events', { cache: 'no-store' });
      if (!plannerRes.ok) throw new Error(await readApiError(plannerRes, 'Gagal memuat agenda'));
      const plannerJson = (await plannerRes.json()) as { data?: PlannerData };
      if (plannerJson.data) setPlannerData(plannerJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    void loadData();
  }, [loadData]);

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    try {
      const res = await fetch('/api/google/calendar/auth-url', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memulai OAuth'));
      const json = (await res.json()) as { data?: { url?: string } };
      if (json.data?.url) window.location.href = json.data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal menghubungkan Google.');
      setConnectingGoogle(false);
    }
  };

  const openWaModal = (text: string, title: string) => setWaModal({ text, title });
  const closeWaModal = () => setWaModal(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-3xl font-bold text-gray-800">Agenda Pimpinan</h1>
          <p className="text-gray-500">Jadwal harian dari Google Calendar terhubung</p>
        </div>
        <button
          onClick={() => void loadData()}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {/* Loading skeleton */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-gray-100"
            />
          ))}
        </div>
      ) : calendarConnected === false ? (
        /* Not connected CTA */
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarIcon className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-800">Google Calendar belum terhubung</h2>
          <p className="mb-6 text-sm text-gray-500">
            Hubungkan akun Google untuk menampilkan agenda pimpinan secara otomatis.
          </p>
          <button
            disabled={connectingGoogle}
            onClick={() => void handleConnectGoogle()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {connectingGoogle ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="h-4 w-4" />
            )}
            Hubungkan Google Calendar
          </button>
        </motion.div>
      ) : plannerData ? (
        /* Main content */
        <>
          {/* 3 cards */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <DayCard
              label="Agenda Hari Ini"
              meta={plannerData.today}
              reminderType="hari_ini"
              reminderLabel="WA Reminder Hari Ini"
              showPerEventWa
              onWaText={openWaModal}
            />
            <DayCard
              label="Agenda Besok"
              meta={plannerData.tomorrow}
              reminderType="besok"
              reminderLabel="WA Reminder Besok"
              onWaText={openWaModal}
            />
            <WeekCard meta={plannerData.week} />
          </div>

          {/* Mini calendar */}
          <MiniWeekCalendar weekEvents={plannerData.week.events} />
        </>
      ) : null}

      {/* WA modal */}
      {waModal ? (
        <WaModal title={waModal.title} text={waModal.text} onClose={closeWaModal} />
      ) : null}
    </div>
  );
};

export default AgendaPlanner;
