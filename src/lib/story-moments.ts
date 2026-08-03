import { MEDIA_REF_PREFIX, stableMediaRefForSrc } from '@/lib/media-blob-store';

export type StoryMomentRecord = {
  id: string;
  src: string;
  name?: string;
  fingerprint?: string;
  dialogScript?: unknown;
  dialogLines?: unknown;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isLikelyMomentSrc(value: string): boolean {
  const src = value.trim();
  if (!src) return false;
  if (src.startsWith("data:image/") || src.startsWith("data:video/")) return true;
  if (src.startsWith("blob:")) return true;
  if (src.startsWith("http://") || src.startsWith("https://")) return true;
  if (src.startsWith("/api/img")) return true;
  if (src.startsWith("/")) return true;
  if (UUID_RE.test(src)) return false;
  return src.length >= 12;
}

export function storyMomentId(raw: unknown): string | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || null;
  }
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (typeof record.id === "string" && record.id.trim()) return record.id.trim();
  }
  return null;
}

export function normalizeStoryMomentEntry(raw: unknown): StoryMomentRecord | null {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || !isLikelyMomentSrc(trimmed)) return null;
    return { id: trimmed, src: trimmed };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const record = raw as Record<string, unknown>;
  const srcCandidate =
    typeof record.src === "string"
      ? record.src.trim()
      : typeof record.url === "string"
        ? record.url.trim()
        : "";

  if (!isLikelyMomentSrc(srcCandidate)) return null;

  const id =
    typeof record.id === "string" && record.id.trim() ? record.id.trim() : srcCandidate;

  return {
    id,
    src: srcCandidate,
    name: typeof record.name === "string" ? record.name : undefined,
    fingerprint: typeof record.fingerprint === "string" ? record.fingerprint : undefined,
    dialogScript: record.dialogScript,
    dialogLines: record.dialogLines,
  };
}

export function normalizeStoryMomentList(rawItems: unknown[]): StoryMomentRecord[] {
  const normalized: StoryMomentRecord[] = [];
  const seenIds = new Set<string>();
  const seenSrc = new Set<string>();
  const seenFingerprints = new Set<string>();

  for (const raw of rawItems) {
    const moment = normalizeStoryMomentEntry(raw);
    if (!moment || seenIds.has(moment.id)) continue;

    if (moment.fingerprint) {
      if (seenFingerprints.has(moment.fingerprint)) continue;
      seenFingerprints.add(moment.fingerprint);
    }

    const srcKey = momentSrcDedupeKey(moment.src);
    if (srcKey && seenSrc.has(srcKey)) continue;

    seenIds.add(moment.id);
    if (srcKey) seenSrc.add(srcKey);
    normalized.push(moment);
  }

  return normalized;
}

/** Stable key for deduping moments that reference the same underlying media. */
export function momentSrcDedupeKey(src: string | undefined | null): string {
  const trimmed = (src ?? "").trim();
  if (!trimmed) return "";
  if (trimmed.startsWith(MEDIA_REF_PREFIX)) return trimmed;

  const stableRef = stableMediaRefForSrc(trimmed);
  if (stableRef) return stableRef;

  if (trimmed.startsWith("data:")) return trimmed;

  const withoutQuery = trimmed.split("?")[0] ?? trimmed;
  try {
    const url = new URL(trimmed);
    return `${url.origin}${url.pathname}`;
  } catch {
    return withoutQuery;
  }
}

export function reorderStoryMoments<T>(moments: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= moments.length ||
    to >= moments.length
  ) {
    return [...moments];
  }

  const result = [...moments];
  const [moved] = result.splice(from, 1);
  const insertAt = from < to ? to - 1 : to;
  result.splice(insertAt, 0, moved);
  return result;
}

export function dedupeStoryMomentsBySrc(moments: StoryMomentRecord[]): StoryMomentRecord[] {
  return normalizeStoryMomentList(moments);
}

export function storyMomentSrcExists(
  moments: StoryMomentRecord[],
  src: string,
  fingerprint?: string,
): boolean {
  return moments.some((moment) => {
    if (fingerprint && moment.fingerprint && moment.fingerprint === fingerprint) return true;
    const srcKey = momentSrcDedupeKey(src);
    return srcKey !== "" && momentSrcDedupeKey(moment.src) === srcKey;
  });
}

export function readStoryMomentItems(stored: unknown): unknown[] {
  if (Array.isArray(stored)) return stored;
  if (stored && typeof stored === "object" && Array.isArray((stored as { items?: unknown[] }).items)) {
    return (stored as { items: unknown[] }).items;
  }
  return [];
}

export function filterStoryMomentItems(rawItems: unknown[], removeIds: string[]): unknown[] {
  const remove = new Set(removeIds);
  return rawItems.filter((raw) => {
    const momentId = storyMomentId(raw);
    return momentId ? !remove.has(momentId) : true;
  });
}

export function mergeStoryMomentItemsForSave(
  nextMoments: StoryMomentRecord[],
  existingRawItems: unknown[],
): StoryMomentRecord[] {
  const existingById = new Map<string, StoryMomentRecord>();
  for (const raw of existingRawItems) {
    const normalized = normalizeStoryMomentEntry(raw);
    if (normalized) existingById.set(normalized.id, normalized);
  }

  return nextMoments.map((moment) => {
    const existing = existingById.get(moment.id);
    if (!existing) return moment;
    return {
      ...existing,
      ...moment,
      src: moment.src,
      dialogScript: existing.dialogScript ?? moment.dialogScript,
      dialogLines: existing.dialogLines ?? moment.dialogLines,
    };
  });
}
