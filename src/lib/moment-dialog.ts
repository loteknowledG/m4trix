import { get, set } from "idb-keyval";
import { normalizeDialogTextEffect, type DialogTextEffect } from "@/lib/dialog-text-effects";
import { isLikelyMomentSrc } from "@/lib/story-moments";
import {
  normalizeCueColor,
  normalizeCueFont,
  type VideoCueFontId,
} from "@/lib/video-timed-cues";

export type DialogLinePosition = {
  x: number;
  y: number;
};

export type NarratorDialogPosition = "top" | "bottom";
export type CharacterSidePosition = "left" | "right";
export type DialogSpeakerPosition = NarratorDialogPosition | CharacterSidePosition;

export type MomentDialogLine = {
  id: string;
  characterId: string;
  speaker: string;
  text: string;
  textEffect?: DialogTextEffect;
  pos?: DialogLinePosition;
  font?: VideoCueFontId;
  fontScale?: number;
  color?: string;
  speakerColor?: string;
  shadowColor?: string;
};

export type MomentDialogScript = {
  characterOrder: string[];
  lines: MomentDialogLine[];
  characterPositions?: Record<string, DialogSpeakerPosition>;
};

type MomentRecord = {
  id: string;
  src: string;
  name?: string;
  dialogLines?: unknown;
  dialogScript?: unknown;
};

type MomentLocation =
  | { kind: "heap" }
  | { kind: "story"; storyId: string; useItemsWrapper: boolean };

export function newMomentDialogLineId() {
  return `dialog-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeDialogLinePosition(value: unknown): DialogLinePosition | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const x = typeof record.x === "number" ? record.x : Number.NaN;
  const y = typeof record.y === "number" ? record.y : Number.NaN;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
  };
}

function normalizeDialogSpeakerPosition(value: unknown): DialogSpeakerPosition | undefined {
  if (value === "top" || value === "bottom" || value === "left" || value === "right") {
    return value;
  }
  return undefined;
}

function normalizeCharacterPositions(value: unknown): Record<string, DialogSpeakerPosition> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const next: Record<string, DialogSpeakerPosition> = {};
  for (const [characterId, position] of Object.entries(value)) {
    if (!characterId) continue;
    const normalized = normalizeDialogSpeakerPosition(position);
    if (normalized) next[characterId] = normalized;
  }
  return next;
}

export function defaultPositionForRole(
  role: "player" | "npc" | "narrator",
): DialogSpeakerPosition {
  if (role === "narrator") return "bottom";
  if (role === "player") return "left";
  return "right";
}

export function resolveCharacterPosition(
  script: MomentDialogScript,
  characterId: string,
  role: "player" | "npc" | "narrator",
): DialogSpeakerPosition {
  return script.characterPositions?.[characterId] ?? defaultPositionForRole(role);
}

export function ensureCharacterPositions(
  script: MomentDialogScript,
  characters: Array<{ id: string; role: "player" | "npc" | "narrator" }>,
): MomentDialogScript {
  const nextPositions = { ...(script.characterPositions ?? {}) };
  let changed = false;

  for (const character of characters) {
    if (nextPositions[character.id]) continue;
    nextPositions[character.id] = defaultPositionForRole(character.role);
    changed = true;
  }

  if (!changed && script.characterPositions) return script;
  return { ...script, characterPositions: nextPositions };
}

export function updateCharacterPositionInScript(
  script: MomentDialogScript,
  characterId: string,
  position: DialogSpeakerPosition,
): MomentDialogScript {
  return {
    ...script,
    characterPositions: {
      ...(script.characterPositions ?? {}),
      [characterId]: position,
    },
  };
}

export function scriptUsesFreePlacement(script: MomentDialogScript): boolean {
  return script.lines.some((line) => line.pos != null);
}

function normalizeLegacyDialogLines(value: unknown): MomentDialogLine[] {
  if (!Array.isArray(value)) return [];
  const normalized: MomentDialogLine[] = [];
  for (const line of value) {
    if (!line || typeof line !== "object") continue;
    const record = line as Record<string, unknown>;
    const text = typeof record.text === "string" ? record.text.trim() : "";
    if (!text) continue;
    const characterId =
      typeof record.characterId === "string" ? record.characterId.trim() : "";
    const speaker = typeof record.speaker === "string" ? record.speaker.trim() : "";
    const entry: MomentDialogLine = {
      id: typeof record.id === "string" ? record.id : newMomentDialogLineId(),
      characterId,
      speaker,
      text,
      textEffect: normalizeDialogTextEffect(record.textEffect),
    };
    const font = normalizeCueFont(record.font);
    if (font) entry.font = font;
    if (typeof record.fontScale === "number" && Number.isFinite(record.fontScale)) {
      entry.fontScale = Math.min(0.12, Math.max(0.02, record.fontScale));
    }
    const color = typeof record.color === "string" ? normalizeCueColor(record.color, "") : "";
    if (color) entry.color = color;
    const speakerColor =
      typeof record.speakerColor === "string" ? normalizeCueColor(record.speakerColor, "") : "";
    if (speakerColor) entry.speakerColor = speakerColor;
    const shadowColor =
      typeof record.shadowColor === "string" ? normalizeCueColor(record.shadowColor, "") : "";
    if (shadowColor) entry.shadowColor = shadowColor;
    const pos = normalizeDialogLinePosition(record.pos);
    if (pos) entry.pos = pos;
    normalized.push(entry);
  }
  return normalized;
}

export function normalizeMomentDialogScript(
  value: unknown,
  fallbackCharacterOrder: string[] = [],
): MomentDialogScript {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    const lines = normalizeLegacyDialogLines(record.lines);
    const rawOrder = Array.isArray(record.characterOrder)
      ? record.characterOrder.filter((id): id is string => typeof id === "string")
      : [];
    const characterOrder = mergeCharacterOrder(rawOrder, lines, fallbackCharacterOrder);
    const characterPositions = normalizeCharacterPositions(record.characterPositions);
    return { characterOrder, lines, characterPositions };
  }

  const legacyLines = normalizeLegacyDialogLines(value);
  const characterOrder = mergeCharacterOrder([], legacyLines, fallbackCharacterOrder);
  return { characterOrder, lines: legacyLines, characterPositions: {} };
}

function mergeCharacterOrder(
  savedOrder: string[],
  lines: MomentDialogLine[],
  fallbackCharacterOrder: string[],
): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const id of savedOrder) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }

  for (const id of fallbackCharacterOrder) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }

  for (const line of lines) {
    const id = line.characterId.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(id);
  }

  return merged;
}

export function linesForCharacter(script: MomentDialogScript, characterId: string): MomentDialogLine[] {
  return script.lines.filter((line) => line.characterId === characterId);
}

export function orderedCharactersFromScript(
  script: MomentDialogScript,
  characters: Array<{ id: string; name: string; roleLabel: string }>,
): Array<{ id: string; name: string; roleLabel: string }> {
  const byId = new Map(characters.map((character) => [character.id, character]));
  const ordered = script.characterOrder
    .map((id) => byId.get(id))
    .filter((character): character is { id: string; name: string; roleLabel: string } => !!character);

  for (const character of characters) {
    if (!script.characterOrder.includes(character.id)) {
      ordered.push(character);
    }
  }

  return ordered;
}

export function scriptPreviewLines(
  script: MomentDialogScript,
  characters: Array<{ id: string; name: string }>,
): MomentDialogLine[] {
  const nameById = new Map(characters.map((character) => [character.id, character.name]));
  const preview: MomentDialogLine[] = [];

  for (const characterId of script.characterOrder) {
    for (const line of linesForCharacter(script, characterId)) {
      preview.push({
        ...line,
        speaker: nameById.get(characterId) || line.speaker || "Unknown",
      });
    }
  }

  const known = new Set(script.characterOrder);
  for (const line of script.lines) {
    if (!line.characterId || known.has(line.characterId)) continue;
    preview.push(line);
  }

  return preview;
}

async function findMomentLocation(
  momentId: string,
  preferredStoryId?: string | null,
): Promise<{ script: MomentDialogScript | null; location: MomentLocation | null }> {
  const readScript = (entry: unknown): MomentDialogScript | null => {
    if (!entry || typeof entry !== "object") return null;
    const record = entry as MomentRecord;
    if (record.dialogScript) {
      return normalizeMomentDialogScript(record.dialogScript);
    }
    if (record.dialogLines) {
      return normalizeMomentDialogScript(record.dialogLines);
    }
    return null;
  };

  if (preferredStoryId) {
    const storyKey = `story:${preferredStoryId}`;
    const stored = await get<unknown>(storyKey);
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

    for (const entry of items) {
      const entryId =
        typeof entry === "string" ? entry : (entry as { id?: string })?.id;
      if (entryId !== momentId) continue;
      return {
        script: readScript(entry) ?? { characterOrder: [], lines: [] },
        location: { kind: "story", storyId: preferredStoryId, useItemsWrapper },
      };
    }
  }

  const heap =
    (await get<MomentRecord[]>("heap-moments")) ||
    (await get<MomentRecord[]>("heap-gifs")) ||
    [];
  const heapItem = heap.find((entry) => entry.id === momentId);
  if (heapItem) {
    return {
      script: readScript(heapItem) ?? { characterOrder: [], lines: [] },
      location: { kind: "heap" },
    };
  }

  const storiesMeta = (await get<Array<{ id: string }>>("stories")) || [];
  for (const meta of storiesMeta) {
    const storyKey = `story:${meta.id}`;
    const stored = await get<unknown>(storyKey);
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

    for (const entry of items) {
      const entryId =
        typeof entry === "string" ? entry : (entry as { id?: string })?.id;
      if (entryId !== momentId) continue;
      return {
        script: readScript(entry) ?? { characterOrder: [], lines: [] },
        location: { kind: "story", storyId: meta.id, useItemsWrapper },
      };
    }
  }

  return { script: null, location: null };
}

export async function loadMomentDialogScript(
  momentId: string,
  preferredStoryId?: string | null,
  fallbackCharacterOrder: string[] = [],
): Promise<MomentDialogScript> {
  const result = await findMomentLocation(momentId, preferredStoryId);
  if (!result.script) {
    return { characterOrder: [...fallbackCharacterOrder], lines: [] };
  }
  return normalizeMomentDialogScript(result.script, fallbackCharacterOrder);
}

export async function saveMomentDialogScript(
  momentId: string,
  script: MomentDialogScript,
  preferredStoryId?: string | null,
): Promise<boolean> {
  const { location } = await findMomentLocation(momentId, preferredStoryId);
  if (!location) return false;

  const payload = normalizeMomentDialogScript(script);

  if (location.kind === "heap") {
    const heap =
      (await get<MomentRecord[]>("heap-moments")) ||
      (await get<MomentRecord[]>("heap-gifs")) ||
      [];
    const next = heap.map((entry) =>
      entry.id === momentId
        ? { ...entry, dialogScript: payload, dialogLines: payload.lines }
        : entry,
    );
    await set("heap-moments", next);
    window.dispatchEvent(new CustomEvent("moments-updated"));
    return true;
  }

  const storyKey = `story:${location.storyId}`;
  const stored = await get<unknown>(storyKey);
  const items: unknown[] = Array.isArray(stored)
    ? stored
    : location.useItemsWrapper
      ? ((stored as { items: unknown[] }).items ?? [])
      : [];

  const nextItems = items.map((entry) => {
    const entryId =
      typeof entry === "string" ? entry : (entry as { id?: string })?.id;
    if (entryId !== momentId) return entry;
    if (typeof entry === "string") {
      if (!isLikelyMomentSrc(entry)) return entry;
      return { id: entry, src: entry, dialogScript: payload, dialogLines: payload.lines };
    }
    return { ...(entry as MomentRecord), dialogScript: payload, dialogLines: payload.lines };
  });

  if (Array.isArray(stored)) {
    await set(storyKey, nextItems);
  } else {
    await set(storyKey, { ...(stored as object), items: nextItems });
  }
  window.dispatchEvent(new CustomEvent("moments-updated"));
  window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id: location.storyId } }));
  return true;
}

/** @deprecated Use loadMomentDialogScript */
export async function loadMomentDialogLines(
  momentId: string,
  preferredStoryId?: string | null,
): Promise<MomentDialogLine[]> {
  const script = await loadMomentDialogScript(momentId, preferredStoryId);
  return script.lines;
}

/** @deprecated Use saveMomentDialogScript */
export async function saveMomentDialogLines(
  momentId: string,
  lines: MomentDialogLine[],
  preferredStoryId?: string | null,
): Promise<boolean> {
  const script = normalizeMomentDialogScript({ characterOrder: [], lines });
  return saveMomentDialogScript(momentId, script, preferredStoryId);
}

export function moveCharacterInOrder(order: string[], characterId: string, direction: -1 | 1): string[] {
  const index = order.indexOf(characterId);
  if (index === -1) return order;
  const target = index + direction;
  if (target < 0 || target >= order.length) return order;
  const next = [...order];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function addLineForCharacter(
  script: MomentDialogScript,
  character: { id: string; name: string },
  text: string,
): MomentDialogScript {
  const trimmed = text.trim();
  if (!trimmed) return script;
  const characterOrder = script.characterOrder.includes(character.id)
    ? script.characterOrder
    : [...script.characterOrder, character.id];
  return {
    characterOrder,
    lines: [
      ...script.lines,
      {
        id: newMomentDialogLineId(),
        characterId: character.id,
        speaker: character.name,
        text: trimmed,
      },
    ],
  };
}

export function removeLineFromScript(script: MomentDialogScript, lineId: string): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.filter((line) => line.id !== lineId),
  };
}

export function updateLineTextInScript(
  script: MomentDialogScript,
  lineId: string,
  text: string,
): MomentDialogScript {
  const trimmed = text.trim();
  if (!trimmed) {
    return removeLineFromScript(script, lineId);
  }
  return {
    ...script,
    lines: script.lines.map((line) =>
      line.id === lineId ? { ...line, text: trimmed } : line,
    ),
  };
}

export function updateLineEffectInScript(
  script: MomentDialogScript,
  lineId: string,
  textEffect: DialogTextEffect,
): MomentDialogScript {
  return updateLineInScript(script, lineId, { textEffect });
}

export function updateLineInScript(
  script: MomentDialogScript,
  lineId: string,
  patch: Partial<
    Pick<
      MomentDialogLine,
      | "text"
      | "textEffect"
      | "font"
      | "fontScale"
      | "color"
      | "speakerColor"
      | "shadowColor"
    >
  >,
): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
  };
}

export function updateLinePositionInScript(
  script: MomentDialogScript,
  lineId: string,
  pos: DialogLinePosition,
): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) =>
      line.id === lineId
        ? { ...line, pos: normalizeDialogLinePosition(pos) ?? pos }
        : line,
    ),
  };
}

export function clearLinePositionsInScript(script: MomentDialogScript): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map(({ pos: _pos, ...line }) => line),
  };
}

export function moveLineForCharacter(
  script: MomentDialogScript,
  characterId: string,
  lineId: string,
  direction: -1 | 1,
): MomentDialogScript {
  const indices = script.lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.characterId === characterId);
  const pos = indices.findIndex(({ line }) => line.id === lineId);
  if (pos === -1) return script;

  const target = pos + direction;
  if (target < 0 || target >= indices.length) return script;

  const nextLines = [...script.lines];
  const indexA = indices[pos].index;
  const indexB = indices[target].index;
  [nextLines[indexA], nextLines[indexB]] = [nextLines[indexB], nextLines[indexA]];
  return { ...script, lines: nextLines };
}
