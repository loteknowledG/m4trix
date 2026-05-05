"use client";

import { get, set } from "idb-keyval";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaBug } from "react-icons/fa";
import { FaTags } from "react-icons/fa";
import { FaArrowUp } from "react-icons/fa6";
import { MdExitToApp } from "react-icons/md";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { type CustomChatMessage, CustomChatWindow } from "@/components/ai/custom-chat-window";
import { GrokImagePromptButton } from "@/components/grok-image-prompt-button";
import ErrorBoundary from "@/components/error-boundary";
import { GameCard } from "@/components/game-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { speakWithJennyVoice } from "@/lib/tts";
import type { OrchestratedMessage } from "@/lib/agents/types";
import {
  buildSceneSummary,
  resolveGameAgentContext,
  type GameCharacterContext,
} from "@/lib/game/game-context";
import { mapGameChatForGrokImage } from "@/lib/grok-image-game";
import {
  buildGameAgentRequest,
  queueDemoReply,
  runConnectedChatTurn,
} from "@/lib/game/game-agent";
import {
  getGameHistoryKey,
  getGameMomentKey,
  getGameSummaryKey,
  loadGameMoment,
  loadGameHistory,
  loadGameSummary,
  saveGameMoment,
  saveGameHistory,
  saveGameSummary,
} from "@/lib/game/game-storage";
import { refreshStorySummary as refreshGameStorySummary } from "@/lib/game/story-memory";
import {
  pickBestMomentIndex,
  pickBestMoment,
  storyTextForPrompt,
} from "@/lib/game/story-moments";

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const routeId = params?.id as string | undefined;
  const id = routeId === "new" ? searchParams?.get("game") || undefined : routeId;
  const router = useRouter();
  const [gameData, setGameData] = useState<any>(null);
  const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(true);
  /** Radix may call onOpenChange(false) during focus/portal churn; shell only closes via Quit. */
  const handleGameShellOpenChange = useCallback((next: boolean) => {
    if (!next) return;
    setDialogOpen(true);
  }, []);
  const historyPushedForOpenRef = useRef(false);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [title, setTitle] = useState("Game");
  const [storyMoments, setStoryMoments] = useState<any[]>([]);
  const [currentMomentIndex, setCurrentMomentIndex] = useState(0);
  const [storyDescription, setStoryDescription] = useState("");
  const [storyArc, setStoryArc] = useState<any>(null);
  const [storyArcCurrentStage, setStoryArcCurrentStage] = useState<number | null>(null);
  const [storyHistory, setStoryHistory] = useState<OrchestratedMessage[]>([]);
  const [storySummary, setStorySummary] = useState("");
  const [externalMemorySummary, setExternalMemorySummary] = useState("");
  const [storyMetaLoaded, setStoryMetaLoaded] = useState(false);
  const [momentSelectionMode, setMomentSelectionMode] = useState<"auto" | "manual">("auto");
  const [steerInstruction, setSteerInstruction] = useState("");
  const momentStateReadyRef = useRef(false);
  const buildOpeningDetails = (
    description: string,
    npc: typeof assignedNpc,
    player: typeof assignedPlayer,
  ) => {
    const details = [
      npc ? `NPC: ${npc.name}` : "",
      npc?.appearance ? `NPC appearance: ${npc.appearance}` : "",
      player ? `Player: ${player.name}` : "",
      player?.appearance ? `Player appearance: ${player.appearance}` : "",
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
    appearance?: string;
    avatarUrl?: string;
  } | null>(null);
  const [assignedPlayer, setAssignedPlayer] = useState<{
    id: string;
    name: string;
    description: string;
    appearance?: string;
    avatarUrl?: string;
  } | null>(null);

  const [debugOpen, setDebugOpen] = useState(false);
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [momentTags, setMomentTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [allTags, setAllTags] = useState<string[]>([]);
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
  const storyArcStages = Array.isArray(storyArc?.stages) ? storyArc.stages : [];
  const resolvedArcStageNumber =
    typeof storyArcCurrentStage === "number" && Number.isFinite(storyArcCurrentStage)
      ? storyArcCurrentStage
      : storyArcStages.length > 0
        ? Number(storyArcStages[0]?.stageNumber ?? 1)
        : null;
  const resolvedArcStage =
    resolvedArcStageNumber == null
      ? null
      : storyArcStages.find((stage: any) => Number(stage?.stageNumber) === resolvedArcStageNumber) ||
        null;
  const tagSuggestions = useMemo(() => {
    const q = tagInput.trim().toLowerCase();
    if (!q) return [];
    return allTags
      .filter((tag) => tag.toLowerCase().includes(q))
      .filter((tag) => !momentTags.includes(tag))
      .slice(0, 8);
  }, [allTags, momentTags, tagInput]);

  const grokStoryText = useMemo(
    () => [storyTextForPrompt(storyDescription), storySummary.trim()].filter(Boolean).join("\n\n"),
    [storyDescription, storySummary],
  );

  const grokSceneContext = useMemo(
    () =>
      buildSceneSummary({
        title,
        currentMomentName: currentMoment?.name ?? "",
        npc: assignedNpc,
        player: assignedPlayer,
      }),
    [title, currentMoment?.name, assignedNpc, assignedPlayer],
  );

  const grokChatMapping = useMemo(
    () => mapGameChatForGrokImage(chatMessages, assignedNpc, assignedPlayer),
    [chatMessages, assignedNpc, assignedPlayer],
  );
  const gameHistoryKey = getGameHistoryKey(id);
  const gameSummaryKey = getGameSummaryKey(id);
  const gameMomentKey = getGameMomentKey(id);
  const summarizeInFlightRef = useRef(false);
  const hasSpokenOpeningRef = useRef<string | null>(null);

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

  // Moment selection and saved story state
  useEffect(() => {
    const src = currentMoment?.src || currentMoment?.url || currentMoment?.image || null;
    setPreviewSrc(typeof src === "string" ? src : undefined);
  }, [currentMoment]);

  useEffect(() => {
    if (!gameMomentKey) return;
    if (!momentStateReadyRef.current) return;
    void saveGameMoment(gameMomentKey, {
      index: currentMomentIndex,
      mode: momentSelectionMode,
      momentId: currentMoment?.id ?? null,
    });
  }, [gameMomentKey, currentMomentIndex, momentSelectionMode, currentMoment?.id]);

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

    const { index: bestIndex, score: bestScore } = pickBestMoment(
      storyMoments,
      contextText,
      gameData?.titleMomentId,
    );
    if (bestScore <= 0) return;
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
    void saveGameHistory(gameHistoryKey, storyHistory);
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
        const stored = await loadGameSummary(gameSummaryKey);
        if (!mounted) return;
        setStorySummary(stored);
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
    void saveGameSummary(gameSummaryKey, storySummary);
  }, [gameSummaryKey, storySummary]);

  useEffect(() => {
    let mounted = true;
    const loadExternalMemory = async () => {
      try {
        const response = await fetch("/api/samus-memory?limit=12", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json().catch(() => null)) as
          | { ok?: boolean; summary?: string }
          | null;
        if (!mounted || !data?.ok || !data.summary) return;
        setExternalMemorySummary(data.summary.slice(0, 6000));
      } catch {
        // optional integration; keep game flow working even when memory source is unavailable
      }
    };
    void loadExternalMemory();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!id) return;
    if (loading) return;
    if (hasSpokenOpeningRef.current === id) return;

    const spokenText =
      storyDescription.trim() ||
      (typeof gameData?.description === "string" ? gameData.description.trim() : "") ||
      title.trim();
    if (!spokenText) return;

    const trySpeak = async () => {
      const ok = await speakWithJennyVoice(spokenText);
      if (ok) {
        hasSpokenOpeningRef.current = id;
      }
      return ok;
    };

    const onFirstInteraction = () => {
      void trySpeak();
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };

    void trySpeak().then((ok) => {
      if (!ok) {
        window.addEventListener("pointerdown", onFirstInteraction, { once: true });
        window.addEventListener("keydown", onFirstInteraction, { once: true });
      }
    });

    return () => {
      window.removeEventListener("pointerdown", onFirstInteraction);
      window.removeEventListener("keydown", onFirstInteraction);
    };
  }, [id, loading, storyDescription, gameData?.description, title]);

  const refreshStorySummary = async (options: {
    sceneSummary: string;
    userText: string;
    assistantText: string;
    history: OrchestratedMessage[];
  }) =>
    refreshGameStorySummary({
      gameSummaryKey,
      storySummary,
      connected,
      connectionModel,
      options,
      summarizeInFlightRef,
      setStorySummary,
      setMomentSelectionMode,
    });

  // User send flow
  const sendGamePrompt = async (
    trimmed: string,
    options?: {
      showUserMessage?: boolean;
      appendToMessageId?: string;
      appendBaseText?: string;
    },
  ) => {
    const showUserMessage = options?.showUserMessage ?? true;
    const appendToMessageId = options?.appendToMessageId;
    const appendBaseText = options?.appendBaseText;
    const currentSteerInstruction = steerInstruction.trim();
    const pendingId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const userMessage = showUserMessage
      ? {
          id: `user-${Date.now()}`,
          from: "user" as const,
          text: trimmed,
        }
      : null;

    if (userMessage) {
      setChatMessages((messages) => [...messages, userMessage]);
    }
    const userHistoryEntry: OrchestratedMessage | undefined = userMessage
      ? {
          id: userMessage.id,
          from: "user",
          text: trimmed,
        }
      : undefined;
    if (userHistoryEntry) {
      setStoryHistory((messages) => [
        ...messages,
        userHistoryEntry,
      ].slice(-20));
    }
    setChatInput("");
    if (currentSteerInstruction) {
      setSteerInstruction("");
    }

    if (!connected) {
      queueDemoReply({
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
        buildSceneSummary: (npc, player) =>
          buildSceneSummary({
            title,
            currentMomentName: currentMoment?.name ?? "",
            npc,
            player,
          }),
      });
      return;
    }

    try {
      const { currentNpc, currentPlayer, currentStoryDescription, currentSceneSummary } =
        await resolveGameAgentContext({
          storyId: id,
          assignedNpc,
          assignedPlayer,
          setAssignedNpc,
          setAssignedPlayer,
          buildSceneSummaryFn: (npc, player) =>
            buildSceneSummary({
              title,
              currentMomentName: currentMoment?.name ?? "",
              npc,
              player,
            }),
        });

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
      const storyContext = [
        storySummary,
        currentSceneSummary,
        currentStoryDescription,
        externalMemorySummary ? `External memory context:\n${externalMemorySummary}` : "",
      ]
        .filter(Boolean)
        .join("\n\n")
        .trim();
      const requestBody = buildGameAgentRequest({
        trimmed,
        connectionModel,
        activeProvider,
        steer: currentSteerInstruction,
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

      if (steerInstruction.trim()) {
        setSteerInstruction("");
      }

      await runConnectedChatTurn({
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

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;
    await sendGamePrompt(trimmed);
  };

  const handleEditChatMessage = (messageId: string, nextText: string) => {
    setChatMessages((messages) =>
      messages.map((message) =>
        message.id === messageId ? { ...message, text: nextText } : message,
      ),
    );

    setStoryHistory((history) => {
      const nextHistory = history.map((message) =>
        message.id === messageId ? { ...message, text: nextText } : message,
      );

      const lastUserEntry = [...nextHistory]
        .reverse()
        .find((message) => message.from === "user");

      void refreshStorySummary({
        sceneSummary: buildSceneSummary({
          title,
          currentMomentName: currentMoment?.name ?? "",
          npc: assignedNpc,
          player: assignedPlayer,
        }),
        userText: lastUserEntry?.text ?? "",
        assistantText: nextText,
        history: nextHistory,
      });

      return nextHistory;
    });
  };

  const handleMessageEdited = (messageId: string, nextText: string) => {
    const editedMessage = chatMessages.find((message) => message.id === messageId);
    if (!editedMessage || editedMessage.from !== "agent") return;
    if (typeof window === "undefined") return;

    const text = nextText.trim();
    if (!text) return;

    void speakWithJennyVoice(text);
  };

  const handleSteerChatMessage = (messageId: string, nextText: string) => {
    if (messageId === "__clear__") {
      setSteerInstruction("");
      return;
    }
    setSteerInstruction(nextText);
  };

  const handleContinueChatMessage = async () => {
    const lastAssistantMessage = [...chatMessages]
      .reverse()
      .find((message) => message.from === "agent" && message.id !== "story-opening");
    if (!lastAssistantMessage) return;

    await sendGamePrompt(
      "Continue from where you left off. Do not repeat yourself; continue the previous response exactly where it stopped.",
      {
        showUserMessage: false,
        appendToMessageId: lastAssistantMessage.id,
        appendBaseText: lastAssistantMessage.text,
      },
    );
  };

  const loadCurrentMomentTags = useCallback(async () => {
    if (!currentMoment?.id) {
      setMomentTags([]);
      return;
    }
    try {
      const stored = await get<any>(`overlay:text:${currentMoment.id}`);
      const loaded = Array.isArray(stored?.tags) ? stored.tags : [];
      setMomentTags(loaded.filter((tag: unknown) => typeof tag === "string" && tag.trim()));
    } catch {
      setMomentTags([]);
    }
  }, [currentMoment?.id]);

  const loadAllTags = useCallback(async () => {
    try {
      const stored = await get<any>("overlay:tags");
      setAllTags(Array.isArray(stored) ? stored.filter((tag) => typeof tag === "string") : []);
    } catch {
      setAllTags([]);
    }
  }, []);

  const saveCurrentMomentTags = useCallback(
    async (nextTags: string[]) => {
      if (!currentMoment?.id) return;
      const cleaned = Array.from(new Set(nextTags.map((tag) => tag.trim()).filter(Boolean)));
      try {
        const key = `overlay:text:${currentMoment.id}`;
        const stored = await get<any>(key);
        const base = stored && typeof stored === "object" ? stored : {};
        await set(key, { ...base, tags: cleaned });
        const merged = Array.from(new Set([...allTags, ...cleaned]));
        await set("overlay:tags", merged);
        setAllTags(merged);
        setMomentTags(cleaned);
      } catch (err) {
        console.warn("[game][tags] failed to save tags", err);
      }
    },
    [allTags, currentMoment?.id],
  );

  useEffect(() => {
    // Re-open the fullscreen dialog whenever the game id changes.
    setDialogOpen(true);
  }, [id]);

  useEffect(() => {
    if (!tagDialogOpen) return;
    void loadCurrentMomentTags();
    void loadAllTags();
  }, [tagDialogOpen, loadCurrentMomentTags, loadAllTags]);

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
    if (!dialogOpen) {
      historyPushedForOpenRef.current = false;
      return;
    }

    // One push per open session avoids history/router churn that can fight Radix focus.
    if (!historyPushedForOpenRef.current) {
      window.history.pushState(null, "", window.location.href);
      historyPushedForOpenRef.current = true;
    }

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
    momentStateReadyRef.current = false;
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
          const resolvedArc = storyMeta?.storyArc ?? storyObj?.storyArc ?? null;
          setStoryArc(resolvedArc);

          const resolveCurrentArcStage = () => {
            const fromMeta = storyMeta?.storyArcCurrentStage;
            if (typeof fromMeta === "number" && Number.isFinite(fromMeta)) return fromMeta;
            const fromObj = storyObj?.storyArcCurrentStage;
            if (typeof fromObj === "number" && Number.isFinite(fromObj)) return fromObj;
            const arcState = storyMeta?.storyArcState ?? storyObj?.storyArcState;
            if (arcState && typeof arcState === "object") {
              const mainArcId =
                typeof (arcState as any).mainArcId === "string" ? (arcState as any).mainArcId : null;
              const map =
                (arcState as any).currentStageByArcId &&
                typeof (arcState as any).currentStageByArcId === "object"
                  ? (arcState as any).currentStageByArcId
                  : null;
              if (mainArcId && map && typeof map[mainArcId] === "number") {
                return Number(map[mainArcId]);
              }
            }
            return null;
          };

          setStoryArcCurrentStage(resolveCurrentArcStage());
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
                  appearance: typeof storyMeta?.npcAppearance === "string" ? storyMeta.npcAppearance : "",
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
                  appearance:
                    typeof storyMeta?.playerAppearance === "string" ? storyMeta.playerAppearance : "",
                  avatarUrl: player.avatarUrl,
                }
              : null,
          );

          const storedMomentState = await loadGameMoment(gameMomentKey);
          if (!mounted) return;
          const initialMomentIndex = (() => {
            if (!momentsArr.length) return 0;
            if (storedMomentState?.momentId) {
              const savedMomentIndex = momentsArr.findIndex(
                (m: any) => m.id === storedMomentState.momentId,
              );
              if (savedMomentIndex >= 0) return savedMomentIndex;
            }
            if (
              typeof storedMomentState?.index === "number" &&
              storedMomentState.index >= 0 &&
              storedMomentState.index < momentsArr.length
            ) {
              return storedMomentState.index;
            }
            if (storyObj && storyObj.titleMomentId) {
              const titleMomentIndex = momentsArr.findIndex((m: any) => m.id === storyObj.titleMomentId);
              return titleMomentIndex >= 0 ? titleMomentIndex : 0;
            }
            return 0;
          })();
          setCurrentMomentIndex(initialMomentIndex);
          setMomentSelectionMode(storedMomentState?.mode === "manual" ? "manual" : "auto");

          setStoryMetaLoaded(true);
          momentStateReadyRef.current = true;
          setTitle(resolvedTitle || `Game ${id}`);

          const storedHistory = await loadGameHistory(gameHistoryKey);
          if (!mounted) return;

          const nextHistory = storedHistory;
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
        onOpenChange={handleGameShellOpenChange}
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

          <Pressable
            type="button"
            onClick={() => setTagDialogOpen(true)}
            className="fixed bottom-4 left-28 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-fuchsia-600 text-white shadow-lg shadow-black/30 hover:bg-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Tag current moment"
            disabled={!currentMoment}
          >
            <FaTags className="h-4 w-4" />
          </Pressable>

          <div className="relative h-full w-full">
            <ResizablePanelGroup
              orientation="horizontal"
              className="absolute inset-0 h-full w-full"
            >
              <ResizablePanel
                defaultSize="55%"
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
                defaultSize="45%"
                minSize={0.2}
                className="p-4 flex flex-col min-h-0 min-w-0 max-w-full"
                data-testid="game-chat-panel"
                style={{ flexShrink: 1 }}
              >
                <div className="mb-3 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center">
                  <div className="inline-flex max-w-full min-w-0 items-center justify-center rounded-full border border-zinc-700/80 bg-zinc-900/70 px-3 py-1 text-sm font-medium text-zinc-100 shadow-sm">
                    <span className="mr-2 h-2 w-2 shrink-0 rounded-full bg-fuchsia-500 shadow-[0_0_12px_rgba(217,70,239,0.85)] animate-pulse" />
                    <span className="truncate">{title}</span>
                  </div>
                  <div className="flex justify-center sm:justify-end sm:pl-2">
                    <GrokImagePromptButton
                      agents={grokChatMapping.agents}
                      className="h-8 border-zinc-600 bg-zinc-900/80 text-xs text-zinc-100 hover:bg-zinc-800"
                      focusAgentId={grokChatMapping.focusAgentId}
                      messages={grokChatMapping.messages}
                      prompterAgent={grokChatMapping.prompterAgent}
                      sceneContext={grokSceneContext}
                      story={grokStoryText}
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <CustomChatWindow
                    messages={chatMessages}
                    input={chatInput}
                    onInputChange={setChatInput}
                    onSend={sendChatMessage}
                    onEditMessage={handleEditChatMessage}
                    onMessageEdited={handleMessageEdited}
                    onSteerMessage={handleSteerChatMessage}
                    onContinueMessage={handleContinueChatMessage}
                    steerInstruction={steerInstruction}
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
                <h4 className="mb-2 text-sm font-medium text-slate-400">Steer Note</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {debugData.request?.steer
                    ? String(debugData.request.steer)
                    : steerInstruction.trim()
                      ? steerInstruction.trim()
                      : "No steer note set"}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Current Moment</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {currentMoment
                    ? `ID: ${currentMoment.id}\n${currentMoment.name ? `Name: ${currentMoment.name}` : ""}`
                    : "No moment selected"}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Story Memory</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {storySummary || "No story summary yet"}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Story Arc Stage</h4>
                <pre className="max-h-40 overflow-auto rounded bg-slate-950 p-3 text-xs whitespace-pre-wrap">
                  {storyArc
                    ? resolvedArcStage
                      ? `Stage ${resolvedArcStage.stageNumber}: ${resolvedArcStage.stageName}\n${resolvedArcStage.shortDescription || ""}`
                      : resolvedArcStageNumber != null
                        ? `Stage ${resolvedArcStageNumber} (no matching stage found in storyArc.stages)`
                        : "No current story arc stage set"
                    : "No story arc found"}
                </pre>
              </div>
              <div className="flex-shrink-0">
                <h4 className="mb-2 text-sm font-medium text-slate-400">Story Arc Values</h4>
                <pre className="max-h-60 overflow-auto rounded bg-slate-950 p-3 text-xs">
                  {storyArc ? JSON.stringify(storyArc, null, 2) : "No story arc found"}
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
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent
          className="z-[210] w-[min(92vw,520px)] max-h-[85vh] overflow-hidden border-slate-700 bg-slate-900 text-white"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Tag Current Moment</DialogTitle>
            <DialogDescription className="text-slate-300">
              {currentMoment
                ? currentMoment.name || currentMoment.id
                : "Select a moment first, then add tags."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 overflow-auto">
            <div className="flex items-center gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const nextTag = tagInput.trim();
                  if (!nextTag || !currentMoment) return;
                  if (!momentTags.includes(nextTag)) {
                    void saveCurrentMomentTags([...momentTags, nextTag]);
                  }
                  setTagInput("");
                }}
                className="flex-1 rounded border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-500"
                placeholder="Add tag (e.g. chapter.1)"
                disabled={!currentMoment}
              />
              <button
                type="button"
                onClick={() => {
                  const nextTag = tagInput.trim();
                  if (!nextTag || !currentMoment) return;
                  if (!momentTags.includes(nextTag)) {
                    void saveCurrentMomentTags([...momentTags, nextTag]);
                  }
                  setTagInput("");
                }}
                className="rounded bg-fuchsia-600 px-3 py-2 text-sm text-white hover:bg-fuchsia-500 disabled:opacity-50"
                disabled={!currentMoment}
              >
                Add
              </button>
            </div>

            {tagSuggestions.length > 0 ? (
              <div className="rounded border border-slate-700 bg-slate-950 p-2">
                <div className="mb-1 text-xs text-slate-400">Suggestions</div>
                <div className="flex flex-wrap gap-2">
                  {tagSuggestions.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (!currentMoment || momentTags.includes(tag)) return;
                        void saveCurrentMomentTags([...momentTags, tag]);
                        setTagInput("");
                      }}
                      className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-200 hover:bg-slate-800"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded border border-slate-700 bg-slate-950 p-3">
              <div className="mb-2 text-xs text-slate-400">Current tags</div>
              <div className="flex flex-wrap gap-2">
                {momentTags.length ? (
                  momentTags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!currentMoment) return;
                          void saveCurrentMomentTags(momentTags.filter((value) => value !== tag));
                        }}
                        className="text-slate-400 hover:text-white"
                        aria-label={`Remove ${tag}`}
                      >
                        ×
                      </button>
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No tags yet</span>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </ContentLayout>
  );
}
