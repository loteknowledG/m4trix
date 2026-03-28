import type { NextRequest } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';

const LMSTUDIO_CHAT_URL = 'http://192.168.12.48:1234/v1/chat/completions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Hardcoded OpenCode chat completions endpoint.
const ZEN_CHAT_URL = 'https://opencode.ai/zen/v1/chat/completions';

// Google Gemini OpenAI-compatible chat completions endpoint.
const GOOGLE_CHAT_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/v1/chat/completions';

// Hugging Face Router API endpoint (better compatibility for models like GLM-4.5).
const HUGGINGFACE_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions';

type AgentId = 'researcher' | 'critic' | 'summarizer';

export type Agent = {
  id: AgentId;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: { x: number; y: number; zoom: number };
};

export type OrchestratedMessage = {
  id: string;
  from: 'user' | 'agent';
  text: string;
  /**
   * Which agent produced this message (if from === "agent").
   * The client can use this to render badges/avatars.
   */
  agentId?: AgentId;
  /** If a message is relayed (agent spoke for another agent) this records the origin. */
  relayedBy?: AgentId;
};

export type AgentsRequest = {
  /**
   * The user instruction / query the team of agents should work on.
   */
  prompt: string;
  /**
   * Optional maximum number of agent turns you want the coordinator to take.
   * Not used in the demo implementation, but kept for future logic.
   */
  maxTurns?: number;
  /**
   * Optional model identifier to use for this run.
   * When provided and Zen is configured, overrides ZEN_MODEL.
   */
  model?: string;
  /**
   * Optional agents configuration provided by the client.
   * When present, overrides the default DEMO_AGENTS for this call.
   */
  agents?: Agent[];
  /**
   * Optional global story context / persona for the agents.
   * When provided, it is included in the system prompt so agents
   * can tailor their responses to that background.
   */
  story?: string;
  /**
   * Optional agent persona for the coordinator (user acting as a role).
   */
  coordinatorAgent?: Agent;
  /**
   * Optional conversation history (client-side). When provided and
   * `stateless` is false, this will be used to seed the running
   * transcript so agents can remember prior turns.
   */
  history?: OrchestratedMessage[];
  /**
   * Coordinator mode controls how the user's input should be interpreted by agents.
   * - "tell": the coordinator is speaking (dialogue)
   * - "do": the coordinator is describing actions
   * - "think": expand the sentence into a detailed story
   */
  coordinatorMode?: 'tell' | 'do' | 'think';
  /**
   * Orchestration mode for this run. "auto" lets the server decide
   * (default). "sequential" forces turn-taking; "parallel" runs
   * all agents independently.
   */
  orchestration?: 'auto' | 'sequential' | 'parallel';
  /**
   * Interaction mode for agent dynamics: "neutral" (default),
   * "cooperative" (agents collaborate), or "competitive" (agents compete).
   */
  interactionMode?: 'neutral' | 'cooperative' | 'competitive';
  /**
   * When true, agents will NOT receive prior-turn history; each agent only
   * sees the current user prompt (stateless run).
   */
  stateless?: boolean;
};

export type AgentsResponse = {
  agents: Agent[];
  messages: OrchestratedMessage[];
  mode: 'demo' | 'live';
  error?: string;
};

const AGENT_MARKDOWN_DIR = path.join(process.cwd(), 'agents');

const AGENT_DEFAULT_NAMES: Record<AgentId, string> = {
  researcher: 'Researcher',
  critic: 'Critic',
  summarizer: 'Summarizer',
};

const AGENT_FALLBACK_DESCRIPTIONS: Record<AgentId, string> = {
  researcher: 'Finds facts, breaks down the problem, and proposes options.',
  critic: 'Challenges assumptions, looks for risks and edge cases.',
  summarizer: 'Condenses the discussion into a concise plan.',
};

async function loadAgentDescriptionFromMarkdown(agentId: AgentId): Promise<string | null> {
  try {
    const filePath = path.join(AGENT_MARKDOWN_DIR, `${agentId}.md`);
    const raw = await fs.readFile(filePath, 'utf8');
    return raw.trim();
  } catch {
    return null;
  }
}

async function getDefaultAgents(): Promise<Agent[]> {
  const ids: AgentId[] = ['researcher', 'critic', 'summarizer'];

  const agents: Agent[] = [];
  for (const id of ids) {
    const descriptionFromFile = await loadAgentDescriptionFromMarkdown(id);
    agents.push({
      id,
      name: AGENT_DEFAULT_NAMES[id],
      description: descriptionFromFile ?? AGENT_FALLBACK_DESCRIPTIONS[id],
    });
  }

  return agents;
}

/**
 * Heuristic to detect agent->agent instructions in the user's prompt.
 * If true, we prefer sequential orchestration so the addressed agent
 * can see and respond to the prior agent's output.
 */
function looksLikeAgentToAgentInstruction(prompt: string, agents: Agent[]): boolean {
  if (!prompt || !agents || !agents.length) return false;

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const ids = agents.map(a => escape(a.id)).join('|');
  const names = agents
    .map(a => escape((a.name || '').toLowerCase()))
    .filter(Boolean)
    .join('|');

  // explicit @mentions: @critic, @researcher, etc.
  const mentionRegex = new RegExp(`@(${ids})\\b`, 'i');
  if (mentionRegex.test(prompt)) return true;

  // direct instruction to an agent: "tell the critic to", "ask summarizer to"
  const directInstrRegex = new RegExp(
    `\\b(?:tell|ask|instruct|have|order|request|direct)\\b[\\s\\S]{0,60}?\\b(${ids}|${names})\\b`,
    'i'
  );
  if (directInstrRegex.test(prompt)) return true;

  // agent-to-agent patterns: "critic, respond to researcher" or "researcher asks critic to"
  const agentPairRegex = new RegExp(
    `\\b(${ids}|${names})\\b[\\s\\S]{0,60}?(?:to|ask|tell|instruct|respond|reply|evaluate|criticize)[\\s\\S]{0,60}?\\b(${ids}|${names})\\b`,
    'i'
  );
  if (agentPairRegex.test(prompt)) return true;

  return false;
}

/**
 * Decide orchestration deterministically per the user's rule:
 * - If agents are being instructed to talk to each other => sequential
 * - Otherwise => parallel
 */
function decideOrchestrationAuto(prompt: string, agents: Agent[]): 'sequential' | 'parallel' {
  return looksLikeAgentToAgentInstruction(prompt, agents) ? 'sequential' : 'parallel';
}

// configuration for how many history entries we feed back to models when the
// client requests prior turns.  We slice the shared transcript, not maintain
// separate queues per agent.
const HISTORY_LIMIT = 6;

function sliceHistory(fullHistory?: OrchestratedMessage[]): OrchestratedMessage[] | undefined {
  if (!Array.isArray(fullHistory) || fullHistory.length === 0) return undefined;
  const start = Math.max(0, fullHistory.length - HISTORY_LIMIT);
  return fullHistory.slice(start);
}

async function callProvider(
  prompt: string,
  agent: Agent,
  options: {
    url: string;
    apiKey: string;
    model: string;
    providerName: string;
    story?: string;
    coordinatorAgent?: Agent;
    /** Controls how the coordinator's input is interpreted by the model */
    coordinatorMode?: 'tell' | 'do' | 'think';
    /** running transcript so the agent can see prior user/agent messages */
    history?: OrchestratedMessage[];
    /** allow caller to override temperature for deterministic replies */
    temperature?: number;
    /** interaction mode to guide agent behavior (neutral/cooperative/competitive) */
    interactionMode?: 'neutral' | 'cooperative' | 'competitive';
  }
): Promise<string> {
  const {
    url,
    apiKey,
    model,
    providerName,
    story,
    coordinatorAgent,
    coordinatorMode,
    history,
    temperature,
    interactionMode,
  } = options;

  // note: history trimming is handled by the caller rather than the provider.
  // the older implementation kept a tiny per-agent queue; we now simply slice
  // the most recent messages from the shared transcript before sending them.

  const systemPromptBase = `You are ${agent.name}. ${agent.description}`.trim();

  let context = '';
  if (story) context += `The global story context is: ${story}. `;
  if (coordinatorAgent)
    context += `The user is playing the role of ${coordinatorAgent.name}: ${coordinatorAgent.description}. `;

  // Apply mode-specific guidance derived from `coordinatorMode` (tell | do | think)
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

  // Stronger persona enforcement so agents reliably "stay in character"
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
    ? `${systemPromptBase} ${context} Do not simply repeat the user input; answer the user with a helpful and informative response.`
    : `${systemPromptBase} Do not simply repeat the user input; answer the user with a helpful and informative response.`;

  // Build a messages array that includes system + optional transcript history + the current user prompt
  const apiMessages: any[] = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length) {
    for (const h of history) {
      if (h.from === 'user') {
        apiMessages.push({ role: 'user', content: h.text });
      } else {
        // agent messages are represented as assistant role; prefix with agentId for clarity
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

  // Some providers (like Zen) may return text in different fields:
  // - message.content (string or rich object)
  // - message.reasoning_content
  // Try a few reasonable fallbacks before treating the response as invalid.
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
    // Handle content as an array of parts, e.g. [{ type: "text", text: "..." }]
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

  // If the model is just echoing the user prompt, return a helpful fallback instead.
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
      const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const namePattern = escapeRegExp(prompterName);

      const leadingMentionRe = new RegExp(`^\\s*@?${namePattern}\\s*[:\-–—]?\\s*`, 'i');
      const firstPersonRe = new RegExp(
        `\\b(?:I\\'m|I am|I'm|My name is|As)\\s+${namePattern}\\b`,
        'i'
      );

      const hasLeading = leadingMentionRe.test(content);
      const hasFirstPerson = firstPersonRe.test(content);

      if (hasLeading || hasFirstPerson) {
        const cleaned = content
          .split(/\\r?\\n/)
          .map(line => line.replace(leadingMentionRe, '').replace(firstPersonRe, '[the user]'))
          .join('\n')
          .trim();
        content = cleaned;
      }
    }
  } catch (e) {
    // noop - if sanitization fails we still return the original content below
  }

  return content.trim();
}

async function callOpenCodeForAgent(
  prompt: string,
  agent: Agent,
  modelOverride?: string,
  story?: string,
  coordinatorAgent?: Agent,
  coordinatorMode?: 'tell' | 'do' | 'think',
  zenApiKeyOverride?: string,
  history?: OrchestratedMessage[],
  temperature?: number,
  interactionMode?: 'neutral' | 'cooperative' | 'competitive'
): Promise<string> {
  const zenApiKey = zenApiKeyOverride || process.env.ZEN_API_KEY;
  const zenModelFromEnv = process.env.ZEN_MODEL;

  const zenModelToUse = modelOverride || zenModelFromEnv;

  const zenConfigured = Boolean(ZEN_CHAT_URL && zenApiKey && zenModelToUse);

  if (!zenConfigured) {
    throw new Error(
      'No OpenCode configuration: set ZEN_API_KEY or provide a per-session zenApiKey, plus ZEN_MODEL or a model override.'
    );
  }

  return await callProvider(prompt, agent, {
    url: ZEN_CHAT_URL,
    apiKey: zenApiKey!,
    model: zenModelToUse!,
    providerName: 'Zen',
    story,
    coordinatorAgent,
    coordinatorMode,
    history,
    temperature,
    interactionMode,
  });
}

async function callGoogleAIForAgent(
  prompt: string,
  agent: Agent,
  modelOverride?: string,
  story?: string,
  coordinatorAgent?: Agent,
  coordinatorMode?: 'tell' | 'do' | 'think',
  googleApiKeyOverride?: string,
  history?: OrchestratedMessage[],
  temperature?: number,
  interactionMode?: 'neutral' | 'cooperative' | 'competitive'
): Promise<string> {
  const googleApiKey = googleApiKeyOverride || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const googleModelFromEnv = process.env.GOOGLE_MODEL || 'gemini-1.5-flash';

  const googleModelToUse = modelOverride || googleModelFromEnv;

  const googleConfigured = Boolean(GOOGLE_CHAT_URL && googleApiKey && googleModelToUse);

  if (!googleConfigured) {
    throw new Error(
      'No Google AI configuration: set GOOGLE_GENERATIVE_AI_API_KEY or provide a per-session googleApiKey, plus GOOGLE_MODEL or a model override.'
    );
  }

  return await callProvider(prompt, agent, {
    url: GOOGLE_CHAT_URL,
    apiKey: googleApiKey!,
    model: googleModelToUse!,
    providerName: 'Google Gemini',
    story,
    coordinatorAgent,
    coordinatorMode,
    history,
    temperature,
    interactionMode,
  });
}

async function callHuggingFaceForAgent(
  prompt: string,
  agent: Agent,
  modelOverride?: string,
  story?: string,
  coordinatorAgent?: Agent,
  coordinatorMode?: 'tell' | 'do' | 'think',
  hfApiKeyOverride?: string,
  history?: OrchestratedMessage[],
  temperature?: number,
  interactionMode?: 'neutral' | 'cooperative' | 'competitive'
): Promise<string> {
  const hfApiKey = hfApiKeyOverride || process.env.HUGGINGFACE_API_KEY;
  const hfModelToUse = modelOverride || 'meta-llama/Llama-3-8b-instruct';

  if (!hfApiKey) {
    throw new Error(
      'No Hugging Face configuration: set HUGGINGFACE_API_KEY or provide a per-session hfApiKey.'
    );
  }

  return await callProvider(prompt, agent, {
    url: HUGGINGFACE_CHAT_URL,
    apiKey: hfApiKey,
    model: hfModelToUse,
    providerName: 'Hugging Face',
    story,
    coordinatorAgent,
    coordinatorMode,
    history,
    temperature,
    interactionMode,
  });
}

async function buildModelTranscript(
  prompt: string,
  agents: Agent[],
  apiKeys: {
    zenApiKey?: string;
    googleApiKey?: string;
    hfApiKey?: string;
    nvidiaApiKey?: string;
    lmstudioUrl?: string;
  },
  modelOverride?: string,
  story?: string,
  coordinatorAgent?: Agent,
  coordinatorMode?: 'tell' | 'do' | 'think',
  initialHistory?: OrchestratedMessage[],
  orchestration: 'sequential' | 'parallel' = 'sequential',
  interactionMode: 'neutral' | 'cooperative' | 'competitive' = 'neutral',
  includeHistory: boolean = true,
  providerOverride?: string
): Promise<OrchestratedMessage[]> {
  const baseId = Date.now().toString(36);

  // Seed the running transcript with any provided client-side history
  // unless the caller explicitly requested a stateless run.
  let messages: OrchestratedMessage[] = [];
  if (includeHistory && Array.isArray(initialHistory) && initialHistory.length) {
    // shallow-clone incoming history to avoid mutation
    messages = initialHistory.map(h => ({ ...h }));

    // avoid duplicating the current prompt if the last history entry
    // already contains it
    const last = messages[messages.length - 1];
    if (!(last && last.from === 'user' && last.text.trim() === prompt.trim())) {
      messages.push({ id: `${baseId}-u0`, from: 'user', text: prompt });
    }
  } else {
    messages = [
      {
        id: `${baseId}-u0`,
        from: 'user',
        text: prompt,
      },
    ];
  }

  // Decide which provider to use.
  const isGoogle = Boolean(apiKeys.googleApiKey);
  const isHF = Boolean(apiKeys.hfApiKey);
  const isLmstudio = providerOverride === 'lmstudio';
  let lmstudioUrl = LMSTUDIO_CHAT_URL;
  if (
    providerOverride === 'lmstudio' &&
    typeof arguments[2]?.lmstudioUrl === 'string' &&
    arguments[2].lmstudioUrl
  ) {
    // Remove trailing slash
    let base = arguments[2].lmstudioUrl.replace(/\/$/, '');
    // Remove any trailing /v1/chat/completions or /v1/chat/completions/
    base = base.replace(/\/v1\/chat\/completions\/?$/, '');
    lmstudioUrl = base + '/v1/chat/completions';
  }

  // Helper: detect/sanitize attempts by an agent to speak *as* another agent.
  const sanitizeAgentImpersonation = (raw: string | undefined, currentAgent: Agent) => {
    if (!raw) return raw || '';
    try {
      const otherNames = agents
        .filter(a => a.id !== currentAgent.id)
        .map(a => (a.name || a.id).trim())
        .filter(Boolean);
      if (!otherNames.length) return raw;

      const escape = (s: string) => s.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const namePattern = otherNames.map(escape).join('|');

      const leadingMentionRe = new RegExp(`^\\s*@?(?:${namePattern})\\b\\s*[:\-–—]?\\s*`, 'i');
      const firstPersonRe = new RegExp(
        `\\b(?:I\\'m|I am|I'm|My name is|As)\\s+(?:${namePattern})\\b`,
        'i'
      );

      const hasLeading = leadingMentionRe.test(raw);
      const hasFirstPerson = firstPersonRe.test(raw);

      if (hasLeading || hasFirstPerson) {
        const cleaned = raw
          .split(/\\r?\\n/)
          .map(line =>
            line.replace(leadingMentionRe, '').replace(firstPersonRe, '[the other agent]')
          )
          .join('\n')
          .trim();
        console.warn(`Sanitized agent impersonation by ${currentAgent.id || currentAgent.name}`);
        return `[Sanitized — agent must not speak as another agent] ${cleaned}`;
      }

      return raw;
    } catch (e) {
      return raw;
    }
  };

  // Interaction-mode may influence orchestration choice.
  const orchestrationToUse =
    interactionMode === 'cooperative'
      ? 'sequential'
      : interactionMode === 'competitive'
      ? 'parallel'
      : orchestration;
  const lmstudioOrchestration = isLmstudio ? 'sequential' : orchestrationToUse;
  const agentsToRun = isLmstudio ? agents.slice(0, 1) : agents;

  if (lmstudioOrchestration === 'parallel') {
    // Parallel: call all agents at once; they only see the user's prompt.
    const agentReplies = await Promise.all(
      agentsToRun.map(async agent => {
        // If the client requested history, give every agent the last N
        // entries of the shared transcript.  No more per-agent queues.
        const historyForAgent = includeHistory ? sliceHistory(messages) : undefined;

        let text;
        if (isLmstudio) {
        text = await callProvider(prompt, agent, {
          url: lmstudioUrl,
          apiKey: '', // LM Studio may not require an API key
          model: modelOverride || '',
          providerName: 'lmstudio',
            story,
            coordinatorAgent,
            coordinatorMode,
            history: historyForAgent,
            temperature: 0.3,
            interactionMode,
          });
        } else if (isGoogle) {
          text = await callGoogleAIForAgent(
            prompt,
            agent,
            modelOverride,
            story,
            coordinatorAgent,
            coordinatorMode,
            apiKeys.googleApiKey,
            historyForAgent,
            0.3,
            interactionMode
          );
        } else if (isHF) {
          text = await callHuggingFaceForAgent(
            prompt,
            agent,
            modelOverride,
            story,
            coordinatorAgent,
            coordinatorMode,
            apiKeys.hfApiKey,
            historyForAgent,
            0.3,
            interactionMode
          );
        } else {
          text = await callOpenCodeForAgent(
            prompt,
            agent,
            modelOverride,
            story,
            coordinatorAgent,
            coordinatorMode,
            apiKeys.zenApiKey,
            historyForAgent,
            0.3,
            interactionMode
          );
        }
        // If the agent's reply begins with another agent's name, consider it
        // as that agent speaking (change heading). If it impersonates the
        // prompter/user, sanitize instead.
        const parsed = ((): { target?: Agent; cleaned: string; impersonatesPrompter?: boolean } => {
          try {
            // quick heuristic using a regex for @name or leading 'Name:'
            const raw = String(text || '');
            const mentionMatch = raw.match(/^\s*@?([A-Za-z0-9\- ]{2,40})\s*[:\-–—]?\s*/);
            if (!mentionMatch) return { cleaned: raw };
            const name = mentionMatch[1].trim().toLowerCase();
            const target = agents.find(
              a =>
                (a.name || a.id).toLowerCase().split(' ')[0] === name ||
                a.name?.toLowerCase() === name ||
                a.id.toLowerCase() === name
            );
            const after = raw.replace(/^\s*@?[A-Za-z0-9\- ]{2,40}\s*[:\-–—]?\s*/, '').trim();
            if (!target) {
              // if the mention looks like the prompter name, flag impersonation
              if (
                coordinatorAgent &&
                coordinatorAgent.name &&
                coordinatorAgent.name.toLowerCase().includes(name)
              ) {
                return { impersonatesPrompter: true, cleaned: after || raw };
              }
              return { cleaned: after || raw };
            }
            // disallow speaking as the prompter even if name matches
            if (
              coordinatorAgent &&
              (target.name === coordinatorAgent.name || target.id === (coordinatorAgent.id as any))
            ) {
              return { impersonatesPrompter: true, cleaned: after || raw };
            }
            return { target, cleaned: after || '' };
          } catch (e) {
            return { cleaned: String(text || '') };
          }
        })();

        if (parsed.impersonatesPrompter) {
          // Treat this as the prompter (user) speaking — return a placeholder
          // with no `agent` so the caller will push a user message.
          return { agent: undefined, text: parsed.cleaned } as any;
        }

        if (parsed.target) {
          // attribute this reply to the mentioned agent (change heading)
          return { agent: parsed.target, text: parsed.cleaned };
        }

        return { agent, text: sanitizeAgentImpersonation(text, agent) };
      })
    );

    for (const item of agentReplies) {
      const { agent, text } = item as { agent?: Agent; text: string };
      if (!agent) {
        // message attributed to the prompter/user
        messages.push({ id: `${baseId}-u${messages.length}`, from: 'user', text });
      } else {
        // include current messages.length so each agent utterance gets a unique id
        messages.push({
          id: `${baseId}-${agent.id}-${messages.length}`,
          from: 'agent',
          agentId: agent.id,
          text,
        });
      }
    }

    // Competitive mode: run a short evaluation pass to pick / rate winners.
    if (interactionMode === 'competitive') {
      const critic = agents.find(a => a.id === 'critic');
      const summarizer = agents.find(a => a.id === 'summarizer');

      if (critic) {
        const critPrompt = `You are the Critic. Evaluate the agent responses above and select the best one (name the agent id). Provide a concise justification and list weaknesses of the other responses.`;
        const critText = isGoogle
          ? await callGoogleAIForAgent(
              critPrompt,
              critic,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.googleApiKey,
              messages,
              0.3,
              interactionMode
            )
          : isHF
          ? await callHuggingFaceForAgent(
              critPrompt,
              critic,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.hfApiKey,
              messages,
              0.3,
              interactionMode
            )
          : await callOpenCodeForAgent(
              critPrompt,
              critic,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.zenApiKey,
              messages,
              0.3,
              interactionMode
            );

        const critSanitized = sanitizeAgentImpersonation(critText, critic);

        // If the critic's reply begins with another agent's mention, attribute
        // that line to the mentioned agent instead of the critic.
        const critMention = (critSanitized || '').match(
          /^\s*@?([A-Za-z0-9\- ]{2,40})\s*[:\-–—]?\s*/
        );
        if (critMention) {
          const name = critMention[1].trim().toLowerCase();
          const target = agents.find(a => {
            const an = (a.name || '').toLowerCase();
            const first = (an.split(' ')[0] || '').toLowerCase();
            return an === name || first === name || a.id.toLowerCase() === name;
          });
          if (target) {
            const cleaned = critSanitized
              .replace(/^\s*@?[A-Za-z0-9\- ]{2,40}\s*[:\-–—]?\s*/, '')
              .trim();
            if (
              coordinatorAgent &&
              (target.name === coordinatorAgent.name || target.id === (coordinatorAgent.id as any))
            ) {
              messages.push({ id: `${baseId}-u${messages.length}`, from: 'user', text: cleaned });
            } else {
              messages.push({
                id: `${baseId}-${target.id}-eval-${messages.length}`,
                from: 'agent',
                agentId: target.id,
                text: cleaned,
              });
            }
          } else {
            messages.push({
              id: `${baseId}-${critic.id}-eval-${messages.length}`,
              from: 'agent',
              agentId: critic.id,
              text: critSanitized,
            });
          }
        } else {
          messages.push({
            id: `${baseId}-${critic.id}-eval-${messages.length}`,
            from: 'agent',
            agentId: critic.id,
            text: critSanitized,
          });
        }
      }

      if (summarizer) {
        const sumPrompt = `You are the Summarizer. Based on the agents' responses and any critic feedback, state the best answer and provide a one‑paragraph summary.`;
        const sumText = isGoogle
          ? await callGoogleAIForAgent(
              sumPrompt,
              summarizer,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.googleApiKey,
              messages,
              0.3,
              interactionMode
            )
          : isHF
          ? await callHuggingFaceForAgent(
              sumPrompt,
              summarizer,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.hfApiKey,
              messages,
              0.3,
              interactionMode
            )
          : await callOpenCodeForAgent(
              sumPrompt,
              summarizer,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.zenApiKey,
              messages,
              0.3,
              interactionMode
            );

        const sumSanitized = sanitizeAgentImpersonation(sumText, summarizer);

        const sumMention = (sumSanitized || '').match(/^\s*@?([A-Za-z0-9\- ]{2,40})\s*[:\-–—]?\s*/);
        if (sumMention) {
          const name = sumMention[1].trim().toLowerCase();
          const target = agents.find(a => {
            const an = (a.name || '').toLowerCase();
            const first = (an.split(' ')[0] || '').toLowerCase();
            return an === name || first === name || a.id.toLowerCase() === name;
          });
          if (target) {
            const cleaned = sumSanitized
              .replace(/^\s*@?[A-Za-z0-9\- ]{2,40}\s*[:\-–—]?\s*/, '')
              .trim();
            if (
              coordinatorAgent &&
              (target.name === coordinatorAgent.name || target.id === (coordinatorAgent.id as any))
            ) {
              messages.push({ id: `${baseId}-u${messages.length}`, from: 'user', text: cleaned });
            } else {
              messages.push({
                id: `${baseId}-${target.id}-eval-${messages.length}`,
                from: 'agent',
                agentId: target.id,
                text: cleaned,
              });
            }
          } else {
            messages.push({
              id: `${baseId}-${summarizer.id}-eval-${messages.length}`,
              from: 'agent',
              agentId: summarizer.id,
              text: sumSanitized,
            });
          }
        } else {
          messages.push({
            id: `${baseId}-${summarizer.id}-eval-${messages.length}`,
            from: 'agent',
            agentId: summarizer.id,
            text: sumSanitized,
          });
        }
      }
    }
  } else {
    // Sequential: each agent sees the running transcript and may reference or
    // instruct earlier agents.
    for (const agent of agentsToRun) {
      // sequential runs also honour includeHistory by slicing the transcript
      // to the most recent entries.  Every agent sees the same slice.
      const historyArg = includeHistory ? sliceHistory(messages) : undefined;
      let raw;
      if (isLmstudio) {
        raw = await callProvider(prompt, agent, {
          url: lmstudioUrl,
          apiKey: '', // LM Studio may not require an API key
          model: modelOverride || '',
          providerName: 'lmstudio',
          story,
          coordinatorAgent,
          coordinatorMode,
          history: historyArg,
          temperature: 0.3,
          interactionMode,
        });
      } else if (isGoogle) {
        raw = await callGoogleAIForAgent(
          prompt,
          agent,
          modelOverride,
          story,
          coordinatorAgent,
          coordinatorMode,
          apiKeys.googleApiKey,
          historyArg,
          0.3,
          interactionMode
        );
      } else if (isHF) {
        raw = await callHuggingFaceForAgent(
          prompt,
          agent,
          modelOverride,
          story,
          coordinatorAgent,
          coordinatorMode,
          apiKeys.hfApiKey,
          historyArg,
          0.3,
          interactionMode
        );
      } else {
        raw = await callOpenCodeForAgent(
          prompt,
          agent,
          modelOverride,
          story,
          coordinatorAgent,
          coordinatorMode,
          apiKeys.zenApiKey,
          historyArg,
          0.3,
          interactionMode
        );
      }

      // If the agent's reply begins with an @mention of another agent,
      // treat that mentioned agent as the speaker (change heading).
      let messageAgent = agent;
      let messageText = String(raw || '');

      const mentionMatch = messageText.match(/^\s*@?([A-Za-z0-9\- ]{2,40})\s*[:\-–—]?\s*/);
      if (mentionMatch) {
        const name = mentionMatch[1].trim().toLowerCase();
        const target = agents.find(a => {
          const an = (a.name || '').toLowerCase();
          const first = (an.split(' ')[0] || '').toLowerCase();
          return an === name || first === name || a.id.toLowerCase() === name;
        });

        if (target) {
          // If the agent is speaking as the prompter, treat that line as a user message
          if (
            coordinatorAgent &&
            (target.name === coordinatorAgent.name || target.id === (coordinatorAgent.id as any))
          ) {
            const userText = messageText.replace(mentionMatch[0], '').trim();
            messages.push({ id: `${baseId}-u${messages.length}`, from: 'user', text: userText });
            continue;
          } else {
            messageAgent = target;
            messageText = messageText.replace(mentionMatch[0], '').trim();
          }
        }
      }

      // Finally sanitize any remaining impersonation attempts and push
      const finalText = sanitizeAgentImpersonation(messageText, agent);

      messages.push({
        id: `${baseId}-${messageAgent.id}`,
        from: 'agent',
        agentId: messageAgent.id,
        text: finalText,
      });
    }

    // Cooperative mode: give agents a short refinement pass to collaborate.
    if (interactionMode === 'cooperative') {
      for (const agent of agents) {
        const refinePrompt = `Refine your previous reply to better cooperate with the team. Incorporate useful points from other agents and improve clarity. Return only the updated reply.`;
        const refined = isGoogle
          ? await callGoogleAIForAgent(
              refinePrompt,
              agent,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.googleApiKey,
              messages,
              0.25,
              interactionMode
            )
          : isHF
          ? await callHuggingFaceForAgent(
              refinePrompt,
              agent,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.hfApiKey,
              messages,
              0.25,
              interactionMode
            )
          : await callOpenCodeForAgent(
              refinePrompt,
              agent,
              modelOverride,
              story,
              coordinatorAgent,
              coordinatorMode,
              apiKeys.zenApiKey,
              messages,
              0.25,
              interactionMode
            );

        const refinedSanitized = sanitizeAgentImpersonation(refined, agent);

        const refinedMention = (refinedSanitized || '').match(
          /^\s*@?([A-Za-z0-9\- ]{2,40})\s*[:\-–—]?\s*/
        );
        if (refinedMention) {
          const name = refinedMention[1].trim().toLowerCase();
          const target = agents.find(a => {
            const an = (a.name || '').toLowerCase();
            const first = (an.split(' ')[0] || '').toLowerCase();
            return an === name || first === name || a.id.toLowerCase() === name;
          });
          if (
            target &&
            !(
              coordinatorAgent &&
              (target.name === coordinatorAgent.name || target.id === (coordinatorAgent.id as any))
            )
          ) {
            const cleaned = refinedSanitized
              .replace(/^\s*@?[A-Za-z0-9\- ]{2,40}\s*[:\-–—]?\s*/, '')
              .trim();
            messages.push({
              id: `${baseId}-${target.id}-rev1-${messages.length}`,
              from: 'agent',
              agentId: target.id,
              text: cleaned,
            });
          } else {
            messages.push({
              id: `${baseId}-${agent.id}-rev1-${messages.length}`,
              from: 'agent',
              agentId: agent.id,
              text: refinedSanitized,
            });
          }
        } else {
          messages.push({
            id: `${baseId}-${agent.id}-rev1-${messages.length}-${messages.length}`,
            from: 'agent',
            agentId: agent.id,
            text: refinedSanitized,
          });
        }
      }
    }
  }

  return messages;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      model,
      agents: agentsOverride,
      story,
      coordinatorAgent,
      coordinatorMode,
      history,
      orchestration = 'auto',
      interactionMode = 'neutral',
      stateless = false,
      provider: providerOverride,
      lmstudioUrl,
    } = body;

    // Load agents
    const agents =
      agentsOverride && Array.isArray(agentsOverride) && agentsOverride.length
        ? agentsOverride
        : await getDefaultAgents();

    // Orchestration mode
    let orchestrationMode: 'sequential' | 'parallel';
    if (orchestration === 'auto') {
      orchestrationMode = decideOrchestrationAuto(prompt, agents);
    } else {
      orchestrationMode = orchestration;
    }

    // API keys from env
    const apiKeys = {
      zenApiKey: process.env.ZEN_API_KEY,
      googleApiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      hfApiKey: process.env.HUGGINGFACE_API_KEY,
      nvidiaApiKey: process.env.NVIDIA_API_KEY,
    };

    // PATCH: Force LM Studio routing if lmstudioUrl is present, regardless of providerOverride
    let apiKeysWithLmstudio = { ...apiKeys };
    let effectiveProvider = providerOverride;
    if (lmstudioUrl) {
      (apiKeysWithLmstudio as any).lmstudioUrl = lmstudioUrl;
      effectiveProvider = 'lmstudio';
    }
    const transcript = await buildModelTranscript(
      prompt,
      agents,
      apiKeysWithLmstudio,
      model,
      story,
      coordinatorAgent,
      coordinatorMode,
      history,
      orchestrationMode,
      interactionMode,
      !stateless,
      effectiveProvider
    );

    return new Response(
      JSON.stringify({
        agents,
        messages: transcript,
        mode: 'live',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        agents: [],
        messages: [],
        mode: 'live',
        error: err?.message || String(err),
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
