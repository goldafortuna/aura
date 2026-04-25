'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { AppLayoutSkeleton } from '../../components/LoadingSkeleton';
import { Dashboard } from '../../pages/Dashboard';
import { DocumentReview } from '../../pages/DocumentReview';
import { MeetingMinutes } from '../../pages/MeetingMinutes';
import { AgendaPlanner } from '../../pages/AgendaPlanner';
import { WhatsAppReminders } from '../../pages/WhatsAppReminders';
import { TaskManagement } from '../../pages/TaskManagement';
import CtaDashboard from '../../components/CtaDashboard';
import AcademyHome from '../../components/AcademyHome';

const APP_TAB_IDS = [
  'dashboard',
  'documents',
  'minutes',
  'planner',
  'reminders',
  'tasks',
  'cta-dashboard',
  'academy',
] as const;
type AppTabId = (typeof APP_TAB_IDS)[number];

type MeResponse = {
  data?: {
    email: string;
    fullName: string | null;
    roles: string[];
    approvalStatus: 'pending' | 'approved' | 'rejected';
  };
};

function isAppTabId(value: string): value is AppTabId {
  return (APP_TAB_IDS as readonly string[]).includes(value);
}

function AccessNotice({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

export default function AppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AppTabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [me, setMe] = useState<MeResponse['data'] | null>(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      setMeLoading(true);
      setMeError(null);
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Gagal memuat profil pengguna (HTTP ${res.status})`);
        const json = (await res.json()) as MeResponse;
        if (!cancelled) setMe(json.data ?? null);
      } catch (err) {
        if (!cancelled) setMeError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    };
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const cal = searchParams?.get('calendarConnected');
    if (cal === '1' || cal === 'error') {
      setActiveTab('reminders');
      router.replace('/app?tab=reminders', { scroll: false });
      return;
    }
    const tab = searchParams?.get('tab');
    if (tab && isAppTabId(tab)) {
      setActiveTab(tab);
    } else if (!tab || !isAppTabId(tab ?? '')) {
      setActiveTab('dashboard');
    }
  }, [searchParams, router]);

  const setActiveTabWithUrl = useCallback(
    (tab: string) => {
      if (!isAppTabId(tab)) return;
      setActiveTab(tab);
      router.replace(`/app?tab=${encodeURIComponent(tab)}`, { scroll: false });
    },
    [router],
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'documents':
        return <DocumentReview />;
      case 'minutes':
        return <MeetingMinutes />;
      case 'planner':
        return <AgendaPlanner />;
      case 'reminders':
        return <WhatsAppReminders />;
      case 'tasks':
        return <TaskManagement />;
      case 'cta-dashboard':
        return (
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">Monitoring Tindak Lanjut</h1>
              <p className="text-gray-500">
                Kelola dan pantau semua tindak lanjut dari berbagai notula rapat dengan filter dan statistik lengkap.
              </p>
            </div>
            <CtaDashboard />
          </div>
        );
      case 'academy':
        return <AcademyHome />;
      default:
        return <Dashboard />;
    }
  };

  useEffect(() => {
    setSidebarOpen(false);
  }, [activeTab]);

  if (meLoading) {
    return <AppLayoutSkeleton variant="dashboard" />;
  }

  if (meError || !me) {
    return (
      <AccessNotice
        title="Akses belum tersedia"
        message={meError ?? 'Profil pengguna tidak ditemukan. Silakan login ulang.'}
      />
    );
  }

  if (me.approvalStatus === 'pending') {
    return (
      <AccessNotice
        title="Menunggu Approval"
        message="Akun Anda sudah terdaftar, tetapi belum disetujui oleh Super Admin. Setelah disetujui, fitur AURA akan otomatis bisa digunakan sesuai role yang diberikan."
      />
    );
  }

  if (me.approvalStatus === 'rejected') {
    return (
      <AccessNotice
        title="Akses Ditolak"
        message="Akun Anda belum dapat menggunakan AURA. Silakan hubungi Super Admin untuk informasi lebih lanjut."
      />
    );
  }

  if (!me.roles.includes('secretary')) {
    return (
      <AccessNotice
        title="Tidak Ada Role Secretary"
        message="Akun Anda belum memiliki role Secretary, sehingga fitur sekretaris tidak ditampilkan. Jika Anda Super Admin, buka Pengaturan Sistem untuk mengelola konfigurasi aplikasi."
        action={
          me.roles.includes('super_admin') ? (
            <button
              type="button"
              onClick={() => router.replace('/settings')}
              className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              Buka Pengaturan Sistem
            </button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTabWithUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        roles={me.roles}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} isMenuOpen={sidebarOpen} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{renderContent()}</main>
      </div>
    </div>
  );
}
