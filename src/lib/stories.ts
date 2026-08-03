import { get, set } from 'idb-keyval';

export type StoryMeta = {
  id: string;
  title?: string;
  count?: number;
  titleMomentId?: string;
  previewSrc?: string | null;
  description?: string;
  npcId?: string;
  playerId?: string;
  npcAppearance?: string;
  playerAppearance?: string;
  storyArc?: unknown;
  storyArcCurrentStage?: number;
  stagedMomentsByStage?: Record<number, string[]>;
  npcKnowsPlayer?: boolean;
  narratorEnabled?: boolean;
  directorNotes?: string;
  dialogLines?: unknown[];
};

export function newStoryId() {
  return `${Date.now()}-${Math.random()}`;
}

export function storyEditorHref(storyId: string) {
  return `/stories/edit/?story=${encodeURIComponent(storyId)}`;
}

export function storyPreviewMap(stories: StoryMeta[]): Record<string, string | null> {
  const map: Record<string, string | null> = {};
  for (const story of stories) {
    map[story.id] = story.previewSrc ?? null;
  }
  return map;
}

/** Create an empty story (same outcome as heap → Add to Story → New story with no moments). */
export async function createEmptyStory(): Promise<StoryMeta> {
  const id = newStoryId();
  const meta: StoryMeta = { id, count: 0, title: '' };
  await set(`story:${id}`, []);
  const saved = (await get<StoryMeta[]>('stories')) || [];
  await set('stories', [meta, ...saved]);
  await set('stories-active', id);
  try {
    window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
  } catch {
    /* ignore */
  }
  return meta;
}
