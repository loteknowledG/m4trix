import { get, set } from 'idb-keyval';

export type StoryMeta = {
  id: string;
  title?: string;
  count?: number;
  titleMomentId?: string;
};

export function newStoryId() {
  return `${Date.now()}-${Math.random()}`;
}

export function storyEditorHref(storyId: string) {
  return `/stories/new/?story=${encodeURIComponent(storyId)}`;
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
