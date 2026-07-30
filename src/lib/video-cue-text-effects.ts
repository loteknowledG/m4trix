export const VIDEO_CUE_TEXT_EFFECTS = [
  { id: 'none', label: 'Plain' },
  { id: 'fadeIn', label: 'Fade in' },
  { id: 'blurIn', label: 'Blur in' },
  { id: 'blurText', label: 'Blur text' },
  { id: 'flipWords', label: 'Flip words' },
  { id: 'gradientText', label: 'Gradient text' },
  { id: 'shimmeringText', label: 'Shimmering text' },
  { id: 'textGenerate', label: 'Text generate' },
  { id: 'colourfulText', label: 'Colourful text' },
  { id: 'breathingText', label: 'Breathing text' },
  { id: 'bouncingText', label: 'Bouncing text' },
  { id: 'embossText', label: 'Emboss text' },
  { id: 'echoText', label: 'Echo text' },
  { id: 'driftText', label: 'Drift text' },
  { id: 'paperCutText', label: 'Paper cut text' },
  { id: 'liquidText', label: 'Liquid text' },
  { id: 'popText', label: 'Pop text' },
  { id: 'waveText', label: 'Wave text' },
  { id: 'waveformText', label: 'Waveform text' },
  { id: 'typingText', label: 'Typing text' },
  { id: 'wobbleText', label: 'Wobble text' },
  { id: 'blurInUp', label: 'Blur in up' },
  { id: 'blurInDown', label: 'Blur in down' },
  { id: 'slideUp', label: 'Slide up' },
  { id: 'slideDown', label: 'Slide down' },
  { id: 'slideLeft', label: 'Slide left' },
  { id: 'slideRight', label: 'Slide right' },
  { id: 'scaleUp', label: 'Scale up' },
  { id: 'scaleDown', label: 'Scale down' },
  { id: 'typing', label: 'Typing' },
  { id: 'wordRotate', label: 'Word rotate' },
  { id: 'hyperText', label: 'Hyper text' },
  { id: 'morphingText', label: 'Morphing text' },
  { id: 'lineShadowText', label: 'Line shadow' },
  { id: 'sparklesText', label: 'Sparkles' },
  { id: 'spinningText', label: 'Spinning text' },
] as const;

export type VideoCueTextEffect = (typeof VIDEO_CUE_TEXT_EFFECTS)[number]['id'];

export type VideoCueTextAnimatePreset = Exclude<
  VideoCueTextEffect,
  | 'none'
  | 'blurText'
  | 'flipWords'
  | 'gradientText'
  | 'shimmeringText'
  | 'textGenerate'
  | 'colourfulText'
  | 'breathingText'
  | 'bouncingText'
  | 'embossText'
  | 'echoText'
  | 'driftText'
  | 'paperCutText'
  | 'liquidText'
  | 'popText'
  | 'waveText'
  | 'waveformText'
  | 'typingText'
  | 'wobbleText'
  | 'typing'
  | 'wordRotate'
  | 'hyperText'
  | 'morphingText'
  | 'lineShadowText'
  | 'sparklesText'
  | 'spinningText'
>;

export function cueWordRotateWords(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return ['…'];
  const segments = trimmed.includes('|')
    ? trimmed.split('|').map(part => part.trim()).filter(Boolean)
    : trimmed.split(/\s+/).filter(Boolean);
  return segments.length > 0 ? segments : ['…'];
}

const LEGACY_DIALOG_TEXT_EFFECT_MAP: Record<string, VideoCueTextEffect> = {
  generate: 'textGenerate',
  blur: 'blurIn',
  shimmer: 'shimmeringText',
  gradient: 'gradientText',
  highlight: 'colourfulText',
  typewriter: 'typing',
};

export function normalizeVideoCueTextEffect(value: unknown): VideoCueTextEffect {
  if (typeof value !== 'string') return 'none';
  return VIDEO_CUE_TEXT_EFFECTS.some(effect => effect.id === value)
    ? (value as VideoCueTextEffect)
    : 'none';
}

/** Maps legacy moment-dialog effect ids to video cue effects, then normalizes. */
export function normalizeMomentDialogTextEffect(value: unknown): VideoCueTextEffect {
  if (typeof value === 'string') {
    const legacy = LEGACY_DIALOG_TEXT_EFFECT_MAP[value];
    if (legacy) return legacy;
  }
  return normalizeVideoCueTextEffect(value);
}

export function videoCueTextEffectLabel(effect: VideoCueTextEffect): string {
  return VIDEO_CUE_TEXT_EFFECTS.find(entry => entry.id === effect)?.label ?? 'Plain';
}
