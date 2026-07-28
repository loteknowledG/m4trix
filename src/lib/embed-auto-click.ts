import {
  getDesktopBridge,
  isDesktopAutoUpdateShell,
  type EmbedAutoClickResult,
  type EmbedClickBounds,
} from '@/lib/app-update-client';
import { echoClickScreen, isEchoComputerUseReady } from '@/lib/echo-computer-use';
import { elementToScreenClick } from '@/lib/screen-click-coords';
import { logger } from '@/lib/logger';

const CLICK_DELAYS_MS = [0, 700, 1500, 2800];

export function isElectronEmbedAutoClickAvailable(): boolean {
  return isDesktopAutoUpdateShell() && typeof getDesktopBridge()?.autoClickEmbedPlay === 'function';
}

function isEchoClickOk(status: string): boolean {
  return status.toLowerCase() === 'success';
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

async function autoClickViaEcho(element: HTMLElement): Promise<EmbedAutoClickResult> {
  if (!(await isEchoComputerUseReady())) {
    return { ok: false, error: 'Echo computer use is not ready' };
  }

  try {
    window.focus();
  } catch {
    // Continue even if focus fails.
  }

  element.scrollIntoView({ block: 'center', inline: 'nearest' });
  const click = elementToScreenClick(element);

  try {
    const receipt = await echoClickScreen(click.x, click.y, 'left');
    if (isEchoClickOk(receipt.status)) {
      logger.info('Echo embed auto-click', { click, summary: receipt.summary });
      return { ok: true, click };
    }
    return { ok: false, error: receipt.error ?? receipt.summary };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function autoClickEmbedPlayer(element: HTMLElement): Promise<EmbedAutoClickResult> {
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
        return result;
      }
    } catch {
      // Fall through to Echo.
    }
  }

  const echoResult = await autoClickViaEcho(element);
  if (echoResult.ok) {
    return echoResult;
  }

  return clickWebFallback(element);
}

type ScheduleEmbedAutoClickOptions = {
  shouldRetry?: () => boolean;
};

/** Click the center of the player until playback starts. */
export function scheduleEmbedAutoClick(
  getElement: () => HTMLElement | null,
  options?: ScheduleEmbedAutoClickOptions,
): () => void {
  const shouldRetry = options?.shouldRetry ?? (() => true);
  let cancelled = false;
  const timers: number[] = [];

  CLICK_DELAYS_MS.forEach((delayMs, index) => {
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      if (index > 0 && !shouldRetry()) return;

      const element = getElement();
      if (!element) {
        logger.debug('Embed auto-click skipped: player element missing', { attempt: index + 1 });
        return;
      }

      void autoClickEmbedPlayer(element).then(result => {
        if (!result.ok) {
          logger.warn('Embed auto-click failed', { attempt: index + 1, error: result.error });
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
