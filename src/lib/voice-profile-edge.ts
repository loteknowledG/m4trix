import {
  normalizeCharacterTtsProfile,
  type CharacterTtsProfileId,
} from '@/lib/character-tts-profile';

export type VoiceProfileEdgeConfig = {
  voice: string;
  rate: string;
  pitch: string;
  volume: string;
};

/** Edge TTS synthesis settings — kept in sync with tools/voice_profile.py PROFILES. */
export const VOICE_PROFILE_EDGE_CONFIG: Record<CharacterTtsProfileId, VoiceProfileEdgeConfig> = {
  'jenna-jacket': {
    voice: 'en-US-JennyNeural',
    rate: '-19%',
    pitch: '-9Hz',
    volume: '+2%',
  },
  'jenny-neural': {
    voice: 'en-US-JennyNeural',
    rate: '-5%',
    pitch: '-2Hz',
    volume: '+0%',
  },
  muthur: {
    voice: 'en-US-AriaNeural',
    rate: '-12%',
    pitch: '-5Hz',
    volume: '+0%',
  },
  'asian-elder': {
    voice: 'zh-CN-YunjianNeural',
    rate: '-28%',
    pitch: '-12Hz',
    volume: '-4%',
  },
  'vietnamese-male': {
    voice: 'vi-VN-NamMinhNeural',
    rate: '-6%',
    pitch: '-4Hz',
    volume: '+0%',
  },
  'midwest-teen': {
    voice: 'en-US-EmmaNeural',
    rate: '+12%',
    pitch: '+8Hz',
    volume: '+2%',
  },
  narrator: {
    voice: 'en-US-GuyNeural',
    rate: '-18%',
    pitch: '-4Hz',
    volume: '+0%',
  },
  'narrator-female': {
    voice: 'en-US-AriaNeural',
    rate: '-18%',
    pitch: '-2Hz',
    volume: '+0%',
  },
  'seductive-secretary': {
    voice: 'en-US-MichelleNeural',
    rate: '-24%',
    pitch: '-11Hz',
    volume: '-3%',
  },
  'southern-belle': {
    voice: 'en-US-AriaNeural',
    rate: '-20%',
    pitch: '+5Hz',
    volume: '+3%',
  },
  'uk-twenties': {
    voice: 'en-GB-LibbyNeural',
    rate: '+6%',
    pitch: '+4Hz',
    volume: '+0%',
  },
  'uk-hazel': {
    voice: 'en-GB-SoniaNeural',
    rate: '-6%',
    pitch: '-2Hz',
    volume: '+0%',
  },
  'au-twenties': {
    voice: 'en-AU-NatashaNeural',
    rate: '+8%',
    pitch: '+5Hz',
    volume: '+1%',
  },
  'au-catherine': {
    voice: 'en-AU-NatashaNeural',
    rate: '-8%',
    pitch: '-3Hz',
    volume: '+0%',
  },
  'atlanta-thirties': {
    voice: 'en-US-JennyNeural',
    rate: '-11%',
    pitch: '+1Hz',
    volume: '+2%',
  },
  'california-girl': {
    voice: 'en-US-AvaNeural',
    rate: '+10%',
    pitch: '+9Hz',
    volume: '+3%',
  },
  'nyc-girl': {
    voice: 'en-US-JennyNeural',
    rate: '+14%',
    pitch: '+3Hz',
    volume: '+1%',
  },
  'atlanta-forties-male': {
    voice: 'en-US-AndrewNeural',
    rate: '-10%',
    pitch: '-8Hz',
    volume: '+1%',
  },
  'stripper-female': {
    voice: 'en-US-AriaNeural',
    rate: '-19%',
    pitch: '-6Hz',
    volume: '-2%',
  },
};

export function resolveVoiceProfileEdgeConfig(profile: unknown): VoiceProfileEdgeConfig {
  const profileId = normalizeCharacterTtsProfile(profile);
  return VOICE_PROFILE_EDGE_CONFIG[profileId];
}
