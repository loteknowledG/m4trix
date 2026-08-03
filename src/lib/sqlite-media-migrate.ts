import type { Database } from 'sql.js';

import {
  externalizeMediaInValue,
  externalizeMediaString,
  isInlineMediaSrc,
  isMediaReference,
  MEDIA_MIGRATION_KEY,
} from './media-blob-store';
import type { SqlValue } from './sqlite-kv';

type DbQuery = <T extends Record<string, SqlValue>>(
  db: Database,
  sql: string,
  bind?: SqlValue[],
) => T[];

type DbWrite = (fn: (db: Database) => void | Promise<void>) => Promise<void>;

function serialize(value: unknown): string {
  return JSON.stringify(value);
}

function deserialize(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function mediaMigrationDone(db: Database, query: DbQuery): boolean {
  const rows = query<{ value: string }>(db, 'SELECT value FROM kv WHERE key = ?', [MEDIA_MIGRATION_KEY]);
  return rows.length > 0;
}

export async function migrateMediaInDatabase(
  db: Database,
  query: DbQuery,
  withWrite: DbWrite,
): Promise<void> {
  if (mediaMigrationDone(db, query)) return;

  const momentRows = query<{ story_id: string; moment_id: string; src: string }>(
    db,
    'SELECT story_id, moment_id, src FROM story_moments',
  );
  const storyRows = query<{ id: string; preview_src: string | null }>(
    db,
    'SELECT id, preview_src FROM stories WHERE preview_src IS NOT NULL AND preview_src != ?',
    [''],
  );
  const playlistRows = query<{ id: string; cover_src: string | null }>(
    db,
    'SELECT id, cover_src FROM playlists WHERE cover_src IS NOT NULL AND cover_src != ?',
    [''],
  );
  const videoRows = query<{ playlist_id: string; video_id: string; src: string }>(
    db,
    'SELECT playlist_id, video_id, src FROM playlist_videos',
  );
  const kvRows = query<{ key: string; value: string }>(
    db,
    `SELECT key, value FROM kv
     WHERE key != ?
       AND key != '__sqlite_kv_migrated__'
       AND key != '__sqlite_relational_migrated__'`,
    [MEDIA_MIGRATION_KEY],
  );

  await withWrite(async (writeDb) => {
    for (const row of momentRows) {
      const src = String(row.src);
      if (!isInlineMediaSrc(src) && !isMediaReference(src)) continue;
      const next = await externalizeMediaString(src);
      if (next === src) continue;
      writeDb.run('UPDATE story_moments SET src = ? WHERE story_id = ? AND moment_id = ?', [
        next,
        row.story_id,
        row.moment_id,
      ]);
    }

    for (const row of storyRows) {
      const previewSrc = row.preview_src ? String(row.preview_src) : '';
      if (!previewSrc || (!isInlineMediaSrc(previewSrc) && !isMediaReference(previewSrc))) continue;
      const next = await externalizeMediaString(previewSrc);
      if (next === previewSrc) continue;
      writeDb.run('UPDATE stories SET preview_src = ? WHERE id = ?', [next, row.id]);
    }

    for (const row of playlistRows) {
      const coverSrc = row.cover_src ? String(row.cover_src) : '';
      if (!coverSrc || (!isInlineMediaSrc(coverSrc) && !isMediaReference(coverSrc))) continue;
      const next = await externalizeMediaString(coverSrc);
      if (next === coverSrc) continue;
      writeDb.run('UPDATE playlists SET cover_src = ? WHERE id = ?', [next, row.id]);
    }

    for (const row of videoRows) {
      const src = String(row.src);
      if (!isInlineMediaSrc(src) && !isMediaReference(src)) continue;
      const next = await externalizeMediaString(src);
      if (next === src) continue;
      writeDb.run('UPDATE playlist_videos SET src = ? WHERE playlist_id = ? AND video_id = ?', [
        next,
        row.playlist_id,
        row.video_id,
      ]);
    }

    for (const row of kvRows) {
      const value = deserialize(String(row.value));
      const externalized = await externalizeMediaInValue(value);
      const before = serialize(value);
      const after = serialize(externalized);
      if (before === after) continue;
      writeDb.run('UPDATE kv SET value = ? WHERE key = ?', [after, row.key]);
    }

    writeDb.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [MEDIA_MIGRATION_KEY, '"done"']);
  });
}
