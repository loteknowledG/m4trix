import { readFileSync } from "node:fs";
import path from "node:path";

/** Stable deploy id used to detect when a new build is available. */
export function getAppReleaseVersion(): string {
  const fromEnv =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.M4TRIX_RELEASE_VERSION?.trim();
  if (fromEnv) return fromEnv;

  try {
    const buildId = readFileSync(path.join(process.cwd(), ".next/BUILD_ID"), "utf8").trim();
    if (buildId) return buildId;
  } catch {
    /* dev or pre-build */
  }

  return process.env.NODE_ENV === "development" ? "dev" : "unknown";
}
