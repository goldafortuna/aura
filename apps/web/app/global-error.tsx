'use client';

/** Menangkap error di root layout. Wajib membungkus dengan html dan body sendiri. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="id">
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: '#f9fafb',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>Terjadi kesalahan</h1>
          <p style={{ maxWidth: 480, textAlign: 'center', color: '#4b5563', fontSize: '0.875rem' }}>
            {error.message || 'Gagal memuat aplikasi.'}
          </p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              borderRadius: 12,
              border: 'none',
              background: '#4f46e5',
              color: '#fff',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Coba lagi
          </button>
        </div>
      </body>
    </html>
  );
}
