import type { OrchestratedMessage } from "@/lib/agents/types";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function nameCandidates(playerName: string) {
  const trimmed = playerName.trim();
  if (!trimmed) return [];
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0] ?? trimmed;
  return [...new Set([trimmed, first].filter(Boolean))];
}

export function playerIntroducedIdentity(text: string, playerName: string) {
  const input = String(text || "").trim();
  if (!input || !playerName.trim()) return false;

  for (const name of nameCandidates(playerName)) {
    const escaped = escapeRegExp(name);
    const patterns = [
      new RegExp(
        `\\b(?:I\\s*'?m|I am|I'm|my name is|my name's|call me|they call me|name's|name is)\\s+${escaped}\\b`,
        "i",
      ),
      new RegExp(`\\b(?:this is|it's|it is)\\s+${escaped}\\b`, "i"),
      new RegExp(`\\b${escaped}\\s+here\\b`, "i"),
      new RegExp(`\\b(?:you can call me|people call me)\\s+${escaped}\\b`, "i"),
    ];
    if (patterns.some((pattern) => pattern.test(input))) {
      return true;
    }
  }

  return false;
}

export function findPlayerIntroductionIndex(
  history: OrchestratedMessage[],
  playerName: string,
) {
  return history.findIndex(
    (entry) => entry.from === "user" && playerIntroducedIdentity(entry.text, playerName),
  );
}

export function backfillNpcKnewPlayerOnHistory(
  history: OrchestratedMessage[],
  playerName: string,
  storyKnowsPlayer: boolean,
) {
  if (storyKnowsPlayer) {
    return history.map((entry) =>
      entry.from === "user" ? { ...entry, npcKnewPlayer: true } : entry,
    );
  }

  const introIndex = findPlayerIntroductionIndex(history, playerName);
  return history.map((entry, index) => {
    if (entry.from !== "user") return entry;
    if (entry.npcKnewPlayer !== undefined) return entry;
    return {
      ...entry,
      npcKnewPlayer: introIndex >= 0 ? index > introIndex : false,
    };
  });
}

export function historyRevealedPlayerIdentity(
  history: OrchestratedMessage[],
  playerName: string,
) {
  return findPlayerIntroductionIndex(history, playerName) >= 0;
}

export function messageNpcKnewPlayer(
  entry: OrchestratedMessage,
  storyKnowsPlayer: boolean,
  revealedInGame: boolean,
) {
  if (entry.from !== "user") return true;
  if (entry.npcKnewPlayer !== undefined) return entry.npcKnewPlayer;
  if (storyKnowsPlayer || revealedInGame) return true;
  return false;
}

export function resolveNpcKnowsPlayerForSession(
  storyKnowsPlayer: boolean,
  revealedInGame: boolean,
) {
  return storyKnowsPlayer || revealedInGame;
}
