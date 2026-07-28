import { formatCueTime, getActiveCues, type VideoTimedCue } from '@/lib/video-timed-cues';
import type { VideoSkipSegment } from '@/lib/video-skip-segments';

export type PlaybackMarkKind = 'dialog-start' | 'dialog-end' | 'skip';

export type PlaybackMark = {
  id: string;
  time: number;
  kind: PlaybackMarkKind;
  label: string;
};

export function formatPlaybackTime(seconds: number): string {
  const t = Math.max(0, seconds);
  const base = formatCueTime(t);
  const tenths = Math.floor((t % 1) * 10);
  return tenths > 0 ? `${base}.${tenths}` : base;
}

function cueLabel(cue: VideoTimedCue, index: number): string {
  if (cue.speaker?.trim()) return cue.speaker.trim();
  const text = cue.text.trim();
  if (text) return text.length > 28 ? `${text.slice(0, 28)}…` : text;
  return `Dialog ${index + 1}`;
}

export function buildPlaybackMarks(
  cues: VideoTimedCue[],
  skipSegments: VideoSkipSegment[] = [],
): PlaybackMark[] {
  const marks: PlaybackMark[] = [];

  cues.forEach((cue, index) => {
    const name = cueLabel(cue, index);
    marks.push({
      id: `${cue.id}-start`,
      time: cue.start,
      kind: 'dialog-start',
      label: `${name} starts`,
    });
    marks.push({
      id: `${cue.id}-end`,
      time: cue.end,
      kind: 'dialog-end',
      label: `${name} ends`,
    });
  });

  skipSegments.forEach((segment, index) => {
    const name = segment.label?.trim() || `Skip ${index + 1}`;
    marks.push({
      id: `${segment.id}-skip`,
      time: segment.start,
      kind: 'skip',
      label: `${name} (${formatCueTime(segment.start)}–${formatCueTime(segment.end)})`,
    });
  });

  return marks.sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}

export function getNextPlaybackMark(
  marks: PlaybackMark[],
  currentTime: number,
): PlaybackMark | null {
  const t = Math.max(0, currentTime);
  return marks.find(mark => mark.time > t + 0.05) ?? null;
}

export function describeActiveDialogs(cues: VideoTimedCue[], currentTime: number): string | null {
  const active = getActiveCues(cues, currentTime);
  if (active.length === 0) return null;
  return active
    .map((cue, index) => cueLabel(cue, index))
    .join(', ');
}

export function playbackMarkKindLabel(kind: PlaybackMarkKind): string {
  switch (kind) {
    case 'dialog-start':
      return 'Dialog';
    case 'dialog-end':
      return 'End';
    case 'skip':
      return 'Skip';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}
