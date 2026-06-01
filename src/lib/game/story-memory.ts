import { CONNECTION_STORAGE_KEYS, getConnectionItem } from "@/lib/connection-storage";
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from "@/lib/lmstudio";
import type { Agent, OrchestratedMessage } from "@/lib/agents/types";
import { formatGameSpeakerLabel } from "@/lib/game/game-context";

export type RefreshStorySummaryOptions = {
  sceneSummary: string;
  userText: string;
  assistantText: string;
  history: OrchestratedMessage[];
  npcName?: string;
  playerName?: string;
  npcKnowsPlayer?: boolean;
  playerMode?: OrchestratedMessage["playerMode"];
  currentTurnNpcKnewPlayer?: boolean;
};

type RefreshStorySummaryArgs = {
  gameSummaryKey: string | null;
  storySummary: string;
  connected: boolean;
  connectionModel: string | null;
  options: RefreshStorySummaryOptions;
  summarizeInFlightRef: { current: boolean };
  setStorySummary: (value: string) => void;
  setMomentSelectionMode: (value: "auto" | "manual") => void;
};

export async function refreshStorySummary({
  gameSummaryKey,
  storySummary,
  connected,
  connectionModel,
  options,
  summarizeInFlightRef,
  setStorySummary,
  setMomentSelectionMode,
}: RefreshStorySummaryArgs) {
  if (!gameSummaryKey || summarizeInFlightRef.current) return;
  summarizeInFlightRef.current = true;

  const npc = options.npcName ? { name: options.npcName } : null;
  const player = options.playerName ? { name: options.playerName } : null;
  const knowsPlayer = options.npcKnowsPlayer !== false;
  const formatSpeaker = (
    from: "user" | "agent",
    playerMode?: OrchestratedMessage["playerMode"],
    npcKnewPlayer?: boolean,
  ) =>
    formatGameSpeakerLabel(
      from,
      npc,
      player,
      from === "user" ? (npcKnewPlayer ?? knowsPlayer) : true,
      playerMode,
    );

  try {
    const summaryPrompt = [
      "Update the running story memory for this game.",
      "Keep it concise but durable.",
      "Preserve: current scene, story facts, character relationships, goals, unresolved threads, and immediate next beat.",
      "Do not include filler, apologies, meta commentary, speaker labels like \"Name (you, NPC):\", or behind-the-scenes/production notes.",
      "Write plain text only. Aim for 6-10 short bullet points or short paragraphs.",
      "",
      `Previous memory:\n${storySummary || "(none)"}`,
      "",
      `Scene context:\n${options.sceneSummary || "(none)"}`,
      "",
      `Recent history:\n${options.history
        .slice(-12)
        .map((msg) =>
          `${formatSpeaker(msg.from, msg.from === "user" ? msg.playerMode : undefined, msg.npcKnewPlayer)}: ${msg.text}`,
        )
        .join("\n")}`,
      "",
      `Latest ${formatSpeaker("user", options.playerMode, options.currentTurnNpcKnewPlayer)} turn:\n${options.userText}`,
      "",
      `Latest ${formatSpeaker("agent")} turn:\n${options.assistantText}`,
    ].join("\n");

    if (!connected) {
      const compact = [
        storySummary,
        options.sceneSummary,
        `Latest ${formatSpeaker("user", options.playerMode, options.currentTurnNpcKnewPlayer)} turn: ${options.userText}`,
        `Latest ${formatSpeaker("agent")} turn: ${options.assistantText}`,
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      setMomentSelectionMode("auto");
      setStorySummary(compact.slice(0, 2000));
      return;
    }

    const summarizerAgent: Agent = {
      id: "summarizer",
      name: "Story Memory",
      description:
        "Compress the game state into a durable summary that preserves scene facts, character relationships, goals, and unresolved threads.",
    };

    const zenKey = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey) ?? undefined;
    const googleKey = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey) ?? undefined;
    const hfKey = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey) ?? undefined;
    const nvidiaKey = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey) ?? undefined;
    const activeProvider =
      getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
      getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider) ||
      "zen";
    const lmstudioUrl = normalizeLmstudioUrl(
      getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl) || DEFAULT_LMSTUDIO_URL,
    );

    const res = await fetch("/api/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: summaryPrompt,
        model: connectionModel,
        zenApiKey: zenKey,
        googleApiKey: googleKey,
        hfApiKey: hfKey,
        nvidiaApiKey: nvidiaKey,
        provider: activeProvider,
        lmstudioUrl: activeProvider === "lmstudio" ? lmstudioUrl : undefined,
        agents: [summarizerAgent],
        stateless: true,
        orchestration: "parallel",
        interactionMode: "neutral",
        story: options.sceneSummary || storySummary,
        history: options.history.slice(-12),
      }),
    });

    const data = await res.json().catch(() => null);
    const summaryText =
      res.ok && data && Array.isArray(data.messages) && typeof data.messages[0]?.text === "string"
        ? data.messages[0].text.trim()
        : "";

    if (summaryText) {
      setMomentSelectionMode("auto");
      setStorySummary(summaryText.slice(0, 2000));
    } else {
      const fallback = [
        storySummary,
        options.sceneSummary,
        `Latest ${formatSpeaker("user", options.playerMode, options.currentTurnNpcKnewPlayer)} turn: ${options.userText}`,
        `Latest ${formatSpeaker("agent")} turn: ${options.assistantText}`,
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      setMomentSelectionMode("auto");
      setStorySummary(fallback.slice(0, 2000));
    }
  } catch {
    const fallback = [
      storySummary,
      options.sceneSummary,
      `Latest ${formatSpeaker("user", options.playerMode, options.currentTurnNpcKnewPlayer)} turn: ${options.userText}`,
      `Latest ${formatSpeaker("agent")} turn: ${options.assistantText}`,
    ]
      .filter(Boolean)
      .join("\n\n")
      .trim();
    setMomentSelectionMode("auto");
    setStorySummary(fallback.slice(0, 2000));
  } finally {
    summarizeInFlightRef.current = false;
  }
}
