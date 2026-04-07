"use client";

import { get } from "idb-keyval";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FaBug } from "react-icons/fa";
import { FaArrowUp } from "react-icons/fa6";
import { MdExitToApp } from "react-icons/md";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { type CustomChatMessage, CustomChatWindow } from "@/components/ai/custom-chat-window";
import ErrorBoundary from "@/components/error-boundary";
import { GameCard } from "@/components/game-card";
import { FullscreenDialog } from "@/components/ui/full-screen-dialog";
import { Pressable } from "@/components/ui/pressable";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  CONNECTION_STORAGE_KEYS,
  getConnectionItem,
  setConnectionItem,
} from "@/lib/connection-storage";
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from "@/lib/lmstudio";

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

  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([
    {
      id: "welcome",
      from: "agent",
      text: "Welcome! This is a chat panel. Ask a question or say something to start the conversation.",
    },
  ]);
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

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const userMessage: CustomChatMessage = {
      id: `user-${Date.now()}`,
      from: "user",
      text: trimmed,
    };

    setChatMessages((messages) => [...messages, userMessage]);
    setChatInput("");

    if (!connected) {
      // Fallback local response when no LLM connection is configured
      setTimeout(() => {
        const botMessage: CustomChatMessage = {
          id: `bot-${Date.now()}`,
          from: "agent",
          text: `You said: "${trimmed}". This is a demo response.`,
        };
        setChatMessages((messages) => [...messages, botMessage]);
      }, 450);
      return;
    }

    const pendingId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setChatMessages((messages) => [
      ...messages,
      {
        id: pendingId,
        from: "agent",
        text: `Working on that request${connectionModel ? ` with ${connectionModel}` : ""}...`,
      },
    ]);

    try {
      let currentNpc = assignedNpc;
      let currentPlayer = assignedPlayer;
      let currentStoryDescription = "";
      if (id) {
        try {
          const stories = (await get<any[]>("stories")) || [];
          const storyMeta = stories.find((s) => s.id === id);
          currentStoryDescription = typeof storyMeta?.description === "string" ? storyMeta.description : "";
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

          setAssignedNpc(currentNpc);
          setAssignedPlayer(currentPlayer);
        } catch {
          /* ignore */
        }
      }

      // ===> THE REQUEST TO /api/agents IS MADE RIGHT HERE <===
      const zenKey = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey) ?? undefined;
      const googleKey = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey) ?? undefined;
      const hfKey = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey) ?? undefined;
      const nvidiaKey = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey) ?? undefined;

      // Patch: Always use the active provider and lmstudioUrl from session storage
      const activeProvider =
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
        getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider) ||
        "zen";
      const lmstudioUrl = normalizeLmstudioUrl(
        getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl) || DEFAULT_LMSTUDIO_URL,
      );
      const requestBody: any = {
        prompt: trimmed,
        model: connectionModel,
        zenApiKey: zenKey,
        googleApiKey: googleKey,
        hfApiKey: hfKey,
        nvidiaApiKey: nvidiaKey,
        provider: activeProvider,
      };
      if (currentStoryDescription.trim()) {
        requestBody.story = currentStoryDescription;
      }
      if (activeProvider === "lmstudio") {
        requestBody.lmstudioUrl = lmstudioUrl;
      }
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

      setDebugData({ request: requestBody, response: null, prompt: trimmed });

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.messages)) {
        throw new Error(data?.error || "Failed to get response from LLM");
      }

      setDebugData((prev) => (prev ? { ...prev, response: data } : null));

      setChatMessages((messages) => messages.filter((m) => m.id !== pendingId));

      const botMessages: CustomChatMessage[] = data.messages.map((m: any, idx: number) => ({
        id: m.id || `agent-${Date.now()}-${idx}`,
        from: "agent",
        text: typeof m.text === "string" ? m.text : String(m.text ?? ""),
      }));

      setChatMessages((messages) => [...messages, ...botMessages]);
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

        // Determine which moment to show: title moment if set, else first moment
        let previewMoment = null;
        if (storyObj && storyObj.titleMomentId && Array.isArray(momentsArr)) {
          previewMoment = momentsArr.find((m: any) => m.id === storyObj.titleMomentId) || null;
        }
        if (!previewMoment && momentsArr.length > 0) {
          previewMoment = momentsArr[0];
        }
        setGameData(storyObj);
        const src = previewMoment?.src || previewMoment?.url || previewMoment?.image || null;
        setPreviewSrc(typeof src === "string" ? src : undefined);

        // The story object in IndexedDB often doesn’t include a title,
        // so fall back to the stories metadata list (used by the carousel).
        let resolvedTitle = storyObj?.title ?? "";
        try {
          const stories = (await get<any[]>("stories")) || [];
          const storyMeta = stories.find((s) => s.id === id);
          if (!resolvedTitle) {
            resolvedTitle = storyMeta?.title ?? "";
          }
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
        } catch {
          /* ignore */
        }

        setTitle(resolvedTitle || `Game ${id}`);
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
                defaultSize="50%"
                className="border-r border-slate-700/40"
                data-testid="game-sidebar-panel"
              >
                <div className="flex h-full flex-col space-y-4 p-4">
                  <div className="text-sm text-muted-foreground">{title}</div>
                  <div className="flex flex-1 items-stretch justify-end">
                    <GameCard
                      id={id ?? "unknown"}
                      title={gameData?.title ?? title}
                      subtitle={
                        gameData?.subtitle ??
                        gameData?.description ??
                        (id ? `Game ID: ${id}` : "No game selected")
                      }
                      previewSrc={previewSrc}
                      fullHeight
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel
                defaultSize="50%"
                minSize={0.234}
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
