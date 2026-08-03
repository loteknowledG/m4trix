import {
  normalizeVideoCueTextEffects,
  resolveActiveTextEffects,
  type VideoCueTextEffect,
} from '@/lib/video-cue-text-effects';
import {
  normalizeCueColor,
  normalizeCueFont,
  type VideoCueFontId,
} from '@/lib/video-timed-cues';

export type CharacterDialogStyle = {
  /** @deprecated Use textEffects */
  textEffect?: VideoCueTextEffect;
  textEffects?: VideoCueTextEffect[];
  font?: VideoCueFontId;
  fontScale?: number;
  color?: string;
  shadowColor?: string;
  speakerColor?: string;
};

export const DEFAULT_CHARACTER_DIALOG_STYLE: Required<
  Pick<CharacterDialogStyle, 'font' | 'fontScale' | 'color' | 'shadowColor'>
> & {
  textEffects: VideoCueTextEffect[];
} = {
  textEffects: [],
  font: 'system',
  fontScale: 0.04,
  color: '#ffffff',
  shadowColor: '#000000',
};

export const NARRATOR_CHARACTER_DIALOG_STYLE: CharacterDialogStyle = {
  ...DEFAULT_CHARACTER_DIALOG_STYLE,
  color: '#fcd34d',
  speakerColor: '#fcd34d',
};

export function normalizeCharacterDialogStyle(
  value: unknown,
): CharacterDialogStyle | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const style: CharacterDialogStyle = {};

  const textEffects = normalizeVideoCueTextEffects(record.textEffects ?? record.textEffect);
  if (textEffects.length > 0) {
    style.textEffects = textEffects;
  }
  const font = normalizeCueFont(record.font);
  if (font) style.font = font;
  if (typeof record.fontScale === 'number' && Number.isFinite(record.fontScale)) {
    style.fontScale = Math.min(0.12, Math.max(0.02, record.fontScale));
  }
  if (typeof record.color === 'string') {
    style.color = normalizeCueColor(record.color, DEFAULT_CHARACTER_DIALOG_STYLE.color);
  }
  if (typeof record.shadowColor === 'string') {
    style.shadowColor = normalizeCueColor(
      record.shadowColor,
      DEFAULT_CHARACTER_DIALOG_STYLE.shadowColor,
    );
  }
  if (typeof record.speakerColor === 'string') {
    style.speakerColor = normalizeCueColor(record.speakerColor, '#ffffff');
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

export function resolveCharacterDialogStyle(
  style?: Partial<CharacterDialogStyle> | null,
): Required<
  Pick<CharacterDialogStyle, 'font' | 'fontScale' | 'color' | 'shadowColor'>
> &
  Pick<CharacterDialogStyle, 'speakerColor'> & {
    textEffects: VideoCueTextEffect[];
  } {
  return {
    textEffects: resolveActiveTextEffects(style?.textEffects ?? style?.textEffect),
    font: style?.font ?? DEFAULT_CHARACTER_DIALOG_STYLE.font,
    fontScale: style?.fontScale ?? DEFAULT_CHARACTER_DIALOG_STYLE.fontScale,
    color: style?.color ?? DEFAULT_CHARACTER_DIALOG_STYLE.color,
    shadowColor: style?.shadowColor ?? DEFAULT_CHARACTER_DIALOG_STYLE.shadowColor,
    speakerColor: style?.speakerColor,
  };
}

export function characterDialogFontSize(fontScale: number, compact = true): string {
  const multiplier = compact ? 14 : 18;
  const minimum = compact ? 0.65 : 0.75;
  return `${Math.max(minimum, fontScale * multiplier)}rem`;
}
