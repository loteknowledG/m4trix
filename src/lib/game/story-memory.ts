import { CONNECTION_STORAGE_KEYS, getConnectionItem } from "@/lib/connection-storage";
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from "@/lib/lmstudio";
import type { Agent, OrchestratedMessage } from "@/lib/agents/types";

export type RefreshStorySummaryOptions = {
  sceneSummary: string;
  userText: string;
  assistantText: string;
  history: OrchestratedMessage[];
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

  try {
    const summaryPrompt = [
      "Update the running story memory for this game.",
      "Keep it concise but durable.",
      "Preserve: current scene, story facts, character relationships, goals, unresolved threads, and immediate next beat.",
      "Do not include filler, apologies, or meta commentary.",
      "Write plain text only. Aim for 6-10 short bullet points or short paragraphs.",
      "",
      `Previous memory:\n${storySummary || "(none)"}`,
      "",
      `Scene context:\n${options.sceneSummary || "(none)"}`,
      "",
      `Recent history:\n${options.history
        .slice(-12)
        .map((msg) => `${msg.from === "user" ? "User" : "Agent"}: ${msg.text}`)
        .join("\n")}`,
      "",
      `Latest user turn:\n${options.userText}`,
      "",
      `Latest assistant turn:\n${options.assistantText}`,
    ].join("\n");

    if (!connected) {
      const compact = [
        storySummary,
        options.sceneSummary,
        `Latest user turn: ${options.userText}`,
        `Latest assistant turn: ${options.assistantText}`,
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
        `Latest user turn: ${options.userText}`,
        `Latest assistant turn: ${options.assistantText}`,
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
      `Latest user turn: ${options.userText}`,
      `Latest assistant turn: ${options.assistantText}`,
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
