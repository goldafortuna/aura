import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
      <div className="mb-4 h-4 w-3/4 rounded bg-gray-200" />
      <div className="mb-2 h-3 w-1/2 rounded bg-gray-200" />
      <div className="h-3 w-2/3 rounded bg-gray-200" />
    </div>
  );
};

export const TableSkeleton: React.FC = () => {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-4 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="h-10 w-10 rounded-lg bg-gray-200" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-1/4 rounded bg-gray-200" />
            <div className="h-2 w-1/2 rounded bg-gray-200" />
          </div>
          <div className="h-8 w-20 rounded-lg bg-gray-200" />
        </div>
      ))}
    </div>
  );
};

export const StatsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="h-12 w-12 rounded-xl bg-gray-200" />
            <div className="h-3 w-16 rounded bg-gray-200" />
          </div>
          <div className="mb-2 h-6 w-1/2 rounded bg-gray-200" />
          <div className="h-3 w-3/4 rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );
};

// ─── Full-page layout skeleton ────────────────────────────────────────────────
// Mirrors the app shell: sidebar (w-64) + header (h-16) + content.
// Used as the loading state when navigating between major routes.

function SidebarSkeleton() {
  return (
    <div className="fixed inset-y-0 left-0 hidden h-screen w-64 flex-col border-r border-gray-200 bg-gradient-to-b from-primary/10 to-secondary/10 md:flex">
      {/* Logo */}
      <div className="border-b border-gray-200 p-6">
        <div className="h-7 w-14 animate-pulse rounded-lg bg-white/60" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-white/40" />
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-2 p-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <div
            key={i}
            className="flex animate-pulse items-center gap-3 rounded-xl px-4 py-3"
          >
            <div className="h-5 w-5 rounded-md bg-white/50" />
            <div className="h-3.5 w-28 rounded bg-white/50" />
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="space-y-2 border-t border-gray-200 p-4">
        <div className="flex animate-pulse items-center gap-3 rounded-xl px-4 py-3">
          <div className="h-5 w-5 rounded-md bg-white/50" />
          <div className="h-3.5 w-28 rounded bg-white/50" />
        </div>
        <div className="flex animate-pulse items-center gap-3 rounded-xl px-4 py-3">
          <div className="h-5 w-5 rounded-md bg-white/50" />
          <div className="h-3.5 w-16 rounded bg-white/50" />
        </div>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-gray-200 bg-white px-4 sm:px-6 lg:px-8">
      {/* Search bar */}
      <div className="flex flex-1 items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-xl bg-gray-100 md:hidden" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-xl bg-gray-100" />
      </div>
      {/* Right side */}
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
        <div className="h-9 w-9 animate-pulse rounded-full bg-gray-100" />
      </div>
    </header>
  );
}

function ContentSkeleton({ variant = 'dashboard' }: { variant?: 'dashboard' | 'settings' | 'list' }) {
  if (variant === 'settings') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Page title */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-40 animate-pulse rounded-xl bg-gray-200" />
            <div className="h-4 w-64 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="h-10 w-24 animate-pulse rounded-xl bg-gray-200" />
        </div>
        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-xl bg-gray-200" />
          ))}
        </div>
        {/* Content card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="h-5 w-48 animate-pulse rounded-lg bg-gray-200" />
          <div className="h-4 w-72 animate-pulse rounded bg-gray-100" />
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </div>
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (variant === 'list') {
    return (
      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-xl bg-gray-200" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex animate-pulse items-center gap-4 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="h-12 w-12 shrink-0 rounded-xl bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded-lg bg-gray-200" />
              <div className="h-3 w-1/2 rounded bg-gray-100" />
            </div>
            <div className="h-8 w-20 rounded-lg bg-gray-200" />
          </div>
        ))}
      </div>
    );
  }

  // dashboard (default)
  return (
    <div className="space-y-5 p-4 sm:p-6 lg:p-8">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="h-11 w-11 rounded-xl bg-gray-200" />
              <div className="h-3 w-14 rounded bg-gray-100" />
            </div>
            <div className="mb-1.5 h-6 w-16 rounded-lg bg-gray-200" />
            <div className="h-3 w-24 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      {/* Main content block */}
      <div className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="h-5 w-40 rounded-lg bg-gray-200" />
          <div className="h-8 w-24 rounded-xl bg-gray-200" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-4 rounded-xl bg-gray-50 p-3">
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gray-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-2/5 rounded bg-gray-200" />
                <div className="h-2.5 w-3/5 rounded bg-gray-100" />
              </div>
              <div className="h-6 w-16 shrink-0 rounded-lg bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Secondary block */}
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-gray-200 bg-white p-5">
            <div className="mb-3 h-4 w-32 rounded-lg bg-gray-200" />
            <div className="space-y-2">
              {[1, 2, 3].map((j) => (
                <div key={j} className="h-3 rounded bg-gray-100" style={{ width: `${70 - j * 10}%` }} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export type AppLayoutSkeletonVariant = 'dashboard' | 'settings' | 'list';

export const AppLayoutSkeleton: React.FC<{ variant?: AppLayoutSkeletonVariant }> = ({
  variant = 'dashboard',
}) => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <SidebarSkeleton />

      {/* Offset for fixed sidebar on desktop */}
      <div className="flex flex-1 flex-col overflow-hidden md:ml-64">
        <HeaderSkeleton />
        <main className="flex-1 overflow-y-auto">
          <ContentSkeleton variant={variant} />
        </main>
      </div>
    </div>
  );
};
