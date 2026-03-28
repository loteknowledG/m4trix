import { useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { DEFAULT_LMSTUDIO_URL, normalizeLmstudioUrl } from '@/lib/lmstudio';
import { AGENTS as DEFAULT_AGENTS } from './default-agents';
import type { Agent, AgentId, AgentsResponse, ChatMessage } from './types';
import type { ModelOption, Provider } from './use-character-connections';

type PrompterMode = 'tell' | 'do' | 'think';

type UseCharacterChatArgs = {
  activeProvider: Provider;
  agents: Agent[];
  hfApiKey: string;
  lmstudioUrl: string;
  model: string;
  modelOptions: ModelOption[];
  prompterAgent: Agent | null;
  prompterMode: PrompterMode;
  setAgents: (value: Agent[] | ((prev: Agent[]) => Agent[])) => void;
  story: string;
  googleApiKey: string;
  nvidiaApiKey: string;
  zenApiKey: string;
};

function mapServerMessages(data: AgentsResponse['messages']) {
  return data.map(m => {
    if (m.from === 'user') {
      return { id: m.id, from: 'user' as const, text: m.text };
    }

    return {
      id: m.id,
      from: (m.agentId as AgentId | undefined) ?? ('researcher' as AgentId),
      text: m.text,
    };
  });
}

export function useCharacterChat({
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
}: UseCharacterChatArgs) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const timeoutsRef = useRef<number[]>([]);

  const clearScriptTimeouts = () => {
    if (!timeoutsRef.current.length) return;
    for (const id of timeoutsRef.current) {
      clearTimeout(id);
    }
    timeoutsRef.current = [];
  };

  const streamMessageText = async (
    messageId: string,
    fullText: string,
    targetPos?: number,
    stream: boolean = false
  ) => {
    if (!stream) {
      setMessages(prev => {
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

        if (!found) {
          return [...next, { id: messageId, from: 'agent', text: fullText }];
        }
        return next;
      });
      return;
    }

    const words = fullText.split(' ');
    let current = '';

    for (let i = 0; i < words.length; i++) {
      current += (i > 0 ? ' ' : '') + words[i];
      setMessages(prev => {
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

        if (!found) {
          return [...next, { id: messageId, from: 'agent', text: current }];
        }
        return next;
      });

      await new Promise(resolve => setTimeout(resolve, Math.random() * 60 + 20));
    }
  };

  const restartConversation = () => {
    clearScriptTimeouts();
    setMessages([]);
    setPrompt('');
    setError(null);
  };

  const runDemo = async (promptText?: string) => {
    clearScriptTimeouts();
    setError(null);
    setIsRunning(true);

    try {
      const effectivePrompt = (promptText ?? prompt).trim();

      if (!effectivePrompt) throw new Error('Please enter a prompt for the agents.');
      if (!model.trim()) throw new Error('Please select a model for the agents.');
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

      const historyForApi = messages.map(m =>
        m.from === 'user'
          ? { id: m.id, from: 'user', text: m.text }
          : { id: m.id, from: 'agent', agentId: m.from, text: m.text }
      );

      const temporaryUserMessageId = `user-${Date.now()}`;
      setMessages(prev => [
        ...prev,
        { id: temporaryUserMessageId, from: 'user', text: effectivePrompt },
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
        history: historyForApi,
      };

      requestBody.provider = modelProvider;
      if (modelProvider === 'zen') requestBody.zenApiKey = zenApiKey;
      else if (modelProvider === 'google') requestBody.googleApiKey = googleApiKey;
      else if (modelProvider === 'nvidia') requestBody.nvidiaApiKey = nvidiaApiKey;
      else if (modelProvider === 'huggingface') requestBody.hfApiKey = hfApiKey;

      const selectedModelObj = modelOptions.find(o => o.id === model);
      const lmstudioSelected =
        (selectedModelObj && selectedModelObj.provider === 'lmstudio') ||
        modelProvider === 'lmstudio' ||
        activeProvider === 'lmstudio';
      if (lmstudioSelected) {
        requestBody.provider = 'lmstudio';
        requestBody.lmstudioUrl = normalizeLmstudioUrl(lmstudioUrl || DEFAULT_LMSTUDIO_URL);
      } else {
        delete requestBody.lmstudioUrl;
      }

      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed with status ${res.status}`);
      }

      const data = (await res.json()) as AgentsResponse;
      setAgents(data.agents && data.agents.length ? data.agents : DEFAULT_AGENTS);
      if (data.error) setError(data.error);

      const mapped = mapServerMessages(data.messages);
      const prevIds = new Set<string>();
      const serverIdCounts: Record<string, number> = {};
      const seenClientIds = new Set<string>();
      const clientIds: string[] = [];
      const clientPositions: number[] = [];

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

          const serverBases = new Set(mapped.map(m => m.id));
          const filteredPrev = prev.filter(m => {
            if (m.id === temporaryUserMessageId) return false;
            for (const base of serverBases) {
              if (m.id === base || m.id.startsWith(`${base}-`)) return false;
            }
            return true;
          });

          const placeholders: ChatMessage[] = [];
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

            placeholders.push(placeholder);
            clientPositions[idx] = startIndex + placeholderCounter;
            placeholderCounter += 1;
          }

          return [...filteredPrev, ...placeholders];
        });
      });

      const lastAgentIndex = mapped.reduce((acc, m, idx) => (m.from !== 'user' ? idx : acc), -1);

      for (let i = 0; i < mapped.length; i++) {
        const msg = mapped[i];
        const clientId = clientIds[i];
        const targetPos =
          typeof clientPositions[i] === 'number' ? clientPositions[i] : undefined;
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

  return {
    error,
    isRunning,
    messages,
    prompt,
    restartConversation,
    runDemo,
    setPrompt,
  };
}
