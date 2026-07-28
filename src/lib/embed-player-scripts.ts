type YouTubePlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  loadVideoById: (videoId: string) => void;
  getVideoData: () => { video_id?: string };
  getCurrentTime: () => number;
  getPlayerState: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
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
        onError?: (event: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
  PlayerState: {
    ENDED: 0;
    PLAYING: 1;
    PAUSED: 2;
    BUFFERING: 3;
    CUED: 5;
  };
};

type VimeoPlayerInstance = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  loadVideo: (id: string | number) => Promise<number>;
  getCurrentTime: () => Promise<number>;
  setCurrentTime: (seconds: number) => Promise<number>;
  on: (
    event: 'ended' | 'ready' | 'play' | 'pause' | 'timeupdate',
    handler: (data?: { seconds?: number }) => void,
  ) => void;
  off: (
    event: 'ended' | 'ready' | 'play' | 'pause' | 'timeupdate',
    handler: (data?: { seconds?: number }) => void,
  ) => void;
  destroy: () => void;
};

type VimeoNamespace = {
  Player: new (
    element: HTMLElement,
    options: { id?: string | number; url?: string; autoplay?: boolean; responsive?: boolean },
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

export function attachYouTubePlayer(
  iframe: HTMLIFrameElement,
  handlers: {
    onReady?: (player: YouTubePlayer) => void;
    onStateChange?: (state: number, player: YouTubePlayer) => void;
    onError?: (code: number) => void;
  },
): Promise<YouTubePlayer> {
  if (!iframe.id) {
    iframe.id = `m4trix-yt-${Math.random().toString(36).slice(2, 10)}`;
  }

  return loadYouTubeIframeApi().then(
    YT =>
      new Promise((resolve, reject) => {
        let settled = false;
        try {
          const player = new YT.Player(iframe, {
            events: {
              onReady: () => {
                if (settled) return;
                settled = true;
                handlers.onReady?.(player);
                resolve(player);
              },
              onStateChange: event => {
                handlers.onStateChange?.(event.data, player);
              },
              onError: event => {
                handlers.onError?.(event.data);
                if (!settled) {
                  settled = true;
                  reject(new Error(`YouTube player error ${event.data}`));
                }
              },
            },
          });
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Failed to create YouTube player'));
        }
      }),
  );
}

export function attachVimeoPlayer(
  iframe: HTMLIFrameElement,
  handlers: {
    onReady?: (player: VimeoPlayerInstance) => void;
    onTimeUpdate?: (seconds: number) => void;
    onPlay?: () => void;
    onPause?: () => void;
    onEnded?: () => void;
    onError?: (error: unknown) => void;
  },
): Promise<VimeoPlayerInstance> {
  return loadVimeoPlayerApi().then(Vimeo => {
    const player = new Vimeo.Player(iframe, { url: iframe.src });
    const onTimeUpdate = (data?: { seconds?: number }) => {
      if (typeof data?.seconds === 'number' && Number.isFinite(data.seconds)) {
        handlers.onTimeUpdate?.(data.seconds);
      }
    };

    player.on('timeupdate', onTimeUpdate);
    player.on('play', () => handlers.onPlay?.());
    player.on('pause', () => handlers.onPause?.());
    player.on('ended', () => handlers.onEnded?.());
    player.on('ready', () => handlers.onReady?.(player));

    void player
      .getCurrentTime()
      .then(seconds => {
        if (Number.isFinite(seconds)) handlers.onTimeUpdate?.(seconds);
      })
      .catch(error => handlers.onError?.(error));

    return player;
  });
}

export type { YouTubePlayer, VimeoPlayerInstance };
