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

export type LmstudioModelOption = { id: string; label: string };

/** Normalize LM Studio / OpenAI-compatible model list payloads. */
export function parseLmstudioModelsResponse(payload: unknown): LmstudioModelOption[] {
  let rawModels: unknown[] = [];
  if (Array.isArray(payload)) {
    rawModels = payload;
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.data)) rawModels = record.data;
    else if (Array.isArray(record.models)) rawModels = record.models;
  }

  return rawModels
    .map((entry): LmstudioModelOption | null => {
      if (!entry || typeof entry !== 'object') return null;
      const model = entry as Record<string, unknown>;
      const id =
        (typeof model.id === 'string' && model.id) ||
        (typeof model.model_id === 'string' && model.model_id) ||
        (typeof model.name === 'string' && model.name);
      if (!id) return null;
      const label =
        (typeof model.display_name === 'string' && model.display_name) ||
        (typeof model.name === 'string' && model.name) ||
        id;
      return { id, label };
    })
    .filter((option): option is LmstudioModelOption => Boolean(option));
}
