export const CHARACTER_TTS_PROFILE_OPTIONS = [
  { id: 'jenny-neural', label: 'Jenny Neural', description: 'Clean styled profile.' },
  { id: 'jenna-jacket', label: 'Jenna Jacket', description: 'Friendly operator profile.' },
  { id: 'muthur', label: 'MUTHUR', description: 'Calm system voice with reverb.' },
  { id: 'asian-elder', label: 'Asian Elder', description: 'Slow older male voice with East Asian accent.' },
  { id: 'vietnamese-male', label: 'Vietnamese Male', description: 'Natural Vietnamese male voice for English dialogue.' },
  { id: 'midwest-teen', label: 'Midwest Teen', description: '16-year-old Midwestern female, bright and casual.' },
  { id: 'narrator', label: 'Narrator', description: 'Slow, clear audiobook and documentary narration.' },
  { id: 'narrator-female', label: 'Female Narrator', description: 'Warm measured female narration for stories.' },
  { id: 'seductive-secretary', label: 'Seductive Secretary', description: 'Slow, smooth, low office femme fatale tone.' },
  { id: 'southern-belle', label: 'Southern Belle', description: 'Warm, slow, gracious Southern female voice.' },
  { id: 'uk-twenties', label: 'UK Twenties', description: 'British woman in her 20s, casual modern accent.' },
  {
    id: 'uk-hazel',
    label: 'Hazel (UK)',
    description: 'Classic Microsoft British English female voice, clear and measured.',
  },
  { id: 'au-twenties', label: 'AU Twenties', description: 'Australian woman in her 20s, upbeat casual accent.' },
  {
    id: 'au-catherine',
    label: 'Catherine (AU)',
    description: 'Classic Microsoft Australian English female voice, clear and measured.',
  },
  { id: 'atlanta-thirties', label: 'Atlanta 30s', description: 'Atlanta woman in her 30s, warm urban Southern tone.' },
  { id: 'california-girl', label: 'California Girl', description: 'Bright relaxed SoCal female, casual West Coast vibe.' },
  { id: 'nyc-girl', label: 'NYC Girl', description: 'Fast direct New York City female, urban and confident.' },
  { id: 'atlanta-forties-male', label: 'Atlanta 40s Male', description: 'Atlanta man in his 40s, warm urban Southern tone.' },
  { id: 'stripper-female', label: 'Stripper', description: 'Slow husky club voice, playful and flirtatious.' },
] as const;

export const CHARACTER_TTS_PROFILE_OPTIONS_ALPHABETICAL = [...CHARACTER_TTS_PROFILE_OPTIONS].sort(
  (a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
);

export type CharacterTtsProfileId = (typeof CHARACTER_TTS_PROFILE_OPTIONS)[number]['id'];

export type CharacterTtsVoice = {
  engine: 'profile';
  profileId: CharacterTtsProfileId;
};

export const DEFAULT_CHARACTER_TTS_VOICE: CharacterTtsVoice = {
  engine: 'profile',
  profileId: 'jenny-neural',
};

function normalizeProfileId(value: unknown): CharacterTtsProfileId | undefined {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'jenny' || normalized === 'jenny-neural') return 'jenny-neural';
  if (normalized === 'jenna' || normalized === 'jenna-jacket' || normalized === 'jacket') {
    return 'jenna-jacket';
  }
  if (normalized === 'muthur' || normalized === 'mother') return 'muthur';
  if (
    normalized === 'asian-elder' ||
    normalized === 'asian-elder-male' ||
    normalized === 'elder' ||
    normalized === 'old-asian' ||
    normalized === 'wise-elder'
  ) {
    return 'asian-elder';
  }
  if (
    normalized === 'vietnamese-male' ||
    normalized === 'vietnamese' ||
    normalized === 'viet-male' ||
    normalized === 'nam-minh' ||
    normalized === 'namminh'
  ) {
    return 'vietnamese-male';
  }
  if (
    normalized === 'midwest-teen' ||
    normalized === 'midwest-girl' ||
    normalized === 'midwest-16' ||
    normalized === 'teen-midwest'
  ) {
    return 'midwest-teen';
  }
  if (
    normalized === 'narrator' ||
    normalized === 'narration' ||
    normalized === 'audiobook' ||
    normalized === 'documentary' ||
    normalized === 'voiceover'
  ) {
    return 'narrator';
  }
  if (
    normalized === 'narrator-female' ||
    normalized === 'female-narrator' ||
    normalized === 'woman-narrator'
  ) {
    return 'narrator-female';
  }
  if (
    normalized === 'seductive-secretary' ||
    normalized === 'secretary' ||
    normalized === 'sultry-secretary'
  ) {
    return 'seductive-secretary';
  }
  if (
    normalized === 'southern-belle' ||
    normalized === 'southern-belle-accent' ||
    normalized === 'belle' ||
    normalized === 'southern-lady' ||
    normalized === 'scarlett'
  ) {
    return 'southern-belle';
  }
  if (
    normalized === 'uk-twenties' ||
    normalized === 'british-girl' ||
    normalized === 'uk-girl' ||
    normalized === 'british-20s' ||
    normalized === 'uk-20s' ||
    normalized === 'british-girl-20s'
  ) {
    return 'uk-twenties';
  }
  if (
    normalized === 'uk-hazel' ||
    normalized === 'hazel' ||
    normalized === 'hazel-uk' ||
    normalized === 'hazel-british' ||
    normalized === 'microsoft-hazel' ||
    normalized === 'en-gb-hazel'
  ) {
    return 'uk-hazel';
  }
  if (
    normalized === 'au-twenties' ||
    normalized === 'australian-girl' ||
    normalized === 'au-girl' ||
    normalized === 'australian-20s' ||
    normalized === 'au-20s' ||
    normalized === 'australian-girl-20s'
  ) {
    return 'au-twenties';
  }
  if (
    normalized === 'au-catherine' ||
    normalized === 'catherine' ||
    normalized === 'catherine-au' ||
    normalized === 'catherine-australian' ||
    normalized === 'microsoft-catherine' ||
    normalized === 'en-au-catherine'
  ) {
    return 'au-catherine';
  }
  if (
    normalized === 'atlanta-thirties' ||
    normalized === 'atlanta-female' ||
    normalized === 'atlanta-30s' ||
    normalized === 'atl-30s' ||
    normalized === 'atlanta-girl'
  ) {
    return 'atlanta-thirties';
  }
  if (
    normalized === 'california-girl' ||
    normalized === 'cali-girl' ||
    normalized === 'californian-girl' ||
    normalized === 'californian-accent' ||
    normalized === 'so-cal-girl' ||
    normalized === 'valley-girl'
  ) {
    return 'california-girl';
  }
  if (
    normalized === 'nyc-girl' ||
    normalized === 'new-york-girl' ||
    normalized === 'ny-girl' ||
    normalized === 'nyc-accent' ||
    normalized === 'brooklyn-girl'
  ) {
    return 'nyc-girl';
  }
  if (
    normalized === 'atlanta-forties-male' ||
    normalized === 'atlanta-male-40s' ||
    normalized === 'atlanta-male' ||
    normalized === 'atl-male-40s' ||
    normalized === 'atlanta-man'
  ) {
    return 'atlanta-forties-male';
  }
  if (
    normalized === 'stripper-female' ||
    normalized === 'stripper' ||
    normalized === 'club-voice' ||
    normalized === 'sultry-club'
  ) {
    return 'stripper-female';
  }
  if (normalized === 'browser') return 'jenny-neural';
  return CHARACTER_TTS_PROFILE_OPTIONS.find(option => option.id === normalized)?.id;
}

export function normalizeCharacterTtsProfile(value: unknown): CharacterTtsProfileId {
  return normalizeProfileId(value) ?? 'jenny-neural';
}

export function normalizeCharacterTtsVoice(value: unknown, legacyProfile?: unknown): CharacterTtsVoice {
  let profileId: CharacterTtsProfileId = DEFAULT_CHARACTER_TTS_VOICE.profileId;
  let hasExplicitProfile = false;

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const fromObject = normalizeProfileId(record.profileId);
    if (fromObject) {
      profileId = fromObject;
      hasExplicitProfile = true;
    }
  } else {
    const fromValue = normalizeProfileId(value);
    if (fromValue) {
      profileId = fromValue;
      hasExplicitProfile = true;
    }
  }

  if (!hasExplicitProfile) {
    const legacy = normalizeProfileId(legacyProfile);
    if (legacy) profileId = legacy;
  }

  return { engine: 'profile', profileId };
}

export function resolveCharacterTtsVoice(
  value?: CharacterTtsVoice | null,
  legacyProfile?: unknown,
): CharacterTtsVoice {
  return normalizeCharacterTtsVoice(value, legacyProfile);
}

export function characterTtsVoiceLabel(settings: CharacterTtsVoice): string {
  const profile = settings.profileId ?? DEFAULT_CHARACTER_TTS_VOICE.profileId;
  return CHARACTER_TTS_PROFILE_OPTIONS.find(option => option.id === profile)?.label ?? profile;
}

export function resolveCharacterTtsProfile(value: unknown): CharacterTtsProfileId {
  return normalizeCharacterTtsProfile(value);
}

export function characterTtsProfileLabel(profile: CharacterTtsProfileId): string {
  return CHARACTER_TTS_PROFILE_OPTIONS.find(option => option.id === profile)?.label ?? profile;
}

export const DEFAULT_CHARACTER_TTS_PROFILE = DEFAULT_CHARACTER_TTS_VOICE.profileId;
