import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // Block access to the experimental Skunkworx route unless explicitly enabled.
  // Prevents direct URL access even if someone knows the path.
  if (req.nextUrl.pathname.startsWith('/skunkworx') && process.env.NEXT_PUBLIC_ENABLE_SKUNKWORX !== 'true') {
    return NextResponse.redirect(new URL('/', req.url));
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i]);
  }
  const nonce = typeof btoa !== "undefined" ? btoa(raw) : Buffer.from(raw).toString("base64");

  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https: https://lh3.googleusercontent.com https://*.googleusercontent.com; connect-src 'self' https://m4trix.vercel.app;`;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-csp-nonce", nonce);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    },
    headers: {
      "Content-Security-Policy": csp
    }
  });
}

export const config = {
  matcher: "/:path*"
};
