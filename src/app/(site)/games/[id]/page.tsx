'use client';

import { useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { useParams, useRouter } from 'next/navigation';
import { MdExitToApp } from 'react-icons/md';
import { FaArrowUp } from 'react-icons/fa6';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import { FullscreenDialog } from '@/components/ui/full-screen-dialog';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { CustomChatWindow, type CustomChatMessage } from '@/components/ai/custom-chat-window';
import { GameCard } from '@/components/game-card';
import { Pressable } from '@/components/ui/pressable';
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from '@/lib/lmstudio';

export default function GamePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const router = useRouter();
  const [gameData, setGameData] = useState<any>(null);
  const [previewSrc, setPreviewSrc] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(true);
  const [confirmQuit, setConfirmQuit] = useState(false);
  const [title, setTitle] = useState('Game');

  const [chatMessages, setChatMessages] = useState<CustomChatMessage[]>([
    {
      id: 'welcome',
      from: 'agent',
      text: 'Welcome! This is a chat panel. Ask a question or say something to start the conversation.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [connected, setConnected] = useState(false);
  const [connectionModel, setConnectionModel] = useState<string | null>(null);
  const [lmstudioHealth, setLmstudioHealth] = useState<{
    state: 'idle' | 'checking' | 'healthy' | 'error';
    message?: string;
    modelCount?: number;
  }>({ state: 'idle' });

  const sendChatMessage = async () => {
    const trimmed = chatInput.trim();
    if (!trimmed) return;

    const userMessage: CustomChatMessage = {
      id: `user-${Date.now()}`,
      from: 'user',
      text: trimmed,
    };

    setChatMessages(messages => [...messages, userMessage]);
    setChatInput('');

    if (!connected) {
      // Fallback local response when no LLM connection is configured
      setTimeout(() => {
        const botMessage: CustomChatMessage = {
          id: `bot-${Date.now()}`,
          from: 'agent',
          text: `You said: "${trimmed}". This is a demo response.`,
        };
        setChatMessages(messages => [...messages, botMessage]);
      }, 450);
      return;
    }

    const pendingId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setChatMessages(messages => [
      ...messages,
      {
        id: pendingId,
        from: 'agent',
        text: `Working on that request${connectionModel ? ` with ${connectionModel}` : ''}...`,
      },
    ]);

    try {
      // ===> THE REQUEST TO /api/agents IS MADE RIGHT HERE <===
      const zenKey = window.sessionStorage.getItem('ZEN_API_KEY_SESSION') ?? undefined;
      const googleKey = window.sessionStorage.getItem('GOOGLE_API_KEY_SESSION') ?? undefined;
      const hfKey = window.sessionStorage.getItem('HF_API_KEY_SESSION') ?? undefined;
      const nvidiaKey = window.sessionStorage.getItem('NVIDIA_API_KEY_SESSION') ?? undefined;

      // Patch: Always use the active provider and lmstudioUrl from session storage
      const activeProvider = window.sessionStorage.getItem('ACTIVE_PROVIDER_SESSION') || 'zen';
      const lmstudioUrl = normalizeLmstudioUrl(
        window.sessionStorage.getItem('LMSTUDIO_URL_SESSION') || DEFAULT_LMSTUDIO_URL
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
      if (activeProvider === 'lmstudio') {
        requestBody.lmstudioUrl = lmstudioUrl;
      }
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data || !Array.isArray(data.messages)) {
        throw new Error(data?.error || 'Failed to get response from LLM');
      }

      setChatMessages(messages => messages.filter(m => m.id !== pendingId));

      const botMessages: CustomChatMessage[] = data.messages.map((m: any, idx: number) => ({
        id: m.id || `agent-${Date.now()}-${idx}`,
        from: 'agent',
        text: typeof m.text === 'string' ? m.text : String(m.text ?? ''),
      }));

      setChatMessages(messages => [...messages, ...botMessages]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[game][api-agents][error]', { message, err });
      setChatMessages(messages =>
        messages.some(m => m.id === pendingId)
          ? messages.map(m => (m.id === pendingId ? { ...m, text: `Error: ${message}` } : m))
          : [
              ...messages,
              {
                id: `agent-${Date.now()}`,
                from: 'agent',
                text: `Error: ${message}`,
              },
            ]
      );
    }
  };

  useEffect(() => {
    // Re-open the fullscreen dialog whenever the game id changes.
    setDialogOpen(true);
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      const model = window.sessionStorage.getItem('ACTIVE_MODEL_SESSION');
      setConnectionModel(model);

      const hasKey = [
        'ZEN_API_KEY_SESSION',
        'GOOGLE_API_KEY_SESSION',
        'HF_API_KEY_SESSION',
        'NVIDIA_API_KEY_SESSION',
      ].some(k => !!window.sessionStorage.getItem(k));
      const lmstudioConnected = window.sessionStorage.getItem('LMSTUDIO_CONNECTED') === '1';
      const activeProvider = window.sessionStorage.getItem('ACTIVE_PROVIDER_SESSION');
      setConnected(hasKey || (lmstudioConnected && activeProvider === 'lmstudio'));
    };

    update();

    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ connected: boolean; model?: string }>).detail;
      if (!detail) return;
      setConnected(detail.connected);
      setConnectionModel(detail.model ?? null);
    };

    window.addEventListener('connections:update', handler as EventListener);
    return () => window.removeEventListener('connections:update', handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateConnectionState = () => {
      const model = window.sessionStorage.getItem('ACTIVE_MODEL_SESSION');
      const zen = window.sessionStorage.getItem('ZEN_API_KEY_SESSION');
      const google = window.sessionStorage.getItem('GOOGLE_API_KEY_SESSION');
      const hf = window.sessionStorage.getItem('HF_API_KEY_SESSION');
      const nvidia = window.sessionStorage.getItem('NVIDIA_API_KEY_SESSION');
      const lmstudioConnected = window.sessionStorage.getItem('LMSTUDIO_CONNECTED') === '1';
      const activeProvider = window.sessionStorage.getItem('ACTIVE_PROVIDER_SESSION');

      const isConnected = Boolean(
        zen?.trim() ||
          google?.trim() ||
          hf?.trim() ||
          nvidia?.trim() ||
          (lmstudioConnected && activeProvider === 'lmstudio')
      );

      setConnected(isConnected);
      setConnectionModel(isConnected && model ? model : null);
    };

    updateConnectionState();

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key === 'ACTIVE_MODEL_SESSION' ||
        event.key === 'ZEN_API_KEY_SESSION' ||
        event.key === 'GOOGLE_API_KEY_SESSION' ||
        event.key === 'HF_API_KEY_SESSION' ||
        event.key === 'NVIDIA_API_KEY_SESSION' ||
        event.key === 'LMSTUDIO_CONNECTED' ||
        event.key === 'ACTIVE_PROVIDER_SESSION'
      ) {
        updateConnectionState();
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const activeProvider = window.sessionStorage.getItem('ACTIVE_PROVIDER_SESSION');
    if (activeProvider !== 'lmstudio') {
      setLmstudioHealth({ state: 'idle' });
      return;
    }

    const lmstudioUrl = normalizeLmstudioUrl(
      window.sessionStorage.getItem('LMSTUDIO_URL_SESSION') || DEFAULT_LMSTUDIO_URL
    );
    setLmstudioHealth({ state: 'checking' });

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);

    fetch(`/api/lmstudio/health?lmstudio_url=${encodeURIComponent(lmstudioUrl)}`, {
      signal: controller.signal,
    })
      .then(async res => {
        const payload = (await res.json().catch(() => null)) as
          | { ok?: boolean; error?: string; modelCount?: number }
          | null;
        if (!res.ok || !payload?.ok) {
          setLmstudioHealth({
            state: 'error',
            message: payload?.error || 'LM Studio is not reachable',
          });
          return;
        }
        setLmstudioHealth({
          state: 'healthy',
          modelCount: payload.modelCount ?? 0,
        });
      })
      .catch(err => {
        setLmstudioHealth({
          state: 'error',
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

    window.history.pushState(null, '', window.location.href);

    const handlePop = () => {
      window.history.pushState(null, '', window.location.href);
    };

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
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
      if (event.key !== 'Escape') return;
      event.preventDefault();

      if (confirmQuit) {
        setConfirmQuit(false);
      } else if (dialogOpen) {
        setConfirmQuit(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

        let storyObj = stored;
        let momentsArr = Array.isArray(storyObj)
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
        setPreviewSrc(typeof src === 'string' ? src : undefined);

        // The story object in IndexedDB often doesn’t include a title,
        // so fall back to the stories metadata list (used by the carousel).
        let resolvedTitle = storyObj?.title ?? '';
        if (!resolvedTitle) {
          try {
            const stories = (await get<any[]>('stories')) || [];
            resolvedTitle = stories.find(s => s.id === id)?.title ?? '';
          } catch {
            /* ignore */
          }
        }

        setTitle(resolvedTitle || `Game ${id}`);
      } catch (e) {
        console.error('Failed to load game data', e);
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
                      id={id ?? 'unknown'}
                      title={gameData?.title ?? title}
                      subtitle={
                        gameData?.subtitle ??
                        gameData?.description ??
                        (id ? `Game ID: ${id}` : 'No game selected')
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
                    {lmstudioHealth.state === 'checking'
                      ? 'Checking LM Studio...'
                      : lmstudioHealth.state === 'healthy'
                      ? `LM Studio reachable${lmstudioHealth.modelCount !== undefined ? `, ${lmstudioHealth.modelCount} models` : ''}`
                      : lmstudioHealth.state === 'error'
                      ? 'LM Studio not reachable'
                      : 'Talk with the assistant'}
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
                      router.push('/games');
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
                {JSON.stringify(gameData ?? { message: 'No game data found yet' }, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
