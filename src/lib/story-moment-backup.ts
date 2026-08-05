import { get, set } from 'idb-keyval';

import {
  readStoryMomentItems,
  storyMomentId,
} from '@/lib/story-moments';

export const STORY_MOMENT_BACKUP_PREFIX = 'story-moment-backup:';
export const MAX_AUTO_BACKUPS_PER_STORY = 10;

export type StoryMomentAutoBackupReason = 'normalization' | 'recovery' | 'relational-set';

export type StoryMomentAutoBackupEntry = {
  id: string;
  createdAt: string;
  reason: StoryMomentAutoBackupReason;
  rawItemCount: number;
  fingerprint: string;
  payload: unknown;
};

function storyMomentBackupKey(storyId: string): string {
  return `${STORY_MOMENT_BACKUP_PREFIX}${storyId}`;
}

function backupFingerprint(stored: unknown): string {
  const items = readStoryMomentItems(stored);
  const firstId = storyMomentId(items[0]) ?? '';
  const lastId = storyMomentId(items[items.length - 1]) ?? '';
  let serializedLength = 0;
  try {
    serializedLength = JSON.stringify(stored).length;
  } catch {
    /* ignore */
  }
  return `${items.length}:${serializedLength}:${firstId}:${lastId}`;
}

export function shouldAutoBackupStoryMoments(
  rawItems: unknown[],
  normalizedCount: number,
  usedRecovery: boolean,
): boolean {
  if (rawItems.length === 0) return false;
  if (usedRecovery) return true;
  if (normalizedCount === 0) return true;
  if (normalizedCount < rawItems.length) return true;
  return false;
}

export async function listStoryMomentAutoBackups(
  storyId: string,
): Promise<StoryMomentAutoBackupEntry[]> {
  const entries = await get<StoryMomentAutoBackupEntry[]>(storyMomentBackupKey(storyId));
  return Array.isArray(entries) ? entries : [];
}

export async function listAllStoryMomentAutoBackups(): Promise<
  Array<{ storyId: string; backups: StoryMomentAutoBackupEntry[] }>
> {
  const { keys } = await import('idb-keyval');
  const allKeys = await keys();
  const storyIds = (allKeys as unknown[])
    .filter((key): key is string => typeof key === 'string' && key.startsWith(STORY_MOMENT_BACKUP_PREFIX))
    .map((key) => key.slice(STORY_MOMENT_BACKUP_PREFIX.length));

  const results = await Promise.all(
    storyIds.map(async (storyId) => ({
      storyId,
      backups: await listStoryMomentAutoBackups(storyId),
    })),
  );

  return results.filter((entry) => entry.backups.length > 0);
}

export async function autoBackupStoryMomentsBeforeNormalization(
  storyId: string,
  stored: unknown,
  reason: StoryMomentAutoBackupReason,
): Promise<boolean> {
  if (!storyId.trim()) return false;

  const rawItems = readStoryMomentItems(stored);
  if (rawItems.length === 0) return false;

  const fingerprint = backupFingerprint(stored);
  const existing = await listStoryMomentAutoBackups(storyId);
  if (existing[0]?.fingerprint === fingerprint) return false;

  const entry: StoryMomentAutoBackupEntry = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    reason,
    rawItemCount: rawItems.length,
    fingerprint,
    payload: structuredClone(stored),
  };

  const nextEntries = [entry, ...existing].slice(0, MAX_AUTO_BACKUPS_PER_STORY);
  await set(storyMomentBackupKey(storyId), nextEntries);
  return true;
}

export async function restoreStoryMomentAutoBackup(
  storyId: string,
  backupId: string,
): Promise<boolean> {
  const entries = await listStoryMomentAutoBackups(storyId);
  const match = entries.find((entry) => entry.id === backupId);
  if (!match) return false;

  await set(`story:${storyId}`, structuredClone(match.payload));

  try {
    const saved = (await get<Array<{ id: string; count?: number }>>('stories')) || [];
    const idx = saved.findIndex((entry) => entry.id === storyId);
    if (idx > -1) {
      saved[idx].count = match.rawItemCount;
      await set('stories', saved);
    }
  } catch {
    /* ignore metadata update failures */
  }

  try {
    window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id: storyId } }));
  } catch {
    /* ignore in non-browser */
  }

  return true;
}
