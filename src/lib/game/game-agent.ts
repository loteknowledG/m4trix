import type { Dispatch, SetStateAction } from "react";
import { normalizePlayerMode, type PlayerMode } from "@/lib/player-mode";

import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import type { OrchestratedMessage } from "@/lib/agents/types";
import { stripHistoryMessageText } from "@/lib/agents/providers";
import type { GameCharacterContext } from "@/lib/game/game-context";

export type GameAgentRequestBody = Record<string, unknown>;

type StreamAgentReplyArgs = {
  requestBody: GameAgentRequestBody;
  pendingId: string;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry?: OrchestratedMessage;
  trimmed: string;
  currentSceneSummary: string;
  appendBaseText?: string;
  onChunk: (messageId: string, text: string) => void;
  onFinalize: (pendingId: string, finalId: string, text: string) => void;
  onDebugResponse: (message: CustomChatMessage) => void;
  onHistoryUpdate: (nextHistory: OrchestratedMessage[]) => void;
  onMomentReset: () => void;
  refreshStorySummary: (args: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
    playerMode?: PlayerMode;
  }) => void | Promise<void>;
};

type DemoReplyArgs = {
  trimmed: string;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry?: OrchestratedMessage;
  assignedNpc: GameCharacterContext;
  assignedPlayer: GameCharacterContext;
  appendBaseText?: string;
  appendToMessageId?: string;
  setChatMessages: Dispatch<SetStateAction<CustomChatMessage[]>>;
  setStoryHistory: Dispatch<SetStateAction<OrchestratedMessage[]>>;
  setMomentSelectionMode: Dispatch<SetStateAction<"auto" | "manual">>;
  refreshStorySummary: (args: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
    playerMode?: PlayerMode;
  }) => void | Promise<void>;
  buildSceneSummary: (npc: GameCharacterContext, player: GameCharacterContext) => string;
};

type ConnectedTurnArgs = {
  pendingId: string;
  requestBody: GameAgentRequestBody;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry?: OrchestratedMessage;
  trimmed: string;
  currentSceneSummary: string;
  appendBaseText?: string;
  appendToMessageId?: string;
  setChatMessages: Dispatch<SetStateAction<CustomChatMessage[]>>;
  setStoryHistory: Dispatch<SetStateAction<OrchestratedMessage[]>>;
  setMomentSelectionMode: Dispatch<SetStateAction<"auto" | "manual">>;
  setDebugData: Dispatch<
    SetStateAction<
      | {
          request: any;
          response: any;
          prompt: string;
        }
      | null
    >
  >;
  refreshStorySummary: (args: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
    playerMode?: PlayerMode;
  }) => void | Promise<void>;
};

export function updateStreamingMessage(
  messages: CustomChatMessage[],
  messageId: string,
  text: string,
) {
  return messages.map((message) => (message.id === messageId ? { ...message, text } : message));
}

export function finalizeStreamingMessage(
  messages: CustomChatMessage[],
  messageId: string,
  finalId: string,
  text: string,
) {
  return messages.map((message) =>
    message.id === messageId ? { ...message, id: finalId, text } : message,
  );
}

function joinContinuationText(baseText: string, nextText: string) {
  const base = baseText ?? "";
  const next = nextText ?? "";
  if (!base) return next;
  if (!next) return base;
  if (/[\s\n]$/.test(base) || /^[\s\n]/.test(next)) return `${base}${next}`;
  return `${base} ${next}`;
}

export function buildGameAgentRequest(params: {
  trimmed: string;
  connectionModel: string | null;
  activeProvider: string;
  steer?: string;
  zenKey?: string;
  googleKey?: string;
  hfKey?: string;
  nvidiaKey?: string;
  lmstudioUrl: string;
  storyContext: string;
  storyHistory: OrchestratedMessage[];
  currentNpc: GameCharacterContext;
  currentPlayer: GameCharacterContext;
  playerMode?: PlayerMode;
  npcKnowsPlayer?: boolean;
  currentTurnNpcKnewPlayer?: boolean;
}) {
  const {
    trimmed,
    connectionModel,
    activeProvider,
    steer,
    zenKey,
    googleKey,
    hfKey,
    nvidiaKey,
    lmstudioUrl,
    storyContext,
    storyHistory,
    currentNpc,
    currentPlayer,
    playerMode,
    npcKnowsPlayer,
    currentTurnNpcKnewPlayer,
  } = params;

  const MAX_STORY_CONTEXT_CHARS = 6000;
  const MAX_HISTORY_MESSAGES = 10;
  const MAX_HISTORY_TEXT_CHARS = 3000;
  const clampText = (value: string, maxChars: number) => {
    const text = (value || "").trim();
    if (text.length <= maxChars) return text;
    return text.slice(0, maxChars);
  };

  const compactHistory = (storyHistory || [])
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry) => ({
      ...entry,
      text: clampText(String(entry.text || ""), MAX_HISTORY_TEXT_CHARS),
    }));

  const requestBody: GameAgentRequestBody = {
    prompt: trimmed,
    model: connectionModel,
    zenApiKey: zenKey,
    googleApiKey: googleKey,
    hfApiKey: hfKey,
    nvidiaApiKey: nvidiaKey,
    provider: activeProvider,
    stream: true,
  };

  if (storyContext) requestBody.story = clampText(storyContext, MAX_STORY_CONTEXT_CHARS);
  if (steer?.trim()) requestBody.steer = steer.trim();
  if (compactHistory.length > 0) requestBody.history = compactHistory;
  if (activeProvider === "lmstudio") requestBody.lmstudioUrl = lmstudioUrl;
  if (currentNpc) {
    requestBody.character = {
      id: currentNpc.id,
      name: currentNpc.name,
      description: currentNpc.description,
      appearance: currentNpc.appearance ?? "",
    };
  }
  if (currentPlayer) {
    requestBody.player = {
      id: currentPlayer.id,
      name: currentPlayer.name,
      description: currentPlayer.description,
      appearance: currentPlayer.appearance ?? "",
    };
  }
  if (playerMode) requestBody.playerMode = playerMode;
  if (typeof npcKnowsPlayer === 'boolean') requestBody.npcKnowsPlayer = npcKnowsPlayer;
  if (typeof currentTurnNpcKnewPlayer === 'boolean') {
    requestBody.currentTurnNpcKnewPlayer = currentTurnNpcKnewPlayer;
  }

  return requestBody;
}

async function streamAgentReply({
  requestBody,
  pendingId,
  storyHistory,
  userHistoryEntry,
  trimmed,
  currentSceneSummary,
  appendBaseText,
  onChunk,
  onFinalize,
  onDebugResponse,
  onHistoryUpdate,
  onMomentReset,
  refreshStorySummary,
}: StreamAgentReplyArgs) {
  const extractAssistantText = (raw: string) => {
    const text = (raw || "").trim();
    if (!text) return "";
    try {
      const parsed = JSON.parse(text) as any;
      if (typeof parsed?.text === "string" && parsed.text.trim()) return parsed.text.trim();
      if (Array.isArray(parsed?.messages) && typeof parsed.messages[0]?.text === "string") {
        return parsed.messages[0].text.trim();
      }
      if (typeof parsed?.response?.text === "string" && parsed.response.text.trim()) {
        return parsed.response.text.trim();
      }
      const choiceContent = parsed?.choices?.[0]?.message?.content;
      if (typeof choiceContent === "string" && choiceContent.trim()) {
        return choiceContent.trim();
      }
      if (Array.isArray(choiceContent)) {
        const joined = choiceContent
          .map((part: unknown) => {
            if (!part) return "";
            if (typeof part === "string") return part;
            if (typeof part === "object" && part && "text" in part) {
              const maybeText = (part as { text?: unknown }).text;
              return typeof maybeText === "string" ? maybeText : "";
            }
            return "";
          })
          .filter(Boolean)
          .join(" ")
          .trim();
        if (joined) return joined;
      }
      return text;
    } catch {
      return text;
    }
  };

  const readNonStreamText = async () => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...requestBody, stream: false }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(errorText || "Failed to get non-stream response from LLM");
    }
    const raw = await res.text().catch(() => "");
    return extractAssistantText(raw);
  };

  const npcName =
    requestBody.character &&
    typeof requestBody.character === "object" &&
    typeof (requestBody.character as { name?: string }).name === "string"
      ? (requestBody.character as { name: string }).name
      : "NPC";
  const playerInfo =
    requestBody.player && typeof requestBody.player === "object"
      ? (requestBody.player as { name?: string })
      : undefined;
  const knowsPlayerForStrip =
    typeof requestBody.currentTurnNpcKnewPlayer === "boolean"
      ? requestBody.currentTurnNpcKnewPlayer
      : requestBody.npcKnowsPlayer !== false;

  const readStreamedText = async () => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(errorText || "Failed to get response from LLM");
    }

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let streamedText = "";

    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const decoded = decoder.decode(value, { stream: true });
        if (!decoded) continue;
        streamedText += decoded;
        onChunk(
          pendingId,
          stripHistoryMessageText(streamedText, npcName, playerInfo, knowsPlayerForStrip),
        );
      }
    }

    return streamedText;
  };

  let streamedText = await readStreamedText();
  if (!appendBaseText && !streamedText.trim()) {
    streamedText = await readStreamedText();
  }

  let assistantText = extractAssistantText(streamedText);
  if (!appendBaseText && !assistantText) {
    assistantText = await readNonStreamText();
  }

  assistantText = stripHistoryMessageText(assistantText, npcName, playerInfo, knowsPlayerForStrip);

  const finalMessageId = `agent-${Date.now()}`;
  const finalMessage: CustomChatMessage = {
    id: finalMessageId,
    from: "agent",
    text: assistantText,
  };

  const finalText = appendBaseText
    ? joinContinuationText(appendBaseText, assistantText || "")
    : assistantText || "The response ended early. Try again.";
  if (appendBaseText) {
    finalMessage.text = finalText;
  }
  onFinalize(pendingId, finalMessageId, finalText);
  onDebugResponse(finalMessage);

  const assistantHistoryEntries = [
    {
      id: finalMessage.id,
      from: "agent" as const,
      text: appendBaseText ? finalText : finalMessage.text,
    },
  ];
  const nextHistorySnapshot = userHistoryEntry
    ? [...storyHistory, userHistoryEntry, ...assistantHistoryEntries].slice(-20)
    : (() => {
        const next = [...storyHistory];
        const lastAssistantIndex = [...next].map((entry) => entry.from).lastIndexOf("agent");
        if (lastAssistantIndex >= 0) {
          next[lastAssistantIndex] = {
            ...next[lastAssistantIndex],
            text: finalText,
          };
          return next.slice(-20);
        }
        return [...next, ...assistantHistoryEntries].slice(-20);
      })();
  onHistoryUpdate(nextHistorySnapshot);
  onMomentReset();
  await refreshStorySummary({
    sceneSummary: currentSceneSummary,
    userText: trimmed,
    assistantText: finalText,
    history: nextHistorySnapshot,
    playerMode: userHistoryEntry?.playerMode ?? normalizePlayerMode(requestBody.playerMode as string | null | undefined),
  });
}

export function queueDemoReply({
  trimmed,
  storyHistory,
  userHistoryEntry,
  assignedNpc,
  assignedPlayer,
  appendBaseText,
  appendToMessageId,
  setChatMessages,
  setStoryHistory,
  setMomentSelectionMode,
  refreshStorySummary,
  buildSceneSummary,
}: DemoReplyArgs) {
  setTimeout(() => {
    const npcName = assignedNpc?.name?.trim() || "NPC";
    const demoText = appendBaseText
      ? joinContinuationText(
          appendBaseText,
          "(Connect an AI provider in Connections to continue this scene.)",
        )
      : `(${npcName} is offline — connect an AI provider in Connections to get in-character replies.)`;
    const botMessage: CustomChatMessage = {
      id: appendToMessageId || `bot-${Date.now()}`,
      from: "agent",
      text: demoText,
    };
    setChatMessages((messages) =>
      appendToMessageId
        ? messages.map((message) =>
            message.id === appendToMessageId ? { ...message, text: botMessage.text } : message,
          )
        : [...messages, botMessage],
    );
    const assistantHistoryEntry: OrchestratedMessage = {
      id: botMessage.id,
      from: "agent",
      text: botMessage.text,
    };
    const nextHistorySnapshot = userHistoryEntry
      ? [...storyHistory, userHistoryEntry, assistantHistoryEntry].slice(-20)
      : (() => {
          const next = [...storyHistory];
          const lastAssistantIndex = [...next].map((entry) => entry.from).lastIndexOf("agent");
          if (lastAssistantIndex >= 0) {
            next[lastAssistantIndex] = {
              ...next[lastAssistantIndex],
              text: botMessage.text,
            };
            return next.slice(-20);
          }
          return [...next, assistantHistoryEntry].slice(-20);
        })();
    setStoryHistory(nextHistorySnapshot);
    setMomentSelectionMode("auto");
    void refreshStorySummary({
      sceneSummary: buildSceneSummary(assignedNpc, assignedPlayer),
      userText: trimmed,
      assistantText: botMessage.text,
      history: nextHistorySnapshot,
      playerMode: userHistoryEntry?.playerMode,
    });
  }, 450);
}

export async function runConnectedChatTurn({
  pendingId,
  requestBody,
  storyHistory,
  userHistoryEntry,
  trimmed,
  currentSceneSummary,
  appendBaseText,
  appendToMessageId,
  setChatMessages,
  setStoryHistory,
  setMomentSelectionMode,
  setDebugData,
  refreshStorySummary,
}: ConnectedTurnArgs) {
  if (!appendToMessageId) {
    setChatMessages((messages) => [
      ...messages,
      {
        id: pendingId,
        from: "agent",
        text: "Working on that request...",
      },
    ]);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  setDebugData({ request: requestBody, response: null, prompt: trimmed });
  await streamAgentReply({
    requestBody,
    pendingId,
    storyHistory,
    userHistoryEntry,
    trimmed,
    currentSceneSummary,
    appendBaseText,
    onChunk: (messageId, text) =>
      setChatMessages((messages) =>
        updateStreamingMessage(
          messages,
          appendToMessageId || messageId,
          appendBaseText ? joinContinuationText(appendBaseText, text) : text,
        ),
      ),
    onFinalize: (messageId, finalId, text) =>
      setChatMessages((messages) =>
        appendToMessageId
          ? messages.map((message) =>
              message.id === appendToMessageId ? { ...message, text } : message,
            )
          : finalizeStreamingMessage(messages, messageId, finalId, text),
      ),
    onDebugResponse: (finalMessage) =>
      setDebugData((prev) =>
        prev
          ? {
              ...prev,
              response: {
                streamed: true,
                messages: [finalMessage],
              },
            }
          : null,
      ),
    onHistoryUpdate: (nextHistorySnapshot) => setStoryHistory(nextHistorySnapshot),
    onMomentReset: () => setMomentSelectionMode("auto"),
    refreshStorySummary,
  });
}
