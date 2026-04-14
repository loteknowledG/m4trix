import { get } from "idb-keyval";

import { storyTextForPrompt } from "@/lib/game/story-moments";

export type GameCharacterContext = {
  id: string;
  name: string;
  description: string;
  appearance?: string;
  avatarUrl?: string;
} | null;

export type GameContextResolution = {
  currentNpc: GameCharacterContext;
  currentPlayer: GameCharacterContext;
  currentStoryDescription: string;
  currentSceneSummary: string;
};

export function buildSceneSummary(params: {
  title?: string;
  currentMomentName?: string;
  npc: GameCharacterContext;
  player: GameCharacterContext;
}) {
  const { title, currentMomentName, npc, player } = params;
  const sceneParts = [
    title ? `Story title: ${title}` : "",
    currentMomentName ? `Current moment: ${currentMomentName}` : "",
    npc ? `NPC: ${npc.name}${npc.description ? ` - ${npc.description}` : ""}` : "",
    npc?.appearance ? `NPC appearance: ${npc.appearance}` : "",
    player ? `Player avatar: ${player.name}${player.description ? ` - ${player.description}` : ""}` : "",
    player?.appearance ? `Player appearance: ${player.appearance}` : "",
  ].filter(Boolean);
  return sceneParts.join("\n");
}

export async function resolveGameAgentContext(params: {
  storyId?: string;
  assignedNpc: GameCharacterContext;
  assignedPlayer: GameCharacterContext;
  setAssignedNpc: (value: GameCharacterContext) => void;
  setAssignedPlayer: (value: GameCharacterContext) => void;
  buildSceneSummaryFn: (npc: GameCharacterContext, player: GameCharacterContext) => string;
}): Promise<GameContextResolution> {
  const {
    storyId,
    assignedNpc,
    assignedPlayer,
    setAssignedNpc,
    setAssignedPlayer,
    buildSceneSummaryFn,
  } = params;

  let currentNpc = assignedNpc;
  let currentPlayer = assignedPlayer;
  let currentStoryDescription = "";
  let currentSceneSummary = "";

  if (storyId) {
    try {
      const stories = (await get<any[]>("stories")) || [];
      const storyMeta = stories.find((s) => s.id === storyId);
      currentStoryDescription = storyTextForPrompt(
        typeof storyMeta?.description === "string" ? storyMeta.description : "",
      );
      const characters = (await get<any[]>("PLAYGROUND_AGENTS")) || [];
      const npc = storyMeta?.npcId ? characters.find((c) => c.id === storyMeta.npcId) : null;
      const player = storyMeta?.playerId
        ? characters.find((c) => c.id === storyMeta.playerId)
        : null;

      currentNpc = npc
        ? {
            id: npc.id,
            name: npc.name ?? "",
            description: npc.description ?? "",
            appearance: typeof storyMeta?.npcAppearance === "string" ? storyMeta.npcAppearance : "",
            avatarUrl: npc.avatarUrl,
          }
        : null;
      currentPlayer = player
        ? {
            id: player.id,
            name: player.name ?? "",
            description: player.description ?? "",
            appearance:
              typeof storyMeta?.playerAppearance === "string" ? storyMeta.playerAppearance : "",
            avatarUrl: player.avatarUrl,
          }
        : null;

      currentSceneSummary = buildSceneSummaryFn(currentNpc, currentPlayer);

      setAssignedNpc(currentNpc);
      setAssignedPlayer(currentPlayer);
    } catch {
      /* ignore */
    }
  }

  return {
    currentNpc,
    currentPlayer,
    currentStoryDescription,
    currentSceneSummary,
  };
}
