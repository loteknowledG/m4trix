import { get } from "idb-keyval";

import { storyTextForPrompt } from "@/lib/game/story-moments";
import { formatPlayerMemoryLabel, type PlayerMode } from "@/lib/player-mode";
import { stripHtmlImages } from "@/lib/agents/providers";

export type { PlayerMode };

export type GameCharacterContext = {
  id: string;
  name: string;
  description: string;
  appearance?: string;
  avatarUrl?: string;
} | null;

export function formatGameSpeakerLabel(
  from: "user" | "agent",
  npc?: { name?: string } | null,
  player?: { name?: string } | null,
  npcKnowsPlayer = true,
  playerMode?: PlayerMode | string | null,
) {
  if (from === "agent") {
    return npc?.name?.trim() || "NPC";
  }
  return formatPlayerMemoryLabel(player, npcKnowsPlayer, playerMode);
}

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
  npcKnowsPlayer?: boolean;
}) {
  const { title, currentMomentName, npc, player, npcKnowsPlayer = true } = params;
  const knowsPlayer = npcKnowsPlayer !== false;
  const sceneParts = [
    title ? `Story title: ${title}` : "",
    currentMomentName ? `Current moment: ${currentMomentName}` : "",
    npc ? `NPC (you are ${npc.name}): ${stripHtmlImages(npc.description || "No description")}` : "",
    npc?.appearance ? `${npc.name} appearance: ${npc.appearance}` : "",
    player && knowsPlayer
      ? `Player character (user controls ${player.name}): ${stripHtmlImages(player.description || "No description")}`
      : player
        ? "Player character: a stranger you have never met before"
        : "",
    player && knowsPlayer && player.appearance
      ? `${player.name} appearance: ${player.appearance}`
      : player && !knowsPlayer && player.appearance
        ? `Stranger's observable appearance: ${player.appearance}`
        : "",
    player && npc && knowsPlayer
      ? `When ${player.name} says "you", they mean ${npc.name}. When they say "I/me/my", they mean ${player.name}.`
      : player && npc && !knowsPlayer
        ? `You do not know this stranger's name yet. When they say "you", they mean ${npc.name}.`
        : "",
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
        : assignedNpc;
      currentPlayer = player
        ? {
            id: player.id,
            name: player.name ?? "",
            description: player.description ?? "",
            appearance:
              typeof storyMeta?.playerAppearance === "string" ? storyMeta.playerAppearance : "",
            avatarUrl: player.avatarUrl,
          }
        : assignedPlayer;

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
