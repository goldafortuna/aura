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

const statusOptions: { label: string; value: DocumentStatus; badge: string }[] = [
  { label: 'Memproses', value: 'processing', badge: 'bg-warning/10 text-orange-700' },
  { label: 'Direview', value: 'reviewed', badge: 'bg-success/10 text-green-700' },
  { label: 'Perlu Revisi', value: 'error', badge: 'bg-error/10 text-red-700' },
];

const bytesToSize = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState<string>('');
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

  const fetchDocuments = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (!silent) {
        setLoading(true);
        setError(null);
      }

      const res = await fetch('/api/documents', { cache: 'no-store' });
      if (!res.ok) {
        throw new Error(await readApiErrorMessage(res, 'Gagal memuat dokumen'));
      }

      const json = (await res.json()) as { data: ApiDocument[] };
      setDocuments(mapApiDocumentsToUi(json));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const loadAiProviders = useCallback(async () => {
    setAiProvidersLoading(true);
    try {
      const res = await fetch('/api/ai/providers', { cache: 'no-store' });
      if (!res.ok) {
        setAiProviders([]);
        return;
      }
      const json = (await res.json()) as { data: AiProviderListItem[] };
      setAiProviders(json.data ?? []);
    } catch {
      setAiProviders([]);
    } finally {
      setAiProvidersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAiProviders();
  }, [loadAiProviders]);

  useEffect(() => {
    let cancelled = false;

    const loadStorageInfo = async () => {
      try {
        const res = await fetch('/api/storage/provider', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { data?: StorageInfo };
        if (!cancelled && json.data) {
          setStorageInfo(json.data);
        }
      } catch {
        // Keep indicator hidden when storage info is unavailable.
      }
    };

    void loadStorageInfo();
    return () => {
      cancelled = true;
    };
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
          d.id === docId
            ? {
                ...d,
                status: 'processing',
                analysisError: null,
                typoCount: 0,
                ambiguousCount: 0,
                aiReview: null,
              }
            : d,
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
      setAnalyzingDocIds((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }
  };

  useEffect(() => {
    setFindingsCopyState('idle');
  }, [findingsDoc?.id]);

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
      window.setTimeout(() => {
        setRowCopyDocId((prev) => (prev === doc.id ? null : prev));
      }, 2000);
    } catch {
      setError('Gagal menyalin ke clipboard. Coba lagi atau salin dari modal detail.');
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
          if (!cancelled && syncRes.ok) {
            setBatchInfo(null);
            await fetchDocuments();
          }
        }
      } finally {
        if (!cancelled) setBatchSyncing(false);
      }
    };

    void tick();
    const interval = window.setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [batchInfo?.batchId, batchSyncing, fetchDocuments]);

  const hasProcessingDocuments = useMemo(
    () => documents.some((d) => d.status === 'processing'),
    [documents],
  );

  useEffect(() => {
    if (!hasProcessingDocuments) return;

    const id = window.setInterval(() => {
      void fetchDocuments({ silent: true });
    }, 8000);

    return () => window.clearInterval(id);
  }, [hasProcessingDocuments, fetchDocuments]);

  const stats = useMemo(() => {
    const total = documents.length;
    const reviewed = documents.filter((doc) => doc.status === 'reviewed').length;
    const findings = documents.reduce(
      (acc, doc) => acc + doc.typoCount + doc.ambiguousCount,
      0,
    );
    return { total, reviewed, findings };
  }, [documents]);

  /** Jalankan review AI setelah baris dokumen sudah ada (status memproses di UI). */
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
        if (batchId) {
          setBatchInfo({ batchId, status: json.data?.processingStatus ?? 'in_progress' });
        }
      } else {
        for (const docId of createdIds) {
          const analyzeRes = await fetch(`/api/documents/${docId}/analyze`, { method: 'POST' });
          if (!analyzeRes.ok) {
            throw new Error(await readApiErrorMessage(analyzeRes, 'Gagal menjalankan review AI'));
          }
        }
      }
    } else {
      const analyzeRes = await fetch(`/api/documents/${createdIds[0]}/analyze`, { method: 'POST' });
      if (!analyzeRes.ok) {
        throw new Error(await readApiErrorMessage(analyzeRes, 'Gagal menjalankan review AI'));
      }
    }
  };

  const uploadAndCreateDocuments = async (files: FileList | File[]) => {
    const list = Array.from(files ?? []);
    if (list.length === 0) return;

    if (list.length > 5) {
      setError('Maksimal 5 dokumen per upload.');
      return;
    }

    const tooLarge = list.find((f) => f.size > 10 * 1024 * 1024);
    if (tooLarge) {
      setError(`File terlalu besar: ${tooLarge.name}. Maks 10MB.`);
      return;
    }

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
        try {
          uploadJson = JSON.parse(rawBody) as unknown;
        } catch {
          throw new Error(`Gagal upload dokumen (HTTP ${uploadRes.status}). Respons bukan JSON.`);
        }
      }

      if (!uploadRes.ok) {
        const errMsg =
          uploadJson && typeof uploadJson === 'object' && 'error' in uploadJson
            ? String((uploadJson as { error?: unknown }).error ?? '')
            : '';
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
          body: JSON.stringify({
            filename: u.filename,
            fileType: u.fileType,
            fileSize: u.fileSize,
            storagePath: u.storagePath,
            status: 'processing',
            typoCount: 0,
            ambiguousCount: 0,
          }),
        });
        if (!res.ok) {
          throw new Error(await readApiErrorMessage(res, 'Gagal menyimpan metadata dokumen'));
        }

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
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void uploadAndCreateDocuments(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleOpenEdit = (doc: Document) => {
    setEditingId(doc.id);
    setEditForm({
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: String(doc.fileSize),
      storagePath: doc.storagePath,
      status: doc.status,
      typoCount: String(doc.typoCount),
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
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    if (!res.ok || !json.data?.url) {
      throw new Error(json.error || 'Gagal membuat link file.');
    }
    return json.data.url;
  };

  const handlePreview = async (doc: Document) => {
    try {
      setPreviewLoading(true);
      setError(null);
      const url = await fetchSignedUrl(doc.id);
      setPreviewTitle(doc.filename);
      setPreviewUrl(url);
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
      a.href = url;
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.download = doc.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  };

  const openFindings = (doc: Document) => {
    setFindingsDoc(doc);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Review Dokumen</h1>
          <p className="text-gray-500">
            Upload dan review dokumen dengan bantuan AI untuk deteksi typo dan kalimat ambigu.
          </p>
          {storageInfo ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold uppercase tracking-wide text-gray-500">Storage aktif</span>
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 font-semibold ${storageProviderBadgeClass(storageInfo.provider)}`}
              >
                {storageProviderLabel(storageInfo.provider)}
              </span>
              {storageInfo.bucket ? (
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 font-medium text-gray-600">
                  Bucket: {storageInfo.bucket}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">Model</span>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative inline-flex items-center">
                <select
                  className="max-w-[min(100vw-4rem,280px)] cursor-pointer appearance-none rounded-xl border border-gray-200 bg-white py-2 pl-3 pr-9 text-xs font-semibold text-gray-800 shadow-sm outline-none transition-colors hover:border-gray-300 focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-60"
                  value={activeProviderId}
                  onChange={(e) => void handleActivateProvider(e.target.value)}
                  disabled={aiProvidersLoading || providerActivating || aiProviders.length === 0}
                  aria-label="Pilih model AI aktif"
                >
                  {aiProvidersLoading ? (
                    <option value="">Memuat…</option>
                  ) : (
                    <>
                      <option value="" disabled={Boolean(activeProviderId)}>
                        Pilih model aktif
                      </option>
                      {aiProviders.map((p) => (
                        <option key={p.provider} value={p.provider} disabled={!p.hasApiKey}>
                          {shortModelLabel(p)}
                          {!p.hasApiKey ? ' (API key belum diset)' : ''}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {providerActivating ? (
                  <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-gray-500" aria-hidden />
                ) : null}
              </div>
            </div>
            {!aiProvidersLoading && !aiProviders.some((p) => p.hasApiKey) ? (
              <p className="text-xs text-orange-700">Belum ada API key. Buka halaman Pengaturan dari menu untuk mengisi provider.</p>
            ) : null}
          </div>
          <button
            onClick={() => {
              fileInputRef.current?.click();
            }}
            disabled={uploading}
            className="flex items-center gap-2 rounded-xl border border-primary-700/30 bg-primary-600 px-5 py-2.5 font-semibold text-white shadow-md ring-1 ring-black/5 transition-all hover:bg-primary-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Upload className="h-5 w-5" />
            {uploading ? 'Mengupload...' : 'Tambah Dokumen'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {batchInfo ? (
        <div className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
          Review sedang diproses via <strong>Anthropic Batch</strong>. Batch ID: <span className="font-mono">{batchInfo.batchId}</span>.
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-200"
              onClick={async () => {
                try {
                  const res = await fetch(`/api/ai/batches/${batchInfo.batchId}`, { cache: 'no-store' });
                  if (res.ok) {
                    const json = (await res.json()) as { data?: { processingStatus?: string } };
                    const st = json.data?.processingStatus ?? 'in_progress';
                    setBatchInfo((prev) => (prev ? { ...prev, status: st } : prev));
                    if (st === 'ended') {
                      const syncRes = await fetch(`/api/ai/batches/${batchInfo.batchId}/sync`, { method: 'POST' });
                      if (syncRes.ok) {
                        setBatchInfo(null);
                        await fetchDocuments();
                      }
                    }
                  }
                } catch {
                  // ignore
                }
              }}
            >
              Cek status batch ({batchInfo.status})
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-700 hover:bg-primary/20"
              onClick={async () => {
                const res = await fetch(`/api/ai/batches/${batchInfo.batchId}/sync`, { method: 'POST' });
                if (res.ok) {
                  setBatchInfo(null);
                  await fetchDocuments();
                }
              }}
            >
              Sinkronkan hasil
            </button>
          </div>
        </div>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`rounded-2xl border-2 border-dashed p-12 text-center transition-all ${
          isDragging ? 'border-primary-500 bg-primary/5' : 'border-gray-300 bg-gradient-to-br from-primary/5 to-secondary/5'
        }`}
      >
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20">
          <Upload className="h-8 w-8 text-primary-600" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-gray-800">Drag & Drop atau Klik untuk Upload</h3>
        <p className="mb-4 text-sm text-gray-500">
          Mendukung PDF, DOCX • Maksimal 10MB per file • Upload hingga 5 dokumen sekaligus
        </p>
        <button
          onClick={() => {
            fileInputRef.current?.click();
          }}
          disabled={uploading}
          className="rounded-xl border border-gray-300 bg-white px-6 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {uploading ? 'Mengupload...' : 'Pilih File'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void uploadAndCreateDocuments(e.target.files);
          }}
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          {
            icon: FileText,
            value: loading ? '—' : stats.total,
            label: 'Total Dokumen',
            bg: 'bg-primary/10',
            text: 'text-primary-600',
          },
          {
            icon: CheckCircle,
            value: loading ? '—' : stats.reviewed,
            label: 'Sudah Direview',
            bg: 'bg-success/10',
            text: 'text-green-600',
          },
          {
            icon: AlertTriangle,
            value: loading ? '—' : stats.findings,
            label: 'Total Temuan',
            bg: 'bg-warning/10',
            text: 'text-orange-600',
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${item.bg}`}>
                  <Icon className={`h-6 w-6 ${item.text}`} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800">{item.value}</h3>
                  <p className="text-sm text-gray-500">{item.label}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {loading ? (
        <div className="text-sm text-gray-500">Memuat dokumen...</div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        >
          <div className="border-b border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-800">Dokumen Terbaru</h2>
          </div>

          <div className="divide-y divide-gray-200">
            {documents.map((doc, index) => {
              const isRetrying = Boolean(analyzingDocIds[doc.id]);
              const effectiveStatus: DocumentStatus = isRetrying ? 'processing' : doc.status;
              const statusMeta =
                statusOptions.find((item) => item.value === effectiveStatus) ?? statusOptions[0];
              return (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 transition-colors hover:bg-gray-50"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20">
                        <FileText className="h-6 w-6 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-800">{doc.filename}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-500">
                          <span>{doc.fileType}</span>
                          <span>•</span>
                          <span>{doc.sizeLabel}</span>
                          <span>•</span>
                          <span>{formatDate(doc.uploadDate)}</span>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <button
                            type="button"
                            onClick={() => openFindings(doc)}
                            className="rounded-lg px-2 py-1 text-left hover:bg-gray-100"
                            title="Lihat detail temuan"
                          >
                            Typo:{' '}
                            <strong className="text-error-600">{doc.typoCount}</strong>
                          </button>
                          <button
                            type="button"
                            onClick={() => openFindings(doc)}
                            className="rounded-lg px-2 py-1 text-left hover:bg-gray-100"
                            title="Lihat detail temuan"
                          >
                            Ambigu:{' '}
                            <strong className="text-warning-700">{doc.ambiguousCount}</strong>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleCopyRowFindings(doc)}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                            title="Salin ringkasan & temuan (mis. untuk WhatsApp)"
                          >
                            {rowCopyDocId === doc.id ? (
                              <>
                                <Check className="h-3.5 w-3.5 text-green-600" aria-hidden />
                                Tersalin
                              </>
                            ) : (
                              <>
                                <Copy className="h-3.5 w-3.5" aria-hidden />
                                Salin
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <span className={`rounded-lg px-3 py-1 text-xs font-medium ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                      <div className="flex items-center gap-2">
                        {doc.status === 'error' ? (
                          <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => void handleRetryAnalyze(doc.id)}
                            disabled={isRetrying}
                            className="inline-flex items-center gap-2 rounded-lg bg-error/10 px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-60"
                            title={doc.analysisError ? `Error: ${doc.analysisError}` : 'Review ulang'}
                          >
                            {isRetrying ? (
                              <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Memproses…
                              </>
                            ) : (
                              'Review ulang'
                            )}
                          </motion.button>
                        ) : null}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => void handlePreview(doc)}
                          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-primary/10"
                          title="Lihat"
                        >
                          <Eye className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => void handleDownload(doc)}
                          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-primary/10"
                          title="Unduh"
                        >
                          <Download className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => handleOpenEdit(doc)}
                          className="rounded-lg p-2 text-gray-600 transition-colors hover:bg-primary/10"
                          title="Edit"
                        >
                          <Pencil className="h-5 w-5" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => void handleDeleteDocument(doc.id)}
                          className="rounded-lg p-2 text-red-600 transition-colors hover:bg-error/10"
                          title="Hapus"
                        >
                          <Trash2 className="h-5 w-5" />
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {documents.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-400">Belum ada dokumen.</div>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {previewUrl && (
          <Modal
            title={previewTitle || 'Preview Dokumen'}
            onClose={() => {
              setPreviewUrl(null);
              setPreviewTitle('');
            }}
          >
            {previewLoading ? (
              <div className="text-sm text-gray-600">Menyiapkan preview...</div>
            ) : (
              <div className="h-[70vh] overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                <iframe title="Document preview" src={previewUrl} className="h-full w-full" />
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
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
                title="Salin ringkasan & temuan ke clipboard"
              >
                {findingsCopyState === 'ok' ? (
                  <>
                    <Check className="h-4 w-4 text-green-600" aria-hidden />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" aria-hidden />
                    Salin
                  </>
                )}
              </button>
            }
          >
            <div className="space-y-4">
              <p className="text-xs text-gray-500">
                Ringkasan dan daftar temuan bisa disalin (tombol di atas) untuk tempel ke WhatsApp atau aplikasi lain.
              </p>
              {findingsCopyState === 'fail' ? (
                <p className="text-xs text-red-600">
                  Gagal menyalin (izin clipboard atau konteks tidak aman). Gunakan tombol Salin di daftar dokumen atau coba lagi.
                </p>
              ) : null}
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
                <div className="flex flex-wrap gap-3">
                  <span>
                    Typo: <strong className="text-red-700">{findingsDoc.typoCount}</strong>
                  </span>
                  <span>
                    Ambigu: <strong className="text-orange-700">{findingsDoc.ambiguousCount}</strong>
                  </span>
                  <span className="text-gray-500">Status: {findingsDoc.status}</span>
                </div>
                {findingsDoc.analysisError ? (
                  <p className="mt-2 text-xs text-red-700">Error analisa: {findingsDoc.analysisError}</p>
                ) : findingsDoc.aiReview?.summary ? (
                  <p className="mt-2 text-xs text-gray-600">Ringkasan: {findingsDoc.aiReview.summary}</p>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">
                    Belum ada hasil analisa tersimpan untuk dokumen ini (jalankan ulang upload atau tunggu proses analisa).
                  </p>
                )}
              </div>

              <div className="space-y-3">
                {(findingsDoc.aiReview?.findings ?? []).length ? (
                  findingsDoc.aiReview!.findings.map((f, idx) => (
                    <div key={`${f.kind}-${idx}`} className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">
                            Temuan #{idx + 1} • {f.kind === 'typo' ? 'Typo' : 'Ambigu'}
                          </p>
                          <p className="mt-1 text-xs text-gray-600">
                            Lokasi: {f.locationHint} • Severity: {f.severity}
                            {typeof f.confidence === 'number' ? ` • Confidence: ${f.confidence.toFixed(2)}` : ''}
                          </p>
                        </div>
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                          AI
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <p className="text-xs font-semibold text-gray-700">Teks Asli</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">{f.originalText}</p>
                        </div>
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                          <p className="text-xs font-semibold text-green-800">Saran Perbaikan</p>
                          <p className="mt-1 whitespace-pre-wrap text-xs text-green-800">{f.suggestedText}</p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                        <p className="text-xs font-semibold text-blue-900">Penjelasan</p>
                        <p className="mt-1 text-xs text-blue-900">{f.explanation}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-600">
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
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Nama Dokumen</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.filename}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, filename: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Jenis</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.fileType}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fileType: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ukuran (byte)</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.fileSize}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, fileSize: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Path Penyimpanan</label>
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.storagePath}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, storagePath: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.status}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value as DocumentStatus }))}
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Typo</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.typoCount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, typoCount: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ambigu</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={editForm.ambiguousCount}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, ambiguousCount: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
                  onClick={() => setShowEditModal(false)}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? 'Menyimpan...' : 'Perbarui'}
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
  /** Panel dibatasi tinggi viewport; konten di bawah header di-scroll. */
  scrollable?: boolean;
  /** Tombol/aksi di header (mis. Salin), tetap terlihat bersama judul & tutup. */
  headerAccessory?: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ title, onClose, children, scrollable, headerAccessory }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <motion.div
      className={`fixed inset-0 z-50 flex justify-center bg-black/50 p-4 ${
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
            ? 'my-auto flex w-full max-w-2xl max-h-[min(92dvh,56rem)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl'
            : 'w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl'
        }
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={
            scrollable
              ? 'flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-5 sm:py-4'
              : 'mb-6 flex items-center justify-between gap-3'
          }
        >
          <h3
            className={
              scrollable
                ? 'min-w-0 flex-1 truncate text-left text-base font-bold text-gray-800 sm:text-lg'
                : 'pr-2 text-xl font-bold text-gray-800'
            }
          >
            {title}
          </h3>
          <div className="flex shrink-0 items-center gap-2">
            {headerAccessory}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-100"
              aria-label="Tutup"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {scrollable ? (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">{children}</div>
        ) : (
          children
        )}
      </motion.div>
    </motion.div>
  );
};
