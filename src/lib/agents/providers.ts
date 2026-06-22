import { getLmstudioChatUrl } from '@/lib/lmstudio';
import { formatPlayerMemoryLabel, normalizePlayerMode, type PlayerMode } from '@/lib/player-mode';

export const LMSTUDIO_CHAT_URL = 'http://192.168.12.48:1234/v1/chat/completions';

export const ZEN_CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions';

export const GOOGLE_CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions';

export const HUGGINGFACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';

export const XAI_CHAT_URL = 'https://api.x.ai/v1/chat/completions';

export type ProviderName =
  | 'zen'
  | 'google'
  | 'hf'
  | 'huggingface'
  | 'nvidia'
  | 'lmstudio'
  | 'xai';

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
    xaiApiKey?: string;
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
    case 'xai': {
      const apiKey = options.apiKey || options.xaiApiKey || process.env.XAI_API_KEY;
      const model = options.model || 'grok-3';
      return {
        url: XAI_CHAT_URL,
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
  player?: {
    id: string;
    name: string;
    description: string;
    appearance?: string;
  };
  playerMode?: PlayerMode;
  npcKnowsPlayer?: boolean;
  currentTurnNpcKnewPlayer?: boolean;
  history?: {
    id: string;
    from: 'user' | 'agent';
    text: string;
    agentId?: string;
    playerMode?: PlayerMode;
    npcKnewPlayer?: boolean;
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

function formatPlayerSpeakerLabel(player?: { name?: string }, npcKnowsPlayer = true) {
  if (npcKnowsPlayer === false) return 'Stranger (player)';
  const name = player?.name?.trim();
  return name ? `${name} (player)` : 'Player';
}

export function stripHistoryMessageText(
  text: string,
  agentName: string,
  player?: { name?: string },
  npcKnowsPlayer = true,
) {
  let cleaned = String(text || '').trim();
  if (!cleaned) return '';

  const labels = new Set<string>([
    `${formatPlayerSpeakerLabel(player, npcKnowsPlayer)}:`,
    `${agentName.trim() || 'NPC'} (you, NPC):`,
    'NPC (you, NPC):',
    'Stranger (player):',
    'Player:',
  ]);
  if (player?.name?.trim()) {
    const name = player.name.trim();
    labels.add(`${name} (player):`);
    labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'say')}:`);
    labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'do')}:`);
    labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'think')}:`);
  }
  labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'say')}:`);
  labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'do')}:`);
  labels.add(`${formatPlayerMemoryLabel(player, npcKnowsPlayer, 'think')}:`);
  if (agentName.trim()) {
    labels.add(`${agentName.trim()}:`);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const label of labels) {
      if (cleaned.startsWith(label)) {
        cleaned = cleaned.slice(label.length).trimStart();
        changed = true;
      }
    }
  }

  return cleaned;
}

function buildInCharacterRules(agentName: string) {
  return (
    `Stay in character as ${agentName}. Reply with dialogue and action only — no speaker labels, no name prefixes, no "(you, NPC)", and no behind-the-scenes or production descriptions. ` +
    `Never break the fourth wall or describe cameras, crew, lighting rigs, or filming. `
  );
}

function buildFirstMeetingRules(agentName: string) {
  return (
    `FIRST MEETING (critical): You have never met this person before. You do not know their name, role, or shared history until they reveal it in the conversation. ` +
    `Do not greet them by name, reference past meetings, or imply familiarity until they establish it. ` +
    `You may react to what they say and how they look, but treat them as a stranger meeting ${agentName} for the first time. `
  );
}

function buildGameRoleRules(
  agentName: string,
  player?: { name?: string },
  npcKnowsPlayer = true,
) {
  if (!player) return '';

  if (npcKnowsPlayer === false) {
    return (
      `ROLE RULES (critical): You are ${agentName}. The user controls a stranger you have never met before. ` +
      `Every user message is that stranger speaking or acting — never ${agentName}. ` +
      `When they say "I", "me", or "my", that refers to the stranger only. When they say "you", they address ${agentName}. ` +
      `Do not use the stranger's name until they introduce themselves. Reply as ${agentName}; never speak as the stranger. `
    );
  }

  const playerName = player.name?.trim() || 'the player';
  return (
    `ROLE RULES (critical): You are ${agentName}. The user controls ${playerName}, a separate character in the scene. ` +
    `Every user message is ${playerName} speaking or acting — never ${agentName}. ` +
    `When ${playerName} says "I", "me", or "my", that refers to ${playerName} only. ` +
    `When ${playerName} says "you", they are addressing ${agentName}. ` +
    `Do not reinterpret ${playerName}'s lines as ${agentName}'s thoughts, memories, or self-description. ` +
    `Reply as ${agentName} to ${playerName}; never speak as ${playerName}. `
  );
}

function buildPlayerModeNote(
  playerMode: CallProviderOptions['playerMode'],
  agentName: string,
  player?: { name?: string },
  npcKnowsPlayer = true,
) {
  const playerLabel = formatPlayerSpeakerLabel(player, npcKnowsPlayer);
  const subject = npcKnowsPlayer === false ? 'the stranger' : player?.name?.trim() || 'the player';

  if (normalizePlayerMode(playerMode) === 'say') {
    return (
      `User input is ${playerLabel} dialogue directed at the scene (often at ${agentName}). ` +
      `Parse pronouns from ${subject}'s perspective: "you" means ${agentName}; "I/me/my" means ${subject}. `
    );
  }

  if (playerMode === 'do') {
    return `User input describes actions by ${subject}. Respond as ${agentName} to what ${subject} does. `;
  }

  if (playerMode === 'think') {
    return `User input is ${subject}'s internal thoughts or narration seed. Respond as ${agentName} in the scene. `;
  }

  return '';
}

function formatHistoryMessage(
  entry: NonNullable<CallProviderOptions['history']>[number],
  agentName: string,
  player?: { name?: string },
  npcKnowsPlayer = true,
) {
  const cleanText = stripHistoryMessageText(entry.text, agentName, player, npcKnowsPlayer);

  if (entry.from === 'user') {
    const knowsPlayer =
      entry.npcKnewPlayer !== undefined ? entry.npcKnewPlayer : npcKnowsPlayer;
    return `${formatPlayerMemoryLabel(player, knowsPlayer, entry.playerMode)}: ${cleanText}`;
  }

  return cleanText;
}

function formatCurrentPlayerPrompt(
  prompt: string,
  player?: { name?: string },
  npcKnowsPlayer = true,
  agentName = 'NPC',
  playerMode?: PlayerMode,
) {
  const cleanPrompt = stripHistoryMessageText(prompt, agentName, player, npcKnowsPlayer);
  return `${formatPlayerMemoryLabel(player, npcKnowsPlayer, playerMode)}: ${cleanPrompt}`;
}

export function buildProviderRequest(
  prompt: string,
  agent: { name: string; description: string },
  options: Omit<CallProviderOptions, 'url' | 'apiKey' | 'providerName'>
) {
  const { model, story, steer, player, playerMode, history, temperature, interactionMode, npcKnowsPlayer, currentTurnNpcKnewPlayer } =
    options;

  const knowsPlayer = npcKnowsPlayer !== false;
  const currentTurnKnowsPlayer =
    typeof currentTurnNpcKnewPlayer === 'boolean' ? currentTurnNpcKnewPlayer : knowsPlayer;
  const agentDescription = stripHtmlToText(agent.description);
  const playerDescription = stripHtmlToText(player?.description);
  const storyText = stripHtmlToText(story);
  const steerText = stripHtmlToText(steer);

  const systemPromptBase = agentDescription
    ? `You are ${agent.name}. ${agentDescription}`
    : `You are ${agent.name}.`;

  let context = buildGameRoleRules(agent.name, player, knowsPlayer);
  if (player && !knowsPlayer) context += buildFirstMeetingRules(agent.name);
  if (storyText) context += `The global story context is: ${storyText}. `;
  if (steerText)
    context += `The user has provided a steering note for the next response: ${steerText}. Follow it unless it conflicts with the story or user intent. `;
  if (player) {
    if (knowsPlayer) {
      context += `The player character is ${player.name}: ${playerDescription}. `;
      if (player.appearance?.trim()) {
        context += `${player.name}'s appearance: ${stripHtmlToText(player.appearance)}. `;
      }
    } else if (player.appearance?.trim()) {
      context += `You see a stranger in the scene. Observable appearance: ${stripHtmlToText(player.appearance)}. `;
    } else {
      context += `You see a stranger in the scene whose name and background are unknown to you. `;
    }
  }

  const playerModeNote = buildPlayerModeNote(playerMode, agent.name, player, knowsPlayer);
  if (playerModeNote) context += playerModeNote;

  let personaModeNote = '';
  if (interactionMode === 'cooperative') {
    personaModeNote =
      'Collaborate with other agents: share relevant findings, build on their ideas, and aim for a combined best solution.';
  } else if (interactionMode === 'competitive') {
    personaModeNote =
      "Compete with other agents: argue for your solution, highlight weaknesses in other proposals, and try to earn the user's preference.";
  }
  if (personaModeNote) context += `${personaModeNote} `;

  context += buildInCharacterRules(agent.name);

  const systemPrompt = context
    ? `${systemPromptBase} ${context} Do not simply repeat the user input; answer the user with an appropriate response.`
    : `${systemPromptBase} Do not simply repeat the user input; answer the user with an appropriate response.`;

  const apiMessages: any[] = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length) {
    for (const h of history) {
      if (h.from === 'user') {
        apiMessages.push({
          role: 'user',
          content: player
            ? formatHistoryMessage(h, agent.name, player, knowsPlayer)
            : h.text,
        });
      } else {
        apiMessages.push({
          role: 'assistant',
          content: player
            ? formatHistoryMessage(h, agent.name, player, knowsPlayer)
            : `${h.agentId ? `${h.agentId}: ` : ''}${h.text}`,
        });
      }
    }
  }

  apiMessages.push({
    role: 'user',
    content: player
      ? formatCurrentPlayerPrompt(prompt, player, currentTurnKnowsPlayer, agent.name, playerMode)
      : prompt,
  });

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
  const { url, apiKey, model, providerName, player } = options;

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
      player && typeof player.name === 'string'
        ? player.name.trim()
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

export function stripHtmlImages(text: string): string {
  if (!text) return '';
  return text
    .replace(/<img[^>]+src=["'][^"']+["'][^>]*>/gi, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
