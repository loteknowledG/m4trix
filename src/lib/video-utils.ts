const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/)?(\d+)/;

export const VIDEO_PLACEHOLDER =
  'data:image/svg+xml,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><rect width="320" height="180" fill="#18181b"/><polygon points="130,70 130,110 170,90" fill="#71717a"/></svg>`
  );

export function parseYouTubeId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export function parseVimeoId(url: string): string | null {
  const match = url.match(VIMEO_PATTERN);
  return match?.[1] ?? null;
}

export type VideoEmbedKind = 'youtube' | 'vimeo' | 'direct';

export function getVideoEmbedKind(src: string): VideoEmbedKind {
  if (parseYouTubeId(src)) return 'youtube';
  if (parseVimeoId(src)) return 'vimeo';
  return 'direct';
}

export function getEmbedUrl(src: string): string | null {
  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
  }
  const vimeoId = parseVimeoId(src);
  if (vimeoId) {
    return `https://player.vimeo.com/video/${vimeoId}?autoplay=1`;
  }
  return null;
}

export function getVideoThumbnail(src: string): string {
  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }
  if (src.startsWith('data:image/')) {
    return src;
  }
  return VIDEO_PLACEHOLDER;
}

export function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
