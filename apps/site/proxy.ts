import { NextResponse, type NextRequest } from 'next/server';
import { gateRedirect, isConfirmed } from './src/gate';

/**
 * Every file of every demo — page, scripts, atlases, audio — is refused until the visitor has tapped
 * "YES, 18+" in this session. Gating only the HTML would leave the game fetchable by asset URL.
 */
export function proxy(request: NextRequest) {
  const target = gateRedirect(
    isConfirmed(request.cookies),
    request.nextUrl.pathname,
    request.nextUrl.search,
  );
  if (target === null) return NextResponse.next();
  return NextResponse.redirect(new URL(target, request.url), 307);
}

export const config = {
  matcher: ['/play/:path*'],
};
