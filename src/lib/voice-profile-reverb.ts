/** Impulse responses for Web Audio convolution reverb (Reverb.js / OpenAirLib). */
export const VOICE_REVERB_IMPULSES = {
  'r1-nuclear-reactor-hall': {
    path: '/audio/reverb/r1-nuclear-reactor-hall.m4a',
    label: 'R1 Nuclear Reactor Hall',
  },
} as const;

export type VoiceReverbImpulseId = keyof typeof VOICE_REVERB_IMPULSES;

export type VoiceProfileReverbConfig = {
  impulseId: VoiceReverbImpulseId;
  /** Direct (dry) signal gain, typically 0–1. */
  dry: number;
  /** Convolved (wet) signal gain, typically 0–1. */
  wet: number;
};

export function resolveVoiceReverbImpulsePath(impulseId: VoiceReverbImpulseId): string {
  return VOICE_REVERB_IMPULSES[impulseId].path;
}
