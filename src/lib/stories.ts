import { del, get, set } from 'idb-keyval';

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
  playerKnowsNpc?: boolean;
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

/** Match story detail routing: /stories/edit?story=id or /stories/{id}. */
export function resolveActiveStoryId(
  pathname: string | null | undefined,
  storyQueryParam: string | null | undefined,
): string | null {
  if (!pathname?.startsWith('/stories/')) {
    return storyQueryParam || null;
  }
  const routeSegment = pathname.split('/')[2];
  if (!routeSegment || routeSegment === 'edit') {
    return storyQueryParam || null;
  }
  return routeSegment;
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

/** Move stories to trash (snapshot payloads before relational rows are removed). */
export async function moveStoriesToTrash(storyIds: string[]): Promise<number> {
  const ids = [...new Set(storyIds.filter(Boolean))];
  if (ids.length === 0) return 0;

  const allStories = (await get<StoryMeta[]>('stories')) || [];
  const idSet = new Set(ids);
  const toTrash = allStories.filter((story) => idSet.has(story.id));
  if (toTrash.length === 0) return 0;

  const payloads = await Promise.all(
    ids.map(async (id) => ({
      id,
      payload: await get<unknown>(`story:${id}`),
    })),
  );

  const existingTrash = (await get<StoryMeta[]>('trash-stories')) || [];
  const trashIds = new Set(toTrash.map((story) => story.id));
  await set('trash-stories', [
    ...toTrash,
    ...existingTrash.filter((story) => !trashIds.has(story.id)),
  ]);

  await Promise.all(
    payloads.map(async ({ id, payload }) => {
      if (payload !== undefined) {
        await set(`trash-story:${id}`, payload);
      }
    }),
  );

  const remainingStories = allStories.filter((story) => !idSet.has(story.id));
  await set('stories', remainingStories);

  await Promise.all(ids.map((id) => del(`story:${id}`)));

  try {
    window.dispatchEvent(new CustomEvent('stories-updated', { detail: {} }));
  } catch {
    /* ignore */
  }

  return toTrash.length;
}
