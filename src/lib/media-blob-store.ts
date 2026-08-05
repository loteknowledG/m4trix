const IDB_NAME = 'm4trix-media';
const STORE_NAME = 'blobs';
export const MEDIA_REF_PREFIX = 'm4trix-media://';
export const MEDIA_MIGRATION_KEY = '__sqlite_media_migrated__';

const INLINE_MEDIA_MIN_BYTES = 512;

type BlobRecord = {
  id: string;
  mimeType: string;
  bytes: ArrayBuffer;
};

const resolvedUrlCache = new Map<string, string>();
const reverseUrlCache = new Map<string, string>();

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isMediaReference(src: string | undefined | null): src is string {
  return typeof src === 'string' && src.startsWith(MEDIA_REF_PREFIX);
}

export function isInlineMediaSrc(src: string | undefined | null): boolean {
  if (typeof src !== 'string' || !src.startsWith('data:')) return false;
  return estimateDataUrlBytes(src) >= INLINE_MEDIA_MIN_BYTES;
}

function mediaRef(id: string) {
  return `${MEDIA_REF_PREFIX}${id}`;
}

function mediaIdFromRef(ref: string): string {
  return ref.slice(MEDIA_REF_PREFIX.length);
}

function estimateDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return dataUrl.length;
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  if (header.includes(';base64')) {
    return Math.floor((body.length * 3) / 4);
  }
  return body.length;
}

function dataUrlToBytes(dataUrl: string): { mimeType: string; bytes: Uint8Array } {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) {
    throw new Error('Invalid data URL');
  }
  const header = dataUrl.slice(0, comma);
  const body = dataUrl.slice(comma + 1);
  const mimeMatch = header.match(/^data:([^;,]+)/);
  const mimeType = mimeMatch?.[1] ?? 'application/octet-stream';
  if (header.includes(';base64')) {
    const binary = atob(body);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { mimeType, bytes };
  }
  const decoded = decodeURIComponent(body);
  return { mimeType, bytes: new TextEncoder().encode(decoded) };
}

function openMediaStore(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readBlobRecord(id: string): Promise<BlobRecord | null> {
  const idb = await openMediaStore();
  return new Promise((resolve, reject) => {
    const request = idb.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve((request.result as BlobRecord | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeBlobRecord(record: BlobRecord): Promise<void> {
  const idb = await openMediaStore();
  return new Promise((resolve, reject) => {
    const transaction = idb.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(record, record.id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function clearAllMediaBlobs(): Promise<void> {
  if (!isBrowser()) return;

  for (const url of resolvedUrlCache.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  resolvedUrlCache.clear();
  reverseUrlCache.clear();

  const idb = await openMediaStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = idb.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function deleteMediaRef(ref: string): Promise<void> {
  if (!isMediaReference(ref)) return;
  const id = mediaIdFromRef(ref);
  const cachedUrl = resolvedUrlCache.get(ref);
  if (cachedUrl) {
    reverseUrlCache.delete(cachedUrl);
    resolvedUrlCache.delete(ref);
    try {
      URL.revokeObjectURL(cachedUrl);
    } catch {
      /* ignore */
    }
  }
  const idb = await openMediaStore();
  await new Promise<void>((resolve, reject) => {
    const transaction = idb.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

async function storeInlineMediaSrc(src: string): Promise<string> {
  const { mimeType, bytes } = dataUrlToBytes(src);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await writeBlobRecord({
    id,
    mimeType,
    bytes: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });
  return mediaRef(id);
}

export async function persistMediaSrc(src: string | undefined | null): Promise<string> {
  if (!src) return '';
  if (isMediaReference(src)) return src;

  const existingRef = reverseUrlCache.get(src);
  if (existingRef) return existingRef;

  if (isInlineMediaSrc(src)) {
    return storeInlineMediaSrc(src);
  }

  return src;
}

export async function resolveMediaSrc(src: string | undefined | null): Promise<string> {
  if (!src) return '';
  if (!isMediaReference(src)) return src;

  const cached = resolvedUrlCache.get(src);
  if (cached) return cached;

  const record = await readBlobRecord(mediaIdFromRef(src));
  if (!record) return src;

  const blob = new Blob([record.bytes], { type: record.mimeType || 'application/octet-stream' });
  const objectUrl = URL.createObjectURL(blob);
  resolvedUrlCache.set(src, objectUrl);
  reverseUrlCache.set(objectUrl, src);
  return objectUrl;
}

const MEDIA_FIELD_NAMES = new Set(['src', 'url', 'previewSrc', 'coverSrc', 'avatarUrl']);

async function mapMediaFields<T>(
  value: T,
  mapper: (src: string) => Promise<string>,
): Promise<T> {
  if (Array.isArray(value)) {
    const next = await Promise.all(value.map((entry) => mapMediaFields(entry, mapper)));
    return next as T;
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const next: Record<string, unknown> = { ...record };
    for (const [key, fieldValue] of Object.entries(record)) {
      if (typeof fieldValue === 'string' && MEDIA_FIELD_NAMES.has(key)) {
        next[key] = await mapper(fieldValue);
      } else if (fieldValue && typeof fieldValue === 'object') {
        next[key] = await mapMediaFields(fieldValue, mapper);
      }
    }
    return next as T;
  }

  return value;
}

export async function externalizeMediaInValue<T>(value: T): Promise<T> {
  if (!isBrowser()) return value;
  return mapMediaFields(value, persistMediaSrc);
}

export async function hydrateMediaInValue<T>(value: T): Promise<T> {
  if (!isBrowser()) return value;
  return mapMediaFields(value, resolveMediaSrc);
}

export async function externalizeMediaString(src: string | undefined | null): Promise<string> {
  return persistMediaSrc(src);
}

export async function hydrateMediaString(src: string | undefined | null): Promise<string> {
  return resolveMediaSrc(src);
}

/** Map a hydrated blob URL back to its durable m4trix-media ref when possible. */
export function stableMediaRefForSrc(src: string | undefined | null): string | null {
  if (!src) return null;
  if (isMediaReference(src)) return src;
  return reverseUrlCache.get(src) ?? null;
}
