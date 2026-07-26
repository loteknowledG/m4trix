export const STORY_STAGE_PALETTES = [
  { bg: '#ffffff', fg: '#000000' },
  { bg: '#000000', fg: '#ffffff' },
  { bg: '#dddddd', fg: '#333333' },
  { bg: '#333333', fg: '#dddddd' },
  { bg: '#ffff00', fg: '#ffffff' },
  { bg: '#000000', fg: '#ffff00' },
  { bg: '#00ffff', fg: '#ffffff' },
  { bg: '#000000', fg: '#00ffff' },
  { bg: '#ff00ff', fg: '#ffffff' },
  { bg: '#000000', fg: '#ff00ff' },
] as const;

export function getStagePalette(index: number) {
  return STORY_STAGE_PALETTES[index % STORY_STAGE_PALETTES.length];
}
