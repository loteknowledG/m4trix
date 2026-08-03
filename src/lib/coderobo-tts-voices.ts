import voiceDataJson from '@/lib/coderobo-tts-voices.json';

export type CoderoboVoiceGender = 'Female' | 'Male';

export type CoderoboLanguageEntry = {
  name: string;
  voices: Record<string, CoderoboVoiceGender>;
};

export const CODEROBO_TTS_VOICES = voiceDataJson as Record<string, CoderoboLanguageEntry>;

export const CODEROBO_TTS_LANGUAGE_CODES = Object.keys(CODEROBO_TTS_VOICES).sort((a, b) =>
  CODEROBO_TTS_VOICES[a].name.localeCompare(CODEROBO_TTS_VOICES[b].name),
);

export const CODEROBO_ENGLISH_LANGUAGE_CODES = CODEROBO_TTS_LANGUAGE_CODES.filter(code =>
  code.startsWith('en-'),
);

const ENGLISH_DIALECT_ORDER = [
  'en-US',
  'en-GB',
  'en-AU',
  'en-CA',
  'en-IN',
  'en-IE',
  'en-NZ',
  'en-ZA',
  'en-SG',
  'en-HK',
  'en-PH',
  'en-NG',
  'en-KE',
  'en-TZ',
] as const;

export const DEFAULT_CODEROBO_LANGUAGE = 'en-US';
export const DEFAULT_CODEROBO_VOICE = 'JennyNeural';

export function coderoboLanguageFamily(code: string): string {
  return code.split('-')[0] || code;
}

export function coderoboDialectLabel(code: string): string {
  const name = coderoboLanguageLabel(code);
  const region = name.match(/\(([^)]+)\)/);
  if (region) return region[1];
  return name;
}

export function coderoboCodesForFamily(family: string): string[] {
  const codes = CODEROBO_TTS_LANGUAGE_CODES.filter(
    code => coderoboLanguageFamily(code) === family,
  );
  if (family === 'en') {
    const order = ENGLISH_DIALECT_ORDER as readonly string[];
    const ordered = order.filter(code => codes.includes(code));
    const rest = codes
      .filter(code => !order.includes(code))
      .sort((a, b) => coderoboDialectLabel(a).localeCompare(coderoboDialectLabel(b)));
    return [...ordered, ...rest];
  }
  return codes.sort((a, b) => coderoboLanguageLabel(a).localeCompare(coderoboLanguageLabel(b)));
}

function coderoboFamilyDisplayName(family: string): string {
  if (family === 'en') return 'English';
  const codes = coderoboCodesForFamily(family);
  if (codes.length === 0) return family;
  if (codes.length === 1) return coderoboLanguageLabel(codes[0]);
  const baseName = coderoboLanguageLabel(codes[0]).replace(/\s*\([^)]*\)\s*$/, '').trim();
  return baseName || family;
}

export function coderoboLanguageFamilies(): Array<{ id: string; label: string }> {
  const families = new Map<string, string>();
  for (const code of CODEROBO_TTS_LANGUAGE_CODES) {
    const family = coderoboLanguageFamily(code);
    if (!families.has(family)) {
      families.set(family, coderoboFamilyDisplayName(family));
    }
  }
  return Array.from(families.entries())
    .map(([id, label]) => ({ id, label }))
    .sort((a, b) => {
      if (a.id === 'en') return -1;
      if (b.id === 'en') return 1;
      return a.label.localeCompare(b.label);
    });
}

export function coderoboLanguageOptionGroups(): Array<{ label: string; codes: string[] }> {
  const englishCodes = coderoboCodesForFamily('en');
  const otherCodes = CODEROBO_TTS_LANGUAGE_CODES.filter(code => !code.startsWith('en-'));
  return [
    { label: 'English dialects', codes: englishCodes },
    { label: 'Other languages', codes: otherCodes },
  ];
}

export function coderoboLanguageLabel(code: string): string {
  return CODEROBO_TTS_VOICES[code]?.name ?? code;
}

export function coderoboVoicesForLanguage(language: string): Array<{ id: string; gender: CoderoboVoiceGender }> {
  const entry = CODEROBO_TTS_VOICES[language];
  if (!entry) return [];
  return Object.entries(entry.voices)
    .map(([id, gender]) => ({ id, gender }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function normalizeCoderoboLanguage(language: unknown): string {
  if (typeof language !== 'string') return DEFAULT_CODEROBO_LANGUAGE;
  const code = language.trim();
  return CODEROBO_TTS_VOICES[code] ? code : DEFAULT_CODEROBO_LANGUAGE;
}

export function normalizeCoderoboVoice(language: string, voice: unknown): string {
  const lang = normalizeCoderoboLanguage(language);
  const voices = coderoboVoicesForLanguage(lang);
  if (typeof voice !== 'string') return voices[0]?.id ?? DEFAULT_CODEROBO_VOICE;
  const match = voices.find(entry => entry.id === voice.trim());
  return match?.id ?? voices[0]?.id ?? DEFAULT_CODEROBO_VOICE;
}

export function formatCoderoboVoiceLabel(voiceId: string, gender?: CoderoboVoiceGender): string {
  const suffix = gender ? ` (${gender})` : '';
  return `${voiceId.replace(/Neural$/i, ' Neural')}${suffix}`;
}
