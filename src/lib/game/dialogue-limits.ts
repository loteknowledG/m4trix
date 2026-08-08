/** Plain-text cap for story description (logline / opening). */
export const STORY_DESCRIPTION_MAX_CHARS = 280;

export const DIALOGUE_MAX_SENTENCES = 2;

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
  return clampDialogueSentences(trimmed, DIALOGUE_MAX_SENTENCES);
}

/** Keep NPC/AI replies short: at most two sentences. */
export function normalizeCharacterDialogue(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return clampDialogueSentences(trimmed, DIALOGUE_MAX_SENTENCES);
}

export function normalizeNarratorSummary(text: string, playerOnlyBeat = false): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  return clampDialogueSentences(trimmed, playerOnlyBeat ? 1 : DIALOGUE_MAX_SENTENCES);
}

export const PROTAGONIST_REPLY_INSTRUCTION =
  'Reply with one short sentence when possible, at most two. Always finish your sentence.';

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
