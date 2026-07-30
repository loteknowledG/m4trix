const YOUTUBE_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  /youtube-nocookie\.com\/embed\/([a-zA-Z0-9_-]{11})/,
];

const VIMEO_PATTERN = /vimeo\.com\/(?:video\/|embed\/)?(\d+)/;

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

export function isYouTubeHost(hostname: string): boolean {
  return (
    hostname === 'youtube.com' ||
    hostname.endsWith('.youtube.com') ||
    hostname === 'youtube-nocookie.com' ||
    hostname.endsWith('.youtube-nocookie.com')
  );
}

export function isVimeoHost(hostname: string): boolean {
  return (
    hostname === 'vimeo.com' ||
    hostname.endsWith('.vimeo.com') ||
    hostname === 'player.vimeo.com'
  );
}

export function isYouTubeOrigin(origin: string): boolean {
  try {
    return isYouTubeHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function isVimeoOrigin(origin: string): boolean {
  try {
    return isVimeoHost(new URL(origin).hostname);
  } catch {
    return false;
  }
}

export function isValidVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isValidEmbedSrc(src: string): boolean {
  return isValidVideoUrl(src);
}

export function embedNameFromSrc(src: string): string {
  try {
    if (parseYouTubeId(src)) return 'YouTube embed';
    if (parseVimeoId(src)) return 'Vimeo embed';
    const url = new URL(src);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return 'Embedded video';
  }
}

/** Parse iframe embed HTML or a bare embed URL into a playable src. */
export function parseEmbedCode(input: string): { src: string; name: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const iframeMatch = trimmed.match(/<iframe[\s\S]*?\ssrc=["']([^"']+)["']/i);
  if (iframeMatch?.[1]) {
    const src = iframeMatch[1].trim();
    if (!isValidEmbedSrc(src)) return null;
    return { src, name: embedNameFromSrc(src) };
  }

  if (isValidEmbedSrc(trimmed)) {
    return { src: trimmed, name: embedNameFromSrc(trimmed) };
  }

  return null;
}

function applyEmbedPlayerParams(embedSrc: string, autoPlay: boolean, origin?: string): string {
  try {
    const url = new URL(embedSrc);
    url.searchParams.set('autoplay', autoPlay ? '1' : '0');

    if (isYouTubeHost(url.hostname) || parseYouTubeId(embedSrc)) {
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('rel', '0');
      url.searchParams.set('playsinline', '1');
      url.searchParams.set('mute', '0');
      url.searchParams.set('version', '3');
      url.searchParams.set('fs', '0');
      if (origin) url.searchParams.set('origin', origin);
    }

    if (isVimeoHost(url.hostname) || parseVimeoId(embedSrc)) {
      url.searchParams.set('api', '1');
      url.searchParams.set('autopause', '0');
      url.searchParams.set('byline', '0');
      url.searchParams.set('title', '0');
      url.searchParams.set('fullscreen', '0');
    }

    return url.toString();
  } catch {
    return embedSrc;
  }
}

export function withAutoplay(embedSrc: string, enabled: boolean, origin?: string): string {
  return applyEmbedPlayerParams(embedSrc, enabled, origin);
}

export function getVideoEmbedKind(src: string): VideoEmbedKind {
  if (parseYouTubeId(src)) return 'youtube';
  if (parseVimeoId(src)) return 'vimeo';

  try {
    const hostname = new URL(src).hostname;
    if (isYouTubeHost(hostname)) return 'youtube';
    if (isVimeoHost(hostname)) return 'vimeo';
  } catch {
    /* ignore invalid URLs */
  }

  return 'direct';
}

export function getEmbedTargetOrigin(iframeSrc: string): string | null {
  try {
    return new URL(iframeSrc).origin;
  } catch {
    return null;
  }
}

/** Normalize pasted embed URLs to canonical player URLs with API params. */
export function normalizeEmbedSrc(src: string, autoPlay: boolean, origin?: string): string {
  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return applyEmbedPlayerParams(
      `https://www.youtube.com/embed/${youtubeId}`,
      autoPlay,
      origin
    );
  }

  const vimeoId = parseVimeoId(src);
  if (vimeoId) {
    return applyEmbedPlayerParams(
      `https://player.vimeo.com/video/${vimeoId}`,
      autoPlay,
      origin
    );
  }

  return applyEmbedPlayerParams(src, autoPlay, origin);
}

export function getEmbedUrl(src: string, autoPlay = true, origin?: string): string | null {
  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return applyEmbedPlayerParams(
      `https://www.youtube.com/embed/${youtubeId}`,
      autoPlay,
      origin
    );
  }
  const vimeoId = parseVimeoId(src);
  if (vimeoId) {
    return applyEmbedPlayerParams(
      `https://player.vimeo.com/video/${vimeoId}`,
      autoPlay,
      origin
    );
  }
  return null;
}

export function getIframeSrc(
  src: string,
  kind: 'url' | 'upload' | 'embed' | 'blob',
  autoPlay = true,
  origin?: string
): string | null {
  if (kind === 'upload' || kind === 'blob') return null;
  if (kind === 'embed') return normalizeEmbedSrc(src, autoPlay, origin);
  const embedUrl = getEmbedUrl(src, autoPlay, origin);
  return embedUrl;
}

export function getVideoThumbnail(
  src: string,
  kind?: 'url' | 'upload' | 'embed' | 'blob',
): string {
  const youtubeId = parseYouTubeId(src);
  if (youtubeId) {
    return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
  }
  if (kind === 'embed' || kind === 'url' || kind === 'blob') {
    return VIDEO_PLACEHOLDER;
  }
  if (src.startsWith('data:image/')) {
    return src;
  }
  return VIDEO_PLACEHOLDER;
}
