import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  Trash2,
  Pencil,
  X,
  Loader2,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type DocumentStatus = 'processing' | 'reviewed' | 'error';

type AiFinding = {
  kind: 'typo' | 'ambiguous';
  severity: 'low' | 'medium' | 'high';
  locationHint: string;
  originalText: string;
  suggestedText: string;
  explanation: string;
  confidence?: number;
};

type AiProviderListItem = {
  provider: string;
  displayName: string;
  model: string;
  isActive: boolean;
  hasApiKey: boolean;
};

type StorageProvider = 'local' | 'cloudflare-r2';

type StorageInfo = {
  provider: StorageProvider;
  bucket?: string;
};

function storageProviderLabel(provider: StorageProvider) {
  if (provider === 'local') return 'Storage Lokal';
  return 'Cloudflare R2';
}

function storageProviderBadgeClass(provider: StorageProvider) {
  if (provider === 'local') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-sky-200 bg-sky-50 text-sky-700';
}

function shortModelLabel(p: { provider: string; displayName: string }) {
  if (p.provider === 'deepseek') return 'DeepSeek';
  if (p.provider === 'openai') return 'OpenAI (GPT)';
  if (p.provider === 'anthropic') return 'Anthropic';
  return p.displayName;
}

type AiReviewPayload = {
  summary: string;
  findings: AiFinding[];
};

function parseAiReviewPayload(value: unknown): AiReviewPayload | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as AiReviewPayload;
    } catch {
      return null;
    }
  }
  if (typeof value === 'object') return value as AiReviewPayload;
  return null;
}

function mapApiDocumentsToUi(json: { data: ApiDocument[] }): Document[] {
  return json.data.map((doc) => {
    const aiReview = parseAiReviewPayload(doc.findingsJson);
    return {
      id: doc.id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize ?? 0,
      storagePath: doc.storagePath,
      status: ['processing', 'reviewed', 'error'].includes(doc.status) ? (doc.status as DocumentStatus) : 'processing',
      typoCount: doc.typoCount ?? 0,
      ambiguousCount: doc.ambiguousCount ?? 0,
      aiReview,
      analysisError: doc.analysisError ?? null,
      createdAt: doc.createdAt,
      uploadDate: new Date(doc.createdAt).toISOString().slice(0, 10),
      sizeLabel: bytesToSize(doc.fileSize ?? 0),
    };
  });
}

interface ApiDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  status: string;
  typoCount: number;
  ambiguousCount: number;
  findingsJson?: unknown | null;
  analysisError?: string | null;
  analyzedAt?: string | null;
  createdAt: string;
}

interface Document {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  status: DocumentStatus;
  typoCount: number;
  ambiguousCount: number;
  aiReview?: AiReviewPayload | null;
  analysisError?: string | null;
  createdAt: string;
  uploadDate: string;
  sizeLabel: string;
}

type PreviewKind = 'pdf' | 'office' | 'unsupported';

type PreviewState = {
  title: string;
  sourceUrl: string;
  embedUrl: string | null;
  kind: PreviewKind;
  note?: string;
};

const statusOptions: { label: string; value: DocumentStatus; badge: string }[] = [
  { label: 'Memproses', value: 'processing', badge: 'bg-amber-50 text-amber-700 border border-amber-200' },
  { label: 'Direview', value: 'reviewed', badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200' },
  { label: 'Perlu Revisi', value: 'error', badge: 'bg-red-50 text-red-700 border border-red-200' },
];

const statusBorderMap: Record<DocumentStatus, string> = {
  processing: 'border-l-amber-400',
  reviewed: 'border-l-emerald-400',
  error: 'border-l-red-400',
};

const ITEMS_PER_PAGE = 8;

const bytesToSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

function hasFileExtension(filename: string, extensions: string[]) {
  const lower = filename.toLowerCase();
  return extensions.some((ext) => lower.endsWith(ext));
}

function isPdfDocument(doc: Pick<Document, 'filename' | 'fileType'>) {
  return doc.fileType.toLowerCase().includes('pdf') || hasFileExtension(doc.filename, ['.pdf']);
}

function isWordDocument(doc: Pick<Document, 'filename' | 'fileType'>) {
  const normalizedType = doc.fileType.toLowerCase();
  return (
    normalizedType.includes('word') ||
    normalizedType.includes('docx') ||
    hasFileExtension(doc.filename, ['.doc', '.docx'])
  );
}

function toAbsoluteBrowserUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).toString();
}

function canUseOfficePreview(absoluteUrl: string) {
  try {
    const { hostname, protocol } = new URL(absoluteUrl);
    if (protocol !== 'https:') return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) return false;
    return true;
  } catch {
    return false;
  }
}

function buildPreviewState(doc: Document, signedUrl: string): PreviewState {
  if (isPdfDocument(doc)) {
    return {
      title: doc.filename,
      sourceUrl: signedUrl,
      embedUrl: signedUrl,
      kind: 'pdf',
    };
  }

  if (isWordDocument(doc)) {
    const absoluteUrl = toAbsoluteBrowserUrl(signedUrl);
    if (canUseOfficePreview(absoluteUrl)) {
      return {
        title: doc.filename,
        sourceUrl: signedUrl,
        embedUrl: `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(absoluteUrl)}`,
        kind: 'office',
      };
    }

    return {
      title: doc.filename,
      sourceUrl: signedUrl,
      embedUrl: null,
      kind: 'unsupported',
      note: 'Preview DOC/DOCX butuh URL HTTPS publik. Dokumen ini tetap bisa dibuka di tab baru atau diunduh.',
    };
  }

  return {
    title: doc.filename,
    sourceUrl: signedUrl,
    embedUrl: null,
    kind: 'unsupported',
    note: 'Tipe file ini belum didukung untuk preview langsung di browser.',
  };
}

async function copyTextToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
}

function formatReviewPlainTextForShare(doc: Document): string {
  const lines: string[] = [];
  lines.push(`Review dokumen: ${doc.filename}`);
  lines.push(`Typo: ${doc.typoCount} | Ambigu: ${doc.ambiguousCount}`);
  lines.push('');
  if (doc.analysisError) {
    lines.push(`Error analisa: ${doc.analysisError}`);
    return lines.join('\n');
  }
  const r = doc.aiReview;
  if (!r) {
    lines.push('Belum ada ringkasan/temuan tersimpan.');
    return lines.join('\n');
  }
  lines.push('Ringkasan:');
  lines.push(r.summary);
  lines.push('');
  const findings = r.findings ?? [];
  if (!findings.length) {
    lines.push('Temuan: (tidak ada)');
    return lines.join('\n');
  }
  lines.push('Temuan:');
  findings.forEach((f, i) => {
    lines.push(`${i + 1}. [${f.kind}] ${f.locationHint} (${f.severity})`);
    lines.push(`   Asli: ${f.originalText}`);
    lines.push(`   Saran: ${f.suggestedText}`);
    lines.push(`   Penjelasan: ${f.explanation}`);
    lines.push('');
  });
  return lines.join('\n').trimEnd();
}

async function readApiErrorMessage(res: Response, fallback: string) {
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

interface DocumentFormState {
  filename: string;
  fileType: string;
  fileSize: string;
  storagePath: string;
  status: DocumentStatus;
  typoCount: string;
  ambiguousCount: string;
}

const defaultFormState: DocumentFormState = {
  filename: '',
  fileType: 'PDF',
  fileSize: '',
  storagePath: '',
  status: 'processing',
  typoCount: '0',
  ambiguousCount: '0',
};

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

interface ActionButtonProps {
  onClick: () => void;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'danger';
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ onClick, title, icon: Icon, variant = 'default', disabled }) => (
  <motion.button
    whileHover={{ scale: disabled ? 1 : 1.1 }}
    whileTap={{ scale: disabled ? 1 : 0.9 }}
    onClick={onClick}
    title={title}
    disabled={disabled}
    className={`rounded-lg p-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      variant === 'danger'
        ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
        : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
    }`}
  >
    <Icon className="h-4 w-4" />
  </motion.button>
);

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

export const DocumentReview: React.FC = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiProviders, setAiProviders] = useState<AiProviderListItem[]>([]);
  const [aiProvidersLoading, setAiProvidersLoading] = useState(true);
  const [providerActivating, setProviderActivating] = useState(false);
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null);
  const [analyzingDocIds, setAnalyzingDocIds] = useState<Record<string, boolean>>({});
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [findingsDoc, setFindingsDoc] = useState<Document | null>(null);
  const [findingsCopyState, setFindingsCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [rowCopyDocId, setRowCopyDocId] = useState<string | null>(null);
  const [batchInfo, setBatchInfo] = useState<{ batchId: string; status: string } | null>(null);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState<DocumentFormState>(defaultFormState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchDocuments = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      const res = await fetch('/api/documents', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat dokumen'));
      const json = (await res.json()) as { data: ApiDocument[] };
      setDocuments(mapApiDocumentsToUi(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDocuments(); }, [fetchDocuments]);

  const loadAiProviders = useCallback(async () => {
    setAiProvidersLoading(true);
    try {
      const res = await fetch('/api/ai/providers', { cache: 'no-store' });
      if (!res.ok) { setAiProviders([]); return; }
      const json = (await res.json()) as { data: AiProviderListItem[] };
      setAiProviders(json.data ?? []);
    } catch {
      setAiProviders([]);
    } finally {
      setAiProvidersLoading(false);
    }
  }, []);

  useEffect(() => { void loadAiProviders(); }, [loadAiProviders]);

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

  const activeProviderId = useMemo(() => aiProviders.find((p) => p.isActive)?.provider ?? '', [aiProviders]);

  const handleActivateProvider = async (nextProvider: string) => {
    if (!nextProvider || nextProvider === activeProviderId) return;
    setProviderActivating(true);
    setError(null);
    try {
      const res = await fetch(`/api/ai/providers/${nextProvider}/activate`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal mengganti model'));
      await loadAiProviders();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
    } finally {
      setProviderActivating(false);
    }
  };

  const handleRetryAnalyze = async (docId: string) => {
    try {
      setError(null);
      setAnalyzingDocIds((prev) => ({ ...prev, [docId]: true }));
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, status: 'processing', analysisError: null, typoCount: 0, ambiguousCount: 0, aiReview: null } : d,
        ),
      );
      const res = await fetch(`/api/documents/${docId}/analyze`, { method: 'POST' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menjalankan review AI'));
      const bodyJson = (await res.json()) as { data: ApiDocument };
      const mapped = mapApiDocumentsToUi({ data: [bodyJson.data] })[0];
      if (!mapped) throw new Error('Gagal memuat hasil review');
      setDocuments((prev) => prev.map((d) => (d.id === docId ? mapped : d)));
      setFindingsDoc((prev) => (prev?.id === docId ? mapped : prev));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
      await fetchDocuments({ silent: true });
    } finally {
      setAnalyzingDocIds((prev) => { const next = { ...prev }; delete next[docId]; return next; });
    }
  };

  useEffect(() => { setFindingsCopyState('idle'); }, [findingsDoc?.id]);

  const handleCopyFindingsText = async () => {
    if (!findingsDoc) return;
    try {
      await copyTextToClipboard(formatReviewPlainTextForShare(findingsDoc));
      setFindingsCopyState('ok');
      window.setTimeout(() => setFindingsCopyState('idle'), 2000);
    } catch {
      setFindingsCopyState('fail');
      window.setTimeout(() => setFindingsCopyState('idle'), 2500);
    }
  };

  const handleCopyRowFindings = async (doc: Document) => {
    try {
      setError(null);
      await copyTextToClipboard(formatReviewPlainTextForShare(doc));
      setRowCopyDocId(doc.id);
      window.setTimeout(() => { setRowCopyDocId((prev) => (prev === doc.id ? null : prev)); }, 2000);
    } catch {
      setError('Gagal menyalin ke clipboard.');
    }
  };

  useEffect(() => {
    if (!batchInfo?.batchId) return;
    if (batchSyncing) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/ai/batches/${batchInfo.batchId}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: { processingStatus?: string } };
        const st = json.data?.processingStatus ?? 'in_progress';
        if (cancelled) return;
        setBatchInfo((prev) => (prev ? { ...prev, status: st } : prev));
        if (st === 'ended') {
          setBatchSyncing(true);
          const syncRes = await fetch(`/api/ai/batches/${batchInfo.batchId}/sync`, { method: 'POST' });
          if (!cancelled && syncRes.ok) { setBatchInfo(null); await fetchDocuments(); }
        }
      } finally {
        if (!cancelled) setBatchSyncing(false);
      }
    };
    void tick();
    const interval = window.setInterval(() => void tick(), 30_000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [batchInfo?.batchId, batchSyncing, fetchDocuments]);

  const hasProcessingDocuments = useMemo(() => documents.some((d) => d.status === 'processing'), [documents]);

  useEffect(() => {
    if (!hasProcessingDocuments) return;
    const id = window.setInterval(() => { void fetchDocuments({ silent: true }); }, 8000);
    return () => window.clearInterval(id);
  }, [hasProcessingDocuments, fetchDocuments]);

  const stats = useMemo(() => {
    const total = documents.length;
    const reviewed = documents.filter((doc) => doc.status === 'reviewed').length;
    const findings = documents.reduce((acc, doc) => acc + doc.typoCount + doc.ambiguousCount, 0);
    return { total, reviewed, findings };
  }, [documents]);

  useEffect(() => { setCurrentPage(1); }, [documents.length]);

  const totalPages = Math.ceil(documents.length / ITEMS_PER_PAGE);
  const paginatedDocuments = useMemo(
    () => documents.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE),
    [documents, currentPage],
  );

  const runUploadedDocumentsAnalysis = async (createdIds: string[]) => {
    if (createdIds.length === 0) return;
    if (createdIds.length >= 2) {
      const batchRes = await fetch('/api/documents/batch-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: createdIds }),
      });
      if (batchRes.ok) {
        const json = (await batchRes.json()) as { data?: { batchId?: string; processingStatus?: string } };
        const batchId = json.data?.batchId;
        if (batchId) setBatchInfo({ batchId, status: json.data?.processingStatus ?? 'in_progress' });
      } else {
        for (const docId of createdIds) {
          const analyzeRes = await fetch(`/api/documents/${docId}/analyze`, { method: 'POST' });
          if (!analyzeRes.ok) throw new Error(await readApiErrorMessage(analyzeRes, 'Gagal menjalankan review AI'));
        }
      }
    } else {
      const analyzeRes = await fetch(`/api/documents/${createdIds[0]}/analyze`, { method: 'POST' });
      if (!analyzeRes.ok) throw new Error(await readApiErrorMessage(analyzeRes, 'Gagal menjalankan review AI'));
    }
  };

  const uploadAndCreateDocuments = async (files: FileList | File[]) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;
    if (list.length > 5) { setError('Maksimal 5 dokumen per upload.'); return; }
    const tooLarge = list.find((f) => f.size > 10 * 1024 * 1024);
    if (tooLarge) { setError(`File terlalu besar: ${tooLarge.name}. Maks 10MB.`); return; }

    setUploading(true);
    setError(null);
    let idsToAnalyze: string[] = [];
    try {
      const form = new FormData();
      for (const f of list) form.append('files', f);
      const uploadRes = await fetch('/api/uploads/documents', { method: 'POST', body: form });
      const rawBody = await uploadRes.text();
      let uploadJson: unknown = null;
      if (rawBody.trim()) {
        try { uploadJson = JSON.parse(rawBody) as unknown; }
        catch { throw new Error(`Gagal upload dokumen (HTTP ${uploadRes.status}). Respons bukan JSON.`); }
      }
      if (!uploadRes.ok) {
        const errMsg = uploadJson && typeof uploadJson === 'object' && 'error' in uploadJson
          ? String((uploadJson as { error?: unknown }).error ?? '') : '';
        throw new Error(errMsg || `Gagal upload dokumen (HTTP ${uploadRes.status}).`);
      }
      if (!uploadJson || typeof uploadJson !== 'object' || !('data' in uploadJson)) {
        throw new Error('Gagal upload dokumen (respons tidak valid).');
      }
      const uploaded = (uploadJson as { data: Array<{ filename: string; fileType: string; fileSize: number; storagePath: string }> }).data;
      const createdIds: string[] = [];
      for (const u of uploaded) {
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: u.filename, fileType: u.fileType, fileSize: u.fileSize, storagePath: u.storagePath, status: 'processing', typoCount: 0, ambiguousCount: 0 }),
        });
        if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan metadata dokumen'));
        const createdJson = (await res.json()) as { data?: { id?: string } };
        const docId = createdJson.data?.id;
        if (!docId) throw new Error('Gagal menyimpan metadata dokumen (ID tidak dikembalikan).');
        createdIds.push(docId);
      }
      await fetchDocuments({ silent: true });
      idsToAnalyze = createdIds;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    if (idsToAnalyze.length === 0) return;
    void (async () => {
      try {
        await runUploadedDocumentsAnalysis(idsToAnalyze);
        await fetchDocuments({ silent: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan saat review AI.');
      }
    })();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) void uploadAndCreateDocuments(e.dataTransfer.files);
  };
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleOpenEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditForm({
      filename: doc.filename, fileType: doc.fileType, fileSize: String(doc.fileSize),
      storagePath: doc.storagePath, status: doc.status, typoCount: String(doc.typoCount),
      ambiguousCount: String(doc.ambiguousCount),
    });
    setShowEditModal(true);
  };

  const handleUpdateDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    try {
      setSubmitting(true);
      setError(null);
      const payload = {
        filename: editForm.filename.trim() || undefined,
        fileType: editForm.fileType.trim() || undefined,
        fileSize: editForm.fileSize ? Number(editForm.fileSize) : undefined,
        storagePath: editForm.storagePath.trim() || undefined,
        status: editForm.status,
        typoCount: Number(editForm.typoCount),
        ambiguousCount: Number(editForm.ambiguousCount),
      };
      const res = await fetch(`/api/documents/${editingId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Gagal memperbarui dokumen.');
      setShowEditModal(false);
      setEditingId(null);
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteDocument = async (id: string) => {
    if (!confirm('Hapus dokumen ini?')) return;
    try {
      setError(null);
      const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus dokumen.');
      await fetchDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  };

  const fetchSignedUrl = async (id: string) => {
    const res = await fetch(`/api/documents/${id}/signed-url`, { cache: 'no-store' });
    const json = (await res.json()) as { data?: { url: string }; error?: string };
    if (!res.ok || !json.data?.url) throw new Error(json.error || 'Gagal membuat link file.');
    return json.data.url;
  };

  const handlePreview = async (doc: Document) => {
    try {
      setPreviewLoading(true);
      setError(null);
      const url = await fetchSignedUrl(doc.id);
      setPreviewState(buildPreviewState(doc, url));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      setError(null);
      const url = await fetchSignedUrl(doc.id);
      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noreferrer'; a.download = doc.filename;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  };

  const openFindings = (doc: Document) => setFindingsDoc(doc);

  return (
    <div className="space-y-6">

      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-sm">
              <FileText className="h-4.5 w-4.5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Review Dokumen</h1>
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            Upload dan review dokumen dengan bantuan AI untuk deteksi typo dan kalimat ambigu.
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

        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Model AI</span>
            <div className="relative">
              <select
                className="h-9 max-w-[200px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white pl-3 pr-8 text-sm font-medium text-slate-700 shadow-sm outline-none transition hover:border-slate-300 focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-60"
                value={activeProviderId}
                onChange={(e) => void handleActivateProvider(e.target.value)}
                disabled={aiProvidersLoading || providerActivating || aiProviders.length === 0}
                aria-label="Pilih model AI aktif"
              >
                {aiProvidersLoading ? (
                  <option value="">Memuat…</option>
                ) : (
                  <>
                    <option value="" disabled={Boolean(activeProviderId)}>Pilih model</option>
                    {aiProviders.map((p) => (
                      <option key={p.provider} value={p.provider} disabled={!p.hasApiKey}>
                        {shortModelLabel(p)}{!p.hasApiKey ? ' (no key)' : ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
              <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2">
                {providerActivating
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                  : <ChevronRight className="h-3.5 w-3.5 rotate-90 text-slate-400" />
                }
              </div>
            </div>
            {!aiProvidersLoading && !aiProviders.some((p) => p.hasApiKey) ? (
              <p className="text-xs text-amber-600">Belum ada API key. Buka Pengaturan.</p>
            ) : null}
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5 transition-all hover:bg-primary-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-4 w-4" />
            {uploading ? 'Mengupload…' : 'Tambah Dokumen'}
          </button>
        </div>
      </div>

      {/* ── Error Banner ──────────────────────────────────────── */}
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

      {/* ── Batch Info ────────────────────────────────────────── */}
      {batchInfo ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-indigo-800">
            <Loader2 className="h-4 w-4 animate-spin text-indigo-500" aria-hidden />
            <span>
              Review Batch AI sedang diproses —{' '}
              <span className="font-mono text-xs text-indigo-600">{batchInfo.batchId}</span>
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-200 transition hover:bg-indigo-50"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/ai/batches/${batchInfo.batchId}`, { cache: 'no-store' });
                  if (res.ok) {
                    const json = (await res.json()) as { data?: { processingStatus?: string } };
                    const st = json.data?.processingStatus ?? 'in_progress';
                    setBatchInfo((prev) => (prev ? { ...prev, status: st } : prev));
                    if (st === 'ended') {
                      const syncRes = await fetch(`/api/ai/batches/${batchInfo.batchId}/sync`, { method: 'POST' });
                      if (syncRes.ok) { setBatchInfo(null); await fetchDocuments(); }
                    }
                  }
                } catch { /* ignore */ }
              }}
            >
              Cek status ({batchInfo.status})
            </button>
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700"
              onClick={async () => {
                const res = await fetch(`/api/ai/batches/${batchInfo.batchId}/sync`, { method: 'POST' });
                if (res.ok) { setBatchInfo(null); await fetchDocuments(); }
              }}
            >
              Sinkronkan hasil
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Upload Zone ───────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative overflow-hidden rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-200 ${
          isDragging
            ? 'scale-[1.01] border-primary-400 bg-primary/5'
            : 'border-slate-200 bg-gradient-to-b from-slate-50/80 to-white hover:border-primary-300 hover:bg-primary/5'
        }`}
      >
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-200 shadow-sm">
          <Upload className={`h-7 w-7 transition-colors ${isDragging ? 'text-primary-700' : 'text-primary-500'}`} />
        </div>
        <h3 className="mb-1.5 text-base font-semibold text-slate-700">
          {isDragging ? 'Lepaskan file di sini' : 'Drag & Drop atau Klik untuk Upload'}
        </h3>
        <p className="mb-5 text-sm text-slate-400">
          Mendukung PDF, DOCX &bull; Maksimal 10 MB per file &bull; Hingga 5 dokumen sekaligus
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? <><Loader2 className="h-4 w-4 animate-spin" /> Mengupload…</> : 'Pilih File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => { if (e.target.files) void uploadAndCreateDocuments(e.target.files); }}
        />
      </motion.div>

      {/* ── Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { icon: FileText, value: loading ? '—' : stats.total, label: 'Total Dokumen', iconBg: 'bg-violet-100', iconColor: 'text-violet-600' },
          { icon: CheckCircle, value: loading ? '—' : stats.reviewed, label: 'Sudah Direview', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
          { icon: AlertTriangle, value: loading ? '—' : stats.findings, label: 'Total Temuan', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"
            >
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>
                <Icon className={`h-6 w-6 ${item.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-800">{item.value}</p>
                <p className="text-xs font-medium text-slate-500">{item.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ── Document List ─────────────────────────────────────── */}
      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memuat dokumen…
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"
        >
          {/* Card header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-bold text-slate-800">Dokumen Terbaru</h2>
              {documents.length > 0 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500">
                  {documents.length}
                </span>
              )}
            </div>
            {totalPages > 1 && (
              <p className="text-xs text-slate-400">
                Halaman <span className="font-semibold text-slate-600">{currentPage}</span> dari{' '}
                <span className="font-semibold text-slate-600">{totalPages}</span>
              </p>
            )}
          </div>

          {/* Document rows */}
          <div className="divide-y divide-slate-50">
            {paginatedDocuments.map((doc, index) => {
              const isRetrying = Boolean(analyzingDocIds[doc.id]);
              const effectiveStatus: DocumentStatus = isRetrying ? 'processing' : doc.status;
              const statusMeta = statusOptions.find((item) => item.value === effectiveStatus) ?? statusOptions[0];
              const borderColor = statusBorderMap[effectiveStatus];
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className={`border-l-[3px] px-6 py-4 transition-colors hover:bg-slate-50/70 ${borderColor}`}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    {/* Left: icon + info */}
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-200">
                        <FileText className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-800" title={doc.filename}>
                          {doc.filename}
                        </h3>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                          <span className="font-medium text-slate-500">{doc.fileType}</span>
                          <span>·</span>
                          <span>{doc.sizeLabel}</span>
                          <span>·</span>
                          <span>{formatDate(doc.uploadDate)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openFindings(doc)}
                            className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100"
                            title="Lihat detail typo"
                          >
                            Typo: {doc.typoCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => openFindings(doc)}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                            title="Lihat detail ambigu"
                          >
                            Ambigu: {doc.ambiguousCount}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyRowFindings(doc)}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                            title="Salin ringkasan & temuan"
                          >
                            {rowCopyDocId === doc.id ? (
                              <><Check className="h-3 w-3 text-emerald-600" aria-hidden />Tersalin</>
                            ) : (
                              <><Copy className="h-3 w-3" aria-hidden />Salin</>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Right: status + actions */}
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                      <div className="flex items-center gap-0.5">
                        {doc.status === 'error' ? (
                          <button
                            onClick={() => void handleRetryAnalyze(doc.id)}
                            disabled={isRetrying}
                            className="mr-1 inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 ring-1 ring-red-200 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            title={doc.analysisError ?? 'Review ulang'}
                          >
                            {isRetrying
                              ? <><Loader2 className="h-3 w-3 animate-spin" />Memproses…</>
                              : <><RefreshCw className="h-3 w-3" />Ulang</>
                            }
                          </button>
                        ) : null}
                        <ActionButton onClick={() => void handlePreview(doc)} title="Preview" icon={Eye} />
                        <ActionButton onClick={() => void handleDownload(doc)} title="Unduh" icon={Download} />
                        <ActionButton onClick={() => handleOpenEdit(doc)} title="Edit" icon={Pencil} />
                        <ActionButton onClick={() => void handleDeleteDocument(doc.id)} title="Hapus" icon={Trash2} variant="danger" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {documents.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
                  <FileText className="h-7 w-7 text-slate-300" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-600">Belum ada dokumen</p>
                  <p className="mt-1 text-xs text-slate-400">Upload dokumen pertama untuk memulai review AI</p>
                </div>
              </div>
            )}
          </div>

          {/* ── Pagination ──────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-6 py-3">
              <p className="text-xs text-slate-400">
                Menampilkan{' '}
                <span className="font-semibold text-slate-600">
                  {(currentPage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, documents.length)}
                </span>{' '}
                dari <span className="font-semibold text-slate-600">{documents.length}</span> dokumen
              </p>
              <div className="flex items-center gap-1">
                <PaginationBtn
                  onClick={() => setCurrentPage((p) => p - 1)}
                  disabled={currentPage === 1}
                  ariaLabel="Halaman sebelumnya"
                >
                  <ChevronLeft className="h-4 w-4" />
                </PaginationBtn>
                {buildPageNumbers(currentPage, totalPages).map((page, idx) =>
                  page === '...' ? (
                    <span key={`e-${idx}`} className="w-7 select-none text-center text-xs text-slate-400">
                      …
                    </span>
                  ) : (
                    <PaginationBtn
                      key={page}
                      onClick={() => setCurrentPage(page as number)}
                      active={currentPage === page}
                    >
                      {page}
                    </PaginationBtn>
                  ),
                )}
                <PaginationBtn
                  onClick={() => setCurrentPage((p) => p + 1)}
                  disabled={currentPage === totalPages}
                  ariaLabel="Halaman berikutnya"
                >
                  <ChevronRight className="h-4 w-4" />
                </PaginationBtn>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      <AnimatePresence>
        {previewState && (
          <Modal
            title={previewState.title || 'Preview Dokumen'}
            onClose={() => { setPreviewState(null); }}
          >
            {previewLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Menyiapkan preview…
              </div>
            ) : (
              <div className="space-y-3">
                {previewState.embedUrl ? (
                  <div className="h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                    <iframe
                      title="Document preview"
                      src={previewState.embedUrl}
                      className="h-full w-full"
                    />
                  </div>
                ) : (
                  <div className="flex h-[40vh] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 text-center">
                    <FileText className="h-10 w-10 text-slate-300" aria-hidden />
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-700">Preview belum tersedia</p>
                      <p className="text-sm text-slate-500">
                        {previewState.note ?? 'File ini tidak bisa dipreview langsung di browser.'}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <a
                    href={previewState.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <Eye className="h-4 w-4" />
                    Buka di tab baru
                  </a>
                  <a
                    href={previewState.sourceUrl}
                    download={previewState.title}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700"
                  >
                    <Download className="h-4 w-4" />
                    Unduh dokumen
                  </a>
                </div>
              </div>
            )}
          </Modal>
        )}

        {findingsDoc && (
          <Modal
            title={`Detail Temuan • ${findingsDoc.filename}`}
            onClose={() => setFindingsDoc(null)}
            scrollable
            headerAccessory={
              <button
                type="button"
                onClick={() => void handleCopyFindingsText()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                title="Salin ringkasan & temuan ke clipboard"
              >
                {findingsCopyState === 'ok' ? (
                  <><Check className="h-4 w-4 text-emerald-600" aria-hidden />Tersalin</>
                ) : (
                  <><Copy className="h-4 w-4" aria-hidden />Salin</>
                )}
              </button>
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                Ringkasan dan daftar temuan bisa disalin untuk tempel ke WhatsApp atau aplikasi lain.
              </p>
              {findingsCopyState === 'fail' ? (
                <p className="text-xs text-red-600">
                  Gagal menyalin (izin clipboard atau konteks tidak aman). Coba lagi.
                </p>
              ) : null}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap gap-3">
                  <span>Typo: <strong className="text-red-700">{findingsDoc.typoCount}</strong></span>
                  <span>Ambigu: <strong className="text-amber-700">{findingsDoc.ambiguousCount}</strong></span>
                  <span className="text-slate-400">Status: {findingsDoc.status}</span>
                </div>
                {findingsDoc.analysisError ? (
                  <p className="mt-2 text-xs text-red-700">Error analisa: {findingsDoc.analysisError}</p>
                ) : findingsDoc.aiReview?.summary ? (
                  <p className="mt-2 text-xs text-slate-600">Ringkasan: {findingsDoc.aiReview.summary}</p>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">
                    Belum ada hasil analisa tersimpan. Jalankan ulang upload atau tunggu proses analisa.
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {(findingsDoc.aiReview?.findings ?? []).length ? (
                  findingsDoc.aiReview!.findings.map((f, idx) => (
                    <div key={`${f.kind}-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800">
                            Temuan #{idx + 1} &bull; {f.kind === 'typo' ? 'Typo' : 'Ambigu'}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            Lokasi: {f.locationHint} &bull; Severity: {f.severity}
                            {typeof f.confidence === 'number' ? ` · Confidence: ${f.confidence.toFixed(2)}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">AI</span>
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <p className="text-xs font-semibold text-slate-600">Teks Asli</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-700">{f.originalText}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                          <p className="text-xs font-semibold text-emerald-800">Saran Perbaikan</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-800">{f.suggestedText}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-800">Penjelasan</p>
                        <p className="mt-1 text-xs text-blue-800">{f.explanation}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center text-sm text-slate-400">
                    Tidak ada daftar temuan tersimpan untuk dokumen ini.
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}

        {showEditModal && (
          <Modal onClose={() => setShowEditModal(false)} title="Edit Dokumen">
            <form className="space-y-4" onSubmit={handleUpdateDocument}>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  { label: 'Nama Dokumen', field: 'filename' as const, type: 'text', required: true },
                  { label: 'Jenis', field: 'fileType' as const, type: 'text', required: true },
                  { label: 'Ukuran (byte)', field: 'fileSize' as const, type: 'number' },
                  { label: 'Path Penyimpanan', field: 'storagePath' as const, type: 'text' },
                  { label: 'Jumlah Typo', field: 'typoCount' as const, type: 'number' },
                  { label: 'Jumlah Ambigu', field: 'ambiguousCount' as const, type: 'number' },
                ].map(({ label, field, type, required }) => (
                  <div key={field}>
                    <label className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</label>
                    <input
                      type={type}
                      min={type === 'number' ? 0 : undefined}
                      required={required}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                      value={editForm[field]}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, [field]: e.target.value }))}
                    />
                  </div>
                ))}
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600">Status</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as DocumentStatus }))}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
                  onClick={() => setShowEditModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Menyimpan…' : 'Perbarui'}
                </button>
              </div>
            </form>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DocumentReview;

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scrollable?: boolean;
  headerAccessory?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, scrollable, headerAccessory }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center bg-black/40 p-4 backdrop-blur-sm ${
        scrollable ? 'items-start overflow-y-auto pt-6 sm:items-center sm:py-6' : 'items-center overflow-y-auto'
      }`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        className={
          scrollable
            ? 'my-auto flex max-h-[min(92dvh,56rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5'
            : 'w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5'
        }
        initial={{ scale: 0.96, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.96, y: 16 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={
            scrollable
              ? 'flex shrink-0 items-center gap-3 border-b border-slate-100 px-5 py-4'
              : 'mb-5 flex items-center justify-between gap-3'
          }
        >
          <h3
            className={
              scrollable
                ? 'min-w-0 flex-1 truncate text-base font-bold text-slate-800'
                : 'text-lg font-bold text-slate-800'
            }
          >
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerAccessory}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {scrollable ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>
        ) : (
          children
        )}
      </motion.div>
    </motion.div>
  );
};
