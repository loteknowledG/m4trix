'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from '@/components/icons';
import { MomentDialogDisplay } from '@/components/moment-dialog-display';
import { useMomentDialogPlayback } from '@/hooks/use-moment-dialog-playback';
import { normalizeMomentSrc } from '@/lib/moments';
import { safeGet } from '@/lib/storage-compat';
import { cn } from '@/lib/utils';

type StoryMoment = {
  id: string;
  src: string;
  name?: string;
};

type OverlayTextState = {
  text: string;
  font: string;
  fontSize: number;
  textWidth: number;
  strokeWidth: number;
  strokeColor: string;
  fontColor: string;
};

const DEFAULT_OVERLAY: OverlayTextState = {
  text: '',
  font: 'system',
  fontSize: 40,
  textWidth: 60,
  strokeWidth: 0,
  strokeColor: '#000000',
  fontColor: '#ffffff',
};

function resolveOverlayFontFamily(font: string) {
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

function parseOverlayValue(value: unknown): OverlayTextState {
  if (!value) return DEFAULT_OVERLAY;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && 'text' in parsed) {
        return parseOverlayValue(parsed);
      }
    } catch {
      return { ...DEFAULT_OVERLAY, text: value };
    }
    return { ...DEFAULT_OVERLAY, text: value };
  }
  if (typeof value !== 'object') return DEFAULT_OVERLAY;
  const record = value as Record<string, unknown>;
  return {
    text: typeof record.text === 'string' ? record.text : '',
    font: typeof record.font === 'string' ? record.font : DEFAULT_OVERLAY.font,
    fontSize: typeof record.fontSize === 'number' ? record.fontSize : DEFAULT_OVERLAY.fontSize,
    textWidth: typeof record.textWidth === 'number' ? record.textWidth : DEFAULT_OVERLAY.textWidth,
    strokeWidth:
      typeof record.strokeWidth === 'number' ? record.strokeWidth : DEFAULT_OVERLAY.strokeWidth,
    strokeColor:
      typeof record.strokeColor === 'string' ? record.strokeColor : DEFAULT_OVERLAY.strokeColor,
    fontColor: typeof record.fontColor === 'string' ? record.fontColor : DEFAULT_OVERLAY.fontColor,
  };
}

type StoryMomentsViewerProps = {
  moments: StoryMoment[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  storyId?: string | null;
  className?: string;
};

export function StoryMomentsViewer({
  moments,
  currentIndex,
  onIndexChange,
  storyId,
  className,
}: StoryMomentsViewerProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [overlay, setOverlay] = useState<OverlayTextState>(DEFAULT_OVERLAY);
  const [pixelWidth, setPixelWidth] = useState<number | null>(null);

  const moment = moments[currentIndex] ?? null;
  const hasMultiple = moments.length > 1;
  const dialogPlayback = useMomentDialogPlayback(moment?.id ?? null, storyId);

  const goPrevious = useCallback(() => {
    if (moments.length === 0) return;
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : moments.length - 1;
    onIndexChange(nextIndex);
  }, [currentIndex, moments.length, onIndexChange]);

  const goNext = useCallback(() => {
    if (moments.length === 0) return;
    const nextIndex = currentIndex < moments.length - 1 ? currentIndex + 1 : 0;
    onIndexChange(nextIndex);
  }, [currentIndex, moments.length, onIndexChange]);

  useEffect(() => {
    if (!moment?.id) {
      setOverlay(DEFAULT_OVERLAY);
      return;
    }
    let cancelled = false;
    void safeGet(`overlay:text:${moment.id}`)
      .then(value => {
        if (!cancelled) setOverlay(parseOverlayValue(value));
      })
      .catch(() => {
        if (!cancelled) setOverlay(DEFAULT_OVERLAY);
      });
    return () => {
      cancelled = true;
    };
  }, [moment?.id]);

  useEffect(() => {
    const updateWidth = () => {
      if (!containerRef.current) {
        setPixelWidth(null);
        return;
      }
      const rect = containerRef.current.getBoundingClientRect();
      setPixelWidth(Math.max(50, Math.round((overlay.textWidth / 100) * rect.width)));
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [overlay.textWidth, moment?.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goPrevious();
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        goNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrevious]);

  if (!moment) return null;

  return (
    <div className={cn('relative mx-auto w-full max-w-5xl', className)}>
      <div className="overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
        <div
          ref={stageRef}
          className="relative flex min-h-[min(72vh,820px)] items-center justify-center bg-black"
        >
          {hasMultiple ? (
            <>
              <button
                type="button"
                onClick={goPrevious}
                aria-label="Previous moment"
                className="absolute left-3 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:left-4"
              >
                <ArrowLeft size={20} />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Next moment"
                className="absolute right-3 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:right-4"
              >
                <ArrowRight size={20} />
              </button>
            </>
          ) : null}

          <div
            ref={containerRef}
            className="relative flex h-full w-full max-h-[min(72vh,820px)] items-center justify-center"
          >
            <img
              ref={imageRef}
              src={normalizeMomentSrc(moment.src)}
              alt={moment.name || 'Story moment'}
              className="h-full max-h-[min(72vh,820px)] w-full object-contain"
            />

            <MomentDialogDisplay
              momentId={moment.id}
              storyId={storyId}
              stageRef={stageRef}
              imageRef={imageRef}
              currentTime={dialogPlayback.hasLines ? dialogPlayback.currentTime : undefined}
              loopEpoch={dialogPlayback.loopEpoch}
            />

            {overlay.text ? (
              <div className="pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2 px-4 text-center">
                <span
                  className="block whitespace-pre-wrap break-words leading-tight"
                  style={{
                    fontFamily: resolveOverlayFontFamily(overlay.font),
                    fontSize: `${overlay.fontSize}px`,
                    color: overlay.fontColor,
                    width: pixelWidth ? `${pixelWidth}px` : `${overlay.textWidth}%`,
                    maxWidth: `${overlay.textWidth}%`,
                    WebkitTextStroke:
                      overlay.strokeWidth > 0
                        ? `${overlay.strokeWidth}px ${overlay.strokeColor}`
                        : undefined,
                    textShadow:
                      overlay.strokeWidth > 0
                        ? `0 0 1px ${overlay.strokeColor}, 0 0 2px ${overlay.strokeColor}`
                        : '0 2px 8px rgba(0,0,0,0.85)',
                  }}
                >
                  {overlay.text}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {hasMultiple ? (
        <p className="mt-3 text-center text-xs tabular-nums text-muted-foreground">
          {currentIndex + 1} / {moments.length}
          {moment.name?.trim() ? ` · ${moment.name.trim()}` : ''}
        </p>
      ) : moment.name?.trim() ? (
        <p className="mt-3 text-center text-xs text-muted-foreground">{moment.name.trim()}</p>
      ) : null}
    </div>
  );
}
