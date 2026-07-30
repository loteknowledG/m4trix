import { safeGet, safeSet } from "@/lib/storage-compat";
import { NARRATOR_CHARACTER_ID } from "@/lib/game/narrator-agent";
import { normalizePlayerMode, formatPlayerMemoryLabel, formatDialogModeLabel, type PlayerMode } from "@/lib/player-mode";
import {
  normalizeMomentDialogTextEffect,
  type VideoCueTextEffect,
} from "@/lib/video-cue-text-effects";
import {
  isLikelyMomentSrc,
  normalizeStoryMomentEntry,
  storyMomentId,
} from "@/lib/story-moments";
import {
  normalizeCueColor,
  normalizeCueFont,
  type VideoCueFontId,
  type VideoTimedCue,
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
  /** Say/do/think — used for player and NPC dialog lines. */
  playerMode?: PlayerMode;
  textEffect?: VideoCueTextEffect;
  /** Seconds when this line becomes visible */
  start?: number;
  /** Seconds when this line hides */
  end?: number;
  /** Horizontal center, 0–1 on the moment frame */
  x?: number;
  /** Vertical center, 0–1 on the moment frame */
  y?: number;
  /** Max width as a fraction of the frame (default 0.72) */
  width?: number;
  /** @deprecated use x/y — kept for legacy scripts */
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
  /** Scene duration for the dialog timeline (seconds) */
  duration?: number;
};

export type MomentDialogUpdatedDetail = {
  momentId: string;
  storyId?: string | null;
  script: MomentDialogScript;
};

export const MOMENT_DIALOG_UPDATED = "moment-dialog-updated";

export function momentDialogUpdateMatches(
  detail: MomentDialogUpdatedDetail | null | undefined,
  momentId: string | null,
  storyId?: string | null,
): boolean {
  if (!detail || !momentId || detail.momentId !== momentId) return false;
  if (detail.storyId && storyId && detail.storyId !== storyId) return false;
  return true;
}

export function dispatchMomentDialogUpdated(detail: MomentDialogUpdatedDetail) {
  window.dispatchEvent(new CustomEvent(MOMENT_DIALOG_UPDATED, { detail }));
}

export const DEFAULT_MOMENT_LINE_DURATION = 5;

export function isNarratorDialogLine(
  line: Pick<MomentDialogLine, "characterId" | "speaker">,
  speakerName?: string,
): boolean {
  if (line.characterId === NARRATOR_CHARACTER_ID) return true;
  const label = (speakerName ?? line.speaker ?? "").trim().toLowerCase();
  return label === "narrator";
}

export function resolveMomentDialogSpeakerName(
  line: Pick<MomentDialogLine, "characterId" | "speaker" | "playerMode">,
  sceneCharacters: Array<{ id: string; name: string; role: "player" | "npc" | "narrator" }>,
  npcKnowsPlayer = true,
): string {
  const character = sceneCharacters.find((entry) => entry.id === line.characterId);
  const name = character?.name?.trim() || line.speaker?.trim() || "Unknown";
  if (character?.role === "player") {
    return formatPlayerMemoryLabel({ name }, npcKnowsPlayer, line.playerMode);
  }
  if (character?.role === "npc") {
    return formatDialogModeLabel(name, line.playerMode);
  }
  return name;
}

export const DEFAULT_MOMENT_DIALOG_LINE_STYLE = {
  textEffect: "none" as VideoCueTextEffect,
  font: "system" as VideoCueFontId,
  fontScale: 0.04,
  color: "#ffffff",
  shadowColor: "#000000",
};

export function resolveMomentDialogLineStyle(line: Partial<MomentDialogLine>) {
  return {
    textEffect: normalizeMomentDialogTextEffect(line.textEffect),
    font: line.font ?? DEFAULT_MOMENT_DIALOG_LINE_STYLE.font,
    fontScale: line.fontScale ?? DEFAULT_MOMENT_DIALOG_LINE_STYLE.fontScale,
    color: line.color ?? DEFAULT_MOMENT_DIALOG_LINE_STYLE.color,
    shadowColor: line.shadowColor ?? DEFAULT_MOMENT_DIALOG_LINE_STYLE.shadowColor,
    speakerColor: line.speakerColor,
  };
}

export function defaultXYForSpeakerZone(zone: DialogSpeakerPosition): DialogLinePosition {
  switch (zone) {
    case "top":
      return { x: 0.5, y: 0.14 };
    case "bottom":
      return { x: 0.5, y: 0.86 };
    case "left":
      return { x: 0.18, y: 0.72 };
    case "right":
      return { x: 0.82, y: 0.72 };
  }
}

export function resolveMomentLineLayout(line: MomentDialogLine) {
  const x = line.x ?? line.pos?.x ?? 0.5;
  const y = line.y ?? line.pos?.y ?? 0.82;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    width: Math.min(1, Math.max(0.2, line.width ?? 0.72)),
    fontScale: line.fontScale ?? DEFAULT_MOMENT_DIALOG_LINE_STYLE.fontScale,
  };
}

export function resolveMomentLineTiming(line: MomentDialogLine) {
  const start = Math.max(0, line.start ?? 0);
  const end = Math.max(start + 0.5, line.end ?? start + DEFAULT_MOMENT_LINE_DURATION);
  return { start, end };
}

export function getActiveMomentDialogLines(
  lines: MomentDialogLine[],
  currentTime: number,
): MomentDialogLine[] {
  const t = Math.max(0, currentTime);
  return lines.filter((line) => {
    const { start, end } = resolveMomentLineTiming(line);
    return t >= start - 0.02 && t < end;
  });
}

export function computeMomentDialogDuration(script: MomentDialogScript): number {
  if (typeof script.duration === "number" && script.duration > 0) {
    return script.duration;
  }
  const lineEnds = script.lines.map((line) => resolveMomentLineTiming(line).end);
  return Math.max(30, ...lineEnds, 0);
}

/** Duration for playback loop — ends shortly after the last dialog line. */
export function computeMomentDialogLoopDuration(script: MomentDialogScript): number {
  if (!script.lines.length) return 0;
  const lineEnds = script.lines.map((line) => resolveMomentLineTiming(line).end);
  return Math.max(0.5, Math.max(...lineEnds) + 0.35);
}

export function scriptUsesTimedLayout(script: MomentDialogScript): boolean {
  return script.lines.some(
    (line) =>
      typeof line.start === "number" ||
      typeof line.x === "number" ||
      line.pos != null,
  );
}

export function ensureTimedDialogScript(
  script: MomentDialogScript,
  sceneCharacters: Array<{ id: string; name: string; role?: "player" | "npc" | "narrator" }>,
): MomentDialogScript {
  if (!script.lines.length) return script;

  const names = sceneCharacters.map((character) => ({
    id: character.id,
    name: character.name,
  }));
  const ordered = scriptPreviewLines(script, names);
  const byId = new Map(script.lines.map((line) => [line.id, { ...line }]));
  let timeCursor = 0;

  for (const previewLine of ordered) {
    const line = byId.get(previewLine.id);
    if (!line) continue;

    if (typeof line.start !== "number" || typeof line.end !== "number") {
      line.start = timeCursor;
      line.end = timeCursor + DEFAULT_MOMENT_LINE_DURATION;
    }
    timeCursor = Math.max(timeCursor, resolveMomentLineTiming(line).end);

    if (typeof line.x !== "number" || typeof line.y !== "number") {
      if (line.pos) {
        line.x = line.pos.x;
        line.y = line.pos.y;
      } else {
        const character = sceneCharacters.find((entry) => entry.id === line.characterId);
        const zone = resolveCharacterPosition(
          script,
          line.characterId,
          character?.role ?? "npc",
        );
        const xy = defaultXYForSpeakerZone(zone);
        line.x = xy.x;
        line.y = xy.y;
      }
    }

    if (typeof line.width !== "number") {
      line.width = 0.72;
    }

    line.pos = {
      x: line.x ?? 0.5,
      y: line.y ?? 0.82,
    };
  }

  for (const line of byId.values()) {
    if (typeof line.start !== "number" || typeof line.end !== "number") {
      line.start = timeCursor;
      line.end = timeCursor + DEFAULT_MOMENT_LINE_DURATION;
      timeCursor = line.end;
    }
    if (typeof line.x !== "number" || typeof line.y !== "number") {
      line.x = line.pos?.x ?? 0.5;
      line.y = line.pos?.y ?? 0.82;
    }
    if (typeof line.width !== "number") line.width = 0.72;
    line.pos = { x: line.x, y: line.y };
  }

  const duration = Math.max(computeMomentDialogDuration(script), timeCursor + 8);
  return {
    ...script,
    lines: script.lines.map((line) => byId.get(line.id) ?? line),
    duration,
  };
}

export function momentLinesToTimelineCues(
  script: MomentDialogScript,
  characters: Array<{ id: string; name: string; role?: "player" | "npc" | "narrator" }>,
): VideoTimedCue[] {
  const hasRoles = characters.some((character) => character.role != null);
  const names = new Map(characters.map((character) => [character.id, character.name]));
  return scriptPreviewLines(script, characters).map((line) => {
    const layout = resolveMomentLineLayout(line);
    const timing = resolveMomentLineTiming(line);
    const speaker = hasRoles
      ? resolveMomentDialogSpeakerName(line, characters as Array<{ id: string; name: string; role: "player" | "npc" | "narrator" }>)
      : names.get(line.characterId) || line.speaker;
    return {
      id: line.id,
      start: timing.start,
      end: timing.end,
      text: line.text,
      speaker,
      x: layout.x,
      y: layout.y,
      width: layout.width,
      fontScale: layout.fontScale,
      font: line.font,
      color: line.color,
      speakerColor: line.speakerColor,
      shadowColor: line.shadowColor,
      textEffect: line.textEffect,
    };
  });
}

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
    const text = typeof record.text === "string" ? record.text : "";
    if (!text.trim()) continue;
    const characterId =
      typeof record.characterId === "string" ? record.characterId.trim() : "";
    const speaker = typeof record.speaker === "string" ? record.speaker.trim() : "";
    const entry: MomentDialogLine = {
      id: typeof record.id === "string" ? record.id : newMomentDialogLineId(),
      characterId,
      speaker,
      text,
      textEffect: normalizeMomentDialogTextEffect(record.textEffect),
    };
    const playerMode = normalizePlayerMode(
      typeof record.playerMode === "string" ? record.playerMode : null,
    );
    if (typeof record.playerMode === "string") {
      entry.playerMode = playerMode;
    }
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
    if (typeof record.start === "number" && Number.isFinite(record.start)) {
      entry.start = Math.max(0, record.start);
    }
    if (typeof record.end === "number" && Number.isFinite(record.end)) {
      entry.end = Math.max(0, record.end);
    }
    if (typeof record.x === "number" && Number.isFinite(record.x)) {
      entry.x = Math.min(1, Math.max(0, record.x));
    }
    if (typeof record.y === "number" && Number.isFinite(record.y)) {
      entry.y = Math.min(1, Math.max(0, record.y));
    }
    if (typeof record.width === "number" && Number.isFinite(record.width)) {
      entry.width = Math.min(1, Math.max(0.2, record.width));
    }
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
    const duration =
      typeof record.duration === "number" && Number.isFinite(record.duration)
        ? Math.max(1, record.duration)
        : undefined;
    return { characterOrder, lines, characterPositions, duration };
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

function momentEntryMatchesId(entry: unknown, momentId: string): boolean {
  const target = momentId.trim();
  if (!target) return false;

  const normalized = storyMomentId(entry);
  if (normalized === target) return true;

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

function attachDialogToMomentEntry(
  entry: unknown,
  momentId: string,
  payload: MomentDialogScript,
): MomentRecord {
  if (typeof entry === "string") {
    const src = entry.trim();
    return {
      id: momentId,
      src: isLikelyMomentSrc(src) ? src : momentId,
      dialogScript: payload,
      dialogLines: payload.lines,
    };
  }

  const normalized = normalizeStoryMomentEntry(entry);
  const base = (entry && typeof entry === "object" ? (entry as MomentRecord) : {}) as MomentRecord;
  return {
    ...base,
    id: normalized?.id ?? base.id ?? momentId,
    src: normalized?.src ?? base.src ?? momentId,
    dialogScript: payload,
    dialogLines: payload.lines,
  };
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
    const stored = await safeGet<unknown>(storyKey);
    const { items, useItemsWrapper } = readStoryItems(stored);

    for (const entry of items) {
      if (!momentEntryMatchesId(entry, momentId)) continue;
      return {
        script: readScript(entry) ?? { characterOrder: [], lines: [] },
        location: { kind: "story", storyId: preferredStoryId, useItemsWrapper },
      };
    }

    if (stored !== undefined) {
      return {
        script: null,
        location: { kind: "story", storyId: preferredStoryId, useItemsWrapper },
      };
    }
  }

  const heap =
    (await safeGet<MomentRecord[]>("heap-moments")) ||
    (await safeGet<MomentRecord[]>("heap-gifs")) ||
    [];
  const heapItem = heap.find((entry) => momentEntryMatchesId(entry, momentId));
  if (heapItem) {
    return {
      script: readScript(heapItem) ?? { characterOrder: [], lines: [] },
      location: { kind: "heap" },
    };
  }

  const storiesMeta = (await safeGet<Array<{ id: string }>>("stories")) || [];
  for (const meta of storiesMeta) {
    const storyKey = `story:${meta.id}`;
    const stored = await safeGet<unknown>(storyKey);
    const { items, useItemsWrapper } = readStoryItems(stored);

    for (const entry of items) {
      if (!momentEntryMatchesId(entry, momentId)) continue;
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
      (await safeGet<MomentRecord[]>("heap-moments")) ||
      (await safeGet<MomentRecord[]>("heap-gifs")) ||
      [];
    const next = heap.map((entry) =>
      momentEntryMatchesId(entry, momentId)
        ? { ...entry, dialogScript: payload, dialogLines: payload.lines }
        : entry,
    );
    await safeSet("heap-moments", next);
    dispatchMomentDialogUpdated({ momentId, storyId: preferredStoryId, script: payload });
    window.dispatchEvent(new CustomEvent("moments-updated"));
    return true;
  }

  const storyKey = `story:${location.storyId}`;
  const stored = await safeGet<unknown>(storyKey);
  const { items, useItemsWrapper } = readStoryItems(stored);

  let updated = false;
  const nextItems = items.map((entry) => {
    if (!momentEntryMatchesId(entry, momentId)) return entry;
    updated = true;
    return attachDialogToMomentEntry(entry, momentId, payload);
  });

  if (!updated) {
    nextItems.push(attachDialogToMomentEntry(null, momentId, payload));
  }

  if (Array.isArray(stored)) {
    await safeSet(storyKey, nextItems);
  } else {
    await safeSet(storyKey, { ...(stored as object), items: nextItems });
  }
  dispatchMomentDialogUpdated({
    momentId,
    storyId: location.storyId,
    script: payload,
  });
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
  character: { id: string; name: string; role?: "player" | "npc" | "narrator" },
  text = "",
): MomentDialogScript {
  const trimmed = text.trim();
  const characterOrder = script.characterOrder.includes(character.id)
    ? script.characterOrder
    : [...script.characterOrder, character.id];
  const maxEnd = Math.max(0, ...script.lines.map((line) => resolveMomentLineTiming(line).end));
  const start = maxEnd;
  const end = start + DEFAULT_MOMENT_LINE_DURATION;
  const zone = resolveCharacterPosition(
    script,
    character.id,
    character.role ?? "npc",
  );
  const xy = defaultXYForSpeakerZone(zone);
  const newLine: MomentDialogLine = {
    id: newMomentDialogLineId(),
    characterId: character.id,
    speaker: character.name,
    text: trimmed,
    start,
    end,
    x: xy.x,
    y: xy.y,
    width: 0.72,
    pos: xy,
    ...DEFAULT_MOMENT_DIALOG_LINE_STYLE,
  };
  if (character.role === "player" || character.role === "npc") {
    newLine.playerMode = "say";
  }
  return {
    characterOrder,
    lines: [...script.lines, newLine],
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
      line.id === lineId ? { ...line, text } : line,
    ),
  };
}

export function updateLineEffectInScript(
  script: MomentDialogScript,
  lineId: string,
  textEffect: VideoCueTextEffect,
): MomentDialogScript {
  return updateLineInScript(script, lineId, { textEffect });
}

export function updateLineTimingInScript(
  script: MomentDialogScript,
  lineId: string,
  patch: { start?: number; end?: number },
): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) => {
      if (line.id !== lineId) return line;
      const timing = resolveMomentLineTiming(line);
      const start = patch.start != null ? Math.max(0, patch.start) : timing.start;
      const end =
        patch.end != null
          ? Math.max(start + 0.5, patch.end)
          : patch.start != null && patch.end == null
            ? Math.max(start + 0.5, timing.end)
            : timing.end;
      return { ...line, start, end };
    }),
  };
}

export function updateLineInScript(
  script: MomentDialogScript,
  lineId: string,
  patch: Partial<
    Pick<
      MomentDialogLine,
      | "text"
      | "textEffect"
      | "characterId"
      | "speaker"
      | "playerMode"
      | "font"
      | "fontScale"
      | "color"
      | "speakerColor"
      | "shadowColor"
      | "start"
      | "end"
      | "x"
      | "y"
      | "width"
    >
  >,
): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) => (line.id === lineId ? { ...line, ...patch } : line)),
  };
}

export function updateLineLayoutInScript(
  script: MomentDialogScript,
  lineId: string,
  patch: Partial<Pick<MomentDialogLine, "x" | "y" | "width" | "fontScale">>,
): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) => {
      if (line.id !== lineId) return line;
      const next = { ...line, ...patch };
      const x = next.x ?? line.x ?? line.pos?.x ?? 0.5;
      const y = next.y ?? line.y ?? line.pos?.y ?? 0.82;
      next.x = Math.min(1, Math.max(0, x));
      next.y = Math.min(1, Math.max(0, y));
      if (patch.width != null) {
        next.width = Math.min(1, Math.max(0.2, patch.width));
      }
      next.pos = { x: next.x, y: next.y };
      return next;
    }),
  };
}

export function updateLinePositionInScript(
  script: MomentDialogScript,
  lineId: string,
  pos: DialogLinePosition,
): MomentDialogScript {
  const normalized = normalizeDialogLinePosition(pos) ?? pos;
  return updateLineLayoutInScript(script, lineId, { x: normalized.x, y: normalized.y });
}

export function clearLinePositionsInScript(script: MomentDialogScript): MomentDialogScript {
  return {
    ...script,
    lines: script.lines.map((line) => {
      const zone = defaultXYForSpeakerZone("bottom");
      return {
        ...line,
        x: zone.x,
        y: zone.y,
        width: 0.72,
        pos: zone,
      };
    }),
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
