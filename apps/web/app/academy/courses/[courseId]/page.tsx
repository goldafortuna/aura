'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, CheckCircle2, ChevronRight, Clock, FileText, HelpCircle, Lock } from 'lucide-react';

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  duration: number | null;
  order: number;
  isCompleted: boolean;
};

type Module = {
  id: string;
  title: string;
  description: string | null;
  order: number;
  colorGradient: string | null;
  lessons: Lesson[];
  completedLessons: number;
  quizQuestionCount: number;
  quizCompleted: boolean;
};

type CourseDetail = {
  id: string;
  title: string;
  description: string | null;
  totalDuration: number | null;
  difficulty: string | null;
  modules: Module[];
  userProgress: {
    progressPercentage: number;
    status: string;
  } | null;
};

function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return '0 menit';
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} jam ${remainder} menit` : `${hours} jam`;
}

function getModuleHeroClass(order: number) {
  switch (order) {
    case 1:
      return 'from-sky-500 to-cyan-500';
    case 2:
      return 'from-emerald-500 to-teal-500';
    case 3:
      return 'from-amber-500 to-orange-500';
    case 4:
      return 'from-violet-500 to-indigo-500';
    case 5:
      return 'from-fuchsia-500 to-rose-500';
    default:
      return 'from-slate-700 to-slate-600';
  }
}

export default function AcademyCourseDetailPage({ params }: { params: { courseId: string } }) {
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchCourse = async () => {
      setLoading(true);
      setError(null);
      try {
        await fetch(`/api/academy/progress/courses/${params.courseId}`, { cache: 'no-store' });
        const res = await fetch(`/api/academy/courses/${params.courseId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Gagal memuat detail course (HTTP ${res.status})`);
        const json = await res.json();
        if (!cancelled) setCourse(json.data ?? null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat detail course.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchCourse();
    return () => {
      cancelled = true;
    };
  }, [params.courseId]);

  if (loading) {
    return <div className="h-64 animate-pulse rounded-3xl bg-white" />;
  }

  if (error || !course) {
    return (
      <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Course tidak bisa dimuat.</p>
        <p className="mt-2 text-sm">{error ?? 'Data course tidak ditemukan.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/academy/courses" className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke katalog
        </Link>
      </div>

      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-900 to-cyan-800 p-8 text-white">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">Master Course</p>
            <h1 className="mt-3 text-3xl font-bold leading-tight">{course.title}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-200">
              {course.description ?? 'Deskripsi course belum tersedia.'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[280px]">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Modul</p>
              <p className="mt-2 text-2xl font-bold">{course.modules.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Durasi</p>
              <p className="mt-2 text-2xl font-bold">{formatDuration(course.totalDuration)}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Progress</p>
              <p className="mt-2 text-2xl font-bold">{course.userProgress?.progressPercentage ?? 0}%</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-wide text-cyan-100">Level</p>
              <p className="mt-2 text-lg font-bold capitalize">{course.difficulty ?? 'beginner'}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        {course.modules.map((module, index) => {
          const allLessonsCompleted = module.lessons.length > 0 && module.completedLessons === module.lessons.length;
          return (
            <motion.article
              key={module.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm"
            >
              <div className={`bg-gradient-to-r ${getModuleHeroClass(module.order)} p-6 text-white`}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-white/70">Modul {module.order}</p>
                    <h2 className="mt-2 text-2xl font-bold">{module.title}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-white/80">{module.description ?? 'Deskripsi modul belum tersedia.'}</p>
                  </div>
                  <div className="rounded-2xl bg-white/15 px-4 py-3 text-sm backdrop-blur-sm">
                    <p>{module.completedLessons}/{module.lessons.length} lesson selesai</p>
                    <p className="mt-1 text-white/70">{module.quizQuestionCount} soal quiz di akhir modul</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3 p-6">
                {module.lessons.map((lesson) => (
                  <Link
                    key={lesson.id}
                    href={`/academy/lessons/${lesson.id}`}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-gray-200 px-4 py-4 transition-colors hover:border-sky-200 hover:bg-sky-50"
                  >
                    <div className="flex gap-4">
                      <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${lesson.isCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                        {lesson.isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Lesson {lesson.order}</p>
                        <h3 className="mt-1 font-semibold text-gray-900">{lesson.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-gray-600">{lesson.description ?? 'Materi lesson belum tersedia.'}</p>
                        <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {formatDuration(lesson.duration)}</span>
                          <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> PDF lesson</span>
                        </div>
                      </div>
                    </div>
                    <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-gray-400" />
                  </Link>
                ))}

                <div className={`flex items-center justify-between rounded-2xl border px-4 py-4 ${allLessonsCompleted ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl ${allLessonsCompleted ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {allLessonsCompleted ? <HelpCircle className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Quiz Akhir Modul</h3>
                      <p className="mt-1 text-sm text-gray-600">
                        {allLessonsCompleted
                          ? `Semua lesson modul ini sudah selesai. Lanjutkan ke quiz ${module.quizQuestionCount} soal.`
                          : 'Quiz dibuka setelah seluruh lesson pada modul ini selesai dibaca dan ditandai selesai.'}
                      </p>
                    </div>
                  </div>
                  {allLessonsCompleted ? (
                    <Link
                      href={`/academy/courses/${course.id}/modules/${module.id}/quiz`}
                      className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      {module.quizCompleted ? 'Buka Ulang Quiz' : 'Mulai Quiz'}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <span className="rounded-2xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700">Belum terbuka</span>
                  )}
                </div>
              </div>
            </motion.article>
          );
        })}
      </section>
    </div>
  );
}
