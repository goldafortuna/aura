import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Link2,
  Loader2,
  MapPin,
  MessageSquare,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isTomorrow,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { id } from 'date-fns/locale';

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

interface MonthMeta {
  events: CalendarEvent[];
  warnings: string[];
  monthLabel: string;
  monthStartIso: string;
}

interface PlannerData {
  today: DayMeta;
  tomorrow: DayMeta;
  week: WeekMeta;
  month: MonthMeta;
}

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

function normalizeTimeRange(value: string) {
  return value.replace('â€“', ' - ').replace('–', ' - ');
}

function eventDateKey(event: CalendarEvent) {
  return new Date(event.startMs).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function formatDateKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

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
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 12 }}
          className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-600">WhatsApp Reminder</p>
              <h3 className="mt-1 text-lg font-bold text-gray-900">{title}</h3>
            </div>
            <button onClick={onClose} className="rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100" title="Tutup">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6">
            <textarea
              readOnly
              value={text}
              rows={14}
              className="mb-4 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-sm text-gray-800 outline-none"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => void handleCopy()}
                disabled={!text.trim()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {copyState === 'ok' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copyState === 'ok' ? 'Disalin' : copyState === 'fail' ? 'Gagal salin' : 'Salin ke clipboard'}
              </button>
              <button
                onClick={onClose}
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
              >
                Tutup
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

const EventRow: React.FC<{
  event: CalendarEvent;
  index: number;
  hariLabel: string;
  tanggalShort: string;
  compact?: boolean;
  showWaBtn?: boolean;
  onWaClick?: (text: string) => void;
}> = ({ event, index, hariLabel, tanggalShort, compact, showWaBtn, onWaClick }) => {
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group rounded-xl border border-gray-100 bg-white/95 p-3 shadow-sm transition-all hover:border-primary/25 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary-500 to-sky-500 text-xs font-bold text-white shadow-sm shadow-primary-500/20">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-bold leading-snug text-gray-900">{event.title}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2 py-1">
              <Clock className="h-3 w-3" />
              {event.isAllDay ? 'Sepanjang hari' : normalizeTimeRange(event.timeRange)}
            </span>
            {event.location ? (
              <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-sky-50 px-2 py-1 text-sky-700">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{event.location}</span>
              </span>
            ) : null}
          </div>
          {!compact && event.description ? (
            <p className="mt-2 line-clamp-2 text-xs text-gray-400">{event.description}</p>
          ) : null}
        </div>
        {showWaBtn ? (
          <button
            disabled={loading}
            onClick={() => void handleWa()}
            title="Generate WA reminder untuk acara ini"
            className="shrink-0 rounded-lg border border-emerald-100 bg-emerald-50 p-2 text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
    </motion.div>
  );
};

const DayPanel: React.FC<{
  label: string;
  meta: DayMeta;
  reminderType: 'hari_ini' | 'besok';
  reminderLabel: string;
  tone: 'dark' | 'light';
  showPerEventWa?: boolean;
  onWaText: (text: string, title: string) => void;
}> = ({ label, meta, reminderType, reminderLabel, tone, showPerEventWa, onWaText }) => {
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const handleGenerateWa = async () => {
    setGenLoading(true);
    setGenError(null);
    try {
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

  const dark = tone === 'dark';

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`overflow-hidden rounded-2xl border p-5 shadow-sm ${
        dark
          ? 'border-teal-100 bg-gradient-to-br from-teal-50 via-cyan-50 to-violet-50 text-gray-950 shadow-teal-900/5'
          : 'border-gray-100 bg-white text-gray-900'
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${dark ? 'text-teal-700' : 'text-primary-600'}`}>
            {label}
          </p>
          <h3 className="mt-1 text-lg font-bold">{meta.hariLabel}, {meta.tanggalShort}</h3>
          <p className={`mt-1 text-xs ${dark ? 'text-teal-700/70' : 'text-gray-500'}`}>{meta.events.length} agenda terjadwal</p>
        </div>
        <button
          disabled={genLoading}
          onClick={() => void handleGenerateWa()}
          title={reminderLabel}
          className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:opacity-60 ${
            dark
              ? 'bg-teal-600 text-white shadow-sm shadow-teal-700/20 hover:bg-teal-700'
              : 'bg-emerald-600 text-white hover:bg-emerald-700'
          }`}
        >
          {genLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
          WA
        </button>
      </div>

      {genError ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{genError}</p>
      ) : null}

      {meta.warnings.length > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {meta.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: 360 }}>
        {meta.events.length === 0 ? (
          <div className={`rounded-xl border border-dashed px-4 py-8 text-center text-sm ${dark ? 'border-teal-200 bg-white/50 text-teal-700/70' : 'border-gray-200 text-gray-400'}`}>
            Tidak ada agenda.
          </div>
        ) : (
          meta.events.map((event, index) => (
            <EventRow
              key={event.id}
              event={event}
              index={index}
              hariLabel={meta.hariLabel}
              tanggalShort={meta.tanggalShort}
              showWaBtn={showPerEventWa}
              onWaClick={(text) => onWaText(text, `WA - ${event.title}`)}
            />
          ))
        )}
      </div>
    </motion.section>
  );
};

const WeekAgenda: React.FC<{ meta: WeekMeta }> = ({ meta }) => {
  const grouped = useMemo(() => {
    return meta.events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = eventDateKey(event);
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [meta.events]);

  const days = Object.keys(grouped).sort();

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">Pekan Ini</p>
          <h3 className="mt-1 text-lg font-bold text-gray-900">{meta.weekLabel}</h3>
        </div>
        <span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">{meta.events.length} agenda</span>
      </div>

      {meta.warnings.length > 0 ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {meta.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="space-y-4 overflow-y-auto pr-1" style={{ maxHeight: 420 }}>
        {days.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
            Tidak ada agenda minggu ini.
          </p>
        ) : (
          days.map((dateKey) => {
            const date = new Date(`${dateKey}T00:00:00+07:00`);
            const label = date.toLocaleDateString('id-ID', {
              weekday: 'long',
              day: 'numeric',
              month: 'short',
              timeZone: 'Asia/Jakarta',
            });
            return (
              <div key={dateKey}>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-800">
                    {label}
                    {isToday(date) ? <span className="ml-2 text-primary-600">Hari ini</span> : null}
                    {isTomorrow(date) ? <span className="ml-2 text-emerald-600">Besok</span> : null}
                  </p>
                  <span className="text-xs font-semibold text-gray-400">{grouped[dateKey].length}</span>
                </div>
                <div className="space-y-2">
                  {grouped[dateKey].map((event, index) => (
                    <EventRow
                      key={event.id}
                      event={event}
                      index={index}
                      hariLabel={label}
                      tanggalShort={label}
                      compact
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>
    </motion.section>
  );
};

const MonthCalendar: React.FC<{
  meta: MonthMeta;
  monthOffset: number;
  onNavigate: (nextOffset: number) => void;
  loading?: boolean;
}> = ({ meta, monthOffset, onNavigate, loading }) => {
  const currentDate = meta.monthStartIso
    ? new Date(`${meta.monthStartIso}T00:00:00+07:00`)
    : addMonths(new Date(), monthOffset);
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const weekdayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

  const grouped = useMemo(() => {
    return meta.events.reduce<Record<string, CalendarEvent[]>>((acc, event) => {
      const key = eventDateKey(event);
      if (!acc[key]) acc[key] = [];
      acc[key].push(event);
      return acc;
    }, {});
  }, [meta.events]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.14 }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary-600">Kalender Bulanan</p>
          <h3 className="mt-1 text-xl font-bold text-gray-900">{meta.monthLabel || format(currentDate, 'MMMM yyyy', { locale: id })}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate(monthOffset - 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Bulan sebelumnya
          </button>
          <button
            type="button"
            onClick={() => onNavigate(monthOffset + 1)}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            Bulan berikutnya
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700">
            {meta.events.length} agenda {meta.monthLabel.toLowerCase()}
          </span>
        </div>
      </div>

      {meta.warnings.length > 0 ? (
        <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          {meta.warnings.map((warning) => <p key={warning}>{warning}</p>)}
        </div>
      ) : null}

      <div className="p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1.5">
          {weekdayLabels.map((day) => (
            <div key={day} className="px-1 py-2 text-center text-[11px] font-bold uppercase tracking-wide text-gray-400">
              {day}
            </div>
          ))}
          {days.map((day) => {
            const key = formatDateKey(day);
            const events = grouped[key] ?? [];
            const activeMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            return (
              <div
                key={key}
                className={`min-h-[112px] rounded-xl border p-2 transition-colors ${
                  today
                    ? 'border-primary-400 bg-primary/5 shadow-sm'
                    : activeMonth
                      ? 'border-gray-100 bg-white hover:border-gray-200'
                      : 'border-gray-50 bg-gray-50/60 text-gray-300'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${today ? 'bg-primary-600 text-white' : activeMonth ? 'text-gray-800' : 'text-gray-300'}`}>
                    {format(day, 'd')}
                  </span>
                  {events.length > 0 ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{events.length}</span>
                  ) : null}
                </div>
                <div className="space-y-1">
                  {events.slice(0, 3).map((event) => (
                    <div
                      key={event.id}
                      title={event.title}
                      className="truncate rounded-md border border-primary/10 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary-800"
                    >
                      {!event.isAllDay ? `${normalizeTimeRange(event.timeRange).split(' ')[0]} ` : ''}
                      {event.title}
                    </div>
                  ))}
                  {events.length > 3 ? (
                    <p className="px-1 text-[11px] font-semibold text-gray-400">+{events.length - 3} lagi</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
};

export const AgendaPlanner: React.FC = () => {
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const [plannerData, setPlannerData] = useState<PlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [waModal, setWaModal] = useState<{ text: string; title: string } | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  const fetchRef = useRef(false);

  const loadData = useCallback(async (nextMonthOffset = monthOffset, forceStatusCheck = false) => {
    setLoading(true);
    setError(null);
    try {
      let connected = calendarConnected;
      if (forceStatusCheck || connected === null) {
        const statusRes = await fetch('/api/google/calendar/status', { cache: 'no-store' });
        if (!statusRes.ok) throw new Error(await readApiError(statusRes, 'Gagal cek koneksi'));
        const statusJson = (await statusRes.json()) as { data?: { connected?: boolean } };
        connected = Boolean(statusJson.data?.connected);
        setCalendarConnected(connected);
      }

      if (!connected) {
        setLoading(false);
        return;
      }

      const params = new URLSearchParams();
      if (nextMonthOffset !== 0) params.set('monthOffset', String(nextMonthOffset));
      const plannerRes = await fetch(`/api/google/calendar/planner-events${params.size ? `?${params.toString()}` : ''}`, {
        cache: 'no-store',
      });
      if (!plannerRes.ok) throw new Error(await readApiError(plannerRes, 'Gagal memuat agenda'));
      const plannerJson = (await plannerRes.json()) as { data?: PlannerData };
      if (plannerJson.data) setPlannerData(plannerJson.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat data.');
    } finally {
      setLoading(false);
    }
  }, [calendarConnected, monthOffset]);

  useEffect(() => {
    if (fetchRef.current) return;
    fetchRef.current = true;
    void loadData(monthOffset, true);
  }, [loadData]);

  useEffect(() => {
    if (!fetchRef.current) return;
    void loadData(monthOffset);
  }, [loadData, monthOffset]);

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

  const summary = useMemo(() => {
    if (!plannerData) return null;
    const monthEvents = plannerData.month?.events ?? [];
    const nextEvent = monthEvents.find((event) => event.startMs >= Date.now()) ?? monthEvents[0] ?? null;
    const calendars = new Set(monthEvents.map((event) => event.calendarSummary || event.calendarId)).size;
    return {
      today: plannerData.today.events.length,
      tomorrow: plannerData.tomorrow.events.length,
      week: plannerData.week.events.length,
      month: monthEvents.length,
      calendars,
      nextEvent,
    };
  }, [plannerData]);

  const openWaModal = (text: string, title: string) => setWaModal({ text, title });
  const closeWaModal = () => setWaModal(null);
  const handleMonthNavigate = (nextOffset: number) => setMonthOffset(nextOffset);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-white/70 bg-gradient-to-br from-violet-50 via-sky-50 to-emerald-50 text-gray-950 shadow-xl shadow-sky-900/10"
      >
        <div className="relative p-6 sm:p-8">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-fuchsia-300 via-sky-300 to-emerald-300" />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-3 py-1 text-xs font-semibold text-primary-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                Agenda Command Center
              </div>
              <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Agenda Pimpinan</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600">
                Tampilan eksekutif untuk memantau agenda harian, pekanan, dan kalender bulanan dari Google Calendar terhubung.
              </p>
            </div>
            <button
              onClick={() => void loadData(monthOffset, true)}
              disabled={loading}
              className="inline-flex w-fit items-center gap-2 rounded-xl border border-primary-100 bg-white px-4 py-2.5 text-sm font-bold text-primary-800 shadow-sm transition-colors hover:bg-primary-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Muat ulang
            </button>
          </div>

          {summary ? (
            <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ['Hari ini', summary.today],
                ['Besok', summary.tomorrow],
                ['Pekan ini', summary.week],
                ['Bulan ini', summary.month],
                ['Kalender', summary.calendars || 1],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/80 bg-white/60 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-xs font-medium text-gray-500">{label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-950">{Number(value).toLocaleString('id-ID')}</p>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </motion.section>

      {error ? (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />
          ))}
        </div>
      ) : calendarConnected === false ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm"
        >
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <CalendarIcon className="h-8 w-8 text-primary-600" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-gray-900">Google Calendar belum terhubung</h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-500">
            Hubungkan akun Google untuk menampilkan agenda pimpinan secara otomatis.
          </p>
          <button
            disabled={connectingGoogle}
            onClick={() => void handleConnectGoogle()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 disabled:opacity-60"
          >
            {connectingGoogle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Hubungkan Google Calendar
          </button>
        </motion.div>
      ) : plannerData ? (
        <>
          {summary?.nextEvent ? (
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-sky-50 p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Agenda Berikutnya</p>
                  <h2 className="mt-1 text-xl font-bold text-gray-900">{summary.nextEvent.title}</h2>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-600">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                      <Clock className="h-3.5 w-3.5" />
                      {summary.nextEvent.isAllDay ? 'Sepanjang hari' : normalizeTimeRange(summary.nextEvent.timeRange)}
                    </span>
                    {summary.nextEvent.location ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 shadow-sm">
                        <MapPin className="h-3.5 w-3.5" />
                        {summary.nextEvent.location}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span className="w-fit rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm">
                  {summary.nextEvent.calendarSummary}
                </span>
              </div>
            </motion.section>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <DayPanel
              label="Hari Ini"
              meta={plannerData.today}
              reminderType="hari_ini"
              reminderLabel="WA Reminder Hari Ini"
              tone="dark"
              showPerEventWa
              onWaText={openWaModal}
            />
            <DayPanel
              label="Besok"
              meta={plannerData.tomorrow}
              reminderType="besok"
              reminderLabel="WA Reminder Besok"
              tone="light"
              onWaText={openWaModal}
            />
            <WeekAgenda meta={plannerData.week} />
          </div>

          <MonthCalendar
            meta={plannerData.month}
            monthOffset={monthOffset}
            onNavigate={handleMonthNavigate}
            loading={loading}
          />
        </>
      ) : null}

      {waModal ? <WaModal title={waModal.title} text={waModal.text} onClose={closeWaModal} /> : null}
    </div>
  );
};

export default AgendaPlanner;
