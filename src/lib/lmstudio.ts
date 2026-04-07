export const DEFAULT_LMSTUDIO_URL = 'http://192.168.12.48:1234';
export const LMSTUDIO_CHAT_PATH = '/v1/chat/completions';
export const LMSTUDIO_MODELS_PATH = '/v1/models';

export function normalizeLmstudioUrl(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) return DEFAULT_LMSTUDIO_URL;

  const withoutTrailingSlash = value.replace(/\/$/, '');
  return withoutTrailingSlash.replace(/\/v1\/chat\/completions\/?$/, '');
}

export function getLmstudioChatUrl(input: string | null | undefined): string {
  return `${normalizeLmstudioUrl(input)}${LMSTUDIO_CHAT_PATH}`;
}

export function getLmstudioModelsUrl(input: string | null | undefined): string {
  return `${normalizeLmstudioUrl(input)}${LMSTUDIO_MODELS_PATH}`;
}
