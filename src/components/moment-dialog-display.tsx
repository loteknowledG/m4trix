"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import { VideoCueTextEffectView } from "@/components/text/video-cue-text-effect-view";
import type { VideoCueTextEffect } from "@/lib/video-cue-text-effects";
import {
  buildCueTextShadow,
  resolveVideoCueFontFamily,
} from "@/lib/video-timed-cues";
import { logger } from "@/lib/logger";
import {
  characterDialogSide,
  characterPlacementZone,
  computeObjectContainLayout,
  defaultDialogLinePosition,
  groupLinesByPlacementZone,
  scriptToChatMessages,
  shouldUseWideSideDialogLayout,
  type DialogPlacementZone,
  type DialogSide,
  type ObjectContainLayout,
} from "@/lib/moment-dialog-layout";
import {
  ensureCharacterPositions,
  ensureTimedDialogScript,
  loadMomentDialogScript,
  resolveMomentDialogLineStyle,
  saveMomentDialogScript,
  updateLineLayoutInScript,
  type DialogLinePosition,
  type MomentDialogLine,
  type MomentDialogScript,
} from "@/lib/moment-dialog";
import { loadStorySceneCharacters, type SceneCharacter } from "@/lib/scene-characters";
import { cn } from "@/lib/utils";
import { MomentDialogOverlay, type MomentDialogLayoutPatch } from "@/components/moment-dialog-overlay";

type MomentDialogDisplayProps = {
  momentId: string | null;
  storyId?: string | null;
  stageRef: React.RefObject<HTMLElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  placementMode?: boolean;
  currentTime?: number;
  editLineId?: string | null;
  onLayoutChange?: (lineId: string, patch: MomentDialogLayoutPatch) => void;
};

type PlacedDialogLine = {
  message: CustomChatMessage;
  line: MomentDialogLine;
  side: DialogSide;
  paletteIndex: number;
  position: DialogLinePosition;
};

function VnDialogMessage({
  message,
  line,
  paletteIndex: _paletteIndex,
  align = "start",
  textEffect,
  lineKey,
  momentId,
  compact = false,
}: {
  message: CustomChatMessage;
  line?: MomentDialogLine;
  paletteIndex: number;
  align?: "start" | "end";
  textEffect?: VideoCueTextEffect;
  lineKey: string;
  momentId?: string | null;
  compact?: boolean;
}) {
  const isNarrator = message.messageKind === "narrator" || message.name?.trim() === "Narrator";
  const style = resolveMomentDialogLineStyle(line ?? {});
  const dialogColor = style.color;
  const speakerColor =
    style.speakerColor ??
    (message.from === "user" ? "#7dd3fc" : isNarrator ? "#fcd34d" : "#a3e635");
  const fontSize = compact
    ? `${Math.max(0.65, style.fontScale * 14)}rem`
    : `${Math.max(0.75, style.fontScale * 18)}rem`;

  return (
    <div className={cn("w-full", align === "end" ? "text-right" : "text-left")}>
      <div
        className={cn(
          "mb-1 font-bold uppercase tracking-wide",
          compact ? "text-[10px]" : "text-xs",
        )}
        style={{
          color: speakerColor,
          textShadow: buildCueTextShadow(style.shadowColor),
        }}
      >
        {message.name}
      </div>
      <div
        className={cn("leading-relaxed", compact ? "px-0 py-0.5" : "px-0 py-1")}
        style={{
          color: dialogColor,
          textShadow: buildCueTextShadow(style.shadowColor),
          fontFamily: resolveVideoCueFontFamily(style.font),
          fontSize,
        }}
      >
        <VideoCueTextEffectView
          text={message.text}
          effect={textEffect ?? style.textEffect}
          color={dialogColor}
          shadowColor={style.shadowColor}
          lineKey={lineKey}
          replayKey={momentId ? `${momentId}-${lineKey}` : lineKey}
          className="text-inherit"
        />
      </div>
    </div>
  );
}

function DraggableDialogBubble({
  entry,
  draggable,
  stageRef,
  momentId,
  onPositionChange,
}: {
  entry: PlacedDialogLine;
  draggable: boolean;
  stageRef: React.RefObject<HTMLElement | null>;
  momentId?: string | null;
  onPositionChange: (lineId: string, pos: DialogLinePosition) => void;
}) {
  const posRef = useRef(entry.position);
  const [pos, setPos] = useState(entry.position);
  const draggingRef = useRef(false);

  useEffect(() => {
    setPos(entry.position);
    posRef.current = entry.position;
  }, [entry.line.id, entry.position.x, entry.position.y]);

  const onStartDrag = (event: React.MouseEvent | React.TouchEvent) => {
    if (!draggable) return;
    event.stopPropagation();
    event.preventDefault();
    draggingRef.current = true;

    const move = (ev: MouseEvent | TouchEvent) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      let clientX = 0;
      let clientY = 0;
      if (ev instanceof TouchEvent) {
        clientX = ev.touches[0]?.clientX ?? 0;
        clientY = ev.touches[0]?.clientY ?? 0;
      } else {
        clientX = ev.clientX;
        clientY = ev.clientY;
      }
      const next = {
        x: Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)),
        y: Math.min(1, Math.max(0, (clientY - rect.top) / rect.height)),
      };
      posRef.current = next;
      setPos(next);
    };

    const end = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      onPositionChange(entry.line.id, posRef.current);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("touchmove", move);
      window.removeEventListener("mouseup", end);
      window.removeEventListener("touchend", end);
    };

    window.addEventListener("mousemove", move);
    window.addEventListener("touchmove", move, { passive: false });
    window.addEventListener("mouseup", end);
    window.addEventListener("touchend", end);
  };

  return (
    <div
      className={cn(
        "absolute z-30 max-w-[min(18rem,42vw)] -translate-x-1/2 -translate-y-1/2 touch-none select-none",
        draggable ? "pointer-events-auto cursor-grab active:cursor-grabbing" : "pointer-events-none",
      )}
      style={{ left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }}
      onMouseDown={onStartDrag}
      onTouchStart={onStartDrag}
      role="presentation"
    >
      <VnDialogMessage
        message={entry.message}
        line={entry.line}
        paletteIndex={entry.paletteIndex}
        align={entry.side === "right" ? "end" : "start"}
        textEffect={entry.line.textEffect}
        lineKey={entry.line.id}
        momentId={momentId}
        compact
      />
    </div>
  );
}

function FreePlacementLayer({
  entries,
  placementMode,
  stageRef,
  momentId,
  onPositionChange,
}: {
  entries: PlacedDialogLine[];
  placementMode: boolean;
  stageRef: React.RefObject<HTMLElement | null>;
  momentId?: string | null;
  onPositionChange: (lineId: string, pos: DialogLinePosition) => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      {entries.map((entry) => (
        <DraggableDialogBubble
          key={entry.line.id}
          entry={entry}
          draggable={placementMode}
          stageRef={stageRef}
          momentId={momentId}
          onPositionChange={onPositionChange}
        />
      ))}
    </div>
  );
}

function SideOverlayColumn({
  side,
  width,
  messages,
  script,
  momentId,
}: {
  side: "left" | "right";
  width?: number;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
  momentId?: string | null;
}) {
  if (!messages.length) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-20 flex flex-col justify-end gap-3 overflow-y-auto px-2 py-20 sm:px-3",
        side === "left" ? "left-0" : "right-0",
      )}
      style={width ? { width } : { width: "min(42%, 14rem)" }}
      aria-label={side === "left" ? "Left dialog column" : "Right dialog column"}
    >
      {messages.map((message, index) => {
        const line = script.lines.find((entry) => entry.id === message.id);
        const characterIndex = line
          ? script.characterOrder.indexOf(line.characterId)
          : index;
        return (
          <VnDialogMessage
            key={message.id}
            message={message}
            line={line}
            paletteIndex={Math.max(0, characterIndex)}
            align={side === "right" ? "end" : "start"}
            textEffect={line?.textEffect}
            lineKey={message.id}
            momentId={momentId}
          />
        );
      })}
    </div>
  );
}

function SideLetterboxColumn({
  side,
  width,
  messages,
  script,
  momentId,
}: {
  side: "left" | "right";
  width: number;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
  momentId?: string | null;
}) {
  if (!messages.length || width <= 0) return null;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-y-0 z-20 flex flex-col justify-end gap-3 overflow-y-auto px-3 py-24",
        side === "left" ? "left-0" : "right-0",
      )}
      style={{ width }}
      aria-label={side === "left" ? "Left dialog column" : "Right dialog column"}
    >
      {messages.map((message, index) => {
        const line = script.lines.find((entry) => entry.id === message.id);
        const characterIndex = line
          ? script.characterOrder.indexOf(line.characterId)
          : index;
        return (
          <VnDialogMessage
            key={message.id}
            message={message}
            line={line}
            paletteIndex={Math.max(0, characterIndex)}
            align={side === "right" ? "end" : "start"}
            textEffect={line?.textEffect}
            lineKey={message.id}
            momentId={momentId}
          />
        );
      })}
    </div>
  );
}

function NarratorZonePanel({
  zone,
  messages,
  script,
  momentId,
  layout,
  useWideLayout,
}: {
  zone: Extract<DialogPlacementZone, "top" | "bottom">;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
  momentId?: string | null;
  layout?: ObjectContainLayout;
  useWideLayout?: boolean;
}) {
  if (!messages.length) return null;

  if (useWideLayout && layout) {
    return (
      <div
        className="pointer-events-none absolute z-20 px-3"
        style={
          zone === "top"
            ? {
                left: layout.offsetX,
                top: layout.offsetY,
                width: layout.renderedWidth,
              }
            : {
                left: layout.offsetX,
                top: layout.offsetY + layout.renderedHeight,
                width: layout.renderedWidth,
              }
        }
      >
        <div className={cn("mx-auto max-w-3xl space-y-3", zone === "top" ? "pt-2" : "pb-4")}>
          {messages.map((message, index) => {
            const line = script.lines.find((entry) => entry.id === message.id);
            return (
              <VnDialogMessage
                key={message.id}
                message={message}
                line={line}
                paletteIndex={Math.max(0, script.characterOrder.length + index)}
                textEffect={line?.textEffect}
                lineKey={message.id}
                momentId={momentId}
              />
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 z-20 px-3 sm:px-6",
        zone === "top"
          ? "top-0 bg-gradient-to-b from-black/90 via-black/55 to-transparent pb-8 pt-4"
          : "bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent pb-4 pt-16 sm:pb-6",
      )}
    >
      <div className="mx-auto max-w-3xl space-y-3">
        {messages.map((message, index) => {
          const line = script.lines.find((entry) => entry.id === message.id);
          const characterIndex = line
            ? script.characterOrder.indexOf(line.characterId)
            : index;
          return (
            <VnDialogMessage
              key={message.id}
              message={message}
              line={line}
              paletteIndex={Math.max(0, characterIndex)}
              textEffect={line?.textEffect}
              lineKey={message.id}
              momentId={momentId}
            />
          );
        })}
      </div>
    </div>
  );
}

function PositionedSceneDialogLayer({
  script,
  sceneCharacters,
  momentId,
  layout,
  useWideLayout,
}: {
  script: MomentDialogScript;
  sceneCharacters: SceneCharacter[];
  momentId?: string | null;
  layout: ObjectContainLayout;
  useWideLayout: boolean;
}) {
  const grouped = useMemo(
    () => groupLinesByPlacementZone(script, sceneCharacters),
    [sceneCharacters, script],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <NarratorZonePanel
        zone="top"
        messages={grouped.top}
        script={script}
        momentId={momentId}
        layout={layout}
        useWideLayout={useWideLayout}
      />
      {useWideLayout ? (
        <>
          <SideLetterboxColumn
            side="left"
            width={layout.sideBarWidth}
            messages={grouped.left}
            script={script}
            momentId={momentId}
          />
          <SideLetterboxColumn
            side="right"
            width={layout.sideBarWidth}
            messages={grouped.right}
            script={script}
            momentId={momentId}
          />
        </>
      ) : (
        <>
          <SideOverlayColumn
            side="left"
            messages={grouped.left}
            script={script}
            momentId={momentId}
          />
          <SideOverlayColumn
            side="right"
            messages={grouped.right}
            script={script}
            momentId={momentId}
          />
        </>
      )}
      <NarratorZonePanel
        zone="bottom"
        messages={grouped.bottom}
        script={script}
        momentId={momentId}
        layout={layout}
        useWideLayout={useWideLayout}
      />
    </div>
  );
}

export function MomentDialogDisplay({
  momentId,
  storyId,
  stageRef,
  imageRef,
  placementMode = false,
  currentTime,
  editLineId = null,
  onLayoutChange,
}: MomentDialogDisplayProps) {
  const [script, setScript] = useState<MomentDialogScript>({ characterOrder: [], lines: [] });
  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacter[]>([]);

  useEffect(() => {
    if (!momentId) {
      setScript({ characterOrder: [], lines: [] });
      return;
    }

    let cancelled = false;
    void loadStorySceneCharacters(storyId)
      .then((characters) => {
        if (cancelled) return;
        setSceneCharacters(characters);
        const fallbackOrder = characters.map((character) => character.id);
        return loadMomentDialogScript(momentId, storyId, fallbackOrder).then((loaded) => ({
          loaded,
          characters,
        }));
      })
      .then((result) => {
        if (cancelled || !result) return;
        const withPositions = ensureCharacterPositions(result.loaded, result.characters);
        setScript(ensureTimedDialogScript(withPositions, result.characters));
      })
      .catch((error) => {
        logger.error("Failed to load moment dialog display", error);
      });

    return () => {
      cancelled = true;
    };
  }, [momentId, storyId]);

  useEffect(() => {
    const reload = () => {
      if (!momentId) return;
      const fallbackOrder = sceneCharacters.map((character) => character.id);
      void loadMomentDialogScript(momentId, storyId, fallbackOrder)
        .then((loaded) => {
          const withPositions = ensureCharacterPositions(loaded, sceneCharacters);
          setScript(ensureTimedDialogScript(withPositions, sceneCharacters));
        })
        .catch((error) => logger.error("Failed to refresh moment dialog display", error));
    };

    window.addEventListener("moments-updated", reload);
    return () => window.removeEventListener("moments-updated", reload);
  }, [momentId, sceneCharacters, storyId]);

  const persistLayout = useCallback(
    (lineId: string, patch: MomentDialogLayoutPatch) => {
      if (!momentId) return;
      setScript((current) => {
        const next = updateLineLayoutInScript(current, lineId, patch);
        void saveMomentDialogScript(momentId, next, storyId).catch((error) => {
          logger.error("Failed to save dialog line layout", error);
        });
        return next;
      });
      onLayoutChange?.(lineId, patch);
    },
    [momentId, onLayoutChange, storyId],
  );

  const overlayLines = useMemo(() => {
    const names = new Map(sceneCharacters.map((character) => [character.id, character.name]));
    return script.lines.map((line) => ({
      ...line,
      speakerName: names.get(line.characterId) || line.speaker || "Unknown",
    }));
  }, [sceneCharacters, script.lines]);

  const activeEditLineId = editLineId ?? (placementMode ? overlayLines[0]?.id ?? null : null);

  if (!script.lines.length) return null;

  return (
    <MomentDialogOverlay
      lines={overlayLines}
      currentTime={currentTime}
      momentId={momentId}
      editLineId={activeEditLineId}
      onLayoutChange={persistLayout}
    />
  );
}

export async function seedDialogPlacementDefaults(
  momentId: string,
  storyId: string | null | undefined,
  sceneCharacters: SceneCharacter[],
): Promise<MomentDialogScript | null> {
  const fallbackOrder = sceneCharacters.map((character) => character.id);
  const loaded = await loadMomentDialogScript(momentId, storyId, fallbackOrder);
  const withPositions = ensureCharacterPositions(loaded, sceneCharacters);
  const next = ensureTimedDialogScript(withPositions, sceneCharacters);
  await saveMomentDialogScript(momentId, next, storyId);
  return next;
}
