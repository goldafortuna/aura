'use client';

import React, { Suspense, useEffect, useState } from 'react';
import {
  FileText,
  ClipboardList,
  Calendar,
  MessageSquare,
  CheckSquare,
  LayoutDashboard,
  Settings,
  LogOut,
  BookOpen,
  ListChecks,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { SignOutButton } from '@clerk/nextjs';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isOpen?: boolean;
  onClose?: () => void;
  /** `spa` = tab state di App; `links` = navigasi penuh ke `/app?tab=` (mis. dari layout /settings). */
  navMode?: 'spa' | 'links';
}

const menuItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'documents', label: 'Review Dokumen', icon: FileText },
  { id: 'minutes', label: 'Notula Rapat', icon: ClipboardList },
  { id: 'planner', label: 'Agenda Pimpinan', icon: Calendar },
  { id: 'reminders', label: 'WhatsApp Reminder', icon: MessageSquare },
  { id: 'tasks', label: 'Manajemen Tugas', icon: CheckSquare },
  { id: 'cta-dashboard', label: 'Monitoring TL', icon: ListChecks },
  { id: 'academy', label: 'Academy', icon: BookOpen },
] as const satisfies ReadonlyArray<{ id: string; label: string; icon: React.ElementType; href?: string }>;

const navItemClass = (isActive: boolean) =>
  `w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-all duration-200 ${
    isActive
      ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary-800 shadow-sm'
      : 'text-gray-600 hover:bg-gray-100'
  }`;

const SidebarContent: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  isOpen = false,
  onClose,
  navMode = 'spa',
}) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isDesktop, setIsDesktop] = useState(false);

  const appTabFromUrl = pathname === '/app' ? (searchParams?.get('tab') ?? 'dashboard') : '';
  const settingsActive = pathname?.startsWith('/settings') ?? false;

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity md:hidden ${
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => onClose?.()}
        aria-hidden
      />

      <motion.aside
        initial={false}
        animate={{ x: isDesktop || isOpen ? 0 : -320 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col border-r border-gray-200 bg-gradient-to-b from-primary/10 to-secondary/10 md:static md:translate-x-0"
      >
      <div className="border-b border-gray-200 p-6">
        <h1 className="bg-gradient-to-r from-primary-700 to-secondary-600 bg-clip-text text-2xl font-bold text-transparent">
          AURA
        </h1>
        <p className="mt-1 text-xs text-gray-500">Be Gold, Be Bold</p>
      </div>

      <nav className="flex-1 space-y-2 p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const hasCustomHref = 'href' in item && !!item.href;

          // Determine active state
          let isActive: boolean;
          if (hasCustomHref) {
            isActive = pathname?.startsWith(item.href as string) ?? false;
          } else if (navMode === 'links') {
            isActive =
              item.id === 'academy'
                ? (pathname?.startsWith('/academy') ?? false) || appTabFromUrl === 'academy'
                : appTabFromUrl === item.id;
          } else {
            isActive = activeTab === item.id;
          }

          // Items with a custom href always use Link directly to that path
          if (hasCustomHref) {
            return (
              <Link key={item.id} href={item.href as string} onClick={() => onClose?.()} className="block">
                <motion.div whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} className={navItemClass(isActive)}>
                  <span className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary-700' : ''}`} />
                    <span>{item.label}</span>
                  </span>
                </motion.div>
              </Link>
            );
          }

          if (navMode === 'links') {
            return (
              <Link key={item.id} href={`/app?tab=${item.id}`} onClick={() => onClose?.()} className="block">
                <motion.div whileHover={{ scale: 1.02, x: 4 }} whileTap={{ scale: 0.98 }} className={navItemClass(isActive)}>
                  <span className="flex items-center gap-3">
                    <Icon className={`h-5 w-5 ${isActive ? 'text-primary-700' : ''}`} />
                    <span>{item.label}</span>
                  </span>
                </motion.div>
              </Link>
            );
          }

          return (
            <motion.button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              whileHover={{ scale: 1.02, x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={navItemClass(isActive)}
            >
              <span className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary-700' : ''}`} />
                <span>{item.label}</span>
              </span>
            </motion.button>
          );
        })}
      </nav>

      <div className="space-y-2 border-t border-gray-200 p-4">
        <Link
          href="/settings"
          className={`block w-full rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors ${
            settingsActive
              ? 'bg-gradient-to-r from-primary/20 to-secondary/20 text-primary-800 shadow-sm'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
          onClick={() => onClose?.()}
        >
          <span className="flex items-center gap-3">
            <Settings className={`h-5 w-5 ${settingsActive ? 'text-primary-700' : ''}`} />
            <span>Pengaturan</span>
          </span>
        </Link>
        <SignOutButton redirectUrl="/">
          <button className="w-full rounded-xl px-4 py-3 text-left text-sm font-medium text-red-600 transition-colors hover:bg-red-50">
            <span className="flex items-center gap-3">
              <LogOut className="h-5 w-5" />
              <span>Keluar</span>
            </span>
          </button>
        </SignOutButton>
      </div>
      </motion.aside>
    </>
  );
};

export const Sidebar: React.FC<SidebarProps> = (props) => {
  return (
    <Suspense
      fallback={
        <aside className="fixed inset-y-0 left-0 z-50 hidden h-screen w-64 border-r border-gray-200 bg-gradient-to-b from-primary/10 to-secondary/10 md:block" />
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
};
