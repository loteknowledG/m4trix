import type { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-static";

function isAllowedHost(urlStr: string): boolean {
  try {
    const u = new URL(urlStr);
    const host = u.hostname.toLowerCase();
    if (!/^https:$/i.test(u.protocol)) return false;
    return (
      host === "lh3.googleusercontent.com" ||
      host.endsWith(".googleusercontent.com")
    );
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    if (process.env.NEXT_PHASE === 'phase-production-build') {
      return new Response(null, { status: 204 });
    }
    const url = new URL(req.url);
    const target = url.searchParams.get("u");
    if (!target || !isAllowedHost(target)) {
      return new Response("Invalid or disallowed URL", { status: 400 });
    }

    const upstream = await fetch(target, {
      // Keep it simple; allow upstream to respond normally
      headers: {
        // Some CDNs behave differently with a UA present
        "User-Agent": "MatrixApp/1.0 (+https://m4trix)"
      },
    });

    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, { status: 502 });
    }

    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = await upstream.arrayBuffer();
    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err: any) {
    return new Response(String(err?.message || err || "Proxy failed"), { status: 500 });
  }
}
