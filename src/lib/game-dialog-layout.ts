import { defaultXYForSpeakerZone, type DialogSpeakerPosition } from '@/lib/moment-dialog';
import {
  normalizeCharacterDialogStyle,
  NARRATOR_CHARACTER_DIALOG_STYLE,
  type CharacterDialogStyle,
} from '@/lib/character-dialog-style';

export type GameCharacterSlot = 'protagonist' | 'antagonist' | 'narrator';

export type GameDialogLayout = {
  x: number;
  y: number;
  width: number;
  fontScale: number;
};

export type GameDialogLayouts = Record<GameCharacterSlot, GameDialogLayout>;

const STORAGE_PREFIX = 'm4trix:game-dialog-layout:';
const COMPOSER_OPEN_PREFIX = 'm4trix:game-dialog-composer-open:';
const NARRATOR_STYLE_PREFIX = 'm4trix:game-narrator-dialog-style:';

const DEFAULT_ZONES: Record<GameCharacterSlot, DialogSpeakerPosition> = {
  protagonist: 'left',
  antagonist: 'right',
  narrator: 'top',
};

/** Fraction of stage width for default game dialog bubble width. */
const DEFAULT_GAME_DIALOG_WIDTH = 0.28;

export function defaultGameDialogLayout(slot: GameCharacterSlot): GameDialogLayout {
  const xy = defaultXYForSpeakerZone(DEFAULT_ZONES[slot]);
  return {
    x: xy.x,
    y: xy.y,
    width: DEFAULT_GAME_DIALOG_WIDTH,
    fontScale: 0.04,
  };
}

export function defaultGameDialogLayouts(): GameDialogLayouts {
  return {
    protagonist: defaultGameDialogLayout('protagonist'),
    antagonist: defaultGameDialogLayout('antagonist'),
    narrator: defaultGameDialogLayout('narrator'),
  };
}

function normalizeLayout(value: unknown, fallback: GameDialogLayout): GameDialogLayout {
  if (!value || typeof value !== 'object') return fallback;
  const record = value as Record<string, unknown>;
  const read = (key: keyof GameDialogLayout, min: number, max: number) => {
    const raw = record[key];
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return fallback[key];
    return Math.min(max, Math.max(min, raw));
  };
  const layout = {
    x: read('x', 0, 1),
    y: read('y', 0, 1),
    width: read('width', 0.2, 1),
    fontScale: read('fontScale', 0.02, 0.12),
  };
  // Migrate layouts saved with the old wide default (0.72+).
  if (layout.width >= 0.65) {
    layout.width = fallback.width;
  }
  return layout;
}

export function loadGameDialogLayouts(gameId: string | undefined): GameDialogLayouts {
  const defaults = defaultGameDialogLayouts();
  if (!gameId || typeof window === 'undefined') return defaults;
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${gameId}`);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<Record<GameCharacterSlot, unknown>>;
    return {
      protagonist: normalizeLayout(parsed.protagonist, defaults.protagonist),
      antagonist: normalizeLayout(parsed.antagonist, defaults.antagonist),
      narrator: normalizeLayout(parsed.narrator, defaults.narrator),
    };
  } catch {
    return defaults;
  }
}

export function saveGameDialogLayouts(gameId: string | undefined, layouts: GameDialogLayouts) {
  if (!gameId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${gameId}`, JSON.stringify(layouts));
  } catch {
    /* ignore */
  }
}

export function loadGameDialogComposerOpen(gameId: string | undefined): boolean {
  if (!gameId || typeof window === 'undefined') return true;
  try {
    const raw = window.localStorage.getItem(`${COMPOSER_OPEN_PREFIX}${gameId}`);
    return raw !== '0' && raw !== 'false';
  } catch {
    return true;
  }
}

export function saveGameDialogComposerOpen(gameId: string | undefined, open: boolean) {
  if (!gameId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${COMPOSER_OPEN_PREFIX}${gameId}`, open ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadGameNarratorDialogStyle(gameId: string | undefined): CharacterDialogStyle {
  if (!gameId || typeof window === 'undefined') {
    return { ...NARRATOR_CHARACTER_DIALOG_STYLE };
  }
  try {
    const raw = window.localStorage.getItem(`${NARRATOR_STYLE_PREFIX}${gameId}`);
    if (!raw) return { ...NARRATOR_CHARACTER_DIALOG_STYLE };
    return normalizeCharacterDialogStyle(JSON.parse(raw)) ?? { ...NARRATOR_CHARACTER_DIALOG_STYLE };
  } catch {
    return { ...NARRATOR_CHARACTER_DIALOG_STYLE };
  }
}

export function saveGameNarratorDialogStyle(
  gameId: string | undefined,
  style: CharacterDialogStyle,
) {
  if (!gameId || typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${NARRATOR_STYLE_PREFIX}${gameId}`,
      JSON.stringify(normalizeCharacterDialogStyle(style) ?? {}),
    );
  } catch {
    /* ignore */
  }
}
