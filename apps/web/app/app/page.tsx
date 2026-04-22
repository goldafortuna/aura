'use client';

import { Suspense } from 'react';
import AppShell from './AppShell';

export default function AppPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[40vh] items-center justify-center text-gray-500">Memuat...</div>}>
      <AppShell />
    </Suspense>
  );
}
