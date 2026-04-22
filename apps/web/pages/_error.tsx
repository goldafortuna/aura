import type { NextPageContext } from 'next';

type ErrorPageProps = {
  statusCode?: number;
};

/**
 * Fallback error Pages Router — diperlukan agar Next tidak gagal saat merender error
 * ("missing required error components"). Rute UI utama memakai App Router di `app/`.
 */
export default function PagesRouterError({ statusCode }: ErrorPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-900">
      <h1 className="text-xl font-bold">Terjadi kesalahan</h1>
      <p className="mt-2 text-sm text-gray-600">
        {statusCode ? `Kode HTTP: ${statusCode}.` : 'Tidak dapat memuat halaman.'} Silakan muat ulang atau coba lagi nanti.
      </p>
    </div>
  );
}

PagesRouterError.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res?.statusCode ?? (err as { statusCode?: number } | undefined)?.statusCode ?? 404;
  return { statusCode };
};
