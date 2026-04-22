import { redirect } from 'next/navigation';

/** Beranda Academy sekarang di `/app` (tab SPA); pertahankan URL untuk bookmark. */
export default function AcademyIndexRedirect() {
  redirect('/app?tab=academy');
}
