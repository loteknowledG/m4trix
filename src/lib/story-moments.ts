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
  if (src.startsWith("data:image/")) return true;
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
  const seen = new Set<string>();

  for (const raw of rawItems) {
    const moment = normalizeStoryMomentEntry(raw);
    if (!moment || seen.has(moment.id)) continue;
    seen.add(moment.id);
    normalized.push(moment);
  }

  return normalized;
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
