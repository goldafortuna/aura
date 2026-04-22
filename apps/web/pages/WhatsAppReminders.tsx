import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  MessageSquare,
  Edit,
  Loader2,
  Copy,
  Check,
  Link2,
  Unplug,
  ClipboardList,
  Save,
  RotateCcw,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type WaTemplateType = 'besok' | 'hari_ini' | 'per_kegiatan';

interface WaTemplate {
  type: WaTemplateType;
  name: string;
  content: string;
  isCustom: boolean;
  id: string | null;
}

type GoogleCalendarRow = {
  id: string;
  summary: string;
  primary: boolean;
  accessRole: string;
  selected: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const TEMPLATE_LABELS: Record<WaTemplateType, string> = {
  besok: 'Agenda Besok (H+1)',
  hari_ini: 'Agenda Hari Ini',
  per_kegiatan: 'Per Kegiatan',
};

const TEMPLATE_PLACEHOLDER_HINTS: Record<WaTemplateType, string[]> = {
  besok: ['{hari}', '{tanggal}', '{catatan_khusus}', '{daftar_agenda}'],
  hari_ini: ['{hari}', '{tanggal}', '{catatan_khusus}', '{daftar_agenda}'],
  per_kegiatan: ['{hari}', '{tanggal}', '{judul}', '{jam}', '{tempat}', '{deskripsi}'],
};

const TEMPLATE_COLORS: Record<WaTemplateType, string> = {
  besok: 'bg-blue-50 text-blue-700 border-blue-200',
  hari_ini: 'bg-green-50 text-green-700 border-green-200',
  per_kegiatan: 'bg-purple-50 text-purple-700 border-purple-200',
};

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

async function copyToClipboard(text: string) {
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
// Template card component
// ---------------------------------------------------------------------------
const TemplateCard: React.FC<{
  tpl: WaTemplate;
  editingType: WaTemplateType | null;
  editName: string;
  editContent: string;
  editSaving: boolean;
  editError: string | null;
  resetLoading: WaTemplateType | null;
  onEdit: (tpl: WaTemplate) => void;
  onCancel: () => void;
  onSave: () => void;
  onReset: (type: WaTemplateType) => void;
  onEditName: (v: string) => void;
  onEditContent: (v: string) => void;
}> = ({
  tpl,
  editingType,
  editName,
  editContent,
  editSaving,
  editError,
  resetLoading,
  onEdit,
  onCancel,
  onSave,
  onReset,
  onEditName,
  onEditContent,
}) => {
  const isEditing = editingType === tpl.type;
  const colorClass = TEMPLATE_COLORS[tpl.type];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Card header */}
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-4">
        <div className="min-w-0">
          <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClass}`}>
            {TEMPLATE_LABELS[tpl.type]}
          </span>
          <h3 className="mt-1.5 font-semibold text-gray-800">{tpl.name}</h3>
          <div className="mt-1 flex flex-wrap gap-1">
            {TEMPLATE_PLACEHOLDER_HINTS[tpl.type].map((ph) => (
              <code key={ph} className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                {ph}
              </code>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {tpl.isCustom && (
            <button
              disabled={resetLoading === tpl.type}
              onClick={() => onReset(tpl.type)}
              title="Reset ke default"
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              {resetLoading === tpl.type ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="h-3 w-3" />
              )}
              <span className="hidden sm:inline">Reset</span>
            </button>
          )}
          {!isEditing && (
            <button
              onClick={() => onEdit(tpl)}
              className="flex items-center gap-1 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-primary-700"
            >
              <Edit className="h-3 w-3" />
              <span className="hidden sm:inline">Edit</span>
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4">
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Nama template</label>
              <input
                value={editName}
                onChange={(e) => onEditName(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Konten template</label>
              <textarea
                value={editContent}
                onChange={(e) => onEditContent(e.target.value)}
                rows={10}
                className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs text-gray-800 outline-none transition-shadow focus:ring-2 focus:ring-primary/30"
              />
            </div>
            {editError && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">{editError}</p>
            )}
            <div className="flex gap-2">
              <button
                disabled={editSaving || !editContent.trim() || !editName.trim()}
                onClick={onSave}
                className="inline-flex items-center gap-1.5 rounded-xl bg-green-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
              >
                {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Simpan
              </button>
              <button
                onClick={onCancel}
                className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <>
            <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-gray-100 bg-gray-50 px-3 py-2.5 font-mono text-xs leading-relaxed text-gray-600">
              {tpl.content}
            </pre>
            {tpl.isCustom && (
              <p className="mt-2 flex items-center gap-1 text-xs text-primary-600">
                <CheckCircle2 className="h-3 w-3" />
                Dikustomisasi
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const WhatsAppReminders: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Google Calendar state ──
  const [calendarStatusLoading, setCalendarStatusLoading] = useState(true);
  const [calendarConnected, setCalendarConnected] = useState(false);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [connectingGoogle, setConnectingGoogle] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [oauthBanner, setOauthBanner] = useState<'success' | 'error' | null>(null);

  // ── Calendar selection state ──
  const [calendarRows, setCalendarRows] = useState<GoogleCalendarRow[]>([]);
  const [pickCalendars, setPickCalendars] = useState<Record<string, boolean>>({});
  const [calendarListLoading, setCalendarListLoading] = useState(false);
  const [selectionSaving, setSelectionSaving] = useState(false);
  const [calendarSectionOpen, setCalendarSectionOpen] = useState(false);

  // ── WA generation state ──
  const [reminderLoading, setReminderLoading] = useState(false);
  const [reminderText, setReminderText] = useState('');
  const [reminderMeta, setReminderMeta] = useState<{ tanggalLabel: string; count: number } | null>(null);
  const [reminderWarnings, setReminderWarnings] = useState<string[]>([]);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');

  // ── Template state ──
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>([]);
  const [waTemplatesLoading, setWaTemplatesLoading] = useState(false);
  const [editingType, setEditingType] = useState<WaTemplateType | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState<WaTemplateType | null>(null);

  // ── Data loaders ──
  const loadWaTemplates = useCallback(async () => {
    setWaTemplatesLoading(true);
    try {
      const res = await fetch('/api/wa-templates', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as { data?: WaTemplate[] };
      if (Array.isArray(json.data)) setWaTemplates(json.data);
    } catch {
      // non-blocking
    } finally {
      setWaTemplatesLoading(false);
    }
  }, []);

  const loadCalendarList = useCallback(async () => {
    setCalendarListLoading(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/google/calendar/calendar-list', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat daftar kalender'));
      const json = (await res.json()) as { data?: { calendars?: GoogleCalendarRow[] } };
      const rows = json.data?.calendars ?? [];
      setCalendarRows(rows);
      const picks: Record<string, boolean> = {};
      rows.forEach((r) => { picks[r.id] = r.selected; });
      setPickCalendars(picks);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal memuat daftar kalender.');
      setCalendarRows([]);
      setPickCalendars({});
    } finally {
      setCalendarListLoading(false);
    }
  }, []);

  const loadCalendarStatus = useCallback(async () => {
    setCalendarStatusLoading(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/google/calendar/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memeriksa koneksi Google'));
      const json = (await res.json()) as { data?: { connected?: boolean; accountEmail?: string | null } };
      setCalendarConnected(Boolean(json.data?.connected));
      setCalendarEmail(json.data?.accountEmail ?? null);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal memuat status Google Calendar.');
      setCalendarConnected(false);
    } finally {
      setCalendarStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalendarStatus();
    void loadWaTemplates();
  }, [loadCalendarStatus, loadWaTemplates]);

  useEffect(() => {
    if (calendarConnected && !calendarStatusLoading) {
      void loadCalendarList();
    } else if (!calendarConnected) {
      setCalendarRows([]);
      setPickCalendars({});
      setReminderWarnings([]);
    }
  }, [calendarConnected, calendarStatusLoading, loadCalendarList]);

  useEffect(() => {
    const v = searchParams?.get('calendarConnected');
    if (v === '1') {
      setOauthBanner('success');
      void loadCalendarStatus();
    } else if (v === 'error') {
      setOauthBanner('error');
    }
  }, [searchParams, loadCalendarStatus]);

  // ── Event handlers ──
  const clearCalendarQuery = () => {
    setOauthBanner(null);
    router.replace('/app', { scroll: false });
  };

  const handleConnectGoogle = async () => {
    setConnectingGoogle(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/google/calendar/auth-url', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memulai OAuth Google'));
      const json = (await res.json()) as { data?: { url?: string }; error?: string };
      if (!json.data?.url) throw new Error(json.error || 'URL OAuth tidak tersedia.');
      window.location.href = json.data.url;
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal menghubungkan Google.');
      setConnectingGoogle(false);
    }
  };

  const handleDisconnectGoogle = async () => {
    setDisconnecting(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/google/calendar/connection', { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memutuskan koneksi'));
      setReminderText('');
      setReminderMeta(null);
      setReminderWarnings([]);
      setCalendarRows([]);
      setPickCalendars({});
      await loadCalendarStatus();
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal memutuskan koneksi.');
    } finally {
      setDisconnecting(false);
    }
  };

  const handleLoadTomorrowReminder = async () => {
    setReminderLoading(true);
    setCalendarError(null);
    setCopyState('idle');
    setReminderWarnings([]);
    try {
      const res = await fetch('/api/google/calendar/tomorrow-reminder', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat agenda besok'));
      const json = (await res.json()) as {
        data?: { text?: string; tanggalLabel?: string; events?: unknown[]; warnings?: string[] };
      };
      setReminderText(json.data?.text ?? '');
      setReminderMeta({
        tanggalLabel: json.data?.tanggalLabel ?? '',
        count: Array.isArray(json.data?.events) ? json.data.events.length : 0,
      });
      setReminderWarnings(Array.isArray(json.data?.warnings) ? json.data.warnings : []);
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal memuat pengingat.');
    } finally {
      setReminderLoading(false);
    }
  };

  const toggleCalendarPick = (id: string) => {
    setPickCalendars((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSaveCalendarSelection = async () => {
    const ids = Object.entries(pickCalendars).filter(([, on]) => on).map(([id]) => id);
    if (ids.length === 0) { setCalendarError('Pilih minimal satu kalender.'); return; }
    setSelectionSaving(true);
    setCalendarError(null);
    try {
      const res = await fetch('/api/google/calendar/selection', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarIds: ids }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan pilihan'));
      await loadCalendarList();
    } catch (e) {
      setCalendarError(e instanceof Error ? e.message : 'Gagal menyimpan pilihan.');
    } finally {
      setSelectionSaving(false);
    }
  };

  const pickedCount = Object.values(pickCalendars).filter(Boolean).length;

  const handleCopyReminder = async () => {
    if (!reminderText.trim()) return;
    try {
      await copyToClipboard(reminderText);
      setCopyState('ok');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('fail');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  const startEditTemplate = (tpl: WaTemplate) => {
    setEditingType(tpl.type);
    setEditName(tpl.name);
    setEditContent(tpl.content);
    setEditError(null);
  };

  const cancelEditTemplate = () => { setEditingType(null); setEditError(null); };

  const saveTemplate = async () => {
    if (!editingType) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/wa-templates/${editingType}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, content: editContent }),
      });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan template'));
      await loadWaTemplates();
      setEditingType(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : 'Gagal menyimpan.');
    } finally {
      setEditSaving(false);
    }
  };

  const resetTemplate = async (type: WaTemplateType) => {
    setResetLoading(type);
    try {
      const res = await fetch(`/api/wa-templates/${type}/reset`, { method: 'PUT' });
      if (!res.ok) return;
      await loadWaTemplates();
      if (editingType === type) setEditingType(null);
    } catch {
      // ignore
    } finally {
      setResetLoading(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* ── Page header ── */}
      <div>
        <h1 className="mb-1 text-3xl font-bold text-gray-800">WhatsApp Reminder</h1>
        <p className="text-sm text-gray-500">
          Generate teks pengingat dari Google Calendar dan salin ke WhatsApp.
        </p>
      </div>

      {/* ── OAuth banners ── */}
      <AnimatePresence>
        {oauthBanner === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Google Calendar berhasil dihubungkan.
            </span>
            <button onClick={clearCalendarQuery} className="text-xs font-semibold underline-offset-2 hover:underline">Tutup</button>
          </motion.div>
        )}
        {oauthBanner === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <span className="flex items-center gap-2">
              <XCircle className="h-4 w-4 shrink-0" />
              Gagal menghubungkan Google{searchParams?.get('reason') ? `: ${searchParams.get('reason')}` : ''}.
            </span>
            <button onClick={clearCalendarQuery} className="text-xs font-semibold underline-offset-2 hover:underline">Tutup</button>
          </motion.div>
        )}
      </AnimatePresence>

      {calendarError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {calendarError}
        </div>
      )}

      {/* ── Section 1: Google Calendar connection + generate ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
      >
        {/* Connection status bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${calendarConnected ? 'bg-green-50' : 'bg-gray-100'}`}>
              <MessageSquare className={`h-4 w-4 ${calendarConnected ? 'text-green-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-800">Google Calendar</p>
              {calendarStatusLoading ? (
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Loader2 className="h-3 w-3 animate-spin" /> Memeriksa…
                </p>
              ) : calendarConnected ? (
                <p className="text-xs text-green-600">
                  Terhubung{calendarEmail ? ` · ${calendarEmail}` : ''}
                </p>
              ) : (
                <p className="text-xs text-gray-400">Belum terhubung</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {calendarConnected ? (
              <>
                <button
                  disabled={disconnecting}
                  onClick={() => void handleDisconnectGoogle()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-60"
                >
                  {disconnecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />}
                  Putuskan
                </button>
                <button
                  disabled={reminderLoading}
                  onClick={() => void handleLoadTomorrowReminder()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
                >
                  {reminderLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
                  Muat Agenda Besok
                </button>
              </>
            ) : (
              <button
                disabled={connectingGoogle || calendarStatusLoading}
                onClick={() => void handleConnectGoogle()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-700 disabled:opacity-60"
              >
                {connectingGoogle || calendarStatusLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Link2 className="h-4 w-4" />
                )}
                Hubungkan Google Calendar
              </button>
            )}
          </div>
        </div>

        {/* Redirect URI hint when not connected */}
        {!calendarStatusLoading && !calendarConnected && (
          <div className="border-b border-gray-100 bg-gray-50/60 px-5 py-3">
            <p className="mb-1 text-xs text-gray-500">
              Set redirect URI ini di Google Cloud Console → OAuth credentials:
            </p>
            <code className="block break-all rounded-lg bg-white px-3 py-2 text-xs text-gray-700 shadow-sm ring-1 ring-gray-200">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/api/google/calendar/oauth/callback`
                : '/api/google/calendar/oauth/callback'}
            </code>
            <p className="mt-2 text-xs text-gray-400">
              Atau hubungkan dari{' '}
              <Link href="/settings" className="font-medium text-primary-600 underline-offset-2 hover:underline">
                Pengaturan → Integrasi Google Calendar
              </Link>
            </p>
          </div>
        )}

        {/* Collapsible calendar selector */}
        {calendarConnected && (
          <div className="border-b border-gray-100">
            <button
              onClick={() => setCalendarSectionOpen((v) => !v)}
              className="flex w-full items-center justify-between px-5 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              <span>
                Kalender sumber
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary-700">
                  {pickedCount} dipilih
                </span>
              </span>
              {calendarSectionOpen ? (
                <ChevronUp className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {calendarSectionOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-4">
                    {calendarListLoading ? (
                      <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
                        <Loader2 className="h-4 w-4 animate-spin" /> Memuat kalender…
                      </div>
                    ) : calendarRows.length === 0 ? (
                      <p className="py-4 text-sm text-gray-400">Tidak ada kalender tersedia.</p>
                    ) : (
                      <>
                        <ul className="max-h-56 space-y-1 overflow-y-auto">
                          {calendarRows.map((row) => (
                            <li key={row.id}>
                              <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
                                <input
                                  type="checkbox"
                                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary/30"
                                  checked={Boolean(pickCalendars[row.id])}
                                  onChange={() => toggleCalendarPick(row.id)}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-gray-800">
                                    {row.summary}
                                    {row.primary && (
                                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-700">
                                        Primary
                                      </span>
                                    )}
                                  </span>
                                  <span className="block truncate font-mono text-xs text-gray-400">{row.id}</span>
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => {
                              const next: Record<string, boolean> = {};
                              calendarRows.forEach((r) => { next[r.id] = r.primary; });
                              setPickCalendars(next);
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Hanya primary
                          </button>
                          <button
                            onClick={() => {
                              const next: Record<string, boolean> = {};
                              calendarRows.forEach((r) => { next[r.id] = true; });
                              setPickCalendars(next);
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
                          >
                            Pilih semua
                          </button>
                          <button
                            disabled={selectionSaving || pickedCount === 0}
                            onClick={() => void handleSaveCalendarSelection()}
                            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                          >
                            {selectionSaving ? 'Menyimpan…' : 'Simpan pilihan'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* WA text output */}
        {calendarConnected && (
          <div className="p-5">
            {!reminderMeta ? (
              <p className="text-sm text-gray-400">
                Klik <strong className="text-gray-600">Muat Agenda Besok</strong> untuk mengambil jadwal dan membuat teks WA.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-gray-800">{reminderMeta.tanggalLabel}</span>
                    {' · '}
                    <span>{reminderMeta.count} agenda</span>
                  </p>
                </div>

                {reminderWarnings.length > 0 && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-800">
                    <p className="mb-1 font-semibold">Sebagian kalender gagal dibaca:</p>
                    <ul className="list-inside list-disc space-y-0.5">
                      {reminderWarnings.map((w) => <li key={w}>{w}</li>)}
                    </ul>
                  </div>
                )}

                <textarea
                  readOnly
                  value={reminderText}
                  rows={12}
                  className="w-full resize-y rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 font-mono text-sm text-gray-800 outline-none"
                />

                <button
                  disabled={!reminderText.trim()}
                  onClick={() => void handleCopyReminder()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:px-6"
                >
                  {copyState === 'ok' ? (
                    <><Check className="h-4 w-4" /> Disalin!</>
                  ) : (
                    <><Copy className="h-4 w-4" /> Salin ke clipboard</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* ── Section 2: Template WA Reminder ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800">Template WA Reminder</h2>
          <p className="mt-1 text-sm text-gray-500">
            Sesuaikan format teks yang dihasilkan tombol WA di halaman Agenda Pimpinan. Placeholder dalam{' '}
            <code className="rounded bg-gray-100 px-1 font-mono text-xs">{'{kurung_kurawal}'}</code>{' '}
            diganti otomatis dengan data kalender.
          </p>
        </div>

        {waTemplatesLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl border border-gray-200 bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {waTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.type}
                tpl={tpl}
                editingType={editingType}
                editName={editName}
                editContent={editContent}
                editSaving={editSaving}
                editError={editError}
                resetLoading={resetLoading}
                onEdit={startEditTemplate}
                onCancel={cancelEditTemplate}
                onSave={() => void saveTemplate()}
                onReset={(type) => void resetTemplate(type)}
                onEditName={setEditName}
                onEditContent={setEditContent}
              />
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default WhatsAppReminders;
