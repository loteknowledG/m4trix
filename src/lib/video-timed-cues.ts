import {
  normalizeVideoCueTextEffect,
  type VideoCueTextEffect,
  type VideoCueTextAnimatePreset,
} from '@/lib/video-cue-text-effects';

export type VideoCueFontId = 'system' | 'serif' | 'mono' | 'cursive' | 'mrs' | 'satisfy';

export type { VideoCueTextEffect, VideoCueTextAnimatePreset };

export const VIDEO_CUE_FONT_OPTIONS: { id: VideoCueFontId; label: string }[] = [
  { id: 'system', label: 'System Sans' },
  { id: 'serif', label: 'Serif' },
  { id: 'mono', label: 'Monospace' },
  { id: 'cursive', label: 'Cursive' },
  { id: 'mrs', label: 'Mrs Saint Delafield' },
  { id: 'satisfy', label: 'Satisfy' },
];

export type VideoTimedCue = {
  id: string;
  start: number;
  end: number;
  text: string;
  speaker?: string;
  /** Horizontal center, 0–1 within the video frame */
  x: number;
  /** Vertical center, 0–1 within the video frame */
  y: number;
  /** Max width as a fraction of the video frame (default 0.72) */
  width?: number;
  /** Font size as a fraction of the smaller video dimension (default 0.04) */
  fontScale?: number;
  font?: VideoCueFontId;
  /** Dialog text color (hex) */
  color?: string;
  /** Speaker name color (hex); defaults to dialog color */
  speakerColor?: string;
  /** Text shadow color (hex) */
  shadowColor?: string;
  /** Entrance animation preset (Magic UI Text Animate) */
  textEffect?: VideoCueTextEffect;
};

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export function normalizeCueColor(value: unknown, fallback: string): string {
  if (typeof value === 'string' && HEX_COLOR.test(value.trim())) return value.trim().toLowerCase();
  return fallback;
}

export function normalizeCueFont(value: unknown): VideoCueFontId | undefined {
  if (typeof value !== 'string') return undefined;
  return VIDEO_CUE_FONT_OPTIONS.some(option => option.id === value)
    ? (value as VideoCueFontId)
    : undefined;
}

export function resolveVideoCueFontFamily(font?: VideoCueFontId): string {
  switch (font) {
    case 'serif':
      return 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
    case 'mono':
      return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
    case 'cursive':
      return 'cursive';
    case 'mrs':
      return '"Mrs Saint Delafield", cursive';
    case 'satisfy':
      return 'Satisfy, cursive';
    default:
      return 'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
}

export function buildCueTextShadow(shadowColor: string): string {
  return `0 1px 2px ${shadowColor}, 0 2px 10px ${shadowColor}, 0 0 24px ${shadowColor}`;
}

export function defaultVideoCueColors() {
  return {
    color: '#ffffff',
    shadowColor: '#000000',
  };
}

export function newVideoTimedCueId() {
  return `cue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function defaultVideoTimedCue(start = 0, end = 5): VideoTimedCue {
  return {
    id: newVideoTimedCueId(),
    start,
    end,
    text: '',
    speaker: '',
    x: 0.5,
    y: 0.82,
    width: 0.72,
    fontScale: 0.04,
    font: 'system',
    ...defaultVideoCueColors(),
  };
}

export function normalizeVideoTimedCue(value: unknown): VideoTimedCue | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text : '';
  const start = typeof record.start === 'number' ? record.start : Number.NaN;
  const end = typeof record.end === 'number' ? record.end : Number.NaN;
  const x = typeof record.x === 'number' ? record.x : Number.NaN;
  const y = typeof record.y === 'number' ? record.y : Number.NaN;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return {
    id: typeof record.id === 'string' ? record.id : newVideoTimedCueId(),
    start: Math.max(0, start),
    end: Math.max(start, end),
    text,
    speaker: typeof record.speaker === 'string' ? record.speaker : undefined,
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width:
      typeof record.width === 'number'
        ? Math.min(1, Math.max(0.2, record.width))
        : undefined,
    fontScale:
      typeof record.fontScale === 'number'
        ? Math.min(0.12, Math.max(0.02, record.fontScale))
        : undefined,
    font: normalizeCueFont(record.font),
    color: normalizeCueColor(record.color, defaultVideoCueColors().color),
    speakerColor:
      typeof record.speakerColor === 'string' && HEX_COLOR.test(record.speakerColor.trim())
        ? record.speakerColor.trim().toLowerCase()
        : undefined,
    shadowColor: normalizeCueColor(record.shadowColor, defaultVideoCueColors().shadowColor),
    textEffect: normalizeVideoCueTextEffect(record.textEffect),
  };
}

export function normalizeVideoTimedCues(value: unknown): VideoTimedCue[] {
  if (!Array.isArray(value)) return [];
  const cues: VideoTimedCue[] = [];
  for (const entry of value) {
    const cue = normalizeVideoTimedCue(entry);
    if (cue) cues.push(cue);
  }
  return cues.sort((a, b) => a.start - b.start);
}

export function formatCueTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function parseCueTime(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+(\.\d+)?$/.test(trimmed)) return parseFloat(trimmed);

  const parts = trimmed.split(':').map(part => part.trim());
  if (parts.length === 2) {
    const minutes = parseInt(parts[0] ?? '', 10);
    const seconds = parseFloat(parts[1] ?? '');
    if (Number.isFinite(minutes) && Number.isFinite(seconds) && minutes >= 0 && seconds >= 0) {
      return minutes * 60 + seconds;
    }
  }
  if (parts.length === 3) {
    const hours = parseInt(parts[0] ?? '', 10);
    const minutes = parseInt(parts[1] ?? '', 10);
    const seconds = parseFloat(parts[2] ?? '');
    if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  return null;
}

export function getActiveCues(cues: VideoTimedCue[], currentTime: number): VideoTimedCue[] {
  const t = Math.max(0, currentTime);
  return cues.filter(cue => t >= cue.start - 0.02 && t < cue.end);
}

export function commitCueStartTime(start: number, end: number, minDuration = 5) {
  const nextStart = Math.max(0, start);
  if (end <= nextStart) {
    return { start: nextStart, end: nextStart + minDuration };
  }
  return { start: nextStart, end };
}

export function commitCueEndTime(start: number, end: number) {
  return { start, end: Math.max(start + 0.5, end) };
}
