type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  getVideoData: () => { video_id?: string };
  destroy: () => void;
};

type YouTubeNamespace = {
  Player: new (
    element: HTMLElement | string,
    options: {
      height?: string | number;
      width?: string | number;
      videoId?: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YouTubePlayer }) => void;
        onStateChange?: (event: { data: number; target: YouTubePlayer }) => void;
      };
    }
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: number;
  };
};

type VimeoPlayerInstance = {
  play: () => Promise<void>;
  loadVideo: (id: string | number) => Promise<number>;
  on: (event: 'ended' | 'ready', handler: () => void) => void;
  off: (event: 'ended' | 'ready', handler: () => void) => void;
  destroy: () => void;
};

type VimeoNamespace = {
  Player: new (
    element: HTMLElement,
    options: { id?: string | number; url?: string; autoplay?: boolean; responsive?: boolean }
  ) => VimeoPlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    Vimeo?: VimeoNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubePromise: Promise<YouTubeNamespace> | null = null;
let vimeoPromise: Promise<VimeoNamespace> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        resolve();
        return;
      }
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => {
      script.dataset.loaded = 'true';
      resolve();
    };
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function loadYouTubeIframeApi(): Promise<YouTubeNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('YouTube API unavailable during SSR'));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (!youtubePromise) {
    youtubePromise = new Promise((resolve, reject) => {
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        if (window.YT?.Player) resolve(window.YT);
        else reject(new Error('YouTube API did not initialize'));
      };
      void loadScript('https://www.youtube.com/iframe_api').catch(reject);
    });
  }
  return youtubePromise;
}

export function loadVimeoPlayerApi(): Promise<VimeoNamespace> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Vimeo API unavailable during SSR'));
  }
  if (window.Vimeo?.Player) {
    return Promise.resolve(window.Vimeo);
  }
  if (!vimeoPromise) {
    vimeoPromise = loadScript('https://player.vimeo.com/api/player.js').then(() => {
      if (!window.Vimeo?.Player) {
        throw new Error('Vimeo API did not initialize');
      }
      return window.Vimeo;
    });
  }
  return vimeoPromise;
}

export type { YouTubePlayer, VimeoPlayerInstance };
