import type { VideoTimedCue } from '@/lib/video-timed-cues';
import type { VideoSkipSegment } from '@/lib/video-skip-segments';

const MIN_TIMELINE_DURATION = 30;
const TIMELINE_PADDING_SECONDS = 8;

export function computeTimelineDuration(
  cues: VideoTimedCue[],
  skipSegments: VideoSkipSegment[] = [],
  currentTime = 0,
  videoDuration?: number,
): number {
  const contentEnd = Math.max(
    0,
    ...cues.map(cue => cue.end),
    ...skipSegments.map(segment => segment.end),
    currentTime,
    videoDuration ?? 0,
  );
  return Math.max(MIN_TIMELINE_DURATION, Math.ceil(contentEnd + TIMELINE_PADDING_SECONDS));
}

export function timelineTickStep(duration: number): number {
  if (duration <= 60) return 10;
  if (duration <= 180) return 15;
  if (duration <= 600) return 30;
  return 60;
}

export function clampTimelineTime(time: number, duration: number) {
  return Math.min(duration, Math.max(0, time));
}
