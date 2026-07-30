import { get, set } from 'idb-keyval';
import { playlistEditorHref } from '@/lib/video-routes';
import { getVideoThumbnail, VIDEO_PLACEHOLDER } from '@/lib/video-utils';
import type { VideoTimedCue } from '@/lib/video-timed-cues';
import type { VideoSkipSegment } from '@/lib/video-skip-segments';

export type PlaylistMeta = {
  id: string;
  title?: string;
  count?: number;
  coverSrc?: string;
  titleVideoId?: string;
};

export type PlaylistVideo = {
  id: string;
  src: string;
  name?: string;
  kind: 'url' | 'upload' | 'embed' | 'blob';
  /** MIME type for session blob previews (e.g. video/webm). */
  mimeType?: string;
  cues?: VideoTimedCue[];
  skipSegments?: VideoSkipSegment[];
};

export function isEphemeralPlaylistVideo(
  video: Pick<PlaylistVideo, 'kind' | 'src'>,
): boolean {
  return video.kind === 'blob' || video.src.startsWith('blob:');
}

function filterPersistedPlaylistVideos(videos: PlaylistVideo[]): PlaylistVideo[] {
  return videos.filter(video => !isEphemeralPlaylistVideo(video));
}

export function newPlaylistId() {
  return `${Date.now()}-${Math.random()}`;
}

export { playlistEditorHref };

function dispatchPlaylistsUpdated(detail?: { id?: string }) {
  try {
    window.dispatchEvent(new CustomEvent('playlists-updated', { detail: detail ?? {} }));
  } catch {
    /* ignore */
  }
}

async function getPlaylistsList(): Promise<PlaylistMeta[]> {
  return (await get<PlaylistMeta[]>('playlists')) || [];
}

async function savePlaylistsList(list: PlaylistMeta[]) {
  await set('playlists', list);
}

async function getPlaylistVideos(id: string): Promise<PlaylistVideo[]> {
  const raw = await get<PlaylistVideo[]>(`playlist:${id}`);
  if (!Array.isArray(raw)) return [];
  return filterPersistedPlaylistVideos(raw);
}

function resolveCoverSrc(videos: PlaylistVideo[], meta: PlaylistMeta): string | undefined {
  if (meta.coverSrc) return meta.coverSrc;
  if (meta.titleVideoId) {
    const titleVideo = videos.find(v => v.id === meta.titleVideoId);
    if (titleVideo?.src) return getVideoThumbnail(titleVideo.src, titleVideo.kind);
  }
  if (videos[0]?.src) return getVideoThumbnail(videos[0].src, videos[0].kind);
  return VIDEO_PLACEHOLDER;
}

async function syncPlaylistMeta(id: string, videos: PlaylistVideo[]) {
  const list = await getPlaylistsList();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return;

  const meta = list[idx];
  const coverSrc = resolveCoverSrc(videos, meta);
  list[idx] = {
    ...meta,
    count: videos.length,
    coverSrc,
  };
  await savePlaylistsList(list);
}

/** Create an empty playlist. */
export async function createEmptyPlaylist(): Promise<PlaylistMeta> {
  const id = newPlaylistId();
  const meta: PlaylistMeta = { id, count: 0, title: '' };
  await set(`playlist:${id}`, []);
  const saved = await getPlaylistsList();
  await savePlaylistsList([meta, ...saved]);
  await set('playlists-active', id);
  dispatchPlaylistsUpdated({ id });
  return meta;
}

export async function getPlaylistMeta(id: string): Promise<PlaylistMeta | null> {
  const list = await getPlaylistsList();
  return list.find(p => p.id === id) ?? null;
}

export async function updatePlaylistMeta(id: string, patch: Partial<PlaylistMeta>) {
  const list = await getPlaylistsList();
  const idx = list.findIndex(p => p.id === id);
  if (idx === -1) return null;

  list[idx] = { ...list[idx], ...patch };
  await savePlaylistsList(list);
  dispatchPlaylistsUpdated({ id });
  return list[idx];
}

export async function renamePlaylist(id: string, title: string) {
  return updatePlaylistMeta(id, { title });
}

export async function addVideoToPlaylist(id: string, video: PlaylistVideo) {
  if (isEphemeralPlaylistVideo(video)) {
    throw new Error('Session blob videos cannot be saved to a playlist');
  }
  const videos = await getPlaylistVideos(id);
  const next = [...videos, video];
  await set(`playlist:${id}`, next);
  await syncPlaylistMeta(id, next);
  dispatchPlaylistsUpdated({ id });
  return next;
}

export async function removeVideoFromPlaylist(id: string, videoId: string) {
  const videos = await getPlaylistVideos(id);
  const next = videos.filter(v => v.id !== videoId);
  await set(`playlist:${id}`, next);
  await syncPlaylistMeta(id, next);
  dispatchPlaylistsUpdated({ id });
  return next;
}

export async function updatePlaylistVideo(
  id: string,
  videoId: string,
  patch: Partial<Pick<PlaylistVideo, 'name' | 'cues' | 'skipSegments'>>,
) {
  const videos = await getPlaylistVideos(id);
  const idx = videos.findIndex(v => v.id === videoId);
  if (idx === -1) return videos;

  const next = [...videos];
  next[idx] = { ...next[idx], ...patch };
  await set(`playlist:${id}`, next);
  dispatchPlaylistsUpdated({ id });
  return next;
}

export async function loadPlaylistVideos(id: string): Promise<PlaylistVideo[]> {
  return getPlaylistVideos(id);
}

export async function loadAllPlaylists(): Promise<PlaylistMeta[]> {
  return getPlaylistsList();
}

export async function resolvePlaylistCover(meta: PlaylistMeta): Promise<string | null> {
  if (meta.coverSrc) return meta.coverSrc;
  const videos = await getPlaylistVideos(meta.id);
  return resolveCoverSrc(videos, meta) ?? null;
}
