import { get, set } from "idb-keyval";

import type { OrchestratedMessage } from "@/lib/agents/types";

export const getGameHistoryKey = (id?: string | null) =>
  id ? `game-history:${id}` : null;

export const getGameSummaryKey = (id?: string | null) =>
  id ? `game-summary:${id}` : null;

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
