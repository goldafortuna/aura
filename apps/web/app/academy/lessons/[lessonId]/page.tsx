'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, FileText, Loader2 } from 'lucide-react';

type LessonDetail = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  contentType: 'text' | 'video' | 'slides';
  contentData?: {
    hero?: {
      imageUrl?: string;
      alt?: string;
      eyebrow?: string;
      caption?: string;
    };
    intro?: {
      eyebrow?: string;
      heading?: string;
      body?: string;
      points?: string[];
    };
    slideRange?: { start?: number; end?: number };
    sections?: { heading?: string; body?: string; points?: string[] }[];
  } | null;
  module: { id: string; title: string; order: number };
  course: { id: string; title: string; slug: string };
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
  hasQuiz: boolean;
  isCompleted: boolean;
};

function formatDuration(minutes: number | null | undefined) {
  return minutes ? `${minutes} menit` : 'Durasi tidak tersedia';
}

function getLessonKindLabel(lesson: LessonDetail) {
  if (lesson.contentType === 'text') {
    return lesson.title.toLowerCase().includes('pengantar') ? 'Pengantar modul' : 'Text lesson';
  }

  return 'Lesson PDF';
}

export default function AcademyLessonPage({ params }: { params: { lessonId: string } }) {
  const router = useRouter();
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLesson = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/academy/lessons/${params.lessonId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Gagal memuat lesson (HTTP ${res.status})`);
        const json = await res.json();
        if (!cancelled) setLesson(json.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat lesson.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchLesson();
    return () => {
      cancelled = true;
    };
  }, [params.lessonId]);

  const markComplete = async () => {
    if (!lesson) return false;
    if (saving || lesson.isCompleted) return lesson.isCompleted;

    setSaving(true);
    try {
      const res = await fetch(`/api/academy/progress/lessons/${lesson.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSpent: Math.max(60, (lesson.duration ?? 5) * 60) }),
      });
      if (!res.ok) throw new Error(`Gagal menandai lesson selesai (HTTP ${res.status})`);

      setLesson({ ...lesson, isCompleted: true });
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan progres lesson.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const continueToLesson = async (targetLessonId: string) => {
    const completed = await markComplete();
    if (completed) {
      router.push(`/academy/lessons/${targetLessonId}`);
    }
  };

  const continueToQuiz = async () => {
    if (!lesson) return;
    const completed = await markComplete();
    if (completed) {
      if (lesson.hasQuiz) {
        router.push(`/academy/courses/${lesson.course.id}/modules/${lesson.module.id}/quiz`);
        return;
      }

      router.push(`/academy/courses/${lesson.course.id}`);
    }
  };

  if (loading) {
    return <div className="h-80 animate-pulse rounded-3xl bg-white" />;
  }

  if (error || !lesson) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Lesson tidak bisa dimuat.</p>
        <p className="mt-2 text-sm">{error ?? 'Data lesson tidak ditemukan.'}</p>
      </div>
    );
  }

  const courseBackHref = `/academy/courses/${lesson.course.id}`;
  const startPage = lesson.contentData?.slideRange?.start ?? 1;
  const endPage = lesson.contentData?.slideRange?.end ?? startPage;
  const pdfSrc = `/api/academy/lessons/${lesson.id}/asset#page=${startPage}&toolbar=0&navpanes=0&scrollbar=0&view=FitH`;
  const textSections = Array.isArray(lesson.contentData?.sections) ? lesson.contentData.sections : [];
  const isTextLesson = lesson.contentType === 'text';
  const hero = lesson.contentData?.hero;
  const lessonIntro = lesson.contentData?.intro;
  const nextLessonId = lesson.nextLesson?.id ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={courseBackHref} className="inline-flex items-center gap-2 font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke course
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-500">Modul {lesson.module.order}</span>
      </div>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">{getLessonKindLabel(lesson)}</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{lesson.title}</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">{lesson.description ?? 'Deskripsi lesson belum tersedia.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1"><FileText className="h-3.5 w-3.5" /> {isTextLesson ? 'Materi teks' : 'PDF viewer'}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">{formatDuration(lesson.duration)}</span>
              {!isTextLesson ? <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">Halaman {startPage}-{endPage}</span> : null}
              {lesson.isCompleted ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Lesson selesai
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[220px]">
            <button
              type="button"
              onClick={() => void markComplete()}
              disabled={saving || lesson.isCompleted}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {lesson.isCompleted ? 'Sudah Selesai' : 'Tandai Selesai'}
            </button>
          </div>
        </div>
      </section>

      {isTextLesson ? (
        <section className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="space-y-10">
            {hero?.imageUrl ? (
              <div className="overflow-hidden rounded-[2rem] border border-sky-100 bg-sky-50">
                <div className="grid gap-0 lg:grid-cols-[1.25fr_0.85fr]">
                  <div className="min-h-[300px] bg-slate-100">
                    <img
                      src={hero.imageUrl}
                      alt={hero.alt ?? lesson.title}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="flex flex-col justify-center gap-4 bg-gradient-to-br from-sky-50 via-cyan-50 to-white p-8">
                    {hero.eyebrow ? (
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">{hero.eyebrow}</p>
                    ) : null}
                    <h2 className="text-2xl font-semibold leading-tight text-gray-900">{lesson.module.title}</h2>
                    <p className="text-base leading-7 text-gray-700">
                      {hero.caption ?? 'Pelajari fondasi penting yang akan membentuk cara kerja profesionalmu di modul ini.'}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {textSections.map((section, index) => (
              <article key={`${section.heading ?? 'section'}-${index}`} className="max-w-4xl space-y-3">
                <h2 className="text-2xl font-semibold text-gray-900">{section.heading ?? `Bagian ${index + 1}`}</h2>
                {section.body ? <p className="text-base leading-8 text-gray-700">{section.body}</p> : null}
                {Array.isArray(section.points) && section.points.length > 0 ? (
                  <ul className="space-y-3">
                    {section.points.map((point, pointIndex) => (
                      <li key={`${section.heading ?? 'section'}-${pointIndex}`} className="flex items-start gap-3 text-base leading-7 text-gray-700">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : (
        <div className="space-y-6">
          {lessonIntro && (lessonIntro.body || (Array.isArray(lessonIntro.points) && lessonIntro.points.length > 0)) ? (
            <section className="rounded-3xl border border-sky-100 bg-gradient-to-br from-sky-50 via-white to-cyan-50 p-6 shadow-sm">
              <div className="max-w-4xl space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-700">
                    {lessonIntro.eyebrow ?? 'Pengantar lesson'}
                  </p>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    {lessonIntro.heading ?? `Sebelum masuk ke ${lesson.title}`}
                  </h2>
                </div>
                {lessonIntro.body ? <p className="text-base leading-8 text-gray-700">{lessonIntro.body}</p> : null}
                {Array.isArray(lessonIntro.points) && lessonIntro.points.length > 0 ? (
                  <ul className="space-y-3">
                    {lessonIntro.points.map((point, pointIndex) => (
                      <li key={`lesson-intro-${pointIndex}`} className="flex items-start gap-3 text-base leading-7 text-gray-700">
                        <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
            <iframe
              src={pdfSrc}
              title={lesson.title}
              className="h-[75vh] w-full"
            />
          </section>
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Modul Saat Ini</p>
            <h2 className="mt-2 text-lg font-semibold text-gray-900">{lesson.module.title}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {lesson.hasQuiz
                ? 'Lanjutkan membaca seluruh lesson pada modul ini sebelum membuka quiz akhir modul.'
                : 'Selesaikan seluruh lesson pada modul ini untuk menuntaskan pembelajaran tanpa quiz akhir.'}
            </p>
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Navigasi</p>
          {lesson.previousLesson ? (
            <Link href={`/academy/lessons/${lesson.previousLesson.id}`} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800">
              <ArrowLeft className="h-4 w-4" />
              {lesson.previousLesson.title}
            </Link>
          ) : (
            <p className="mt-3 text-sm text-gray-500">Ini adalah lesson pertama pada modul ini.</p>
          )}
        </div>

        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Langkah Berikutnya</p>
          {lesson.nextLesson ? (
            <button
              type="button"
              onClick={() => nextLessonId ? void continueToLesson(nextLessonId) : undefined}
              disabled={saving}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              {lesson.nextLesson.title}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-500">Ini adalah lesson terakhir pada modul ini.</p>
              <button
                type="button"
                onClick={() => void continueToQuiz()}
                disabled={saving}
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {lesson.hasQuiz ? 'Lanjut ke quiz modul' : 'Selesaikan dan kembali ke modul'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
