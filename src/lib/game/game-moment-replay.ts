import type { CharacterDialogStyle } from "@/lib/character-dialog-style";
import type { GameCharacterSlot, GameDialogLayouts } from "@/lib/game-dialog-layout";
import { resolveCharacterDialogStyle } from "@/lib/character-dialog-style";
import type { GameCharacterContext } from "@/lib/game/game-context";
import type { PlayerMode } from "@/lib/player-mode";
import {
  DEFAULT_MOMENT_LINE_DURATION,
  normalizeMomentDialogScript,
  type MomentDialogScript,
} from "@/lib/moment-dialog";
import { isLikelyMomentSrc, normalizeStoryMomentEntry, storyMomentId } from "@/lib/story-moments";
import { safeGet, safeSet } from "@/lib/storage-compat";

export type GameMomentReplayMessage = {
  id: string;
  from: "user" | "agent";
  text: string;
  playerMode?: PlayerMode;
};

export type GameMomentReplaySnapshot = {
  storyId: string;
  momentId: string;
  momentIndex: number;
  stageNumber: number;
  savedAt: number;
  script: MomentDialogScript;
  conversations: Record<GameCharacterSlot, GameMomentReplayMessage[]>;
  labels: Record<GameCharacterSlot, string>;
  layouts: GameDialogLayouts;
};

export type GameReplayTimelineEntry = {
  momentId: string;
  momentIndex: number;
  stageNumber: number;
  savedAt: number;
  replayKey: string;
};

export const getGameMomentReplayKey = (
  storyId: string,
  momentId: string,
  stageNumber: number,
) => `game-moment-replay:${storyId}:${momentId}:${stageNumber}`;

export const getGameReplayTimelineKey = (storyId: string) =>
  `game-replay-timeline:${storyId}`;

function parseGameMessageTimestamp(messageId: string): number {
  const match = messageId.match(/(\d{10,})/);
  return match ? Number(match[1]) : 0;
}

function isBlockedReplayMessage(message: GameMomentReplayMessage): boolean {
  const text = message.text.trim();
  if (!text || text === "…") return true;
  if (message.id === "story-opening") return true;
  if (message.id.startsWith("pending-")) return true;
  if (/^Working on that request\b/i.test(text)) return true;
  if (/^Waiting for LM Studio\b/i.test(text)) return true;
  return false;
}

function dialogStyleForReplaySlot(
  slot: GameCharacterSlot,
  assignedPlayer: GameCharacterContext,
  assignedNpc: GameCharacterContext,
  narratorDialogStyle: CharacterDialogStyle,
): CharacterDialogStyle {
  if (slot === "protagonist") {
    return resolveCharacterDialogStyle(assignedPlayer?.dialogStyle);
  }
  if (slot === "antagonist") {
    return resolveCharacterDialogStyle(assignedNpc?.dialogStyle);
  }
  return resolveCharacterDialogStyle(narratorDialogStyle);
}

export function buildGameMomentReplayScript(args: {
  conversations: Record<GameCharacterSlot, GameMomentReplayMessage[]>;
  layouts: GameDialogLayouts;
  labels: Record<GameCharacterSlot, string>;
  assignedPlayer: GameCharacterContext;
  assignedNpc: GameCharacterContext;
  narratorDialogStyle: CharacterDialogStyle;
  defaultPlayerMode?: PlayerMode;
}): MomentDialogScript {
  const slots: GameCharacterSlot[] = ["protagonist", "antagonist", "narrator"];
  const ordered = slots
    .flatMap((slot) =>
      (args.conversations[slot] || [])
        .filter((message) => !isBlockedReplayMessage(message))
        .map((message) => ({ slot, message })),
    )
    .sort(
      (a, b) =>
        parseGameMessageTimestamp(a.message.id) - parseGameMessageTimestamp(b.message.id),
    );

  let timeCursor = 0;
  const lines = ordered.map(({ slot, message }, index) => {
    const layout = args.layouts[slot];
    const style = dialogStyleForReplaySlot(
      slot,
      args.assignedPlayer,
      args.assignedNpc,
      args.narratorDialogStyle,
    );
    const start = timeCursor;
    const end = start + DEFAULT_MOMENT_LINE_DURATION;
    timeCursor = end;

    return {
      id: message.id || `${slot}-${index}`,
      characterId: slot,
      speaker: args.labels[slot],
      text: message.text.trim(),
      playerMode:
        slot === "protagonist" && message.from === "user"
          ? message.playerMode ?? args.defaultPlayerMode
          : message.playerMode,
      start,
      end,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      fontScale: style.fontScale,
      font: style.font,
      color: style.color,
      shadowColor: style.shadowColor,
      speakerColor: style.speakerColor,
      textEffects: style.textEffects,
    };
  });

  return normalizeMomentDialogScript({
    characterOrder: [...slots],
    lines,
    duration: Math.max(timeCursor + 0.35, DEFAULT_MOMENT_LINE_DURATION),
  });
}

function momentEntryMatchesId(entry: unknown, momentId: string): boolean {
  const target = momentId.trim();
  if (!target) return false;
  if (storyMomentId(entry) === target) return true;
  if (typeof entry === "string" && entry.trim() === target) return true;
  if (entry && typeof entry === "object") {
    const record = entry as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const src = typeof record.src === "string" ? record.src.trim() : "";
    if (id === target || src === target) return true;
  }
  return false;
}

function readStoryItems(stored: unknown): { items: unknown[]; useItemsWrapper: boolean } {
  const useItemsWrapper = Boolean(
    stored &&
      typeof stored === "object" &&
      !Array.isArray(stored) &&
      Array.isArray((stored as { items?: unknown[] }).items),
  );
  const items: unknown[] = Array.isArray(stored)
    ? stored
    : useItemsWrapper
      ? ((stored as { items: unknown[] }).items ?? [])
      : [];
  return { items, useItemsWrapper };
}

function attachGameReplayToMomentEntry(
  entry: unknown,
  momentId: string,
  script: MomentDialogScript,
): Record<string, unknown> {
  if (typeof entry === "string") {
    const src = entry.trim();
    return {
      id: momentId,
      src: isLikelyMomentSrc(src) ? src : momentId,
      gameReplayScript: script,
      gameReplayLines: script.lines,
    };
  }

  const normalized = normalizeStoryMomentEntry(entry);
  const base = entry && typeof entry === "object" ? (entry as Record<string, unknown>) : {};
  return {
    ...base,
    id: normalized?.id ?? base.id ?? momentId,
    src: normalized?.src ?? base.src ?? momentId,
    gameReplayScript: script,
    gameReplayLines: script.lines,
  };
}

async function persistGameReplayOnStoryMoment(
  storyId: string,
  momentId: string,
  script: MomentDialogScript,
): Promise<void> {
  const storyKey = `story:${storyId}`;
  const stored = await safeGet<unknown>(storyKey);
  const { items, useItemsWrapper } = readStoryItems(stored);

  let updated = false;
  const nextItems = items.map((entry) => {
    if (!momentEntryMatchesId(entry, momentId)) return entry;
    updated = true;
    return attachGameReplayToMomentEntry(entry, momentId, script);
  });

  if (!updated) {
    nextItems.push(attachGameReplayToMomentEntry(null, momentId, script));
  }

  if (Array.isArray(stored)) {
    await safeSet(storyKey, nextItems);
  } else {
    await safeSet(storyKey, { ...(stored as object), items: nextItems });
  }

  window.dispatchEvent(new CustomEvent("moments-updated"));
  window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id: storyId } }));
}

async function appendGameReplayTimelineEntry(
  storyId: string,
  entry: GameReplayTimelineEntry,
): Promise<void> {
  const key = getGameReplayTimelineKey(storyId);
  const stored = (await safeGet<GameReplayTimelineEntry[]>(key)) || [];
  const timeline = Array.isArray(stored) ? stored : [];
  const withoutDuplicate = timeline.filter((item) => item.replayKey !== entry.replayKey);
  await safeSet(key, [...withoutDuplicate, entry]);
}

export async function saveGameMomentReplay(args: {
  storyId: string;
  momentId: string;
  momentIndex: number;
  stageNumber: number;
  conversations: Record<GameCharacterSlot, GameMomentReplayMessage[]>;
  layouts: GameDialogLayouts;
  labels: Record<GameCharacterSlot, string>;
  assignedPlayer: GameCharacterContext;
  assignedNpc: GameCharacterContext;
  narratorDialogStyle: CharacterDialogStyle;
  defaultPlayerMode?: PlayerMode;
}): Promise<GameMomentReplaySnapshot | null> {
  const script = buildGameMomentReplayScript(args);
  if (!script.lines.length) return null;

  const snapshot: GameMomentReplaySnapshot = {
    storyId: args.storyId,
    momentId: args.momentId,
    momentIndex: args.momentIndex,
    stageNumber: args.stageNumber,
    savedAt: Date.now(),
    script,
    conversations: {
      protagonist: [...(args.conversations.protagonist || [])],
      antagonist: [...(args.conversations.antagonist || [])],
      narrator: [...(args.conversations.narrator || [])],
    },
    labels: { ...args.labels },
    layouts: { ...args.layouts },
  };

  const replayKey = getGameMomentReplayKey(
    args.storyId,
    args.momentId,
    args.stageNumber,
  );

  await Promise.all([
    safeSet(replayKey, snapshot),
    persistGameReplayOnStoryMoment(args.storyId, args.momentId, script),
    appendGameReplayTimelineEntry(args.storyId, {
      momentId: args.momentId,
      momentIndex: args.momentIndex,
      stageNumber: args.stageNumber,
      savedAt: snapshot.savedAt,
      replayKey,
    }),
  ]);

  return snapshot;
}

export async function loadGameMomentReplay(
  storyId: string,
  momentId: string,
  stageNumber: number,
): Promise<GameMomentReplaySnapshot | null> {
  const stored = await safeGet<GameMomentReplaySnapshot>(
    getGameMomentReplayKey(storyId, momentId, stageNumber),
  );
  if (!stored || typeof stored !== "object") return null;
  return stored;
}

export async function loadGameReplayTimeline(
  storyId: string,
): Promise<GameReplayTimelineEntry[]> {
  const stored = await safeGet<GameReplayTimelineEntry[]>(getGameReplayTimelineKey(storyId));
  return Array.isArray(stored) ? stored : [];
}
