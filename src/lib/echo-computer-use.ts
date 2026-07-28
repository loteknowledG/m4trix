import { elementToScreenClick } from '@/lib/screen-click-coords';

export const DEFAULT_ECHO_BASE_URL = 'http://127.0.0.1:8787';

const ECHO_READY_CACHE_MS = 5000;
let echoReadyCache: { ready: boolean; checkedAt: number } | null = null;

export function resolveEchoBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const fromWindow = (window as Window & { ECHO_COMPUTER_USE_URL?: string }).ECHO_COMPUTER_USE_URL;
    if (fromWindow?.trim()) {
      return fromWindow.trim().replace(/\/$/, '');
    }
  }
  return DEFAULT_ECHO_BASE_URL;
}

async function echoFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${resolveEchoBaseUrl()}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Echo request failed (${response.status})`);
  }
  return payload;
}

export async function getEchoComputerUseStatus(): Promise<{ status: string }> {
  return echoFetch('/api/status');
}

export async function echoClickScreen(
  x: number,
  y: number,
  button: 'left' | 'right' | 'middle' = 'left',
): Promise<{ status: string; summary: string; error?: string }> {
  const result = await echoFetch<{ receipt: { status: string; summary: string; error?: string } }>(
    '/api/execute',
    {
      method: 'POST',
      body: JSON.stringify({ action: 'click', x, y, button }),
    },
  );
  return result.receipt;
}

export async function isEchoComputerUseReady(): Promise<boolean> {
  if (echoReadyCache && Date.now() - echoReadyCache.checkedAt < ECHO_READY_CACHE_MS) {
    return echoReadyCache.ready;
  }

  try {
    const status = await getEchoComputerUseStatus();
    const ready = status.status === 'READY';
    echoReadyCache = { ready, checkedAt: Date.now() };
    return ready;
  } catch {
    echoReadyCache = { ready: false, checkedAt: Date.now() };
    return false;
  }
}

export { elementToScreenClick } from '@/lib/screen-click-coords';
