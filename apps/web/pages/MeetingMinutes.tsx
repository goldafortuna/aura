import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ClipboardList,
  Upload,
  Send,
  CheckCircle,
  Clock,
  Users,
  Mail,
  Eye,
  X,
  Loader2,
  AlertTriangle,
  Check,
  Minus,
  RefreshCw,
  FileText,
  Download,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingMinute {
  id: string;
  title: string;
  meetingDate: string;
  participantsCount: number;
  participantsEmails?: unknown | null;
  ctaCount: number;
  status: string;
  typoCount: number;
  ambiguousCount: number;
  findingsJson?: unknown | null;
  approvedFindingsJson?: unknown | null;
  correctedStoragePath?: string | null;
  correctedFilename?: string | null;
  correctedAt?: string | null;
  ctasJson?: unknown | null;
  analysisError?: string | null;
  distributedAt?: string | null;
}

type MinutesFinding = {
  kind: 'typo' | 'ambiguous';
  severity?: 'low' | 'medium' | 'high';
  locationHint: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
};

type CtaItemRow = {
  id: string;
  meetingMinuteId: string;
  title: string;
  action: string;
  picName: string | null;
  unit: string | null;
  deadline: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
};

type UnitKerjaRow = {
  id: string;
  name: string;
  aliasesJson: string;
  email: string;
};

type StorageProvider = 'local' | 'cloudflare-r2';

type StorageInfo = {
  provider: StorageProvider;
  bucket?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
  try {
    const json = JSON.parse(text) as { error?: unknown };
    const msg = typeof json.error === 'string' ? json.error : '';
    return msg || `${fallback} (HTTP ${res.status})`;
  } catch {
    if (contentType.includes('text/html') || /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text)) {
      return `${fallback} (HTTP ${res.status}). Endpoint API tidak ditemukan atau server mengembalikan halaman HTML.`;
    }
    return `${fallback} (HTTP ${res.status}): ${text.slice(0, 200)}`;
  }
}

function parseEmails(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is string => typeof x === 'string');
  if (typeof raw === 'string') {
    try {
      const arr = JSON.parse(raw) as unknown;
      if (Array.isArray(arr)) return arr.filter((x): x is string => typeof x === 'string');
    } catch { /* ignore */ }
  }
  return [];
}

function parseFindings(json: unknown): MinutesFinding[] {
  if (!json) return [];
  if (Array.isArray(json)) return json as MinutesFinding[];
  if (typeof json === 'string') {
    try {
      const v = JSON.parse(json) as unknown;
      if (Array.isArray(v)) return v as MinutesFinding[];
    } catch { /* ignore */ }
  }
  return [];
}

function parseApprovedIndices(json: unknown): number[] {
  if (!json) return [];
  if (Array.isArray(json)) return json.filter((x): x is number => typeof x === 'number');
  if (typeof json === 'string') {
    try {
      const v = JSON.parse(json) as unknown;
      if (Array.isArray(v)) return v.filter((x): x is number => typeof x === 'number');
    } catch { /* ignore */ }
  }
  return [];
}

function statusLabel(status: string) {
  switch (status) {
    case 'distributed': return 'Terdistribusi';
    case 'approved': return 'Disetujui';
    case 'reviewed': return 'Direview';
    case 'processing': return 'Diproses';
    case 'error': return 'Error';
    default: return 'Draft';
  }
}

function statusBadgeClass(status: string) {
  switch (status) {
    case 'distributed': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
    case 'approved': return 'bg-blue-50 text-blue-700 border border-blue-200';
    case 'reviewed': return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'processing': return 'bg-violet-50 text-violet-700 border border-violet-200 animate-pulse';
    case 'error': return 'bg-red-50 text-red-700 border border-red-200';
    default: return 'bg-slate-100 text-slate-600 border border-slate-200';
  }
}

const statusBorderMap: Record<string, string> = {
  distributed: 'border-l-emerald-400',
  approved: 'border-l-blue-400',
  reviewed: 'border-l-amber-400',
  processing: 'border-l-violet-400',
  error: 'border-l-red-400',
  uploaded: 'border-l-slate-300',
};

function storageProviderLabel(provider: StorageProvider) {
  if (provider === 'local') return 'Storage Lokal';
  return 'Cloudflare R2';
}

function storageProviderBadgeClass(provider: StorageProvider) {
  if (provider === 'local') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

// ─── Pagination helpers ────────────────────────────────────────────────────────

function buildPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  pages.push(1);
  if (current > 3) pages.push('...');
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

interface PaginationBtnProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  ariaLabel?: string;
}

const PaginationBtn: React.FC<PaginationBtnProps> = ({ onClick, disabled, active, children, ariaLabel }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    aria-label={ariaLabel}
    className={`flex h-8 min-w-[2rem] items-center justify-center rounded-lg px-1.5 text-xs font-semibold transition-colors ${
      active
        ? 'bg-primary-600 text-white shadow-sm'
        : disabled
        ? 'cursor-not-allowed text-slate-300'
        : 'text-slate-600 hover:bg-primary/10 hover:text-primary-700'
    }`}
  >
    {children}
  </button>
);

// ─── Upload drop zone ──────────────────────────────────────────────────────────

const ACCEPT_MIME = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
}

const UploadZone: React.FC<UploadZoneProps> = ({ onFiles, disabled }) => {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => ACCEPT_MIME.includes(f.type) || f.name.endsWith('.pdf') || f.name.endsWith('.docx'),
    );
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-all duration-200 ${
        dragging
          ? 'scale-[1.01] border-primary-400 bg-primary/5'
          : 'border-slate-200 bg-gradient-to-b from-slate-50/80 to-white hover:border-primary-300 hover:bg-primary/5'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 shadow-sm">
        <Upload className={`h-6 w-6 transition-colors ${dragging ? 'text-primary-700' : 'text-primary-500'}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-700">
          {dragging ? 'Lepaskan file di sini' : 'Seret & lepas file notula di sini'}
        </p>
        <p className="mt-0.5 text-xs text-slate-400">atau klik untuk memilih file · PDF / DOCX · maks 10 MB</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
    </div>
  );
};

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTULA_PER_PAGE = 8;
const CTA_SIDEBAR_PER_PAGE = 6;

// ─── Main component ───────────────────────────────────────────────────────────

export const MeetingMinutes: React.FC = () => {
  const [minutes, setMinutes] = useState<MeetingMinute[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [toast, setToast] = useState<{ msg: string; kind: 'ok' | 'err' } | null>(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDate, setUploadDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const [reviewMinute, setReviewMinute] = useState<MeetingMinute | null>(null);
  const [reviewCtas, setReviewCtas] = useState<CtaItemRow[]>([]);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [ctaSavingIds, setCtaSavingIds] = useState<Set<string>>(new Set());
  const [approvedSet, setApprovedSet] = useState<Set<number>>(new Set());
  const [approvingSave, setApprovingSave] = useState(false);
  const [downloadingCorrected, setDownloadingCorrected] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'findings' | 'ctas'>('findings');

  const [distributeMinute, setDistributeMinute] = useState<MeetingMinute | null>(null);
  const [distributeEmails, setDistributeEmails] = useState('');
  const [distributeSubject, setDistributeSubject] = useState('');
  const [distributeMessage, setDistributeMessage] = useState('');
  const [distributing, setDistributing] = useState(false);
  const [distributeResult, setDistributeResult] = useState<{ sent: number; errors?: string[] } | null>(null);

  const [unitKerjaList, setUnitKerjaList] = useState<UnitKerjaRow[]>([]);
  const [selectedUkIds, setSelectedUkIds] = useState<Set<string>>(new Set());
  const [ukLoaded, setUkLoaded] = useState(false);

  // Pagination state
  const [notulaPage, setNotulaPage] = useState(1);
  const [ctaSidebarPage, setCtaSidebarPage] = useState(1);

  // ── Data loading ────────────────────────────────────────────────────────────

  const load = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      const res = await fetch('/api/meeting-minutes', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat notula'));
      const json = (await res.json()) as { data: MeetingMinute[] };
      setMinutes(json.data ?? []);
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let cancelled = false;
    const loadStorageInfo = async () => {
      try {
        const res = await fetch('/api/storage/provider', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: StorageInfo };
        if (!cancelled && json.data) setStorageInfo(json.data);
      } catch { /* keep hidden */ }
    };
    void loadStorageInfo();
    return () => { cancelled = true; };
  }, []);

  const hasProcessing = useMemo(() => minutes.some((m) => m.status === 'processing'), [minutes]);
  useEffect(() => {
    if (!hasProcessing) return;
    const id = window.setInterval(() => void load(true), 8000);
    return () => window.clearInterval(id);
  }, [hasProcessing, load]);

  // ── Pagination derived state ────────────────────────────────────────────────

  useEffect(() => { setNotulaPage(1); }, [minutes.length]);

  const minutesWithCta = useMemo(() => minutes.filter((m) => m.ctaCount > 0), [minutes]);
  useEffect(() => { setCtaSidebarPage(1); }, [minutesWithCta.length]);

  const notulaTotalPages = Math.ceil(minutes.length / NOTULA_PER_PAGE);
  const paginatedMinutes = useMemo(
    () => minutes.slice((notulaPage - 1) * NOTULA_PER_PAGE, notulaPage * NOTULA_PER_PAGE),
    [minutes, notulaPage],
  );

  const ctaTotalPages = Math.ceil(minutesWithCta.length / CTA_SIDEBAR_PER_PAGE);
  const paginatedCtaMinutes = useMemo(
    () => minutesWithCta.slice((ctaSidebarPage - 1) * CTA_SIDEBAR_PER_PAGE, ctaSidebarPage * CTA_SIDEBAR_PER_PAGE),
    [minutesWithCta, ctaSidebarPage],
  );

  // ── Toast helper ────────────────────────────────────────────────────────────

  const showToast = (msg: string, kind: 'ok' | 'err' = 'ok') => {
    setToast({ msg, kind });
    window.setTimeout(() => setToast(null), 3500);
  };

  // ── Background analyze ──────────────────────────────────────────────────────

  const analyzeInBackground = useCallback((id: string) => {
    void (async () => {
      try {
        setMinutes((prev) =>
          prev.map((m) => m.id === id ? { ...m, status: 'processing', analysisError: null } : m),
        );
        const res = await fetch(`/api/meeting-minutes/${id}/analyze`, { method: 'POST' });
        if (!res.ok) {
          const msg = await readApiErrorMessage(res, 'Gagal analisis AI');
          setMinutes((prev) => prev.map((m) => m.id === id ? { ...m, status: 'error', analysisError: msg } : m));
          showToast(msg, 'err');
          return;
        }
        const json = (await res.json()) as { data: MeetingMinute };
        setMinutes((prev) => prev.map((m) => m.id === id ? json.data : m));
        showToast('Review AI selesai — temuan & tindak lanjut siap ditinjau.', 'ok');
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Terjadi kesalahan.';
        setMinutes((prev) => prev.map((m) => m.id === id ? { ...m, status: 'error', analysisError: msg } : m));
        showToast(msg, 'err');
      }
    })();
  }, []);

  // ── Upload ──────────────────────────────────────────────────────────────────

  const handleFiles = (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { setError('File terlalu besar. Maks 10 MB.'); return; }
    setPendingFile(f);
    if (!uploadTitle.trim()) setUploadTitle(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
    setShowUploadForm(true);
  };

  const submitUpload = async () => {
    if (!pendingFile) { setError('Pilih file notula (PDF/DOCX).'); return; }
    if (!uploadTitle.trim()) { setError('Judul notula wajib diisi.'); return; }
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('files', pendingFile);
      const upRes = await fetch('/api/uploads/meeting-minutes', { method: 'POST', body: fd });
      if (!upRes.ok) throw new Error(await readApiErrorMessage(upRes, 'Gagal upload notula'));
      const upJson = (await upRes.json()) as {
        data: { filename: string; fileType: string; fileSize: number; storagePath: string };
      };
      const createRes = await fetch('/api/meeting-minutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: uploadTitle.trim(), meetingDate: uploadDate,
          filename: upJson.data.filename, fileType: upJson.data.fileType,
          fileSize: upJson.data.fileSize, storagePath: upJson.data.storagePath,
        }),
      });
      if (!createRes.ok) throw new Error(await readApiErrorMessage(createRes, 'Gagal membuat data notula'));
      const created = (await createRes.json()) as { data: MeetingMinute };
      setShowUploadForm(false);
      setPendingFile(null);
      setUploadTitle('');
      setMinutes((prev) => [created.data, ...prev]);
      showToast('Notula berhasil diupload. Review AI dimulai di background...', 'ok');
      analyzeInBackground(created.data.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setUploading(false);
    }
  };

  // ── Review modal ────────────────────────────────────────────────────────────

  const openReview = async (minute: MeetingMinute) => {
    setReviewMinute(minute);
    setActiveTab('findings');
    const savedIndices = parseApprovedIndices(minute.approvedFindingsJson);
    setApprovedSet(new Set(savedIndices));
    setCtaLoading(true);
    try {
      const res = await fetch(`/api/meeting-minutes/${minute.id}/ctas`, { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat tindak lanjut'));
      const json = (await res.json()) as { data: CtaItemRow[] };
      setReviewCtas(json.data ?? []);
    } catch {
      setReviewCtas([]);
    } finally {
      setCtaLoading(false);
    }
  };

  const closeReview = () => { setReviewMinute(null); setReviewCtas([]); setApprovedSet(new Set()); };

  const findings = useMemo(() => parseFindings(reviewMinute?.findingsJson), [reviewMinute]);

  const toggleApproval = (idx: number) => {
    setApprovedSet((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectAllFindings = () => setApprovedSet(new Set(findings.map((_, i) => i)));
  const clearAllFindings = () => setApprovedSet(new Set());

  const saveApprovedFindings = async () => {
    if (!reviewMinute) return;
    setApprovingSave(true);
    try {
      const res = await fetch(`/api/meeting-minutes/${reviewMinute.id}/approve-findings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedIndices: Array.from(approvedSet) }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan persetujuan'));
      const json = (await res.json()) as { data: MeetingMinute };
      setMinutes((prev) => prev.map((m) => m.id === json.data.id ? json.data : m));
      setReviewMinute(json.data);
      if (!json.data.correctedStoragePath && approvedSet.size > 0) {
        showToast('Persetujuan tersimpan, tetapi file .docx terkoreksi belum berhasil dibuat.', 'err');
        return;
      }
      const hasCorrected = !!json.data.correctedStoragePath;
      showToast(
        hasCorrected
          ? `${approvedSet.size} temuan disetujui. Dokumen terkoreksi siap diunduh.`
          : `${approvedSet.size} temuan disetujui dan disimpan.`,
        'ok',
      );
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'err');
    } finally {
      setApprovingSave(false);
    }
  };

  const downloadCorrected = async (minute: MeetingMinute) => {
    setDownloadingCorrected(minute.id);
    try {
      const res = await fetch(`/api/meeting-minutes/${minute.id}/download-corrected`);
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal mengunduh dokumen terkoreksi'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = minute.correctedFilename || 'notula_terkoreksi.docx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'err');
    } finally {
      setDownloadingCorrected(null);
    }
  };

  const updateCta = async (ctaId: string, patch: Partial<Pick<CtaItemRow, 'status'>>) => {
    setReviewCtas((prev) => prev.map((c) => c.id === ctaId ? { ...c, ...patch } as CtaItemRow : c));
    setCtaSavingIds((prev) => new Set(prev).add(ctaId));
    try {
      const res = await fetch(`/api/ctas/${ctaId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const msg = await readApiErrorMessage(res, 'Gagal memperbarui tindak lanjut');
        showToast(msg, 'err');
        if (reviewMinute) {
          const r2 = await fetch(`/api/meeting-minutes/${reviewMinute.id}/ctas`, { cache: 'no-store' });
          if (r2.ok) { const j = (await r2.json()) as { data: CtaItemRow[] }; setReviewCtas(j.data ?? []); }
        }
      }
    } catch {
      showToast('Gagal memperbarui tindak lanjut.', 'err');
    } finally {
      setCtaSavingIds((prev) => { const next = new Set(prev); next.delete(ctaId); return next; });
    }
  };

  // ── Distribute modal ────────────────────────────────────────────────────────

  const openDistribute = async (minute: MeetingMinute) => {
    setDistributeMinute(minute);
    setDistributeResult(null);
    setSelectedUkIds(new Set());
    const saved = parseEmails(minute.participantsEmails);
    setDistributeEmails(saved.join(', '));
    setDistributeSubject(`Notula Rapat: ${minute.title} — ${minute.meetingDate}`);
    setDistributeMessage('');
    if (!ukLoaded) {
      try {
        const res = await fetch('/api/unit-kerja', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { data: UnitKerjaRow[] };
          setUnitKerjaList(json.data ?? []);
          setUkLoaded(true);
        }
      } catch { /* ignore */ }
    }
  };

  const toggleUk = (id: string) => {
    setSelectedUkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const submitDistribute = async () => {
    if (!distributeMinute) return;
    const recipients: { email: string; unitKerjaId?: string; unitName?: string }[] = [];
    for (const ukId of selectedUkIds) {
      const uk = unitKerjaList.find((u) => u.id === ukId);
      if (uk) recipients.push({ email: uk.email, unitKerjaId: uk.id, unitName: uk.name });
    }
    const ukEmails = new Set(unitKerjaList.filter((u) => selectedUkIds.has(u.id)).map((u) => u.email));
    const manualEmails = distributeEmails
      .split(/[,;\n]/).map((e) => e.trim())
      .filter((e) => e.includes('@') && !ukEmails.has(e));
    for (const email of manualEmails) recipients.push({ email });
    if (recipients.length === 0) { showToast('Pilih unit kerja atau masukkan email penerima.', 'err'); return; }
    setDistributing(true);
    setDistributeResult(null);
    try {
      const res = await fetch(`/api/meeting-minutes/${distributeMinute.id}/distribute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject: distributeSubject, message: distributeMessage }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal distribusi'));
      const json = (await res.json()) as { data: MeetingMinute; meta: { sent: number; errors?: string[]; emailConfigured: boolean } };
      setMinutes((prev) => prev.map((m) => m.id === json.data.id ? json.data : m));
      if (!json.meta.emailConfigured) {
        setDistributeResult({ sent: 0, errors: ['Konfigurasi email Gmail belum diatur. Buka Pengaturan → Email untuk mengaturnya.'] });
      } else {
        setDistributeResult({ sent: json.meta.sent, errors: json.meta.errors });
        if (!json.meta.errors?.length) {
          showToast(`Notula berhasil dikirim ke ${json.meta.sent} penerima.`, 'ok');
          setDistributeMinute(null);
        }
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Terjadi kesalahan.', 'err');
    } finally {
      setDistributing(false);
    }
  };

  // ── Stats ────────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: minutes.length,
    pendingCta: minutes.reduce((a, m) => a + (m.ctaCount ?? 0), 0),
    reviewed: minutes.filter((m) => ['reviewed', 'approved', 'distributed'].includes(m.status)).length,
    distributed: minutes.filter((m) => m.status === 'distributed').length,
  }), [minutes]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -16, x: 16 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -16, x: 16 }}
            className={`fixed right-5 top-5 z-[100] flex max-w-sm items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-xl ring-1 ring-black/10 ${
              toast.kind === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {toast.kind === 'ok'
              ? <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
              : <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            }
            <span>{toast.msg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
              <ClipboardList className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Manajemen Notula Rapat</h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Upload notula, review AI, setujui perubahan, distribusi ke unit kerja.
          </p>
          {storageInfo ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Storage</span>
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${storageProviderBadgeClass(storageInfo.provider)}`}>
                {storageProviderLabel(storageInfo.provider)}
              </span>
              {storageInfo.bucket ? (
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-500">
                  Bucket: {storageInfo.bucket}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          { icon: ClipboardList, value: stats.total, label: 'Total Notula', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
          { icon: Clock, value: stats.pendingCta, label: 'Total Tindak Lanjut', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
          { icon: CheckCircle, value: stats.reviewed, label: 'Sudah Direview', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
          { icon: Mail, value: stats.distributed, label: 'Terdistribusi', iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.07 }}
              className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                <Icon className={`h-5 w-5 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────────── */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
          <p className="flex-1 text-sm text-red-700">{error}</p>
          <button onClick={() => setError(null)} className="shrink-0 text-red-400 transition hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* ── Left: Upload + List ─────────────────────────────────────────────── */}
        <div className="space-y-5 lg:col-span-2">

          {/* Upload card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          >
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-sm font-bold text-slate-700">Upload Notula Baru</h2>
            </div>
            <div className="p-5">
              <UploadZone onFiles={handleFiles} disabled={uploading} />
              {hasProcessing && (
                <p className="mt-3 flex items-center gap-2 text-xs font-medium text-violet-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  AI sedang menganalisis notula di background…
                </p>
              )}
            </div>
          </motion.div>

          {/* Notula list card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <h2 className="text-base font-bold text-slate-800">Daftar Notula</h2>
                {minutes.length > 0 && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                    {minutes.length}
                  </span>
                )}
              </div>
              {notulaTotalPages > 1 && (
                <p className="text-xs text-slate-400">
                  Halaman <span className="font-semibold text-slate-600">{notulaPage}</span> dari{' '}
                  <span className="font-semibold text-slate-600">{notulaTotalPages}</span>
                </p>
              )}
            </div>

            <div className="divide-y divide-slate-50">
              {loading ? (
                <div className="flex items-center gap-2 p-8 text-sm text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" /> Memuat notula…
                </div>
              ) : minutes.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-14 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                    <FileText className="h-7 w-7 text-slate-300" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-600">Belum ada notula</p>
                    <p className="mt-1 text-xs text-slate-400">Upload notula pertama untuk memulai.</p>
                  </div>
                </div>
              ) : (
                paginatedMinutes.map((minute, index) => {
                  const borderColor = statusBorderMap[minute.status] ?? 'border-l-slate-200';
                  return (
                    <motion.div
                      key={minute.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.04 }}
                      className={`border-l-[3px] px-5 py-4 transition-colors hover:bg-slate-50/70 ${borderColor}`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-sm font-semibold text-slate-800" title={minute.title}>
                            {minute.title}
                          </h3>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-400">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {minute.meetingDate}
                            </span>
                            {minute.participantsCount > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span>·</span>
                                <Users className="h-3 w-3" />
                                {minute.participantsCount} peserta
                              </span>
                            )}
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadgeClass(minute.status)}`}>
                          {minute.status === 'processing' && <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />}
                          {statusLabel(minute.status)}
                        </span>
                      </div>

                      {['reviewed', 'approved', 'distributed'].includes(minute.status) && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                            {minute.typoCount} typo
                          </span>
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            {minute.ambiguousCount} ambigu
                          </span>
                          <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
                            {minute.ctaCount} tindak lanjut
                          </span>
                          {Boolean(minute.approvedFindingsJson) && (
                            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                              {parseApprovedIndices(minute.approvedFindingsJson).length} disetujui
                            </span>
                          )}
                        </div>
                      )}

                      {minute.analysisError && (
                        <p className="mb-3 text-xs text-red-600">Error: {minute.analysisError}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => void openReview(minute)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Lihat Detail
                        </button>

                        {(minute.status === 'uploaded' || minute.status === 'error') && (
                          <button
                            onClick={() => analyzeInBackground(minute.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Analisa AI
                          </button>
                        )}

                        {minute.status === 'reviewed' && (
                          <button
                            onClick={() => analyzeInBackground(minute.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Review Ulang
                          </button>
                        )}

                        {minute.correctedStoragePath && (
                          <button
                            onClick={() => void downloadCorrected(minute)}
                            disabled={downloadingCorrected === minute.id}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-60"
                          >
                            {downloadingCorrected === minute.id
                              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              : <Download className="h-3.5 w-3.5" />
                            }
                            Unduh Terkoreksi
                          </button>
                        )}

                        {['reviewed', 'approved'].includes(minute.status) && (
                          <button
                            onClick={() => openDistribute(minute)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Distribusi Email
                          </button>
                        )}

                        {minute.status === 'distributed' && (
                          <button
                            onClick={() => openDistribute(minute)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            <Send className="h-3.5 w-3.5" />
                            Kirim Ulang
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Notula pagination */}
            {notulaTotalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
                <p className="text-xs text-slate-400">
                  Menampilkan{' '}
                  <span className="font-semibold text-slate-600">
                    {(notulaPage - 1) * NOTULA_PER_PAGE + 1}–{Math.min(notulaPage * NOTULA_PER_PAGE, minutes.length)}
                  </span>{' '}
                  dari <span className="font-semibold text-slate-600">{minutes.length}</span> notula
                </p>
                <div className="flex items-center gap-1">
                  <PaginationBtn onClick={() => setNotulaPage((p) => p - 1)} disabled={notulaPage === 1} ariaLabel="Halaman sebelumnya">
                    <ChevronLeft className="h-4 w-4" />
                  </PaginationBtn>
                  {buildPageNumbers(notulaPage, notulaTotalPages).map((page, idx) =>
                    page === '...' ? (
                      <span key={`e-${idx}`} className="w-7 select-none text-center text-xs text-slate-400">…</span>
                    ) : (
                      <PaginationBtn key={page} onClick={() => setNotulaPage(page as number)} active={notulaPage === page}>
                        {page}
                      </PaginationBtn>
                    ),
                  )}
                  <PaginationBtn onClick={() => setNotulaPage((p) => p + 1)} disabled={notulaPage === notulaTotalPages} ariaLabel="Halaman berikutnya">
                    <ChevronRight className="h-4 w-4" />
                  </PaginationBtn>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Right: Tindak Lanjut sidebar ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-800">Tindak Lanjut</h2>
              {minutesWithCta.length > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  {minutesWithCta.length}
                </span>
              )}
            </div>
            {ctaTotalPages > 1 && (
              <p className="text-xs text-slate-400">
                <span className="font-semibold text-slate-600">{ctaSidebarPage}</span>/{ctaTotalPages}
              </p>
            )}
          </div>

          <div className="flex-1 p-4">
            {minutesWithCta.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                  <Clock className="h-6 w-6 text-slate-300" />
                </div>
                <p className="text-xs text-slate-400">
                  Tindak lanjut akan muncul setelah notula dianalisis AI.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {paginatedCtaMinutes.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => void openReview(m)}
                    className="group w-full rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-left transition-all hover:border-indigo-200 hover:bg-indigo-50/30 hover:shadow-sm"
                  >
                    <p className="truncate text-xs font-semibold text-slate-800 group-hover:text-indigo-800" title={m.title}>
                      {m.title}
                    </p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-700">
                        {m.ctaCount} tindak lanjut
                      </span>
                      <span className="text-xs text-slate-400">{m.meetingDate}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* CTA sidebar pagination */}
          {ctaTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
              <p className="text-xs text-slate-400">
                {(ctaSidebarPage - 1) * CTA_SIDEBAR_PER_PAGE + 1}–{Math.min(ctaSidebarPage * CTA_SIDEBAR_PER_PAGE, minutesWithCta.length)}{' '}
                dari {minutesWithCta.length}
              </p>
              <div className="flex items-center gap-1">
                <PaginationBtn onClick={() => setCtaSidebarPage((p) => p - 1)} disabled={ctaSidebarPage === 1} ariaLabel="Sebelumnya">
                  <ChevronLeft className="h-4 w-4" />
                </PaginationBtn>
                {buildPageNumbers(ctaSidebarPage, ctaTotalPages).map((page, idx) =>
                  page === '...' ? (
                    <span key={`e-${idx}`} className="w-6 select-none text-center text-xs text-slate-400">…</span>
                  ) : (
                    <PaginationBtn key={page} onClick={() => setCtaSidebarPage(page as number)} active={ctaSidebarPage === page}>
                      {page}
                    </PaginationBtn>
                  ),
                )}
                <PaginationBtn onClick={() => setCtaSidebarPage((p) => p + 1)} disabled={ctaSidebarPage === ctaTotalPages} ariaLabel="Berikutnya">
                  <ChevronRight className="h-4 w-4" />
                </PaginationBtn>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Upload form modal ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showUploadForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !uploading && setShowUploadForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 16, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.96, y: 16, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              <div className="border-b border-slate-100 px-6 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
                      <FileText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-800">Upload Notula</h2>
                      <p className="mt-0.5 max-w-xs truncate text-xs text-slate-400">
                        {pendingFile?.name} · {((pendingFile?.size ?? 0) / 1024).toFixed(0)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => !uploading && setShowUploadForm(false)}
                    className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-4 px-6 py-5">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">
                    Judul Notula <span className="text-red-500">*</span>
                  </span>
                  <input
                    autoFocus
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void submitUpload(); }}
                    placeholder="Contoh: Rapat Koordinasi Bulanan April 2026"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-slate-500">Tanggal Rapat</span>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 transition focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/20"
                    value={uploadDate}
                    onChange={(e) => setUploadDate(e.target.value)}
                  />
                </label>

                <div className="flex items-start gap-2.5 rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-indigo-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                  <p className="text-xs leading-relaxed text-indigo-700">
                    <strong>Jumlah peserta</strong> dideteksi otomatis dari Daftar Hadir.{' '}
                    <strong>Email distribusi</strong> diambil dari <strong>Pengaturan → Unit Kerja</strong>.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                    <p className="text-xs font-medium text-red-700">{error}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  onClick={() => !uploading && setShowUploadForm(false)}
                  disabled={uploading}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => void submitUpload()}
                  disabled={uploading || !uploadTitle.trim()}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengunggah…</>
                    : <><Upload className="h-4 w-4" /> Upload &amp; Analisa AI</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Review modal ───────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {reviewMinute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
            onClick={closeReview}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="my-8 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-bold text-slate-800">{reviewMinute.title}</h2>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />{reviewMinute.meetingDate}
                    </span>
                    <span>·</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />{reviewMinute.participantsCount} peserta
                    </span>
                    <span className={`rounded-full px-2.5 py-0.5 font-semibold ${statusBadgeClass(reviewMinute.status)}`}>
                      {statusLabel(reviewMinute.status)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={closeReview}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {reviewMinute.status === 'processing' ? (
                <div className="flex flex-col items-center gap-4 p-14 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">AI sedang menganalisis notula ini…</p>
                    <p className="mt-1 text-xs text-slate-400">Halaman akan otomatis diperbarui saat selesai.</p>
                  </div>
                </div>
              ) : reviewMinute.status === 'uploaded' ? (
                <div className="p-10 text-center">
                  <p className="text-sm text-slate-500">Notula belum dianalisis. Review AI dimulai secara otomatis setelah upload.</p>
                </div>
              ) : reviewMinute.status === 'error' ? (
                <div className="p-6">
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-700">Analisis gagal</p>
                    <p className="mt-1 text-xs text-red-600">{reviewMinute.analysisError}</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 px-6">
                    {(['findings', 'ctas'] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                          activeTab === tab
                            ? 'border-primary-500 text-primary-700'
                            : 'border-transparent text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {tab === 'findings'
                          ? `Temuan (${findings.length})`
                          : `Tindak Lanjut (${ctaLoading ? '…' : reviewCtas.length})`
                        }
                      </button>
                    ))}
                  </div>

                  {/* Findings tab */}
                  {activeTab === 'findings' && (
                    <div className="p-6">
                      {findings.length === 0 ? (
                        <div className="flex flex-col items-center gap-3 py-10 text-center">
                          <CheckCircle className="h-10 w-10 text-emerald-400" />
                          <p className="text-sm text-slate-500">Tidak ada temuan typo atau kalimat ambigu.</p>
                        </div>
                      ) : (
                        <>
                          <div className="mb-4 flex items-center justify-between">
                            <p className="text-sm text-slate-600">
                              <span className="font-semibold text-primary-700">{approvedSet.size}</span> dari{' '}
                              {findings.length} temuan dipilih
                            </p>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={selectAllFindings}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                              >
                                <Check className="h-3.5 w-3.5" /> Pilih Semua
                              </button>
                              <button
                                onClick={clearAllFindings}
                                className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200"
                              >
                                <Minus className="h-3.5 w-3.5" /> Kosongkan
                              </button>
                            </div>
                          </div>

                          <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                            {findings.map((f, idx) => {
                              const approved = approvedSet.has(idx);
                              return (
                                <div
                                  key={idx}
                                  onClick={() => toggleApproval(idx)}
                                  className={`cursor-pointer rounded-xl border p-4 transition-all ${
                                    approved
                                      ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                                      : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start gap-3">
                                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                      approved ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                                    }`}>
                                      {approved && <Check className="h-3 w-3 text-white" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="mb-2 flex flex-wrap items-center gap-2">
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                          f.kind === 'typo' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                        }`}>
                                          {f.kind === 'typo' ? 'Typo' : 'Ambigu'}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                          f.severity === 'high' ? 'bg-red-50 text-red-600' :
                                          f.severity === 'medium' ? 'bg-amber-50 text-amber-600' :
                                          'bg-slate-100 text-slate-600'
                                        }`}>
                                          {f.severity === 'high' ? 'Tinggi' : f.severity === 'medium' ? 'Sedang' : 'Rendah'}
                                        </span>
                                        <span className="text-xs text-slate-400">{f.locationHint}</span>
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                          <p className="font-medium text-slate-500">Teks asli</p>
                                          <p className="mt-0.5 rounded-lg bg-red-50 px-2 py-1.5 text-red-800 line-through">{f.originalText}</p>
                                        </div>
                                        <div>
                                          <p className="font-medium text-slate-500">Saran</p>
                                          <p className="mt-0.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-emerald-800">{f.suggestedText}</p>
                                        </div>
                                      </div>
                                      <p className="mt-2 text-xs text-slate-500">{f.explanation}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                            <div>
                              <p className="text-xs text-slate-400">
                                Perubahan yang disetujui akan diterapkan ke dokumen dan bisa diunduh.
                              </p>
                              {reviewMinute.correctedAt && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-emerald-600">
                                  <CheckCircle className="h-3 w-3" />
                                  Diperbarui {new Date(reviewMinute.correctedAt).toLocaleString('id-ID')}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {reviewMinute.correctedStoragePath && (
                                <button
                                  onClick={() => void downloadCorrected(reviewMinute)}
                                  disabled={downloadingCorrected === reviewMinute.id}
                                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                >
                                  {downloadingCorrected === reviewMinute.id
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Download className="h-4 w-4" />
                                  }
                                  Unduh .docx
                                </button>
                              )}
                              <button
                                onClick={() => void saveApprovedFindings()}
                                disabled={approvingSave}
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {approvingSave
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <CheckCircle className="h-4 w-4" />
                                }
                                Setujui {approvedSet.size > 0 ? `${approvedSet.size} ` : ''}Perubahan
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Tindak lanjut tab */}
                  {activeTab === 'ctas' && (
                    <div className="p-6">
                      {ctaLoading ? (
                        <div className="flex items-center gap-2 text-sm text-slate-400">
                          <Loader2 className="h-4 w-4 animate-spin" /> Memuat tindak lanjut…
                        </div>
                      ) : reviewCtas.length === 0 ? (
                        <div className="py-10 text-center text-sm text-slate-400">
                          Tidak ada tindak lanjut terdeteksi dari notula ini.
                        </div>
                      ) : (
                        <div className="max-h-[500px] space-y-3 overflow-y-auto pr-1">
                          {reviewCtas.map((cta) => (
                            <div key={cta.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                              <div className="mb-2 flex items-start justify-between gap-2">
                                <p className="text-sm font-semibold text-slate-800">{cta.title}</p>
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                                  cta.priority === 'high' ? 'bg-red-100 text-red-700' :
                                  cta.priority === 'medium' ? 'bg-amber-100 text-amber-700' :
                                  'bg-emerald-100 text-emerald-700'
                                }`}>
                                  {cta.priority === 'high' ? 'Tinggi' : cta.priority === 'medium' ? 'Sedang' : 'Rendah'}
                                </span>
                              </div>
                              <p className="mb-3 text-xs text-slate-600">{cta.action}</p>
                              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                {cta.picName && <span><span className="font-medium">PIC:</span> {cta.picName}</span>}
                                {cta.unit && <span><span className="font-medium">Unit:</span> {cta.unit}</span>}
                                {cta.deadline && <span><span className="font-medium">Deadline:</span> {cta.deadline}</span>}
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-xs font-medium text-slate-500">Status:</label>
                                <select
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-primary/30"
                                  value={cta.status}
                                  disabled={ctaSavingIds.has(cta.id)}
                                  onChange={(e) => void updateCta(cta.id, { status: e.target.value as CtaItemRow['status'] })}
                                >
                                  <option value="pending">Pending</option>
                                  <option value="in-progress">Dalam proses</option>
                                  <option value="completed">Selesai</option>
                                </select>
                                {ctaSavingIds.has(cta.id) && (
                                  <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                                    <Loader2 className="h-3 w-3 animate-spin" /> Menyimpan
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {reviewCtas.length > 0 && (
                        <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-xs text-slate-400">
                          {ctaSavingIds.size > 0
                            ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Menyimpan perubahan…</>
                            : <><CheckCircle className="h-3.5 w-3.5 text-emerald-500" />Perubahan tersimpan otomatis.</>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Distribute modal ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {distributeMinute && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={() => !distributing && setDistributeMinute(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 12 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                  <Mail className="h-5 w-5 text-emerald-600" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold text-slate-800">Distribusi Notula</h2>
                  <p className="truncate text-xs text-slate-400">{distributeMinute.title}</p>
                </div>
                <button
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => !distributing && setDistributeMinute(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-5">
                {unitKerjaList.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-500">Pilih Unit Kerja Penerima</p>
                    <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
                      {unitKerjaList.map((uk) => {
                        const selected = selectedUkIds.has(uk.id);
                        let aliases: string[] = [];
                        try { aliases = JSON.parse(uk.aliasesJson) as string[]; } catch { /* ignore */ }
                        return (
                          <button
                            key={uk.id}
                            type="button"
                            onClick={() => toggleUk(uk.id)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all ${
                              selected
                                ? 'border border-indigo-200 bg-indigo-50 shadow-sm'
                                : 'border border-transparent bg-white hover:border-slate-200'
                            }`}
                          >
                            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                              selected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                            }`}>
                              {selected && <Check className="h-3 w-3 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-semibold text-slate-800">{uk.name}</p>
                              <p className="truncate text-xs text-indigo-600">{uk.email}</p>
                              {aliases.length > 0 && <p className="text-xs text-slate-400">{aliases.join(' · ')}</p>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedUkIds.size > 0 && (
                      <p className="mt-1.5 text-xs font-medium text-primary-600">
                        {selectedUkIds.size} unit kerja dipilih — tindak lanjut akan difilter per unit secara otomatis
                      </p>
                    )}
                  </div>
                )}

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Email Tambahan (opsional)</span>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={distributeEmails}
                    onChange={(e) => setDistributeEmails(e.target.value)}
                    placeholder="email lain yang tidak ada di direktori unit kerja"
                  />
                  <p className="mt-0.5 text-xs text-slate-400">Pisahkan dengan koma</p>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Subjek Email</span>
                  <input
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={distributeSubject}
                    onChange={(e) => setDistributeSubject(e.target.value)}
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-600">Pesan Tambahan (opsional)</span>
                  <textarea
                    rows={2}
                    className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 transition focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    value={distributeMessage}
                    onChange={(e) => setDistributeMessage(e.target.value)}
                    placeholder="Pesan khusus kepada penerima (opsional)"
                  />
                </label>

                {distributeResult && (
                  <div className={`rounded-xl border p-3 text-xs ${
                    distributeResult.errors?.length
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-emerald-200 bg-emerald-50'
                  }`}>
                    {distributeResult.sent > 0 && (
                      <p className="font-semibold text-emerald-700">✓ Terkirim ke {distributeResult.sent} penerima</p>
                    )}
                    {distributeResult.errors?.map((e, i) => (
                      <p key={i} className="text-amber-700">{e}</p>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
                  <p className="font-semibold text-slate-700">Ringkasan pengiriman:</p>
                  <ul className="mt-1.5 space-y-0.5">
                    <li>· Notula: <span className="font-medium">{distributeMinute.title}</span></li>
                    <li>· Tanggal: <span className="font-medium">{distributeMinute.meetingDate}</span></li>
                    <li>· Tindak Lanjut: <span className="font-medium">{distributeMinute.ctaCount}</span></li>
                    <li>· Unit kerja dipilih: <span className="font-medium text-primary-700">{selectedUkIds.size}</span></li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
                <button
                  onClick={() => !distributing && setDistributeMinute(null)}
                  disabled={distributing}
                  className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  onClick={() => void submitDistribute()}
                  disabled={distributing}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {distributing
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Mendistribusi…</>
                    : <><Send className="h-4 w-4" /> Kirim ke Semua Penerima</>
                  }
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MeetingMinutes;
