import kokoroDataJson from '@/lib/coderobo-kokoro-voices.json';

export type KokoroGender = 'female' | 'male';

export type KokoroVoiceEntry = {
  code: string;
  name: string;
};

export type KokoroLanguageEntry = {
  emoji: string;
  female?: KokoroVoiceEntry[];
  male?: KokoroVoiceEntry[];
};

export const KOKORO_TTS_VOICES = kokoroDataJson as Record<string, KokoroLanguageEntry>;

export const KOKORO_LANGUAGE_NAMES = Object.keys(KOKORO_TTS_VOICES);

export const DEFAULT_KOKORO_LANGUAGE = 'American English';
export const DEFAULT_KOKORO_GENDER: KokoroGender = 'female';
export const DEFAULT_KOKORO_SPEED = 1;

export function kokoroLanguageLabel(name: string): string {
  const entry = KOKORO_TTS_VOICES[name];
  if (!entry) return name;
  return `${entry.emoji} ${name}`.trim();
}

export function kokoroGendersForLanguage(language: string): KokoroGender[] {
  const entry = KOKORO_TTS_VOICES[language];
  if (!entry) return [];
  const genders: KokoroGender[] = [];
  if (entry.female?.length) genders.push('female');
  if (entry.male?.length) genders.push('male');
  return genders;
}

export function kokoroVoicesForLanguage(language: string, gender: KokoroGender): KokoroVoiceEntry[] {
  const entry = KOKORO_TTS_VOICES[language];
  if (!entry) return [];
  return entry[gender] ?? [];
}

export function normalizeKokoroLanguage(value: unknown): string {
  if (typeof value !== 'string') return DEFAULT_KOKORO_LANGUAGE;
  const name = value.trim();
  return KOKORO_TTS_VOICES[name] ? name : DEFAULT_KOKORO_LANGUAGE;
}

export function normalizeKokoroGender(value: unknown): KokoroGender {
  return value === 'male' ? 'male' : 'female';
}

export function normalizeKokoroVoice(language: string, gender: KokoroGender, value: unknown): string {
  const voices = kokoroVoicesForLanguage(language, gender);
  if (typeof value !== 'string') return voices[0]?.code ?? 'af_heart';
  const match = voices.find(v => v.code === value.trim());
  return match?.code ?? voices[0]?.code ?? 'af_heart';
}

export function normalizeKokoroSpeed(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_KOKORO_SPEED;
  return Math.min(2, Math.max(0.5, Math.round(value * 10) / 10));
}

export function formatKokoroVoiceLabel(language: string, gender: KokoroGender, code: string): string {
  const voice = kokoroVoicesForLanguage(language, gender).find(v => v.code === code);
  return voice?.name ?? code;
}
