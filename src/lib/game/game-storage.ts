import { get, set } from "idb-keyval";

import type { OrchestratedMessage } from "@/lib/agents/types";

export type GameMomentState = {
  index: number;
  mode: "auto" | "manual";
  momentId?: string | null;
};

export const getGameHistoryKey = (id?: string | null) =>
  id ? `game-history:${id}` : null;

export const getGameSummaryKey = (id?: string | null) =>
  id ? `game-summary:${id}` : null;

export const getGameMomentKey = (id?: string | null) =>
  id ? `game-moment:${id}` : null;

export async function loadGameHistory(gameHistoryKey: string | null) {
  if (!gameHistoryKey) return [] as OrchestratedMessage[];
  const stored = (await get<OrchestratedMessage[]>(gameHistoryKey)) || [];
  return Array.isArray(stored) ? stored : [];
}

export function saveGameHistory(gameHistoryKey: string | null, storyHistory: OrchestratedMessage[]) {
  if (!gameHistoryKey) return Promise.resolve();
  return set(gameHistoryKey, storyHistory);
}

export async function loadGameSummary(gameSummaryKey: string | null) {
  if (!gameSummaryKey) return "";
  const stored = await get<string>(gameSummaryKey);
  return typeof stored === "string" ? stored : "";
}

export function saveGameSummary(gameSummaryKey: string | null, storySummary: string) {
  if (!gameSummaryKey) return Promise.resolve();
  return set(gameSummaryKey, storySummary);
}

export async function loadGameMoment(gameMomentKey: string | null) {
  if (!gameMomentKey) return null;
  const stored = await get<GameMomentState>(gameMomentKey);
  if (!stored || typeof stored !== "object") return null;
  const index = Number.isFinite(stored.index) ? Math.max(0, Math.floor(stored.index)) : 0;
  const mode = stored.mode === "manual" ? "manual" : "auto";
  const momentId = typeof stored.momentId === "string" ? stored.momentId : null;
  return { index, mode, momentId } as GameMomentState;
}

export function saveGameMoment(gameMomentKey: string | null, momentState: GameMomentState) {
  if (!gameMomentKey) return Promise.resolve();
  return set(gameMomentKey, momentState);
}
