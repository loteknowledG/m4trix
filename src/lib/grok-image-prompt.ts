/**
 * Builds a single rich prompt for pasting into Grok (manual image generation).
 * Keeps logic client-side / local-first — no API calls.
 */

export type GrokImageCharacter = {
  id: string;
  name: string;
  /** Free-form profile: appearance, personality, voice, etc. */
  description: string;
  roleLabel?: string;
};

export type GrokImageChatLine = {
  speaker: string;
  text: string;
};

/** Map playground-style messages (`from` = agent id or `"user"`) to labeled lines for the prompt. */
export function mapCharacterChatToGrokLines(
  messages: Array<{ from: string; text: string }>,
  options: {
    userSpeakerName: string;
    /** id → display name for NPC / agent speakers */
    agentNameById: Record<string, string>;
  }
): GrokImageChatLine[] {
  return messages.map(m => {
    if (m.from === 'user') {
      return { speaker: options.userSpeakerName.trim() || 'You', text: m.text };
    }
    const name = options.agentNameById[m.from]?.trim() || m.from;
    return { speaker: name, text: m.text };
  });
}

export type BuildGrokImagePromptInput = {
  /** Global story / setting text from the workspace */
  story: string;
  /** Optional extra scene beat (location, time of day, mood) */
  sceneContext?: string;
  /** NPCs and other cast */
  agents: GrokImageCharacter[];
  /** User / coordinator persona when present */
  prompterAgent?: GrokImageCharacter | null;
  /** Chat transcript lines in chronological order */
  chatLines: GrokImageChatLine[];
  /**
   * Max non-empty dialogue lines to include (most recent).
   * Omit, `undefined`, or `<= 0` = include all lines (no cap).
   */
  maxChatLines?: number;
  /** Which cast member should be the visual focus (defaults to first agent) */
  focusAgentId?: string | null;
};

function stripNoise(text: string) {
  return text
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Non-empty lines; if `max` is a positive number, keep only the last `max` (oldest → newest within that slice). */
export function takeRecentChatLines<T extends { text: string }>(lines: T[], max?: number): T[] {
  const filtered = lines.filter(l => stripNoise(l.text).length > 0);
  if (max == null || max <= 0 || !Number.isFinite(max) || filtered.length <= max) return filtered;
  return filtered.slice(-max);
}

function block(title: string, body: string) {
  const cleaned = stripNoise(body);
  if (!cleaned) return '';
  return `### ${title}\n${cleaned}\n`;
}

/**
 * Produces one copy-paste message for Grok: context + explicit ask to generate an image.
 */
export function buildGrokImagePrompt(input: BuildGrokImagePromptInput): string {
  const recent = takeRecentChatLines(input.chatLines, input.maxChatLines);

  const focusId =
    input.focusAgentId && input.agents.some(a => a.id === input.focusAgentId)
      ? input.focusAgentId
      : input.agents[0]?.id;

  const focusAgent = focusId ? input.agents.find(a => a.id === focusId) : undefined;

  const castBlocks = [
    ...input.agents.map(a => {
      const label = a.roleLabel ?? 'Character';
      const focusNote = focusAgent && a.id === focusAgent.id ? '\n_(Primary visual focus for this image.)_\n' : '\n';
      return `#### ${stripNoise(a.name) || 'Unnamed'} (${label})${focusNote}${stripNoise(a.description) || '_No profile text._'}`;
    }),
    ...(input.prompterAgent && stripNoise(input.prompterAgent.name + input.prompterAgent.description)
      ? [
          `#### ${stripNoise(input.prompterAgent.name) || 'Prompter'} (user / coordinator persona)\n${stripNoise(
            input.prompterAgent.description
          )}`,
        ]
      : []),
  ].join('\n\n');

  const dialogue =
    recent.length === 0
      ? '_No recent chat lines yet — lean on story + cast above._'
      : recent.map(l => `**${stripNoise(l.speaker) || 'Speaker'}:** ${stripNoise(l.text)}`).join('\n\n');

  return [
    'Please **generate an image** for my local story project (m4trix). Use the context below.',
    '',
    '**Goals:**',
    '- Match the **setting**, **tone**, and **character looks** implied by the profiles and dialogue.',
    '- One strong scene: clear focal point, readable poses, expressive faces if applicable.',
    '- Suggest **lighting**, **camera / framing**, and **art style** (e.g. cinematic still, painterly, comic ink) that fit the scene.',
    '- Avoid subtitles, watermarks, or UI chrome in the image.',
    '',
    block('Story / world context', input.story),
    input.sceneContext?.trim() ? block('Current scene beat (optional)', input.sceneContext) : '',
    castBlocks.trim() ? `### Cast & profiles\n${castBlocks}\n` : '',
    '### Recent conversation (oldest → newest within this excerpt)',
    dialogue,
    '',
    '---',
    '',
    '**What to do:** Create the image now (or, if you prefer, first give a one-sentence plan, then generate).',
    'If anything essential is missing, make tasteful assumptions that stay consistent with the text above.',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } finally {
    document.body.removeChild(ta);
  }
}
