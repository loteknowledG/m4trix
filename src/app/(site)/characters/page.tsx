'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { CustomChatWindow } from '@/components/ai/custom-chat-window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  Loader2,
  Plus,
  Send,
  Plug,
} from 'lucide-react';
import { VscDebugDisconnect } from 'react-icons/vsc';
import { PiPlugsConnectedLight } from 'react-icons/pi';
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAvatarCropper } from './use-avatar-cropper';
import { useCharacterChat } from './use-character-chat';
import { useCharacterConnections, type Provider } from './use-character-connections';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { AvatarCropDialog } from './avatar-crop-dialog';
import { CharactersSidebar } from './characters-sidebar';
import type { Agent, AgentId } from './types';

export default function CharactersPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [model, setModel] = useState<string>('');
  const [story, setStory] = useState('');
  const [activeProvider, setActiveProvider] = useState<Provider>('zen');

  // sidebar & persona refs to ensure user can scroll/focus the Global Story textarea
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const personaRef = useRef<HTMLDivElement | null>(null);
  const storyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  // Removed koboldUrl and koboldConnected
  const {
    activeProviderConnected,
    connectWithKey,
    connectionError,
    googleApiKey,
    googleConnected,
    hasKeyForActiveProvider,
    hfApiKey,
    hfConnected,
    isConnecting,
    lmstudioConnected,
    lmstudioUrl,
    modelOptions,
    nvidiaApiKey,
    nvidiaConnected,
    setGoogleApiKey,
    setGoogleConnected,
    setHfApiKey,
    setHfConnected,
    setModelOptions,
    setNvidiaConnected,
    setNvidiaApiKey,
    setZenApiKey,
    setZenConnected,
    zenApiKey,
    zenConnected,
  } = useCharacterConnections({
    model,
    setModel,
    activeProvider,
    setActiveProvider,
  });

  const [showBackstory, setShowBackstory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prompterAgent, setPrompterAgent] = useState<Agent | null>(null);
  // Prompter mode controls how the prompter should frame user input for agents
  const [prompterMode, setPrompterMode] = useState<'tell' | 'do' | 'think'>('tell');
  const [useCustomModel] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [dragOverId] = useState<string | null>(null);
  const hasLoaded = useRef(false);

  const {
    applyGifImmediately,
    clearCropper,
    crop,
    croppingImage,
    handleApplyCrop,
    handleAvatarUpload,
    isGif,
    isHoveringEdge,
    setCrop,
    setIsHoveringEdge,
  } = useAvatarCropper<Agent>({
    updateAgent,
    updatePrompterAgent,
  });

  const {
    error,
    isRunning,
    messages,
    prompt,
    restartConversation,
    runDemo,
    setPrompt,
  } = useCharacterChat({
    activeProvider,
    agents,
    googleApiKey,
    hfApiKey,
    lmstudioUrl,
    model,
    modelOptions,
    nvidiaApiKey,
    prompterAgent,
    prompterMode,
    setAgents,
    story,
    zenApiKey,
  });

  useEffect(() => {
    // Migrate from localStorage to idb-keyval if needed
    (async () => {
      let agentsVal = await idbGet('PLAYGROUND_AGENTS');
      if (!agentsVal && typeof window !== 'undefined') {
        const ls = window.localStorage.getItem('PLAYGROUND_AGENTS');
        if (ls) {
          try {
            agentsVal = JSON.parse(ls);
            await idbSet('PLAYGROUND_AGENTS', agentsVal);
            window.localStorage.removeItem('PLAYGROUND_AGENTS');
          } catch {}
        }
      }
      if (agentsVal) setAgents(agentsVal);

      let prompterVal = await idbGet('PLAYGROUND_PROMPTER');
      if (!prompterVal && typeof window !== 'undefined') {
        const ls = window.localStorage.getItem('PLAYGROUND_PROMPTER');
        if (ls) {
          try {
            prompterVal = JSON.parse(ls);
            await idbSet('PLAYGROUND_PROMPTER', prompterVal);
            window.localStorage.removeItem('PLAYGROUND_PROMPTER');
          } catch {}
        }
      }
      if (prompterVal) setPrompterAgent(prompterVal);

      // restore persisted prompter mode (tell | do | think)
      const prompterModeVal = await idbGet('PLAYGROUND_PROMPTER_MODE');
      if (prompterModeVal) setPrompterMode(prompterModeVal as 'tell' | 'do' | 'think');

      let storyVal = await idbGet('PLAYGROUND_STORY');
      if (!storyVal && typeof window !== 'undefined') {
        const ls = window.localStorage.getItem('PLAYGROUND_STORY');
        if (ls) {
          storyVal = ls;
          await idbSet('PLAYGROUND_STORY', storyVal);
          window.localStorage.removeItem('PLAYGROUND_STORY');
        }
      }
      if (storyVal) setStory(storyVal);

      hasLoaded.current = true;
    })();
  }, []);

  // if persona/story panel is opened, scroll it into view and focus the textarea
  useEffect(() => {
    if (!showBackstory) return;
    const container = sidebarScrollRef.current;
    const persona = personaRef.current;
    const textarea = storyTextareaRef.current;
    if (container && persona) {
      const top = persona.offsetTop - 12;
      container.scrollTo({ top, behavior: 'smooth' });
    }
    // focus the textarea after scrolling
    setTimeout(() => textarea?.focus(), 250);
  }, [showBackstory]);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLoaded.current) return;
    (async () => {
      await idbSet('PLAYGROUND_AGENTS', agents);
      if (prompterAgent) {
        await idbSet('PLAYGROUND_PROMPTER', prompterAgent);
      } else {
        await idbSet('PLAYGROUND_PROMPTER', null);
      }
      await idbSet('PLAYGROUND_STORY', story);
      // persist prompter UI mode
      await idbSet('PLAYGROUND_PROMPTER_MODE', prompterMode);
    })();
  }, [agents, prompterAgent, story, prompterMode]);

  const agentsById = useMemo(() => {
    return agents.reduce<Record<AgentId, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<AgentId, Agent>);
  }, [agents]);

  // Restart the current playground "situation": clears the conversation but PRESERVES backstory/prompter.
  const restartSituation = async () => {
    restartConversation();
    setShowBackstory(false);

    // ensure the prompt is focused after restart so typing works immediately
    setTimeout(() => {
      try {
        promptInputRef.current?.focus();
      } catch (e) {
        /* ignore */
      }
    }, 0);

    toast.success('Conversation restarted — backstory preserved');
  };

  // Stub for missing functions and utilities
  // These should be implemented or imported from utilities as needed
  const exportAgent = (..._args: any[]) => {
    toast.info('Export not implemented.');
  };
  const removeAgent = (..._args: any[]) => {
    toast.info('Remove not implemented.');
  };
  const addAgent = (..._args: any[]) => {
    toast.info('Add not implemented.');
  };
  const loadImportedMarkdown = async (..._args: any[]) => {
    toast.info('Import not implemented.');
    return null;
  };
  function updateAgent(
    id: AgentId,
    updates: Partial<Pick<Agent, 'name' | 'description' | 'avatarUrl' | 'avatarCrop'>>
  ) {
    setAgents(prev => prev.map(agent => (agent.id === id ? { ...agent, ...updates } : agent)));
  }

  function updatePrompterAgent(
    updates: Partial<Pick<Agent, 'name' | 'description' | 'avatarUrl' | 'avatarCrop'>>
  ) {
    if (prompterAgent) {
      setPrompterAgent({ ...prompterAgent, ...updates });
    }
  }
  /* chat mapping removed — using CustomChatWindow directly */
  return (
    <ContentLayout
      title="Characters"
      navRight={
        <Sheet>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <SheetTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className={cn(
                        'ml-2',
                        zenConnected || googleConnected || hfConnected || nvidiaConnected
                          ? 'text-emerald-400'
                          : 'text-muted-foreground'
                      )}
                      aria-label={
                        zenConnected || googleConnected || hfConnected || nvidiaConnected
                          ? 'Connections — connected'
                          : 'Connections — disconnected'
                      }
                    >
                      {zenConnected || googleConnected || hfConnected || nvidiaConnected ? (
                        <PiPlugsConnectedLight className="h-4 w-4" />
                      ) : (
                        <VscDebugDisconnect className="h-4 w-4" />
                      )}
                    </Button>
                  </SheetTrigger>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={6}>
                <p>
                  {zenConnected || googleConnected || hfConnected || nvidiaConnected
                    ? 'Connected'
                    : 'Disconnected'}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <SheetContent side="top" className="max-h-[60vh] overflow-auto">
            <SheetHeader>
              <SheetTitle>Connections</SheetTitle>
            </SheetHeader>

            {!zenConnected || !googleConnected || !hfConnected || !nvidiaConnected ? (
              <form
                className="grid gap-3 grid-cols-1 sm:grid-cols-4 mb-4"
                onSubmit={connectWithKey}
              >
                <div className="w-full sm:col-span-1 flex items-center gap-3">
                  <Select value={activeProvider} onValueChange={(v: any) => setActiveProvider(v)}>
                    <SelectTrigger className="h-8 w-full sm:w-auto sm:min-w-[120px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {!zenConnected && <SelectItem value="zen">OpenCode</SelectItem>}
                      {!googleConnected && <SelectItem value="google">Google Gemini</SelectItem>}
                      {!nvidiaConnected && <SelectItem value="nvidia">NVIDIA</SelectItem>}
                      {!hfConnected && <SelectItem value="huggingface">Hugging Face</SelectItem>}
                    </SelectContent>
                  </Select>

                  {/* compact badges — visible on sm+ and flush to the right of the provider select */}
                  {(zenConnected || googleConnected || hfConnected || nvidiaConnected) && (
                    <div className="hidden sm:inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-background/5 text-xs">
                      {zenConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">OpenCode</span>
                          <button
                            onClick={() => {
                              setZenConnected(false);
                              setZenApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {nvidiaConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">NVIDIA</span>
                          <button
                            onClick={() => {
                              setNvidiaConnected(false);
                              setNvidiaApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {googleConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">Gemini</span>
                          <button
                            onClick={() => {
                              setGoogleConnected(false);
                              setGoogleApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'google'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {hfConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">HF</span>
                          <button
                            onClick={() => {
                              setHfConnected(false);
                              setHfApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {(zenConnected || googleConnected || hfConnected || nvidiaConnected) && (
                  <div className="w-full sm:col-span-3 sm:col-start-2 sm:row-start-1 flex justify-end sm:hidden">
                    <div className="inline-flex items-center gap-2 px-2 py-1 rounded-md border bg-background/5 text-xs">
                      {zenConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">OpenCode</span>
                          <button
                            onClick={() => {
                              setZenConnected(false);
                              setZenApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {nvidiaConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">NVIDIA</span>
                          <button
                            onClick={() => {
                              setNvidiaConnected(false);
                              setNvidiaApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {googleConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">Gemini</span>
                          <button
                            onClick={() => {
                              setGoogleConnected(false);
                              setGoogleApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'google'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}

                      {hfConnected && (
                        <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-sm">
                          <div className="size-2 rounded-full bg-emerald-500" />
                          <span className="text-[10px] text-muted-foreground">HF</span>
                          <button
                            onClick={() => {
                              setHfConnected(false);
                              setHfApiKey('');
                              setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="w-full sm:col-span-3 sm:row-start-2 sm:col-start-1 flex items-start gap-3">
                  <Input
                    type="password"
                    disabled={activeProviderConnected}
                    className="h-8 w-full sm:w-auto sm:min-w-[220px] text-xs"
                    placeholder={
                      activeProviderConnected
                        ? 'Connected'
                        : `Paste ${
                            activeProvider === 'zen'
                              ? 'OpenCode'
                              : activeProvider === 'google'
                              ? 'Google'
                              : activeProvider === 'nvidia'
                              ? 'NVIDIA'
                              : 'Hugging Face'
                          } key`
                    }
                    value={
                      activeProvider === 'zen'
                        ? zenApiKey
                        : activeProvider === 'google'
                        ? googleApiKey
                        : activeProvider === 'nvidia'
                        ? nvidiaApiKey
                        : hfApiKey
                    }
                    onChange={e => {
                      const val = e.target.value;
                      if (activeProvider === 'zen') setZenApiKey(val);
                      else if (activeProvider === 'google') setGoogleApiKey(val);
                      else if (activeProvider === 'nvidia') setNvidiaApiKey(val);
                      else setHfApiKey(val);
                    }}
                  />

                  <Button
                    disabled={isConnecting || !hasKeyForActiveProvider || activeProviderConnected}
                    size="sm"
                    type="submit"
                    className="h-8 w-8 p-0 inline-flex items-center justify-center"
                    aria-label="Connect"
                    title={
                      activeProviderConnected
                        ? 'Provider connected — change provider to edit'
                        : 'Connect'
                    }
                  >
                    {isConnecting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plug className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="w-full sm:col-span-4 sm:row-start-3">
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger className="h-8 w-full sm:w-auto sm:min-w-[160px] text-xs">
                      <SelectValue placeholder="Select model" />
                    </SelectTrigger>
                    <SelectContent>
                      {modelOptions.length ? (
                        <>
                          {modelOptions.some(o => o.provider === 'zen') && (
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase">
                              OpenCode
                            </div>
                          )}
                          {modelOptions
                            .filter(o => o.provider === 'zen')
                            .map(option => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}

                          {modelOptions.some(o => o.provider === 'google') && (
                            <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                              Google Gemini
                            </div>
                          )}
                          {modelOptions
                            .filter(o => o.provider === 'google')
                            .map(option => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}

                          {modelOptions.some(o => o.provider === 'nvidia') && (
                            <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                              NVIDIA
                            </div>
                          )}
                          {modelOptions
                            .filter(o => o.provider === 'nvidia')
                            .map(option => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}

                          {modelOptions.some(o => o.provider === 'huggingface') && (
                            <div className="mt-2 px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase border-t">
                              Hugging Face
                            </div>
                          )}
                          {modelOptions
                            .filter(o => o.provider === 'huggingface')
                            .map(option => (
                              <SelectItem key={option.id} value={option.id}>
                                {option.label}
                              </SelectItem>
                            ))}
                        </>
                      ) : (
                        <SelectItem value="__no-models__" disabled>
                          No models available
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </form>
            ) : null}

            {(zenConnected || googleConnected || hfConnected || nvidiaConnected) && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    {useCustomModel ? (
                      <Input
                        className="h-8 w-full text-xs"
                        placeholder="e.g. zai-org/GLM-4.5"
                        value={customModelId}
                        onChange={e => {
                          setCustomModelId(e.target.value);
                          setModel(e.target.value);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            promptInputRef.current?.focus();
                            toast.success(`Broadcasting to ${customModelId}`);
                          }
                        }}
                      />
                    ) : null}
                  </div>
                </div>

                {!(!zenConnected || !googleConnected || !hfConnected || !nvidiaConnected) && (
                  <div className="flex items-center gap-3">
                    {zenConnected && (
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          OpenCode
                        </span>
                        <button
                          onClick={() => {
                            setZenConnected(false);
                            setZenApiKey('');
                            setModelOptions(m => m.filter(o => o.provider !== 'zen'));
                          }}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {googleConnected && (
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Gemini
                        </span>
                        <button
                          onClick={() => {
                            setGoogleConnected(false);
                            setGoogleApiKey('');
                            setModelOptions(m => m.filter(o => o.provider !== 'google'));
                          }}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {nvidiaConnected && (
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-medium text-muted-foreground">
                          NVIDIA
                        </span>
                        <button
                          onClick={() => {
                            setNvidiaConnected(false);
                            setNvidiaApiKey('');
                            setModelOptions(m => m.filter(o => o.provider !== 'nvidia'));
                          }}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    )}

                    {hfConnected && (
                      <div className="flex items-center gap-1.5">
                        <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[11px] font-medium text-muted-foreground">HF</span>
                        <button
                          onClick={() => {
                            setHfConnected(false);
                            setHfApiKey('');
                            setModelOptions(m => m.filter(o => o.provider !== 'huggingface'));
                          }}
                          className="text-[10px] text-muted-foreground hover:text-destructive"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </SheetContent>
        </Sheet>
      }
    >
      <div className="flex flex-col gap-6 p-6 min-h-0 -mt-4 overflow-hidden h-[calc(100vh_-_var(--app-header-height,_56px))]">
        {connectionError && (
          <div className="mx-auto w-full max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {connectionError}
          </div>
        )}

        <div
          className={`flex flex-1 overflow-visible transition-all duration-300 relative ${
            sidebarOpen ? 'gap-6' : 'gap-0'
          }`}
        >
          <div
            className={cn(
              'absolute z-50 top-1/2 -translate-y-1/2 transition-all duration-300',
              sidebarOpen ? 'right-[284px]' : '-right-4'
            )}
          >
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="h-8 w-8 rounded-full shadow-md bg-background hover:bg-accent"
            >
              <ChevronLeft
                className={cn(
                  'h-4 w-4 transition-transform duration-500',
                  !sidebarOpen ? 'rotate-0' : 'rotate-180'
                )}
              />
            </Button>
          </div>
          <section className="relative flex flex-1 min-h-0 flex-col rounded-xl border bg-background/40 overflow-hidden h-full">
            <div className="flex flex-col flex-1 min-h-0 h-full">
              <CustomChatWindow
                messages={messages.map(m => {
                  const isUser = m.from === 'user';
                  const avatarUrl = isUser
                    ? prompterAgent?.avatarUrl
                    : agentsById[m.from as string]?.avatarUrl;
                  return {
                    id: m.id,
                    from: isUser ? 'user' : 'agent',
                    text: m.text,
                    avatarUrl,
                  };
                })}
                input={prompt}
                onInputChange={setPrompt}
                onSend={() => runDemo(prompt)}
                disabled={isRunning}
                sendIcon={<Send className="h-4 w-4" />}
                prompterMode={prompterMode}
                onPrompterModeChange={v => setPrompterMode(v)}
              />
            </div>
            {error && (
              <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
                {error}
              </div>
            )}
          </section>

          <CharactersSidebar
            agents={agents}
            dragOverId={dragOverId}
            isRunning={isRunning}
            onAgentAvatarUpload={handleAvatarUpload}
            onAgentDelete={removeAgent}
            onAgentDescriptionChange={(id, description) => updateAgent(id, { description })}
            onAgentExport={agent => {
              void exportAgent(agent);
            }}
            onAgentImportMarkdown={loadImportedMarkdown}
            onAgentNameChange={(id, name) => updateAgent(id, { name })}
            onPrompterAgentChange={setPrompterAgent}
            onPrompterAvatarUpload={file => handleAvatarUpload(file, 'user')}
            onPrompterDescriptionChange={description => {
              if (prompterAgent) {
                updatePrompterAgent({ description });
              } else {
                setPrompterAgent({
                  id: 'user-agent',
                  name: '',
                  description,
                  avatarUrl: '',
                });
              }
            }}
            onPrompterExport={() => {
              const target =
                prompterAgent ??
                ({
                  id: 'user-agent',
                  name: 'Prompter',
                  description: '',
                  avatarUrl: '',
                } as Agent);
              void exportAgent(target, 'Prompter');
            }}
            onPrompterImportMarkdown={file => loadImportedMarkdown(file, 'Prompter')}
            onPrompterNameChange={name => {
              if (prompterAgent) {
                updatePrompterAgent({ name });
              } else {
                setPrompterAgent({
                  id: 'user-agent',
                  name,
                  description: '',
                  avatarUrl: '',
                });
              }
            }}
            onPrompterRemove={() => {
              setPrompterAgent(null);
              toast.success('Persona removed');
            }}
            onRestartSituation={restartSituation}
            onStoryChange={setStory}
            personaRef={personaRef}
            prompterAgent={prompterAgent}
            showBackstory={showBackstory}
            sidebarOpen={sidebarOpen}
            sidebarScrollRef={sidebarScrollRef}
            story={story}
            storyTextareaRef={storyTextareaRef}
            toggleBackstory={() => setShowBackstory(!showBackstory)}
          />
        </div>

        <AvatarCropDialog
          crop={crop}
          croppingImage={croppingImage}
          isGif={isGif}
          isHoveringEdge={isHoveringEdge}
          open={!!croppingImage}
          onApplyCrop={handleApplyCrop}
          onApplyGifImmediately={applyGifImmediately}
          onClose={clearCropper}
          setCrop={setCrop}
          setIsHoveringEdge={setIsHoveringEdge}
        />
        <Button
          onClick={addAgent}
          size="icon"
          variant="default"
          className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
          title="Add New Character"
        >
          <Plus className="h-5 w-5" />
        </Button>
      </div>
    </ContentLayout>
  );
}





