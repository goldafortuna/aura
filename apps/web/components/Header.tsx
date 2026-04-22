'use client';

import React from 'react';
import { Bell, Menu, Search, User, X } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';

type HeaderProps = {
  onMenuClick?: () => void;
  isMenuOpen?: boolean;
};

export const Header: React.FC<HeaderProps> = ({ onMenuClick, isMenuOpen }) => {
  const { user } = useUser();

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {onMenuClick ? (
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl transition-colors hover:bg-gray-100 md:hidden"
            aria-label={isMenuOpen ? 'Tutup menu' : 'Buka menu'}
          >
            {isMenuOpen ? <X className="h-5 w-5 text-gray-700" /> : <Menu className="h-5 w-5 text-gray-700" />}
          </button>
        ) : null}

        <div className="relative w-full max-w-xl flex-1">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari dokumen, notula, atau agenda..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2 pl-10 pr-4 text-sm transition-all focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary/50 sm:text-base"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative rounded-xl p-2 transition-colors hover:bg-gray-100"
        >
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-error-500" />
        </motion.button>

        <SignedOut>
          <Link
            href="/sign-in"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Masuk
          </Link>
        </SignedOut>

        <SignedIn>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="flex items-center gap-3 rounded-xl px-3 py-2 transition-colors hover:bg-gray-100"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-secondary-400">
              <User className="h-5 w-5 text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-800">{user?.fullName ?? user?.primaryEmailAddress?.emailAddress ?? 'Pengguna'}</p>
              <p className="text-xs text-gray-500">Akun</p>
            </div>
            <div className="ml-2">
              <UserButton afterSignOutUrl="/" />
            </div>
          </motion.div>
        </SignedIn>
      </div>
    </header>
  );
};
