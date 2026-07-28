import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const RESERVED = new Set(['list', 'chat', 'detail', 'new']);

/** Legacy `/characters/:id` bookmarks → static-export-safe detail route. */
export function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/characters\/([^/]+)\/?$/);
  if (!match) {
    return NextResponse.next();
  }

  const id = decodeURIComponent(match[1]).trim();
  if (!id || RESERVED.has(id)) {
    return NextResponse.next();
  }

  const url = request.nextUrl.clone();
  url.pathname = '/characters/detail';
  url.searchParams.set('id', id);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/characters/:path*'],
};
