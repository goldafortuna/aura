'use client';

import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

type DashboardLayoutProps = {
  children: React.ReactNode;
};

/**
 * Layout shell untuk halaman Pages Router (mis. /cta-dashboard) agar konsisten
 * dengan area utama: sidebar + header + konten scroll.
 */
export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeTab="dashboard"
        setActiveTab={() => {}}
        navMode="links"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen((v) => !v)} isMenuOpen={sidebarOpen} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
