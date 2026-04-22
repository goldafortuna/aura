'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
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

function isAppTabId(value: string): value is AppTabId {
  return (APP_TAB_IDS as readonly string[]).includes(value);
}

export default function AppShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AppTabId>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTabWithUrl}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} isMenuOpen={sidebarOpen} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{renderContent()}</main>
      </div>
    </div>
  );
}
