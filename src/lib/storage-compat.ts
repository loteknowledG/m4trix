import { del, get, keys, set } from 'idb-keyval';

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function serialize(value: unknown) {
  if (value === undefined) return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function deserialize<T>(value: string | null) {
  if (value == null) return undefined;
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

function readLocalStorage<T>(key: string) {
  if (!canUseLocalStorage()) return undefined;
  return deserialize<T>(window.localStorage.getItem(key));
}

function writeLocalStorage(key: string, value: unknown) {
  if (!canUseLocalStorage()) return;
  const serialized = serialize(value);
  if (serialized == null) {
    window.localStorage.removeItem(key);
    return;
  }
  window.localStorage.setItem(key, serialized);
}

export async function safeGet<T>(key: string) {
  try {
    const value = await get<T>(key);
    if (value !== undefined) {
      return value;
    }
  } catch {
    // fall through to localStorage
  }

  return readLocalStorage<T>(key);
}

export async function safeSet<T>(key: string, value: T) {
  try {
    await set(key, value);
  } catch {
    // ignore and fall back to localStorage
  }

  writeLocalStorage(key, value);
}

export async function safeDel(key: string) {
  try {
    await del(key);
  } catch {
    // ignore and fall back to localStorage
  }

  if (canUseLocalStorage()) {
    window.localStorage.removeItem(key);
  }
}

export async function safeKeys() {
  try {
    return await keys();
  } catch {
    if (!canUseLocalStorage()) return [];
    const output: string[] = [];
    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index);
      if (key) {
        output.push(key);
      }
    }
    return output;
  }
}
