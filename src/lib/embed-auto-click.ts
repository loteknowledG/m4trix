import {
  getDesktopBridge,
  isDesktopAutoUpdateShell,
  type EmbedAutoClickResult,
  type EmbedClickBounds,
} from '@/lib/app-update-client';
import { logger } from '@/lib/logger';

const DEFAULT_DELAYS_MS = [700, 1500, 2500];

export function isElectronEmbedAutoClickAvailable(): boolean {
  return isDesktopAutoUpdateShell() && typeof getDesktopBridge()?.autoClickEmbedPlay === 'function';
}

function clickWebFallback(element: HTMLElement): EmbedAutoClickResult {
  const overlay = document.getElementById('m4trix-embed-play-start');
  if (overlay instanceof HTMLElement) {
    overlay.click();
    return { ok: true, click: 'overlay' };
  }

  const rect = element.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const target = document.elementFromPoint(cx, cy);
  if (target instanceof HTMLElement) {
    target.click();
    return { ok: true, click: { x: Math.round(cx), y: Math.round(cy) } };
  }

  return { ok: false, error: 'No click target found' };
}

export async function autoClickEmbedPlayer(
  element: HTMLElement,
): Promise<EmbedAutoClickResult> {
  const rect = element.getBoundingClientRect();
  if (rect.width < 8 || rect.height < 8) {
    return { ok: false, error: 'Player area too small' };
  }

  const bounds: EmbedClickBounds = {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  };

  const desktop = getDesktopBridge();
  if (desktop?.autoClickEmbedPlay) {
    try {
      const result = await desktop.autoClickEmbedPlay(bounds);
      if (result.ok) {
        logger.info('Electron embed auto-click', {
          click: result.click,
          screenshotPath: result.screenshotPath,
        });
        return result;
      }
      logger.warn('Electron embed auto-click failed', result.error);
      return result;
    } catch (error) {
      logger.warn('Electron embed auto-click threw', error);
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  return clickWebFallback(element);
}

type ScheduleEmbedAutoClickOptions = {
  delaysMs?: number[];
  enabled?: boolean;
  shouldRetry?: () => boolean;
};

/**
 * Electron-first: after an embed is selected, wait for the iframe to paint,
 * screenshot the player, and click once at the center play-button region.
 * Retries only while `shouldRetry()` returns true (e.g. overlay still visible).
 */
export function scheduleEmbedAutoClick(
  getElement: () => HTMLElement | null,
  options?: ScheduleEmbedAutoClickOptions,
): () => void {
  const enabled = options?.enabled ?? true;
  if (!enabled) return () => {};

  const delaysMs = options?.delaysMs ?? DEFAULT_DELAYS_MS;
  const shouldRetry = options?.shouldRetry ?? (() => false);
  let cancelled = false;
  const timers: number[] = [];

  delaysMs.forEach((delayMs, index) => {
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (index > 0 && !shouldRetry()) return;

      const element = getElement();
      if (!element) return;

      void autoClickEmbedPlayer(element).then(result => {
        if (!result.ok) {
          logger.debug('Embed auto-click attempt failed', { attempt: index + 1, error: result.error });
        }
      });
    }, delayMs);
    timers.push(timer);
  });

  return () => {
    cancelled = true;
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
  };
}
