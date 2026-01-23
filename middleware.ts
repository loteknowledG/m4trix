import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let raw = "";
  for (let i = 0; i < bytes.length; i++) {
    raw += String.fromCharCode(bytes[i]);
  }
  const nonce = typeof btoa !== "undefined" ? btoa(raw) : Buffer.from(raw).toString("base64");

  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://m4trix.vercel.app;`;

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
