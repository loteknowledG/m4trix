'use client';

import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  commitCueEndTime,
  commitCueStartTime,
  formatCueTime,
  type VideoTimedCue,
} from '@/lib/video-timed-cues';
import {
  clampTimelineTime,
  computeTimelineDuration,
  timelineTickStep,
} from '@/lib/video-timeline-bounds';
import type { VideoSkipSegment } from '@/lib/video-skip-segments';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

function cuePreviewLabel(cue: VideoTimedCue, index: number) {
  if (cue.speaker?.trim()) return cue.speaker.trim();
  const text = cue.text.trim();
  if (text) return text.length > 24 ? `${text.slice(0, 24)}…` : text;
  return `Dialog ${index + 1}`;
}

function percentOf(time: number, duration: number) {
  if (duration <= 0) return 0;
  return (time / duration) * 100;
}

type VideoCueTimelineProps = {
  cues: VideoTimedCue[];
  skipSegments?: VideoSkipSegment[];
  selectedCueId?: string | null;
  currentTime?: number;
  videoDuration?: number;
  onSelectCue?: (cueId: string | null) => void;
  onCueTimingChange?: (cueId: string, patch: { start?: number; end?: number }) => void;
  onSeek?: (time: number) => void;
  onScrubStart?: () => void;
  manualFollow?: boolean;
  followRunning?: boolean;
  onFollowToggle?: () => void;
  groupBySpeaker?: boolean;
  className?: string;
};

type SpeakerRow = {
  speaker: string;
  cues: VideoTimedCue[];
};

export default function VideoCueTimeline({
  cues,
  skipSegments = [],
  selectedCueId = null,
  currentTime = 0,
  videoDuration,
  onSelectCue,
  onCueTimingChange,
  onSeek,
  onScrubStart,
  manualFollow = false,
  followRunning = false,
  onFollowToggle,
  groupBySpeaker = false,
  className,
}: VideoCueTimelineProps) {
  const trackRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [scrubTime, setScrubTime] = useState<number | null>(null);
  const sortedCues = useMemo(
    () => [...cues].sort((a, b) => a.start - b.start),
    [cues],
  );

  const speakerRows = useMemo((): SpeakerRow[] => {
    if (!groupBySpeaker) return [];
    const map = new Map<string, VideoTimedCue[]>();
    for (const cue of sortedCues) {
      const key = cue.speaker || 'Unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(cue);
    }
    return Array.from(map.entries()).map(([speaker, cues]) => ({ speaker, cues }));
  }, [sortedCues, groupBySpeaker]);

  const duration = useMemo(
    () => computeTimelineDuration(cues, skipSegments, currentTime, videoDuration),
    [cues, skipSegments, currentTime, videoDuration],
  );
  const displayTime = scrubTime ?? currentTime;
  const tickStep = timelineTickStep(duration);
  const ticks = useMemo(() => {
    const output: number[] = [0];
    for (let t = tickStep; t < duration; t += tickStep) {
      output.push(t);
    }
    if (output.at(-1) !== duration) {
      output.push(duration);
    }
    return output;
  }, [duration, tickStep]);

  const getTimeFromX = useCallback(
    (clientX: number, speakerKey?: string) => {
      let rect: DOMRect | undefined;
      if (speakerKey) {
        rect = trackRefs.current.get(speakerKey)?.getBoundingClientRect();
      }
      if (!rect) {
        for (const ref of trackRefs.current.values()) {
          rect = ref.getBoundingClientRect();
          if (rect?.width) break;
        }
      }
      if (!rect?.width) return 0;
      return clampTimelineTime(((clientX - rect.left) / rect.width) * duration, duration);
    },
    [duration],
  );

  const beginCueDrag = useCallback(
    (
      event: ReactPointerEvent,
      cue: VideoTimedCue,
      mode: 'move' | 'start' | 'end',
    ) => {
      if (!onCueTimingChange) return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget as HTMLElement;
      handle.setPointerCapture(event.pointerId);
      onSelectCue?.(cue.id);

      const originX = event.clientX;
      const originStart = cue.start;
      const originEnd = cue.end;
      const cueDuration = Math.max(0.5, originEnd - originStart);

      const onMove = (ev: PointerEvent) => {
        const delta = getTimeFromX(ev.clientX) - getTimeFromX(originX);
        if (mode === 'move') {
          let nextStart = clampTimelineTime(originStart + delta, duration - cueDuration);
          nextStart = Math.min(nextStart, duration - cueDuration);
          onCueTimingChange(cue.id, {
            start: nextStart,
            end: nextStart + cueDuration,
          });
          return;
        }

        if (mode === 'start') {
          const nextTime = clampTimelineTime(originStart + delta, duration);
          const next = commitCueStartTime(nextTime, originEnd);
          onCueTimingChange(cue.id, next);
          return;
        }

        const nextTime = clampTimelineTime(originEnd + delta, duration);
        const next = commitCueEndTime(originStart, nextTime);
        onCueTimingChange(cue.id, next);
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [duration, onCueTimingChange, onSelectCue, getTimeFromX],
  );

  const beginScrub = useCallback(
    (event: ReactPointerEvent<HTMLElement>, speakerKey?: string) => {
      if (!onSeek) return;
      event.preventDefault();
      event.stopPropagation();

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      onScrubStart?.();
      onSelectCue?.(null);

      const applyScrub = (clientX: number) => {
        const time = getTimeFromX(clientX, speakerKey);
        setScrubTime(time);
        onSeek(time);
      };

      applyScrub(event.clientX);

      const onMove = (ev: PointerEvent) => {
        applyScrub(ev.clientX);
      };

      const onEnd = (ev: PointerEvent) => {
        applyScrub(ev.clientX);
        setScrubTime(null);
        handle.releasePointerCapture(ev.pointerId);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [onScrubStart, onSeek, onSelectCue, getTimeFromX],
  );

  if (sortedCues.length === 0 && skipSegments.length === 0) {
    return (
      <div
        className={cn(
          'rounded-lg border border-dashed border-border/70 bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground',
          className,
        )}
      >
        Add a timed dialog to see it on the timeline below the video.
      </div>
    );
  }

  const playheadLeft = `${percentOf(clampTimelineTime(displayTime, duration), duration)}%`;

  return (
    <div className={cn('space-y-2 rounded-lg border border-border/60 bg-card/40 p-3', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">Timeline</span>
          {manualFollow ? (
            <Button
              type="button"
              size="sm"
              variant={followRunning ? 'default' : 'secondary'}
              className="h-7 px-2 text-[11px]"
              onClick={onFollowToggle}
            >
              {followRunning ? 'Pause follow' : 'Follow video'}
            </Button>
          ) : null}
        </div>
        <span className="font-mono tabular-nums">
          {formatCueTime(displayTime)} / {formatCueTime(duration)}
        </span>
      </div>

      <div className="relative pt-5">
        <div className="relative mb-1 h-4">
          {ticks.map(tick => (
            <span
              key={tick}
              className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground"
              style={{ left: `${percentOf(tick, duration)}%` }}
            >
              {formatCueTime(tick)}
            </span>
          ))}
        </div>

        <div className="space-y-1">
          {groupBySpeaker ? (
            speakerRows.map(({ speaker, cues: speakerCues }) => (
              <div key={speaker} className="flex items-center gap-2">
                <div className="w-20 shrink-0 truncate text-right text-[10px] font-medium text-muted-foreground">
                  {speaker}
                </div>
                <TrackRow
                  ref={el => {
                    if (el) trackRefs.current.set(speaker, el);
                    else trackRefs.current.delete(speaker);
                  }}
                  cues={speakerCues}
                  skipSegments={skipSegments}
                  selectedCueId={selectedCueId}
                  duration={duration}
                  playheadLeft={playheadLeft}
                  onCueDrag={beginCueDrag}
                  onScrub={beginScrub}
                  speakerKey={speaker}
                />
              </div>
            ))
          ) : (
            <div
              ref={el => {
                if (el) trackRefs.current.set('default', el);
                else trackRefs.current.delete('default');
              }}
            >
              <TrackRow
                cues={sortedCues}
                skipSegments={skipSegments}
                selectedCueId={selectedCueId}
                duration={duration}
                playheadLeft={playheadLeft}
                onCueDrag={beginCueDrag}
                onScrub={beginScrub}
              />
            </div>
          )}
        </div>
      </div>

      <p className="text-[11px] leading-snug text-muted-foreground">
        {manualFollow
          ? 'Play/pause in the embed syncs the timeline automatically. Pause follow stops auto-sync; scrubbing pauses the clock until you play again.'
          : 'Drag the red playhead or track to scrub (pauses video) · drag dialog blocks to move · drag edges to trim · amber dashes are skip segments'}
      </p>
    </div>
  );
}

type TrackRowProps = {
  cues: VideoTimedCue[];
  skipSegments: VideoSkipSegment[];
  selectedCueId: string | null;
  duration: number;
  playheadLeft: string;
  onCueDrag: (
    event: ReactPointerEvent,
    cue: VideoTimedCue,
    mode: 'move' | 'start' | 'end',
  ) => void;
  onScrub: (event: ReactPointerEvent<HTMLElement>, speakerKey?: string) => void;
  speakerKey?: string;
};

const TrackRow = React.forwardRef<HTMLDivElement, TrackRowProps>(
  (
    {
      cues,
      skipSegments,
      selectedCueId,
      duration,
      playheadLeft,
      onCueDrag,
      onScrub,
      speakerKey,
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className="relative h-8 rounded-md border border-border/60 bg-muted/30"
      >
        <button
          type="button"
          aria-label="Scrub playback"
          className="absolute inset-0 z-0 cursor-ew-resize rounded-md"
          onPointerDown={event => onScrub(event, speakerKey)}
        />
        {skipSegments.map((segment, index) => (
          <div
            key={segment.id}
            className="pointer-events-none absolute top-1 z-[1] h-3 rounded-sm border border-dashed border-amber-500/50 bg-amber-500/15"
            style={{
              left: `${percentOf(segment.start, duration)}%`,
              width: `${percentOf(segment.end - segment.start, duration)}%`,
            }}
            title={
              segment.label?.trim() ||
              `Skip ${index + 1} (${formatCueTime(segment.start)}–${formatCueTime(segment.end)})`
            }
          />
        ))}

        {cues.map((cue, index) => {
          const selected = selectedCueId === cue.id;
          const width = Math.max(percentOf(cue.end - cue.start, duration), 1.5);
          return (
            <div
              key={cue.id}
              className={cn(
                'absolute bottom-1 top-3 z-[2] flex min-w-[1.25rem] items-center overflow-hidden rounded border text-[10px] font-medium shadow-sm',
                selected
                  ? 'border-primary bg-primary/85 text-primary-foreground ring-2 ring-primary/40'
                  : 'border-primary/40 bg-primary/55 text-primary-foreground hover:bg-primary/70',
              )}
              style={{
                left: `${percentOf(cue.start, duration)}%`,
                width: `${width}%`,
              }}
              onPointerDown={event => onCueDrag(event, cue, 'move')}
              onClick={event => {
                event.stopPropagation();
              }}
              title={`${cuePreviewLabel(cue, index)} (${formatCueTime(cue.start)}–${formatCueTime(cue.end)})`}
            >
              <button
                type="button"
                aria-label="Adjust dialog start"
                className="h-full w-1.5 shrink-0 cursor-ew-resize bg-black/20 hover:bg-black/35"
                onPointerDown={event => {
                  event.stopPropagation();
                  onCueDrag(event, cue, 'start');
                }}
              />
              <span className="min-w-0 flex-1 truncate px-1">{cuePreviewLabel(cue, index)}</span>
              <button
                type="button"
                aria-label="Adjust dialog end"
                className="h-full w-1.5 shrink-0 cursor-ew-resize bg-black/20 hover:bg-black/35"
                onPointerDown={event => {
                  event.stopPropagation();
                  onCueDrag(event, cue, 'end');
                }}
              />
            </div>
          );
        })}

        <button
          type="button"
          aria-label="Drag playhead to scrub"
          className="absolute inset-y-0 z-[4] w-4 -translate-x-1/2 cursor-ew-resize touch-none"
          style={{ left: playheadLeft }}
          onPointerDown={event => onScrub(event, speakerKey)}
        >
          <span className="pointer-events-none absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-red-500 shadow-[0_0_0_1px_rgba(0,0,0,0.35)]" />
          <span className="pointer-events-none absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-red-500 ring-2 ring-background" />
        </button>
      </div>
    );
  },
);
TrackRow.displayName = 'TrackRow';
