"use client";

import { get, set } from "idb-keyval";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaBug } from "react-icons/fa";
import { FaArrowUp } from "react-icons/fa6";
import { MdExitToApp } from "react-icons/md";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { type CustomChatMessage, CustomChatWindow } from "@/components/ai/custom-chat-window";
import ErrorBoundary from "@/components/error-boundary";
import { GameCard } from "@/components/game-card";
import { FullscreenDialog } from "@/components/ui/full-screen-dialog";
import { Pressable } from "@/components/ui/pressable";
import { CarouselNavButton } from "@/components/ui/carousel";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  CONNECTION_STORAGE_KEYS,
  getConnectionItem,
  setConnectionItem,
} from "@/lib/connection-storage";
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from "@/lib/lmstudio";
import type { Agent, OrchestratedMessage } from "@/lib/agents/types";

const normalizeMomentText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
};

const storyTextForPrompt = (value: string) => {
  const raw = typeof value === "string" ? value : "";
  if (!raw.trim()) return "";
  if (typeof document === "undefined") {
    return raw.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }
  const container = document.createElement("div");
  container.innerHTML = raw;
  return (container.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
};

const getMomentSearchText = (moment: any) => {
  const pieces = [
    moment?.name,
    moment?.title,
    moment?.description,
    moment?.text,
    moment?.caption,
    Array.isArray(moment?.tags) ? moment.tags.join(" ") : "",
  ];
  return normalizeMomentText(pieces.filter(Boolean).join(" "));
};

const scoreMomentForStory = (moment: any, contextText: string, titleMomentId?: string | null) => {
  const normalizedContext = normalizeMomentText(contextText);
  if (!normalizedContext) return 0;

  let score = 0;
  const tags = Array.isArray(moment?.tags) ? moment.tags : [];

  for (const rawTag of tags) {
    const tag = normalizeMomentText(rawTag);
    if (!tag) continue;
    if (normalizedContext.includes(tag)) {
      score += 6;
      continue;
    }

    const tagWords = tag.split(/\s+/).filter(Boolean);
    if (tagWords.length && tagWords.every((word) => normalizedContext.includes(word))) {
      score += 3;
      continue;
    }

    if (tagWords.some((word) => normalizedContext.includes(word))) {
      score += 1;
    }
  }

  const searchText = getMomentSearchText(moment);
  if (searchText && normalizedContext.includes(searchText)) {
    score += 2;
  }

  if (titleMomentId && moment?.id === titleMomentId) {
    score += 2;
  }

  return score;
};

const pickBestMomentIndex = (
  moments: any[],
  contextText: string,
  titleMomentId?: string | null,
) => {
  if (!moments.length) return 0;

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  moments.forEach((moment, index) => {
    const score = scoreMomentForStory(moment, contextText, titleMomentId);
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
};

type StreamAgentReplyArgs = {
  requestBody: Record<string, unknown>;
  pendingId: string;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry: OrchestratedMessage;
  trimmed: string;
  currentSceneSummary: string;
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

type GameCharacterContext = {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
} | null;

async function streamAgentReply({
  requestBody,
  pendingId,
  storyHistory,
  userHistoryEntry,
  trimmed,
  currentSceneSummary,
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

  onFinalize(pendingId, finalMessageId, assistantText);
  onDebugResponse(finalMessage);

  const assistantHistoryEntries = [
    {
      id: finalMessage.id,
      from: "agent" as const,
      text: finalMessage.text,
    },
  ];
  const nextHistorySnapshot = [...storyHistory, userHistoryEntry, ...assistantHistoryEntries].slice(-20);
  onHistoryUpdate(nextHistorySnapshot);
  onMomentReset();
  await refreshStorySummary({
    sceneSummary: currentSceneSummary,
    userText: trimmed,
    assistantText,
    history: nextHistorySnapshot,
  });
}

function buildGameAgentRequest(params: {
  trimmed: string;
  connectionModel: string | null;
  activeProvider: string;
  zenKey?: string;
  googleKey?: string;
  hfKey?: string;
  nvidiaKey?: string;
  lmstudioUrl: string;
  storyContext: string;
  storyHistory: OrchestratedMessage[];
  currentNpc: { id: string; name: string; description: string } | null;
  currentPlayer: { id: string; name: string; description: string } | null;
}) {
  const {
    trimmed,
    connectionModel,
    activeProvider,
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

  const requestBody: Record<string, unknown> = {
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
  if (storyHistory.length > 0) requestBody.history = storyHistory;
  if (activeProvider === "lmstudio") requestBody.lmstudioUrl = lmstudioUrl;
  if (currentNpc) {
    requestBody.character = {
      id: currentNpc.id,
      name: currentNpc.name,
      description: currentNpc.description,
    };
  }
  if (currentPlayer) {
    requestBody.coordinatorAgent = {
      id: currentPlayer.id,
      name: currentPlayer.name,
      description: currentPlayer.description,
    };
  }

  return requestBody;
}

function queueDemoReply(params: {
  trimmed: string;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry: OrchestratedMessage;
  assignedNpc: GameCharacterContext;
  assignedPlayer: GameCharacterContext;
  setChatMessages: (value: CustomChatMessage[] | ((messages: CustomChatMessage[]) => CustomChatMessage[])) => void;
  setStoryHistory: (value: OrchestratedMessage[] | ((messages: OrchestratedMessage[]) => OrchestratedMessage[])) => void;
  setMomentSelectionMode: (value: "auto" | "manual") => void;
  refreshStorySummary: (args: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
  }) => void | Promise<void>;
  buildSceneSummary: (npc: any, player: any) => string;
}) {
  const {
    trimmed,
    storyHistory,
    userHistoryEntry,
    assignedNpc,
    assignedPlayer,
    setChatMessages,
    setStoryHistory,
    setMomentSelectionMode,
    refreshStorySummary,
    buildSceneSummary,
  } = params;

  setTimeout(() => {
    const botMessage: CustomChatMessage = {
      id: `bot-${Date.now()}`,
      from: "agent",
      text: `You said: "${trimmed}". This is a demo response.`,
    };
    setChatMessages((messages) => [...messages, botMessage]);
    const assistantHistoryEntry: OrchestratedMessage = {
      id: botMessage.id,
      from: "agent",
      text: botMessage.text,
    };
    const nextHistorySnapshot = [...storyHistory, userHistoryEntry, assistantHistoryEntry].slice(-20);
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

const updateStreamingMessage = (
  messages: CustomChatMessage[],
  messageId: string,
  text: string,
) => messages.map((message) => (message.id === messageId ? { ...message, text } : message));

const finalizeStreamingMessage = (
  messages: CustomChatMessage[],
  messageId: string,
  finalId: string,
  text: string,
) =>
  messages.map((message) =>
    message.id === messageId ? { ...message, id: finalId, text } : message,
  );

async function runConnectedChatTurn(params: {
  pendingId: string;
  trimmed: string;
  connectionModel: string | null;
  storySummary: string;
  storyHistory: OrchestratedMessage[];
  userHistoryEntry: OrchestratedMessage;
  resolveGameAgentContext: () => Promise<{
    currentNpc: GameCharacterContext;
    currentPlayer: GameCharacterContext;
    currentStoryDescription: string;
    currentSceneSummary: string;
  }>;
  refreshStorySummary: (args: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
  }) => void | Promise<void>;
  setChatMessages: React.Dispatch<React.SetStateAction<CustomChatMessage[]>>;
  setStoryHistory: React.Dispatch<React.SetStateAction<OrchestratedMessage[]>>;
  setMomentSelectionMode: React.Dispatch<React.SetStateAction<"auto" | "manual">>;
  setDebugData: React.Dispatch<
    React.SetStateAction<
      | {
          request: any;
          response: any;
          prompt: string;
        }
      | null
    >
  >;
}) {
  const {
    pendingId,
    trimmed,
    connectionModel,
    storySummary,
    storyHistory,
    userHistoryEntry,
    resolveGameAgentContext,
    refreshStorySummary,
    setChatMessages,
    setStoryHistory,
    setMomentSelectionMode,
    setDebugData,
  } = params;
  setChatMessages((messages) => [
    ...messages,
    {
      id: pendingId,
      from: "agent",
      text: `Working on that request${connectionModel ? ` with ${connectionModel}` : ""}...`,
    },
  ]);
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const { currentNpc, currentPlayer, currentStoryDescription, currentSceneSummary } =
    await resolveGameAgentContext();

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
  const storyContext = [storySummary, currentSceneSummary, currentStoryDescription]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  const requestBody = buildGameAgentRequest({
    trimmed,
    connectionModel,
    activeProvider,
    zenKey,
    googleKey,
    hfKey,
    nvidiaKey,
    lmstudioUrl,
    storyContext,
    storyHistory,
    currentNpc,
    currentPlayer,
  });

  setDebugData({ request: requestBody, response: null, prompt: trimmed });
  await streamAgentReply({
    requestBody,
    pendingId,
    storyHistory,
    userHistoryEntry,
    trimmed,
    currentSceneSummary,
    onChunk: (messageId, text) =>
      setChatMessages((messages) => updateStreamingMessage(messages, messageId, text)),
    onFinalize: (messageId, finalId, text) =>
      setChatMessages((messages) => finalizeStreamingMessage(messages, messageId, finalId, text)),
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

export default function GamePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [gameData, setGameData] = useState<any>(null);
  const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [title, setTitle] = useState("Game");
  const [storyMoments, setStoryMoments] = useState<any[]>([]);
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [storyDescription, setStoryDescription] = useState("");
  const [storyHistory, setStoryHistory] = useState<OrchestratedMessage[]>([]);
  const [storySummary, setStorySummary] = useState("");
  const [storyMetaLoaded, setStoryMetaLoaded] = useState(false);
  const [momentSelectionMode, setMomentSelectionMode] = useState<"auto" | "manual">("auto");
  const buildOpeningDetails = (
    description: string,
    npc: typeof assignedNpc,
    player: typeof assignedPlayer,
  ) => {
    const details = [
      npc ? `NPC: ${npc.name}` : "",
      player ? `Player: ${player.name}` : "",
    ].filter(Boolean);
    return {
      text: description.trim(),
      details,
    };
  };
  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [connected, setConnected] = useState(false);
  const [connectionModel, setConnectionModel] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel);
    }
    return null;
  });
  const [lmstudioHealth, setLmstudioHealth] = useState<{
    state: "idle" | "checking" | "healthy" | "error";
    message?: string;
    modelCount?: number;
  }>({ state: "idle" });

  const [assignedNpc, setAssignedNpc] = useState<{
    id: string;
    name: string;
    description: string;
    avatarUrl?: string;
  } | null>(null);
  const [assignedPlayer, setAssignedPlayer] = useState<{
    id: string;
    name: string;
    description: string;
    avatarUrl?: string;
  } | null>(null);

  const [debugOpen, setDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<{
    request: any;
    response: any;
    prompt: string;
  } | null>(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("game-debug-data");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          /* ignore */
        }
      }
    }
    return null;
  });
  const currentMoment = storyMoments[currentMomentIndex] ?? null;
  const hasMoments = storyMoments.length > 0;
  const gameHistoryKey = id ? `game-history:${id}` : null;
  const gameSummaryKey = id ? `game-summary:${id}` : null;
  const summarizeInFlightRef = useRef(false);

  const goToPreviousMoment = () => {
    if (!hasMoments) return;
    setMomentSelectionMode("manual");
    setCurrentMomentIndex((current) => (current - 1 + storyMoments.length) % storyMoments.length);
  };

  const goToNextMoment = () => {
    if (!hasMoments) return;
    setMomentSelectionMode("manual");
    setCurrentMomentIndex((current) => (current + 1) % storyMoments.length);
  };

  useEffect(() => {
    const src = currentMoment?.src || currentMoment?.url || currentMoment?.image || null;
    setPreviewSrc(typeof src === "string" ? src : undefined);
  }, [currentMoment]);

  useEffect(() => {
    if (!storyMetaLoaded) return;
    if (!storyMoments.length) return;
    if (momentSelectionMode !== "auto") return;

    const contextText = [
      storyTextForPrompt(storyDescription),
      storySummary,
      title,
      assignedNpc ? `${assignedNpc.name} ${assignedNpc.description}` : "",
      assignedPlayer ? `${assignedPlayer.name} ${assignedPlayer.description}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const bestIndex = pickBestMomentIndex(storyMoments, contextText, gameData?.titleMomentId);
    setCurrentMomentIndex((current) => (current === bestIndex ? current : bestIndex));
  }, [
    storyMetaLoaded,
    storyMoments,
    storyDescription,
    storySummary,
    title,
    assignedNpc,
    assignedPlayer,
    momentSelectionMode,
    gameData?.titleMomentId,
  ]);

  useEffect(() => {
    if (!gameHistoryKey) return;
    void set(gameHistoryKey, storyHistory);
  }, [gameHistoryKey, storyHistory]);

  useEffect(() => {
    let mounted = true;
    if (!gameSummaryKey) {
      setStorySummary("");
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const stored = await get<string>(gameSummaryKey);
        if (!mounted) return;
        setStorySummary(typeof stored === "string" ? stored : "");
      } catch {
        if (mounted) setStorySummary("");
      }
    })();

    return () => {
      mounted = false;
    };
  }, [gameSummaryKey]);

  useEffect(() => {
    if (!gameSummaryKey) return;
    void set(gameSummaryKey, storySummary);
  }, [gameSummaryKey, storySummary]);

  const buildSceneSummary = (npc: typeof assignedNpc, player: typeof assignedPlayer) => {
    if (!id) return "";
    const sceneParts = [
      title ? `Story title: ${title}` : "",
      currentMoment?.name ? `Current moment: ${currentMoment.name}` : "",
      npc ? `NPC: ${npc.name}${npc.description ? ` - ${npc.description}` : ""}` : "",
      player ? `Player avatar: ${player.name}${player.description ? ` - ${player.description}` : ""}` : "",
    ].filter(Boolean);
    return sceneParts.join("\n");
  };

  const refreshStorySummary = async (options: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
  }) => {
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
  };

  const resolveGameAgentContext = async () => {
    let currentNpc = assignedNpc;
    let currentPlayer = assignedPlayer;
    let currentStoryDescription = "";
    let currentSceneSummary = "";

    if (id) {
      try {
        const stories = (await get<any[]>("stories")) || [];
        const storyMeta = stories.find((s) => s.id === id);
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
              avatarUrl: npc.avatarUrl,
            }
          : null;
        currentPlayer = player
          ? {
              id: player.id,
              name: player.name ?? "",
              description: player.description ?? "",
              avatarUrl: player.avatarUrl,
            }
          : null;

        currentSceneSummary = buildSceneSummary(currentNpc, currentPlayer);

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
  };

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    const pendingId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const userMessage: CustomChatMessage = {
      id: `user-${Date.now()}`,
      from: "user",
      text: trimmed,
    };

    setChatMessages((messages) => [...messages, userMessage]);
    const userHistoryEntry: OrchestratedMessage = {
      id: userMessage.id,
      from: "user",
      text: trimmed,
    };
    setStoryHistory((messages) => [
      ...messages,
      userHistoryEntry,
    ].slice(-20));
    setChatInput("");

    if (!connected) {
      queueDemoReply({
        trimmed,
        storyHistory,
        userHistoryEntry,
        assignedNpc,
        assignedPlayer,
        setChatMessages: (updater) => setChatMessages(updater),
        setStoryHistory: (updater) => setStoryHistory(updater),
        setMomentSelectionMode: (value) => setMomentSelectionMode(value),
        refreshStorySummary,
        buildSceneSummary,
      });
      return;
    }

    try {
      await runConnectedChatTurn({
        pendingId,
        trimmed,
        connectionModel,
        storySummary,
        storyHistory,
        userHistoryEntry,
        resolveGameAgentContext,
        refreshStorySummary,
        setChatMessages,
        setStoryHistory,
        setMomentSelectionMode,
        setDebugData,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : typeof err === "string" ? err : "Unknown error";
      console.warn("[game][api-agents][error]", message);
      setChatMessages((messages) =>
        messages.some((m) => m.id === pendingId)
          ? messages.map((m) => (m.id === pendingId ? { ...m, text: `Error: ${message}` } : m))
          : [
              ...messages,
              {
                id: `agent-${Date.now()}`,
                from: "agent",
                text: `Error: ${message}`,
              },
            ],
      );
    }
  };

  useEffect(() => {
    // Re-open the fullscreen dialog whenever the game id changes.
    setDialogOpen(true);
  }, [id]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      const savedModel = getConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel);
      const model = getConnectionItem(CONNECTION_STORAGE_KEYS.activeModel) || savedModel;
      setConnectionModel(model);
      if (model) {
        setConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel, model);
      }

      const hasKey = [
        CONNECTION_STORAGE_KEYS.zenKey,
        CONNECTION_STORAGE_KEYS.googleKey,
        CONNECTION_STORAGE_KEYS.hfKey,
        CONNECTION_STORAGE_KEYS.nvidiaKey,
      ].some((key) => !!getConnectionItem(key));
      const lmstudioConnected = getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioConnected) === "1";
      const activeProvider =
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider);
      setConnected(hasKey || (lmstudioConnected && activeProvider === "lmstudio"));
    };

    update();

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ connected: boolean; model?: string }>).detail;
      if (!detail) return;
      setConnected(detail.connected);
      const model = detail.model ?? null;
      setConnectionModel(model);
      if (typeof window !== "undefined" && model) {
        setConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel, model);
      }
    };

    window.addEventListener("connections:update", handler as EventListener);
    return () => window.removeEventListener("connections:update", handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateConnectionState = () => {
      const savedModel = getConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel);
      const model = getConnectionItem(CONNECTION_STORAGE_KEYS.activeModel) || savedModel;
      const zen = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey);
      const google = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey);
      const hf = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey);
      const nvidia = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey);
      const lmstudioConnected = getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioConnected) === "1";
      const activeProvider =
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider);

      const isConnected = Boolean(
        zen?.trim() ||
          google?.trim() ||
          hf?.trim() ||
          nvidia?.trim() ||
          (lmstudioConnected && activeProvider === "lmstudio"),
      );

      setConnected(isConnected);
      const finalModel = isConnected && model ? model : null;
      setConnectionModel(finalModel);
      if (finalModel) {
        setConnectionItem(CONNECTION_STORAGE_KEYS.gameConnectionModel, finalModel);
      }
    };

    updateConnectionState();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === CONNECTION_STORAGE_KEYS.activeModel ||
        event.key === CONNECTION_STORAGE_KEYS.activeModelProvider ||
        event.key === CONNECTION_STORAGE_KEYS.zenKey ||
        event.key === CONNECTION_STORAGE_KEYS.googleKey ||
        event.key === CONNECTION_STORAGE_KEYS.hfKey ||
        event.key === CONNECTION_STORAGE_KEYS.nvidiaKey ||
        event.key === CONNECTION_STORAGE_KEYS.lmstudioConnected ||
        event.key === CONNECTION_STORAGE_KEYS.activeProvider ||
        event.key === CONNECTION_STORAGE_KEYS.gameConnectionModel
      ) {
        updateConnectionState();
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const activeProvider =
      getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
      getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider);
    if (activeProvider !== "lmstudio") {
      setLmstudioHealth({ state: "idle" });
      return;
    }

    const lmstudioUrl = normalizeLmstudioUrl(
      getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl) || DEFAULT_LMSTUDIO_URL,
    );
    setLmstudioHealth({ state: "checking" });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    fetch(`/api/lmstudio/health?lmstudio_url=${encodeURIComponent(lmstudioUrl)}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          ok?: boolean;
          error?: string;
          modelCount?: number;
        } | null;
        if (!res.ok || !payload?.ok) {
          setLmstudioHealth({
            state: "error",
            message: payload?.error || "LM Studio is not reachable",
          });
          return;
        }
        setLmstudioHealth({
          state: "healthy",
          modelCount: payload.modelCount ?? 0,
        });
      })
      .catch((err) => {
        setLmstudioHealth({
          state: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      })
      .finally(() => {
        window.clearTimeout(timeout);
      });
  }, [connected, connectionModel]);

  useEffect(() => {
    // Prevent accidental back navigation while the game modal is open.
    if (!dialogOpen) return;

    window.history.pushState(null, "", window.location.href);

    const handlePop = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, [dialogOpen]);

  useEffect(() => {
    // Optional gamepad support: opening quit prompt with Start.
    let raf = 0;
    let lastPressed = false;

    const poll = () => {
      const gamepads = navigator.getGamepads?.() ?? [];
      const gp = gamepads[0];
      if (gp) {
        const pressed = gp.buttons?.[9]?.pressed;
        if (pressed && !lastPressed) {
          setConfirmQuit(true);
        }
        lastPressed = !!pressed;
      }
      raf = requestAnimationFrame(poll);
    };

    raf = requestAnimationFrame(poll);

    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    // Escape opens quit prompt (or closes it if already open).
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();

      if (confirmQuit) {
        setConfirmQuit(false);
      } else if (dialogOpen) {
        setConfirmQuit(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmQuit, dialogOpen]);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    // Default title while we load data.
    setTitle(`Game ${id}`);
    setStoryMetaLoaded(false);
    setChatMessages([]);

    (async () => {
      try {
        const stored = (await get<any>(`story:${id}`)) || null;
        if (!mounted) return;

        const storyObj = stored;
        const momentsArr = Array.isArray(storyObj)
          ? storyObj
          : storyObj && Array.isArray(storyObj.items)
            ? storyObj.items
            : [];
        setStoryMoments(momentsArr);
        setGameData(storyObj);
        const initialMomentIndex = (() => {
          if (!momentsArr.length) return 0;
          if (storyObj && storyObj.titleMomentId) {
            const titleMomentIndex = momentsArr.findIndex((m: any) => m.id === storyObj.titleMomentId);
            return titleMomentIndex >= 0 ? titleMomentIndex : 0;
          }
          return 0;
        })();
        setCurrentMomentIndex(initialMomentIndex);

        // The story object in IndexedDB often doesn’t include a title,
        // so fall back to the stories metadata list (used by the carousel).
        let resolvedTitle = storyObj?.title ?? "";
        try {
          const stories = (await get<any[]>("stories")) || [];
          const storyMeta = stories.find((s) => s.id === id);
          if (!resolvedTitle) {
            resolvedTitle = storyMeta?.title ?? "";
          }
          const resolvedDescription =
            typeof storyMeta?.description === "string" && storyMeta.description.trim()
              ? storyMeta.description
              : typeof storyObj?.description === "string"
                ? storyObj.description
                : "";
          setStoryDescription(resolvedDescription);
          const characters = (await get<any[]>("PLAYGROUND_AGENTS")) || [];
          const npc = storyMeta?.npcId ? characters.find((c) => c.id === storyMeta.npcId) : null;
          const player = storyMeta?.playerId
            ? characters.find((c) => c.id === storyMeta.playerId)
            : null;

          setAssignedNpc(
            npc
              ? {
                  id: npc.id,
                  name: npc.name ?? "",
                  description: npc.description ?? "",
                  avatarUrl: npc.avatarUrl,
                }
              : null,
          );

          setAssignedPlayer(
            player
              ? {
                  id: player.id,
                  name: player.name ?? "",
                  description: player.description ?? "",
                  avatarUrl: player.avatarUrl,
                }
              : null,
          );

          setStoryMetaLoaded(true);
          setTitle(resolvedTitle || `Game ${id}`);

          const storedHistory = (await get<OrchestratedMessage[]>(`game-history:${id}`)) || [];
          if (!mounted) return;

          const nextHistory = Array.isArray(storedHistory) ? storedHistory : [];
          setStoryHistory(nextHistory);

          const openingText =
            resolvedDescription.trim() ||
            (typeof storyObj?.description === "string" ? storyObj.description.trim() : "") ||
            resolvedTitle.trim() ||
            `Game ${id}`;
          const opening = buildOpeningDetails(
            openingText,
            npc
              ? {
                  id: npc.id,
                  name: npc.name ?? "",
                  description: npc.description ?? "",
                  avatarUrl: npc.avatarUrl,
                }
              : null,
            player
              ? {
                  id: player.id,
                  name: player.name ?? "",
                  description: player.description ?? "",
                  avatarUrl: player.avatarUrl,
                }
              : null,
          );
          setChatMessages([
            {
              id: "story-opening",
              from: "agent",
              text: opening.text,
              details: opening.details,
            },
            ...nextHistory.map((entry) => ({
              id: entry.id,
              from: entry.from,
              text: entry.text,
            })),
          ]);
        } catch {
          /* ignore */
        }
      } catch (e) {
        console.error("Failed to load game data", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  return (
    <ContentLayout title={title} titleMarquee={false} navLeft={null}>
      <FullscreenDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        preventClose
        trigger={null}
        title=""
        description=""
        contentClassName="p-0"
      >
        <div className="relative h-full">
          <Pressable
            type="button"
            onClick={() => setConfirmQuit(true)}
            className="fixed bottom-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-black/30 hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Quit game"
          >
            <MdExitToApp className="h-5 w-5" />

            <span className="pointer-events-none absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-2 py-1 text-xs text-white opacity-0 shadow transition-opacity duration-150 group-hover:opacity-100">
              Quit game
            </span>
          </Pressable>

          <Pressable
            type="button"
            onClick={() => setDebugOpen(true)}
            className="fixed bottom-4 left-16 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg shadow-black/30 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Debug"
          >
            <FaBug className="h-4 w-4" />
          </Pressable>

          <div className="relative h-full w-full">
            <ResizablePanelGroup
              orientation="horizontal"
              className="absolute inset-0 h-full w-full"
            >
              <ResizablePanel
                defaultSize="66%"
                className="border-r border-slate-700/40"
                data-testid="game-sidebar-panel"
              >
                <div className="relative h-full w-full overflow-hidden">
                    <GameCard
                      id={id ?? "unknown"}
                      title={currentMoment?.name || gameData?.title || title}
                      subtitle={
                        currentMoment?.name ||
                        gameData?.subtitle ||
                        gameData?.description ||
                        (id ? `Game ID: ${id}` : "No game selected")
                      }
                      previewSrc={previewSrc}
                      previewFit="contain"
                      showFooter={false}
                      fullHeight
                      className="w-full h-full"
                    />
                    <div className="pointer-events-none absolute inset-0 top-[54%] -mt-6 z-10 flex items-center justify-between px-1">
                      <CarouselNavButton
                        type="button"
                        onClick={goToPreviousMoment}
                        disabled={!hasMoments}
                        aria-label="Previous moment"
                        title="Previous moment"
                        buttonClassName="bg-[#c90084]/80 text-white hover:bg-[#c90084]/90 hover:text-white"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </CarouselNavButton>
                      <CarouselNavButton
                        type="button"
                        onClick={goToNextMoment}
                        disabled={!hasMoments}
                        aria-label="Next moment"
                        title="Next moment"
                        buttonClassName="bg-[#c90084]/80 text-white hover:bg-[#c90084]/90 hover:text-white"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </CarouselNavButton>
                    </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize="34%"
                minSize={0.2}
                className="p-4 flex flex-col min-h-0 min-w-0 max-w-full"
                data-testid="game-chat-panel"
                style={{ flexShrink: 1 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">Chat</div>
                  <div className="text-xs text-muted-foreground">
                    {lmstudioHealth.state === "checking"
                      ? "Checking LM Studio..."
                      : lmstudioHealth.state === "healthy"
                        ? `LM Studio reachable${lmstudioHealth.modelCount !== undefined ? `, ${lmstudioHealth.modelCount} models` : ""}`
                        : lmstudioHealth.state === "error"
                          ? "LM Studio not reachable"
                          : "Talk with the assistant"}
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <CustomChatWindow
                    messages={chatMessages}
                    input={chatInput}
                    onInputChange={setChatInput}
                    onSend={sendChatMessage}
                    disabled={false}
                    connected={connected}
                    connectionModel={connectionModel}
                    sendIcon={<FaArrowUp className="h-4 w-4" />}
                    sendIconAriaLabel="Send message"
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>

          {confirmQuit ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 p-6">
              <div className="rounded-xl bg-slate-950 p-6 text-center shadow-xl">
                <div className="mb-4 text-lg font-semibold">Quit Game?</div>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => setConfirmQuit(false)}
                    className="rounded bg-slate-700 px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDialogOpen(false);
                      router.push("/games");
                    }}
                    className="rounded bg-red-600 px-4 py-2 text-sm text-white"
                  >
                    Quit
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </FullscreenDialog>

      <ErrorBoundary>
        <div className="p-6">
          {loading ? (
            <div className="text-center text-muted-foreground">Loading game…</div>
          ) : (
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">This is the game editor page.</div>
              <pre className="rounded bg-slate-950/40 p-4 text-xs overflow-auto">
                {JSON.stringify(gameData ?? { message: "No game data found yet" }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ErrorBoundary>

      {debugOpen && debugData && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setDebugOpen(false);
            }
          }}
        >
          <div
            className="max-h-[80vh] w-full max-w-4xl overflow-hidden rounded-xl bg-slate-900 border border-slate-700 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-700 p-4">
              <h3 className="text-lg font-semibold">Debug Info</h3>
              <button
                type="button"
                onClick={() => setDebugOpen(false)}
                className="rounded p-2 hover:bg-slate-800"
              >
                ✕
              </button>
            </div>
            <div className="flex max-h-[calc(80vh-60px)] flex-col gap-4 overflow-y-auto p-4">
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">User Prompt</h4>
                <pre className="rounded bg-slate-950 p-3 text-sm whitespace-pre-wrap">
                  {debugData.prompt}
                </pre>
              </div>
              {debugData.response?.debug?.runs?.[0] ? (
                <>
                  <div className="flex-shrink-0">
                    <h4 className="mb-2 text-sm font-medium text-slate-400">Developer Prompt</h4>
                    <pre className="rounded bg-slate-950 p-3 text-sm whitespace-pre-wrap">
                      {debugData.response.debug.runs[0].systemPrompt}
                    </pre>
                  </div>
                  <div className="flex-shrink-0">
                    <h4 className="mb-2 text-sm font-medium text-slate-400">Model Messages</h4>
                    <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs">
                      {JSON.stringify(debugData.response.debug.runs[0].messages, null, 2)}
                    </pre>
                  </div>
                </>
              ) : null}
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Request</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(debugData.request, null, 2)}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Story Memory</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {storySummary || "No story summary yet"}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Recent History</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {storyHistory.length
                    ? JSON.stringify(storyHistory, null, 2)
                    : "No recent history yet"}
                </pre>
              </div>
              <div className="flex-1 min-h-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Response</h4>
                <pre className="max-h-[40vh] overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {JSON.stringify(debugData.response, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </ContentLayout>
  );
}
