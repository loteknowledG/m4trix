'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { VideoCueTextEffectView } from '@/components/text/video-cue-text-effect-view';
import {
  resolveMomentDialogLineStyle,
  resolveMomentLineLayout,
  isNarratorDialogLine,
  type MomentDialogLine,
} from '@/lib/moment-dialog';
import {
  buildCueTextShadow,
  resolveVideoCueFontFamily,
} from '@/lib/video-timed-cues';
import { cn } from '@/lib/utils';

export type MomentDialogLayoutPatch = Partial<{
  x: number;
  y: number;
  width: number;
  fontScale: number;
}>;

type MomentDialogOverlayLine = MomentDialogLine & {
  speakerName: string;
  isPlayerLine?: boolean;
};

type MomentDialogOverlayProps = {
  lines: MomentDialogOverlayLine[];
  currentTime?: number;
  momentId?: string | null;
  loopEpoch?: number;
  className?: string;
  editLineId?: string | null;
  stageRef?: RefObject<HTMLElement | null>;
  onLayoutChange?: (lineId: string, patch: MomentDialogLayoutPatch) => void;
  /** Game dialog bubbles: half the min height of a square at the same width; height grows with content. */
  gameDialog?: boolean;
};

type LineLayout = {
  x: number;
  y: number;
  width: number;
  fontScale: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lineFontSize(fontScale: number) {
  return `clamp(0.65rem, ${fontScale * 100}cqmin, 999px)`;
}

function gameDialogFontSize(fontScale: number) {
  return `${Math.max(0.65, fontScale * 18)}rem`;
}

function MomentDialogBubble({
  line,
  speakerName,
  momentId,
  editable = false,
  loopEpoch = 0,
  stageRef,
  onLayoutChange,
  gameDialog = false,
}: {
  line: MomentDialogOverlayLine;
  speakerName: string;
  momentId?: string | null;
  loopEpoch?: number;
  editable?: boolean;
  stageRef?: RefObject<HTMLElement | null>;
  onLayoutChange?: (patch: MomentDialogLayoutPatch) => void;
  gameDialog?: boolean;
}) {
  const style = resolveMomentDialogLineStyle(line);
  const layoutRef = useRef<LineLayout>(resolveMomentLineLayout(line));
  const interactingRef = useRef(false);
  const [layout, setLayout] = useState<LineLayout>(layoutRef.current);

  useEffect(() => {
    if (interactingRef.current) return;
    const next = resolveMomentLineLayout(line);
    layoutRef.current = next;
    setLayout(next);
  }, [line.fontScale, line.width, line.x, line.y, line.id]);

  const applyLayout = useCallback((next: LineLayout) => {
    layoutRef.current = next;
    setLayout(next);
  }, []);

  const onStartDrag = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!editable || !stageRef?.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      const stage = stageRef.current;

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        applyLayout({
          ...layoutRef.current,
          x: clamp((ev.clientX - rect.left) / rect.width, 0, 1),
          y: clamp((ev.clientY - rect.top) / rect.height, 0, 1),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        onLayoutChange?.({ x: layoutRef.current.x, y: layoutRef.current.y });
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, editable, onLayoutChange, stageRef],
  );

  const onStartResize = useCallback(
    (event: ReactPointerEvent<HTMLButtonElement>) => {
      if (!editable || !stageRef?.current || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      interactingRef.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      const stage = stageRef.current;
      const startX = event.clientX;
      const startY = event.clientY;
      const startLayout = { ...layoutRef.current };
      const handle = event.currentTarget;

      const onMove = (ev: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const dx = (ev.clientX - startX) / rect.width;
        const dy = (ev.clientY - startY) / rect.height;
        if (gameDialog) {
          applyLayout({
            ...layoutRef.current,
            width: clamp(startLayout.width + (dx + dy) * 0.7, 0.2, 1),
          });
          return;
        }
        applyLayout({
          ...layoutRef.current,
          width: clamp(startLayout.width + dx * 1.4, 0.2, 1),
          fontScale: clamp(startLayout.fontScale + dy * 0.25, 0.02, 0.12),
        });
      };

      const onEnd = (ev: PointerEvent) => {
        handle.releasePointerCapture(ev.pointerId);
        interactingRef.current = false;
        onLayoutChange?.(
          gameDialog
            ? { width: layoutRef.current.width }
            : {
                width: layoutRef.current.width,
                fontScale: layoutRef.current.fontScale,
              },
        );
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onEnd);
        handle.removeEventListener('pointercancel', onEnd);
      };

      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onEnd);
      handle.addEventListener('pointercancel', onEnd);
    },
    [applyLayout, editable, onLayoutChange, gameDialog, stageRef],
  );

  const speakerColor =
    style.speakerColor ??
    (isNarratorDialogLine(line, speakerName)
      ? '#fcd34d'
      : line.isPlayerLine
        ? '#7dd3fc'
        : '#a3e635');
  const showSpeakerLabel = !isNarratorDialogLine(line, speakerName);

  return (
    <div
      className={cn(
        'absolute min-w-0 max-w-none -translate-x-1/2 -translate-y-1/2 touch-none select-none',
        editable ? 'pointer-events-auto z-50' : 'pointer-events-none z-20',
      )}
      style={{
        left: `${layout.x * 100}%`,
        top: `${layout.y * 100}%`,
        width: `${layout.width * 100}%`,
        minHeight: gameDialog ? `${layout.width * 50}cqw` : undefined,
        fontSize: gameDialog ? gameDialogFontSize(style.fontScale) : lineFontSize(layout.fontScale),
        fontFamily: resolveVideoCueFontFamily(style.font),
      }}
    >
      <div
        className={cn(
          'relative touch-none',
          editable && 'cursor-grab ring-2 ring-primary/70 ring-offset-2 ring-offset-transparent active:cursor-grabbing',
        )}
        onPointerDown={editable ? onStartDrag : undefined}
      >
        {editable ? (
          <div className="mb-1 flex shrink-0 items-center justify-center rounded-t-md bg-primary/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary-foreground pointer-events-none">
            Drag
          </div>
        ) : null}
        <div className={cn(editable && 'px-0.5 pb-0.5')}>
          {showSpeakerLabel ? (
            <div
              className="mb-1 text-[0.85em] font-bold uppercase tracking-wide"
              style={{
                color: speakerColor,
                textShadow: buildCueTextShadow(style.shadowColor),
              }}
            >
              {speakerName}
            </div>
          ) : null}
          <div
            className="whitespace-pre-wrap"
            style={{
              color: style.color,
              textShadow: buildCueTextShadow(style.shadowColor),
            }}
          >
            <VideoCueTextEffectView
              text={line.text}
              effects={style.textEffects}
              color={style.color}
              shadowColor={style.shadowColor}
              lineKey={line.id}
              replayKey={
                momentId ? `${momentId}-${line.id}-${loopEpoch}` : `${line.id}-${loopEpoch}`
              }
              className="text-inherit"
            />
          </div>
        </div>
        {editable ? (
          <button
            type="button"
            aria-label="Resize dialog"
            onPointerDown={onStartResize}
            className="absolute -bottom-2.5 -right-2.5 z-40 h-5 w-5 cursor-se-resize rounded-sm border-2 border-white bg-primary shadow-md"
          />
        ) : null}
      </div>
    </div>
  );
}

export function MomentDialogOverlay({
  lines,
  currentTime,
  momentId,
  loopEpoch = 0,
  className,
  editLineId = null,
  stageRef: externalStageRef,
  onLayoutChange,
  gameDialog = false,
}: MomentDialogOverlayProps) {
  const internalStageRef = useRef<HTMLDivElement>(null);
  const layoutStageRef = externalStageRef ?? internalStageRef;
  const editMode = editLineId != null;
  const onLayoutChangeRef = useRef(onLayoutChange);
  onLayoutChangeRef.current = onLayoutChange;

  const handleLayoutChange = useCallback((lineId: string, patch: MomentDialogLayoutPatch) => {
    onLayoutChangeRef.current?.(lineId, patch);
  }, []);

  const activeLines = useMemo(() => {
    if (currentTime == null) return lines;
    const t = Math.max(0, currentTime);
    return lines.filter((line) => {
      const start = line.start ?? 0;
      const end = line.end ?? start + 5;
      return t >= start - 0.02 && t < end;
    });
  }, [currentTime, lines]);

  const editingLine = useMemo(
    () => (editLineId ? lines.find((line) => line.id === editLineId) ?? null : null),
    [editLineId, lines],
  );

  const playbackLines = useMemo(() => {
    if (!editMode) return activeLines;
    return activeLines.filter((line) => line.id !== editLineId);
  }, [activeLines, editLineId, editMode]);

  if (lines.length === 0 && !editMode) return null;

  return (
    <div
      ref={internalStageRef}
      className={cn('pointer-events-none absolute inset-0 z-20 [container-type:size]', className)}
    >
      {playbackLines.map((line) => (
        <MomentDialogBubble
          key={line.id}
          line={line}
          speakerName={line.speakerName}
          momentId={momentId}
          loopEpoch={loopEpoch}
          gameDialog={gameDialog}
        />
      ))}

      {editingLine ? (
        <MomentDialogBubble
          key={editingLine.id}
          line={editingLine}
          speakerName={editingLine.speakerName}
          momentId={momentId}
          loopEpoch={loopEpoch}
          editable
          stageRef={layoutStageRef}
          onLayoutChange={(patch) => handleLayoutChange(editingLine.id, patch)}
          gameDialog={gameDialog}
        />
      ) : null}

      {editMode ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 flex justify-center">
          <span className="rounded-full bg-black/70 px-3 py-1 text-xs text-white/90">
            Drag to move · corner handle to resize
          </span>
        </div>
      ) : null}
    </div>
  );
}
