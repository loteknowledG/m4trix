import type { Dispatch, SetStateAction } from "react";

import type { CustomChatMessage } from "@/components/ai/custom-chat-window";
import type { OrchestratedMessage } from "@/lib/agents/types";
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
  } = params;

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

  if (storyContext) requestBody.story = storyContext;
  if (steer?.trim()) requestBody.steer = steer.trim();
  if (storyHistory.length > 0) requestBody.history = storyHistory;
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
    requestBody.coordinatorAgent = {
      id: currentPlayer.id,
      name: currentPlayer.name,
      description: currentPlayer.description,
      appearance: currentPlayer.appearance ?? "",
    };
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
      onChunk(pendingId, streamedText);
    }
  }

  const assistantText = streamedText.trim() || "No response returned.";
  const finalMessageId = `agent-${Date.now()}`;
  const finalMessage: CustomChatMessage = {
    id: finalMessageId,
    from: "agent",
    text: assistantText,
  };

  const finalText = appendBaseText ? joinContinuationText(appendBaseText, assistantText) : assistantText;
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
    const botMessage: CustomChatMessage = {
      id: appendToMessageId || `bot-${Date.now()}`,
      from: "agent",
      text: appendBaseText
        ? joinContinuationText(
            appendBaseText,
            `You said: "${trimmed}". This is a demo response.`,
          )
        : `You said: "${trimmed}". This is a demo response.`,
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
