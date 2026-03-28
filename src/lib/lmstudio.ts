export const DEFAULT_LMSTUDIO_URL = 'http://192.168.12.48:1234';

export function normalizeLmstudioUrl(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) return DEFAULT_LMSTUDIO_URL;

  const withoutTrailingSlash = value.replace(/\/$/, '');
  return withoutTrailingSlash.replace(/\/v1\/chat\/completions\/?$/, '');
}
