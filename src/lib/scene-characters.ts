import { get } from "idb-keyval";
import {
  ensureNarratorCharacterRecord,
  NARRATOR_CHARACTER_ID,
} from "@/lib/game/narrator-agent";

export type SceneCharacter = {
  id: string;
  name: string;
  role: "player" | "npc" | "narrator";
  roleLabel: string;
};

type StoryMeta = {
  id: string;
  playerId?: string;
  npcId?: string;
  narratorEnabled?: boolean;
};

type AgentRecord = {
  id: string;
  name?: string;
};

function resolveCharacterName(
  agents: AgentRecord[],
  characterId: string,
  fallback: string,
): string {
  const match = agents.find((agent) => agent.id === characterId);
  const name = match?.name?.trim();
  return name || fallback;
}

async function loadStoryAssignments(storyId: string): Promise<StoryMeta | null> {
  const storiesMeta = (await get<StoryMeta[]>("stories")) || [];
  const fromList = storiesMeta.find((story) => story.id === storyId);

  const stored = await get<Record<string, unknown>>(`story:${storyId}`);
  const fromBlob =
    stored && typeof stored === "object" && !Array.isArray(stored) ? stored : null;

  if (!fromList && !fromBlob) return null;

  return {
    id: storyId,
    playerId:
      (typeof fromList?.playerId === "string" ? fromList.playerId : undefined) ||
      (typeof fromBlob?.playerId === "string" ? fromBlob.playerId : undefined),
    npcId:
      (typeof fromList?.npcId === "string" ? fromList.npcId : undefined) ||
      (typeof fromBlob?.npcId === "string" ? fromBlob.npcId : undefined),
    narratorEnabled:
      fromList?.narratorEnabled ??
      (typeof fromBlob?.narratorEnabled === "boolean" ? fromBlob.narratorEnabled : undefined),
  };
}

export async function loadStorySceneCharacters(
  storyId: string | null | undefined,
): Promise<SceneCharacter[]> {
  if (!storyId) return [];

  const meta = await loadStoryAssignments(storyId);
  if (!meta) return [];

  const savedAgents = (await get<AgentRecord[]>("PLAYGROUND_AGENTS")) || [];
  const { agents } = ensureNarratorCharacterRecord(savedAgents);

  const sceneCharacters: SceneCharacter[] = [];

  if (meta.playerId) {
    sceneCharacters.push({
      id: meta.playerId,
      name: resolveCharacterName(agents, meta.playerId, "Player"),
      role: "player",
      roleLabel: "Player",
    });
  }

  if (meta.npcId) {
    sceneCharacters.push({
      id: meta.npcId,
      name: resolveCharacterName(agents, meta.npcId, "AI character"),
      role: "npc",
      roleLabel: "AI character",
    });
  }

  if (meta.narratorEnabled !== false) {
    sceneCharacters.push({
      id: NARRATOR_CHARACTER_ID,
      name: resolveCharacterName(agents, NARRATOR_CHARACTER_ID, "Narrator"),
      role: "narrator",
      roleLabel: "Narrator",
    });
  }

  return sceneCharacters;
}
