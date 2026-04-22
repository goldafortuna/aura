import type { GetServerSideProps } from 'next';

/**
 * Route legacy: Monitoring TL sekarang di `/app` (tab SPA).
 * Redirect agar bookmark / link lama tetap berfungsi tanpa memuat Pages Router penuh.
 */
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: '/app?tab=cta-dashboard',
    permanent: false,
  },
});

export default function CtaDashboardLegacyRedirect() {
  return null;
}
