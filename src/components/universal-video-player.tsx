'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import type Player from 'video.js/dist/types/player';
import { scheduleEmbedAutoClick, isElectronEmbedAutoClickAvailable } from '@/lib/embed-auto-click';
import { resolveVideoJsPlayback } from '@/lib/videojs-source';
import type { PlaylistVideo } from '@/lib/playlists';
import {
  getEmbedTargetOrigin,
  isVimeoOrigin,
  isYouTubeOrigin,
  type VideoEmbedKind,
} from '@/lib/video-utils';
import { cn } from '@/lib/utils';
import 'video.js/dist/video-js.css';

export type UniversalVideoPlayerProps = {
  src: string;
  kind?: PlaylistVideo['kind'];
  videoId?: string;
  autoPlay?: boolean;
  userActivated?: boolean;
  className?: string;
  onEnded?: () => void;
};

function parseMessageData(data: unknown): Record<string, unknown> | null {
  if (typeof data === 'string') {
    try {
      const parsed: unknown = JSON.parse(data);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return data && typeof data === 'object' ? (data as Record<string, unknown>) : null;
}

function isEmbedEndedMessage(origin: string, data: unknown): boolean {
  const payload = parseMessageData(data);
  if (!payload) return false;

  if (isYouTubeOrigin(origin)) {
    const info = payload.info;
    if (info && typeof info === 'object' && 'playerState' in info) {
      return (info as { playerState?: number }).playerState === 0;
    }
    return payload.event === 'onStateChange' && payload.info === 0;
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'finish';
  }

  return false;
}

function isEmbedReadyMessage(origin: string, data: unknown): boolean {
  const payload = parseMessageData(data);
  if (!payload) return false;

  if (isYouTubeOrigin(origin)) {
    return payload.event === 'onReady';
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'ready';
  }

  return false;
}

function isEmbedPlayingMessage(origin: string, data: unknown): boolean {
  const payload = parseMessageData(data);
  if (!payload) return false;

  if (isYouTubeOrigin(origin)) {
    const info = payload.info;
    if (info && typeof info === 'object' && 'playerState' in info) {
      return (info as { playerState?: number }).playerState === 1;
    }
    return payload.event === 'onStateChange' && payload.info === 1;
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'play';
  }

  return false;
}

function postEmbedPlay(iframe: HTMLIFrameElement, iframeSrc: string, embedKind: VideoEmbedKind) {
  const win = iframe.contentWindow;
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!win || !targetOrigin) return;

  if (embedKind === 'youtube') {
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: '' }),
      targetOrigin
    );
    return;
  }

  if (embedKind === 'vimeo') {
    win.postMessage(JSON.stringify({ method: 'play' }), targetOrigin);
  }
}

function notifyYouTubeListening(iframe: HTMLIFrameElement, iframeSrc: string) {
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!targetOrigin) return;

  iframe.contentWindow?.postMessage(
    JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
    targetOrigin
  );
}

function useEmbedAutoClick(
  containerRef: RefObject<HTMLElement | null>,
  videoKey: string,
  enabled: boolean,
  shouldRetry: () => boolean,
) {
  useEffect(() => {
    if (!enabled || !isElectronEmbedAutoClickAvailable()) return;
    return scheduleEmbedAutoClick(() => containerRef.current, {
      enabled: true,
      shouldRetry,
    });
  }, [containerRef, videoKey, enabled, shouldRetry]);
}

function EmbedIframePlayer({
  iframeSrc,
  embedKind,
  autoPlay,
  userActivated = false,
  videoId,
  onEnded,
  className,
}: {
  iframeSrc: string;
  embedKind: VideoEmbedKind;
  autoPlay: boolean;
  userActivated?: boolean;
  videoId?: string;
  onEnded?: () => void;
  className?: string;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef(autoPlay);
  const onEndedRef = useRef(onEnded);
  const userActivatedRef = useRef(userActivated);
  const endedRef = useRef(false);
  const embedPlayingRef = useRef(false);
  const [awaitingUserStart, setAwaitingUserStart] = useState(
    autoPlay && !userActivated && embedKind !== 'direct'
  );
  const awaitingUserStartRef = useRef(awaitingUserStart);
  awaitingUserStartRef.current = awaitingUserStart;

  autoPlayRef.current = autoPlay;
  onEndedRef.current = onEnded;
  userActivatedRef.current = userActivated || userActivatedRef.current;

  const shouldRetryEmbedClick = useCallback(
    () =>
      autoPlayRef.current &&
      userActivatedRef.current &&
      embedKind !== 'direct' &&
      !embedPlayingRef.current,
    [embedKind],
  );

  useEmbedAutoClick(
    containerRef,
    `${embedKind}:${iframeSrc}`,
    autoPlay && !!userActivated,
    shouldRetryEmbedClick,
  );

  const forceEmbedPlay = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || embedKind === 'direct') return;
    postEmbedPlay(iframe, iframeSrc, embedKind);
  }, [embedKind, iframeSrc]);

  useEffect(() => {
    endedRef.current = false;
    embedPlayingRef.current = false;
    if (userActivated) {
      userActivatedRef.current = true;
      setAwaitingUserStart(false);
    } else if (autoPlay && embedKind !== 'direct') {
      setAwaitingUserStart(true);
    }
  }, [iframeSrc, autoPlay, embedKind, userActivated]);

  useEffect(() => {
    if (!autoPlay) {
      if (!userActivated) userActivatedRef.current = false;
      setAwaitingUserStart(false);
    }
  }, [autoPlay, userActivated]);

  useEffect(() => {
    if (!userActivated || !autoPlay || embedKind === 'direct') return;
    userActivatedRef.current = true;
    setAwaitingUserStart(false);
    forceEmbedPlay();
    const timers = [250, 750, 1500].map(ms => window.setTimeout(forceEmbedPlay, ms));
    return () => {
      timers.forEach(window.clearTimeout);
    };
  }, [userActivated, autoPlay, iframeSrc, embedKind, forceEmbedPlay]);

  const requestEmbedPlay = useCallback(() => {
    if (!autoPlayRef.current) return;
    forceEmbedPlay();
  }, [forceEmbedPlay]);

  const scheduleEmbedPlay = useCallback(() => {
    requestEmbedPlay();
    window.setTimeout(requestEmbedPlay, 250);
    window.setTimeout(requestEmbedPlay, 750);
  }, [requestEmbedPlay]);

  const handleUserStart = useCallback(() => {
    userActivatedRef.current = true;
    setAwaitingUserStart(false);
    forceEmbedPlay();
    window.setTimeout(forceEmbedPlay, 250);
    window.setTimeout(forceEmbedPlay, 750);
  }, [forceEmbedPlay]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isYouTubeOrigin(event.origin) && !isVimeoOrigin(event.origin)) return;
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        return;
      }

      if (autoPlayRef.current && isEmbedReadyMessage(event.origin, event.data)) {
        if (userActivatedRef.current) requestEmbedPlay();
      }

      if (isEmbedPlayingMessage(event.origin, event.data)) {
        embedPlayingRef.current = true;
        setAwaitingUserStart(false);
      }

      if (onEndedRef.current && isEmbedEndedMessage(event.origin, event.data)) {
        if (endedRef.current) return;
        endedRef.current = true;
        onEndedRef.current();
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [requestEmbedPlay]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      if (embedKind === 'youtube') notifyYouTubeListening(iframe, iframeSrc);
      if (autoPlayRef.current && userActivatedRef.current) scheduleEmbedPlay();
    };

    iframe.addEventListener('load', onLoad);
    if (embedKind === 'youtube') notifyYouTubeListening(iframe, iframeSrc);
    if (autoPlayRef.current && userActivatedRef.current) scheduleEmbedPlay();

    return () => iframe.removeEventListener('load', onLoad);
  }, [embedKind, iframeSrc, scheduleEmbedPlay]);

  return (
    <div
      ref={containerRef}
      className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-black', className)}
      data-synapse-embed-player
      data-synapse-video-id={videoId}
      data-synapse-awaiting-play={awaitingUserStart ? 'true' : 'false'}
      data-synapse-embed-kind={embedKind}
    >
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        title="Video player"
        className="absolute inset-0 h-full w-full"
        data-synapse-embed-iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
      {awaitingUserStart && (
        <button
          type="button"
          id="m4trix-embed-play-start"
          data-synapse-play-button
          onClick={handleUserStart}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60 text-white transition-colors hover:bg-black/70"
          aria-label="Start playlist playback"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/90 shadow-lg">
            <svg viewBox="0 0 24 24" className="ml-1 h-8 w-8 fill-current" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          <span className="text-sm font-medium">Click to start playlist</span>
          <span className="max-w-xs px-4 text-center text-xs text-white/70">
            Browsers require one click before embed autoplay can run
          </span>
        </button>
      )}
    </div>
  );
}

export default function UniversalVideoPlayer({
  src,
  kind = 'url',
  videoId,
  autoPlay = false,
  userActivated = false,
  className,
  onEnded,
}: UniversalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const onEndedRef = useRef(onEnded);
  const [embedOrigin, setEmbedOrigin] = useState('');

  autoPlayRef.current = autoPlay;
  onEndedRef.current = onEnded;

  useEffect(() => {
    setEmbedOrigin(window.location.origin);
  }, []);

  const playback = useMemo(
    () => resolveVideoJsPlayback(src, kind, autoPlay, embedOrigin || undefined),
    [src, kind, autoPlay, embedOrigin]
  );

  const usesVideoJs = playback?.mode === 'videojs';

  useEffect(() => {
    if (!usesVideoJs || !videoRef.current || playback?.mode !== 'videojs') return;

    let cancelled = false;

    void (async () => {
      const videojs = (await import('@/lib/videojs-setup')).default;
      if (cancelled || !videoRef.current) return;

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.src(playback.source);
        playerRef.current.autoplay(autoPlayRef.current);
        if (autoPlayRef.current && userActivated) void playerRef.current.play()?.catch(() => {});
        return;
      }

      const player = videojs(videoRef.current, {
        controls: true,
        fluid: true,
        responsive: true,
        preload: 'auto',
        autoplay: autoPlayRef.current && userActivated,
        techOrder: ['Html5'],
        sources: [playback.source],
      });

      player.on('ended', () => {
        onEndedRef.current?.();
      });

      playerRef.current = player;
    })();

    return () => {
      cancelled = true;
    };
  }, [usesVideoJs, playback, userActivated]);

  useEffect(() => {
    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, []);

  if (!src || !playback) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-900 text-sm text-muted-foreground',
          className
        )}
      >
        Select a video from the playlist
      </div>
    );
  }

  if (playback.mode === 'iframe') {
    return (
      <EmbedIframePlayer
        iframeSrc={playback.iframeSrc}
        embedKind={playback.embedKind}
        autoPlay={autoPlay}
        userActivated={userActivated}
        videoId={videoId}
        onEnded={onEnded}
        className={className}
      />
    );
  }

  return (
    <div
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-xl bg-black [&_.video-js]:h-full [&_.video-js]:w-full',
        className
      )}
      data-vjs-player
    >
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered vjs-default-skin h-full w-full"
        playsInline
      />
    </div>
  );
}
