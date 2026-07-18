export const RUNNING_VERSION_STORAGE_KEY = "m4trix-running-version-v1";
export const UPDATE_DISMISS_STORAGE_KEY = "m4trix-update-dismissed-v1";
export const APP_UPDATE_PROMPT_EVENT = "m4trix:app-update-prompt";

type AppVersionResponse = {
  version?: string;
};

export type AppUpdateCheckResult =
  | { status: "up-to-date"; running: string; latest: string }
  | { status: "update-available"; running: string; latest: string }
  | { status: "unavailable"; message?: string }
  | { status: "local-dev"; message: string };

export async function fetchAppReleaseVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/app-version/", { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as AppVersionResponse;
    const version = typeof json.version === "string" ? json.version.trim() : "";
    return version || null;
  } catch {
    return null;
  }
}

export function getEmbeddedReleaseVersion(): string | null {
  if (typeof document === "undefined") return null;

  const fromHtml = document.documentElement.getAttribute("data-m4trix-release");
  if (fromHtml?.trim()) return fromHtml.trim();

  const meta = document.querySelector('meta[name="m4trix-release"]');
  const fromMeta = meta?.getAttribute("content")?.trim();
  return fromMeta || null;
}

/** Prefer the build baked into this page over sessionStorage. */
export function syncRunningReleaseVersion(): string | null {
  const embedded = getEmbeddedReleaseVersion();
  if (embedded) {
    setStoredRunningVersion(embedded);
    return embedded;
  }
  return getStoredRunningVersion();
}

export function getStoredRunningVersion(): string | null {
  try {
    return window.sessionStorage.getItem(RUNNING_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredRunningVersion(version: string) {
  try {
    window.sessionStorage.setItem(RUNNING_VERSION_STORAGE_KEY, version);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function readDismissedUpdateVersion(): string | null {
  try {
    return window.sessionStorage.getItem(UPDATE_DISMISS_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function dismissAppUpdate(version: string) {
  try {
    window.sessionStorage.setItem(UPDATE_DISMISS_STORAGE_KEY, version);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function clearDismissedAppUpdate() {
  try {
    window.sessionStorage.removeItem(UPDATE_DISMISS_STORAGE_KEY);
  } catch {
    /* sessionStorage unavailable */
  }
}

export function promptForAppUpdate(version: string, options?: { force?: boolean }) {
  if (!options?.force && readDismissedUpdateVersion() === version) return;
  if (options?.force) {
    clearDismissedAppUpdate();
  }
  window.dispatchEvent(
    new CustomEvent(APP_UPDATE_PROMPT_EVENT, {
      detail: { version },
    }),
  );
}

export async function restartAppForUpdate(waitingWorker?: ServiceWorker | null) {
  const latest = await fetchAppReleaseVersion();
  if (latest) {
    setStoredRunningVersion(latest);
    clearDismissedAppUpdate();
  }

  if (waitingWorker) {
    waitingWorker.postMessage("SKIP_WAITING");
    return;
  }

  window.location.reload();
}

export async function checkForAppUpdate(options?: {
  manual?: boolean;
}): Promise<AppUpdateCheckResult> {
  const manual = options?.manual ?? false;

  if (!manual && !shouldPollForAppUpdates()) {
    return {
      status: "local-dev",
      message: "Update checks run automatically on deployed m4trix builds.",
    };
  }

  const latest = await fetchAppReleaseVersion();
  if (!latest) {
    return { status: "unavailable" };
  }

  if (!manual && (latest === "dev" || latest === "unknown")) {
    return {
      status: "local-dev",
      message: "Update checks run automatically on deployed m4trix builds.",
    };
  }

  const running = syncRunningReleaseVersion();
  if (!running) {
    setStoredRunningVersion(latest);
    return { status: "up-to-date", running: latest, latest };
  }

  if (latest !== running) {
    if (!manual) {
      promptForAppUpdate(latest);
    }
    return { status: "update-available", running, latest };
  }

  return { status: "up-to-date", running, latest };
}

export function shouldPollForAppUpdates(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "development") return false;

  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1";
}
