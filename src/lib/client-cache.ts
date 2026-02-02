const cache = new Map<string, any>();

export function getCached<T = any>(key: string): T | undefined {
  return cache.get(key) as T | undefined;
}

export function setCached<T = any>(key: string, value: T): void {
  try {
    cache.set(key, value);
  } catch (e) {
    // noop
  }
}

export function deleteCached(key: string): void {
  cache.delete(key);
}

export function clearCache(): void {
  cache.clear();
}

export default cache;
