import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDevBypassWarningContext, isDevBypassAllowed, isDevBypassRequested } from './lib/devBypass';

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/google/calendar/oauth/callback',
]);

export default clerkMiddleware(async (auth, req: NextRequest) => {
  if (isDevBypassAllowed()) {
    return NextResponse.next();
  }

  if (isDevBypassRequested()) {
    console.warn(
      '[DEV_BYPASS_AUTH] ignored by middleware because bypass is only allowed in local development.',
      getDevBypassWarningContext(),
    );
  }

  if (!isPublicRoute(req)) {
    await auth.protect();
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
