import { getLmstudioChatUrl } from '@/lib/lmstudio';

export const LMSTUDIO_CHAT_URL = 'http://192.168.12.48:1234/v1/chat/completions';

export const ZEN_CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions';

export const GOOGLE_CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions';

export const HUGGINGFACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';

export type ProviderName = 'zen' | 'google' | 'hf' | 'huggingface' | 'nvidia' | 'lmstudio';

export type ProviderConfig = {
  url: string;
  apiKey?: string;
  model: string;
};

export function getProviderConfig(
  provider: string,
  options: {
    model?: string;
    apiKey?: string;
    lmstudioUrl?: string;
    zenApiKey?: string;
    googleApiKey?: string;
    hfApiKey?: string;
    nvidiaApiKey?: string;
  }
): ProviderConfig {
  switch (provider) {
    case 'zen': {
      const apiKey = options.apiKey || options.zenApiKey || process.env.ZEN_API_KEY;
      const model = options.model || process.env.ZEN_MODEL;
      return {
        url: ZEN_CHAT_URL,
        apiKey,
        model: model || '',
      };
    }
    case 'google': {
      const apiKey =
        options.apiKey || options.googleApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      const model = options.model || 'gemini-2.0-flash';
      return {
        url: GOOGLE_CHAT_URL,
        apiKey,
        model,
      };
    }
    case 'hf':
    case 'huggingface': {
      const apiKey = options.apiKey || options.hfApiKey || process.env.HUGGINGFACE_API_KEY;
      const model = options.model || 'Qwen/Qwen2.5-7B-Instruct';
      return {
        url: HUGGINGFACE_CHAT_URL,
        apiKey,
        model,
      };
    }
    case 'nvidia': {
      const apiKey = options.apiKey || options.nvidiaApiKey || process.env.NVIDIA_API_KEY;
      const model = options.model || 'nvidia/llama-3.1-nemotron-70b-instruct';
      return {
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        apiKey,
        model,
      };
    }
    case 'lmstudio': {
      const url = options.lmstudioUrl ? getLmstudioChatUrl(options.lmstudioUrl) : LMSTUDIO_CHAT_URL;
      return {
        url,
        apiKey: '',
        model: options.model || '',
      };
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

export type CallProviderOptions = {
  url: string;
  apiKey: string;
  model: string;
  providerName: string;
  story?: string;
  steer?: string;
  coordinatorAgent?: {
    id: string;
    name: string;
    description: string;
  };
  coordinatorMode?: 'tell' | 'do' | 'think';
  history?: {
    id: string;
    from: 'user' | 'agent';
    text: string;
    agentId?: string;
  }[];
  temperature?: number;
  interactionMode?: 'neutral' | 'cooperative' | 'competitive';
};

function stripHtmlToText(value?: string) {
  if (!value) return '';

  return value
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*\/div\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function buildProviderRequest(
  prompt: string,
  agent: { name: string; description: string },
  options: Omit<CallProviderOptions, 'url' | 'apiKey' | 'providerName'>
) {
  const { model, story, steer, coordinatorAgent, coordinatorMode, history, temperature, interactionMode } =
    options;

  const agentDescription = stripHtmlToText(agent.description);
  const coordinatorDescription = stripHtmlToText(coordinatorAgent?.description);
  const storyText = stripHtmlToText(story);
  const steerText = stripHtmlToText(steer);

  const systemPromptBase = agentDescription
    ? `You are ${agent.name}. ${agentDescription}`
    : `You are ${agent.name}.`;

  let context = '';
  if (storyText) context += `The global story context is: ${storyText}. `;
  if (steerText)
    context += `The user has provided a steering note for the next response: ${steerText}. Follow it unless it conflicts with the story or user intent. `;
  if (coordinatorAgent)
    context += `The user is playing the role of ${coordinatorAgent.name}: ${coordinatorDescription}. `;

  let coordinatorModeNote = '';
  if (coordinatorMode === 'tell') {
    coordinatorModeNote =
      "Treat the user input as the coordinator speaking in-character (dialogue). Interpret first-person lines as the coordinator's voice and respond accordingly.";
  } else if (coordinatorMode === 'do') {
    coordinatorModeNote =
      'Treat the user input as a description of actions. Focus replies on concrete steps, execution details, and expected outcomes.';
  } else if (coordinatorMode === 'think') {
    coordinatorModeNote =
      'Treat the user input as a seed sentence to expand into a detailed, vivid narrative. When appropriate, expand the sentence into a short scene with sensory detail and internal thoughts.';
  }

  if (coordinatorModeNote) context += `${coordinatorModeNote} `;

  let personaModeNote = '';
  if (interactionMode === 'cooperative') {
    personaModeNote =
      'Collaborate with other agents: share relevant findings, build on their ideas, and aim for a combined best solution.';
  } else if (interactionMode === 'competitive') {
    personaModeNote =
      "Compete with other agents: argue for your solution, highlight weaknesses in other proposals, and try to earn the user's preference.";
  }
  if (personaModeNote) context += `${personaModeNote} `;

  const systemPrompt = context
    ? `${systemPromptBase} ${context} Do not simply repeat the user input; answer the user with an appropriate response.`
    : `${systemPromptBase} Do not simply repeat the user input; answer the user with an appropriate response.`;

  const apiMessages: any[] = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length) {
    for (const h of history) {
      if (h.from === 'user') {
        apiMessages.push({ role: 'user', content: h.text });
      } else {
        const prefix = h.agentId ? `${h.agentId}: ` : '';
        apiMessages.push({ role: 'assistant', content: `${prefix}${h.text}` });
      }
    }
  }

  apiMessages.push({ role: 'user', content: prompt });

  const providerPayload = {
    model,
    messages: apiMessages,
    max_tokens: 300,
    temperature: typeof temperature === 'number' ? temperature : 0.7,
  };

  return {
    systemPrompt,
    apiMessages,
    providerPayload,
  };
}

export async function callProvider(
  prompt: string,
  agent: { name: string; description: string },
  options: CallProviderOptions
): Promise<string> {
  const { url, apiKey, model, providerName, coordinatorAgent } = options;

  const { providerPayload } = buildProviderRequest(prompt, agent, options);

  if (providerName.toLowerCase() === 'lmstudio' && !String(model || '').trim()) {
    throw new Error('LM Studio model is missing. Select a model before sending a request.');
  }

  const controller = new AbortController();
  const timeoutMs = providerName.toLowerCase() === 'lmstudio' ? 90000 : 60000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(providerPayload),
      signal: controller.signal,
    });
  } catch (error) {
    if ((error as any)?.name === 'AbortError') {
      throw new Error(`${providerName} request timed out after ${Math.round(timeoutMs / 1000)}s`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`${providerName} error ${response.status}: ${text || response.statusText}`);
  }

  const data = (await response.json()) as any;

  const message = data?.choices?.[0]?.message;

  let content: string | undefined;

  if (typeof message?.content === 'string' && message.content.trim().length > 0) {
    content = message.content;
  } else if (
    typeof message?.reasoning_content === 'string' &&
    message.reasoning_content.trim().length > 0
  ) {
    content = message.reasoning_content;
  } else if (Array.isArray(message?.content)) {
    const textParts = message.content
      .map((part: any) => {
        if (!part) return '';
        if (typeof part === 'string') return part;
        if (typeof part.text === 'string') return part.text;
        return '';
      })
      .filter(Boolean);
    const joined = textParts.join(' ').trim();
    if (joined) {
      content = joined;
    }
  }

  if (!content) {
    const errorMessage =
      data?.error?.message ||
      data?.error?.error ||
      (typeof data?.error === 'string' ? data.error : undefined);

    if (errorMessage) {
      throw new Error(`${providerName} error: ${errorMessage}`);
    }

    const debugSnippet = (() => {
      try {
        const raw = JSON.stringify(data);
        return raw.length > 400 ? `${raw.slice(0, 400)}…` : raw;
      } catch {
        return '<unserializable payload>';
      }
    })();

    throw new Error(`${providerName} response missing content. Raw payload: ${debugSnippet}`);
  }

  const normalizedPrompt = prompt.trim().toLowerCase();
  const normalizedContent = content.trim().toLowerCase();
  const isEcho =
    normalizedPrompt &&
    normalizedContent.includes(normalizedPrompt) &&
    normalizedContent.length <=
      Math.max(normalizedPrompt.length * 1.5, normalizedPrompt.length + 10);

  if (isEcho) {
    return "It looks like I'm just repeating what you said — please ask a specific question or describe what you want help with, and I'll respond accordingly.";
  }

  // Sanitization: ensure agents do NOT impersonate the prompter/user
  try {
    const prompterName =
      coordinatorAgent && typeof coordinatorAgent.name === 'string'
        ? coordinatorAgent.name.trim()
        : '';
    if (prompterName) {
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = escapeRegExp(prompterName);

      const leadingMentionRe = new RegExp(`^\\s*@?${namePattern}\\s*[:-–—]?\\s*`, 'i');
      const firstPersonRe = new RegExp(
        `\\b(?:I\\'m|I am|I'm|My name is|As)\\s+${namePattern}\\b`,
        'i'
      );

      const hasLeading = leadingMentionRe.test(content);
      const hasFirstPerson = firstPersonRe.test(content);

      if (hasLeading || hasFirstPerson) {
        const cleaned = content
          .split(/\r?\n/)
          .map(line => line.replace(leadingMentionRe, '').replace(firstPersonRe, '[the user]'))
          .join('\n')
          .trim();
        content = cleaned;
      }
    }
  } catch (e) {
    // noop
  }

  return content.trim();
}
