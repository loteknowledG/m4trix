'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { createPortal } from 'react-dom';
import type Player from 'video.js/dist/types/player';
import { scheduleEmbedAutoClick } from '@/lib/embed-auto-click';
import { resolveVideoJsPlayback } from '@/lib/videojs-source';
import type { PlaylistVideo } from '@/lib/playlists';
import type { VideoTimedCue } from '@/lib/video-timed-cues';
import { getSkipTargetTime, type VideoSkipSegment } from '@/lib/video-skip-segments';
import VideoTimedOverlay from '@/components/video-timed-overlay';
import {
  getEmbedTargetOrigin,
  isVimeoOrigin,
  isYouTubeOrigin,
  type VideoEmbedKind,
} from '@/lib/video-utils';
import { cn } from '@/lib/utils';
import {
  activateYouTubeTimeUpdates,
  notifyEmbedListening,
  notifyVimeoListening,
  readEmbedCurrentTime,
  requestEmbedCurrentTime,
  seekEmbedTime,
} from '@/lib/embed-playback-time';
import 'video.js/dist/video-js.css';

export type UniversalVideoPlayerProps = {
  src: string;
  kind?: PlaylistVideo['kind'];
  videoId?: string;
  autoPlay?: boolean;
  userActivated?: boolean;
  className?: string;
  onEnded?: () => void;
  cues?: VideoTimedCue[];
  editCueId?: string | null;
  onCueLayoutChange?: (
    cueId: string,
    patch: Partial<Pick<VideoTimedCue, 'x' | 'y' | 'width' | 'fontScale'>>,
  ) => void;
  skipSegments?: VideoSkipSegment[];
};

function EmbedFullscreenButton({ containerRef }: { containerRef: MutableRefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const onChange = () => {
      const node = containerRef.current;
      setActive(document.fullscreenElement === node);
    };
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [containerRef]);

  const toggle = useCallback(() => {
    const node = containerRef.current;
    if (!node) return;
    if (document.fullscreenElement === node) {
      void document.exitFullscreen();
      return;
    }
    void node.requestFullscreen();
  }, [containerRef]);

  return (
    <button
      type="button"
      onClick={toggle}
      className="absolute bottom-3 right-3 z-40 inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/65 text-white shadow-md transition-colors hover:bg-black/80"
      aria-label={active ? 'Exit fullscreen' : 'Enter fullscreen'}
      title={active ? 'Exit fullscreen' : 'Enter fullscreen'}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
        {active ? (
          <path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 8h2v3h3v-2h-5v-1zm2-10V5h-3v2h1v3h2V8z" />
        ) : (
          <path d="M7 7h4V5H5v6h2V7zm10 0v4h2V5h-6v2h4zM7 17H5v6h6v-2H7v-4zm10 4v-4h-2v4h-4v2h6v-6z" />
        )}
      </svg>
    </button>
  );
}

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
    if (payload.event === 'onStateChange' && payload.info === 0) {
      return true;
    }
    return false;
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'finish';
  }

  return false;
}

function postEmbedPlay(iframe: HTMLIFrameElement, iframeSrc: string, embedKind: VideoEmbedKind) {
  const win = iframe.contentWindow;
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!win || !targetOrigin) return;

  if (embedKind === 'youtube') {
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'unMute', args: '', id: 1 }),
      targetOrigin,
    );
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: '', id: 1 }),
      targetOrigin,
    );
    activateYouTubeTimeUpdates(iframe, iframeSrc);
    return;
  }

  if (embedKind === 'vimeo') {
    win.postMessage(JSON.stringify({ method: 'play' }), targetOrigin);
  }
}
function usePlaybackTimeWithSkips(
  skipSegments: VideoSkipSegment[],
  seekTo: (seconds: number) => void,
) {
  const skipSegmentsRef = useRef(skipSegments);
  const skipCooldownRef = useRef(0);

  skipSegmentsRef.current = skipSegments;

  return useCallback(
    (time: number) => {
      const now = Date.now();
      if (now < skipCooldownRef.current) {
        const target = getSkipTargetTime(skipSegmentsRef.current, time);
        return target ?? time;
      }

      const target = getSkipTargetTime(skipSegmentsRef.current, time);
      if (target != null) {
        skipCooldownRef.current = now + 300;
        seekTo(target);
        return target;
      }

      return time;
    },
    [seekTo],
  );
}

function readNativeVideoCurrentTime(video: HTMLVideoElement | null | undefined): number | null {
  if (!video) return null;
  const time = video.currentTime;
  return Number.isFinite(time) ? time : null;
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

function EmbedIframePlayer({
  iframeSrc,
  embedKind,
  autoPlay,
  userActivated = false,
  videoId,
  onEnded,
  className,
  cues = [],
  editCueId = null,
  onCueLayoutChange,
  skipSegments = [],
}: {
  iframeSrc: string;
  embedKind: VideoEmbedKind;
  autoPlay: boolean;
  userActivated?: boolean;
  videoId?: string;
  onEnded?: () => void;
  className?: string;
  cues?: VideoTimedCue[];
  editCueId?: string | null;
  onCueLayoutChange?: (
    cueId: string,
    patch: Partial<Pick<VideoTimedCue, 'x' | 'y' | 'width' | 'fontScale'>>,
  ) => void;
  skipSegments?: VideoSkipSegment[];
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null) as MutableRefObject<
    HTMLIFrameElement | null
  >;
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPlayRef = useRef(autoPlay);
  const onEndedRef = useRef(onEnded);
  const userActivatedRef = useRef(userActivated);
  const endedRef = useRef(false);
  const embedPlayingRef = useRef(false);
  const youtubeTimePollPendingRef = useRef(false);
  const [awaitingUserStart, setAwaitingUserStart] = useState(
    autoPlay && !userActivated && embedKind !== 'direct'
  );
  const [currentTime, setCurrentTime] = useState(0);
  const trackPlaybackTime = cues.length > 0 || editCueId != null || skipSegments.length > 0;
  const trackPlaybackTimeRef = useRef(trackPlaybackTime);
  trackPlaybackTimeRef.current = trackPlaybackTime;

  const seekEmbed = useCallback(
    (seconds: number) => {
      const iframe = iframeRef.current;
      if (!iframe || embedKind === 'direct') return;
      seekEmbedTime(iframe, iframeSrc, embedKind, seconds);
    },
    [embedKind, iframeSrc],
  );

  const applyPlaybackTime = usePlaybackTimeWithSkips(skipSegments, seekEmbed);

  const updatePlaybackTime = useCallback(
    (time: number) => {
      setCurrentTime(applyPlaybackTime(time));
    },
    [applyPlaybackTime],
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

  const forceEmbedPlay = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe || embedKind === 'direct') return;
    postEmbedPlay(iframe, iframeSrc, embedKind);
  }, [embedKind, iframeSrc]);

  useEffect(() => {
    endedRef.current = false;
    embedPlayingRef.current = false;
    youtubeTimePollPendingRef.current = false;
    setCurrentTime(0);
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

  // Echo screen clicks: re-arm whenever the video or user-activation changes.
  useEffect(() => {
    if (!autoPlay || !userActivated || embedKind === 'direct') return;

    const cleanup = scheduleEmbedAutoClick(
      () => containerRef.current,
      { shouldRetry: shouldRetryEmbedClick },
    );
    return cleanup;
  }, [iframeSrc, autoPlay, userActivated, embedKind, shouldRetryEmbedClick]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!isYouTubeOrigin(event.origin) && !isVimeoOrigin(event.origin)) return;

      const iframeWindow = iframeRef.current?.contentWindow;
      if (iframeWindow && event.source && event.source !== iframeWindow) return;

      if (autoPlayRef.current && isEmbedReadyMessage(event.origin, event.data)) {
        if (userActivatedRef.current) {
          requestEmbedPlay();
        }
        if (iframeRef.current) {
          if (isYouTubeOrigin(event.origin)) {
            activateYouTubeTimeUpdates(iframeRef.current, iframeSrc);
          } else if (isVimeoOrigin(event.origin)) {
            notifyVimeoListening(iframeRef.current, iframeSrc);
          }
        }
      }

      if (isEmbedPlayingMessage(event.origin, event.data)) {
        embedPlayingRef.current = true;
        setAwaitingUserStart(false);
        if (iframeRef.current && isYouTubeOrigin(event.origin)) {
          activateYouTubeTimeUpdates(iframeRef.current, iframeSrc);
        }
      }

      if (onEndedRef.current && isEmbedEndedMessage(event.origin, event.data)) {
        if (endedRef.current) return;
        endedRef.current = true;
        embedPlayingRef.current = false;
        onEndedRef.current();
      }

      if (trackPlaybackTimeRef.current) {
        const nextTime = readEmbedCurrentTime(
          event.origin,
          event.data,
          youtubeTimePollPendingRef,
        );
        if (nextTime != null) updatePlaybackTime(nextTime);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [requestEmbedPlay, iframeSrc, updatePlaybackTime]);

  useEffect(() => {
    if (!trackPlaybackTime || embedKind === 'direct') return;

    const poll = window.setInterval(() => {
      if (!trackPlaybackTimeRef.current) return;
      const iframe = iframeRef.current;
      if (!iframe) return;
      requestEmbedCurrentTime(iframe, iframeSrc, embedKind, youtubeTimePollPendingRef);
    }, 250);

    return () => window.clearInterval(poll);
  }, [embedKind, iframeSrc, trackPlaybackTime]);

  const iframeLoadCleanupRef = useRef<(() => void) | null>(null);

  const bindIframeRef = useCallback(
    (node: HTMLIFrameElement | null) => {
      iframeLoadCleanupRef.current?.();
      iframeLoadCleanupRef.current = null;
      iframeRef.current = node;
      if (!node) return;

      const onLoad = () => {
        notifyEmbedListening(node, iframeSrc, embedKind);
        if (embedKind === 'youtube') {
          activateYouTubeTimeUpdates(node, iframeSrc);
        }
        if (autoPlayRef.current && userActivatedRef.current) {
          scheduleEmbedPlay();
        }
      };

      node.addEventListener('load', onLoad);
      iframeLoadCleanupRef.current = () => node.removeEventListener('load', onLoad);

      notifyEmbedListening(node, iframeSrc, embedKind);
      if (embedKind === 'youtube') {
        activateYouTubeTimeUpdates(node, iframeSrc);
      }
    },
    [embedKind, iframeSrc, scheduleEmbedPlay],
  );

  useEffect(() => {
    return () => {
      iframeLoadCleanupRef.current?.();
      iframeLoadCleanupRef.current = null;
    };
  }, [iframeSrc]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-xl bg-black [&:fullscreen]:aspect-auto [&:fullscreen]:h-screen [&:fullscreen]:w-screen',
        className,
      )}
      data-synapse-embed-player
      data-synapse-video-id={videoId}
      data-synapse-awaiting-play={awaitingUserStart ? 'true' : 'false'}
      data-synapse-embed-kind={embedKind}
    >
      <iframe
        ref={bindIframeRef}
        src={iframeSrc}
        title="Video player"
        className="absolute inset-0 h-full w-full"
        data-synapse-embed-iframe
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
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
      <VideoTimedOverlay
        cues={cues}
        currentTime={currentTime}
        editCueId={editCueId}
        onCueLayoutChange={onCueLayoutChange}
      />
      <EmbedFullscreenButton containerRef={containerRef} />
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
  cues = [],
  editCueId = null,
  onCueLayoutChange,
  skipSegments = [],
}: UniversalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const onEndedRef = useRef(onEnded);
  const trackPlaybackTimeRef = useRef(false);
  const videoTimeHandlerRef = useRef<(() => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const [embedOrigin] = useState(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
  );

  const trackPlaybackTime =
    cues.length > 0 || editCueId != null || skipSegments.length > 0;

  autoPlayRef.current = autoPlay;
  onEndedRef.current = onEnded;
  trackPlaybackTimeRef.current = trackPlaybackTime;

  const seekNative = useCallback((seconds: number) => {
    const fromPlayer = playerRef.current;
    if (fromPlayer && !fromPlayer.isDisposed()) {
      fromPlayer.currentTime(seconds);
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = seconds;
    }
  }, []);

  const applyPlaybackTime = usePlaybackTimeWithSkips(skipSegments, seekNative);

  const updatePlaybackTime = useCallback(
    (time: number) => {
      setCurrentTime(applyPlaybackTime(time));
    },
    [applyPlaybackTime],
  );

  const playback = useMemo(
    () => resolveVideoJsPlayback(src, kind, autoPlay, embedOrigin || undefined),
    [src, kind, autoPlay, embedOrigin]
  );

  const usesVideoJs = playback?.mode === 'videojs';

  useEffect(() => {
    setCurrentTime(0);
  }, [src, videoId]);

  useEffect(() => {
    if (!usesVideoJs || !videoRef.current || playback?.mode !== 'videojs') return;

    let cancelled = false;

    void (async () => {
      const videojs = (await import('@/lib/videojs-setup')).default;
      if (cancelled || !videoRef.current) return;

      const attachTimeListener = (player: Player) => {
        if (videoTimeHandlerRef.current) {
          player.off('timeupdate', videoTimeHandlerRef.current);
        }
        const handler = () => {
          if (!trackPlaybackTimeRef.current) return;
          const time = player.currentTime();
          if (typeof time === 'number' && Number.isFinite(time)) updatePlaybackTime(time);
        };
        videoTimeHandlerRef.current = handler;
        player.on('timeupdate', handler);
      };

      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.src(playback.source);
        playerRef.current.autoplay(autoPlayRef.current && userActivated);
        playerRef.current.load();
        attachTimeListener(playerRef.current);
        const host = playerRef.current.el() as HTMLElement | undefined;
        if (host) setOverlayHost(host);
        if (autoPlayRef.current && userActivated) {
          void playerRef.current.play()?.catch(() => {});
        }
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
      attachTimeListener(player);

      player.ready(() => {
        if (cancelled) return;
        const host = player.el() as HTMLElement | undefined;
        if (host) {
          host.classList.add('relative');
          setOverlayHost(host);
        }
      });

      playerRef.current = player;
    })();

    return () => {
      cancelled = true;
      setOverlayHost(null);
    };
  }, [usesVideoJs, playback, userActivated, updatePlaybackTime]);

  useEffect(() => {
    if (!usesVideoJs || !trackPlaybackTime) return;

    const poll = window.setInterval(() => {
      if (!trackPlaybackTimeRef.current) return;
      const fromPlayer = playerRef.current;
      if (fromPlayer && !fromPlayer.isDisposed()) {
        const time = fromPlayer.currentTime();
        if (typeof time === 'number' && Number.isFinite(time)) {
          updatePlaybackTime(time);
          return;
        }
      }
      const fromVideo = readNativeVideoCurrentTime(videoRef.current);
      if (fromVideo != null) updatePlaybackTime(fromVideo);
    }, 100);

    return () => window.clearInterval(poll);
  }, [usesVideoJs, trackPlaybackTime, src, videoId, updatePlaybackTime]);

  useEffect(() => {
    if (!usesVideoJs || !trackPlaybackTime) return;
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      if (!trackPlaybackTimeRef.current) return;
      const time = readNativeVideoCurrentTime(video);
      if (time != null) updatePlaybackTime(time);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [usesVideoJs, trackPlaybackTime, src, videoId, updatePlaybackTime]);

  useEffect(() => {
    return () => {
      setOverlayHost(null);
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
        cues={cues}
        editCueId={editCueId}
        onCueLayoutChange={onCueLayoutChange}
        skipSegments={skipSegments}
      />
    );
  }

  const timedOverlay = (
    <VideoTimedOverlay
      cues={cues}
      currentTime={currentTime}
      editCueId={editCueId}
      onCueLayoutChange={onCueLayoutChange}
      className="z-[1]"
    />
  );

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
      {overlayHost ? createPortal(timedOverlay, overlayHost) : timedOverlay}
    </div>
  );
}
