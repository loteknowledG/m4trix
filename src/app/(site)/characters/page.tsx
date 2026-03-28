'use client';
import { FormEvent, useEffect, useMemo, useState, useRef } from 'react';
import { flushSync } from 'react-dom';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { CustomChatWindow } from '@/components/ai/custom-chat-window';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Trash2,
  User,
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
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from '@/lib/lmstudio';
import { cropAvatarFromImage } from './crop-image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AgentCard } from '@/components/agent-card';
import { ContentLayout } from '@/components/admin-panel/content-layout';

type AgentId = string;

type Agent = {
  id: AgentId;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
  badgeVariant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'black' | null;
};

type ChatMessage = {
  id: string;
  from: AgentId | 'user';
  text: string;
};

type OrchestratedMessage = {
  id: string;
  from: 'user' | 'agent';
  text: string;
  agentId?: AgentId;
};

type AgentsResponse = {
  agents: Agent[];
  messages: OrchestratedMessage[];
  mode: 'demo' | 'live';
  error?: string;
};

type Provider = 'zen' | 'google' | 'huggingface' | 'nvidia' | 'lmstudio';
type ModelOption = {
  id: string;
  label: string;
  provider: Provider;
};

const AGENTS: Agent[] = [
  {
    id: 'researcher',
    name: '',
    description: '',
    badgeVariant: 'default',
  },
  {
    id: 'critic',
    name: '',
    description: '',
    badgeVariant: 'secondary',
  },
  {
    id: 'summarizer',
    name: '',
    description: '',
    badgeVariant: 'outline',
  },
];

export default function CharactersPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [model, setModel] = useState<string>('');
  const [story, setStory] = useState('');
  const [activeProvider, setActiveProvider] = useState<Provider>('zen');

  // sidebar & persona refs to ensure user can scroll/focus the Global Story textarea
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null);
  const personaRef = useRef<HTMLDivElement | null>(null);
  const storyTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [zenApiKey, setZenApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [nvidiaApiKey, setNvidiaApiKey] = useState('');
  // Removed koboldUrl and koboldConnected
  const [lmstudioUrl, setLmstudioUrl] = useState('http://192.168.12.48:1234');
  const [lmstudioConnected, setLmstudioConnected] = useState(false);
  const [zenConnected, setZenConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hfConnected, setHfConnected] = useState(false);
  const [nvidiaConnected, setNvidiaConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // UX helpers: encode required order via disabled states
  const hasKeyForActiveProvider =
    (activeProvider === 'zen'
      ? zenApiKey
      : activeProvider === 'google'
      ? googleApiKey
      : activeProvider === 'nvidia'
      ? nvidiaApiKey
      : activeProvider === 'lmstudio'
      ? normalizeLmstudioUrl(lmstudioUrl)
      : hfApiKey || ''
    ).trim().length > 0;
  // true when the currently selected provider is already connected — used to lock row 2
  const activeProviderConnected =
    activeProvider === 'zen'
      ? zenConnected
      : activeProvider === 'google'
      ? googleConnected
      : activeProvider === 'nvidia'
      ? nvidiaConnected
      : activeProvider === 'lmstudio'
      ? lmstudioConnected
      : hfConnected;

  const [showBackstory, setShowBackstory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prompterAgent, setPrompterAgent] = useState<Agent | null>(null);
  // Prompter mode controls how the prompter should frame user input for agents
  const [prompterMode, setPrompterMode] = useState<'tell' | 'do' | 'think'>('tell');
  const [useCustomModel] = useState(false);
  const [isHoveringEdge, setIsHoveringEdge] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingTarget, setCroppingTarget] = useState<AgentId | 'user' | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [dragOverId] = useState<string | null>(null);
  const [isGif, setIsGif] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedZen = window.sessionStorage.getItem('ZEN_API_KEY_SESSION');
    const storedGoogle = window.sessionStorage.getItem('GOOGLE_API_KEY_SESSION');
    const storedHf = window.sessionStorage.getItem('HF_API_KEY_SESSION');
    const storedNvidia = window.sessionStorage.getItem('NVIDIA_API_KEY_SESSION');
    const storedProvider = window.sessionStorage.getItem(
      'ACTIVE_PROVIDER_SESSION'
    ) as Provider | null;
    const storedLmstudio = window.sessionStorage.getItem('LMSTUDIO_CONNECTED');
    const storedLmstudioUrl = window.sessionStorage.getItem('LMSTUDIO_URL_SESSION');

    // Restore previously selected model (if any) before fetching provider models
    const storedModel = window.sessionStorage.getItem('ACTIVE_MODEL_SESSION');
    if (storedModel) setModel(storedModel);

    if (storedZen) {
      setZenApiKey(storedZen);
      validateAndFetchModels('zen', storedZen);
    }
    if (storedGoogle) {
      setGoogleApiKey(storedGoogle);
      validateAndFetchModels('google', storedGoogle);
    }
    if (storedHf) {
      setHfApiKey(storedHf);
      validateAndFetchModels('huggingface', storedHf);
    }
    if (storedNvidia) {
      setNvidiaApiKey(storedNvidia);
      validateAndFetchModels('nvidia', storedNvidia);
    }
    if (storedLmstudioUrl) {
      setLmstudioUrl(normalizeLmstudioUrl(storedLmstudioUrl));
    }
    if (storedProvider) setActiveProvider(storedProvider);
    if (storedLmstudio === '1') setLmstudioConnected(true);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (zenApiKey) window.sessionStorage.setItem('ZEN_API_KEY_SESSION', zenApiKey);
    else window.sessionStorage.removeItem('ZEN_API_KEY_SESSION');
    if (googleApiKey) window.sessionStorage.setItem('GOOGLE_API_KEY_SESSION', googleApiKey);
    else window.sessionStorage.removeItem('GOOGLE_API_KEY_SESSION');
    if (hfApiKey) window.sessionStorage.setItem('HF_API_KEY_SESSION', hfApiKey);
    else window.sessionStorage.removeItem('HF_API_KEY_SESSION');
    if (nvidiaApiKey) window.sessionStorage.setItem('NVIDIA_API_KEY_SESSION', nvidiaApiKey);
    else window.sessionStorage.removeItem('NVIDIA_API_KEY_SESSION');
    if (model) window.sessionStorage.setItem('ACTIVE_MODEL_SESSION', model);
    else window.sessionStorage.removeItem('ACTIVE_MODEL_SESSION');
    window.sessionStorage.setItem('ACTIVE_PROVIDER_SESSION', activeProvider);
    window.sessionStorage.setItem('LMSTUDIO_CONNECTED', lmstudioConnected ? '1' : '');
    if (lmstudioUrl.trim()) {
      window.sessionStorage.setItem('LMSTUDIO_URL_SESSION', normalizeLmstudioUrl(lmstudioUrl));
    } else {
      window.sessionStorage.removeItem('LMSTUDIO_URL_SESSION');
    }
  }, [zenApiKey, googleApiKey, hfApiKey, nvidiaApiKey, activeProvider, model, lmstudioConnected, lmstudioUrl]);

  const agentsById = useMemo(() => {
    return agents.reduce<Record<AgentId, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<AgentId, Agent>);
  }, [agents]);

  const clearScriptTimeouts = () => {
    if (timeoutsRef.current.length) {
      for (const id of timeoutsRef.current) {
        clearTimeout(id);
      }
      timeoutsRef.current = [];
    }
  };

  // Restart the current playground "situation": clears the conversation but PRESERVES backstory/prompter.
  const restartSituation = async () => {
    // Silent restart (no confirmation dialog)
    clearScriptTimeouts();
    setMessages([]);
    setPrompt('');
    setError(null);
    setShowBackstory(false);

    // Preserve persisted story/prompter; do NOT clear IndexedDB/localStorage here.
    // This keeps the backstory and prompter intact across restarts.

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
  const handleAvatarUpload = (file: File, id: AgentId | 'user') => {
    if (!file.type.startsWith('image/')) {
      toast.error('File is not an image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result as string;
      setCroppingImage(result);
      setCroppingTarget(id);
      setCrop({ x: 0, y: 0, zoom: 1 });
      setIsGif(file.type === 'image/gif');
    };
    reader.readAsDataURL(file);
  };

  const applyGifImmediately = () => {
    if (!croppingImage || !croppingTarget) return;
    if (croppingTarget === 'user') {
      updatePrompterAgent({ avatarUrl: croppingImage });
    } else {
      updateAgent(croppingTarget, { avatarUrl: croppingImage });
    }
    setCroppingImage(null);
    setCroppingTarget(null);
    setIsGif(false);
  };

  const handleApplyCrop = async () => {
    if (!croppingImage || !croppingTarget) return;

    // For GIFs, we just store the crop info and the original URL to keep it animated
    if (isGif) {
      if (croppingTarget === 'user') {
        updatePrompterAgent({ avatarUrl: croppingImage, avatarCrop: { ...crop } });
      } else {
        updateAgent(croppingTarget, { avatarUrl: croppingImage, avatarCrop: { ...crop } });
      }
      setCroppingImage(null);
      setCroppingTarget(null);
      setIsGif(false);
      toast.success('Animated crop applied!');
      return;
    }

    const croppedDataUrl = await cropAvatarFromImage(croppingImage, crop);

    if (croppingTarget === 'user') {
      updatePrompterAgent({ avatarUrl: croppedDataUrl, avatarCrop: undefined });
    } else {
      updateAgent(croppingTarget, { avatarUrl: croppedDataUrl, avatarCrop: undefined });
    }

    setCroppingImage(null);
    setCroppingTarget(null);
  };

  const updateAgent = (
    id: AgentId,
    updates: Partial<Pick<Agent, 'name' | 'description' | 'avatarUrl' | 'avatarCrop'>>
  ) => {
    setAgents(prev => prev.map(agent => (agent.id === id ? { ...agent, ...updates } : agent)));
  };

  const updatePrompterAgent = (
    updates: Partial<Pick<Agent, 'name' | 'description' | 'avatarUrl' | 'avatarCrop'>>
  ) => {
    if (prompterAgent) {
      setPrompterAgent({ ...prompterAgent, ...updates });
    }
  };

  // streamMessageText: supports optional incremental streaming when `stream=true`.
  const streamMessageText = async (
    messageId: string,
    fullText: string,
    targetPos?: number,
    stream: boolean = false
  ) => {
    // If streaming is disabled for this call, write final text atomically.
    if (!stream) {
      setMessages(prev => {
        // Prefer updating by known absolute position (deterministic) when available
        if (typeof targetPos === 'number' && targetPos >= 0 && targetPos < prev.length) {
          const target = prev[targetPos];
          if (target && target.id === messageId) {
            const copy = prev.slice();
            copy[targetPos] = { ...copy[targetPos], text: fullText };
            return copy;
          }
        }

        let found = false;
        const next = prev.map(msg => {
          if (msg.id === messageId) {
            found = true;
            return { ...msg, text: fullText };
          }
          return msg;
        });

        // If placeholder not present yet, append the final message so user sees it
        if (!found) {
          return [...next, { id: messageId, from: 'assistant', text: fullText }];
        }
        return next;
      });

      return;
    }

    // Incremental streaming (only used when `stream === true`)
    const words = fullText.split(' ');
    let current = '';

    for (let i = 0; i < words.length; i++) {
      current += (i > 0 ? ' ' : '') + words[i];

      setMessages(prev => {
        // Prefer updating by known absolute position (deterministic) when available
        if (typeof targetPos === 'number' && targetPos >= 0 && targetPos < prev.length) {
          const target = prev[targetPos];
          if (target && target.id === messageId) {
            const copy = prev.slice();
            copy[targetPos] = { ...copy[targetPos], text: current };
            return copy;
          }
        }

        let found = false;
        const next = prev.map(msg => {
          if (msg.id === messageId) {
            found = true;
            return { ...msg, text: current };
          }
          return msg;
        });

        // If placeholder not present yet, append the streaming message so user sees progress
        if (!found) {
          return [...next, { id: messageId, from: 'assistant', text: current }];
        }
        return next;
      });

      await new Promise(resolve => setTimeout(resolve, Math.random() * 60 + 20));
    }
  };

  const validateAndFetchModels = async (provider: Provider, keyToUse: string) => {
    const trimmedKey = keyToUse.trim();
    if (!trimmedKey) return;

    setConnectionError(null);
    setIsConnecting(true);
    try {
      if (provider === 'lmstudio') {
        setLmstudioConnected(true);
        setConnectionError(null);
        setIsConnecting(true);
        try {
          const urlParam = encodeURIComponent(
            normalizeLmstudioUrl(lmstudioUrl || DEFAULT_LMSTUDIO_URL)
          );
          const res = await fetch(`/api/models?provider=lmstudio&lmstudio_url=${urlParam}`, {
            method: 'GET',
          });
          if (!res.ok) throw new Error('Failed to fetch LM Studio models');
          const payload = (await res.json().catch(() => null)) as any;
          let rawModels: any[] = [];
          if (Array.isArray(payload)) {
            rawModels = payload;
          } else if (payload && Array.isArray(payload.data)) {
            rawModels = payload.data;
          } else if (payload && Array.isArray(payload.models)) {
            rawModels = payload.models;
          } else if (payload && payload.object === 'list' && Array.isArray(payload.data)) {
            rawModels = payload.data;
          }
          const options: Array<{ id: string; label: string; provider: Provider }> = rawModels
            .map((m: any) => {
              const id =
                (typeof m?.id === 'string' && m.id) ||
                (typeof m?.model_id === 'string' && m.model_id) ||
                (typeof m?.name === 'string' && m.name);
              if (!id) return null;
              const label =
                (typeof m?.display_name === 'string' && m.display_name) ||
                (typeof m?.name === 'string' && m.name) ||
                id;
              return { id, label, provider };
            })
            .filter((m: any): m is any => Boolean(m));
          setModelOptions(prev => {
            const filtered = prev.filter(p => p.provider !== 'lmstudio');
            const combined = [
              ...filtered,
              ...options.map(o => ({ ...o, provider: 'lmstudio' as Provider })),
            ];
            return combined;
          });
          if (options.length && (!model || activeProvider === provider)) {
            setModel(options[0]!.id);
          }
          toast.success(
            `LM Studio connected — ${options.length} model${options.length > 1 ? 's' : ''} loaded`
          );
        } catch (e) {
          setConnectionError('Failed to connect to LM Studio');
          setLmstudioConnected(false);
          toast.error('Failed to connect to LM Studio');
        } finally {
          setIsConnecting(false);
        }
        return;
      }
      const headers: Record<string, string> = {};
      if (provider === 'zen') {
        headers['x-zen-api-key'] = trimmedKey;
      } else if (provider === 'google') {
        headers['x-google-api-key'] = trimmedKey;
      } else if (provider === 'nvidia') {
        headers['x-nvidia-api-key'] = trimmedKey;
      } else {
        headers['x-hf-api-key'] = trimmedKey;
      }
      const res = await fetch('/api/models', {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to validate key (status ${res.status})`);
      }
      const payload = (await res.json().catch(() => null)) as any;
      const rawModels: any[] = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.data)
        ? payload.data
        : Array.isArray(payload?.models)
        ? payload.models
        : [];
      const options: Array<{ id: string; label: string; provider: Provider }> = rawModels
        .map((m: any) => {
          const id =
            (typeof m?.id === 'string' && m.id) ||
            (typeof m?.model_id === 'string' && m.model_id) ||
            (typeof m?.name === 'string' && m.name);
          if (!id) return null;
          const label =
            (typeof m?.display_name === 'string' && m.display_name) ||
            (typeof m?.name === 'string' && m.name) ||
            id;
          return { id, label, provider };
        })
        .filter((m: any): m is any => Boolean(m));
      setModelOptions(prev => {
        const filtered = prev.filter(p => p.provider !== provider);
        const combined = [...filtered, ...options];
        return combined;
      });
      if (options.length && (!model || activeProvider === provider)) {
        setModel(options[0]!.id);
      }
      if (provider === 'zen') setZenConnected(true);
      else if (provider === 'google') setGoogleConnected(true);
      else if (provider === 'nvidia') setNvidiaConnected(true);
      else if (provider === 'huggingface') setHfConnected(true);
      // show clear toast feedback so users know the provider connected and how many models returned
      const providerLabel =
        provider === 'zen'
          ? 'OpenCode'
          : provider === 'google'
          ? 'Google Gemini'
          : provider === 'huggingface'
          ? 'Hugging Face'
          : provider === 'nvidia'
          ? 'NVIDIA'
          : provider === 'lmstudio'
          ? 'LM Studio'
          : provider;
      if (options.length) {
        toast.success(
          `${providerLabel} connected — ${options.length} model${
            options.length > 1 ? 's' : ''
          } loaded`
        );
      } else {
        toast.success(`${providerLabel} connected — no models returned`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to validate ${provider} API key.`;
      setConnectionError(msg);
      toast.error(msg);
      if (provider === 'zen') setZenConnected(false);
      else if (provider === 'google') setGoogleConnected(false);
      else if (provider === 'nvidia') setNvidiaConnected(false);
      else if (provider === 'huggingface') setHfConnected(false);
      else if (provider === 'lmstudio') setLmstudioConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWithKey = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) event.preventDefault();
    let key = '';
    if (activeProvider === 'zen') key = zenApiKey;
    else if (activeProvider === 'google') key = googleApiKey;
    else if (activeProvider === 'nvidia') key = nvidiaApiKey;
    else if (activeProvider === 'huggingface') key = hfApiKey;
    await validateAndFetchModels(activeProvider, key);
  };

  const runDemo = async (promptText?: string) => {
    clearScriptTimeouts();
    setError(null);
    setIsRunning(true);

    try {
      const effectivePrompt = (promptText ?? prompt).trim();

      if (!effectivePrompt) {
        throw new Error('Please enter a prompt for the agents.');
      }

      if (!model.trim()) {
        throw new Error('Please select a model for the agents.');
      }

      if (activeProvider === 'zen' && !zenApiKey.trim()) {
        throw new Error('Please enter your OpenCode API key for this session.');
      }

      if (activeProvider === 'google' && !googleApiKey.trim()) {
        throw new Error('Please enter your Google API key for this session.');
      }

      if (activeProvider === 'huggingface' && !hfApiKey.trim()) {
        throw new Error('Please enter your Hugging Face API token for this session.');
      }

      const selectedModel = modelOptions.find(o => o.id === model);
      const modelProvider = selectedModel?.provider || activeProvider;

      // Send the existing conversation history to the server so agents can
      // remember previous turns. Do not include the current prompt here
      // (we add it separately on the server).
      const historyForApi = messages.map(m =>
        m.from === 'user'
          ? { id: m.id, from: 'user', text: m.text }
          : { id: m.id, from: 'agent', agentId: m.from, text: m.text }
      );

      const temporaryUserMessageId = `user-${Date.now()}`;
      setMessages(prev => [
        ...prev,
        {
          id: temporaryUserMessageId,
          from: 'user',
          text: effectivePrompt,
        },
      ]);
      setPrompt('');

      const requestBody: any = {
        prompt: effectivePrompt,
        maxTurns: 4,
        model,
        agents: agents.map(agent => ({
          id: agent.id,
          name: agent.name || 'Agent',
          description: agent.description || '',
          avatarUrl: agent.avatarUrl,
          avatarCrop: agent.avatarCrop,
        })),
        story,
        prompterAgent,
        prompterMode,
        orchestration: 'auto' as const,
        interactionMode: 'neutral' as const,
        // attach client-side conversation so agents remember prior turns
        history: historyForApi,
      };
      // Always send provider and lmstudioUrl if LM Studio is selected, regardless of state
      requestBody.provider = modelProvider;
      if (modelProvider === 'zen') requestBody.zenApiKey = zenApiKey;
      else if (modelProvider === 'google') requestBody.googleApiKey = googleApiKey;
      else if (modelProvider === 'nvidia') requestBody.nvidiaApiKey = nvidiaApiKey;
      else if (modelProvider === 'huggingface') requestBody.hfApiKey = hfApiKey;

      // GUARANTEE: If LM Studio is selected in any way, always set provider/lmstudioUrl
      const selectedModelObj = modelOptions.find(o => o.id === model);
      const lmstudioSelected =
        (selectedModelObj && selectedModelObj.provider === 'lmstudio') ||
        modelProvider === 'lmstudio' ||
        activeProvider === 'lmstudio';
      if (lmstudioSelected) {
        requestBody.provider = 'lmstudio';
        requestBody.lmstudioUrl = normalizeLmstudioUrl(lmstudioUrl || DEFAULT_LMSTUDIO_URL);
      } else {
        // Defensive: never send stale lmstudioUrl if not using LM Studio
        delete requestBody.lmstudioUrl;
      }

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as AgentsResponse;

      setAgents(data.agents && data.agents.length ? data.agents : AGENTS);

      if (data.error) {
        setError(data.error);
      }

      const mapped: ChatMessage[] = data.messages.map(m => {
        if (m.from === 'user') {
          return {
            id: m.id,
            from: 'user',
            text: m.text,
          };
        }

        const fallbackAgentId: AgentId = 'researcher';

        return {
          id: m.id,
          from: (m.agentId as AgentId | undefined) ?? fallbackAgentId,
          text: m.text,
        };
      });

      // Ensure unique client-side IDs for every incoming server message to avoid
      // accidental id collisions with existing messages or repeated server ids.
      const prevIds = new Set<string>();
      // collect existing message ids synchronously
      // (we'll read them inside setMessages below)

      const serverIdCounts: Record<string, number> = {};
      const seenClientIds = new Set<string>();
      const clientIds: string[] = [];

      // create a client id for each mapped entry (avoid collisions with existing prev ids)
      // note: we will also remove any prev messages that share the same server id
      // to avoid duplicates from prior runs. Capture positions where placeholders
      // are inserted so streaming updates can target slots deterministically.
      const clientPositions: number[] = [];
      const __debug = true;

      flushSync(() => {
        setMessages(prev => {
          prev.forEach(m => prevIds.add(m.id));

          const reuseExisting: boolean[] = [];
          for (let i = 0; i < mapped.length; i++) {
            const m = mapped[i];
            const base = m.id;
            serverIdCounts[base] = (serverIdCounts[base] || 0) + 1;
            let candidate = serverIdCounts[base] === 1 ? base : `${base}-${serverIdCounts[base]}`;
            while (seenClientIds.has(candidate) || prevIds.has(candidate)) {
              serverIdCounts[base] = serverIdCounts[base] + 1;
              candidate = `${base}-${serverIdCounts[base]}`;
            }
            seenClientIds.add(candidate);
            clientIds.push(candidate);
            reuseExisting.push(false);
          }

          // Remove the temporary user placeholder and any prior client messages
          // that correspond to the same server ids returned in this response.
          const serverBases = new Set(mapped.map(m => m.id));
          const filteredPrev = prev.filter(m => {
            if (m.id === temporaryUserMessageId) return false;
            for (const base of serverBases) {
              if (m.id === base || m.id.startsWith(`${base}-`)) return false;
            }
            return true;
          });

          // Build placeholders in server order and record their absolute positions.
          const placeholdersUsingClientIds: ChatMessage[] = [];
          const startIndex = filteredPrev.length;
          let placeholderCounter = 0;

          for (let idx = 0; idx < mapped.length; idx++) {
            if (reuseExisting[idx]) {
              const existingIndex = prev.findIndex(p => p.id === clientIds[idx]);
              clientPositions[idx] = existingIndex >= 0 ? existingIndex : -1;
              continue;
            }

            const placeholder: ChatMessage = {
              id: clientIds[idx],
              from: mapped[idx].from,
              text: mapped[idx].from === 'user' ? mapped[idx].text : '',
            };

            placeholdersUsingClientIds.push(placeholder);
            clientPositions[idx] = startIndex + placeholderCounter;
            placeholderCounter += 1;
          }

          return [...filteredPrev, ...placeholdersUsingClientIds];
        });
      });

      // Stream agent messages in the exact order returned by the server using clientIds
      // Only apply incremental streaming to the last agent message; all others
      // are written immediately (final text) to avoid earlier rewrites.
      const lastAgentIndex = mapped.reduce((acc, m, idx) => (m.from !== 'user' ? idx : acc), -1);

      for (let i = 0; i < mapped.length; i++) {
        const msg = mapped[i];
        const clientId = clientIds[i];
        const targetPos =
          typeof (clientPositions as any)[i] === 'number' ? (clientPositions as any)[i] : undefined;
        if (msg.from !== 'user') {
          const shouldStream = i === lastAgentIndex;

          await streamMessageText(clientId, msg.text, targetPos, shouldStream);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  };

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

          <aside
            className={cn(
              'flex flex-col gap-4 self-stretch h-full min-h-0 overflow-hidden rounded-xl border bg-background/40 p-4 transition-all duration-300 ease-in-out max-h-[calc(100vh_-_var(--app-header-height,_56px)_-_48px)]',
              sidebarOpen
                ? 'w-[300px] opacity-100'
                : 'w-0 p-0 border-0 opacity-0 pointer-events-none'
            )}
          >
            <div
              ref={sidebarScrollRef}
              className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Characters
                  </p>
                </div>
              </div>

              {agents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                  <p className="text-[11px] text-muted-foreground">
                    No characters in the team. Import or add one to get started!
                  </p>
                </div>
              ) : (
                agents.map(agent => (
                  <AgentCard
                    key={agent.id}
                    name={agent.name}
                    description={agent.description}
                    avatarUrl={agent.avatarUrl}
                    avatarCrop={agent.avatarCrop}
                    dragOverId={dragOverId}
                    onAvatarUpload={file => handleAvatarUpload(file, agent.id)}
                    onImport={async file => {
                      if (file.type.startsWith('image/')) {
                        handleAvatarUpload(file, agent.id);
                        toast.success(`Profile picture imported for "${agent.name || 'Agent'}".`);
                        return;
                      }

                      const imported = await loadImportedMarkdown(file, agent.id);
                      if (!imported) return;
                      // Assume imported is { label: string, description: string }
                      updateAgent(agent.id, {
                        name: (imported as { label: string }).label,
                        description: (imported as { description: string }).description,
                      });
                      toast.success(
                        `Agent "${(imported as { label: string }).label}" imported successfully!`
                      );
                    }}
                    onExport={() => {
                      void exportAgent(agent);
                    }}
                    onDelete={() => removeAgent(agent.id)}
                    onNameChange={name => updateAgent(agent.id, { name })}
                    onDescriptionChange={description => updateAgent(agent.id, { description })}
                    isUser={false}
                  />
                ))
              )}

              {/* Persona & Story (moved from main area) */}
              <div ref={personaRef} className="mt-6 border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Prompter
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setShowBackstory(!showBackstory)}
                    >
                      <User className="h-3 w-3" />
                      {showBackstory ? 'Hide Story' : 'Set Story'}
                    </button>

                    <button
                      className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-destructive hover:text-destructive/80 transition-colors"
                      onClick={restartSituation}
                      title="Restart conversation (keeps backstory)"
                    >
                      <Trash2 className="h-3 w-3" />
                      Restart
                    </button>
                  </div>
                </div>

                {showBackstory && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Your Persona
                        </p>
                      </div>
                      <AgentCard
                        name={prompterAgent?.name || ''}
                        description={prompterAgent?.description || ''}
                        avatarUrl={prompterAgent?.avatarUrl}
                        avatarCrop={prompterAgent?.avatarCrop}
                        dragOverId={dragOverId}
                        onAvatarUpload={file => handleAvatarUpload(file, 'user')}
                        onImport={async file => {
                          if (file.type.startsWith('image/')) {
                            handleAvatarUpload(file, 'user');
                            toast.success('Profile picture imported for Prompter.');
                            return;
                          }

                          const imported = await loadImportedMarkdown(file, 'Prompter');
                          if (!imported) return;

                          if (prompterAgent) {
                            updatePrompterAgent({
                              name: (imported as { label: string }).label,
                              description: (imported as { description: string }).description,
                            });
                          } else {
                            setPrompterAgent({
                              id: 'user-agent',
                              name: (imported as { label: string }).label,
                              description: (imported as { description: string }).description,
                              avatarUrl: '',
                            });
                          }

                          toast.success(
                            `Prompter "${
                              (imported as { label: string }).label
                            }" imported successfully!`
                          );
                        }}
                        onExport={() => {
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
                        onNameChange={name => {
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
                        onDescriptionChange={description => {
                          if (prompterAgent) {
                            updatePrompterAgent({ description });
                          } else {
                            setPrompterAgent({
                              id: 'user-agent',
                              name: '',
                              description,
                            });
                          }
                        }}
                        onRemove={() => {
                          setPrompterAgent(null);
                          toast.success('Persona removed');
                        }}
                        isUser={true}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Global Story Context
                      </p>
                      <Textarea
                        ref={storyTextareaRef}
                        autoComplete="off"
                        className="min-h-[80px] bg-muted/30 text-[11px] placeholder:italic"
                        disabled={isRunning}
                        onChange={e => setStory(e.target.value)}
                        placeholder="Provide global story context or character details for the characters..."
                        value={story}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>

        <Dialog
          open={!!croppingImage}
          onOpenChange={open => {
            if (!open) {
              setCroppingImage(null);
              setCroppingTarget(null);
              setIsGif(false);
            }
          }}
        >
          <DialogContent className="sm:max-w-[420px] max-h-[95vh] p-0 overflow-hidden flex flex-col bg-zinc-950 border-zinc-800 shadow-2xl">
            <DialogHeader className="p-4 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md shrink-0">
              <DialogTitle className="text-sm font-medium text-zinc-100 font-mono tracking-tight uppercase flex items-center gap-2">
                <DialogDescription className="sr-only">
                  Crop the selected image for avatar
                </DialogDescription>
                {isGif && (
                  <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1.5 py-0.5 rounded leading-none">
                    GIF
                  </span>
                )}
                Crop Avatar
              </DialogTitle>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto relative bg-zinc-950 flex justify-center py-8">
              <div
                className={cn(
                  'relative aspect-square w-[400px] h-[400px] shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden select-none touch-none',
                  isHoveringEdge ? 'cursor-nwse-resize' : 'cursor-move'
                )}
                onPointerMove={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const dist = Math.sqrt(
                    Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
                  );
                  setIsHoveringEdge(dist > 145 && dist < 180);
                }}
                onWheel={e => {
                  e.preventDefault();
                  const zoomSpeed = 0.001;
                  const newZoom = Math.min(Math.max(crop.zoom - e.deltaY * zoomSpeed, 1), 10);
                  setCrop(prev => ({ ...prev, zoom: newZoom }));
                }}
                onPointerDown={e => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const centerX = rect.left + rect.width / 2;
                  const centerY = rect.top + rect.height / 2;
                  const distCenter = Math.sqrt(
                    Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
                  );

                  // Zoom mode if grabbing the white edge (160px +/- 15px)
                  if (distCenter > 145 && distCenter < 180) {
                    const startDist = distCenter;
                    const startZoom = crop.zoom;
                    const onPointerMove = (moveEvent: PointerEvent) => {
                      const newDist = Math.sqrt(
                        Math.pow(moveEvent.clientX - centerX, 2) +
                          Math.pow(moveEvent.clientY - centerY, 2)
                      );
                      // Drag away = Circle gets BIGGER = Area covers MORE = Zoom OUT
                      const ratio = newDist / startDist;
                      const newZoom = Math.min(Math.max(startZoom / ratio, 1), 10);
                      setCrop(prev => ({ ...prev, zoom: newZoom }));
                    };
                    const onPointerUp = () => {
                      window.removeEventListener('pointermove', onPointerMove);
                      window.removeEventListener('pointerup', onPointerUp);
                    };
                    window.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);
                  } else {
                    // Pan mode everywhere else
                    const startX = e.clientX - crop.x;
                    const startY = e.clientY - crop.y;
                    const onPointerMove = (moveEvent: PointerEvent) => {
                      setCrop(prev => ({
                        ...prev,
                        x: moveEvent.clientX - startX,
                        y: moveEvent.clientY - startY,
                      }));
                    };
                    const onPointerUp = () => {
                      window.removeEventListener('pointermove', onPointerMove);
                      window.removeEventListener('pointerup', onPointerUp);
                    };
                    window.addEventListener('pointermove', onPointerMove);
                    window.addEventListener('pointerup', onPointerUp);
                  }
                }}
              >
                {/* Main cropper image (restored) */}
                {croppingImage && (
                  <img
                    src={croppingImage}
                    alt="Crop preview"
                    className={cn(
                      'w-full h-full object-contain max-w-none pointer-events-none',
                      `[transform:translate(${crop.x}px,_${crop.y}px)_scale(${crop.zoom})]`
                    )}
                  />
                )}

                {/* Zoom Indicator Badge */}
                <div className="absolute top-4 right-4 z-30 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-white/80 shadow-xl">
                    {Math.round(crop.zoom * 100)}%
                  </div>
                </div>

                {/* Circular Mask Overlay */}
                <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-[320px] aspect-square rounded-full border border-white/40 shadow-[0_0_0_1000px_rgba(0,0,0,0.3)]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-950 border-t border-zinc-900 shrink-0">
              <DialogFooter className="flex items-center gap-2 sm:gap-0 justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-zinc-500 hover:text-zinc-300 transition-colors"
                  onClick={() => {
                    setCroppingImage(null);
                    setIsGif(false);
                  }}
                >
                  Cancel
                </Button>
                <div className="flex items-center gap-2">
                  {isGif && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                      onClick={applyGifImmediately}
                    >
                      Skip Crop
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
                    onClick={handleApplyCrop}
                  >
                    {isGif ? 'Apply Animated Crop' : 'Apply Crop'}
                  </Button>
                </div>
              </DialogFooter>
            </div>
          </DialogContent>
          <Button
            onClick={addAgent}
            size="icon"
            variant="default"
            className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow"
            title="Add New Character"
          >
            <Plus className="h-5 w-5" />
          </Button>
        </Dialog>
      </div>
    </ContentLayout>
  );
}

