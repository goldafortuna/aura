import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from './lib/devBypass';

const PUBLIC_PATH_PREFIXES = ['/', '/sign-in', '/sign-up', '/api/google/calendar/oauth/callback'];

function isPublicRoute(pathname: string) {
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function hasClerkSessionCookie(req: NextRequest) {
  return Boolean(req.cookies.get('__session') || req.cookies.get('__client_uat'));
}

export default function middleware(req: NextRequest) {
  if (isDevBypassAllowed()) {
    return NextResponse.next();
  }

  if (isDevBypassRequested()) {
    console.warn(
      '[DEV_BYPASS_AUTH] ignored by middleware because bypass is only allowed in local development.',
      getDevBypassWarningContext(),
    );
  }

  if (!isPublicRoute(req.nextUrl.pathname) && !hasClerkSessionCookie(req)) {
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    const signInUrl = new URL('/sign-in', req.url);
    signInUrl.searchParams.set('redirect_url', req.url);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
