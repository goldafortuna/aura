import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Filter,
  Flag,
  ListTodo,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type TaskStatus = 'todo' | 'in-progress' | 'completed';
type TaskPriority = 'high' | 'medium' | 'low';
type ToastType = 'success' | 'error';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ApiTask {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}

interface TaskFormState {
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const emptyForm: TaskFormState = {
  title: '',
  description: '',
  priority: 'medium',
  status: 'todo',
  dueDate: '',
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Toast hook
// ---------------------------------------------------------------------------
function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = (type: ToastType, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  };

  return { toasts, push };
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------
interface TaskCardProps {
  task: ApiTask;
  onEdit: (task: ApiTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
}

function TaskCard({ task, onEdit, onDelete, onStatusChange, draggingId, setDraggingId }: TaskCardProps) {
  const overdue = isOverdue(task.dueDate, task.status);
  const { label: priorityLabel, badge: priorityBadge } = PRIORITY_CONFIG[task.priority];
  const formattedDate = formatDate(task.dueDate);
  const isDone = task.status === 'completed';

  return (
    <motion.div
      layout
      whileHover={{ y: -2, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}
      className={`group relative rounded-2xl border bg-white p-4 shadow-sm transition-opacity duration-150 ${
        draggingId === task.id ? 'opacity-50 ring-2 ring-primary/30' : ''
      } ${isDone ? 'border-green-100' : 'border-gray-200'}`}
      draggable
      onDragStart={(e) => {
        (e as unknown as React.DragEvent<HTMLDivElement>).dataTransfer.setData('text/task-id', task.id);
        (e as unknown as React.DragEvent<HTMLDivElement>).dataTransfer.effectAllowed = 'move';
        setDraggingId(task.id);
      }}
      onDragEnd={() => setDraggingId(null)}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5">
        {/* Quick-complete toggle */}
        <button
          type="button"
          onClick={() => onStatusChange(task.id, isDone ? 'todo' : 'completed')}
          className={`mt-0.5 shrink-0 rounded-full transition-colors duration-150 ${
            isDone ? 'text-green-500 hover:text-gray-300' : 'text-gray-200 hover:text-green-500'
          }`}
          aria-label={isDone ? 'Batal selesai' : 'Tandai selesai'}
        >
          <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={`text-sm font-semibold leading-snug ${
              isDone ? 'text-gray-400 line-through' : 'text-gray-900'
            }`}
          >
            {task.title}
          </p>
          {task.description && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-500">{task.description}</p>
          )}
        </div>

        {/* Hover actions */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
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

      {/* Footer row */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${priorityBadge}`}>
          {priorityLabel}
        </span>

        {formattedDate && (
          <span
            className={`flex items-center gap-1 text-xs ${
              overdue ? 'font-semibold text-red-600' : 'text-gray-400'
            }`}
          >
            {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
            {overdue ? `Terlambat · ${formattedDate}` : formattedDate}
          </span>
        )}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Kanban column
// ---------------------------------------------------------------------------
interface KanbanColumnProps {
  col: (typeof STATUS_COLUMNS)[number];
  tasks: ApiTask[];
  onEdit: (task: ApiTask) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onAdd: (status: TaskStatus) => void;
  draggingId: string | null;
  setDraggingId: (id: string | null) => void;
  dropTarget: TaskStatus | null;
  setDropTarget: React.Dispatch<React.SetStateAction<TaskStatus | null>>;
}

function KanbanColumn({
  col,
  tasks,
  onEdit,
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
      className={`flex min-h-[220px] min-w-[272px] flex-col rounded-2xl transition-all duration-150 lg:min-w-0 ${
        col.bg
      } ${isTarget ? `ring-2 ${col.ring}` : ''}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDropTarget(col.id);
      }}
      onDragLeave={() => setDropTarget((cur) => (cur === col.id ? null : cur))}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/task-id');
        setDropTarget(null);
        setDraggingId(null);
        if (id) onStatusChange(id, col.id);
      }}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 pb-3 pt-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
          <span className="text-sm font-semibold text-gray-800">{col.label}</span>
          <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold text-gray-500 shadow-sm">
            {tasks.length}
          </span>
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

      {/* Cards */}
      <div className="flex flex-col gap-3 px-3 pb-4">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            draggingId={draggingId}
            setDraggingId={setDraggingId}
          />
        ))}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 bg-white/40 px-4 py-8 text-center">
            <span className="text-xs text-gray-400">
              {draggingId ? '↓ Lepaskan di sini' : col.emptyHint}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task modal (create + edit)
// ---------------------------------------------------------------------------
interface TaskModalProps {
  mode: 'create' | 'edit';
  open: boolean;
  form: TaskFormState;
  setForm: React.Dispatch<React.SetStateAction<TaskFormState>>;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  submitting: boolean;
}

function TaskModal({ mode, open, form, setForm, onSubmit, onClose, submitting }: TaskModalProps) {
  return (
    <AnimatePresence>
      {open && (
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
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="font-semibold text-gray-900">
                {mode === 'create' ? 'Tambah Tugas Baru' : 'Edit Tugas'}
              </h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="space-y-4 px-6 py-5">
              {/* Title */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">Judul Tugas *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  placeholder="Contoh: Siapkan laporan kinerja bulan ini…"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Deskripsi <span className="font-normal text-gray-400">(opsional)</span>
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Tambahkan detail atau catatan…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-shadow focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Priority + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Prioritas</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as TaskPriority }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="high">🔴 Tinggi</option>
                    <option value="medium">🟡 Sedang</option>
                    <option value="low">🟢 Rendah</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as TaskStatus }))}
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="todo">Belum Dikerjakan</option>
                    <option value="in-progress">Sedang Dikerjakan</option>
                    <option value="completed">Selesai</option>
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-gray-600">
                  Tenggat Waktu <span className="font-normal text-gray-400">(opsional)</span>
                </label>
                <input
                  type="datetime-local"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:from-primary-700 hover:to-primary-800 hover:shadow-md active:scale-[0.98] disabled:opacity-50"
                >
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {submitting
                    ? 'Menyimpan…'
                    : mode === 'create'
                      ? 'Tambah Tugas'
                      : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation modal
// ---------------------------------------------------------------------------
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
      {open && (
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
            <p className="mt-1 text-center text-sm text-gray-500">
              Tugas yang dihapus tidak dapat dikembalikan.
            </p>
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
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? 'Menghapus…' : 'Ya, Hapus'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
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

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskStatus | null>(null);

  const { toasts, push: pushToast } = useToasts();

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchTasks = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/tasks', { cache: 'no-store' });
      if (!res.ok) throw new Error('Gagal memuat data tugas.');
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

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = tasks.length;
    const inProgress = tasks.filter((t) => t.status === 'in-progress').length;
    const completed = tasks.filter((t) => t.status === 'completed').length;
    const high = tasks.filter((t) => t.priority === 'high').length;
    const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, inProgress, completed, high, pct };
  }, [tasks]);

  // ── Column filter ─────────────────────────────────────────────────────────
  const filteredByColumn = (status: TaskStatus) =>
    tasks.filter((t) => {
      if (t.status !== status) return false;
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      return true;
    });

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openCreateModal = (defaultStatus: TaskStatus = 'todo') => {
    setFormMode('create');
    setForm({ ...emptyForm, status: defaultStatus });
    setEditingId(null);
    setShowModal(true);
  };

  const openEditModal = (task: ApiTask) => {
    setFormMode('edit');
    setForm({
      title: task.title,
      description: task.description ?? '',
      priority: task.priority,
      status: task.status,
      dueDate: toDatetimeLocalValue(task.dueDate),
    });
    setEditingId(task.id);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCreate = formMode === 'create';
    const url = isCreate ? '/api/tasks' : `/api/tasks/${editingId}`;
    const method = isCreate ? 'POST' : 'PATCH';

    try {
      setSubmitting(true);
      setError(null);
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          priority: form.priority,
          status: form.status,
          dueDate: form.dueDate ? new Date(form.dueDate).toISOString() : null,
        }),
      });
      if (!res.ok) throw new Error(isCreate ? 'Gagal membuat tugas.' : 'Gagal memperbarui tugas.');
      closeModal();
      await fetchTasks();
      pushToast('success', isCreate ? 'Tugas berhasil ditambahkan.' : 'Tugas berhasil diperbarui.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Terjadi kesalahan.';
      setError(msg);
      pushToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      setDeleteLoading(true);
      const res = await fetch(`/api/tasks/${deletingId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Gagal menghapus tugas.');
      setDeletingId(null);
      await fetchTasks();
      pushToast('success', 'Tugas berhasil dihapus.');
    } catch (err) {
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Status change (drag-and-drop + quick toggle) ───────────────────────────
  const patchStatus = async (id: string, nextStatus: TaskStatus) => {
    const prev = tasks;
    const task = prev.find((t) => t.id === id);
    if (!task || task.status === nextStatus) return;

    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, status: nextStatus } : t)));

    try {
      const res = await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error('Gagal memindahkan tugas.');
      const colLabel = STATUS_COLUMNS.find((c) => c.id === nextStatus)?.label ?? nextStatus;
      pushToast('success', `Dipindahkan ke "${colLabel}".`);
    } catch (err) {
      setTasks(prev);
      pushToast('error', err instanceof Error ? err.message : 'Terjadi kesalahan.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Toasts */}
      <div className="pointer-events-none fixed right-4 top-4 z-[60] flex w-full max-w-xs flex-col gap-2 sm:right-6 sm:top-6">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 16, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 16, scale: 0.96 }}
              className={`pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-lg ${
                t.type === 'success'
                  ? 'border-green-200 bg-green-50 text-green-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 shrink-0" />
              )}
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Manajemen Tugas</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola dan pantau tugas-tugas sekretaris pimpinan
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => openCreateModal()}
          className="inline-flex items-center gap-2 rounded-xl border border-primary-700/20 bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary-900/15 transition-all hover:-translate-y-0.5 hover:from-primary-700 hover:via-primary-700 hover:to-primary-900 hover:shadow-lg hover:shadow-primary-900/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2"
        >
          <Plus className="h-4 w-4" />
          Tambah Tugas
        </motion.button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{s.value}</p>
              </div>
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${s.iconBg}`}
              >
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      {stats.total > 0 && (
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
          <p className="mt-1.5 text-xs text-gray-400">
            {stats.completed} dari {stats.total} tugas selesai
          </p>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari tugas…"
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

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Kanban board */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {STATUS_COLUMNS.map((col) => (
            <div key={col.id} className={`rounded-2xl p-4 ${col.bg}`}>
              <div className="mb-3 flex items-center gap-2 px-1">
                <span className={`h-2.5 w-2.5 rounded-full ${col.dot}`} />
                <span className="text-sm font-semibold text-gray-700">{col.label}</span>
              </div>
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-2 lg:grid lg:grid-cols-3 lg:overflow-visible lg:pb-0">
          {STATUS_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              tasks={filteredByColumn(col.id)}
              onEdit={openEditModal}
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

      {/* Modals */}
      <TaskModal
        mode={formMode}
        open={showModal}
        form={form}
        setForm={setForm}
        onSubmit={(e) => void handleSubmit(e)}
        onClose={closeModal}
        submitting={submitting}
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
