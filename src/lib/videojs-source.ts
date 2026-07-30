import type { PlaylistVideo } from '@/lib/playlists';
import {
  getVideoEmbedKind,
  isValidVideoUrl,
  normalizeEmbedSrc,
  parseVimeoId,
  parseYouTubeId,
  type VideoEmbedKind,
} from '@/lib/video-utils';

export type VideoJsPlayback =
  | {
      mode: 'videojs';
      source: { type: string; src: string };
    }
  | {
      mode: 'iframe';
      iframeSrc: string;
      embedKind: VideoEmbedKind;
    };

const NATIVE_VIDEO_PATTERN = /\.(mp4|webm|ogg|mov|m4v|m3u8)(\?|$)/i;

function isNativeVideoSource(src: string, kind: PlaylistVideo['kind']): boolean {
  if (kind === 'upload' || kind === 'blob') return true;
  if (src.startsWith('data:video/') || src.startsWith('blob:')) return true;
  try {
    return NATIVE_VIDEO_PATTERN.test(new URL(src).pathname);
  } catch {
    return NATIVE_VIDEO_PATTERN.test(src);
  }
}

function guessVideoMime(src: string, mimeType?: string): string {
  if (mimeType?.startsWith('video/')) return mimeType;
  if (src.startsWith('data:video/')) {
    return src.slice(5).split(';')[0] || 'video/mp4';
  }
  if (/\.webm(\?|$)/i.test(src)) return 'video/webm';
  if (/\.ogg(\?|$)/i.test(src)) return 'video/ogg';
  if (/\.m3u8(\?|$)/i.test(src)) return 'application/x-mpegURL';
  return 'video/mp4';
}

function iframePlayback(
  src: string,
  autoPlay: boolean,
  origin: string | undefined,
  embedKind: VideoEmbedKind
): VideoJsPlayback {
  return {
    mode: 'iframe',
    iframeSrc: normalizeEmbedSrc(src, autoPlay, origin),
    embedKind,
  };
}

export function resolveVideoJsPlayback(
  src: string,
  kind: PlaylistVideo['kind'],
  autoPlay: boolean,
  origin?: string,
  mimeType?: string,
): VideoJsPlayback | null {
  if (!src) return null;

  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return iframePlayback(
      `https://www.youtube.com/embed/${youtubeId}`,
      autoPlay,
      origin,
      'youtube'
    );
  }

  const vimeoId = parseVimeoId(src);
  if (vimeoId) {
    return iframePlayback(
      `https://player.vimeo.com/video/${vimeoId}`,
      autoPlay,
      origin,
      'vimeo'
    );
  }

  if (kind === 'embed') {
    return iframePlayback(src, autoPlay, origin, getVideoEmbedKind(src));
  }

  if (isNativeVideoSource(src, kind)) {
    return {
      mode: 'videojs',
      source: {
        type: guessVideoMime(src, mimeType),
        src,
      },
    };
  }

  if (isValidVideoUrl(src)) {
    return iframePlayback(src, autoPlay, origin, getVideoEmbedKind(src));
  }

  return {
    mode: 'videojs',
    source: {
      type: guessVideoMime(src, mimeType),
      src,
    },
  };
}

/** Iframe embed kind when the video plays as an embed, otherwise null. */
export function getIframeEmbedKind(
  src: string,
  kind: PlaylistVideo['kind'],
): VideoEmbedKind | null {
  const playback = resolveVideoJsPlayback(src, kind, false);
  if (!playback || playback.mode !== 'iframe') return null;
  return playback.embedKind;
}
