'use client';
import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChatWindow,
  type ChatWindowMessage,
  type ChatWindowModel,
} from '@/components/ai/chat-window';
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
  Download,
  FileUp,
  ImageIcon,
  ImagePlus,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Send,
  Trash2,
  User,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

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

type ModelOption = {
  id: string;
  label: string;
  provider: 'zen' | 'google' | 'huggingface';
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

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [model, setModel] = useState<string>('');
  const [story, setStory] = useState('');
  const [activeProvider, setActiveProvider] = useState<'zen' | 'google' | 'huggingface'>('zen');
  const [zenApiKey, setZenApiKey] = useState('');
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [hfApiKey, setHfApiKey] = useState('');
  const [zenConnected, setZenConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);
  const [hfConnected, setHfConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showBackstory, setShowBackstory] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [prompterAgent, setPrompterAgent] = useState<Agent | null>(null);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [isHoveringEdge, setIsHoveringEdge] = useState(false);
  const [customModelId, setCustomModelId] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);
  const [croppingImage, setCroppingImage] = useState<string | null>(null);
  const [croppingTarget, setCroppingTarget] = useState<AgentId | 'user' | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0, zoom: 1 });
  const [isDragOverCrop, setIsDragOverCrop] = useState(false);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [isGif, setIsGif] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const hasLoaded = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedZen = window.sessionStorage.getItem('ZEN_API_KEY_SESSION');
    const storedGoogle = window.sessionStorage.getItem('GOOGLE_API_KEY_SESSION');
    const storedHf = window.sessionStorage.getItem('HF_API_KEY_SESSION');
    const storedProvider = window.sessionStorage.getItem('ACTIVE_PROVIDER_SESSION') as
      | 'zen'
      | 'google'
      | 'huggingface'
      | null;

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
    if (storedProvider) setActiveProvider(storedProvider);

    const storedAgents = window.localStorage.getItem('PLAYGROUND_AGENTS');
    if (storedAgents) {
      try {
        setAgents(JSON.parse(storedAgents));
      } catch (e) {
        console.error('Failed to parse stored agents', e);
      }
    }

    const storedPrompter = window.localStorage.getItem('PLAYGROUND_PROMPTER');
    if (storedPrompter) {
      try {
        setPrompterAgent(JSON.parse(storedPrompter));
      } catch (e) {
        console.error('Failed to parse stored prompter', e);
      }
    }

    const storedStory = window.localStorage.getItem('PLAYGROUND_STORY');
    if (storedStory) setStory(storedStory);

    hasLoaded.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !hasLoaded.current) return;

    window.localStorage.setItem('PLAYGROUND_AGENTS', JSON.stringify(agents));
    if (prompterAgent) {
      window.localStorage.setItem('PLAYGROUND_PROMPTER', JSON.stringify(prompterAgent));
    } else {
      window.localStorage.removeItem('PLAYGROUND_PROMPTER');
    }
    window.localStorage.setItem('PLAYGROUND_STORY', story);
  }, [agents, prompterAgent, story]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (zenApiKey) {
      window.sessionStorage.setItem('ZEN_API_KEY_SESSION', zenApiKey);
    } else {
      window.sessionStorage.removeItem('ZEN_API_KEY_SESSION');
    }
    if (googleApiKey) {
      window.sessionStorage.setItem('GOOGLE_API_KEY_SESSION', googleApiKey);
    } else {
      window.sessionStorage.removeItem('GOOGLE_API_KEY_SESSION');
    }
    if (hfApiKey) {
      window.sessionStorage.setItem('HF_API_KEY_SESSION', hfApiKey);
    } else {
      window.sessionStorage.removeItem('HF_API_KEY_SESSION');
    }
    window.sessionStorage.setItem('ACTIVE_PROVIDER_SESSION', activeProvider);
  }, [zenApiKey, googleApiKey, hfApiKey, activeProvider]);

  const agentsById = useMemo(() => {
    return agents.reduce<Record<AgentId, Agent>>((acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    }, {} as Record<AgentId, Agent>);
  }, [agents]);

  const activeAgentId = useMemo<AgentId | null>(() => {
    const last = [...messages].reverse().find(m => m.from !== 'user');
    return last && last.from !== 'user' ? last.from : null;
  }, [messages]);

  const clearScriptTimeouts = () => {
    if (timeoutsRef.current.length) {
      for (const id of timeoutsRef.current) {
        clearTimeout(id);
      }
      timeoutsRef.current = [];
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      if (!file.name.endsWith('.md')) {
        toast.error(`File ${file.name} is not a Markdown file.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = e => {
        const content = e.target?.result as string;
        if (!content) return;

        const id = file.name.replace(/\.md$/, '');
        const firstHeadingLine = content.split(/\r?\n/).find(line => line.trim().startsWith('#'));

        const label = firstHeadingLine ? firstHeadingLine.replace(/^#+\s*/, '').trim() || id : id;

        const newAgent: Agent = {
          id: `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: label,
          description: content.trim(),
          avatarUrl: '',
          badgeVariant: 'outline',
        };

        setAgents(prev => [...prev, newAgent]);

        toast.success(`Agent "${label}" imported successfully!`);
      };
      reader.readAsText(file);
    }
    // reset input
    event.target.value = '';
  };

  const addAgent = () => {
    const newId = `agent-${Date.now()}`;
    const newAgent: Agent = {
      id: newId,
      name: '',
      description: '',
      avatarUrl: '',
      badgeVariant: 'outline',
    };
    setAgents(prev => [...prev, newAgent]);
  };

  const removeAgent = (id: AgentId) => {
    if (agents.length <= 1) {
      toast.error('You must have at least one agent.');
      return;
    }
    setAgents(prev => prev.filter(a => a.id !== id));
  };

  const exportAgent = (agent: Agent) => {
    const name = agent.name || 'Agent';
    const description = agent.description || '';

    const content = `# ${name}\n\n${description}`;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const filename =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-') || 'agent-skill';
    a.download = `${filename}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(`Agent skill "${name}" exported!`);
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

    const img = new Image();
    img.src = croppingImage;
    await new Promise(resolve => {
      img.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const UI_WORKSPACE = 400;
    const UI_CROP_CIRCLE = 320;

    // Scaling ratio from original high-res pixels to the 400px UI workspace
    const baseScale = UI_WORKSPACE / Math.min(img.width, img.height);
    const currentScale = baseScale * crop.zoom;

    // The portion of the image that was inside the 320px UI circle selection
    const sourceSize = UI_CROP_CIRCLE / currentScale;

    // Map the UI center displacement back to source coordinates
    const sourceX = img.width / 2 - crop.x / currentScale;
    const sourceY = img.height / 2 - crop.y / currentScale;

    const sx = sourceX - sourceSize / 2;
    const sy = sourceY - sourceSize / 2;

    // Final extraction box
    ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);

    const croppedDataUrl = canvas.toDataURL('image/webp', 0.9);

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

  const streamMessageText = async (messageId: string, fullText: string) => {
    const words = fullText.split(' ');
    let current = '';

    for (let i = 0; i < words.length; i++) {
      current += (i > 0 ? ' ' : '') + words[i];

      setMessages(prev =>
        prev.map(msg => (msg.id === messageId ? { ...msg, text: current } : msg))
      );

      await new Promise(resolve => setTimeout(resolve, Math.random() * 60 + 20));
    }
  };

  const validateAndFetchModels = async (
    provider: 'zen' | 'google' | 'huggingface',
    keyToUse: string
  ) => {
    const trimmedKey = keyToUse.trim();
    if (!trimmedKey) return;

    setConnectionError(null);
    setIsConnecting(true);
    try {
      const headers: Record<string, string> = {};
      if (provider === 'zen') {
        headers['x-zen-api-key'] = trimmedKey;
      } else if (provider === 'google') {
        headers['x-google-api-key'] = trimmedKey;
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

      const options: (ModelOption & { provider: 'zen' | 'google' | 'huggingface' })[] = rawModels
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
        // Filter out existing models for the same provider to avoid duplicates
        const filtered = prev.filter(p => p.provider !== provider);
        const combined = [...filtered, ...options];
        return combined;
      });

      if (options.length && !model) {
        setModel(options[0]!.id);
      }

      if (provider === 'zen') setZenConnected(true);
      else if (provider === 'google') setGoogleConnected(true);
      else setHfConnected(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : `Failed to validate ${provider} API key.`;
      setConnectionError(msg);
      if (provider === 'zen') setZenConnected(false);
      else if (provider === 'google') setGoogleConnected(false);
      else setHfConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const connectWithKey = async (event?: FormEvent<HTMLFormElement>) => {
    if (event) {
      event.preventDefault();
    }
    const key =
      activeProvider === 'zen' ? zenApiKey : activeProvider === 'google' ? googleApiKey : hfApiKey;
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

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
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
          zenApiKey: modelProvider === 'zen' ? zenApiKey : undefined,
          googleApiKey: modelProvider === 'google' ? googleApiKey : undefined,
          hfApiKey: modelProvider === 'huggingface' ? hfApiKey : undefined,
        }),
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

      const userMessages = mapped.filter(m => m.from === 'user');
      const agentMessages = mapped.filter(m => m.from !== 'user');

      // Replace our temporary user message with the official one from the API
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== temporaryUserMessageId);
        return [...filtered, ...userMessages];
      });

      for (const agentMessage of agentMessages) {
        setMessages(prev => [...prev, { ...agentMessage, text: '' }]);
        await streamMessageText(agentMessage.id, agentMessage.text);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Something went wrong';
      setError(msg);
    } finally {
      setIsRunning(false);
    }
  };

  const chatMessages = useMemo<ChatWindowMessage[]>(
    () =>
      messages.map(message => {
        const isUser = message.from === 'user';
        const agent = !isUser && message.from !== 'user' ? agentsById[message.from] : null;

        const name = isUser ? prompterAgent?.name || 'You' : agent?.name || 'Agent';

        return {
          key: message.id,
          from: isUser ? 'user' : 'assistant',
          name,
          avatarUrl: isUser ? prompterAgent?.avatarUrl : agent?.avatarUrl,
          avatarCrop: isUser ? prompterAgent?.avatarCrop : agent?.avatarCrop,
          versions: [
            {
              id: message.id,
              content: message.text,
            },
          ],
        };
      }),
    [agentsById, messages, prompterAgent]
  );

  const emptyModels: ChatWindowModel[] = [];
  const stickyRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3"></div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {!zenConnected || !googleConnected || !hfConnected ? (
              <form className="flex items-center gap-2" onSubmit={connectWithKey}>
                <Select value={activeProvider} onValueChange={(v: any) => setActiveProvider(v)}>
                  <SelectTrigger className="h-8 w-[120px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {!zenConnected && <SelectItem value="zen">OpenCode</SelectItem>}
                    {!googleConnected && <SelectItem value="google">Google Gemini</SelectItem>}
                    {!hfConnected && <SelectItem value="huggingface">Hugging Face</SelectItem>}
                  </SelectContent>
                </Select>
                <Input
                  type="password"
                  className="h-8 w-[200px] text-xs"
                  placeholder={`Paste ${
                    activeProvider === 'zen'
                      ? 'OpenCode'
                      : activeProvider === 'google'
                      ? 'Google'
                      : 'Hugging Face'
                  } key`}
                  value={
                    activeProvider === 'zen'
                      ? zenApiKey
                      : activeProvider === 'google'
                      ? googleApiKey
                      : hfApiKey
                  }
                  onChange={e => {
                    const val = e.target.value;
                    if (activeProvider === 'zen') setZenApiKey(val);
                    else if (activeProvider === 'google') setGoogleApiKey(val);
                    else setHfApiKey(val);
                  }}
                />
                <Button disabled={isConnecting} size="sm" type="submit">
                  {isConnecting ? '...' : 'Connect'}
                </Button>
              </form>
            ) : null}

            {(zenConnected || googleConnected || hfConnected) && (
              <div className="flex items-center gap-2">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    {useCustomModel ? (
                      <Input
                        className="h-8 w-[220px] text-xs"
                        placeholder="e.g. zai-org/GLM-4.5"
                        value={customModelId}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            promptInputRef.current?.focus();
                            toast.success(`Broadcasting to ${customModelId}`);
                          }
                        }}
                        onChange={e => {
                          setCustomModelId(e.target.value);
                          setModel(e.target.value);
                        }}
                      />
                    ) : (
                      <Select
                        disabled={isRunning || !modelOptions.length}
                        onValueChange={setModel}
                        value={model}
                      >
                        <SelectTrigger className="h-8 w-[220px] text-xs">
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
                    )}
                  </div>
                  {hfConnected && (
                    <button
                      type="button"
                      onClick={() => setUseCustomModel(!useCustomModel)}
                      className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-dashed border-primary/30 px-2 py-0.5 text-[10px] text-muted-foreground hover:border-primary hover:text-primary transition-all"
                    >
                      {useCustomModel
                        ? '← Back to listed models'
                        : "Can't find your model? Enter HF ID manually"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {(zenConnected || googleConnected || hfConnected) && (
            <div className="flex items-center gap-3 border-l pl-4">
              {zenConnected && (
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                  <span className="text-[11px] font-medium text-muted-foreground">OpenCode</span>
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
                  <span className="text-[11px] font-medium text-muted-foreground">Gemini</span>
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
      </header>

      {connectionError && (
        <div className="mx-auto w-full max-w-2xl rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {connectionError}
        </div>
      )}

      <div
        className={`flex flex-1 overflow-hidden transition-all duration-300 relative ${
          sidebarOpen ? 'gap-6' : 'gap-0'
        }`}
      >
        <div
          className="absolute z-50 top-1/2 -translate-y-1/2 transition-all duration-300"
          style={{ right: sidebarOpen ? '284px' : '-16px' }}
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
                !sidebarOpen ? 'rotate-180' : 'rotate-0'
              )}
            />
          </Button>
        </div>
        <section className="relative flex min-h-[280px] max-h-[90vh] flex-1 flex-col rounded-xl border bg-background/40 overflow-hidden">
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                Run the demo to see how multiple agents can talk in this UI.
              </div>
            ) : (
              <ChatWindow
                messages={chatMessages}
                models={emptyModels}
                suggestions={[]}
                stickyHeight={0}
                stickyRef={stickyRef}
                text=""
                status="ready"
                useWebSearch={false}
                useMicrophone={false}
                model=""
                modelSelectorOpen={false}
                selectedModelData={undefined}
                onSuggestionClick={() => {}}
                onSubmit={() => {}}
                onTextChange={() => {}}
                onToggleWebSearch={() => {}}
                onToggleMicrophone={() => {}}
                onSelectModel={() => {}}
                onModelSelectorOpenChange={() => {}}
                showInput={false}
                showSuggestions={false}
              />
            )}
          </div>
          {error && (
            <div className="border-t border-destructive/40 bg-destructive/10 px-4 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="mt-auto border-t bg-background/60 p-4">
            <div className="flex flex-col gap-3">
              <div className="relative flex items-end gap-2">
                <div className="relative flex-1">
                  <Textarea
                    ref={promptInputRef}
                    autoComplete="off"
                    className="min-h-[60px] resize-none pr-12 text-sm shadow-sm"
                    disabled={isRunning}
                    onChange={e => setPrompt(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        runDemo(prompt);
                      }
                    }}
                    placeholder="Message the agent team..."
                    value={prompt}
                  />
                  <Button
                    className="absolute right-2 bottom-2 h-8 w-8 rounded-full"
                    disabled={isRunning || !prompt.trim()}
                    onClick={() => runDemo(prompt)}
                    size="icon"
                  >
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <button
                  className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowBackstory(!showBackstory)}
                >
                  <User className="h-3 w-3" />
                  {showBackstory ? 'Hide Story' : 'Set Story'}
                </button>

                {showBackstory && (
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Your Persona
                        </p>
                      </div>

                      <div className="flex gap-2 items-center">
                        <label
                          className="relative group cursor-pointer"
                          onClick={e => {
                            // If avatar already exists, open crop dialog with current settings
                            if (prompterAgent?.avatarUrl) {
                              e.preventDefault();
                              setCroppingImage(prompterAgent.avatarUrl);
                              setCroppingTarget('user');
                              setIsGif(prompterAgent.avatarUrl.startsWith('data:image/gif'));
                              if (prompterAgent.avatarCrop) {
                                setCrop(prompterAgent.avatarCrop);
                              } else {
                                setCrop({ x: 0, y: 0, zoom: 1 });
                              }
                            }
                          }}
                          onDragOver={e => {
                            e.preventDefault();
                            setDragOverId('user');
                          }}
                          onDragLeave={() => setDragOverId(null)}
                          onDrop={e => {
                            e.preventDefault();
                            setDragOverId(null);
                            const file = e.dataTransfer.files[0];
                            if (file) handleAvatarUpload(file, 'user');
                          }}
                        >
                          <Avatar className="h-10 w-10 shrink-0 border transition-all hover:border-primary/50 overflow-hidden relative">
                            <AvatarImage
                              src={prompterAgent?.avatarUrl}
                              style={
                                prompterAgent?.avatarCrop
                                  ? {
                                      width: '100%',
                                      height: '100%',
                                      objectFit: 'cover',
                                      // 40px avatar / 400px workspace = 0.1 for translation
                                      // Fine-tuned zoom multiplier + Y-offset correction
                                      transform: `translate(${
                                        prompterAgent.avatarCrop.x * 0.1 + 4
                                      }px, ${prompterAgent.avatarCrop.y * 0.1 + 13.6}px) scale(${
                                        prompterAgent.avatarCrop.zoom * 1.38
                                      })`,
                                    }
                                  : undefined
                              }
                              className={cn(prompterAgent?.avatarCrop && 'max-w-none')}
                            />
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                            <div
                              className={cn(
                                'absolute inset-0 flex flex-col items-center justify-center bg-black/40 transition-all',
                                dragOverId === 'user'
                                  ? 'opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                                  : 'opacity-0 group-hover:opacity-100'
                              )}
                            >
                              <ImagePlus className="h-4 w-4 text-white mb-1" />
                              {dragOverId === 'user' && (
                                <span className="text-[8px] text-white font-bold uppercase tracking-tighter">
                                  Drop
                                </span>
                              )}
                            </div>
                          </Avatar>
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) handleAvatarUpload(file, 'user');
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <div className="flex-1">
                          <Input
                            className="h-7 text-xs"
                            placeholder="Your name (shown in messages)"
                            value={prompterAgent?.name || ''}
                            onChange={e => {
                              if (prompterAgent) {
                                updatePrompterAgent({ name: e.target.value });
                              } else {
                                setPrompterAgent({
                                  id: 'user-agent',
                                  name: e.target.value,
                                  description: '',
                                  avatarUrl: '',
                                });
                              }
                            }}
                          />
                          {/* Removed Avatar URL input as we use drag-and-drop/crop UI */}
                        </div>
                      </div>
                      <Textarea
                        className="min-h-[60px] text-[11px]"
                        placeholder="Describe your role and how you interact..."
                        value={prompterAgent?.description || ''}
                        onChange={e => {
                          if (prompterAgent) {
                            updatePrompterAgent({ description: e.target.value });
                          } else {
                            setPrompterAgent({
                              id: 'user-agent',
                              name: '',
                              description: e.target.value,
                            });
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Global Story Context
                      </p>
                      <Textarea
                        autoComplete="off"
                        className="min-h-[80px] bg-muted/30 text-[11px] placeholder:italic"
                        disabled={isRunning}
                        onChange={e => setStory(e.target.value)}
                        placeholder="Provide global story context or character details for the agents..."
                        value={story}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <aside
          className={`flex max-h-[90vh] flex-col gap-4 self-start overflow-y-auto rounded-xl border bg-background/40 p-4 transition-all duration-300 ease-in-out ${
            sidebarOpen ? 'w-[300px] opacity-100' : 'w-0 p-0 border-0 opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Agents
                </p>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={addAgent}
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
                    title="Add New Agent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            {agents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <p className="text-[11px] text-muted-foreground">
                  No agents in the team. Import or add one to get started!
                </p>
              </div>
            ) : (
              agents.map(agent => {
                const isActive = activeAgentId === agent.id;
                return (
                  <div
                    className={
                      'flex flex-col gap-1 rounded-lg border px-3 py-2 text-sm transition-colors ' +
                      (isActive
                        ? 'border-primary/70 bg-primary/5'
                        : 'border-border bg-background/60')
                    }
                    key={agent.id}
                  >
                    <div className="flex items-center justify-between">
                      {isActive && (
                        <span className="text-[10px] font-medium uppercase tracking-wide text-primary">
                          Speaking
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          asChild
                          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
                          title="Import Agent Role (.md)"
                        >
                          <label style={{ margin: 0 }}>
                            <FileUp className="h-3.5 w-3.5" />
                            <input
                              type="file"
                              className="hidden"
                              accept=".md"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                if (!file.name.endsWith('.md')) {
                                  toast.error(`File ${file.name} is not a Markdown file.`);
                                  e.target.value = '';
                                  return;
                                }
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  const content = ev.target?.result as string;
                                  if (!content) return;
                                  const firstHeadingLine = content
                                    .split(/\r?\n/)
                                    .find(line => line.trim().startsWith('#'));
                                  const label = firstHeadingLine
                                    ? firstHeadingLine.replace(/^#+\s*/, '').trim() || agent.id
                                    : agent.id;
                                  updateAgent(agent.id, {
                                    name: label,
                                    description: content.trim(),
                                  });
                                  toast.success(`Agent \"${label}\" imported successfully!`);
                                };
                                reader.readAsText(file);
                                e.target.value = '';
                              }}
                            />
                          </label>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => exportAgent(agent)}
                          className="h-6 w-6 text-muted-foreground hover:text-primary transition-colors"
                          title="Export Agent Skill"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeAgent(agent.id)}
                          className="h-6 w-6 text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove Agent"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-1 flex gap-2 items-center">
                      <label
                        className="relative group cursor-pointer"
                        onClick={e => {
                          // If avatar already exists, open crop dialog with current settings
                          if (agent.avatarUrl) {
                            e.preventDefault();
                            setCroppingImage(agent.avatarUrl);
                            setCroppingTarget(agent.id);
                            setIsGif(agent.avatarUrl.startsWith('data:image/gif'));
                            if (agent.avatarCrop) {
                              setCrop(agent.avatarCrop);
                            } else {
                              setCrop({ x: 0, y: 0, zoom: 1 });
                            }
                          }
                        }}
                        onDragOver={e => {
                          e.preventDefault();
                          setDragOverId(agent.id);
                        }}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={e => {
                          e.preventDefault();
                          setDragOverId(null);
                          const file = e.dataTransfer.files[0];
                          if (file) handleAvatarUpload(file, agent.id);
                        }}
                      >
                        <Avatar className="h-10 w-10 shrink-0 border transition-all hover:border-primary/50 overflow-hidden relative">
                          <AvatarImage
                            src={agent.avatarUrl}
                            style={
                              agent.avatarCrop
                                ? {
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    // 40px avatar / 400px workspace = 0.1 for translation
                                    // Fine-tuned zoom multiplier + Y-offset correction
                                    transform: `translate(${agent.avatarCrop.x * 0.1 + 4}px, ${
                                      agent.avatarCrop.y * 0.1 + 13.6
                                    }px) scale(${agent.avatarCrop.zoom * 1.38})`,
                                  }
                                : undefined
                            }
                            className={cn(agent.avatarCrop && 'max-w-none')}
                          />
                          <AvatarFallback>
                            <User className="h-4 w-4" />
                          </AvatarFallback>
                          <div
                            className={cn(
                              'absolute inset-0 flex flex-col items-center justify-center bg-black/40 transition-all',
                              dragOverId === agent.id
                                ? 'opacity-100 ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                                : 'opacity-0 group-hover:opacity-100'
                            )}
                          >
                            <ImagePlus className="h-4 w-4 text-white mb-1" />
                            {dragOverId === agent.id && (
                              <span className="text-[8px] text-white font-bold uppercase tracking-tighter">
                                Drop
                              </span>
                            )}
                          </div>
                        </Avatar>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleAvatarUpload(file, agent.id);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      <div className="flex-1">
                        <Input
                          className="h-7 text-xs"
                          placeholder="Agent name (shown in messages)"
                          value={agent.name}
                          onChange={e => updateAgent(agent.id, { name: e.target.value })}
                        />
                        {/* Removed Avatar URL input as we use drag-and-drop/crop UI */}
                      </div>
                    </div>
                    <Textarea
                      className="min-h-[60px] text-[11px] mt-1"
                      placeholder="Describe how this agent should think and speak..."
                      value={agent.description}
                      onChange={e => updateAgent(agent.id, { description: e.target.value })}
                    />
                  </div>
                );
              })
            )}
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
              {croppingImage && (
                <img
                  src={croppingImage}
                  alt="Crop preview"
                  className="w-full h-full object-cover max-w-none pointer-events-none"
                  style={{
                    transform: `translate(${crop.x}px, ${crop.y}px) scale(${crop.zoom})`,
                  }}
                />
              )}

              {/* Zoom Indicator Badge */}
              <div className="absolute top-4 right-4 z-30 pointer-events-none">
                <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-white/80 shadow-xl">
                  {Math.round(crop.zoom * 100)}%
                </div>
              </div>

              {/* Live Avatar Preview */}
              {croppingImage && (
                <div className="absolute top-4 left-4 z-30 pointer-events-none">
                  <div className="bg-black/60 backdrop-blur-md border border-white/20 p-2 rounded">
                    <div className="text-[8px] text-white/60 mb-1 text-center">Preview</div>
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-zinc-800 border border-white/20">
                      <img
                        src={croppingImage}
                        alt="Preview"
                        className="w-full h-full object-cover max-w-none"
                        style={{
                          transform: `translate(${crop.x * 0.1 + 4}px, ${
                            crop.y * 0.1 + 13.6
                          }px) scale(${crop.zoom * 1.38})`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Circular Mask Overlay */}
              <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
                <div
                  className="absolute inset-0 bg-black/60"
                  style={{
                    maskImage:
                      'radial-gradient(circle at center, transparent 160px, black 160.5px)',
                    WebkitMaskImage:
                      'radial-gradient(circle at center, transparent 160px, black 160.5px)',
                  }}
                />
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
      </Dialog>
    </div>
  );
}
