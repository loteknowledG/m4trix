export type VideoSkipSegment = {
  id: string;
  start: number;
  end: number;
  label?: string;
};

export function newVideoSkipSegmentId() {
  return `skip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultVideoSkipSegment(start = 0, end = 5): VideoSkipSegment {
  return {
    id: newVideoSkipSegmentId(),
    start,
    end,
    label: '',
  };
}

function mergeSkipSegments(segments: VideoSkipSegment[]): VideoSkipSegment[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start);
  const merged: VideoSkipSegment[] = [{ ...sorted[0]! }];

  for (let i = 1; i < sorted.length; i += 1) {
    const seg = sorted[i]!;
    const last = merged.at(-1)!;
    if (seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
      if (!last.label?.trim() && seg.label?.trim()) {
        last.label = seg.label;
      }
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

export function normalizeVideoSkipSegment(value: unknown): VideoSkipSegment | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const start = typeof record.start === 'number' ? record.start : Number.NaN;
  const end = typeof record.end === 'number' ? record.end : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;

  return {
    id: typeof record.id === 'string' ? record.id : newVideoSkipSegmentId(),
    start: Math.max(0, start),
    end: Math.max(start + 0.5, end),
    label: typeof record.label === 'string' ? record.label : undefined,
  };
}

export function normalizeVideoSkipSegments(value: unknown): VideoSkipSegment[] {
  if (!Array.isArray(value)) return [];
  const segments: VideoSkipSegment[] = [];
  for (const entry of value) {
    const segment = normalizeVideoSkipSegment(entry);
    if (segment) segments.push(segment);
  }
  return mergeSkipSegments(segments);
}

/** If playback time falls inside a skip range, return the time to jump to. */
export function getSkipTargetTime(
  segments: VideoSkipSegment[],
  currentTime: number,
): number | null {
  const t = Math.max(0, currentTime);
  for (const segment of segments) {
    if (t >= segment.start && t < segment.end) {
      return segment.end;
    }
  }
  return null;
}

export function commitSkipSegmentStart(start: number, end: number, minDuration = 1) {
  const nextStart = Math.max(0, start);
  if (end <= nextStart) {
    return { start: nextStart, end: nextStart + minDuration };
  }
  return { start: nextStart, end };
}

export function commitSkipSegmentEnd(start: number, end: number) {
  return { start, end: Math.max(start + 0.5, end) };
}
