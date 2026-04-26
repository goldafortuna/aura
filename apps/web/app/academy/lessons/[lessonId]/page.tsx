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
  contentData?: {
    slideRange?: { start?: number; end?: number };
  } | null;
  module: { id: string; title: string; order: number };
  course: { id: string; title: string; slug: string };
  previousLesson: { id: string; title: string } | null;
  nextLesson: { id: string; title: string } | null;
  isCompleted: boolean;
};

function formatDuration(minutes: number | null | undefined) {
  return minutes ? `${minutes} menit` : 'Durasi tidak tersedia';
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
    if (!lesson || saving || lesson.isCompleted) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/academy/progress/lessons/${lesson.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeSpent: Math.max(60, (lesson.duration ?? 5) * 60) }),
      });
      if (!res.ok) throw new Error(`Gagal menandai lesson selesai (HTTP ${res.status})`);

      setLesson({ ...lesson, isCompleted: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan progres lesson.');
    } finally {
      setSaving(false);
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
  const pdfSrc = `/api/academy/lessons/${lesson.id}/asset#page=${startPage}&toolbar=1&navpanes=0`;

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
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-sky-600">Lesson PDF</p>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">{lesson.title}</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">{lesson.description ?? 'Deskripsi lesson belum tersedia.'}</p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1"><FileText className="h-3.5 w-3.5" /> PDF viewer</span>
              <span className="rounded-full bg-gray-100 px-3 py-1">{formatDuration(lesson.duration)}</span>
              <span className="rounded-full bg-sky-50 px-3 py-1 text-sky-700">Halaman {startPage}-{endPage}</span>
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
            <a
              href={pdfSrc}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Buka PDF di tab baru
            </a>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
        <iframe
          src={pdfSrc}
          title={lesson.title}
          className="h-[75vh] w-full"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Modul Saat Ini</p>
          <h2 className="mt-2 text-lg font-semibold text-gray-900">{lesson.module.title}</h2>
          <p className="mt-2 text-sm text-gray-600">Lanjutkan membaca seluruh lesson pada modul ini sebelum membuka quiz akhir modul.</p>
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
              onClick={() => router.push(`/academy/lessons/${lesson.nextLesson?.id}`)}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
            >
              {lesson.nextLesson.title}
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <p className="text-sm text-gray-500">Ini adalah lesson terakhir pada modul ini.</p>
              <Link
                href={courseBackHref}
                className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800"
              >
                Kembali ke halaman course
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
