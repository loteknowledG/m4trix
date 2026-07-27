import type { PlaylistVideo } from '@/lib/playlists';
import { normalizeEmbedSrc, parseVimeoId, parseYouTubeId } from '@/lib/video-utils';

export type UniversalPlaybackMode = 'youtube' | 'vimeo' | 'native' | 'iframe';

export type UniversalVideoSource = {
  mode: UniversalPlaybackMode;
  youtubeId?: string;
  vimeoId?: string;
  nativeSrc?: string;
  iframeSrc?: string;
};

const NATIVE_VIDEO_PATTERN = /\.(mp4|webm|ogg|mov|m4v|m3u8)(\?|$)/i;

function looksLikeNativeVideo(src: string): boolean {
  if (src.startsWith('data:video/') || src.startsWith('blob:')) return true;
  try {
    return NATIVE_VIDEO_PATTERN.test(new URL(src).pathname);
  } catch {
    return false;
  }
}

export function resolveUniversalVideoSource(
  src: string,
  kind: PlaylistVideo['kind'],
  autoPlay: boolean,
  origin?: string
): UniversalVideoSource | null {
  if (!src) return null;

  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return { mode: 'youtube', youtubeId };
  }

  const vimeoId = parseVimeoId(src);
  if (vimeoId) {
    return { mode: 'vimeo', vimeoId };
  }

  if (kind === 'upload') {
    return { mode: 'native', nativeSrc: src };
  }

  if (kind === 'embed') {
    return {
      mode: 'iframe',
      iframeSrc: normalizeEmbedSrc(src, autoPlay, origin),
    };
  }

  if (looksLikeNativeVideo(src)) {
    return { mode: 'native', nativeSrc: src };
  }

  return { mode: 'native', nativeSrc: src };
}
