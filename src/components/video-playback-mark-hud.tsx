'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  buildPlaybackMarks,
  describeActiveDialogs,
  formatPlaybackTime,
  getNextPlaybackMark,
  playbackMarkKindLabel,
} from '@/lib/video-playback-timeline';
import type { VideoTimedCue } from '@/lib/video-timed-cues';
import type { VideoSkipSegment } from '@/lib/video-skip-segments';
import { cn } from '@/lib/utils';

type VideoPlaybackMarkHudProps = {
  currentTime: number;
  cues?: VideoTimedCue[];
  skipSegments?: VideoSkipSegment[];
  embedKind?: 'youtube' | 'vimeo' | 'direct' | 'native';
  isPlaying?: boolean;
  manualClockRunning?: boolean;
  onManualClockStart?: () => void;
  onManualClockPause?: () => void;
  onManualClockReset?: () => void;
  onManualClockNudge?: (delta: number) => void;
  className?: string;
};

export default function VideoPlaybackMarkHud({
  currentTime,
  cues = [],
  skipSegments = [],
  embedKind = 'native',
  isPlaying = false,
  manualClockRunning = false,
  onManualClockStart,
  onManualClockPause,
  onManualClockReset,
  onManualClockNudge,
  className,
}: VideoPlaybackMarkHudProps) {
  const marks = useMemo(
    () => buildPlaybackMarks(cues, skipSegments),
    [cues, skipSegments],
  );
  const nextMark = useMemo(
    () => getNextPlaybackMark(marks, currentTime),
    [marks, currentTime],
  );
  const activeLabel = useMemo(
    () => describeActiveDialogs(cues, currentTime),
    [cues, currentTime],
  );

  const lastTimeRef = useRef(currentTime);
  const lastChangeRef = useRef(Date.now());
  const [timeStale, setTimeStale] = useState(false);
  const manualMode = embedKind === 'direct';

  useEffect(() => {
    if (manualMode) {
      setTimeStale(false);
      return;
    }

    if (Math.abs(currentTime - lastTimeRef.current) > 0.02) {
      lastTimeRef.current = currentTime;
      lastChangeRef.current = Date.now();
      setTimeStale(false);
      return;
    }

    const timer = window.setInterval(() => {
      const staleMs = Date.now() - lastChangeRef.current;
      setTimeStale(isPlaying && staleMs > 2500 && marks.length > 0);
    }, 500);

    return () => window.clearInterval(timer);
  }, [currentTime, isPlaying, manualMode, marks.length]);

  if (marks.length === 0) return null;

  const syncHint = manualMode
    ? manualClockRunning
      ? 'Manual clock running — pause if the video stops'
      : 'Clock starts when you play the embed'
    : timeStale
      ? 'Time not updating — try clicking play on the video'
      : null;

  return (
    <div
      className={cn(
        'absolute left-3 top-3 z-40 max-w-[min(100%-1.5rem,28rem)]',
        className,
      )}
      aria-live="polite"
    >
      <div className="rounded-md bg-black/75 px-3 py-2 font-mono text-xs text-white shadow-md backdrop-blur-sm">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="text-sm font-semibold tabular-nums">
            {formatPlaybackTime(currentTime)}
          </span>
          {nextMark ? (
            <span className="min-w-0 break-normal text-white/85 [overflow-wrap:break-word] [word-break:normal]">
              Next {playbackMarkKindLabel(nextMark.kind)} @ {formatPlaybackTime(nextMark.time)}
              <span className="hidden sm:inline"> — {nextMark.label}</span>
            </span>
          ) : (
            <span className="text-white/60">No more marks</span>
          )}
        </div>
        {activeLabel ? (
          <div className="mt-1 min-w-0 break-normal text-[11px] text-primary-foreground/90 [overflow-wrap:break-word] [word-break:normal]">
            Active: {activeLabel}
          </div>
        ) : null}
        {syncHint ? (
          <div className="mt-1 text-[11px] text-amber-200/90">{syncHint}</div>
        ) : null}
        {manualMode ? (
          <div className="pointer-events-auto mt-2 flex flex-wrap gap-1">
            {manualClockRunning ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-[11px]"
                onClick={onManualClockPause}
              >
                Pause clock
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-7 px-2 text-[11px]"
                onClick={onManualClockStart}
              >
                Resume clock
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={onManualClockReset}
            >
              Reset
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => onManualClockNudge?.(-1)}
            >
              -1s
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-[11px]"
              onClick={() => onManualClockNudge?.(1)}
            >
              +1s
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
