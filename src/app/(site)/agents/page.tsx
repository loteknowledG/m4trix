'use client';
import { FormEvent, useEffect, useMemo, useState, useRef } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
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
import { AgentCard } from '@/components/agent-card';

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
    })();
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