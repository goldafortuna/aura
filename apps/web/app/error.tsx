'use client';

import { useEffect } from 'react';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-gray-50 p-6">
      <h1 className="text-xl font-bold text-gray-900">Terjadi kesalahan</h1>
      <p className="max-w-lg text-center text-sm text-gray-600">
        {error.message || 'Aplikasi tidak dapat menampilkan halaman ini.'}
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-gray-400">Ref: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm hover:opacity-95"
      >
        Coba lagi
      </button>
    </div>
  );
}
