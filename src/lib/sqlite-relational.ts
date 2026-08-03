import type { Database } from 'sql.js';

import type { PlaylistMeta, PlaylistVideo } from '@/lib/playlists';
import {
  normalizeStoryMomentList,
  readStoryMomentItems,
  type StoryMomentRecord,
} from '@/lib/story-moments';
import { getVideoThumbnail, VIDEO_PLACEHOLDER } from '@/lib/video-utils';

import type { SqlValue } from './sqlite-kv';

export const RELATIONAL_MIGRATION_KEY = '__sqlite_relational_migrated__';

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
  [key: string]: unknown;
};

type DbQuery = <T extends Record<string, SqlValue>>(
  db: Database,
  sql: string,
  bind?: SqlValue[],
) => T[];

type DbWrite = (fn: (db: Database) => void | Promise<void>) => Promise<void>;

type KvReadRaw = (db: Database, key: string) => unknown | undefined;

const STORY_CORE_KEYS = new Set(['id', 'title', 'count', 'titleMomentId', 'previewSrc']);

const PLAYLIST_CORE_KEYS = new Set(['id', 'title', 'count', 'coverSrc', 'titleVideoId']);

export function isRelationalKey(key: string): boolean {
  return (
    key === 'stories' ||
    key === 'playlists' ||
    key.startsWith('story:') ||
    key.startsWith('playlist:')
  );
}

export function createRelationalSchema(db: Database) {
  db.run(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      moment_count INTEGER NOT NULL DEFAULT 0,
      title_moment_id TEXT,
      preview_src TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      extras_json TEXT NOT NULL DEFAULT '{}',
      meta_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS story_moments (
      story_id TEXT NOT NULL,
      moment_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      src TEXT NOT NULL,
      name TEXT,
      fingerprint TEXT,
      extra_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (story_id, moment_id)
    );
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_story_moments_story_position
    ON story_moments(story_id, position);
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      video_count INTEGER NOT NULL DEFAULT 0,
      cover_src TEXT,
      title_video_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      meta_json TEXT NOT NULL DEFAULT '{}'
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS playlist_videos (
      playlist_id TEXT NOT NULL,
      video_id TEXT NOT NULL,
      position INTEGER NOT NULL,
      src TEXT NOT NULL,
      name TEXT,
      kind TEXT NOT NULL DEFAULT 'url',
      mime_type TEXT,
      extra_json TEXT NOT NULL DEFAULT '{}',
      PRIMARY KEY (playlist_id, video_id)
    );
  `);
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_playlist_videos_playlist_position
    ON playlist_videos(playlist_id, position);
  `);
}

function serializeJson(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return '{}';
  }
}

function deserializeJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function computePreviewSrc(moments: StoryMomentRecord[], titleMomentId?: string | null): string | null {
  if (titleMomentId) {
    const titleMoment = moments.find((moment) => moment.id === titleMomentId);
    if (titleMoment?.src) return titleMoment.src;
  }
  return moments[0]?.src ?? null;
}

function storyMetaFromRow(row: Record<string, SqlValue>): StoryMeta {
  const meta = deserializeJson<Record<string, unknown>>(String(row.meta_json ?? '{}'), {});
  return {
    ...meta,
    id: String(row.id),
    title: row.title ? String(row.title) : undefined,
    count: Number(row.moment_count ?? 0),
    titleMomentId: row.title_moment_id ? String(row.title_moment_id) : undefined,
    previewSrc: row.preview_src ? String(row.preview_src) : null,
  };
}

function playlistMetaFromRow(row: Record<string, SqlValue>): PlaylistMeta {
  const meta = deserializeJson<Record<string, unknown>>(String(row.meta_json ?? '{}'), {});
  return {
    ...meta,
    id: String(row.id),
    title: row.title ? String(row.title) : undefined,
    count: Number(row.video_count ?? 0),
    coverSrc: row.cover_src ? String(row.cover_src) : undefined,
    titleVideoId: row.title_video_id ? String(row.title_video_id) : undefined,
  };
}

function splitStoryMeta(meta: StoryMeta): {
  title: string;
  momentCount: number;
  titleMomentId: string | null;
  previewSrc: string | null;
  metaJson: string;
} {
  const metaExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (STORY_CORE_KEYS.has(key) || value === undefined) continue;
    metaExtras[key] = value;
  }
  return {
    title: meta.title ?? '',
    momentCount: meta.count ?? 0,
    titleMomentId: meta.titleMomentId ?? null,
    previewSrc: meta.previewSrc ?? null,
    metaJson: serializeJson(metaExtras),
  };
}

function splitPlaylistMeta(meta: PlaylistMeta): {
  title: string;
  videoCount: number;
  coverSrc: string | null;
  titleVideoId: string | null;
  metaJson: string;
} {
  const metaExtras: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PLAYLIST_CORE_KEYS.has(key) || value === undefined) continue;
    metaExtras[key] = value;
  }
  return {
    title: meta.title ?? '',
    videoCount: meta.count ?? 0,
    coverSrc: meta.coverSrc ?? null,
    titleVideoId: meta.titleVideoId ?? null,
    metaJson: serializeJson(metaExtras),
  };
}

function momentFromRow(row: Record<string, SqlValue>): StoryMomentRecord {
  const extra = deserializeJson<Record<string, unknown>>(String(row.extra_json ?? '{}'), {});
  return {
    id: String(row.moment_id),
    src: String(row.src),
    name: row.name ? String(row.name) : undefined,
    fingerprint: row.fingerprint ? String(row.fingerprint) : undefined,
    dialogScript: extra.dialogScript,
    dialogLines: extra.dialogLines,
  };
}

function momentExtraJson(moment: StoryMomentRecord): string {
  return serializeJson({
    dialogScript: moment.dialogScript,
    dialogLines: moment.dialogLines,
  });
}

function playlistVideoFromRow(row: Record<string, SqlValue>): PlaylistVideo {
  const extra = deserializeJson<Record<string, unknown>>(String(row.extra_json ?? '{}'), {});
  return {
    id: String(row.video_id),
    src: String(row.src),
    name: row.name ? String(row.name) : undefined,
    kind: (row.kind ? String(row.kind) : 'url') as PlaylistVideo['kind'],
    mimeType: row.mime_type ? String(row.mime_type) : undefined,
    cues: extra.cues as PlaylistVideo['cues'],
    skipSegments: extra.skipSegments as PlaylistVideo['skipSegments'],
  };
}

function playlistVideoExtraJson(video: PlaylistVideo): string {
  return serializeJson({
    cues: video.cues,
    skipSegments: video.skipSegments,
  });
}

function parseStoryPayload(value: unknown): {
  moments: StoryMomentRecord[];
  extras: Record<string, unknown>;
} {
  if (Array.isArray(value)) {
    return { moments: normalizeStoryMomentList(value), extras: {} };
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const moments = normalizeStoryMomentList(readStoryMomentItems(value));
    const extras = { ...record };
    delete extras.items;
    return { moments, extras };
  }
  return { moments: [], extras: {} };
}

function buildStoryPayload(
  moments: StoryMomentRecord[],
  extras: Record<string, unknown>,
): unknown {
  const extrasKeys = Object.keys(extras);
  if (extrasKeys.length === 0) {
    return moments;
  }
  return { ...extras, items: moments };
}

function resolvePlaylistCover(videos: PlaylistVideo[], meta: PlaylistMeta): string | undefined {
  if (meta.coverSrc) return meta.coverSrc;
  if (meta.titleVideoId) {
    const titleVideo = videos.find((video) => video.id === meta.titleVideoId);
    if (titleVideo?.src) return getVideoThumbnail(titleVideo.src, titleVideo.kind);
  }
  if (videos[0]?.src) return getVideoThumbnail(videos[0].src, videos[0].kind);
  return VIDEO_PLACEHOLDER;
}

function upsertStoryRow(
  db: Database,
  meta: StoryMeta,
  sortOrder: number,
  extrasJson?: string,
  previewOverride?: string | null,
) {
  const split = splitStoryMeta(meta);
  const existing = queryObjects<{ extras_json: string; preview_src: string | null }>(
    db,
    'SELECT extras_json, preview_src FROM stories WHERE id = ?',
    [meta.id],
  );
  const resolvedExtras = extrasJson ?? (existing[0] ? String(existing[0].extras_json) : '{}');
  const resolvedPreview =
    previewOverride ??
    (existing[0]?.preview_src ? String(existing[0].preview_src) : split.previewSrc);

  db.run(
    `INSERT INTO stories(
      id, title, moment_count, title_moment_id, preview_src, sort_order, extras_json, meta_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = CASE WHEN excluded.title != '' THEN excluded.title ELSE stories.title END,
      moment_count = excluded.moment_count,
      title_moment_id = COALESCE(excluded.title_moment_id, stories.title_moment_id),
      preview_src = COALESCE(excluded.preview_src, stories.preview_src),
      sort_order = CASE WHEN excluded.sort_order > 0 OR stories.sort_order = 0 THEN excluded.sort_order ELSE stories.sort_order END,
      extras_json = CASE WHEN excluded.extras_json != '{}' THEN excluded.extras_json ELSE stories.extras_json END,
      meta_json = CASE WHEN excluded.meta_json != '{}' THEN excluded.meta_json ELSE stories.meta_json END`,
    [
      meta.id,
      split.title,
      split.momentCount,
      split.titleMomentId,
      resolvedPreview,
      sortOrder,
      resolvedExtras,
      split.metaJson,
    ],
  );
}

function replaceStoryMoments(db: Database, storyId: string, moments: StoryMomentRecord[]) {
  db.run('DELETE FROM story_moments WHERE story_id = ?', [storyId]);
  moments.forEach((moment, position) => {
    db.run(
      `INSERT INTO story_moments(
        story_id, moment_id, position, src, name, fingerprint, extra_json
      ) VALUES(?, ?, ?, ?, ?, ?, ?)`,
      [
        storyId,
        moment.id,
        position,
        moment.src,
        moment.name ?? null,
        moment.fingerprint ?? null,
        momentExtraJson(moment),
      ],
    );
  });
}

function loadStoryMoments(db: Database, storyId: string): StoryMomentRecord[] {
  const rows = queryObjects(db, 'SELECT * FROM story_moments WHERE story_id = ? ORDER BY position', [
    storyId,
  ]);
  return rows.map(momentFromRow);
}

function queryObjects<T extends Record<string, SqlValue>>(
  db: Database,
  sql: string,
  bind: SqlValue[] = [],
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(bind);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function upsertPlaylistRow(db: Database, meta: PlaylistMeta, sortOrder: number) {
  const split = splitPlaylistMeta(meta);
  db.run(
    `INSERT INTO playlists(
      id, title, video_count, cover_src, title_video_id, sort_order, meta_json
    ) VALUES(?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      video_count = excluded.video_count,
      cover_src = excluded.cover_src,
      title_video_id = excluded.title_video_id,
      sort_order = excluded.sort_order,
      meta_json = excluded.meta_json`,
    [
      meta.id,
      split.title,
      split.videoCount,
      split.coverSrc,
      split.titleVideoId,
      sortOrder,
      split.metaJson,
    ],
  );
}

function replacePlaylistVideos(db: Database, playlistId: string, videos: PlaylistVideo[]) {
  db.run('DELETE FROM playlist_videos WHERE playlist_id = ?', [playlistId]);
  videos.forEach((video, position) => {
    db.run(
      `INSERT INTO playlist_videos(
        playlist_id, video_id, position, src, name, kind, mime_type, extra_json
      ) VALUES(?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        playlistId,
        video.id,
        position,
        video.src,
        video.name ?? null,
        video.kind,
        video.mimeType ?? null,
        playlistVideoExtraJson(video),
      ],
    );
  });
}

function loadPlaylistVideos(db: Database, playlistId: string): PlaylistVideo[] {
  const rows = queryObjects(
    db,
    'SELECT * FROM playlist_videos WHERE playlist_id = ? ORDER BY position',
    [playlistId],
  );
  return rows.map(playlistVideoFromRow);
}

export function relationalMigrationDone(db: Database): boolean {
  const rows = queryObjects<{ value: string }>(db, 'SELECT value FROM kv WHERE key = ?', [
    RELATIONAL_MIGRATION_KEY,
  ]);
  return rows.length > 0;
}

export async function migrateRelationalFromKv(
  db: Database,
  kvReadRaw: KvReadRaw,
  withWrite: DbWrite,
) {
  if (relationalMigrationDone(db)) return;

  const stories = (kvReadRaw(db, 'stories') as StoryMeta[] | undefined) ?? [];
  const playlists = (kvReadRaw(db, 'playlists') as PlaylistMeta[] | undefined) ?? [];

  await withWrite(async (writeDb) => {
    stories.forEach((meta, index) => {
      if (!meta?.id) return;
      const payload = kvReadRaw(writeDb, `story:${meta.id}`);
      const { moments, extras } = parseStoryPayload(payload);
      const previewSrc = computePreviewSrc(moments, meta.titleMomentId);
      upsertStoryRow(
        writeDb,
        { ...meta, count: moments.length, previewSrc },
        index,
        serializeJson(extras),
        previewSrc,
      );
      replaceStoryMoments(writeDb, meta.id, moments);
    });

    playlists.forEach((meta, index) => {
      if (!meta?.id) return;
      const videos = (kvReadRaw(writeDb, `playlist:${meta.id}`) as PlaylistVideo[] | undefined) ?? [];
      const coverSrc = resolvePlaylistCover(videos, meta);
      upsertPlaylistRow(
        writeDb,
        { ...meta, count: videos.length, coverSrc },
        index,
      );
      replacePlaylistVideos(writeDb, meta.id, videos);
    });

    writeDb.run('INSERT OR REPLACE INTO kv(key, value) VALUES(?, ?)', [
      RELATIONAL_MIGRATION_KEY,
      '"done"',
    ]);
  });
}

export async function listStoriesWithPreviews(
  query: DbQuery,
  db: Database,
): Promise<StoryMeta[]> {
  const rows = query(db, 'SELECT * FROM stories ORDER BY sort_order ASC, rowid ASC');
  return rows.map(storyMetaFromRow);
}

export async function relationalGet(
  key: string,
  query: DbQuery,
  db: Database,
): Promise<unknown | undefined> {
  if (key === 'stories') {
    return listStoriesWithPreviews(query, db);
  }

  if (key.startsWith('story:')) {
    const storyId = key.slice('story:'.length);
    const rows = query(db, 'SELECT * FROM stories WHERE id = ?', [storyId]);
    if (!rows[0]) return undefined;
    const moments = loadStoryMoments(db, storyId);
    const extras = deserializeJson<Record<string, unknown>>(String(rows[0].extras_json ?? '{}'), {});
    return buildStoryPayload(moments, extras);
  }

  if (key === 'playlists') {
    const rows = query(db, 'SELECT * FROM playlists ORDER BY sort_order ASC, rowid ASC');
    return rows.map(playlistMetaFromRow);
  }

  if (key.startsWith('playlist:')) {
    const playlistId = key.slice('playlist:'.length);
    const rows = query(db, 'SELECT id FROM playlists WHERE id = ?', [playlistId]);
    if (!rows[0]) return undefined;
    return loadPlaylistVideos(db, playlistId);
  }

  return undefined;
}

export async function relationalSet(
  key: string,
  value: unknown,
  query: DbQuery,
  withWrite: DbWrite,
): Promise<void> {
  if (key === 'stories') {
    const list = Array.isArray(value) ? (value as StoryMeta[]) : [];
    await withWrite(async (db) => {
      const existing = queryObjects<{ id: string }>(db, 'SELECT id FROM stories');
      const nextIds = new Set(list.map((entry) => entry.id));
      for (const row of existing) {
        if (!nextIds.has(row.id)) {
          db.run('DELETE FROM story_moments WHERE story_id = ?', [row.id]);
          db.run('DELETE FROM stories WHERE id = ?', [row.id]);
        }
      }
      list.forEach((meta, index) => {
        const moments = loadStoryMoments(db, meta.id);
        const previewSrc =
          meta.previewSrc ??
          computePreviewSrc(moments, meta.titleMomentId ?? null);
        upsertStoryRow(
          db,
          {
            ...meta,
            count: meta.count ?? moments.length,
            previewSrc,
          },
          index,
          undefined,
          previewSrc,
        );
      });
    });
    return;
  }

  if (key.startsWith('story:')) {
    const storyId = key.slice('story:'.length);
    const { moments, extras } = parseStoryPayload(value);
    const previewSrc = computePreviewSrc(moments);
    await withWrite(async (db) => {
      const rows = queryObjects<{ meta_json: string; title_moment_id: string | null }>(
        db,
        'SELECT meta_json, title_moment_id FROM stories WHERE id = ?',
        [storyId],
      );
      const existingMeta = rows[0]
        ? deserializeJson<Record<string, unknown>>(String(rows[0].meta_json), {})
        : {};
      const titleMomentId =
        typeof existingMeta.titleMomentId === 'string'
          ? existingMeta.titleMomentId
          : rows[0]?.title_moment_id
            ? String(rows[0].title_moment_id)
            : null;
      const resolvedPreview = computePreviewSrc(moments, titleMomentId);
      upsertStoryRow(
        db,
        {
          id: storyId,
          count: moments.length,
          previewSrc: resolvedPreview,
        },
        0,
        serializeJson(extras),
        resolvedPreview,
      );
      replaceStoryMoments(db, storyId, moments);
      db.run('UPDATE stories SET moment_count = ?, preview_src = ? WHERE id = ?', [
        moments.length,
        resolvedPreview,
        storyId,
      ]);
    });
    return;
  }

  if (key === 'playlists') {
    const list = Array.isArray(value) ? (value as PlaylistMeta[]) : [];
    await withWrite(async (db) => {
      const existing = queryObjects<{ id: string }>(db, 'SELECT id FROM playlists');
      const nextIds = new Set(list.map((entry) => entry.id));
      for (const row of existing) {
        if (!nextIds.has(row.id)) {
          db.run('DELETE FROM playlist_videos WHERE playlist_id = ?', [row.id]);
          db.run('DELETE FROM playlists WHERE id = ?', [row.id]);
        }
      }
      list.forEach((meta, index) => {
        upsertPlaylistRow(db, meta, index);
      });
    });
    return;
  }

  if (key.startsWith('playlist:')) {
    const playlistId = key.slice('playlist:'.length);
    const videos = Array.isArray(value) ? (value as PlaylistVideo[]) : [];
    await withWrite(async (db) => {
      replacePlaylistVideos(db, playlistId, videos);
      const rows = queryObjects<{ meta_json: string; title_video_id: string | null }>(
        db,
        'SELECT meta_json, title_video_id FROM playlists WHERE id = ?',
        [playlistId],
      );
      const meta = rows[0]
        ? playlistMetaFromRow(rows[0] as Record<string, SqlValue>)
        : ({ id: playlistId } as PlaylistMeta);
      const coverSrc = resolvePlaylistCover(videos, meta);
      upsertPlaylistRow(
        db,
        {
          ...meta,
          count: videos.length,
          coverSrc,
        },
        0,
      );
      db.run('UPDATE playlists SET video_count = ?, cover_src = ? WHERE id = ?', [
        videos.length,
        coverSrc ?? null,
        playlistId,
      ]);
    });
  }
}

export async function relationalDel(
  key: string,
  withWrite: DbWrite,
): Promise<void> {
  if (key.startsWith('story:')) {
    const storyId = key.slice('story:'.length);
    await withWrite(async (db) => {
      db.run('DELETE FROM story_moments WHERE story_id = ?', [storyId]);
      db.run('DELETE FROM stories WHERE id = ?', [storyId]);
    });
    return;
  }

  if (key.startsWith('playlist:')) {
    const playlistId = key.slice('playlist:'.length);
    await withWrite(async (db) => {
      db.run('DELETE FROM playlist_videos WHERE playlist_id = ?', [playlistId]);
      db.run('DELETE FROM playlists WHERE id = ?', [playlistId]);
    });
  }
}
