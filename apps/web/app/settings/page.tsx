'use client';

import Link from 'next/link';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Loader2,
  Link2,
  Sparkles,
  Unplug,
  Wand2,
  Save,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
  ArrowLeft,
  KeyRound,
  ServerIcon,
  BrainCircuit,
  Building2,
  Mail,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Eye,
  EyeOff,
  Send,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AiProviderRow = {
  provider: string;
  displayName: string;
  kind: 'openai_compatible' | 'anthropic';
  baseUrl: string;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
  apiKeyPreview: string;
};

type ProviderDraft = AiProviderRow & { apiKeyInput: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function readApiErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
  try {
    const json = JSON.parse(text) as { error?: unknown; detail?: unknown };
    const msg = typeof json.error === 'string' ? json.error : '';
    const detail = typeof json.detail === 'string' ? json.detail : '';
    const base = msg || `${fallback} (HTTP ${res.status})`;
    return detail ? `${base}\n\n${detail}` : base;
  } catch {
    return `${fallback} (HTTP ${res.status}): ${text.slice(0, 200)}`;
  }
}

type SettingsTab = 'google' | 'ai' | 'prompts' | 'unit-kerja' | 'email';

function parseSettingsTab(raw: string | null): SettingsTab {
  if (raw === 'ai' || raw === 'prompts' || raw === 'google' || raw === 'unit-kerja' || raw === 'email') return raw;
  return 'google';
}

type UnitKerjaRow = {
  id: string;
  name: string;
  aliasesJson: string;
  email: string;
  description: string | null;
};

type EmailConfigRow = {
  gmailAddress: string;
  gmailAppPassword: string;
  fromName: string;
} | null;

// ---------------------------------------------------------------------------
// Reusable sub-components
// ---------------------------------------------------------------------------
const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ icon, title, description, action, children }) => (
  <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/15 text-primary-700">
          {icon}
        </div>
        <div>
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <p className="mt-0.5 text-sm text-gray-500">{description}</p>
        </div>
      </div>
      {action}
    </div>
    <div className="px-6 py-5">{children}</div>
  </section>
);

const FormInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  hint?: string;
  fullWidth?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', hint, fullWidth }) => (
  <label className={`block ${fullWidth ? 'md:col-span-2' : ''}`}>
    <span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-shadow placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
    />
    {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
  </label>
);

const SaveButton: React.FC<{
  onClick: () => void;
  loading: boolean;
  label?: string;
}> = ({ onClick, loading, label = 'Simpan' }) => (
  <button
    type="button"
    disabled={loading}
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
    {loading ? 'Menyimpan…' : label}
  </button>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<SettingsTab>(() =>
    parseSettingsTab(searchParams?.get('section') ?? null),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [gcalLoading, setGcalLoading] = useState(true);
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [gcalSelectedIds, setGcalSelectedIds] = useState<string[]>(['primary']);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);
  const [gcalError, setGcalError] = useState<string | null>(null);

  const [providers, setProviders] = useState<ProviderDraft[]>([]);
  const [docPrompt, setDocPrompt] = useState('');
  const [minutesPrompt, setMinutesPrompt] = useState('');

  // Unit Kerja state
  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerjaRow[]>([]);
  const [ukLoading, setUkLoading] = useState(false);
  const [ukShowForm, setUkShowForm] = useState(false);
  const [ukEditId, setUkEditId] = useState<string | null>(null);
  const [ukName, setUkName] = useState('');
  const [ukAliases, setUkAliases] = useState('');
  const [ukEmail, setUkEmail] = useState('');
  const [ukDesc, setUkDesc] = useState('');
  const [ukSaving, setUkSaving] = useState(false);
  const [ukDeleteId, setUkDeleteId] = useState<string | null>(null);

  // Email config state
  const [emailCfg, setEmailCfg] = useState<EmailConfigRow>(null);
  const [emailLoading, setEmailLoading] = useState(false);
  const [gmailAddress, setGmailAddress] = useState('');
  const [gmailAppPwd, setGmailAppPwd] = useState('');
  const [fromName, setFromName] = useState('Sekretariat');
  const [showPwd, setShowPwd] = useState(false);
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailVerifyResult, setEmailVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const activeProvider = useMemo(() => providers.find((p) => p.isActive)?.provider ?? '', [providers]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const [pRes, prRes] = await Promise.all([
        fetch('/api/ai/providers', { cache: 'no-store' }),
        fetch('/api/ai/prompts', { cache: 'no-store' }),
      ]);
      if (!pRes.ok) throw new Error(await readApiErrorMessage(pRes, 'Gagal memuat pengaturan provider'));
      if (!prRes.ok) throw new Error(await readApiErrorMessage(prRes, 'Gagal memuat system prompt'));

      const pJson = (await pRes.json()) as { data: AiProviderRow[] };
      const prJson = (await prRes.json()) as { data: { documentReview: string; minutesReview: string } };

      setProviders(pJson.data.map((p) => ({ ...p, apiKeyInput: p.hasApiKey ? p.apiKeyPreview : '' })));
      setDocPrompt(prJson.data.documentReview);
      setMinutesPrompt(prJson.data.minutesReview);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    setActiveTab(parseSettingsTab(searchParams?.get('section') ?? null));
  }, [searchParams]);

  // ── Unit Kerja ───────────────────────────────────────────────────────────────

  const loadUnitKerja = useCallback(async () => {
    setUkLoading(true);
    try {
      const res = await fetch('/api/unit-kerja', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat unit kerja'));
      const json = (await res.json()) as { data: UnitKerjaRow[] };
      setUnitKerjaList(json.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setUkLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'unit-kerja') void loadUnitKerja();
  }, [activeTab, loadUnitKerja]);

  const resetUkForm = () => {
    setUkName(''); setUkAliases(''); setUkEmail(''); setUkDesc('');
    setUkEditId(null); setUkShowForm(false);
  };

  const openEditUk = (row: UnitKerjaRow) => {
    setUkEditId(row.id);
    setUkName(row.name);
    setUkEmail(row.email);
    setUkDesc(row.description ?? '');
    try { setUkAliases((JSON.parse(row.aliasesJson) as string[]).join(', ')); } catch { setUkAliases(''); }
    setUkShowForm(true);
  };

  const saveUnitKerja = async () => {
    if (!ukName.trim() || !ukEmail.trim()) {
      setError('Nama dan email wajib diisi.'); return;
    }
    const aliases = ukAliases.split(',').map((s) => s.trim()).filter(Boolean);
    setUkSaving(true);
    setError(null);
    try {
      const url = ukEditId ? `/api/unit-kerja/${ukEditId}` : '/api/unit-kerja';
      const method = ukEditId ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: ukName.trim(), aliases, email: ukEmail.trim(), description: ukDesc.trim() || undefined }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan unit kerja'));
      resetUkForm();
      void loadUnitKerja();
      setMessage(ukEditId ? 'Unit kerja diperbarui.' : 'Unit kerja ditambahkan.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setUkSaving(false);
    }
  };

  const deleteUnitKerja = async (id: string) => {
    setUkDeleteId(id);
    try {
      const res = await fetch(`/api/unit-kerja/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menghapus unit kerja'));
      setUnitKerjaList((prev) => prev.filter((u) => u.id !== id));
      setMessage('Unit kerja dihapus.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setUkDeleteId(null);
    }
  };

  // ── Email Config ─────────────────────────────────────────────────────────────

  const loadEmailConfig = useCallback(async () => {
    setEmailLoading(true);
    try {
      const res = await fetch('/api/email-config', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat konfigurasi email'));
      const json = (await res.json()) as { data: EmailConfigRow };
      setEmailCfg(json.data);
      if (json.data) {
        setGmailAddress(json.data.gmailAddress);
        setFromName(json.data.fromName);
        setGmailAppPwd(''); // tidak pre-fill password — hanya tampilkan sensor
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setEmailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'email') void loadEmailConfig();
  }, [activeTab, loadEmailConfig]);

  const saveEmailConfig = async () => {
    if (!gmailAddress.trim()) { setError('Gmail address wajib diisi.'); return; }
    if (!gmailAppPwd.trim() && !emailCfg) { setError('App Password wajib diisi.'); return; }
    setEmailSaving(true);
    setError(null);
    setEmailVerifyResult(null);
    try {
      const body: Record<string, string> = { gmailAddress: gmailAddress.trim(), fromName: fromName.trim() || 'Sekretariat' };
      if (gmailAppPwd.trim()) body.gmailAppPassword = gmailAppPwd.trim();
      // Jika edit dan tidak ada password baru, kirim password lama (tidak mungkin karena disensor)
      // User HARUS input ulang password saat update
      if (!body.gmailAppPassword) {
        setError('Masukkan App Password Gmail untuk menyimpan.'); return;
      }
      const res = await fetch('/api/email-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan konfigurasi email'));
      setMessage('Konfigurasi email berhasil disimpan.');
      setGmailAppPwd('');
      void loadEmailConfig();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setEmailSaving(false);
    }
  };

  const verifyEmailConfig = async () => {
    if (!gmailAddress.trim() || !gmailAppPwd.trim()) {
      setError('Isi Gmail address dan App Password untuk verifikasi.'); return;
    }
    setEmailVerifying(true);
    setEmailVerifyResult(null);
    setError(null);
    try {
      const res = await fetch('/api/email-config/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gmailAddress: gmailAddress.trim(), gmailAppPassword: gmailAppPwd.trim(), fromName }),
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res, 'Verifikasi gagal');
        setEmailVerifyResult({ ok: false, msg });
      } else {
        const json = (await res.json()) as { data: { message: string } };
        setEmailVerifyResult({ ok: true, msg: json.data.message });
      }
    } catch (e) {
      setEmailVerifyResult({ ok: false, msg: e instanceof Error ? e.message : 'Terjadi kesalahan.' });
    } finally {
      setEmailVerifying(false);
    }
  };

  const goTab = (t: SettingsTab) => {
    setActiveTab(t);
    setError(null);
    setMessage(null);
    router.replace(`/settings?section=${t}`, { scroll: false });
  };

  const loadGoogleCalendarStatus = useCallback(async () => {
    setGcalLoading(true);
    setGcalError(null);
    try {
      const res = await fetch('/api/google/calendar/status', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat status Google Calendar'));
      const json = (await res.json()) as {
        data?: { connected?: boolean; accountEmail?: string | null; selectedCalendarIds?: string[] };
      };
      setGcalConnected(Boolean(json.data?.connected));
      setGcalEmail(json.data?.accountEmail ?? null);
      setGcalSelectedIds(
        Array.isArray(json.data?.selectedCalendarIds) && json.data.selectedCalendarIds.length > 0
          ? json.data.selectedCalendarIds
          : ['primary'],
      );
    } catch (e) {
      setGcalError(e instanceof Error ? e.message : 'Gagal memuat integrasi Google Calendar.');
      setGcalConnected(false);
    } finally {
      setGcalLoading(false);
    }
  }, []);

  useEffect(() => { void loadGoogleCalendarStatus(); }, [loadGoogleCalendarStatus]);

  const connectGoogleCalendar = async () => {
    setGcalConnecting(true);
    setGcalError(null);
    try {
      const res = await fetch('/api/google/calendar/auth-url', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memulai OAuth Google'));
      const json = (await res.json()) as { data?: { url?: string }; error?: string };
      if (!json.data?.url) throw new Error(json.error || 'URL OAuth tidak tersedia.');
      window.location.href = json.data.url;
    } catch (e) {
      setGcalError(e instanceof Error ? e.message : 'Gagal menghubungkan Google.');
      setGcalConnecting(false);
    }
  };

  const disconnectGoogleCalendar = async () => {
    setGcalDisconnecting(true);
    setGcalError(null);
    try {
      const res = await fetch('/api/google/calendar/connection', { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memutuskan koneksi'));
      await loadGoogleCalendarStatus();
    } catch (e) {
      setGcalError(e instanceof Error ? e.message : 'Gagal memutuskan koneksi.');
    } finally {
      setGcalDisconnecting(false);
    }
  };

  const saveProvider = async (provider: string) => {
    const row = providers.find((p) => p.provider === provider);
    if (!row) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ai/providers/${provider}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: row.displayName,
          kind: row.kind,
          apiKey: row.apiKeyInput,
          baseUrl: row.baseUrl,
          model: row.model,
        }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan provider'));
      setMessage(`Pengaturan ${row.displayName} disimpan.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const activateProvider = async (provider: string) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/ai/providers/${provider}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal mengaktifkan provider'));
      const found = providers.find((p) => p.provider === provider);
      setMessage(`Provider aktif: ${found?.displayName ?? provider}`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const savePrompts = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/ai/prompts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentReview: docPrompt, minutesReview: minutesPrompt }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan system prompt'));
      setMessage('System prompt disimpan.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  };

  const tabDefs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'google', label: 'Google Calendar', icon: <Calendar className="h-4 w-4" /> },
    { id: 'ai', label: 'Provider AI', icon: <Sparkles className="h-4 w-4" /> },
    { id: 'prompts', label: 'System Prompt', icon: <Wand2 className="h-4 w-4" /> },
    { id: 'unit-kerja', label: 'Unit Kerja', icon: <Building2 className="h-4 w-4" /> },
    { id: 'email', label: 'Email', icon: <Mail className="h-4 w-4" /> },
  ];

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">

      {/* ── Header ── */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Pengaturan</h1>
          <p className="mt-1 text-sm text-gray-500">
            Integrasi kalender, kunci API model AI, dan system prompt review.
          </p>
        </div>
        <Link
          href="/app"
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Kembali
        </Link>
      </div>

      {/* ── Tab bar ── */}
      <div className="mb-6 rounded-2xl bg-gray-100/80 p-1.5">
        <div className="flex gap-1">
          {tabDefs.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => goTab(id)}
              className={`relative flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === id
                  ? 'bg-white text-gray-900 shadow-sm font-semibold'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {icon}
              <span className="hidden sm:inline">{label}</span>
              <span className="sm:hidden">{label.split(' ')[0]}</span>
              {activeTab === id && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute inset-0 rounded-xl bg-white shadow-sm -z-10"
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Banners ── */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 flex items-start gap-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
        {message && (
          <motion.div
            key="message"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {message}
          </motion.div>
        )}
        {gcalError && (
          <motion.div
            key="gcalError"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="mb-5 flex items-start gap-3 whitespace-pre-wrap rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{gcalError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Tab content ── */}
      <AnimatePresence mode="wait">
        {/* ─ Google Calendar ─ */}
        {activeTab === 'google' && (
          <motion.div
            key="google"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <SectionCard
              icon={<Calendar className="h-5 w-5" />}
              title="Integrasi Google Calendar"
              description="Hubungkan akun Google untuk membaca agenda pimpinan secara otomatis."
              action={
                gcalConnected ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={gcalDisconnecting}
                      onClick={() => void disconnectGoogleCalendar()}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-60"
                    >
                      {gcalDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                      Putuskan
                    </button>
                    <Link
                      href="/app?tab=reminders"
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md"
                    >
                      Buka WA Reminder
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={gcalConnecting || gcalLoading}
                    onClick={() => void connectGoogleCalendar()}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md disabled:opacity-60"
                  >
                    {gcalConnecting || gcalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Hubungkan Google Calendar
                  </button>
                )
              }
            >
              {gcalLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Memeriksa koneksi…
                </div>
              ) : gcalConnected ? (
                <div className="space-y-3">
                  {/* Status row */}
                  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-green-100 bg-green-50 px-4 py-3">
                    <span className="flex h-2 w-2 rounded-full bg-green-500" />
                    <div>
                      <p className="text-sm font-semibold text-green-800">Terhubung</p>
                      {gcalEmail && <p className="text-xs text-green-700">{gcalEmail}</p>}
                    </div>
                    <div className="ml-auto rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                      {gcalSelectedIds.length} kalender dipilih
                    </div>
                  </div>
                  <p className="text-sm text-gray-500">
                    Untuk mengatur kalender sumber atau mengubah pilihan, buka menu{' '}
                    <Link href="/app?tab=reminders" className="font-medium text-primary-600 underline-offset-2 hover:underline">
                      WhatsApp Reminder
                    </Link>
                    .
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <span className="flex h-2 w-2 rounded-full bg-gray-300" />
                    <p className="text-sm text-gray-500">Belum terhubung ke Google Calendar.</p>
                  </div>
                  <div>
                    <p className="mb-1.5 text-xs font-semibold text-gray-600">
                      Redirect URI (tambahkan di Google Cloud Console → OAuth credentials):
                    </p>
                    <code className="block break-all rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-700">
                      {typeof window !== 'undefined'
                        ? `${window.location.origin}/api/google/calendar/oauth/callback`
                        : '/api/google/calendar/oauth/callback'}
                    </code>
                  </div>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* ─ Provider AI ─ */}
        {activeTab === 'ai' && (
          <motion.div
            key="ai"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <SectionCard
              icon={<Sparkles className="h-5 w-5" />}
              title="Provider AI"
              description="Pilih provider aktif dan atur API key. DeepSeek & GPT: OpenAI-compatible. Claude: Anthropic."
              action={
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading || saving}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 shadow-sm transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Muat ulang</span>
                </button>
              }
            >
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-48 animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <p className="text-sm text-gray-400">Tidak ada provider tersedia.</p>
              ) : (
                <div className="space-y-4">
                  {providers.map((p) => {
                    const isActive = activeProvider === p.provider;
                    return (
                      <div
                        key={p.provider}
                        className={`overflow-hidden rounded-2xl border transition-colors ${
                          isActive ? 'border-primary-200 bg-primary/[0.02]' : 'border-gray-200 bg-white'
                        }`}
                      >
                        {/* Provider header */}
                        <div className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${isActive ? 'border-b border-primary-100' : 'border-b border-gray-100'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-primary/10 text-primary-700' : 'bg-gray-100 text-gray-500'}`}>
                              <BrainCircuit className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">{p.displayName}</p>
                              <p className="flex items-center gap-2 text-xs text-gray-400">
                                <span className="font-mono">{p.provider}</span>
                                {p.hasApiKey ? (
                                  <span className="flex items-center gap-1 text-green-600">
                                    <KeyRound className="h-3 w-3" /> {p.apiKeyPreview}
                                  </span>
                                ) : (
                                  <span className="text-orange-500">API key belum diset</span>
                                )}
                              </p>
                            </div>
                          </div>

                          {isActive ? (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary-700">
                              <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                              Aktif
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void activateProvider(p.provider)}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-primary-200 hover:bg-primary/5 hover:text-primary-700 disabled:opacity-50"
                            >
                              <Zap className="h-3 w-3" />
                              Jadikan aktif
                            </button>
                          )}
                        </div>

                        {/* Provider form */}
                        <div className="px-5 py-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormInput
                              label="Nama tampilan"
                              value={p.displayName}
                              onChange={(v) =>
                                setProviders((prev) =>
                                  prev.map((x) => (x.provider === p.provider ? { ...x, displayName: v } : x)),
                                )
                              }
                            />

                            <label className="block">
                              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Transport</span>
                              <select
                                className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                                value={p.kind}
                                onChange={(e) =>
                                  setProviders((prev) =>
                                    prev.map((x) =>
                                      x.provider === p.provider
                                        ? { ...x, kind: e.target.value as ProviderDraft['kind'] }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <option value="openai_compatible">OpenAI-compatible (DeepSeek / GPT)</option>
                                <option value="anthropic">Anthropic (Claude)</option>
                              </select>
                            </label>

                            <FormInput
                              label="Base URL"
                              value={p.baseUrl}
                              fullWidth
                              onChange={(v) =>
                                setProviders((prev) =>
                                  prev.map((x) => (x.provider === p.provider ? { ...x, baseUrl: v } : x)),
                                )
                              }
                            />

                            <FormInput
                              label="Model"
                              value={p.model}
                              onChange={(v) =>
                                setProviders((prev) =>
                                  prev.map((x) => (x.provider === p.provider ? { ...x, model: v } : x)),
                                )
                              }
                            />

                            <FormInput
                              label="API Key"
                              value={p.apiKeyInput}
                              placeholder={p.hasApiKey ? 'Kosongkan untuk mempertahankan key lama' : 'Tempel API key di sini'}
                              onChange={(v) =>
                                setProviders((prev) =>
                                  prev.map((x) => (x.provider === p.provider ? { ...x, apiKeyInput: v } : x)),
                                )
                              }
                            />
                          </div>

                          <div className="mt-4 flex justify-end">
                            <SaveButton
                              onClick={() => void saveProvider(p.provider)}
                              loading={saving}
                              label="Simpan provider"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* ─ System Prompt ─ */}
        {activeTab === 'prompts' && (
          <motion.div
            key="prompts"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <SectionCard
              icon={<Wand2 className="h-5 w-5" />}
              title="System Prompt"
              description="Prompt digunakan server-side untuk proses review AI. API key disimpan terenkripsi di database."
            >
              {loading ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <ServerIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Review Dokumen (typo + ambigu)</span>
                    </div>
                    <textarea
                      value={docPrompt}
                      onChange={(e) => setDocPrompt(e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <ServerIcon className="h-4 w-4 text-gray-400" />
                      <span className="text-sm font-semibold text-gray-700">Review Notula (typo + ambigu + CTA)</span>
                    </div>
                    <textarea
                      value={minutesPrompt}
                      onChange={(e) => setMinutesPrompt(e.target.value)}
                      rows={8}
                      className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="flex justify-end border-t border-gray-100 pt-4">
                    <SaveButton
                      onClick={() => void savePrompts()}
                      loading={saving}
                      label="Simpan prompt"
                    />
                  </div>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* ─ Unit Kerja ─ */}
        {activeTab === 'unit-kerja' && (
          <motion.div
            key="unit-kerja"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <SectionCard
              icon={<Building2 className="h-5 w-5" />}
              title="Direktori Unit Kerja"
              description="Kelola daftar unit kerja beserta alias/singkatan dan alamat email. Dipakai untuk matching CTA dan distribusi notula."
              action={
                <button
                  type="button"
                  onClick={() => { resetUkForm(); setUkShowForm(true); }}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:shadow-md"
                >
                  <Plus className="h-4 w-4" /> Tambah Unit Kerja
                </button>
              }
            >
              {/* Form tambah/edit */}
              {ukShowForm && (
                <div className="mb-6 rounded-2xl border border-primary/20 bg-primary/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-800">{ukEditId ? 'Edit Unit Kerja' : 'Tambah Unit Kerja Baru'}</h3>
                    <button onClick={resetUkForm} className="rounded-lg p-1 hover:bg-gray-100"><X className="h-4 w-4 text-gray-500" /></button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <FormInput label="Nama Lengkap *" value={ukName} onChange={setUkName} placeholder="Direktorat Sumber Daya Manusia" />
                    <FormInput label="Email Resmi *" value={ukEmail} onChange={setUkEmail} placeholder="dsdm@instansi.go.id" type="email" />
                    <FormInput
                      label="Alias / Singkatan"
                      value={ukAliases}
                      onChange={setUkAliases}
                      placeholder="DSDM, DitSDM, Direktorat SDM"
                      hint="Pisahkan dengan koma"
                      fullWidth
                    />
                    <FormInput label="Deskripsi (opsional)" value={ukDesc} onChange={setUkDesc} placeholder="Keterangan singkat" fullWidth />
                  </div>
                  <div className="mt-4 flex justify-end gap-3">
                    <button type="button" onClick={resetUkForm} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">Batal</button>
                    <SaveButton onClick={() => void saveUnitKerja()} loading={ukSaving} label={ukEditId ? 'Perbarui' : 'Simpan'} />
                  </div>
                </div>
              )}

              {/* List */}
              {ukLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
                </div>
              ) : unitKerjaList.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-200 py-12 text-center">
                  <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-500">Belum ada unit kerja. Klik &quot;Tambah Unit Kerja&quot; untuk memulai.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unitKerjaList.map((uk) => {
                    let aliases: string[] = [];
                    try { aliases = JSON.parse(uk.aliasesJson) as string[]; } catch { /* ignore */ }
                    return (
                      <div key={uk.id} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 transition-colors hover:bg-gray-100">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-sm text-gray-800">{uk.name}</p>
                          <p className="text-xs text-primary-600 truncate">{uk.email}</p>
                          {aliases.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {aliases.map((a) => (
                                <span key={a} className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">{a}</span>
                              ))}
                            </div>
                          )}
                          {uk.description && <p className="mt-1 text-xs text-gray-400">{uk.description}</p>}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button onClick={() => openEditUk(uk)} className="rounded-lg p-2 hover:bg-white"><Pencil className="h-3.5 w-3.5 text-gray-500" /></button>
                          <button
                            onClick={() => void deleteUnitKerja(uk.id)}
                            disabled={ukDeleteId === uk.id}
                            className="rounded-lg p-2 hover:bg-red-50 disabled:opacity-40"
                          >
                            {ukDeleteId === uk.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-red-400" /> : <Trash2 className="h-3.5 w-3.5 text-red-400" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {/* ─ Konfigurasi Email ─ */}
        {activeTab === 'email' && (
          <motion.div
            key="email"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            <SectionCard
              icon={<Mail className="h-5 w-5" />}
              title="Konfigurasi Email Gmail"
              description="Atur akun Gmail sekretaris untuk mengirim notula ke unit kerja. Gunakan Gmail App Password, bukan password akun utama."
            >
              {emailLoading ? (
                <div className="space-y-3">
                  {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />)}
                </div>
              ) : (
                <div className="space-y-5">
                  {emailCfg && (
                    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-3">
                      <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Email terkonfigurasi</p>
                        <p className="text-xs text-green-600">{emailCfg.gmailAddress} · {emailCfg.fromName}</p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800 mb-1">Cara mendapatkan Gmail App Password:</p>
                    <ol className="text-xs text-amber-700 space-y-0.5 list-decimal list-inside">
                      <li>Aktifkan 2-Step Verification di akun Google sekretaris</li>
                      <li>Buka <strong>myaccount.google.com/apppasswords</strong></li>
                      <li>Pilih &quot;Mail&quot; lalu klik &quot;Generate&quot;</li>
                      <li>Salin 16-digit kode yang muncul ke field App Password di bawah</li>
                    </ol>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <FormInput
                      label="Gmail Address Sekretaris *"
                      value={gmailAddress}
                      onChange={setGmailAddress}
                      placeholder="sekretaris@gmail.com"
                      type="email"
                    />
                    <FormInput
                      label="Nama Pengirim"
                      value={fromName}
                      onChange={setFromName}
                      placeholder="Sekretariat Rapim"
                    />
                    <label className="block md:col-span-2">
                      <span className="mb-1.5 block text-xs font-semibold text-gray-600">Gmail App Password *</span>
                      <div className="relative">
                        <input
                          type={showPwd ? 'text' : 'password'}
                          value={gmailAppPwd}
                          onChange={(e) => setGmailAppPwd(e.target.value)}
                          placeholder={emailCfg ? 'Kosongkan jika tidak ingin ubah password' : 'xxxx xxxx xxxx xxxx'}
                          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 pr-10 text-sm text-gray-800 outline-none transition-shadow placeholder:text-gray-400 focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPwd((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      {emailCfg && <p className="mt-1 text-xs text-gray-400">Isi hanya jika ingin mengganti App Password. Kosongkan jika tidak berubah.</p>}
                    </label>
                  </div>

                  {emailVerifyResult && (
                    <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${emailVerifyResult.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
                      {emailVerifyResult.ok ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {emailVerifyResult.msg}
                    </div>
                  )}

                  <div className="flex flex-wrap justify-end gap-3 border-t border-gray-100 pt-4">
                    <button
                      type="button"
                      onClick={() => void verifyEmailConfig()}
                      disabled={emailVerifying || !gmailAddress || !gmailAppPwd}
                      className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {emailVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      Test Koneksi
                    </button>
                    <SaveButton onClick={() => void saveEmailConfig()} loading={emailSaving} label="Simpan Konfigurasi" />
                  </div>
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Footer note ── */}
      <p className="mt-8 text-center text-xs text-gray-400">
        API key disimpan di server (Postgres) dan tidak ditampilkan utuh di UI.
      </p>
    </div>
  );
}
