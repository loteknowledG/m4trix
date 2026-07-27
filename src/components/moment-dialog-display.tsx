"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import { DialogTextEffectView } from "@/components/text/dialog-text-effect-view";
import { getStagePalette } from "@/lib/game/story-arc-palettes";
import type { DialogTextEffect } from "@/lib/dialog-text-effects";
import { logger } from "@/lib/logger";
import {
  characterDialogSide,
  computeObjectContainLayout,
  defaultDialogLinePosition,
  groupLinesBySide,
  scriptToChatMessages,
  shouldUseWideSideDialogLayout,
  type DialogSide,
  type ObjectContainLayout,
} from "@/lib/moment-dialog-layout";
import {
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
  paletteIndex,
  align = "start",
  textEffect,
  lineKey,
  momentId,
  compact = false,
}: {
  message: CustomChatMessage;
  paletteIndex: number;
  align?: "start" | "end";
  textEffect?: DialogTextEffect;
  lineKey: string;
  momentId?: string | null;
  compact?: boolean;
}) {
  const palette = getStagePalette(paletteIndex);
  const isNarrator = message.messageKind === "narrator" || message.name?.trim() === "Narrator";

  return (
    <div className={cn("w-full", align === "end" ? "text-right" : "text-left")}>
      <div
        className={cn(
          "mb-1 font-bold uppercase tracking-wide",
          compact ? "text-[10px]" : "text-xs",
          message.from === "user" ? "text-sky-300" : isNarrator ? "text-amber-300" : "text-lime-400",
        )}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
      >
        {message.name}
      </div>
      <div
        className={cn(
          "rounded-lg border leading-relaxed",
          compact ? "px-2 py-1.5 text-xs" : "px-3 py-2 text-sm",
        )}
        style={{
          backgroundColor: `${palette.bg}dd`,
          color: palette.fg,
          borderColor: `${palette.fg}55`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        <DialogTextEffectView
          text={message.text}
          effect={textEffect}
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

function CenterVnPanel({
  messages,
  script,
  momentId,
}: {
  messages: CustomChatMessage[];
  script: MomentDialogScript;
  momentId?: string | null;
}) {
  if (!messages.length) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pb-4 pt-16 sm:px-6 sm:pb-6">
      <div className="mx-auto flex max-h-[42vh] w-full max-w-4xl flex-col overflow-hidden rounded-sm border border-white/70 bg-black/55 px-4 py-3 shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur-[2px] sm:px-5 sm:py-4">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
          {messages.map((message, index) => {
            const line = script.lines.find((entry) => entry.id === message.id);
            const characterIndex = line
              ? script.characterOrder.indexOf(line.characterId)
              : index;
            return (
              <VnDialogMessage
                key={message.id}
                message={message}
                paletteIndex={Math.max(0, characterIndex)}
                textEffect={line?.textEffect}
                lineKey={message.id}
                momentId={momentId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function WideCenterNarratorStrip({
  layout,
  messages,
  script,
  momentId,
}: {
  layout: ObjectContainLayout;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
  momentId?: string | null;
}) {
  if (!messages.length) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 px-3 pb-4"
      style={{
        left: layout.offsetX,
        top: layout.offsetY + layout.renderedHeight,
        width: layout.renderedWidth,
      }}
    >
      <div className="mx-auto max-w-3xl space-y-3">
        {messages.map((message, index) => {
          const line = script.lines.find((entry) => entry.id === message.id);
          return (
            <VnDialogMessage
              key={message.id}
              message={message}
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
        return loadMomentDialogScript(momentId, storyId, fallbackOrder);
      })
      .then((loaded) => {
        if (!cancelled && loaded) setScript(loaded);
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
        .then(setScript)
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

  const grouped = useMemo(
    () => groupLinesBySide(script, sceneCharacters),
    [sceneCharacters, script],
  );

  const speakOrderMessages = useMemo(
    () => scriptToChatMessages(script, sceneCharacters),
    [sceneCharacters, script],
  );

  const placedEntries = useMemo((): PlacedDialogLine[] => {
    const total = speakOrderMessages.length;
    return speakOrderMessages.flatMap((message, index) => {
      const line = script.lines.find((entry) => entry.id === message.id);
      if (!line) return [];
      const side = characterDialogSide(line.characterId, script.characterOrder, sceneCharacters);
      const paletteIndex = Math.max(0, script.characterOrder.indexOf(line.characterId));
      const position =
        line.pos ?? defaultDialogLinePosition(index, total, side);
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

  if (useWideLayout) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20">
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
        <WideCenterNarratorStrip
          layout={layout}
          messages={grouped.center}
          script={script}
          momentId={momentId}
        />
      </div>
    );
  }

  return (
    <CenterVnPanel messages={speakOrderMessages} script={script} momentId={momentId} />
  );
}

export async function seedDialogPlacementDefaults(
  momentId: string,
  storyId: string | null | undefined,
  sceneCharacters: SceneCharacter[],
): Promise<MomentDialogScript | null> {
  const fallbackOrder = sceneCharacters.map((character) => character.id);
  const script = await loadMomentDialogScript(momentId, storyId, fallbackOrder);
  const messages = scriptToChatMessages(script, sceneCharacters);
  const total = messages.length;
  let next = script;
  let changed = false;

  messages.forEach((message, index) => {
    const line = next.lines.find((entry) => entry.id === message.id);
    if (!line || line.pos) return;
    const side = characterDialogSide(line.characterId, next.characterOrder, sceneCharacters);
    const pos = defaultDialogLinePosition(index, total, side);
    next = updateLinePositionInScript(next, line.id, pos);
    changed = true;
  });

  if (!changed) return script;
  await saveMomentDialogScript(momentId, next, storyId);
  return next;
}
