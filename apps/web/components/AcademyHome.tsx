'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BookOpen,
  Clock,
  Award,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Trophy,
  Users,
  ChevronRight,
  Star,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Module {
  id: string;
  title: string;
  description: string;
  order: number;
  colorGradient: string | null;
  bgColor: string | null;
  iconColor: string | null;
}

interface Course {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  totalDuration: number | null;
  difficulty: string | null;
  category: string | null;
  modules: Module[];
  userProgress: {
    status: string;
    progressPercentage: number;
    startedAt: string | null;
    lastAccessedAt: string | null;
    completedAt: string | null;
  } | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDuration = (minutes: number) => {
  if (!minutes) return '0 menit';
  if (minutes < 60) return `${minutes} menit`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h} jam ${m} menit` : `${h} jam`;
};

const ProgressRing: React.FC<{ pct: number; size?: number; stroke?: number }> = ({
  pct,
  size = 56,
  stroke = 5,
}) => {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#e5e7eb" strokeWidth={stroke} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="#8b5cf6"
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
    </svg>
  );
};

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AcademyHome() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/academy/courses');
      const json = await res.json();
      if (!json.data) return;

      // Untuk setiap course, fetch detail (modules + progress)
      const detailed: Course[] = await Promise.all(
        (json.data as Course[]).map(async (c) => {
          const det = await fetch(`/api/academy/courses/${c.id}`);
          const d = await det.json();
          return d.data as Course;
        }),
      );

      setCourses(detailed);
    } catch (err) {
      console.error('Gagal memuat kursus:', err);
    } finally {
      setLoading(false);
    }
  };

  const mainCourse = courses[0] ?? null;
  const progress = mainCourse?.userProgress;
  const progressPct = progress?.progressPercentage ?? 0;
  const hasStarted = progressPct > 0;
  const isCompleted = progress?.status === 'completed';
  const totalModules = mainCourse?.modules?.length ?? 0;
  const totalDuration = mainCourse?.totalDuration ?? 0;

  const getDifficultyLabel = (d: string | null) => {
    if (d === 'beginner') return 'Pemula';
    if (d === 'intermediate') return 'Menengah';
    if (d === 'advanced') return 'Lanjutan';
    return 'Semua Level';
  };

  const getDifficultyColor = (d: string | null) => {
    if (d === 'beginner') return 'bg-green-100 text-green-700';
    if (d === 'intermediate') return 'bg-purple-100 text-purple-700';
    if (d === 'advanced') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* ─── HERO ─────────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-purple-600 via-indigo-600 to-blue-600 p-8 text-white">
        {/* Decorative circles */}
        <div className="pointer-events-none absolute inset-0 opacity-10">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-white"
              style={{
                width: `${80 + i * 60}px`,
                height: `${80 + i * 60}px`,
                top: `${-20 + i * 10}px`,
                right: `${-30 + i * 8}px`,
              }}
            />
          ))}
        </div>

        <div className="relative">
          {/* Badge */}
          <div className="mb-3 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
              <Sparkles className="h-3 w-3" /> Microlearning · Bersertifikat
            </span>
          </div>

          <h1 className="mb-2 text-3xl font-bold leading-tight">
            Akademi Sekretaris
            <br />
            Pimpinan Profesional
          </h1>
          <p className="max-w-lg text-sm text-white/80">
            Kuasai seluruh kompetensi menjadi sekretaris pimpinan kelas dunia. Belajar kapan saja, dapatkan sertifikat
            yang diakui secara profesional.
          </p>

          {/* Hero Stats */}
          <div className="mt-6 flex flex-wrap gap-3">
            {loading ? (
              <div className="h-16 w-64 animate-pulse rounded-2xl bg-white/20" />
            ) : (
              <>
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <BookOpen className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{totalModules > 0 ? `${totalModules} Modul` : '—'}</p>
                    <p className="text-xs text-white/70">Total Materi</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <Clock className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">{totalDuration > 0 ? formatDuration(totalDuration) : '—'}</p>
                    <p className="text-xs text-white/70">Total Durasi</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <Award className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Bersertifikat</p>
                    <p className="text-xs text-white/70">Certificate of Completion</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                  <Users className="h-5 w-5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold">Self-paced</p>
                    <p className="text-xs text-white/70">Belajar mandiri</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── PROGRESS SECTION (jika sudah mulai) ─────────────────────────────── */}
      {!loading && hasStarted && mainCourse && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-800">Progres Belajarmu</p>
              <p className="mt-0.5 text-xs text-gray-500">Kursus: {mainCourse.title}</p>
            </div>
            <div className="relative flex-shrink-0">
              <ProgressRing pct={progressPct} />
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-purple-700">
                {progressPct}%
              </span>
            </div>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
              initial={{ width: 0 }}
              animate={{ width: `${progressPct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            />
          </div>

          {isCompleted && (
            <button
              type="button"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 py-2.5 text-sm font-semibold text-white shadow-md hover:opacity-90"
            >
              <Trophy className="h-4 w-4" /> Ambil Sertifikat Penyelesaian
            </button>
          )}

          {!isCompleted && (
            <Link
              href={mainCourse ? `/academy/courses/${mainCourse.id}` : '/academy/courses'}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 py-2.5 text-sm font-semibold text-purple-700 hover:bg-purple-100"
            >
              <ArrowRight className="h-4 w-4" /> Lanjutkan Belajar
            </Link>
          )}
        </motion.div>
      )}

      {/* ─── COURSE CARD ──────────────────────────────────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800">Kursus Tersedia</h2>
          <Link href="/academy/courses" className="text-sm font-medium text-primary hover:underline">
            Lihat Semua
          </Link>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 font-semibold text-gray-700">Belum ada kursus tersedia</h3>
            <p className="mt-1 text-sm text-gray-500">Kursus akan segera ditambahkan.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {courses.map((course) => {
              const cprog = course.userProgress;
              const cpct = cprog?.progressPercentage ?? 0;
              const started = cpct > 0;
              const courseDuration = course.totalDuration ?? 0;

              return (
                <motion.div
                  key={course.id}
                  whileHover={{ y: -2 }}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  {/* Top color bar */}
                  <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500" />

                  <div className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Badges */}
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${getDifficultyColor(course.difficulty)}`}
                          >
                            {getDifficultyLabel(course.difficulty)}
                          </span>
                          {course.category && (
                            <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700">
                              {course.category === 'fundamental'
                                ? 'Fundamental'
                                : course.category === 'advanced'
                                  ? 'Lanjutan'
                                  : 'Spesialisasi'}
                            </span>
                          )}
                          {started && !cprog?.completedAt && (
                            <span className="flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                              <CheckCircle className="h-3 w-3" /> Sedang Berjalan
                            </span>
                          )}
                          {cprog?.completedAt && (
                            <span className="flex items-center gap-1 rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                              <Trophy className="h-3 w-3" /> Selesai
                            </span>
                          )}
                        </div>

                        <h3 className="mb-2 text-xl font-bold text-gray-800">{course.title}</h3>
                        <p className="mb-4 text-sm leading-relaxed text-gray-500">
                          {course.description ??
                            'Program komprehensif untuk mengembangkan kompetensi sekretaris pimpinan modern.'}
                        </p>

                        {/* Stats Grid */}
                        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          {[
                            { label: 'Modul', value: course.modules?.length ? `${course.modules.length}` : '—' },
                            {
                              label: 'Durasi',
                              value: courseDuration > 0 ? formatDuration(courseDuration) : '—',
                            },
                            { label: 'Level', value: getDifficultyLabel(course.difficulty) },
                            { label: 'Status', value: started ? 'Aktif' : 'Belum dimulai' },
                          ].map((item, i) => (
                            <div key={i} className="rounded-xl bg-gray-50 p-3 text-center">
                              <p className="font-bold text-gray-800">{item.value}</p>
                              <p className="text-xs text-gray-500">{item.label}</p>
                            </div>
                          ))}
                        </div>

                        {/* Module pills */}
                        {course.modules && course.modules.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-2">
                            {course.modules.map((m) => (
                              <span
                                key={m.id}
                                className={`rounded-full px-3 py-1 text-xs font-medium ${m.bgColor ?? 'bg-gray-100'} ${m.iconColor ?? 'text-gray-600'}`}
                              >
                                M{m.order}: {m.title.split(' ').slice(0, 3).join(' ')}…
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Progress Bar */}
                        {started && (
                          <div className="mb-4">
                            <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                              <span>Progress</span>
                              <span className="font-semibold text-purple-700">{cpct}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                              <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${cpct}%` }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action */}
                    <Link
                      href={`/academy/courses/${course.id}`}
                      className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-3 font-semibold text-white shadow-sm hover:opacity-90"
                    >
                      <span>{started ? 'Lanjutkan Belajar' : 'Mulai Sekarang'}</span>
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── TIPS / CTA BOTTOM ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-5"
      >
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
            <Star className="h-6 w-6 text-amber-500" />
          </div>
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-800">Tips Belajar Efektif</p>
          <p className="mt-0.5 text-sm text-gray-600">
            Luangkan 15–20 menit setiap hari untuk belajar secara konsisten dan selesaikan quiz di setiap modul untuk
            mendapatkan sertifikat.
          </p>
        </div>
        <TrendingUp className="h-6 w-6 flex-shrink-0 text-amber-400" />
      </motion.div>
    </motion.div>
  );
}
