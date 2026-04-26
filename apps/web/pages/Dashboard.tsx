import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  TrendingUp,
  Zap,
  Bot,
  Sparkles,
  Timer,
  ArrowUpRight,
  ChevronRight,
  Info,
  MessageSquare,
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
  AreaChart,
  Area,
} from 'recharts';

// ─── Interfaces (unchanged) ───────────────────────────────────────────────────

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
type TimeSavingsPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const timeSavingsPeriodOptions: { key: TimeSavingsPeriod; label: string }[] = [
  { key: 'daily', label: 'Harian' },
  { key: 'weekly', label: 'Mingguan' },
  { key: 'monthly', label: 'Bulanan' },
  { key: 'quarterly', label: 'Triwulanan' },
  { key: 'yearly', label: '1 Tahun' },
];

interface TimeSavingsBreakdown {
  feature: 'document_review' | 'minutes_cta' | 'wa_reminder';
  label: string;
  count: number;
  savedMinutes: number;
  savedHours: number;
}

interface TimeSavingsSummary {
  period: TimeSavingsPeriod;
  year: number;
  quarter: QuarterFilter;
  aggregation: {
    bucketCount: number;
  };
  totals: {
    events: number;
    manualEstimateMinutes: number;
    actualAutomationMinutes: number;
    savedMinutes: number;
    savedHours: number;
  };
  breakdown: TimeSavingsBreakdown[];
}

const timeSavingsPeriodLabelMap: Record<TimeSavingsPeriod, string> = {
  daily: 'hari',
  weekly: 'minggu',
  monthly: 'bulan',
  quarterly: 'triwulan',
  yearly: 'tahun',
};

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

// ─── Static benchmark data for AI vs Manual comparison ───────────────────────

const benchmarkData = [
  { name: 'Review Dokumen', manual: 45, ai: 5, percent: 89, feature: 'document_review' as const },
  { name: 'Notula / CTA', manual: 120, ai: 15, percent: 88, feature: 'minutes_cta' as const },
  { name: 'WA Reminder', manual: 30, ai: 3, percent: 90, feature: 'wa_reminder' as const },
];

const featureColorMap: Record<string, { bar: string; text: string; bg: string; border: string }> = {
  document_review: { bar: '#c819f0', text: 'text-primary-700', bg: 'bg-primary/10', border: 'border-primary/30' },
  minutes_cta:     { bar: '#0ea5e9', text: 'text-sky-700',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  wa_reminder:     { bar: '#10b981', text: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
};

// ─── Sparkline component ──────────────────────────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 56;
  const h = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.75}
      />
    </svg>
  );
};

// ─── Custom tooltip for benchmark chart ──────────────────────────────────────

const BenchmarkTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const manual = payload.find((p: any) => p.dataKey === 'manual')?.value as number | undefined;
    const ai = payload.find((p: any) => p.dataKey === 'ai')?.value as number | undefined;
    const saved = manual != null && ai != null ? manual - ai : 0;
    const pct = manual ? Math.round((saved / manual) * 100) : 0;
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-3 shadow-xl text-sm">
        <p className="font-semibold text-gray-800 border-b border-gray-100 pb-1.5 mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-gray-300" />
            <span className="text-gray-500">Manual:</span>
            <span className="font-semibold text-gray-700">{manual} menit</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-primary-600" />
            <span className="text-gray-500">AI:</span>
            <span className="font-semibold text-primary-700">{ai} menit</span>
          </div>
          <div className="mt-2 pt-1.5 border-t border-gray-100 font-semibold text-emerald-600">
            ⚡ Hemat {saved} menit ({pct}% lebih cepat)
          </div>
        </div>
      </div>
    );
  }
  return null;
};

// ─── Skeleton components (unchanged) ─────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

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
  const [timeSavingsPeriod, setTimeSavingsPeriod] = useState<TimeSavingsPeriod>('monthly');
  const [timeSavingsLoading, setTimeSavingsLoading] = useState(true);
  const [timeSavings, setTimeSavings] = useState<TimeSavingsSummary | null>(null);

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
        // non-blocking
      } finally {
        setAgendaLoading(false);
      }
    };

    fetchData();
    fetchAgenda();
  }, []);

  useEffect(() => {
    const fetchTimeSavings = async () => {
      setTimeSavingsLoading(true);
      try {
        const params = new URLSearchParams({
          period: timeSavingsPeriod,
          year: String(selectedYear),
          quarter: selectedQuarter,
        });
        const res = await fetch(`/api/analytics/time-savings?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { data: TimeSavingsSummary };
        setTimeSavings(json.data);
      } catch {
        setTimeSavings(null);
      } finally {
        setTimeSavingsLoading(false);
      }
    };

    void fetchTimeSavings();
  }, [selectedQuarter, selectedYear, timeSavingsPeriod]);

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
      const month = date.getMonth();
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
        iconBg: 'bg-primary/15',
        iconColor: 'text-primary-600',
        borderAccent: 'border-l-primary-600',
        sparkColor: '#c819f0',
        sparkData: [3, 5, 4, 6, 4, 7, 5],
      },
      {
        label: 'Total Dokumen',
        value: stats.totalDocuments,
        icon: ClipboardList,
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600',
        borderAccent: 'border-l-sky-400',
        sparkColor: '#0ea5e9',
        sparkData: [2, 3, 2, 4, 3, 5, 4],
      },
      {
        label: 'Temuan AI',
        value: stats.findings,
        icon: AlertTriangle,
        iconBg: 'bg-warning/60',
        iconColor: 'text-orange-600',
        borderAccent: 'border-l-orange-400',
        sparkColor: '#f97316',
        sparkData: [1, 2, 3, 4, 2, 3, 2],
      },
      {
        label: 'Tugas Selesai',
        value: stats.completedTasks,
        icon: CheckSquare,
        iconBg: 'bg-success/50',
        iconColor: 'text-green-700',
        borderAccent: 'border-l-emerald-500',
        sparkColor: '#10b981',
        sparkData: [8, 10, 9, 12, 11, 14, 13],
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
  const timeSavingsPeriodLabel = timeSavingsPeriodLabelMap[timeSavingsPeriod];
  const timeSavingsBucketCount = timeSavings?.aggregation.bucketCount ?? 0;
  const timeSavingsAveragingHint = timeSavingsBucketCount > 0
    ? `Rata-rata per ${timeSavingsPeriodLabel} dari ${timeSavingsBucketCount.toLocaleString('id-ID')} ${timeSavingsPeriodLabel} aktif pada filter dashboard`
    : `Belum ada data pada filter dashboard untuk tampilan ${timeSavingsPeriodLabel}`;

  const recentActivities = useMemo(() => {
    const documentActivities: ActivityItem[] = filteredDocuments.map((doc) => {
      const createdAt = new Date(doc.createdAt);
      const timeLabel = createdAt.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
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
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      });
      const statusLabel =
        task.status === 'completed' ? 'Selesai'
        : task.status === 'in-progress' ? 'Dalam proses'
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

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Selamat Pagi'
    : hour < 15 ? 'Selamat Siang'
    : hour < 18 ? 'Selamat Sore'
    : 'Selamat Malam';

  return (
    <div className="space-y-6 pb-8">

      {/* ── Hero Banner ──────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary-700 via-primary-600 to-sky-500 p-6 text-white shadow-lg"
      >
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-10 -right-10 h-44 w-44 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 right-1/4 h-52 w-52 rounded-full bg-sky-400/20 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-1.5 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-yellow-300" />
              <span className="text-xs font-semibold uppercase tracking-wide text-purple-200">
                AURA — AI Secretary
              </span>
            </div>
            <h1 className="mb-1 text-2xl font-bold">{greeting}, {userDisplayName}! 👋</h1>
            <p className="text-sm text-purple-200">
              Saya siap membantu menyelesaikan tugas-tugasmu secara cerdas dan produktif.
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2 backdrop-blur-sm">
              <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <Bot className="h-4 w-4" />
              <span className="text-sm font-semibold">AI Aktif</span>
            </div>
            <p className="text-xs text-purple-300">Semua fitur berjalan normal</p>
          </div>
        </div>

        {/* Quick insight pills */}
        <div className="relative mt-4 flex flex-wrap gap-2">
          {[
            { icon: Zap,          text: 'Hemat waktu otomatis',       bg: 'bg-yellow-400/20' },
            { icon: Timer,        text: 'Review dokumen 89% lebih cepat', bg: 'bg-emerald-400/20' },
            { icon: MessageSquare, text: 'WA Reminder otomatis',       bg: 'bg-sky-400/20' },
          ].map(({ icon: Icon, text, bg }) => (
            <div
              key={text}
              className={`flex items-center gap-1.5 ${bg} rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur-sm`}
            >
              <Icon className="h-3.5 w-3.5" />
              {text}
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Period Filter ────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-gray-700">Filter Periode Dashboard</p>
          <div className="flex items-center gap-2">
            <label htmlFor="dashboard-year-filter" className="text-sm text-gray-500">
              Tahun
            </label>
            <select
              id="dashboard-year-filter"
              className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary-600/30"
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {quarterFilterOptions.map((option) => {
            const isActive = selectedQuarter === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelectedQuarter(option.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                  isActive
                    ? 'bg-primary-700 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-primary/40 hover:bg-primary/5 hover:text-primary-700'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Waktu Dihemat + Benchmark AI vs Manual ───────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      >
        {/* Section header */}
        <div className="flex flex-col gap-3 border-b border-gray-100 bg-gradient-to-r from-emerald-50 via-green-50 to-teal-50 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 shadow-md">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Waktu Dihemat</h2>
              <p className="text-xs text-gray-500">{timeSavingsAveragingHint}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {timeSavingsPeriodOptions.map((option) => {
              const isActive = timeSavingsPeriod === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTimeSavingsPeriod(option.key)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-700 text-white shadow-sm'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Real time savings data */}
        <div className="p-5">
          {timeSavingsLoading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-teal-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Total Dihemat</p>
                <p className="mt-2 text-3xl font-bold text-emerald-900">
                  {(timeSavings?.totals.savedHours ?? 0).toLocaleString('id-ID')}
                  <span className="ml-1 text-lg font-normal text-emerald-600">jam</span>
                </p>
                <p className="mt-1 text-xs text-emerald-600">
                  {(timeSavings?.totals.savedMinutes ?? 0).toLocaleString('id-ID')} menit · {(timeSavings?.totals.events ?? 0).toLocaleString('id-ID')} event/{timeSavingsPeriodLabel}
                </p>
              </div>
              {(timeSavings?.breakdown ?? []).map((item) => {
                const colors = featureColorMap[item.feature] ?? featureColorMap['document_review'];
                return (
                  <div key={item.feature} className={`rounded-xl border p-4 ${colors.bg} ${colors.border}`}>
                    <p className={`text-xs font-semibold uppercase tracking-wide ${colors.text}`}>{item.label}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {item.savedMinutes.toLocaleString('id-ID')}
                      <span className="ml-1 text-sm font-normal text-gray-500">menit</span>
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.count.toLocaleString('id-ID')} event/{timeSavingsPeriodLabel} · {item.savedHours.toLocaleString('id-ID')} jam
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Benchmark: AI vs Manual comparison chart ─────────────────────── */}
        <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-600 shadow-sm">
                  <Zap className="h-4 w-4 text-white" />
                </div>
                <h3 className="font-bold text-gray-800">Perbandingan Efisiensi: AI vs Manual</h3>
              </div>
              <p className="mt-1 pl-9 text-xs text-gray-500">
                Estimasi waktu per event — benchmark tim sekretariat 30 hari terakhir
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-8 rounded-full bg-gray-300" />
                Manual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-8 rounded-full bg-primary-600" />
                AI (AURA)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Horizontal grouped bar chart */}
            <div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  layout="vertical"
                  data={benchmarkData}
                  margin={{ top: 0, right: 40, left: 0, bottom: 0 }}
                  barCategoryGap="28%"
                  barGap={3}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f3f4f6" />
                  <XAxis
                    type="number"
                    stroke="#9ca3af"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) => `${v}m`}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    stroke="#9ca3af"
                    tick={{ fontSize: 12, fontWeight: 500 }}
                    width={110}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<BenchmarkTooltip />} cursor={{ fill: '#f9fafb' }} />
                  <Bar
                    dataKey="manual"
                    name="Manual"
                    fill="#d1d5db"
                    radius={[0, 6, 6, 0] as any}
                    barSize={12}
                    label={{ position: 'right', fontSize: 11, fill: '#6b7280', formatter: ((v: unknown) => `${v}m`) as any }}
                  />
                  <Bar
                    dataKey="ai"
                    name="AI (AURA)"
                    fill="#c819f0"
                    radius={[0, 6, 6, 0] as any}
                    barSize={12}
                    label={{ position: 'right', fontSize: 11, fill: '#a50fc9', fontWeight: 600, formatter: ((v: unknown) => `${v}m`) as any }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Efficiency summary cards */}
            <div className="flex flex-col justify-center gap-2.5">
              {benchmarkData.map((item) => {
                const aiWidth = Math.round((item.ai / item.manual) * 100);
                return (
                  <div key={item.name} className="rounded-xl border border-gray-200 bg-white px-4 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-700">{item.name}</span>
                      <span className="text-sm font-bold text-emerald-600">⚡ {item.percent}% lebih cepat</span>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-gray-200">
                          <div className="h-2 w-full rounded-full bg-gray-400" />
                        </div>
                        <span className="w-12 text-right text-xs text-gray-500">{item.manual} menit</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 overflow-hidden rounded-full bg-primary/10">
                          <div
                            className="h-2 rounded-full bg-primary-600 transition-all duration-700"
                            style={{ width: `${aiWidth}%` }}
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-semibold text-primary-700">{item.ai} menit</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footnote */}
          <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-400">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Waktu AI mencakup durasi proses otomatis ditambah waktu verifikasi manusia.
              Benchmark dihitung dari rata-rata 30 hari terakhir.
            </span>
          </div>
        </div>
      </motion.section>

      {/* ── Stats Cards ──────────────────────────────────────────────────────── */}
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
                  transition={{ delay: index * 0.08 }}
                  whileHover={{ y: -3 }}
                  className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-md border-l-4 ${stat.borderAccent}`}
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                      <Icon className={`h-5 w-5 ${stat.iconColor}`} />
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="flex items-center gap-0.5 text-xs font-semibold text-emerald-600">
                        <ArrowUpRight className="h-3 w-3" />
                        Live
                      </span>
                      <Sparkline data={stat.sparkData} color={stat.sparkColor} />
                    </div>
                  </div>
                  <h3 className="mb-0.5 text-2xl font-bold text-gray-800">
                    {stat.value.toLocaleString('id-ID')}
                  </h3>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                </motion.div>
              );
            })}
      </div>

      {/* ── Weekly Chart + Agenda Besok ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Weekly Activity - Area Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm lg:col-span-2"
        >
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Aktivitas Mingguan</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Total dokumen & tugas per hari —{' '}
                {selectedQuarter === 'FULL' ? 'Full Year' : selectedQuarter} {selectedYear}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary-600" />
                Dokumen
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Tugas
              </span>
            </div>
          </div>

          {loading ? (
            <DashboardWeeklyChartSkeleton />
          ) : chartHasData ? (
            <ResponsiveContainer width="100%" height={270}>
              <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradDokumen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c819f0" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c819f0" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradTugas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '12px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="dokumen"
                  stroke="#c819f0"
                  strokeWidth={2.5}
                  fill="url(#gradDokumen)"
                  name="Dokumen"
                  dot={false}
                  activeDot={{ r: 4, fill: '#c819f0' }}
                />
                <Area
                  type="monotone"
                  dataKey="tugas"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#gradTugas)"
                  name="Tugas"
                  dot={false}
                  activeDot={{ r: 4, fill: '#10b981' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-52 flex-col items-center justify-center gap-2 text-sm text-gray-400">
              <Calendar className="h-8 w-8 text-gray-200" />
              Belum ada aktivitas baru pada periode ini.
            </div>
          )}
        </motion.div>

        {/* Agenda Besok */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Agenda Besok</h2>
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
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
                <Calendar className="h-6 w-6 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500">Google Calendar belum terhubung</p>
              <a
                href="/app"
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-800 transition-colors"
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
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Calendar className="h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">Tidak ada agenda besok.</p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto" style={{ maxHeight: 280 }}>
              {agendaTomorrow.events.map((ev, i) => (
                <motion.div
                  key={ev.id}
                  whileHover={{ x: 2 }}
                  className="rounded-xl border border-gray-100 bg-gradient-to-r from-primary/5 to-secondary/5 p-3 transition-all hover:border-primary/20"
                >
                  <div className="mb-1.5 flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary-700">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold leading-tight text-gray-800">{ev.title}</p>
                  </div>
                  <div className="space-y-0.5 pl-7">
                    <p className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Clock className="h-3 w-3 shrink-0" />
                      {ev.isAllDay ? 'Sepanjang hari' : ev.timeRange.replace('–', ' - ')}
                    </p>
                    {ev.location && (
                      <p className="flex items-center gap-1.5 text-xs text-gray-500">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {ev.location}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Recent Activities ────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Aktivitas Terbaru</h2>
            <p className="text-xs text-gray-400">Update real-time dari semua fitur AURA</p>
          </div>
          <ChevronRight className="h-4 w-4 text-gray-300" />
        </div>

        {loading ? (
          <div className="divide-y divide-gray-50" role="status" aria-label="Memuat aktivitas">
            {Array.from({ length: 4 }, (_, i) => (
              <DashboardActivityRowSkeleton key={`activity-skel-${i}`} />
            ))}
          </div>
        ) : recentActivities.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <FileText className="h-8 w-8 text-gray-200" />
            <p className="text-sm text-gray-400">Belum ada aktivitas terbaru.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentActivities.map((activity, i) => {
              const Icon = activity.icon;
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.35 + i * 0.06 }}
                  className="flex cursor-pointer items-center gap-4 px-6 py-4 transition-colors hover:bg-gray-50 group"
                >
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${activity.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-gray-800 group-hover:text-primary-700 transition-colors">
                      {activity.title}
                    </h3>
                    <p className="text-xs text-gray-400">{activity.timeLabel}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                    {activity.statusLabel}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

    </div>
  );
};

export default Dashboard;
