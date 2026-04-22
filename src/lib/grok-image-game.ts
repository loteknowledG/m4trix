import type { Agent } from "@/app/(site)/characters/types";
import type { ChatMessage } from "@/app/(site)/characters/types";
import type { CustomChatMessage } from "@/components/ai/custom-chat-window";

const NARRATOR_AGENT_ID = "__m4trix_game_agent__";

type GamePerson = {
  id: string;
  name: string;
  description: string;
  appearance?: string;
  avatarUrl?: string;
} | null;

function profileDescription(p: NonNullable<GamePerson>) {
  const parts = [p.description?.trim(), p.appearance?.trim() ? `Appearance: ${p.appearance.trim()}` : ""].filter(
    Boolean,
  );
  return parts.join("\n\n") || "_(No profile text.)_";
}

function toAgent(p: NonNullable<GamePerson>): Agent {
  return {
    id: p.id,
    name: p.name || "Character",
    description: profileDescription(p),
    avatarUrl: p.avatarUrl,
  };
}

/**
 * Maps live game state into props for {@link GrokImagePromptButton}.
 * Game chat uses `from: "agent"` without an agent id — we attribute those lines to the NPC or a narrator stub.
 */
export function mapGameChatForGrokImage(
  chatMessages: CustomChatMessage[],
  npc: GamePerson,
  player: GamePerson,
): {
  agents: Agent[];
  prompterAgent: Agent | null;
  focusAgentId: string | null;
  messages: ChatMessage[];
} {
  const narratorAgent: Agent = {
    id: NARRATOR_AGENT_ID,
    name: "Scene / narrator",
    description:
      "Replies shown on the agent side of this game chat (narrator, engine, or NPC voice before an NPC profile was bound).",
  };

  const agents: Agent[] = [];
  if (npc) agents.push(toAgent(npc));
  else agents.push(narratorAgent);

  const prompterAgent = player ? toAgent(player) : null;

  const agentSpeakerId = npc?.id ?? NARRATOR_AGENT_ID;

  const messages: ChatMessage[] = chatMessages
    .filter((m) => m.id !== "story-opening")
    .map((m) => ({
      id: m.id,
      from: m.from === "user" ? "user" : agentSpeakerId,
      text: m.text,
    }));

  return {
    agents,
    prompterAgent,
    focusAgentId: npc?.id ?? null,
    messages,
  };
}
