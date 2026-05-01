import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CheckSquare,
  Clock,
  FileText,
  Filter,
  Flag,
  Inbox,
  ListChecks,
  ListTodo,
  Loader2,
  Mail,
  Paperclip,
  Pencil,
  Plus,
  Search,
  Send,
  Trash2,
  TrendingUp,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type TaskStatus = 'todo' | 'in-progress' | 'completed';
type TaskPriority = 'high' | 'medium' | 'low';
type TaskKind = 'general' | 'travel-accountability';
type ToastType = 'success' | 'error';

type ApiAttachment = {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  storagePath: string;
  downloadUrl: string;
  createdAt: string;
};

type ApiChecklistItem = {
  id: string;
  label: string;
  isRequired: boolean;
  sortOrder: number;
  isCompleted: boolean;
  attachments: ApiAttachment[];
};

type ApiTask = {
  id: string;
  title: string;
  description: string | null;
  kind: TaskKind;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  financePicEmail: string | null;
  financeEmailSentAt: string | null;
  checklistItems: ApiChecklistItem[];
  checklistSummary: {
    requiredCount: number;
    completedRequiredCount: number;
    isComplete: boolean;
    totalAttachmentCount: number;
    hasAnyDocument: boolean;
  };
};

type TaskFormState = {
  title: string;
  description: string;
  kind: TaskKind;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
  financePicEmail: string;
};

type Toast = {
  id: string;
  type: ToastType;
  message: string;
};

type AutoDetectMatch = {
  filename: string;
  checklistLabel: string;
  via: 'content' | 'ocr' | 'filename';
};

const emptyForm: TaskFormState = {
  title: '',
  description: '',
  kind: 'general',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
  financePicEmail: '',
};

const STATUS_COLUMNS: {
  id: TaskStatus;
  label: string;
  dot: string;
  bg: string;
  ring: string;
  emptyHint: string;
}[] = [
  {
    id: 'todo',
    label: 'Belum Dikerjakan',
    dot: 'bg-slate-400',
    bg: 'bg-slate-50',
    ring: 'ring-slate-300',
    emptyHint: 'Belum ada tugas di sini',
  },
  {
    id: 'in-progress',
    label: 'Sedang Dikerjakan',
    dot: 'bg-amber-400',
    bg: 'bg-amber-50',
    ring: 'ring-amber-300',
    emptyHint: 'Tidak ada tugas yang sedang berjalan',
  },
  {
    id: 'completed',
    label: 'Selesai',
    dot: 'bg-green-400',
    bg: 'bg-green-50',
    ring: 'ring-green-300',
    emptyHint: 'Belum ada tugas selesai',
  },
];

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; badge: string }> = {
  high: { label: 'Tinggi', badge: 'bg-red-100 text-red-700' },
  medium: { label: 'Sedang', badge: 'bg-amber-100 text-amber-700' },
  low: { label: 'Rendah', badge: 'bg-green-100 text-green-700' },
};

const AUTO_DETECT_VIA_CONFIG: Record<AutoDetectMatch['via'], { label: string; badge: string; hint: string }> = {
  content: {
    label: 'Teks dokumen',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    hint: 'Paling kuat untuk PDF/DOC/DOCX berbasis teks.',
  },
  ocr: {
    label: 'OCR scan',
    badge: 'border-sky-200 bg-sky-50 text-sky-700',
    hint: 'Dipakai untuk gambar atau PDF scan yang tidak punya teks bawaan.',
  },
  filename: {
    label: 'Nama file',
    badge: 'border-amber-200 bg-amber-50 text-amber-700',
    hint: 'Perlu dicek ulang jika nama file kurang jelas.',
  },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return dateStr;
  }
}

function toDatetimeLocalValue(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isOverdue(dateStr: string | null, status: TaskStatus): boolean {
  if (!dateStr || status === 'completed') return false;
  const due = new Date(dateStr);
  if (Number.isNaN(due.getTime())) return false;
  return due < new Date();
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isPreviewableImage(fileType: string) {
  return fileType.startsWith('image/');
}

function isPreviewablePdf(fileType: string, filename: string) {
  return fileType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf');
}

function clampPreviewZoom(value: number) {
  return Math.min(200, Math.max(50, value));
}

function kindLabel(kind: TaskKind) {
  return kind === 'travel-accountability' ? 'Perjadin' : 'Umum';
}

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((item) => item.id !== id)), 3200);
  };

  return { toasts, push };
}

async function readApiErrorMessage(res: Response, fallback: string) {
  const text = await res.text();
  if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
  try {
    const json = JSON.parse(text) as { error?: unknown };
    return typeof json.error === 'string' ? json.error : `${fallback} (HTTP ${res.status})`;
  } catch {
    return `${fallback} (HTTP ${res.status})`;
  }
}

function SkeletonCard() {
  return (
    <div className="animate-pulse space-y-2.5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="h-3.5 w-3/4 rounded-lg bg-gray-100" />
      <div className="h-3 w-full rounded-lg bg-gray-100" />
      <div className="h-3 w-1/2 rounded-lg bg-gray-100" />
      <div className="mt-2 flex gap-2">
        <div className="h-5 w-14 rounded-full bg-gray-100" />
        <div className="h-5 w-20 rounded-full bg-gray-100" />
      </div>
    </div>
  );
}

type TaskCardProps = {
  task: ApiTask;
  onEdit: (task: ApiTask) => void;
  onManageDocuments: (task: ApiTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
};

function TaskCard({ task, onEdit, onManageDocuments, onDelete, onStatusChange, draggingId, setDraggingId }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  const { label: priorityLabel, badge: priorityBadge } = PRIORITY_CONFIG[task.priority];
  const formattedDate = formatDate(task.dueDate);
  const isDone = task.status === 'completed';
  const isTravelTask = task.kind === 'travel-accountability';

  return (
    <motion.div
      layout
      whileHover={{ y: -2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition-opacity duration-150 ${
        draggingId === task.id ? 'opacity-50 ring-2 ring-primary/30' : ''
      } ${isDone ? 'border-green-100' : 'border-gray-200'}`}
      draggable
      onDragStart={(e) => {
        const event = e as unknown as React.DragEvent<HTMLDivElement>;
        event.dataTransfer.setData('text/task-id', task.id);
        event.dataTransfer.effectAllowed = 'move';
        setDraggingId(task.id);
      }}
      onDragEnd={() => setDraggingId(null)}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={() => onStatusChange(task.id, isDone ? 'todo' : 'completed')}
          className={`mt-0.5 shrink-0 rounded-full transition-colors duration-150 ${
            isDone ? 'text-green-500 hover:text-gray-300' : 'text-gray-200 hover:text-green-500'
          }`}
          aria-label={isDone ? 'Batal selesai' : 'Tandai selesai'}
        >
          <CheckCircle2 className="h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`text-sm font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
              {task.title}
            </p>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {kindLabel(task.kind)}
            </span>
          </div>
          {task.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{task.description}</p>
          ) : null}
          {isTravelTask ? (
              <div className="mt-2 rounded-xl border border-sky-100 bg-sky-50/80 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-sky-800">
                    {task.checklistSummary.totalAttachmentCount} dokumen
                  </span>
                  <span className={task.checklistSummary.hasAnyDocument ? 'font-semibold text-green-700' : 'text-sky-700'}>
                    {task.checklistSummary.hasAnyDocument ? 'Siap dikirim jika perlu' : 'Belum ada dokumen'}
                  </span>
                </div>
              {task.financePicEmail ? (
                <p className="mt-1 truncate text-[11px] text-sky-700">PIC keuangan: {task.financePicEmail}</p>
              ) : (
                <p className="mt-1 text-[11px] text-amber-700">Email PIC keuangan belum diisi</p>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {isTravelTask ? (
            <button
              type="button"
              onClick={() => onManageDocuments(task)}
              className="rounded-lg p-1.5 text-gray-400 hover:bg-sky-50 hover:text-sky-700"
              aria-label="Kelola dokumen"
            >
              <Paperclip className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Edit tugas"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(task.id)}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Hapus tugas"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityBadge}`}>{priorityLabel}</span>
        {formattedDate ? (
          <span className={`flex items-center gap-1 text-xs ${overdue ? 'font-semibold text-red-600' : 'text-gray-400'}`}>
            {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {overdue ? `Terlambat · ${formattedDate}` : formattedDate}
          </span>
        ) : null}
        {task.financeEmailSentAt ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
            <Send className="h-3 w-3" />
            Terkirim ke keuangan
          </span>
        ) : null}
      </div>

      {isTravelTask ? (
        <button
          type="button"
          onClick={() => onManageDocuments(task)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-100"
        >
          <Paperclip className="h-4 w-4" />
          Kelola Dokumen
        </button>
      ) : null}
    </motion.div>
  );
}

type KanbanColumnProps = {
  col: (typeof STATUS_COLUMNS)[number];
  tasks: ApiTask[];
  onEdit: (task: ApiTask) => void;
  onManageDocuments: (task: ApiTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAdd: (status: TaskStatus) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dropTarget: TaskStatus | null;
  setDropTarget: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
};

function KanbanColumn({
  col,
  tasks,
  onEdit,
  onManageDocuments,
  onDelete,
  onStatusChange,
  onAdd,
  draggingId,
  setDraggingId,
  dropTarget,
  setDropTarget,
}: KanbanColumnProps) {
  const isTarget = dropTarget === col.id;

  return (
    <div
      className={`flex min-h-[220px] min-w-[272px] flex-col rounded-2xl transition-all duration-150 lg:min-w-0 ${col.bg} ${
        isTarget ? `ring-2 ${col.ring}` : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDropTarget(col.id);
      }}
      onDragLeave={() => setDropTarget((current) => (current === col.id ? null : current))}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/task-id');
        setDropTarget(null);
        setDraggingId(null);
        if (id) onStatusChange(id, col.id);
      }}
    >
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
          <span className="text-sm font-semibold text-gray-800">{col.label}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-gray-500 shadow-sm">{tasks.length}</span>
        </div>
        <button
          type="button"
          onClick={() => onAdd(col.id)}
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white hover:text-gray-700"
          aria-label={`Tambah tugas di ${col.label}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-col gap-3 px-3 pb-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onManageDocuments={onManageDocuments}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
          />
        ))}

        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/40 px-4 py-8 text-center">
            <span className="text-xs text-gray-400">{draggingId ? 'Lepaskan di sini' : col.emptyHint}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

type TaskModalProps = {
  mode: 'create' | 'edit';
  open: boolean;
  form: TaskFormState;
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  task: ApiTask | null;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitting: boolean;
  onOpenDocuments: () => void;
};

function TaskModal({
  mode,
  open,
  form,
  setForm,
  task,
  onSubmit,
  onClose,
  submitting,
  onOpenDocuments,
}: TaskModalProps) {
  const isTravelTask = form.kind === 'travel-accountability';

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ y: 32, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 32, opacity: 0, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h2 className="font-semibold text-gray-900">{mode === 'create' ? 'Tambah Tugas Baru' : 'Edit Tugas'}</h2>
                <p className="mt-1 text-xs text-gray-500">
                  {isTravelTask
                    ? 'Mode pertanggungjawaban perjalanan dinas dengan seluruh dokumen bersifat opsional.'
                    : 'Gunakan untuk task umum tanpa checklist dokumen khusus.'}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[85vh] overflow-y-auto">
              <form onSubmit={onSubmit} className="space-y-5 px-6 py-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">Judul Tugas *</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      placeholder="Contoh: Pertanggungjawaban perjalanan dinas ke Jakarta"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">Jenis Tugas</label>
                    <select
                      value={form.kind}
                      onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as TaskKind }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="general">Tugas umum</option>
                      <option value="travel-accountability">Pertanggungjawaban perjalanan dinas</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                    Deskripsi <span className="font-normal text-gray-400">(opsional)</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="Tambahkan detail atau catatan..."
                    rows={3}
                    className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">Prioritas</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as TaskPriority }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="high">Tinggi</option>
                      <option value="medium">Sedang</option>
                      <option value="low">Rendah</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as TaskStatus }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="todo">Belum Dikerjakan</option>
                      <option value="in-progress">Sedang Dikerjakan</option>
                      <option value="completed">Selesai</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                      Tenggat Waktu <span className="font-normal text-gray-400">(opsional)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={form.dueDate}
                      onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                {isTravelTask ? (
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-sky-700" />
                      <p className="text-sm font-semibold text-sky-900">PIC Keuangan</p>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-sky-800">
                      Task akan disimpan lebih dulu seperti task biasa. Setelah itu, user bisa membuka kembali task ini
                      untuk mengelola checklist dokumen dan upload bertahap melalui menu <strong>Kelola Dokumen</strong>.
                    </p>
                    <div className="mt-4">
                      <label className="mb-1.5 block text-xs font-semibold text-gray-600">Email PIC Keuangan *</label>
                      <input
                        type="email"
                        value={form.financePicEmail}
                        onChange={(e) => setForm((prev) => ({ ...prev, financePicEmail: e.target.value }))}
                        placeholder="keuangan@unit.ac.id"
                        className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <div className="mt-4 rounded-xl border border-dashed border-sky-200 bg-white/70 px-4 py-4 text-sm text-sky-800">
                      Checklist default akan dibuat untuk Surat Tugas, E-Ticket, Invoice, Boarding Pass, SPPD/Laporan
                      Perjalanan Dinas, dan Voucher/Invoice Hotel. Semua kategori bersifat opsional, setiap kategori
                      dapat diisi lebih dari satu dokumen, dan upload bisa dilakukan bertahap dari detail task.
                    </div>
                    {mode === 'edit' && task ? (
                      <button
                        type="button"
                        onClick={onOpenDocuments}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-4 py-2.5 text-sm font-semibold text-sky-800 transition-colors hover:bg-sky-50"
                      >
                        <Paperclip className="h-4 w-4" />
                        Buka Kelola Dokumen
                      </button>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Tutup
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {submitting ? 'Menyimpan...' : mode === 'create' ? 'Simpan Tugas' : 'Simpan Perubahan'}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

type DocumentManagerModalProps = {
  open: boolean;
  task: ApiTask | null;
  onClose: () => void;
  onUploadFiles: (checklistItemId: string, files: FileList | File[] | null) => void;
  onAutoUploadFiles: (files: FileList | File[] | null) => void;
  onMoveAttachment: (attachmentId: string, checklistItemId: string) => void;
  onDeleteAttachment: (attachmentId: string) => void;
  deletingAttachmentId: string | null;
  movingAttachmentId: string | null;
  uploadingChecklistId: string | null;
  autoClassifying: boolean;
  autoDetectSummary: string | null;
  autoDetectMatches: AutoDetectMatch[];
  autoDetectUnmatched: string[];
  onSendToFinance: () => void;
  sendingToFinance: boolean;
};

function DocumentManagerModal({
  open,
  task,
  onClose,
  onUploadFiles,
  onAutoUploadFiles,
  onMoveAttachment,
  onDeleteAttachment,
  deletingAttachmentId,
  movingAttachmentId,
  uploadingChecklistId,
  autoClassifying,
  autoDetectSummary,
  autoDetectMatches,
  autoDetectUnmatched,
  onSendToFinance,
  sendingToFinance,
}: DocumentManagerModalProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [previewAttachmentId, setPreviewAttachmentId] = useState<string | null>(null);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showIncompleteOnly, setShowIncompleteOnly] = useState(false);
  const [showFilenameOnlyHints, setShowFilenameOnlyHints] = useState(true);
  const allAttachments = useMemo(() => task?.checklistItems.flatMap((item) => item.attachments) ?? [], [task]);
  const previewIndex = allAttachments.findIndex((attachment) => attachment.id === previewAttachmentId);
  const previewAttachment =
    allAttachments.find((attachment) => attachment.id === previewAttachmentId) ?? allAttachments[0] ?? null;
  const effectivePreviewIndex = previewAttachment ? Math.max(previewIndex, 0) : -1;
  const hasPrevAttachment = effectivePreviewIndex > 0;
  const hasNextAttachment = effectivePreviewIndex >= 0 && effectivePreviewIndex < allAttachments.length - 1;
  const filenameOnlyMatches = autoDetectMatches.filter((item) => item.via === 'filename');

  useEffect(() => {
    if (!open) {
      setPreviewAttachmentId(null);
      setPreviewZoom(100);
      setShowIncompleteOnly(false);
      setShowFilenameOnlyHints(true);
      return;
    }

    if (allAttachments.length === 0) {
      setPreviewAttachmentId(null);
      setPreviewZoom(100);
      return;
    }

    if (!previewAttachmentId || !allAttachments.some((attachment) => attachment.id === previewAttachmentId)) {
      setPreviewAttachmentId(allAttachments[0]?.id ?? null);
    }
  }, [allAttachments, open, previewAttachmentId]);

  useEffect(() => {
    setPreviewZoom(100);
  }, [previewAttachmentId]);

  if (!open || !task) return null;

  const canSendToFinance = !!task.financePicEmail && !!task.checklistSummary.hasAnyDocument;
  const visibleChecklistItems = showIncompleteOnly
    ? task.checklistItems.filter((item) => !item.isCompleted)
    : task.checklistItems;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ y: 32, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 32, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 400, damping: 35 }}
          className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="font-semibold text-gray-900">Kelola Dokumen Perjadin</h2>
              <p className="mt-1 text-xs text-gray-500">{task.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="max-h-[85vh] overflow-y-auto px-6 py-5">
            <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div
                  className={`rounded-3xl border-2 border-dashed px-6 py-7 transition-colors ${
                    isDragActive ? 'border-sky-500 bg-sky-50' : 'border-sky-200 bg-gradient-to-br from-sky-50 via-white to-emerald-50'
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragActive(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragActive(false);
                    if (e.dataTransfer.files?.length) onAutoUploadFiles(e.dataTransfer.files);
                  }}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                      {autoClassifying ? <Loader2 className="h-6 w-6 animate-spin" /> : <Upload className="h-6 w-6" />}
                    </div>
                    <div className="min-w-0">
                      <span className="rounded-full bg-sky-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-sky-700">
                        Cara tercepat
                      </span>
                      <h3 className="mt-3 text-lg font-semibold text-slate-900">Tarik semua dokumen ke sini sekaligus</h3>
                      <p className="mt-2 text-sm leading-relaxed text-slate-600">
                        Sistem akan mencoba mengenali jenis dokumen dari isi file terlebih dahulu. Untuk gambar seperti
                        PNG/JPG/JPEG dan PDF scan yang tidak punya teks bawaan, sistem akan mencoba OCR via provider AI
                        yang aktif, lalu fallback ke nama file bila perlu. Checklist mendukung dokumen wajib dan opsional,
                        dan setiap kategori bisa menampung lebih dari satu file sesuai kebutuhan.
                      </p>
                      <div className="mt-3 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2">PDF, DOC, DOCX berbasis teks paling akurat</div>
                        <div className="rounded-xl border border-white/80 bg-white/70 px-3 py-2">PNG/JPG/JPEG dan PDF scan dicoba OCR otomatis jika provider AI aktif</div>
                      </div>
                      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                        <Upload className="h-4 w-4" />
                        Pilih atau drop file
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            onAutoUploadFiles(e.target.files);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>

                {autoDetectSummary ? (
                  <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
                    <p className="font-semibold">{autoDetectSummary}</p>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {(['content', 'ocr', 'filename'] as const).map((via) => (
                        <span
                          key={via}
                          className={`rounded-full border px-2.5 py-1 font-semibold ${AUTO_DETECT_VIA_CONFIG[via].badge}`}
                          title={AUTO_DETECT_VIA_CONFIG[via].hint}
                        >
                          {AUTO_DETECT_VIA_CONFIG[via].label}
                        </span>
                      ))}
                    </div>
                    {autoDetectMatches.length > 0 ? (
                      <div className="space-y-2">
                        {autoDetectMatches.slice(0, 6).map((item) => (
                          <div
                            key={`${item.filename}-${item.checklistLabel}`}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-900"
                          >
                            <span className="font-medium">{item.filename}</span>
                            <span className="text-emerald-500">{'->'}</span>
                            <span className="font-semibold">{item.checklistLabel}</span>
                            <span className={`rounded-full border px-2 py-0.5 font-semibold ${AUTO_DETECT_VIA_CONFIG[item.via].badge}`}>
                              {AUTO_DETECT_VIA_CONFIG[item.via].label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {autoDetectUnmatched.length > 0 ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        Perlu dicek manual: {autoDetectUnmatched.slice(0, 4).join(', ')}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Upload Manual per Item</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Gunakan area ini jika sistem tidak yakin, file perlu dikoreksi kategorinya, atau kamu ingin menaruh file langsung ke item tertentu.
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">Fallback manual</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowIncompleteOnly((current) => !current)}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                        showIncompleteOnly
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {showIncompleteOnly ? 'Menampilkan yang belum lengkap' : 'Tampilkan hanya yang belum lengkap'}
                    </button>
                    {filenameOnlyMatches.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowFilenameOnlyHints((current) => !current)}
                        className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                          showFilenameOnlyHints
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {showFilenameOnlyHints
                          ? `Sorot ${filenameOnlyMatches.length} hasil dari nama file`
                          : 'Tampilkan lagi sorotan nama file'}
                      </button>
                    ) : null}
                  </div>
                </div>

                {visibleChecklistItems.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                            item.isCompleted ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {item.isCompleted ? 'OK' : item.sortOrder + 1}
                          </span>
                          <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                            Opsional
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.attachments.length > 0 ? `${item.attachments.length} dokumen terunggah` : 'Belum ada dokumen terunggah'}
                        </p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100">
                        {uploadingChecklistId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Tambah file manual
                        <input
                          type="file"
                          className="hidden"
                          multiple
                          onChange={(e) => {
                            onUploadFiles(item.id, e.target.files);
                            e.currentTarget.value = '';
                          }}
                        />
                      </label>
                    </div>

                    <div className="mt-3 space-y-2">
                      {item.attachments.length > 0 ? (
                        item.attachments.map((attachment) => (
                          <div key={attachment.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                            <div className="min-w-0 flex-1">
                              <a
                                href={attachment.downloadUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 text-sm font-medium text-primary-700 hover:text-primary-800"
                              >
                                <Paperclip className="h-4 w-4 shrink-0" />
                                <span className="truncate">{attachment.filename}</span>
                              </a>
                              <p className="mt-1 text-xs text-slate-500">{formatBytes(attachment.fileSize)}</p>
                              {showFilenameOnlyHints && filenameOnlyMatches.some((match) => match.filename === attachment.filename) ? (
                                <p className="mt-1 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                  Perlu cek ulang: terdeteksi dari nama file
                                </p>
                              ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreviewAttachmentId(attachment.id)}
                                className={`inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                                  previewAttachment?.id === attachment.id
                                    ? 'bg-primary-50 text-primary-700'
                                    : 'text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <FileText className="h-3.5 w-3.5" />
                                Preview
                              </button>
                              <select
                                value={item.id}
                                onChange={(e) => onMoveAttachment(attachment.id, e.target.value)}
                                disabled={movingAttachmentId === attachment.id}
                                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
                              >
                                {task.checklistItems.map((targetItem) => (
                                  <option key={targetItem.id} value={targetItem.id}>
                                    {targetItem.id === item.id ? `Kategori saat ini: ${targetItem.label}` : `Pindah ke ${targetItem.label}`}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => onDeleteAttachment(attachment.id)}
                                disabled={deletingAttachmentId === attachment.id}
                                className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                              >
                                {deletingAttachmentId === attachment.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                Hapus
                              </button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-4 text-sm text-slate-500">
                          Belum ada dokumen untuk item ini.
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {showIncompleteOnly && visibleChecklistItems.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50 px-4 py-6 text-sm text-emerald-800">
                    Semua item checklist sudah lengkap.
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-sky-700" />
                    <p className="text-sm font-semibold text-slate-900">Status Dokumen</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    {task.checklistSummary.totalAttachmentCount} dokumen telah diunggah di seluruh kategori.
                  </p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500"
                      style={{
                        width: `${Math.min(100, task.checklistSummary.totalAttachmentCount * 20)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-900">PIC Keuangan</p>
                  <p className="mt-1 text-sm text-slate-600">{task.financePicEmail ?? 'Belum diisi di task'}</p>
                  <p className="mt-2 text-xs text-slate-500">
                    Tombol kirim akan aktif setelah email PIC diisi dan minimal satu dokumen berhasil diunggah.
                  </p>
                  <button
                    type="button"
                    onClick={onSendToFinance}
                    disabled={!canSendToFinance || sendingToFinance}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
                  >
                    {sendingToFinance ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {task.financeEmailSentAt ? 'Kirim Ulang ke Keuangan' : 'Kirim ke Keuangan'}
                  </button>
                  {task.financeEmailSentAt ? (
                    <p className="mt-2 text-xs text-emerald-700">Terakhir dikirim: {formatDate(task.financeEmailSentAt)}</p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Preview Dokumen</p>
                      {previewAttachment ? (
                        <p className="mt-1 text-xs text-slate-500">
                          Dokumen {effectivePreviewIndex + 1} dari {allAttachments.length}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {previewAttachment ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasPrevAttachment) return;
                              setPreviewAttachmentId(allAttachments[effectivePreviewIndex - 1]?.id ?? null);
                            }}
                            disabled={!hasPrevAttachment}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                            Sebelumnya
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!hasNextAttachment) return;
                              setPreviewAttachmentId(allAttachments[effectivePreviewIndex + 1]?.id ?? null);
                            }}
                            disabled={!hasNextAttachment}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
                          >
                            Berikutnya
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                          <a
                            href={previewAttachment.downloadUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-primary-700 hover:text-primary-800"
                          >
                            Buka tab baru
                          </a>
                        </>
                      ) : null}
                    </div>
                  </div>

                  {previewAttachment ? (
                    <div className="mt-3 space-y-3">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="truncate text-sm font-medium text-slate-900">{previewAttachment.filename}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {previewAttachment.fileType} • {formatBytes(previewAttachment.fileSize)}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                        <span className="text-xs font-semibold text-slate-600">Zoom</span>
                        <button
                          type="button"
                          onClick={() => setPreviewZoom((current) => clampPreviewZoom(current - 10))}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <ZoomOut className="h-3.5 w-3.5" />
                          -
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewZoom(100)}
                          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          {previewZoom}%
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewZoom((current) => clampPreviewZoom(current + 10))}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                        >
                          <ZoomIn className="h-3.5 w-3.5" />
                          +
                        </button>
                      </div>

                      {isPreviewableImage(previewAttachment.fileType) ? (
                        <div className="overflow-auto rounded-xl border border-slate-200 bg-slate-50">
                          <div
                            className="flex min-h-[420px] min-w-full items-center justify-center bg-white p-3"
                            style={{ transform: `scale(${previewZoom / 100})`, transformOrigin: 'top center' }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewAttachment.downloadUrl}
                              alt={previewAttachment.filename}
                              className="max-h-[420px] w-full object-contain bg-white"
                            />
                          </div>
                        </div>
                      ) : isPreviewablePdf(previewAttachment.fileType, previewAttachment.filename) ? (
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                          <object
                            data={`${previewAttachment.downloadUrl}#zoom=${previewZoom}`}
                            type="application/pdf"
                            className="h-[420px] w-full bg-white"
                          >
                            <div className="flex h-[420px] items-center justify-center px-4 text-sm text-slate-600">
                              Preview PDF tidak tersedia di browser ini. Gunakan tombol <span className="mx-1 font-semibold">Buka tab baru</span>.
                            </div>
                          </object>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                          Preview inline belum tersedia untuk format ini. Gunakan tombol <span className="font-semibold">Buka tab baru</span> untuk melihat dokumen.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      Belum ada dokumen yang bisa dipreview. Upload file terlebih dahulu, lalu pilih tombol Preview pada salah satu dokumen.
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-amber-100 bg-amber-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-900">Catatan Deteksi Otomatis</p>
                  <p className="mt-1 text-xs leading-relaxed text-slate-600">
                    Versi saat ini mencoba membaca isi PDF/DOC/DOCX terlebih dahulu. Untuk file gambar PNG/JPG/JPEG
                    dan PDF scan yang tidak mengandung teks bawaan, sistem juga akan mencoba OCR lewat provider AI
                    yang aktif. Jika OCR gagal atau provider belum mendukung vision/file input, sistem akan fallback ke
                    heuristik nama file. Dokumen opsional seperti SPPD/Laporan Perjalanan Dinas dan Voucher/Invoice
                    Hotel tidak wajib ada, tetapi bisa diunggah bila memang diperlukan. Upload manual per item tetap
                    disediakan untuk koreksi akhir. Contoh yang mudah dikenali:
                    <br />
                    `surat-tugas.pdf`, `eticket-jakarta.pdf`, `invoice-hotel.pdf`, `boarding-pass.jpg`, `sppd.pdf`, `voucher-hotel.pdf`.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DeleteModal({
  open,
  onConfirm,
  onClose,
  loading,
}: {
  open: boolean;
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
          >
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 text-red-600">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="mt-4 text-center text-base font-semibold text-gray-900">Hapus Tugas?</h3>
            <p className="mt-1 text-center text-sm text-gray-500">Tugas beserta seluruh lampirannya akan ikut terhapus.</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {loading ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export const TaskManagement: React.FC = () => {
  const [tasks, setTasks] = useState<ApiTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<TaskFormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [documentTaskId, setDocumentTaskId] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const [uploadingChecklistId, setUploadingChecklistId] = useState<string | null>(null);
  const [deletingAttachmentId, setDeletingAttachmentId] = useState<string | null>(null);
  const [movingAttachmentId, setMovingAttachmentId] = useState<string | null>(null);
  const [sendingToFinance, setSendingToFinance] = useState(false);
  const [autoClassifying, setAutoClassifying] = useState(false);
  const [autoDetectSummary, setAutoDetectSummary] = useState<string | null>(null);
  const [autoDetectMatches, setAutoDetectMatches] = useState<AutoDetectMatch[]>([]);
  const [autoDetectUnmatched, setAutoDetectUnmatched] = useState<string[]>([]);

  const { toasts, push: pushToast } = useToasts();

  const documentTask = useMemo(
    () => tasks.find((task) => task.id === documentTaskId) ?? null,
    [tasks, documentTaskId],
  );

  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memuat data tugas.'));
      const json = (await res.json()) as { data: ApiTask[] };
      setTasks(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTasks();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((task) => task.status === 'in-progress').length;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const high = tasks.filter((task) => task.priority === 'high').length;
    const travelTasks = tasks.filter((task) => task.kind === 'travel-accountability').length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, inProgress, completed, high, travelTasks, pct };
  }, [tasks]);

  const filteredByColumn = (status: TaskStatus) =>
    tasks.filter((task) => {
      if (task.status !== status) return false;
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      return true;
    });

  const syncFormWithTask = (task: ApiTask) => {
    setForm({
      title: task.title,
      description: task.description ?? '',
      kind: task.kind,
      priority: task.priority,
      status: task.status,
      dueDate: toDatetimeLocalValue(task.dueDate),
      financePicEmail: task.financePicEmail ?? '',
    });
  };

  const openCreateModal = (defaultStatus: TaskStatus = 'todo') => {
    setFormMode('create');
    setForm({ ...emptyForm, status: defaultStatus });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (task: ApiTask) => {
    setFormMode('edit');
    syncFormWithTask(task);
    setEditingId(task.id);
    setShowModal(true);
  };

  const openDocumentModal = (task: ApiTask) => {
    setDocumentTaskId(task.id);
  };

  const openDocumentModalFromEdit = () => {
    if (!editingId) return;
    setShowModal(false);
    setDocumentTaskId(editingId);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormMode('create');
    setForm(emptyForm);
    setUploadingChecklistId(null);
    setDeletingAttachmentId(null);
    setMovingAttachmentId(null);
    setSendingToFinance(false);
  };

  const closeDocumentModal = () => {
    setDocumentTaskId(null);
    setUploadingChecklistId(null);
    setDeletingAttachmentId(null);
    setMovingAttachmentId(null);
    setSendingToFinance(false);
    setAutoClassifying(false);
    setAutoDetectSummary(null);
    setAutoDetectMatches([]);
    setAutoDetectUnmatched([]);
  };

  const upsertTaskInState = (nextTask: ApiTask) => {
    setTasks((current) => {
      const exists = current.some((task) => task.id === nextTask.id);
      if (!exists) return [nextTask, ...current];
      return current.map((task) => (task.id === nextTask.id ? nextTask : task));
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreate = formMode === 'create';
    const url = isCreate ? '/api/tasks' : `/api/tasks/${editingId}`;
    const method = isCreate ? 'POST' : 'PATCH';

    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        kind: form.kind,
        priority: form.priority,
        status: form.status,
        dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        financePicEmail: form.kind === 'travel-accountability' ? form.financePicEmail.trim() || null : null,
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await readApiErrorMessage(res, isCreate ? 'Gagal membuat tugas.' : 'Gagal memperbarui tugas.'));

      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);

      if (isCreate) {
        closeModal();
        pushToast(
          'success',
          json.data.kind === 'travel-accountability'
            ? 'Tugas perjadin berhasil dibuat. Dokumen bisa dilengkapi nanti dari menu Kelola Dokumen.'
            : 'Tugas berhasil ditambahkan.',
        );
      } else {
        syncFormWithTask(json.data);
        pushToast('success', 'Tugas berhasil diperbarui.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(message);
      pushToast('error', message);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/tasks/${deletingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menghapus tugas.'));
      setTasks((current) => current.filter((task) => task.id !== deletingId));
      setDeletingId(null);
      if (editingId === deletingId) closeModal();
      pushToast('success', 'Tugas berhasil dihapus.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setDeleteLoading(false);
    }
  };

  const patchStatus = async (id: string, nextStatus: TaskStatus) => {
    const previous = tasks;
    const task = previous.find((item) => item.id === id);
    if (!task || task.status === nextStatus) return;

    setTasks((current) => current.map((item) => (item.id === id ? { ...item, status: nextStatus } : item)));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memindahkan tugas.'));
      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);
      const label = STATUS_COLUMNS.find((column) => column.id === nextStatus)?.label ?? nextStatus;
      pushToast('success', `Dipindahkan ke "${label}".`);
    } catch (err) {
      setTasks(previous);
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  };

  const handleUploadFiles = async (checklistItemId: string, files: FileList | File[] | null) => {
    if (!documentTaskId || !files || files.length === 0) return;

    try {
      setUploadingChecklistId(checklistItemId);
      const formData = new FormData();
      formData.append('checklistItemId', checklistItemId);
      Array.from(files).forEach((file) => formData.append('files', file));

      const res = await fetch(`/api/tasks/${documentTaskId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal upload dokumen.'));
      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);
      if (editingId === json.data.id) syncFormWithTask(json.data);
      pushToast('success', 'Dokumen berhasil diunggah.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setUploadingChecklistId(null);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!documentTaskId) return;
    try {
      setDeletingAttachmentId(attachmentId);
      const res = await fetch(`/api/tasks/${documentTaskId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal menghapus lampiran.'));
      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);
      if (editingId === json.data.id) syncFormWithTask(json.data);
      pushToast('success', 'Lampiran berhasil dihapus.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setDeletingAttachmentId(null);
    }
  };

  const handleMoveAttachment = async (attachmentId: string, checklistItemId: string) => {
    if (!documentTaskId) return;
    try {
      setMovingAttachmentId(attachmentId);
      const res = await fetch(`/api/tasks/${documentTaskId}/attachments/${attachmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklistItemId }),
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal memindahkan dokumen ke kategori lain.'));
      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);
      if (editingId === json.data.id) syncFormWithTask(json.data);
      pushToast('success', 'Dokumen berhasil dipindahkan ke kategori lain.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setMovingAttachmentId(null);
    }
  };

  const handleSendToFinance = async () => {
    if (!documentTaskId) return;
    try {
      setSendingToFinance(true);
      const res = await fetch(`/api/tasks/${documentTaskId}/send-to-finance`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Gagal mengirim ke PIC keuangan.'));
      const json = (await res.json()) as { data: ApiTask };
      upsertTaskInState(json.data);
      if (editingId === json.data.id) syncFormWithTask(json.data);
      pushToast('success', 'Dokumen berhasil dikirim ke PIC keuangan.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setSendingToFinance(false);
    }
  };

  const handleAutoUploadFiles = async (files: FileList | File[] | null) => {
    if (!documentTask) return;
    if (!files || files.length === 0) return;

    try {
      setAutoClassifying(true);
      const formData = new FormData();
      Array.from(files).forEach((file) => formData.append('files', file));

      const res = await fetch(`/api/tasks/${documentTask.id}/attachments/auto-classify`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error(await readApiErrorMessage(res, 'Auto-classify dokumen gagal.'));
      const json = (await res.json()) as {
        data: ApiTask;
        meta?: {
          matched?: AutoDetectMatch[];
          unmatched?: string[];
        };
      };
      upsertTaskInState(json.data);

      const matchedCount = json.meta?.matched?.length ?? 0;
      const unmatchedCount = json.meta?.unmatched?.length ?? 0;
      const viaContentCount = (json.meta?.matched ?? []).filter((item) => item.via === 'content').length;
      const viaOcrCount = (json.meta?.matched ?? []).filter((item) => item.via === 'ocr').length;
      const viaFilenameCount = (json.meta?.matched ?? []).filter((item) => item.via === 'filename').length;
      setAutoDetectMatches(json.meta?.matched ?? []);
      setAutoDetectUnmatched(json.meta?.unmatched ?? []);

      setAutoDetectSummary(
        matchedCount > 0
          ? `${matchedCount} file dipetakan otomatis, ${viaContentCount} dari teks dokumen, ${viaOcrCount} dari OCR scan, ${viaFilenameCount} dari nama file${
              unmatchedCount > 0 ? `, ${unmatchedCount} masih perlu dicek manual` : ''
            }.`
          : null,
      );

      if (matchedCount > 0 && unmatchedCount === 0) {
        pushToast('success', 'Dokumen berhasil dipetakan otomatis ke checklist.');
      } else if (matchedCount > 0) {
        pushToast('success', 'Sebagian dokumen berhasil dipetakan otomatis. Cek file yang belum cocok.');
      }
    } finally {
      setAutoClassifying(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-xs flex-col gap-2 sm:right-6 sm:top-6">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.96 }}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
                toast.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {toast.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Manajemen Tugas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola tugas umum dan kelengkapan pertanggungjawaban perjalanan dinas dalam satu papan kerja.
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 rounded-xl border border-primary-700/20 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-900/15 transition-all hover:-translate-y-0.5 hover:from-primary-700 hover:via-primary-700 hover:to-primary-900 hover:shadow-lg hover:shadow-primary-900/20"
        >
          <Plus className="h-4 w-4" />
          Tambah Tugas
        </motion.button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          {
            label: 'Total Tugas',
            value: stats.total,
            icon: <ListTodo className="h-5 w-5" />,
            iconBg: 'bg-primary/10 text-primary-700',
          },
          {
            label: 'Sedang Dikerjakan',
            value: stats.inProgress,
            icon: <Clock className="h-5 w-5" />,
            iconBg: 'bg-amber-100 text-amber-700',
          },
          {
            label: 'Selesai',
            value: stats.completed,
            icon: <CheckSquare className="h-5 w-5" />,
            iconBg: 'bg-green-100 text-green-700',
          },
          {
            label: 'Prioritas Tinggi',
            value: stats.high,
            icon: <Flag className="h-5 w-5" />,
            iconBg: 'bg-red-100 text-red-700',
          },
          {
            label: 'Task Perjadin',
            value: stats.travelTasks,
            icon: <FileText className="h-5 w-5" />,
            iconBg: 'bg-sky-100 text-sky-700',
          },
        ].map((item) => (
          <div key={item.label} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{item.value}</p>
              </div>
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}>{item.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {stats.total > 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <TrendingUp className="h-4 w-4 text-primary-600" />
              Progress Keseluruhan
            </div>
            <span className="text-sm font-bold text-primary-700">{stats.pct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
              initial={{ width: 0 }}
              animate={{ width: `${stats.pct}%` }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
            />
          </div>
          <p className="mt-1.5 text-xs text-gray-400">{stats.completed} dari {stats.total} tugas selesai</p>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari tugas..."
              className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-4 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2.5 text-sm">
            <Filter className="h-4 w-4 shrink-0 text-gray-400" />
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-gray-700 outline-none"
            >
              <option value="all">Semua Prioritas</option>
              <option value="high">Tinggi</option>
              <option value="medium">Sedang</option>
              <option value="low">Rendah</option>
            </select>
          </div>
        </div>

        <div className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-sky-700" />
            <p className="text-sm font-semibold text-slate-900">Checklist Perjadin</p>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Template otomatis mencakup 6 kategori dokumen yang seluruhnya opsional. Setiap jenis dokumen bisa berisi
            lebih dari satu file, dan task tetap bisa dikirim ke email PIC keuangan selama minimal ada satu dokumen.
          </p>
        </div>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STATUS_COLUMNS.map((column) => (
            <div key={column.id} className={`rounded-2xl p-4 ${column.bg}`}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${column.dot}`} />
                <span className="text-sm font-semibold text-gray-700">{column.label}</span>
              </div>
              <div className="space-y-3">
                {[1, 2].map((index) => <SkeletonCard key={index} />)}
              </div>
            </div>
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <Inbox className="h-6 w-6" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Belum ada tugas</h2>
          <p className="mt-2 text-sm text-slate-500">
            Mulai dari task umum atau buat task pertanggungjawaban perjalanan dinas agar checklist dokumen bisa dipantau.
          </p>
          <button
            type="button"
            onClick={() => openCreateModal()}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800"
          >
            <Plus className="h-4 w-4" />
            Tambah tugas pertama
          </button>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
          {STATUS_COLUMNS.map((column) => (
            <KanbanColumn
              key={column.id}
              col={column}
              tasks={filteredByColumn(column.id)}
              onEdit={openEditModal}
              onManageDocuments={openDocumentModal}
              onDelete={(id) => setDeletingId(id)}
              onStatusChange={patchStatus}
              onAdd={openCreateModal}
              draggingId={draggingId}
              setDraggingId={setDraggingId}
              dropTarget={dropTarget}
              setDropTarget={setDropTarget}
            />
          ))}
        </div>
      )}

      <TaskModal
        mode={formMode}
        open={showModal}
        form={form}
        setForm={setForm}
        task={editingId ? tasks.find((task) => task.id === editingId) ?? null : null}
        onSubmit={(e) => void handleSubmit(e)}
        onClose={closeModal}
        submitting={submitting}
        onOpenDocuments={openDocumentModalFromEdit}
      />

      <DocumentManagerModal
        open={documentTaskId !== null}
        task={documentTask}
        onClose={closeDocumentModal}
        onUploadFiles={(checklistItemId, files) => void handleUploadFiles(checklistItemId, files)}
        onAutoUploadFiles={(files) => void handleAutoUploadFiles(files)}
        onMoveAttachment={(attachmentId, checklistItemId) => void handleMoveAttachment(attachmentId, checklistItemId)}
        onDeleteAttachment={(attachmentId) => void handleDeleteAttachment(attachmentId)}
        deletingAttachmentId={deletingAttachmentId}
        movingAttachmentId={movingAttachmentId}
        uploadingChecklistId={uploadingChecklistId}
        autoClassifying={autoClassifying}
        autoDetectSummary={autoDetectSummary}
        autoDetectMatches={autoDetectMatches}
        autoDetectUnmatched={autoDetectUnmatched}
        onSendToFinance={() => void handleSendToFinance()}
        sendingToFinance={sendingToFinance}
      />

      <DeleteModal
        open={deletingId !== null}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeletingId(null)}
        loading={deleteLoading}
      />
    </div>
  );
};

export default TaskManagement;
