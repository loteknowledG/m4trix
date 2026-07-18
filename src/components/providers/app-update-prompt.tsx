"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  APP_UPDATE_PROMPT_EVENT,
  checkForAppUpdate,
  dismissAppUpdate,
  fetchAppReleaseVersion,
  promptForAppUpdate,
  restartAppForUpdate,
  shouldPollForAppUpdates,
  syncRunningReleaseVersion,
} from "@/lib/app-update-client";

const VERSION_CHECK_MS = 5 * 60_000;

export function AppUpdatePrompt() {
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  const showUpdate = useCallback((version: string) => {
    setUpdateVersion(version);
  }, []);

  const checkForUpdate = useCallback(async () => {
    const result = await checkForAppUpdate();
    if (result.status === "update-available") {
      showUpdate(result.latest);
      return;
    }
    setUpdateVersion(null);
  }, [showUpdate]);

  const restartForUpdate = useCallback(() => {
    void restartAppForUpdate(waitingWorkerRef.current);
  }, []);

  const dismissForNow = useCallback(() => {
    if (updateVersion) {
      dismissAppUpdate(updateVersion);
    }
    setUpdateVersion(null);
  }, [updateVersion]);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      const version = (event as CustomEvent<{ version?: string }>).detail?.version;
      if (typeof version === "string" && version.trim()) {
        showUpdate(version.trim());
      }
    };

    window.addEventListener(APP_UPDATE_PROMPT_EVENT, onPrompt);
    return () => window.removeEventListener(APP_UPDATE_PROMPT_EVENT, onPrompt);
  }, [showUpdate]);

  useEffect(() => {
    if (!shouldPollForAppUpdates()) return;

    void checkForUpdate();

    const onFocus = () => {
      void checkForUpdate();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void checkForUpdate();
      }
    };

    const intervalId = window.setInterval(() => {
      void checkForUpdate();
    }, VERSION_CHECK_MS);

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [checkForUpdate]);

  useEffect(() => {
    if (!shouldPollForAppUpdates()) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        const trackWaitingWorker = (worker: ServiceWorker | null) => {
          if (!worker || cancelled) return;
          waitingWorkerRef.current = worker;
          void Promise.all([
            fetchAppReleaseVersion(),
            Promise.resolve(syncRunningReleaseVersion()),
          ]).then(([latest, running]) => {
            if (latest && running && latest !== running) {
              promptForAppUpdate(latest);
            }
          });
        };

        if (registration.waiting) {
          trackWaitingWorker(registration.waiting);
        }

        registration.addEventListener("updatefound", () => {
          const installing = registration.installing;
          if (!installing) return;

          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              trackWaitingWorker(registration.waiting);
            }
          });
        });

        const onControllerChange = () => {
          window.location.reload();
        };

        navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

        return () => {
          navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
        };
      } catch {
        return undefined;
      }
    };

    let cleanupControllerListener: (() => void) | undefined;
    void registerServiceWorker().then((cleanup) => {
      cleanupControllerListener = cleanup;
    });

    return () => {
      cancelled = true;
      cleanupControllerListener?.();
    };
  }, []);

  if (!updateVersion) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-[200] flex justify-center p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-2xl flex-col gap-3 rounded-lg border border-fuchsia-500/30 bg-zinc-950/95 p-4 text-zinc-100 shadow-[0_0_24px_rgba(217,70,239,0.18)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-wide text-fuchsia-200">Update ready</p>
          <p className="mt-1 text-xs leading-relaxed text-zinc-400">
            A newer m4trix build is available. Restart to load the latest version.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800"
            onClick={dismissForNow}
          >
            Later
          </button>
          <button
            type="button"
            className="rounded-md border border-fuchsia-500/50 bg-fuchsia-600/80 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-fuchsia-500"
            onClick={restartForUpdate}
          >
            Restart now
          </button>
        </div>
      </div>
    </div>
  );
}
