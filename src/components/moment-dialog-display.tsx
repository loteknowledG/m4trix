"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import { DialogTextEffectView } from "@/components/text/dialog-text-effect-view";
import { getStagePalette } from "@/lib/game/story-arc-palettes";
import type { DialogTextEffect } from "@/lib/dialog-text-effects";
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
  loadMomentDialogScript,
  saveMomentDialogScript,
  scriptUsesFreePlacement,
  updateLinePositionInScript,
  type DialogLinePosition,
  type MomentDialogLine,
  type MomentDialogScript,
} from "@/lib/moment-dialog";
import { loadStorySceneCharacters, type SceneCharacter } from "@/lib/scene-characters";
import { cn } from "@/lib/utils";

type MomentDialogDisplayProps = {
  momentId: string | null;
  storyId?: string | null;
  stageRef: React.RefObject<HTMLElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
  placementMode?: boolean;
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
  paletteIndex,
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
  textEffect?: DialogTextEffect;
  lineKey: string;
  momentId?: string | null;
  compact?: boolean;
}) {
  const palette = getStagePalette(paletteIndex);
  const isNarrator = message.messageKind === "narrator" || message.name?.trim() === "Narrator";
  const dialogColor = line?.color ?? palette.fg;
  const speakerColor =
    line?.speakerColor ??
    (message.from === "user" ? "#7dd3fc" : isNarrator ? "#fcd34d" : "#a3e635");
  const fontScale = line?.fontScale ?? 0.04;
  const fontSize = compact
    ? `${Math.max(0.65, fontScale * 14)}rem`
    : `${Math.max(0.75, fontScale * 18)}rem`;

  return (
    <div className={cn("w-full", align === "end" ? "text-right" : "text-left")}>
      <div
        className={cn(
          "mb-1 font-bold uppercase tracking-wide",
          compact ? "text-[10px]" : "text-xs",
        )}
        style={{
          color: speakerColor,
          textShadow: line?.shadowColor
            ? buildCueTextShadow(line.shadowColor)
            : "0 1px 2px rgba(0,0,0,0.85)",
        }}
      >
        {message.name}
      </div>
      <div
        className={cn("rounded-lg border leading-relaxed", compact ? "px-2 py-1.5" : "px-3 py-2")}
        style={{
          backgroundColor: `${palette.bg}dd`,
          color: dialogColor,
          borderColor: `${palette.fg}55`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          fontFamily: resolveVideoCueFontFamily(line?.font),
          fontSize,
        }}
      >
        <DialogTextEffectView
          text={message.text}
          effect={textEffect ?? line?.textEffect}
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
}: MomentDialogDisplayProps) {
  const [script, setScript] = useState<MomentDialogScript>({ characterOrder: [], lines: [] });
  const [sceneCharacters, setSceneCharacters] = useState<SceneCharacter[]>([]);
  const [layout, setLayout] = useState<ObjectContainLayout>({
    renderedWidth: 0,
    renderedHeight: 0,
    offsetX: 0,
    offsetY: 0,
    sideBarWidth: 0,
  });
  const [useWideLayout, setUseWideLayout] = useState(false);

  const recomputeLayout = useCallback(() => {
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage || !image) return;

    const rect = stage.getBoundingClientRect();
    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    const nextLayout = computeObjectContainLayout(
      rect.width,
      rect.height,
      naturalWidth,
      naturalHeight,
    );
    setLayout(nextLayout);
    setUseWideLayout(
      shouldUseWideSideDialogLayout(rect.width, rect.height, naturalWidth, naturalHeight),
    );
  }, [imageRef, stageRef]);

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
        setScript(ensureCharacterPositions(result.loaded, result.characters));
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
        .then((loaded) => setScript(ensureCharacterPositions(loaded, sceneCharacters)))
        .catch((error) => logger.error("Failed to refresh moment dialog display", error));
    };

    window.addEventListener("moments-updated", reload);
    return () => window.removeEventListener("moments-updated", reload);
  }, [momentId, sceneCharacters, storyId]);

  useEffect(() => {
    recomputeLayout();
    const stage = stageRef.current;
    const image = imageRef.current;
    if (!stage) return;

    const observer = new ResizeObserver(() => recomputeLayout());
    observer.observe(stage);
    image?.addEventListener("load", recomputeLayout);

    return () => {
      observer.disconnect();
      image?.removeEventListener("load", recomputeLayout);
    };
  }, [imageRef, momentId, recomputeLayout, stageRef]);

  const persistPosition = useCallback(
    (lineId: string, pos: DialogLinePosition) => {
      if (!momentId) return;
      setScript((current) => {
        const next = updateLinePositionInScript(current, lineId, pos);
        void saveMomentDialogScript(momentId, next, storyId).catch((error) => {
          logger.error("Failed to save dialog line position", error);
        });
        return next;
      });
    },
    [momentId, storyId],
  );

  const speakOrderMessages = useMemo(
    () => scriptToChatMessages(script, sceneCharacters),
    [sceneCharacters, script],
  );

  const placedEntries = useMemo((): PlacedDialogLine[] => {
    const grouped = groupLinesByPlacementZone(script, sceneCharacters);
    return speakOrderMessages.flatMap((message) => {
      const line = script.lines.find((entry) => entry.id === message.id);
      if (!line) return [];
      const zone = characterPlacementZone(
        line.characterId,
        sceneCharacters,
        script.characterPositions,
      );
      const side = characterDialogSide(
        line.characterId,
        script.characterOrder,
        sceneCharacters,
        script.characterPositions,
      );
      const paletteIndex = Math.max(0, script.characterOrder.indexOf(line.characterId));
      const zoneMessages = grouped[zone];
      const indexInZone = zoneMessages.findIndex((entry) => entry.id === message.id);
      const position =
        line.pos ??
        defaultDialogLinePosition(
          Math.max(0, indexInZone),
          zoneMessages.length,
          side,
          zone,
        );
      return [{ message, line, side, paletteIndex, position }];
    });
  }, [sceneCharacters, script, speakOrderMessages]);

  const useFreePlacement = placementMode || scriptUsesFreePlacement(script);

  if (!script.lines.length) return null;

  if (useFreePlacement) {
    return (
      <FreePlacementLayer
        entries={placedEntries}
        placementMode={placementMode}
        stageRef={stageRef}
        momentId={momentId}
        onPositionChange={persistPosition}
      />
    );
  }

  return (
    <PositionedSceneDialogLayer
      script={script}
      sceneCharacters={sceneCharacters}
      momentId={momentId}
      layout={layout}
      useWideLayout={useWideLayout}
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
  const script = ensureCharacterPositions(loaded, sceneCharacters);
  const messages = scriptToChatMessages(script, sceneCharacters);
  const grouped = groupLinesByPlacementZone(script, sceneCharacters);
  let next = script;
  let changed = false;

  messages.forEach((message) => {
    const line = next.lines.find((entry) => entry.id === message.id);
    if (!line || line.pos) return;
    const zone = characterPlacementZone(
      line.characterId,
      sceneCharacters,
      next.characterPositions,
    );
    const side = characterDialogSide(
      line.characterId,
      next.characterOrder,
      sceneCharacters,
      next.characterPositions,
    );
    const zoneMessages = grouped[zone];
    const indexInZone = zoneMessages.findIndex((entry) => entry.id === message.id);
    const pos = defaultDialogLinePosition(
      Math.max(0, indexInZone),
      zoneMessages.length,
      side,
      zone,
    );
    next = updateLinePositionInScript(next, line.id, pos);
    changed = true;
  });

  if (!changed) return script;
  await saveMomentDialogScript(momentId, next, storyId);
  return next;
}
