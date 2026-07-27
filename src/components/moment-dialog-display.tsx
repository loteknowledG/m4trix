"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import { getStagePalette } from "@/lib/game/story-arc-palettes";
import { logger } from "@/lib/logger";
import {
  groupLinesBySide,
  scriptToChatMessages,
  shouldUseWideSideDialogLayout,
  type ObjectContainLayout,
  computeObjectContainLayout,
} from "@/lib/moment-dialog-layout";
import { loadMomentDialogScript, type MomentDialogScript } from "@/lib/moment-dialog";
import { loadStorySceneCharacters, type SceneCharacter } from "@/lib/scene-characters";
import { cn } from "@/lib/utils";

type MomentDialogDisplayProps = {
  momentId: string | null;
  storyId?: string | null;
  stageRef: React.RefObject<HTMLElement | null>;
  imageRef: React.RefObject<HTMLImageElement | null>;
};

function VnDialogMessage({
  message,
  paletteIndex,
  align = "start",
}: {
  message: CustomChatMessage;
  paletteIndex: number;
  align?: "start" | "end";
}) {
  const palette = getStagePalette(paletteIndex);
  const isNarrator = message.messageKind === "narrator" || message.name?.trim() === "Narrator";

  return (
    <div className={cn("w-full", align === "end" ? "text-right" : "text-left")}>
      <div
        className={cn(
          "mb-1 text-xs font-bold uppercase tracking-wide",
          message.from === "user" ? "text-sky-300" : isNarrator ? "text-amber-300" : "text-lime-400",
        )}
        style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
      >
        {message.name}
      </div>
      <div
        className="rounded-lg border px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap"
        style={{
          backgroundColor: `${palette.bg}dd`,
          color: palette.fg,
          borderColor: `${palette.fg}55`,
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
        }}
      >
        {message.text}
      </div>
    </div>
  );
}

function SideLetterboxColumn({
  side,
  width,
  messages,
  script,
}: {
  side: "left" | "right";
  width: number;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
}) {
  if (!messages.length || width <= 0) return null;

  return (
    <div
      className={cn(
        "absolute inset-y-0 z-20 flex flex-col justify-end gap-3 overflow-y-auto px-3 py-24",
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
          />
        );
      })}
    </div>
  );
}

function CenterVnPanel({
  messages,
  script,
}: {
  messages: CustomChatMessage[];
  script: MomentDialogScript;
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
}: {
  layout: ObjectContainLayout;
  messages: CustomChatMessage[];
  script: MomentDialogScript;
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
        {messages.map((message, index) => (
          <VnDialogMessage
            key={message.id}
            message={message}
            paletteIndex={Math.max(0, script.characterOrder.length + index)}
          />
        ))}
      </div>
    </div>
  );
}

export function MomentDialogDisplay({
  momentId,
  storyId,
  stageRef,
  imageRef,
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

  const grouped = useMemo(
    () => groupLinesBySide(script, sceneCharacters),
    [sceneCharacters, script],
  );

  const speakOrderMessages = useMemo(
    () => scriptToChatMessages(script, sceneCharacters),
    [sceneCharacters, script],
  );

  if (!script.lines.length) return null;

  if (useWideLayout) {
    return (
      <div className="pointer-events-none absolute inset-0 z-20">
        <SideLetterboxColumn
          side="left"
          width={layout.sideBarWidth}
          messages={grouped.left}
          script={script}
        />
        <SideLetterboxColumn
          side="right"
          width={layout.sideBarWidth}
          messages={grouped.right}
          script={script}
        />
        <WideCenterNarratorStrip layout={layout} messages={grouped.center} script={script} />
      </div>
    );
  }

  return <CenterVnPanel messages={speakOrderMessages} script={script} />;
}
