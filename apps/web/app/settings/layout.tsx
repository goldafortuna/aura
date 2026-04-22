'use client';

import React, { Suspense, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Suspense fallback={<div className="h-full w-64 shrink-0 border-r border-gray-200 bg-gray-100" aria-hidden />}>
        <Sidebar
          navMode="links"
          activeTab=""
          setActiveTab={() => {}}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} isMenuOpen={sidebarOpen} />
        <Suspense fallback={<div className="flex flex-1 items-center justify-center text-sm text-gray-500">Memuat…</div>}>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </Suspense>
      </div>
    </div>
  );
}
