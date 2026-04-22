import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  FileText,
  ClipboardList,
  Calendar,
  CheckSquare,
  Clock,
  AlertTriangle,
  MapPin,
  Link2,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface ApiDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  status: string;
  typoCount: number;
  ambiguousCount: number;
  createdAt: string;
}

interface ApiTask {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

interface DashboardDocument {
  id: string;
  filename: string;
  status: 'processing' | 'reviewed' | 'error';
  typoCount: number;
  ambiguousCount: number;
  createdAt: string;
}

interface DashboardTask {
  id: string;
  title: string;
  status: 'todo' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  createdAt: string;
}

interface ActivityItem {
  id: string;
  title: string;
  statusLabel: string;
  timeLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  createdAtMs: number;
}

const dayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const quarterFilterOptions = [
  { key: 'Q1', label: 'Triwulan I' },
  { key: 'Q2', label: 'Triwulan II' },
  { key: 'Q3', label: 'Triwulan III' },
  { key: 'Q4', label: 'Triwulan IV' },
  { key: 'FULL', label: 'Full Year (1 Tahun)' },
] as const;

type QuarterFilter = (typeof quarterFilterOptions)[number]['key'];

interface TomorrowEvent {
  id: string;
  title: string;
  timeRange: string;
  location: string;
  isAllDay: boolean;
}

interface TomorrowMeta {
  hariLabel: string;
  tanggalShort: string;
  events: TomorrowEvent[];
}

function DashboardStatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-12 w-12 shrink-0 rounded-xl bg-gray-200/90 animate-pulse" aria-hidden />
        <div className="h-3 w-12 rounded-full bg-gray-100 animate-pulse" aria-hidden />
      </div>
      <div className="mb-2 h-8 w-24 max-w-[55%] rounded-lg bg-gray-200/90 animate-pulse" aria-hidden />
      <div className="h-4 w-40 max-w-[80%] rounded-md bg-gray-100 animate-pulse" aria-hidden />
    </div>
  );
}

function DashboardActivityRowSkeleton() {
  return (
    <div className="rounded-xl p-4">
      <div className="flex items-center gap-4">
        <div className="h-10 w-10 shrink-0 rounded-xl bg-gray-200/90 animate-pulse" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-4 max-w-[min(100%,20rem)] rounded-md bg-gray-200/90 animate-pulse" aria-hidden />
          <div className="h-3 w-36 rounded bg-gray-100 animate-pulse" aria-hidden />
        </div>
        <div className="h-7 w-[4.5rem] shrink-0 rounded-lg bg-gray-100 animate-pulse" aria-hidden />
      </div>
    </div>
  );
}

/** Tinggi batang (px) agar mirip BarChart 300px — warna mengikuti seri dokumen / tugas. */
const weeklyChartSkeletonBars: { dok: number; tug: number }[] = [
  { dok: 78, tug: 52 },
  { dok: 96, tug: 44 },
  { dok: 58, tug: 88 },
  { dok: 112, tug: 62 },
  { dok: 46, tug: 70 },
  { dok: 84, tug: 56 },
  { dok: 68, tug: 74 },
];

function DashboardWeeklyChartSkeleton() {
  return (
    <div
      className="flex h-[300px] w-full gap-2 sm:gap-3"
      role="status"
      aria-label="Memuat grafik aktivitas mingguan"
    >
      <div className="flex w-7 shrink-0 flex-col justify-between pb-9 pt-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-2 w-4 rounded bg-gray-100 animate-pulse" />
        ))}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="relative flex flex-1 flex-col justify-end border-b border-gray-200/90">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 top-6 flex flex-col justify-between pb-px"
            aria-hidden
          >
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-px w-full bg-gray-100" />
            ))}
          </div>
          <div className="relative z-[1] flex min-h-0 flex-1 items-end justify-between gap-0.5 px-0.5 sm:gap-1.5 sm:px-1">
            {dayLabels.map((day, idx) => {
              const { dok, tug } = weeklyChartSkeletonBars[idx] ?? { dok: 64, tug: 64 };
              return (
                <div key={day} className="flex h-[220px] min-w-0 flex-1 items-end justify-center gap-0.5 sm:gap-1">
                  <div
                    className="w-[42%] max-w-[26px] rounded-t-lg bg-[#E6E6FA] animate-pulse shadow-sm"
                    style={{ height: `${dok}px` }}
                    aria-hidden
                  />
                  <div
                    className="w-[42%] max-w-[26px] rounded-t-lg bg-[#C7F0DB] animate-pulse shadow-sm"
                    style={{ height: `${tug}px` }}
                    aria-hidden
                  />
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 flex justify-between gap-0.5 px-0.5 sm:px-1" aria-hidden>
          {dayLabels.map((day) => (
            <div
              key={`sk-lab-${day}`}
              className="mx-auto h-3 w-7 max-w-full rounded bg-gray-100 animate-pulse sm:w-8"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export const Dashboard: React.FC = () => {
  const { user } = useUser();
  const userDisplayName =
    user?.firstName?.trim() ||
    user?.fullName?.trim() ||
    user?.username?.trim() ||
    'rekan';

  const [documents, setDocuments] = useState<DashboardDocument[]>([]);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [agendaLoading, setAgendaLoading] = useState(true);
  const [agendaTomorrow, setAgendaTomorrow] = useState<TomorrowMeta | null>(null);
  const [calendarConnected, setCalendarConnected] = useState<boolean | null>(null);
  const currentYear = new Date().getFullYear();
  const [selectedQuarter, setSelectedQuarter] = useState<QuarterFilter>('FULL');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [docRes, taskRes] = await Promise.all([
          fetch('/api/documents', { cache: 'no-store' }),
          fetch('/api/tasks', { cache: 'no-store' }),
        ]);

        if (!docRes.ok || !taskRes.ok) {
          throw new Error('Gagal memuat data ringkasan.');
        }

        const docJson = (await docRes.json()) as { data: ApiDocument[] };
        const taskJson = (await taskRes.json()) as { data: ApiTask[] };

        const normalizedDocuments: DashboardDocument[] = docJson.data.map((doc) => ({
          id: doc.id,
          filename: doc.filename,
          status: ['reviewed', 'processing', 'error'].includes(doc.status)
            ? (doc.status as DashboardDocument['status'])
            : 'processing',
          typoCount: doc.typoCount ?? 0,
          ambiguousCount: doc.ambiguousCount ?? 0,
          createdAt: doc.createdAt,
        }));

        const normalizedTasks: DashboardTask[] = taskJson.data.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          createdAt: task.createdAt,
        }));

        setDocuments(normalizedDocuments);
        setTasks(normalizedTasks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Terjadi kesalahan.');
      } finally {
        setLoading(false);
      }
    };

    const fetchAgenda = async () => {
      setAgendaLoading(true);
      try {
        const res = await fetch('/api/google/calendar/planner-events', { cache: 'no-store' });
        if (res.status === 400 || res.status === 401) {
          setCalendarConnected(false);
          return;
        }
        if (!res.ok) return;
        const json = (await res.json()) as {
          data?: {
            tomorrow?: {
              hariLabel: string;
              tanggalShort: string;
              events: TomorrowEvent[];
            };
          };
        };
        if (json.data?.tomorrow) {
          setCalendarConnected(true);
          setAgendaTomorrow({
            hariLabel: json.data.tomorrow.hariLabel,
            tanggalShort: json.data.tomorrow.tanggalShort,
            events: json.data.tomorrow.events,
          });
        }
      } catch {
        // non-blocking — agenda card just won't show
      } finally {
        setAgendaLoading(false);
      }
    };

    fetchData();
    fetchAgenda();
  }, []);

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear]);
    documents.forEach((doc) => years.add(new Date(doc.createdAt).getFullYear()));
    tasks.forEach((task) => years.add(new Date(task.createdAt).getFullYear()));
    return Array.from(years).sort((a, b) => b - a);
  }, [documents, tasks, currentYear]);

  const isWithinSelectedPeriod = useCallback(
    (createdAt: string) => {
      const date = new Date(createdAt);
      if (Number.isNaN(date.getTime())) return false;

      if (date.getFullYear() !== selectedYear) return false;
      if (selectedQuarter === 'FULL') return true;

      const month = date.getMonth(); // 0..11
      if (selectedQuarter === 'Q1') return month >= 0 && month <= 2;
      if (selectedQuarter === 'Q2') return month >= 3 && month <= 5;
      if (selectedQuarter === 'Q3') return month >= 6 && month <= 8;
      return month >= 9 && month <= 11;
    },
    [selectedQuarter, selectedYear],
  );

  const filteredDocuments = useMemo(
    () => documents.filter((doc) => isWithinSelectedPeriod(doc.createdAt)),
    [documents, isWithinSelectedPeriod],
  );
  const filteredTasks = useMemo(
    () => tasks.filter((task) => isWithinSelectedPeriod(task.createdAt)),
    [tasks, isWithinSelectedPeriod],
  );

  const stats = useMemo(() => {
    const totalDocuments = filteredDocuments.length;
    const reviewedDocuments = filteredDocuments.filter((doc) => doc.status === 'reviewed').length;
    const findings = filteredDocuments.reduce(
      (acc, doc) => acc + doc.typoCount + doc.ambiguousCount,
      0,
    );
    const totalTasks = filteredTasks.length;
    const completedTasks = filteredTasks.filter((task) => task.status === 'completed').length;

    return { totalDocuments, reviewedDocuments, findings, totalTasks, completedTasks };
  }, [filteredDocuments, filteredTasks]);

  const statsCards = useMemo(
    () => [
      {
        label: 'Dokumen Direview',
        value: stats.reviewedDocuments,
        icon: FileText,
        color: 'from-primary/20 to-primary/10',
        iconColor: 'text-primary-600',
      },
      {
        label: 'Total Dokumen',
        value: stats.totalDocuments,
        icon: ClipboardList,
        color: 'from-secondary/20 to-secondary/10',
        iconColor: 'text-secondary-600',
      },
      {
        label: 'Temuan AI',
        value: stats.findings,
        icon: AlertTriangle,
        color: 'from-warning/20 to-warning/10',
        iconColor: 'text-orange-600',
      },
      {
        label: 'Tugas Selesai',
        value: stats.completedTasks,
        icon: CheckSquare,
        color: 'from-success/20 to-success/10',
        iconColor: 'text-green-600',
      },
    ],
    [stats],
  );

  const chartData = useMemo(() => {
    const docCounts = new Array(7).fill(0);
    const taskCounts = new Array(7).fill(0);

    filteredDocuments.forEach((doc) => {
      const dayIndex = new Date(doc.createdAt).getDay();
      docCounts[dayIndex] += 1;
    });

    filteredTasks.forEach((task) => {
      const dayIndex = new Date(task.createdAt).getDay();
      taskCounts[dayIndex] += 1;
    });

    return dayLabels.map((label, idx) => ({
      name: label,
      dokumen: docCounts[idx],
      notula: 0,
      tugas: taskCounts[idx],
    }));
  }, [filteredDocuments, filteredTasks]);

  const chartHasData = chartData.some((row) => row.dokumen > 0 || row.tugas > 0);

  const recentActivities = useMemo(() => {
    const documentActivities: ActivityItem[] = filteredDocuments.map((doc) => {
      const createdAt = new Date(doc.createdAt);
      const timeLabel = createdAt.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      const statusLabel =
        doc.status === 'reviewed' ? 'Direview' : doc.status === 'error' ? 'Perlu revisi' : 'Diproses';
      const color =
        doc.status === 'reviewed'
          ? 'bg-success/10 text-green-600'
          : doc.status === 'error'
          ? 'bg-error/10 text-red-600'
          : 'bg-warning/10 text-orange-600';

      return {
        id: `doc-${doc.id}`,
        title: doc.filename,
        statusLabel,
        timeLabel,
        icon: FileText,
        color,
        createdAtMs: createdAt.getTime(),
      };
    });

    const taskActivities: ActivityItem[] = filteredTasks.map((task) => {
      const createdAt = new Date(task.createdAt);
      const timeLabel = createdAt.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });

      const statusLabel =
        task.status === 'completed'
          ? 'Selesai'
          : task.status === 'in-progress'
          ? 'Dalam proses'
          : 'To Do';

      const color =
        task.status === 'completed'
          ? 'bg-success/10 text-green-600'
          : task.status === 'in-progress'
          ? 'bg-warning/10 text-orange-600'
          : 'bg-primary/10 text-primary-600';

      const icon =
        task.status === 'completed' ? CheckSquare : task.status === 'in-progress' ? Clock : Calendar;

      return {
        id: `task-${task.id}`,
        title: task.title,
        statusLabel,
        timeLabel,
        icon,
        color,
        createdAtMs: createdAt.getTime(),
      };
    });

    return [...documentActivities, ...taskActivities]
      .sort((a, b) => b.createdAtMs - a.createdAtMs)
      .slice(0, 4);
  }, [filteredDocuments, filteredTasks]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-3xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-gray-500">
          Halo {userDisplayName}, Saya AURA, akan membantumu menyelesaikan tugas-tugasmu secara cerdas dan tetap
          produktif.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <p className="text-sm font-medium text-gray-700">Filter periode dashboard</p>
            <div className="flex items-center gap-2">
              <label htmlFor="dashboard-year-filter" className="text-sm text-gray-600">
                Tahun
              </label>
              <select
                id="dashboard-year-filter"
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {quarterFilterOptions.map((option) => {
              const isActive = selectedQuarter === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedQuarter(option.key)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'bg-primary-700 text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4"
        aria-busy={loading}
        aria-label={loading ? 'Memuat ringkasan statistik' : undefined}
      >
        {loading
          ? Array.from({ length: 4 }, (_, index) => (
              <motion.div
                key={`stat-skel-${index}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <DashboardStatCardSkeleton />
              </motion.div>
            ))
          : statsCards.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-all hover:shadow-md"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${stat.color}`}>
                      <Icon className={`h-6 w-6 ${stat.iconColor}`} />
                    </div>
                    <span className="text-xs text-gray-400">Live</span>
                  </div>
                  <h3 className="mb-1 text-2xl font-bold text-gray-800">{stat.value.toLocaleString('id-ID')}</h3>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </motion.div>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800">Aktivitas Mingguan</h2>
            <p className="text-sm text-gray-500">
              Total dokumen & tugas per hari pada periode {selectedQuarter === 'FULL' ? 'full year' : selectedQuarter}{' '}
              {selectedYear}
            </p>
          </div>
          {loading ? (
            <DashboardWeeklyChartSkeleton />
          ) : chartHasData ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar dataKey="dokumen" fill="#E6E6FA" radius={[8, 8, 0, 0]} name="Dokumen" />
                <Bar dataKey="tugas" fill="#C7F0DB" radius={[8, 8, 0, 0]} name="Tugas" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-gray-400">
              Belum ada aktivitas baru.
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Agenda Besok</h2>
              {agendaTomorrow && (
                <p className="mt-0.5 text-xs text-gray-400">
                  {agendaTomorrow.hariLabel}, {agendaTomorrow.tanggalShort}
                </p>
              )}
            </div>
            {agendaTomorrow && (
              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-700">
                {agendaTomorrow.events.length} agenda
              </span>
            )}
          </div>

          {agendaLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : calendarConnected === false ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100">
                <Calendar className="h-5 w-5 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Google Calendar belum terhubung</p>
              <a
                href="/app"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-700"
              >
                <Link2 className="h-3.5 w-3.5" />
                Hubungkan
              </a>
            </div>
          ) : !agendaTomorrow ? (
            <div className="flex items-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Memuat agenda…
            </div>
          ) : agendaTomorrow.events.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Tidak ada agenda besok.</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 280 }}>
              {agendaTomorrow.events.map((ev, i) => (
                <div
                  key={ev.id}
                  className="rounded-xl border border-gray-100 bg-gradient-to-r from-primary/5 to-secondary/5 p-3"
                >
                  <div className="mb-1.5 flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary-700">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold leading-tight text-gray-800">{ev.title}</p>
                  </div>
                  <div className="pl-7 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="h-3 w-3 shrink-0" />
                      {ev.isAllDay ? 'Sepanjang hari' : ev.timeRange.replace('–', ' - ')}
                    </p>
                    {ev.location ? (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {ev.location}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-xl font-bold text-gray-800">Aktivitas Terbaru</h2>
        {loading ? (
          <div className="space-y-1" role="status" aria-label="Memuat aktivitas">
            {Array.from({ length: 4 }, (_, i) => (
              <DashboardActivityRowSkeleton key={`activity-skel-${i}`} />
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="text-sm text-gray-400">Belum ada aktivitas terbaru.</div>
        ) : (
          <div className="space-y-3">
            {recentActivities.map((activity) => {
              const Icon = activity.icon;
              return (
                <div
                  key={activity.id}
                  className="cursor-pointer rounded-xl p-4 transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${activity.color}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-medium text-gray-800">{activity.title}</h3>
                      <p className="text-sm text-gray-500">{activity.timeLabel}</p>
                    </div>
                    <span className="rounded-lg bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                      {activity.statusLabel}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="col-span-1 lg:col-span-3"
      >
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-800">Dashboard CTA (Tindak Lanjut)</h3>
              <p className="text-sm text-gray-500">Kelola dan pantau semua tindak lanjut dari notula rapat</p>
            </div>
            <Link
              href="/app?tab=cta-dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Lihat Detail
            </Link>
          </div>
          <div className="text-center py-8 text-gray-400">
            <div className="mb-2">Komponen CTA Dashboard akan ditampilkan di halaman terpisah</div>
            <div className="text-sm">Klik &quot;Lihat Detail&quot; untuk mengakses dashboard CTA lengkap</div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;
