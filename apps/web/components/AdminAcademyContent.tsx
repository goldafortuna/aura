'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  GraduationCap,
  GripVertical,
  HelpCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type CourseStatus = 'draft' | 'published' | 'archived';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type LessonContentType = 'text' | 'video' | 'slides';
type QuizDifficulty = 'easy' | 'medium' | 'hard';
type EditTarget =
  | { kind: 'course' }
  | { kind: 'module'; moduleId: string }
  | { kind: 'lesson'; lessonId: string; moduleId: string }
  | { kind: 'quiz'; questionId: string; moduleId: string }
  | null;

type CourseRow = {
  id: string; slug: string; title: string; description: string | null;
  category: string | null; thumbnail: string | null; totalDuration: number | null;
  difficulty: Difficulty | null; status: CourseStatus; isPublic: boolean | null;
  moduleCount?: number;
};

type LessonRow = {
  id: string; title: string; description: string | null; duration: number | null;
  contentType: LessonContentType; contentData: unknown; order: number; isRequired: boolean | null;
};

type QuizQuestionRow = {
  id: string; question: string; options: string[]; correctIndex: number;
  explanation: string | null; difficulty: QuizDifficulty | null; order: number;
};

type ModuleRow = {
  id: string; title: string; description: string | null; order: number;
  colorGradient: string | null; bgColor: string | null; iconColor: string | null;
  lessons: LessonRow[]; quizQuestions: QuizQuestionRow[];
};

type CourseDetail = CourseRow & { modules: ModuleRow[] };

type CourseDraft = {
  slug: string; title: string; description: string; category: string;
  thumbnail: string; totalDuration: string; difficulty: Difficulty;
  status: CourseStatus; isPublic: boolean;
};

type ModuleDraft = {
  id?: string; title: string; description: string; order: string;
  colorGradient: string; bgColor: string; iconColor: string;
};

type LessonDraft = {
  id?: string; moduleId: string; title: string; description: string;
  duration: string; contentType: LessonContentType; contentDataText: string;
  order: string; isRequired: boolean;
};

type QuizDraft = {
  id?: string; moduleId: string; question: string; optionsText: string;
  correctIndex: string; explanation: string; difficulty: QuizDifficulty; order: string;
};

// ─── Defaults ─────────────────────────────────────────────────────────────────

const emptyCourseDraft: CourseDraft = {
  slug: '', title: '', description: '', category: 'fundamental',
  thumbnail: '', totalDuration: '60', difficulty: 'beginner', status: 'draft', isPublic: true,
};

function makeModuleDraft(order = 1): ModuleDraft {
  return { title: '', description: '', order: String(order), colorGradient: 'from-purple-500 to-indigo-500', bgColor: 'bg-purple-50', iconColor: 'text-purple-600' };
}

function makeLessonDraft(moduleId = '', order = 1): LessonDraft {
  return { moduleId, title: '', description: '', duration: '15', contentType: 'text', contentDataText: '{"type":"text","sections":[]}', order: String(order), isRequired: true };
}

function makeQuizDraft(moduleId = '', order = 1): QuizDraft {
  return { moduleId, question: '', optionsText: 'Pilihan A\nPilihan B\nPilihan C\nPilihan D', correctIndex: '0', explanation: '', difficulty: 'medium', order: String(order) };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readApiError(res: Response, fallback: string) {
  const text = await res.text();
  if (!text.trim()) return `${fallback} (HTTP ${res.status})`;
  try {
    const j = JSON.parse(text) as { error?: unknown };
    return typeof j.error === 'string' ? j.error : `${fallback} (HTTP ${res.status})`;
  } catch { return `${fallback} (HTTP ${res.status})`; }
}

function courseToDraft(c: CourseRow): CourseDraft {
  return { slug: c.slug, title: c.title, description: c.description ?? '', category: c.category ?? 'fundamental', thumbnail: c.thumbnail ?? '', totalDuration: String(c.totalDuration ?? 60), difficulty: c.difficulty ?? 'beginner', status: c.status, isPublic: Boolean(c.isPublic) };
}

function moduleToDraft(m: ModuleRow): ModuleDraft {
  return { id: m.id, title: m.title, description: m.description ?? '', order: String(m.order), colorGradient: m.colorGradient ?? '', bgColor: m.bgColor ?? '', iconColor: m.iconColor ?? '' };
}

function lessonToDraft(moduleId: string, l: LessonRow): LessonDraft {
  return { id: l.id, moduleId, title: l.title, description: l.description ?? '', duration: String(l.duration ?? 15), contentType: l.contentType, contentDataText: JSON.stringify(l.contentData ?? {}, null, 2), order: String(l.order), isRequired: Boolean(l.isRequired ?? true) };
}

function quizToDraft(moduleId: string, q: QuizQuestionRow): QuizDraft {
  return { id: q.id, moduleId, question: q.question, optionsText: q.options.join('\n'), correctIndex: String(q.correctIndex), explanation: q.explanation ?? '', difficulty: q.difficulty ?? 'medium', order: String(q.order) };
}

const STATUS_BADGE: Record<CourseStatus, string> = {
  draft: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  archived: 'bg-gray-100 text-gray-500',
};

// ─── Field components ──────────────────────────────────────────────────────────

function Field({ label, value, onChange, type = 'text', placeholder, rows }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; rows?: number;
}) {
  const cls = 'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20';
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-y`} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </label>
  );
}

function SelectField<T extends string>({ label, value, onChange, options }: {
  label: string; value: T; onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T)} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  );
}

// ─── Panel (slide-in overlay) ─────────────────────────────────────────────────

function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── ModuleCard (own refs for lesson/quiz DnD) ────────────────────────────────

type ModuleCardCallbacks = {
  onEditModule: (m: ModuleRow) => void;
  onDeleteModule: (moduleId: string) => void;
  onNewLesson: (moduleId: string) => void;
  onEditLesson: (moduleId: string, l: LessonRow) => void;
  onDeleteLesson: (lessonId: string) => void;
  onNewQuiz: (moduleId: string) => void;
  onEditQuiz: (moduleId: string, q: QuizQuestionRow) => void;
  onDeleteQuiz: (questionId: string) => void;
  onReorderLessons: (moduleId: string, reordered: LessonRow[]) => void;
  onReorderQuizzes: (moduleId: string, reordered: QuizQuestionRow[]) => void;
  saving: boolean;
  isExpanded: boolean;
  onToggle: (moduleId: string) => void;
};

// Module-level drag state for module sorting
type ModuleDragProps = {
  onModuleDragStart: (id: string) => void;
  onModuleDragOver: (e: React.DragEvent) => void;
  onModuleDrop: (id: string) => void;
};

function ModuleCard({ module, cb, moduleDrag }: {
  module: ModuleRow;
  cb: ModuleCardCallbacks;
  moduleDrag: ModuleDragProps;
}) {
  const [moduleOver, setModuleOver] = useState(false);
  const lessonDragRef = useRef<string | null>(null);
  const quizDragRef = useRef<string | null>(null);

  const handleLessonDrop = (targetId: string) => {
    const fromId = lessonDragRef.current;
    if (!fromId || fromId === targetId) return;
    const from = module.lessons.findIndex((l) => l.id === fromId);
    const to = module.lessons.findIndex((l) => l.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...module.lessons];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    cb.onReorderLessons(module.id, next.map((l, i) => ({ ...l, order: i + 1 })));
    lessonDragRef.current = null;
  };

  const handleQuizDrop = (targetId: string) => {
    const fromId = quizDragRef.current;
    if (!fromId || fromId === targetId) return;
    const from = module.quizQuestions.findIndex((q) => q.id === fromId);
    const to = module.quizQuestions.findIndex((q) => q.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...module.quizQuestions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    cb.onReorderQuizzes(module.id, next.map((q, i) => ({ ...q, order: i + 1 })));
    quizDragRef.current = null;
  };

  return (
    <div
      draggable
      onDragStart={() => moduleDrag.onModuleDragStart(module.id)}
      onDragOver={(e) => { moduleDrag.onModuleDragOver(e); setModuleOver(true); }}
      onDragLeave={() => setModuleOver(false)}
      onDrop={(e) => { e.preventDefault(); setModuleOver(false); moduleDrag.onModuleDrop(module.id); }}
      className={`rounded-2xl border bg-white transition-all ${moduleOver ? 'border-primary-400 ring-2 ring-primary/20' : 'border-gray-200'}`}
    >
      {/* Module header */}
      <div className="flex items-center gap-3 p-4">
        <GripVertical className="h-5 w-5 shrink-0 cursor-grab text-gray-300 active:cursor-grabbing" />
        <button
          type="button"
          onClick={() => cb.onToggle(module.id)}
          className="flex flex-1 items-center gap-3 text-left min-w-0"
        >
          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white bg-gradient-to-br ${module.colorGradient || 'from-gray-400 to-gray-500'}`}>
            {module.order}
          </span>
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold text-gray-900 text-sm">{module.title}</p>
            <p className="text-xs text-gray-400">{module.lessons.length} lesson · {module.quizQuestions.length} quiz</p>
          </div>
          {cb.isExpanded
            ? <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            : <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
        </button>
        <div className="flex gap-1 shrink-0">
          <button
            type="button"
            onClick={() => cb.onEditModule(module)}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => cb.onDeleteModule(module.id)}
            disabled={cb.saving}
            className="rounded-lg border border-red-100 p-1.5 text-red-400 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Module body (lessons + quiz) */}
      {cb.isExpanded ? (
        <div className="border-t border-gray-100 px-4 pb-4 pt-3 grid gap-4 md:grid-cols-2">
          {/* Lessons */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                <FileText className="h-3.5 w-3.5" /> Lessons
              </p>
              <button
                type="button"
                onClick={() => cb.onNewLesson(module.id)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-primary-600 hover:bg-primary/5"
              >
                <Plus className="inline h-3 w-3" /> Tambah
              </button>
            </div>
            {module.lessons.length === 0 ? (
              <p className="text-xs italic text-gray-400">Belum ada lesson.</p>
            ) : (
              <div className="space-y-1.5">
                {module.lessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    draggable
                    onDragStart={() => { lessonDragRef.current = lesson.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleLessonDrop(lesson.id); }}
                    className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-300" />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold text-gray-500 shadow-sm">
                      {lesson.order}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-gray-700">{lesson.title}</span>
                    <span className="shrink-0 text-gray-400">{lesson.duration ?? 0}m</span>
                    <button type="button" onClick={() => cb.onEditLesson(module.id, lesson)} className="shrink-0 text-primary-500 hover:text-primary-700">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => cb.onDeleteLesson(lesson.id)} className="shrink-0 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quiz */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-400">
                <HelpCircle className="h-3.5 w-3.5" /> Quiz
              </p>
              <button
                type="button"
                onClick={() => cb.onNewQuiz(module.id)}
                className="rounded-lg border border-gray-200 px-2 py-1 text-[11px] font-semibold text-primary-600 hover:bg-primary/5"
              >
                <Plus className="inline h-3 w-3" /> Tambah
              </button>
            </div>
            {module.quizQuestions.length === 0 ? (
              <p className="text-xs italic text-gray-400">Belum ada quiz.</p>
            ) : (
              <div className="space-y-1.5">
                {module.quizQuestions.map((q) => (
                  <div
                    key={q.id}
                    draggable
                    onDragStart={() => { quizDragRef.current = q.id; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); handleQuizDrop(q.id); }}
                    className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 text-xs"
                  >
                    <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-gray-300" />
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold text-gray-500 shadow-sm">
                      {q.order}
                    </span>
                    <span className="flex-1 min-w-0 truncate font-medium text-gray-700">{q.question}</span>
                    <button type="button" onClick={() => cb.onEditQuiz(module.id, q)} className="shrink-0 text-primary-500 hover:text-primary-700">
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button type="button" onClick={() => cb.onDeleteQuiz(q.id)} className="shrink-0 text-red-400 hover:text-red-600">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminAcademyContent() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget>(null);

  // Drafts
  const [courseDraft, setCourseDraft] = useState<CourseDraft>(emptyCourseDraft);
  const [moduleDraft, setModuleDraft] = useState<ModuleDraft>(makeModuleDraft());
  const [lessonDraft, setLessonDraft] = useState<LessonDraft>(makeLessonDraft());
  const [quizDraft, setQuizDraft] = useState<QuizDraft>(makeQuizDraft());

  // Module-level drag state (managed at parent, passed to each ModuleCard)
  const moduleDragRef = useRef<string | null>(null);
  const onModuleDragStart = (id: string) => { moduleDragRef.current = id; };
  const onModuleDragOver = (e: React.DragEvent) => e.preventDefault();
  const onModuleDrop = (targetId: string) => {
    const fromId = moduleDragRef.current;
    if (!fromId || fromId === targetId || !detail) return;
    const from = detail.modules.findIndex((m) => m.id === fromId);
    const to = detail.modules.findIndex((m) => m.id === targetId);
    if (from === -1 || to === -1) return;
    const next = [...detail.modules];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved!);
    void reorderModules(next.map((m, i) => ({ ...m, order: i + 1 })));
    moduleDragRef.current = null;
  };

  // ── Data loaders ─────────────────────────────────────────────────────────────

  const loadDetail = useCallback(async (courseId: string) => {
    const res = await fetch(`/api/academy/admin/courses/${courseId}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat detail course'));
    const json = (await res.json()) as { data: CourseDetail };
    setDetail(json.data);
    setCourseDraft(courseToDraft(json.data));
    const firstModuleId = json.data.modules?.[0]?.id ?? '';
    setModuleDraft(makeModuleDraft((json.data.modules?.length ?? 0) + 1));
    setLessonDraft(makeLessonDraft(firstModuleId, (json.data.modules?.[0]?.lessons.length ?? 0) + 1));
    setQuizDraft(makeQuizDraft(firstModuleId, (json.data.modules?.[0]?.quizQuestions.length ?? 0) + 1));
    setExpandedModules(new Set(json.data.modules.map((m) => m.id)));
  }, []);

  const loadCourses = useCallback(async (nextSelectedId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/academy/admin/courses?status=all', { cache: 'no-store' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal memuat konten Academy'));
      const json = (await res.json()) as { data: CourseRow[] };
      setCourses(json.data ?? []);
      const nextId = nextSelectedId ?? selectedCourseId ?? json.data?.[0]?.id ?? '';
      if (nextId) {
        setSelectedCourseId(nextId);
        await loadDetail(nextId);
      } else {
        setDetail(null);
        setCourseDraft(emptyCourseDraft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }, [loadDetail, selectedCourseId]);

  useEffect(() => { void loadCourses(); }, [loadCourses]);

  // ── Course CRUD ───────────────────────────────────────────────────────────────

  const saveCourse = async () => {
    if (!courseDraft.slug.trim() || !courseDraft.title.trim()) { setError('Slug dan title course wajib diisi.'); return; }
    setSaving(true); setError(null); setMessage(null);
    try {
      const payload = { ...courseDraft, slug: courseDraft.slug.trim(), title: courseDraft.title.trim(), description: courseDraft.description.trim() || null, category: courseDraft.category.trim() || null, thumbnail: courseDraft.thumbnail.trim() || null, totalDuration: Number(courseDraft.totalDuration || 0) };
      const res = await fetch(selectedCourseId ? `/api/academy/admin/courses/${selectedCourseId}` : '/api/academy/admin/courses', { method: selectedCourseId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan course'));
      const json = (await res.json()) as { data: CourseRow };
      setMessage(selectedCourseId ? 'Course diperbarui.' : 'Course dibuat.');
      setEditTarget(null);
      await loadCourses(json.data.id);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const deleteCourse = async () => {
    if (!selectedCourseId || !window.confirm('Hapus course ini beserta semua isinya?')) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/academy/admin/courses/${selectedCourseId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus course'));
      setMessage('Course dihapus.'); setSelectedCourseId(''); setEditTarget(null);
      await loadCourses('');
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  // ── Module CRUD ───────────────────────────────────────────────────────────────

  const saveModule = async () => {
    if (!selectedCourseId || !moduleDraft.title.trim()) { setError('Isi title module.'); return; }
    setSaving(true); setError(null);
    try {
      const payload = { ...moduleDraft, title: moduleDraft.title.trim(), description: moduleDraft.description.trim() || null, order: Number(moduleDraft.order || 1) };
      const url = moduleDraft.id ? `/api/academy/admin/modules/${moduleDraft.id}` : `/api/academy/admin/courses/${selectedCourseId}/modules`;
      const res = await fetch(url, { method: moduleDraft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan module'));
      setMessage(moduleDraft.id ? 'Module diperbarui.' : 'Module ditambahkan.');
      setEditTarget(null);
      await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const deleteModule = async (moduleId: string) => {
    if (!window.confirm('Hapus module ini beserta semua lesson dan quiz?')) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/academy/admin/modules/${moduleId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus module'));
      setMessage('Module dihapus.'); setEditTarget(null);
      if (selectedCourseId) await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  // ── Lesson CRUD ───────────────────────────────────────────────────────────────

  const saveLesson = async () => {
    if (!lessonDraft.moduleId || !lessonDraft.title.trim()) { setError('Pilih module dan isi title lesson.'); return; }
    setSaving(true); setError(null);
    try {
      let contentData: unknown = null;
      if (lessonDraft.contentDataText.trim()) contentData = JSON.parse(lessonDraft.contentDataText);
      const payload = { title: lessonDraft.title.trim(), description: lessonDraft.description.trim() || null, duration: Number(lessonDraft.duration || 15), contentType: lessonDraft.contentType, contentData, order: Number(lessonDraft.order || 1), isRequired: lessonDraft.isRequired };
      const url = lessonDraft.id ? `/api/academy/admin/lessons/${lessonDraft.id}` : `/api/academy/admin/modules/${lessonDraft.moduleId}/lessons`;
      const res = await fetch(url, { method: lessonDraft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan lesson'));
      setMessage(lessonDraft.id ? 'Lesson diperbarui.' : 'Lesson ditambahkan.');
      setEditTarget(null);
      if (selectedCourseId) await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Content JSON tidak valid atau request gagal.'); }
    finally { setSaving(false); }
  };

  const deleteLesson = async (lessonId: string) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/academy/admin/lessons/${lessonId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus lesson'));
      setMessage('Lesson dihapus.'); setEditTarget(null);
      if (selectedCourseId) await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  // ── Quiz CRUD ─────────────────────────────────────────────────────────────────

  const saveQuiz = async () => {
    if (!quizDraft.moduleId || !quizDraft.question.trim()) { setError('Pilih module dan isi pertanyaan quiz.'); return; }
    setSaving(true); setError(null);
    try {
      const options = quizDraft.optionsText.split('\n').map((o) => o.trim()).filter(Boolean);
      const payload = { question: quizDraft.question.trim(), options, correctIndex: Number(quizDraft.correctIndex || 0), explanation: quizDraft.explanation.trim() || null, difficulty: quizDraft.difficulty, order: Number(quizDraft.order || 1) };
      const url = quizDraft.id ? `/api/academy/admin/quiz-questions/${quizDraft.id}` : `/api/academy/admin/modules/${quizDraft.moduleId}/quiz-questions`;
      const res = await fetch(url, { method: quizDraft.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menyimpan quiz'));
      setMessage(quizDraft.id ? 'Quiz diperbarui.' : 'Quiz ditambahkan.');
      setEditTarget(null);
      if (selectedCourseId) await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  const deleteQuiz = async (questionId: string) => {
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/academy/admin/quiz-questions/${questionId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(await readApiError(res, 'Gagal menghapus quiz'));
      setMessage('Quiz dihapus.'); setEditTarget(null);
      if (selectedCourseId) await loadDetail(selectedCourseId);
    } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
    finally { setSaving(false); }
  };

  // ── Reorder helpers ───────────────────────────────────────────────────────────

  const patchOrder = (url: string, order: number) =>
    fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order }) });

  const reorderModules = async (reordered: ModuleRow[]) => {
    if (!detail) return;
    const prev = detail.modules;
    setDetail({ ...detail, modules: reordered });
    try {
      await Promise.all(reordered.map((m, i) => {
        const orig = prev.find((x) => x.id === m.id);
        return orig && orig.order !== i + 1 ? patchOrder(`/api/academy/admin/modules/${m.id}`, i + 1) : Promise.resolve();
      }));
    } catch { setError('Gagal menyimpan urutan module.'); }
  };

  const reorderLessons = async (moduleId: string, reordered: LessonRow[]) => {
    if (!detail) return;
    const prevModule = detail.modules.find((m) => m.id === moduleId);
    setDetail({ ...detail, modules: detail.modules.map((m) => m.id === moduleId ? { ...m, lessons: reordered } : m) });
    try {
      await Promise.all(reordered.map((l, i) => {
        const orig = prevModule?.lessons.find((x) => x.id === l.id);
        return orig && orig.order !== i + 1 ? patchOrder(`/api/academy/admin/lessons/${l.id}`, i + 1) : Promise.resolve();
      }));
    } catch { setError('Gagal menyimpan urutan lesson.'); }
  };

  const reorderQuizzes = async (moduleId: string, reordered: QuizQuestionRow[]) => {
    if (!detail) return;
    const prevModule = detail.modules.find((m) => m.id === moduleId);
    setDetail({ ...detail, modules: detail.modules.map((m) => m.id === moduleId ? { ...m, quizQuestions: reordered } : m) });
    try {
      await Promise.all(reordered.map((q, i) => {
        const orig = prevModule?.quizQuestions.find((x) => x.id === q.id);
        return orig && orig.order !== i + 1 ? patchOrder(`/api/academy/admin/quiz-questions/${q.id}`, i + 1) : Promise.resolve();
      }));
    } catch { setError('Gagal menyimpan urutan quiz.'); }
  };

  // ── Open edit panels ──────────────────────────────────────────────────────────

  const openEditCourse = () => setEditTarget({ kind: 'course' });

  const openNewModule = () => {
    setModuleDraft(makeModuleDraft((detail?.modules.length ?? 0) + 1));
    setEditTarget({ kind: 'module', moduleId: '' });
  };

  const openEditModule = (m: ModuleRow) => {
    setModuleDraft(moduleToDraft(m));
    setEditTarget({ kind: 'module', moduleId: m.id });
  };

  const openNewLesson = (moduleId: string) => {
    const mod = detail?.modules.find((m) => m.id === moduleId);
    setLessonDraft(makeLessonDraft(moduleId, (mod?.lessons.length ?? 0) + 1));
    setEditTarget({ kind: 'lesson', lessonId: '', moduleId });
  };

  const openEditLesson = (moduleId: string, l: LessonRow) => {
    setLessonDraft(lessonToDraft(moduleId, l));
    setEditTarget({ kind: 'lesson', lessonId: l.id, moduleId });
  };

  const openNewQuiz = (moduleId: string) => {
    const mod = detail?.modules.find((m) => m.id === moduleId);
    setQuizDraft(makeQuizDraft(moduleId, (mod?.quizQuestions.length ?? 0) + 1));
    setEditTarget({ kind: 'quiz', questionId: '', moduleId });
  };

  const openEditQuiz = (moduleId: string, q: QuizQuestionRow) => {
    setQuizDraft(quizToDraft(moduleId, q));
    setEditTarget({ kind: 'quiz', questionId: q.id, moduleId });
  };

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) { next.delete(moduleId); } else { next.add(moduleId); }
      return next;
    });
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col">

      {/* Page header */}
      <div className="border-b border-gray-200 bg-white px-6 py-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <GraduationCap className="h-5 w-5 text-primary-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Manajemen Academy</h1>
              <p className="text-sm text-gray-500">Kelola course, module, lesson, dan quiz</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void loadCourses()}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedCourseId('');
                setDetail(null);
                setCourseDraft(emptyCourseDraft);
                setEditTarget({ kind: 'course' });
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4" /> Buat Course
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</div>
        ) : null}
        {message ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" /> {message}
          </div>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">

        {/* Course list sidebar */}
        <div className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Daftar Course</p>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />)}
              </div>
            ) : courses.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-4 text-center text-sm text-gray-400">
                Belum ada course.
              </div>
            ) : (
              <div className="space-y-1.5">
                {courses.map((course) => (
                  <button
                    key={course.id}
                    type="button"
                    onClick={async () => {
                      setSelectedCourseId(course.id);
                      setError(null); setMessage(null); setEditTarget(null);
                      try { await loadDetail(course.id); } catch (err) { setError(err instanceof Error ? err.message : 'Terjadi kesalahan.'); }
                    }}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition-all ${selectedCourseId === course.id ? 'border-primary-200 bg-primary/5 shadow-sm' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="block text-sm font-semibold leading-tight text-gray-900">{course.title}</span>
                      <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[course.status]}`}>{course.status}</span>
                    </span>
                    <span className="mt-1 block text-xs text-gray-400">{course.moduleCount ?? 0} module</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-6">
          {!detail && !loading ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <BookOpen className="h-12 w-12 text-gray-300" />
              <p className="mt-3 text-sm text-gray-400">Pilih course di sebelah kiri atau buat course baru.</p>
            </div>
          ) : detail ? (
            <div className="mx-auto max-w-3xl space-y-4">

              {/* Course header card */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-gray-900">{detail.title}</h2>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGE[detail.status]}`}>{detail.status}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{detail.description || 'Tanpa deskripsi'}</p>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                      <span>Slug: <span className="font-mono font-medium text-gray-700">{detail.slug}</span></span>
                      <span>Kategori: <span className="font-medium text-gray-700">{detail.category ?? '—'}</span></span>
                      <span>Durasi: <span className="font-medium text-gray-700">{detail.totalDuration ?? 0} menit</span></span>
                      <span>Difficulty: <span className="font-medium text-gray-700">{detail.difficulty ?? '—'}</span></span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={openEditCourse} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </button>
                    <button type="button" onClick={() => void deleteCourse()} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 className="h-3.5 w-3.5" /> Hapus
                    </button>
                  </div>
                </div>
              </div>

              {/* Modules */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900">
                    Module{' '}
                    <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                      {detail.modules.length}
                    </span>
                  </h3>
                  <button
                    type="button"
                    onClick={openNewModule}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Module
                  </button>
                </div>

                {detail.modules.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-400">
                    Belum ada module. Klik &ldquo;Tambah Module&rdquo; untuk memulai.
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <GripVertical className="h-3.5 w-3.5" />
                      Drag &amp; drop untuk mengubah urutan module, lesson, atau quiz
                    </p>
                    {detail.modules.map((module) => (
                      <ModuleCard
                        key={module.id}
                        module={module}
                        moduleDrag={{ onModuleDragStart, onModuleDragOver, onModuleDrop }}
                        cb={{
                          onEditModule: openEditModule,
                          onDeleteModule: (id) => void deleteModule(id),
                          onNewLesson: openNewLesson,
                          onEditLesson: openEditLesson,
                          onDeleteLesson: (id) => void deleteLesson(id),
                          onNewQuiz: openNewQuiz,
                          onEditQuiz: openEditQuiz,
                          onDeleteQuiz: (id) => void deleteQuiz(id),
                          onReorderLessons: (mid, r) => void reorderLessons(mid, r),
                          onReorderQuizzes: (mid, r) => void reorderQuizzes(mid, r),
                          saving,
                          isExpanded: expandedModules.has(module.id),
                          onToggle: toggleModule,
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* ── Edit panels ───────────────────────────────────────────────────────── */}

      {editTarget?.kind === 'course' ? (
        <Panel title={selectedCourseId ? 'Edit Course' : 'Buat Course Baru'} onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Slug" value={courseDraft.slug} onChange={(v) => setCourseDraft((d) => ({ ...d, slug: v }))} placeholder="nama-course" />
              <Field label="Title" value={courseDraft.title} onChange={(v) => setCourseDraft((d) => ({ ...d, title: v }))} />
              <Field label="Kategori" value={courseDraft.category} onChange={(v) => setCourseDraft((d) => ({ ...d, category: v }))} />
              <Field label="Total Durasi (menit)" type="number" value={courseDraft.totalDuration} onChange={(v) => setCourseDraft((d) => ({ ...d, totalDuration: v }))} />
              <SelectField label="Difficulty" value={courseDraft.difficulty} onChange={(v) => setCourseDraft((d) => ({ ...d, difficulty: v }))} options={[{ value: 'beginner', label: 'Beginner' }, { value: 'intermediate', label: 'Intermediate' }, { value: 'advanced', label: 'Advanced' }]} />
              <SelectField label="Status" value={courseDraft.status} onChange={(v) => setCourseDraft((d) => ({ ...d, status: v }))} options={[{ value: 'draft', label: 'Draft' }, { value: 'published', label: 'Published' }, { value: 'archived', label: 'Archived' }]} />
            </div>
            <Field label="Thumbnail URL" value={courseDraft.thumbnail} onChange={(v) => setCourseDraft((d) => ({ ...d, thumbnail: v }))} placeholder="https://..." />
            <Field label="Deskripsi" value={courseDraft.description} onChange={(v) => setCourseDraft((d) => ({ ...d, description: v }))} rows={3} />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={courseDraft.isPublic} onChange={(e) => setCourseDraft((d) => ({ ...d, isPublic: e.target.checked }))} className="rounded" />
              <span className="font-medium">Public</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="button" disabled={saving} onClick={() => void saveCourse()} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {editTarget?.kind === 'module' ? (
        <Panel title={moduleDraft.id ? 'Edit Module' : 'Tambah Module'} onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <Field label="Title" value={moduleDraft.title} onChange={(v) => setModuleDraft((d) => ({ ...d, title: v }))} />
            <Field label="Deskripsi" value={moduleDraft.description} onChange={(v) => setModuleDraft((d) => ({ ...d, description: v }))} rows={2} />
            <Field label="Urutan" type="number" value={moduleDraft.order} onChange={(v) => setModuleDraft((d) => ({ ...d, order: v }))} />
            <Field label="Color Gradient (Tailwind)" value={moduleDraft.colorGradient} onChange={(v) => setModuleDraft((d) => ({ ...d, colorGradient: v }))} placeholder="from-purple-500 to-indigo-500" />
            <Field label="BG Color (Tailwind)" value={moduleDraft.bgColor} onChange={(v) => setModuleDraft((d) => ({ ...d, bgColor: v }))} placeholder="bg-purple-50" />
            <Field label="Icon Color (Tailwind)" value={moduleDraft.iconColor} onChange={(v) => setModuleDraft((d) => ({ ...d, iconColor: v }))} placeholder="text-purple-600" />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="button" disabled={saving} onClick={() => void saveModule()} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {editTarget?.kind === 'lesson' ? (
        <Panel title={lessonDraft.id ? 'Edit Lesson' : 'Tambah Lesson'} onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <SelectField label="Module" value={lessonDraft.moduleId} onChange={(v) => setLessonDraft((d) => ({ ...d, moduleId: v }))} options={detail?.modules.map((m) => ({ value: m.id, label: `${m.order}. ${m.title}` })) ?? []} />
            <Field label="Title" value={lessonDraft.title} onChange={(v) => setLessonDraft((d) => ({ ...d, title: v }))} />
            <Field label="Deskripsi" value={lessonDraft.description} onChange={(v) => setLessonDraft((d) => ({ ...d, description: v }))} rows={2} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Urutan" type="number" value={lessonDraft.order} onChange={(v) => setLessonDraft((d) => ({ ...d, order: v }))} />
              <Field label="Durasi (menit)" type="number" value={lessonDraft.duration} onChange={(v) => setLessonDraft((d) => ({ ...d, duration: v }))} />
            </div>
            <SelectField label="Tipe Konten" value={lessonDraft.contentType} onChange={(v) => setLessonDraft((d) => ({ ...d, contentType: v }))} options={[{ value: 'text', label: 'Text' }, { value: 'video', label: 'Video' }, { value: 'slides', label: 'Slides' }]} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Content Data (JSON)</span>
              <textarea rows={6} value={lessonDraft.contentDataText} onChange={(e) => setLessonDraft((d) => ({ ...d, contentDataText: e.target.value }))} className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2 font-mono text-xs outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20" />
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={lessonDraft.isRequired} onChange={(e) => setLessonDraft((d) => ({ ...d, isRequired: e.target.checked }))} className="rounded" />
              <span className="font-medium">Wajib diselesaikan</span>
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="button" disabled={saving} onClick={() => void saveLesson()} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </Panel>
      ) : null}

      {editTarget?.kind === 'quiz' ? (
        <Panel title={quizDraft.id ? 'Edit Quiz' : 'Tambah Quiz'} onClose={() => setEditTarget(null)}>
          <div className="space-y-4">
            <SelectField label="Module" value={quizDraft.moduleId} onChange={(v) => setQuizDraft((d) => ({ ...d, moduleId: v }))} options={detail?.modules.map((m) => ({ value: m.id, label: `${m.order}. ${m.title}` })) ?? []} />
            <Field label="Pertanyaan" value={quizDraft.question} onChange={(v) => setQuizDraft((d) => ({ ...d, question: v }))} rows={2} />
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold text-gray-600">Pilihan Jawaban (satu per baris)</span>
              <textarea rows={4} value={quizDraft.optionsText} onChange={(e) => setQuizDraft((d) => ({ ...d, optionsText: e.target.value }))} className="w-full resize-y rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary/20" />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Jawaban Benar (index 0)" type="number" value={quizDraft.correctIndex} onChange={(v) => setQuizDraft((d) => ({ ...d, correctIndex: v }))} />
              <SelectField label="Difficulty" value={quizDraft.difficulty} onChange={(v) => setQuizDraft((d) => ({ ...d, difficulty: v }))} options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
            </div>
            <Field label="Penjelasan" value={quizDraft.explanation} onChange={(v) => setQuizDraft((d) => ({ ...d, explanation: v }))} rows={2} />
            <Field label="Urutan" type="number" value={quizDraft.order} onChange={(v) => setQuizDraft((d) => ({ ...d, order: v }))} />
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditTarget(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="button" disabled={saving} onClick={() => void saveQuiz()} className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
                {saving ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Simpan'}
              </button>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
