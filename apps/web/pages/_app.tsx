import type { AppProps } from 'next/app';
import { ClerkProvider } from '@clerk/nextjs';
/** Wajib untuk route `pages/*`: App Router memuat ini lewat `app/layout.tsx` saja; tanpa impor di sini Tailwind/CSS tidak aktif. */
import '../app/globals.css';

/**
 * Semua route di `pages/` (mis. `/cta-dashboard`) memakai Pages Router dan **tidak** otomatis
 * dibungkus `ClerkProvider` dari `app/layout.tsx`. Tanpa provider ini, komponen seperti
 * `UserButton`, `SignOutButton`, dan `useUser` di Header/Sidebar melempar "ClerkInstanceContext not found".
 */
export default function PagesApp({ Component, pageProps }: AppProps) {
  return (
    <ClerkProvider>
      <Component {...pageProps} />
    </ClerkProvider>
  );
}
