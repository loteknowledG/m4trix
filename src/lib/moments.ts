export function normalizeMomentSrc(src: string | undefined | null): string {
  if (!src) return '';
  const s = String(src);

  // Already proxied through our API route
  if (s.startsWith('/api/img?u=')) {
    return s;
  }

  // Only special-case Google Photos / googleusercontent URLs
  if (/googleusercontent\.com\//.test(s)) {
    let withSize = s;
    // Ensure a size parameter is present; '=s0' means original size.
    if (!/[?&]w=\d+/.test(withSize) && !/=[ws]\d+/.test(withSize)) {
      withSize = withSize + '=s0';
    }
    const esc = encodeURIComponent(withSize);
    return `/api/img?u=${esc}`;
  }

  return s;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string' && result.startsWith('data:')) {
        resolve(result);
        return;
      }
      reject(new Error('Failed to encode image as data URL'));
    };
    reader.onerror = () => reject(reader.error || new Error('Failed to read image blob'));
    reader.readAsDataURL(blob);
  });
}

/** True when the src needs network fetch to survive backup import/export. */
export function isEphemeralMomentSrc(src: string | undefined | null): boolean {
  if (!src) return false;
  const s = String(src);
  if (s.startsWith('data:')) return false;
  if (s.startsWith('blob:')) return true;
  if (s.startsWith('/api/img?u=')) return true;
  if (/^https?:\/\//i.test(s) && /googleusercontent\.com\//.test(s)) return true;
  return false;
}

/**
 * Fetch a moment src (proxy URL, Google URL, or http(s)) into a durable data URL.
 * Returns the original src when already durable or when fetch fails.
 */
export async function materializeMomentSrc(src: string | undefined | null): Promise<string> {
  if (!src) return '';
  const original = String(src);
  if (original.startsWith('data:')) return original;
  if (!isEphemeralMomentSrc(original)) return original;

  try {
    const fetchUrl = normalizeMomentSrc(original);
    const res = await fetch(fetchUrl);
    if (!res.ok) return original;
    const blob = await res.blob();
    if (!blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
      // Still try — some proxies omit content-type.
    }
    return await blobToDataUrl(blob);
  } catch {
    return original;
  }
}

export async function materializeMomentRecord<T extends { src?: string; url?: string }>(
  moment: T
): Promise<T> {
  const candidate = moment?.src || moment?.url;
  if (!candidate || !isEphemeralMomentSrc(candidate)) return moment;
  const dataUrl = await materializeMomentSrc(candidate);
  if (!dataUrl || dataUrl === candidate) return moment;
  return { ...moment, src: dataUrl };
}

export async function materializeMomentList<T extends { src?: string; url?: string }>(
  moments: T[],
  concurrency = 4
): Promise<T[]> {
  if (!Array.isArray(moments) || moments.length === 0) return moments;

  const out = moments.slice();
  let index = 0;

  const workers = Array.from({ length: Math.min(concurrency, out.length) }, async () => {
    while (index < out.length) {
      const current = index++;
      out[current] = await materializeMomentRecord(out[current]!);
    }
  });

  await Promise.all(workers);
  return out;
}
