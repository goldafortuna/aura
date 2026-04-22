import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Filter,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  ClipboardList,
} from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface CtaItem {
  id: string;
  meetingMinuteId: string;
  title: string;
  action: string;
  picName: string | null;
  unit: string | null;
  deadline: string | null;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  meetingTitle: string;
  meetingDate: string;
}

interface CtaDashboardProps {
  initialData?: CtaItem[];
}

const defaultFilters = {
  unit: 'all',
  status: 'all',
  priority: 'all',
  search: '',
  /** Tanggal pelaksanaan rapat (YYYY-MM-DD), kosong = semua */
  meetingDateFrom: '',
  meetingDateTo: '',
};

const priorityColors = {
  high: 'bg-red-100 text-red-800 border border-red-200',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
  low: 'bg-green-100 text-green-800 border border-green-200',
};

const statusColors = {
  pending: 'bg-gray-100 text-gray-800 border border-gray-200',
  'in-progress': 'bg-blue-100 text-blue-800 border border-blue-200',
  completed: 'bg-green-100 text-green-800 border border-green-200',
  cancelled: 'bg-red-100 text-red-800 border border-red-200',
};

const statusLabels = {
  pending: 'Menunggu',
  'in-progress': 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const priorityLabels = {
  high: 'Tinggi',
  medium: 'Sedang',
  low: 'Rendah',
};

const priorityBorderClass = {
  high: 'border-l-4 border-l-red-500',
  medium: 'border-l-4 border-l-amber-400',
  low: 'border-l-4 border-l-emerald-500',
} as const;

export default function CtaDashboard({ initialData = [] }: CtaDashboardProps) {
  const [ctas, setCtas] = useState<CtaItem[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);

  const [units, setUnits] = useState<string[]>([]);
  const fetchCtas = useCallback(async (nextFilters: typeof filters) => {
    const f = nextFilters;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (f.unit !== 'all') params.append('unit', f.unit);
      if (f.status !== 'all') params.append('status', f.status);
      if (f.priority !== 'all') params.append('priority', f.priority);
      if (f.meetingDateFrom.trim()) params.append('meetingDateFrom', f.meetingDateFrom.trim());
      if (f.meetingDateTo.trim()) params.append('meetingDateTo', f.meetingDateTo.trim());

      const response = await fetch(`/api/ctas?${params}`);
      if (response.ok) {
        const data = await response.json();
        setCtas(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching tindak lanjut:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUnits = useCallback(async () => {
    try {
      const response = await fetch('/api/unit-kerja');
      if (response.ok) {
        const data = await response.json();
        const unitNames = data.data?.map((unit: any) => unit.name) || [];
        setUnits(unitNames);
      }
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  }, []);

  useEffect(() => {
    void fetchCtas(defaultFilters);
    void fetchUnits();
  }, [fetchCtas, fetchUnits]);

  const stats = useMemo(() => {
    const total = ctas.length;
    const pending = ctas.filter(c => c.status === 'pending').length;
    const inProgress = ctas.filter(c => c.status === 'in-progress').length;
    const completed = ctas.filter(c => c.status === 'completed').length;

    return { total, pending, inProgress, completed };
  }, [ctas]);

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    void fetchCtas(filters);
  };

  const handleResetFilters = () => {
    const cleared = { ...defaultFilters };
    setFilters(cleared);
    void fetchCtas(cleared);
  };

  const handleUpdateStatus = async (ctaId: string, newStatus: CtaItem['status']) => {
    try {
      const response = await fetch(`/api/ctas/${ctaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCtas(prev => prev.map(cta => 
          cta.id === ctaId ? { ...cta, status: newStatus } : cta
        ));
      }
    } catch (error) {
      console.error('Error memperbarui status tindak lanjut:', error);
    }
  };

  const filteredCtas = ctas.filter(cta => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      return (
        cta.title.toLowerCase().includes(searchLower) ||
        cta.action.toLowerCase().includes(searchLower) ||
        (cta.picName && cta.picName.toLowerCase().includes(searchLower)) ||
        (cta.unit && cta.unit.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: id });
    } catch {
      return dateString;
    }
  };

  const getDaysRemaining = (deadline: string | null) => {
    if (!deadline) return null;
    const today = new Date();
    const deadlineDate = new Date(deadline);
    const diffTime = deadlineDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-primary/10 p-4 shadow-sm md:p-5">
            <div className="text-2xl font-bold text-gray-800 md:text-3xl">{stats.total}</div>
            <p className="text-xs text-gray-500 md:text-sm">Total tindak lanjut</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-warning/20 p-4 shadow-sm md:p-5">
            <div className="text-2xl font-bold text-amber-700 md:text-3xl">{stats.pending}</div>
            <p className="text-xs text-gray-500 md:text-sm">Menunggu</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-secondary/30 p-4 shadow-sm md:p-5">
            <div className="text-2xl font-bold text-primary-800 md:text-3xl">{stats.inProgress}</div>
            <p className="text-xs text-gray-500 md:text-sm">Dalam proses</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-success/25 p-4 shadow-sm md:p-5">
            <div className="text-2xl font-bold text-green-700 md:text-3xl">{stats.completed}</div>
            <p className="text-xs text-gray-500 md:text-sm">Selesai</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 mb-8">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center justify-between w-full text-left mb-4"
          >
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              <span className="font-medium">Filter</span>
            </div>
            {showFilters ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </button>

          {showFilters && (
            <div className="space-y-4 pt-4 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Pencarian</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Cari tindak lanjut..."
                      className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-10 pr-3 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal rapat dari</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={filters.meetingDateFrom}
                    onChange={(e) => handleFilterChange('meetingDateFrom', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Tanggal rapat sampai</label>
                  <input
                    type="date"
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={filters.meetingDateTo}
                    onChange={(e) => handleFilterChange('meetingDateTo', e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Unit Kerja</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={filters.unit}
                    onChange={(e) => handleFilterChange('unit', e.target.value)}
                  >
                    <option value="all">Semua Unit</option>
                    {units.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={filters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                  >
                    <option value="all">Semua Status</option>
                    <option value="pending">Menunggu</option>
                    <option value="in-progress">Dalam Proses</option>
                    <option value="completed">Selesai</option>
                    <option value="cancelled">Dibatalkan</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Prioritas</label>
                  <select
                    className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/40"
                    value={filters.priority}
                    onChange={(e) => handleFilterChange('priority', e.target.value)}
                  >
                    <option value="all">Semua Prioritas</option>
                    <option value="high">Tinggi</option>
                    <option value="medium">Sedang</option>
                    <option value="low">Rendah</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleApplyFilters}
                  className="rounded-xl bg-gradient-to-r from-primary-700 to-primary-800 px-4 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                >
                  Terapkan filter
                </button>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Daftar tindak lanjut</h3>
            <p className="text-sm text-gray-500">{filteredCtas.length} item</p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-gray-50 to-primary/5 py-14 text-center">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-primary-200 border-t-primary-700" />
              <p className="mt-3 text-sm text-gray-500">Memuat data…</p>
            </div>
          ) : filteredCtas.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-14 text-center text-gray-500">
              <ClipboardList className="mx-auto h-10 w-10 text-gray-300" />
              <p className="mt-3 text-sm font-medium text-gray-600">Tidak ada tindak lanjut</p>
              <p className="mt-1 text-xs text-gray-400">Sesuaikan filter atau kosongkan pencarian.</p>
            </div>
          ) : (
            <ul role="list" className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {filteredCtas.map((cta) => {
                const daysRemaining = getDaysRemaining(cta.deadline);
                const borderAccent = priorityBorderClass[cta.priority];

                return (
                  <li key={cta.id} className="min-w-0 list-none">
                    <article
                      className={`flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-shadow duration-200 hover:shadow-md ${borderAccent}`}
                    >
                      <div className="min-w-0 border-b border-gray-100 bg-gradient-to-r from-white to-primary/5 px-4 py-3 sm:px-5">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <h4 className="min-w-0 flex-1 text-base font-semibold leading-snug text-gray-900">
                            <span className="line-clamp-2">{cta.title}</span>
                          </h4>
                          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                            <span
                              className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold ${priorityColors[cta.priority]}`}
                            >
                              {priorityLabels[cta.priority]}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-semibold ${statusColors[cta.status]}`}
                            >
                              {cta.status === 'pending' && <Clock className="h-3 w-3 opacity-70" />}
                              {cta.status === 'in-progress' && <AlertCircle className="h-3 w-3 opacity-70" />}
                              {cta.status === 'completed' && <CheckCircle className="h-3 w-3 opacity-70" />}
                              {cta.status === 'cancelled' && <AlertCircle className="h-3 w-3 opacity-70" />}
                              {statusLabels[cta.status]}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 px-4 py-4 sm:px-5">
                        <div>
                          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-400">Tindakan</p>
                          <p className="line-clamp-4 text-sm leading-relaxed text-gray-700">{cta.action}</p>
                        </div>

                        <div className="grid grid-cols-1 gap-2.5 text-sm sm:grid-cols-2">
                          <div className="flex min-w-0 items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
                            <User className="mt-0.5 h-4 w-4 shrink-0 text-primary-700/70" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-400">PIC</p>
                              <p className="truncate font-medium text-gray-800">{cta.picName || '—'}</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
                            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-primary-700/70" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-400">Unit</p>
                              <p className="truncate font-medium text-gray-800">{cta.unit || '—'}</p>
                            </div>
                          </div>
                          <div className="flex min-w-0 items-start gap-2 rounded-xl bg-gray-50 px-3 py-2 sm:col-span-2">
                            <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-primary-700/70" aria-hidden />
                            <div className="min-w-0">
                              <p className="text-xs text-gray-400">Deadline</p>
                              <p className="font-medium text-gray-800">{formatDate(cta.deadline)}</p>
                              {daysRemaining !== null && (
                                <p
                                  className={`text-xs font-medium ${
                                    daysRemaining < 0
                                      ? 'text-red-600'
                                      : daysRemaining <= 3
                                        ? 'text-amber-600'
                                        : 'text-emerald-600'
                                  }`}
                                >
                                  {daysRemaining < 0
                                    ? `Terlambat ${Math.abs(daysRemaining)} hari`
                                    : `${daysRemaining} hari lagi`}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-gray-100 bg-gray-50/80 px-3 py-2.5">
                          <div className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-gray-400">
                            <ClipboardList className="h-3.5 w-3.5" aria-hidden />
                            Notula rapat
                          </div>
                          <p className="line-clamp-2 text-sm font-medium text-gray-800">{cta.meetingTitle}</p>
                          <p className="text-xs text-gray-500">{formatDate(cta.meetingDate)}</p>
                        </div>

                        <div className="mt-auto flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                          {cta.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cta.id, 'completed')}
                              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-emerald-600 to-green-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                            >
                              Tandai selesai
                            </button>
                          )}
                          {cta.status !== 'in-progress' && cta.status !== 'completed' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(cta.id, 'in-progress')}
                              className="inline-flex items-center justify-center rounded-xl border border-primary-200 bg-primary/15 px-3 py-2 text-xs font-semibold text-primary-800 transition-colors hover:bg-primary/25"
                            >
                              Tandai Diproses
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
