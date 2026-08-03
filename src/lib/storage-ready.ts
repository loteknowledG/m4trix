import { get } from 'idb-keyval';

import { kvReady } from '@/lib/sqlite-kv';

const DEFAULT_TIMEOUT_MS = 25_000;

function withTimeout<T>(promise: Promise<T>, label: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]).finally(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
}

/** Ensure SQLite KV is initialized (call early from layout warmup). */
export function warmStorage(): void {
  void kvReady().catch(error => {
    console.warn('[storage] warmup failed', error);
  });
}

export async function readStorageKey<T>(key: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T | undefined> {
  await withTimeout(kvReady(), 'Storage initialization', timeoutMs);
  return withTimeout(get<T>(key), `Reading ${key}`, timeoutMs);
}

export async function writeStorageKey(key: string, value: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<void> {
  const { set } = await import('idb-keyval');
  await withTimeout(kvReady(), 'Storage initialization', timeoutMs);
  await withTimeout(set(key, value), `Writing ${key}`, timeoutMs);
}
