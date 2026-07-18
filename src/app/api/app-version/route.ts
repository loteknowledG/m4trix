import { NextResponse } from "next/server";

import { getAppReleaseVersion } from "@/lib/app-release-version.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(
    { version: getAppReleaseVersion() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
