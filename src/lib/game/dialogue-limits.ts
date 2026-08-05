/** Twitter-style cap for protagonist player/AI lines. */
export const PROTAGONIST_DIALOGUE_MAX_CHARS = 280;

/** Plain-text cap for story description (logline / opening). */
export const STORY_DESCRIPTION_MAX_CHARS = 280;

/** Short narrator turn summary (1–2 sentences). */
export const NARRATOR_SUMMARY_MAX_CHARS = 200;

export const DIALOGUE_MAX_SENTENCES = 2;

export function clampDialogueCharacters(
  text: string,
  maxChars: number,
  options?: { finishSentence?: boolean },
): string {
  if (maxChars <= 0) return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) return trimmed;

  const finishSentence = options?.finishSentence !== false;
  if (!finishSentence) {
    return trimmed.slice(0, maxChars);
  }

  const prefix = trimmed.slice(0, maxChars);
  const suffix = trimmed.slice(maxChars);
  if (/[.!?]["']?\s*$/.test(prefix)) {
    return prefix.trim();
  }

  const restOfSentence = suffix.match(/^[^.!?]*[.!?]+["']?/);
  if (restOfSentence) {
    return (prefix + restOfSentence[0]).trim();
  }

  return trimmed;
}

export function clampDialogueSentences(text: string, maxSentences = DIALOGUE_MAX_SENTENCES): string {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed) return '';

  const sentences = trimmed.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!sentences?.length) return trimmed;
  return sentences.slice(0, maxSentences).join(' ').trim();
}

export function normalizeProtagonistDialogue(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return clampDialogueCharacters(
    clampDialogueSentences(trimmed, DIALOGUE_MAX_SENTENCES),
    PROTAGONIST_DIALOGUE_MAX_CHARS,
    { finishSentence: true },
  );
}

/** Keep NPC/AI replies short but never cut mid-sentence. */
export function normalizeCharacterDialogue(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const sentences = clampDialogueSentences(trimmed, DIALOGUE_MAX_SENTENCES);
  if (sentences.length <= PROTAGONIST_DIALOGUE_MAX_CHARS) {
    return sentences;
  }
  return clampDialogueCharacters(sentences, PROTAGONIST_DIALOGUE_MAX_CHARS, {
    finishSentence: true,
  });
}

export function normalizeNarratorSummary(text: string, playerOnlyBeat = false): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return clampDialogueCharacters(
    clampDialogueSentences(trimmed, playerOnlyBeat ? 1 : DIALOGUE_MAX_SENTENCES),
    NARRATOR_SUMMARY_MAX_CHARS,
  );
}

export const PROTAGONIST_REPLY_INSTRUCTION =
  'Reply with one short sentence when possible, at most two. Prefer staying under 280 characters, but always finish your sentence.';

export function buildCharacterReplyPrompt(args: {
  speakerName: string;
  line: string;
  responderName: string;
  protagonistReply?: boolean;
  narratorScene?: boolean;
}): string {
  const limit = args.protagonistReply ? PROTAGONIST_REPLY_INSTRUCTION : 'Reply with one short sentence in character.';
  if (args.narratorScene) {
    return `The narrator describes: "${args.line}". ${args.responderName}, what would you say in response? ${limit}`;
  }
  return `${args.speakerName} said: "${args.line}". ${args.responderName}, ${limit}`;
}
