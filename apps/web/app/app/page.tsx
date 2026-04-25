'use client';

import { Suspense } from 'react';
import AppShell from './AppShell';
import { AppLayoutSkeleton } from '../../components/LoadingSkeleton';

export default function AppPage() {
  return (
    <Suspense fallback={<AppLayoutSkeleton variant="dashboard" />}>
      <AppShell />
    </Suspense>
  );
}
