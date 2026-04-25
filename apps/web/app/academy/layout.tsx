'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '../../components/Sidebar';
import { Header } from '../../components/Header';
import { AppLayoutSkeleton } from '../../components/LoadingSkeleton';

interface AcademyLayoutProps {
  children: React.ReactNode;
}

type MeResponse = {
  data?: {
    roles: string[];
    approvalStatus: 'pending' | 'approved' | 'rejected';
  };
};

function AcademyAccessNotice({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function AcademyLayout({ children }: AcademyLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadMe = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/me', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Gagal memuat profil pengguna (HTTP ${res.status})`);
        const json = (await res.json()) as MeResponse;
        if (!cancelled) {
          setRoles(json.data?.roles ?? []);
          setApprovalStatus(json.data?.approvalStatus ?? null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Gagal memuat profil pengguna.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <AppLayoutSkeleton variant="list" />;
  }

  if (error || approvalStatus !== 'approved' || !roles.includes('secretary')) {
    return (
      <AcademyAccessNotice
        title="Academy Tidak Tersedia"
        message={error ?? 'Halaman Academy hanya dapat diakses oleh user approved dengan role Secretary.'}
      />
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        activeTab="academy"
        setActiveTab={() => {}}
        navMode="links"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        roles={roles}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen((v) => !v)}
          isMenuOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
