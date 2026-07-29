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
import VideoPlaybackMarkHud from '@/components/video-playback-mark-hud';
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
  pauseEmbedPlayback,
  readEmbedCurrentTime,
  requestEmbedCurrentTime,
  seekEmbedTime,
} from '@/lib/embed-playback-time';
import {
  attachYouTubePlayer,
  attachVimeoPlayer,
  type YouTubePlayer,
  type VimeoPlayerInstance,
} from '@/lib/embed-player-scripts';
import {
  createManualPlaybackClock,
  type ManualPlaybackClock,
} from '@/lib/manual-playback-clock';
import type { VideoPlaybackControls } from '@/lib/video-playback-controls';
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
  playbackDebugHud?: boolean;
  onPlaybackTimeChange?: (time: number) => void;
  onTimelineFollowChange?: (running: boolean) => void;
  playbackControlsRef?: MutableRefObject<VideoPlaybackControls | null>;
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
      '*',
    );
    win.postMessage(
      JSON.stringify({ event: 'command', func: 'playVideo', args: '', id: 1 }),
      '*',
    );
    activateYouTubeTimeUpdates(iframe);
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
      const state = (info as { playerState?: number }).playerState;
      return state === 1 || state === 3;
    }
    return payload.event === 'onStateChange' && (payload.info === 1 || payload.info === 3);
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'play';
  }

  return false;
}

function isEmbedPausedMessage(origin: string, data: unknown): boolean {
  const payload = parseMessageData(data);
  if (!payload) return false;

  if (isYouTubeOrigin(origin)) {
    const info = payload.info;
    if (info && typeof info === 'object' && 'playerState' in info) {
      return (info as { playerState?: number }).playerState === 2;
    }
    return payload.event === 'onStateChange' && payload.info === 2;
  }

  if (isVimeoOrigin(origin)) {
    return payload.event === 'pause';
  }

  return false;
}

function isGenericEmbedPlaying(data: unknown): boolean {
  if (typeof data === 'string') {
    const lower = data.toLowerCase();
    return lower === 'play' || lower === 'playing' || lower === 'resume' || lower === 'started';
  }
  const payload = parseMessageData(data);
  if (!payload) return false;
  const event = String(
    payload.event ?? payload.method ?? payload.type ?? payload.action ?? payload.name ?? '',
  ).toLowerCase();
  const state = String(payload.state ?? payload.status ?? payload.playback ?? '').toLowerCase();
  if (state === 'playing' || state === 'play') return true;
  return (
    event === 'play' ||
    event === 'playing' ||
    event === 'resume' ||
    event === 'started' ||
    event === 'video-play' ||
    event.includes('playbackstarted')
  );
}

function isGenericEmbedPaused(data: unknown): boolean {
  if (typeof data === 'string') {
    const lower = data.toLowerCase();
    return lower.includes('pause') || lower === 'paused' || lower === 'stopped';
  }
  const payload = parseMessageData(data);
  if (!payload) return false;
  const event = String(
    payload.event ?? payload.method ?? payload.type ?? payload.action ?? payload.name ?? '',
  ).toLowerCase();
  const state = String(payload.state ?? payload.status ?? payload.playback ?? '').toLowerCase();
  if (state === 'paused' || state === 'pause' || state === 'stopped' || state === 'ended') {
    return true;
  }
  return (
    event.includes('pause') ||
    event === 'paused' ||
    event === 'stopped' ||
    event === 'ended' ||
    event === 'video-pause' ||
    event.includes('playbackpaused')
  );
}

function readGenericEmbedTime(data: unknown): number | null {
  const payload = parseMessageData(data);
  if (!payload) return null;

  const candidates: unknown[] = [
    payload.currentTime,
    payload.time,
    payload.position,
    payload.seconds,
  ];
  if (payload.data && typeof payload.data === 'object') {
    const nested = payload.data as Record<string, unknown>;
    candidates.push(nested.currentTime, nested.time, nested.position, nested.seconds);
  }

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }
  }

  return null;
}

function usePlaybackTimeReporter(onPlaybackTimeChange?: (time: number) => void) {
  const callbackRef = useRef(onPlaybackTimeChange);
  callbackRef.current = onPlaybackTimeChange;
  const lastReportedRef = useRef(-1);

  return useCallback((time: number) => {
    if (!callbackRef.current) return;
    const last = lastReportedRef.current;
    const rewound = last >= 0 && time < last - 0.01;
    const jumped = last >= 0 && Math.abs(time - last) >= 0.25;
    if (last >= 0 && !rewound && !jumped && Math.abs(time - last) < 0.05) {
      return;
    }
    lastReportedRef.current = time;
    callbackRef.current(time);
  }, []);
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
  playbackDebugHud = false,
  onPlaybackTimeChange,
  onTimelineFollowChange,
  playbackControlsRef,
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
  playbackDebugHud?: boolean;
  onPlaybackTimeChange?: (time: number) => void;
  onTimelineFollowChange?: (running: boolean) => void;
  playbackControlsRef?: MutableRefObject<VideoPlaybackControls | null>;
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
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const youtubePollRef = useRef<number | undefined>(undefined);
  const youtubeSetupTokenRef = useRef(0);
  const vimeoPlayerRef = useRef<VimeoPlayerInstance | null>(null);
  const vimeoSetupTokenRef = useRef(0);
  const manualClockRef = useRef<ManualPlaybackClock | null>(null);
  const timelineFollowRef = useRef(false);
  const autoSyncTimelineRef = useRef(true);
  const lastEmbedTimeTickRef = useRef(0);
  const lastEmbedTimeValueRef = useRef(-1);
  const lastEmbedSignalRef = useRef(0);
  const onTimelineFollowChangeRef = useRef(onTimelineFollowChange);
  onTimelineFollowChangeRef.current = onTimelineFollowChange;
  const [manualClockRunning, setManualClockRunning] = useState(false);
  const [embedPlaying, setEmbedPlaying] = useState(false);
  const [awaitingUserStart, setAwaitingUserStart] = useState(
    autoPlay && !userActivated && embedKind !== 'direct'
  );
  const [currentTime, setCurrentTime] = useState(0);
  const trackPlaybackTime =
    cues.length > 0 ||
    editCueId != null ||
    skipSegments.length > 0 ||
    Boolean(onPlaybackTimeChange);
  const showPlaybackHud =
    playbackDebugHud && (cues.length > 0 || skipSegments.length > 0);
  const trackPlaybackTimeRef = useRef(trackPlaybackTime);
  trackPlaybackTimeRef.current = trackPlaybackTime;
  const reportPlaybackTime = usePlaybackTimeReporter(onPlaybackTimeChange);
  const updatePlaybackTimeRef = useRef<(time: number) => void>(() => {});

  const seekEmbed = useCallback(
    (seconds: number) => {
      if (embedKind === 'direct') {
        manualClockRef.current?.seek(seconds);
        return;
      }
      if (embedKind === 'vimeo' && vimeoPlayerRef.current) {
        void vimeoPlayerRef.current.setCurrentTime(seconds).then(time => {
          updatePlaybackTimeRef.current(time);
        });
        return;
      }
      if (embedKind === 'youtube' && youtubePlayerRef.current) {
        try {
          youtubePlayerRef.current.seekTo(seconds, true);
          updatePlaybackTimeRef.current(youtubePlayerRef.current.getCurrentTime());
          return;
        } catch {
          /* fall through to postMessage seek */
        }
      }
      const iframe = iframeRef.current;
      if (!iframe) return;
      seekEmbedTime(iframe, iframeSrc, embedKind, seconds);
      window.setTimeout(() => {
        requestEmbedCurrentTime(iframe, iframeSrc, embedKind, youtubeTimePollPendingRef);
      }, 50);
    },
    [embedKind, iframeSrc],
  );

  const applyPlaybackTime = usePlaybackTimeWithSkips(skipSegments, seekEmbed);

  const updatePlaybackTime = useCallback(
    (time: number) => {
      const next = applyPlaybackTime(time);
      setCurrentTime(next);
      reportPlaybackTime(next);
    },
    [applyPlaybackTime, reportPlaybackTime],
  );
  updatePlaybackTimeRef.current = updatePlaybackTime;

  const syncEmbedPlaybackState = useCallback(
    (playing: boolean) => {
      embedPlayingRef.current = playing;
      setEmbedPlaying(playing);
      if (embedKind !== 'direct') return;

      if (playing) {
        if (!autoSyncTimelineRef.current) return;
        manualClockRef.current?.start();
        setManualClockRunning(true);
        timelineFollowRef.current = true;
        onTimelineFollowChangeRef.current?.(true);
        return;
      }

      if (!manualClockRef.current?.isRunning()) return;
      manualClockRef.current.pause();
      setManualClockRunning(false);
      onTimelineFollowChangeRef.current?.(false);
    },
    [embedKind],
  );

  const noteDirectEmbedTime = useCallback(
    (seconds: number) => {
      if (embedKind !== 'direct') return;
      const now = Date.now();
      const advancing =
        lastEmbedTimeValueRef.current < 0 ||
        seconds > lastEmbedTimeValueRef.current + 0.02;
      lastEmbedTimeValueRef.current = seconds;
      lastEmbedTimeTickRef.current = now;
      if (advancing && autoSyncTimelineRef.current) {
        syncEmbedPlaybackState(true);
      }
    },
    [embedKind, syncEmbedPlaybackState],
  );

  const startManualTimeline = useCallback(() => {
    if (embedKind !== 'direct') return;
    manualClockRef.current?.start();
    setManualClockRunning(true);
    onTimelineFollowChangeRef.current?.(true);
  }, [embedKind]);

  const stopManualTimeline = useCallback(() => {
    manualClockRef.current?.pause();
    setManualClockRunning(false);
    onTimelineFollowChangeRef.current?.(false);
  }, []);

  const setTimelineFollow = useCallback(
    (enabled: boolean) => {
      autoSyncTimelineRef.current = enabled;
      timelineFollowRef.current = enabled;
      if (embedKind !== 'direct') return;
      if (enabled) {
        startManualTimeline();
      } else {
        stopManualTimeline();
      }
    },
    [embedKind, startManualTimeline, stopManualTimeline],
  );

  const isTimelineFollowEnabled = useCallback(
    () => embedKind === 'direct' && autoSyncTimelineRef.current,
    [embedKind],
  );

  const isTimelineFollowRunning = useCallback(
    () => embedKind === 'direct' && Boolean(manualClockRef.current?.isRunning()),
    [embedKind],
  );

  const pauseEmbed = useCallback(() => {
    if (embedKind === 'direct') {
      stopManualTimeline();
      return;
    }
    if (embedKind === 'vimeo' && vimeoPlayerRef.current) {
      void vimeoPlayerRef.current
        .pause()
        .then(() => vimeoPlayerRef.current?.getCurrentTime())
        .then(time => {
          if (typeof time === 'number') updatePlaybackTimeRef.current(time);
        })
        .catch(() => {
          const iframe = iframeRef.current;
          if (iframe) pauseEmbedPlayback(iframe, embedKind);
        });
      syncEmbedPlaybackState(false);
      return;
    }
    if (embedKind === 'youtube' && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.pauseVideo();
        updatePlaybackTimeRef.current(youtubePlayerRef.current.getCurrentTime());
        syncEmbedPlaybackState(false);
        return;
      } catch {
        /* fall through */
      }
    }
    const iframe = iframeRef.current;
    if (!iframe) return;
    pauseEmbedPlayback(iframe, embedKind);
    syncEmbedPlaybackState(false);
  }, [embedKind, stopManualTimeline, syncEmbedPlaybackState]);

  useEffect(() => {
    if (!playbackControlsRef) return;
    playbackControlsRef.current = {
      seek: (seconds: number) => {
        seekEmbed(seconds);
      },
      pause: () => {
        pauseEmbed();
      },
      setTimelineFollow,
      isTimelineFollowEnabled,
      isTimelineFollowRunning,
    };
    return () => {
      playbackControlsRef.current = null;
    };
  }, [
    isTimelineFollowEnabled,
    isTimelineFollowRunning,
    pauseEmbed,
    playbackControlsRef,
    seekEmbed,
    setTimelineFollow,
  ]);

  const stopYouTubePolling = useCallback(() => {
    if (youtubePollRef.current != null) {
      window.clearInterval(youtubePollRef.current);
      youtubePollRef.current = undefined;
    }
  }, []);

  const destroyYouTubePlayer = useCallback(() => {
    stopYouTubePolling();
    try {
      youtubePlayerRef.current?.destroy();
    } catch {
      /* player may already be disposed */
    }
    youtubePlayerRef.current = null;
  }, [stopYouTubePolling]);

  const destroyVimeoPlayer = useCallback(() => {
    try {
      vimeoPlayerRef.current?.destroy();
    } catch {
      /* player may already be disposed */
    }
    vimeoPlayerRef.current = null;
  }, []);

  const destroyEmbedApiPlayers = useCallback(() => {
    destroyYouTubePlayer();
    destroyVimeoPlayer();
  }, [destroyYouTubePlayer, destroyVimeoPlayer]);

  const startYouTubePolling = useCallback(
    (player: YouTubePlayer) => {
      stopYouTubePolling();
      youtubePollRef.current = window.setInterval(() => {
        if (!trackPlaybackTimeRef.current) return;
        try {
          const state = player.getPlayerState();
          if (state !== 1 && state !== 3) return;
          const time = player.getCurrentTime();
          if (typeof time === 'number' && Number.isFinite(time)) {
            updatePlaybackTime(time);
          }
        } catch {
          /* ignore disposed player */
        }
      }, 200);
    },
    [stopYouTubePolling, updatePlaybackTime],
  );

  const setupYouTubePlayer = useCallback(
    (iframe: HTMLIFrameElement) => {
      destroyYouTubePlayer();
      const token = youtubeSetupTokenRef.current + 1;
      youtubeSetupTokenRef.current = token;

      void attachYouTubePlayer(iframe, {
        onReady: player => {
          if (youtubeSetupTokenRef.current !== token) return;
          youtubePlayerRef.current = player;
          try {
            const state = player.getPlayerState();
            if (state === 1 || state === 3) {
              startYouTubePolling(player);
            }
          } catch {
            /* ignore */
          }
          if (autoPlayRef.current && userActivatedRef.current) {
            try {
              player.playVideo();
            } catch {
              postEmbedPlay(iframe, iframeSrc, 'youtube');
            }
          }
        },
        onStateChange: state => {
          if (youtubeSetupTokenRef.current !== token) return;
          const activePlayer = youtubePlayerRef.current;
          const playing = state === 1 || state === 3;
          syncEmbedPlaybackState(playing);
          if (activePlayer) {
            if (playing) {
              startYouTubePolling(activePlayer);
            } else {
              stopYouTubePolling();
              try {
                updatePlaybackTime(activePlayer.getCurrentTime());
              } catch {
                /* ignore disposed player */
              }
            }
          }
          if (state === 0) {
            if (endedRef.current) return;
            endedRef.current = true;
            syncEmbedPlaybackState(false);
            onEndedRef.current?.();
          }
        },
      }).catch(() => {
        if (youtubeSetupTokenRef.current !== token) return;
        notifyEmbedListening(iframe, iframeSrc, 'youtube');
        activateYouTubeTimeUpdates(iframe);
      });
    },
    [destroyYouTubePlayer, iframeSrc, startYouTubePolling, stopYouTubePolling, syncEmbedPlaybackState, updatePlaybackTime],
  );

  const setupVimeoPlayer = useCallback(
    (iframe: HTMLIFrameElement) => {
      destroyVimeoPlayer();
      const token = vimeoSetupTokenRef.current + 1;
      vimeoSetupTokenRef.current = token;

      void attachVimeoPlayer(iframe, {
        onReady: player => {
          if (vimeoSetupTokenRef.current !== token) return;
          vimeoPlayerRef.current = player;
          if (autoPlayRef.current && userActivatedRef.current) {
            void player.play().catch(() => {
              postEmbedPlay(iframe, iframeSrc, 'vimeo');
            });
          }
        },
        onTimeUpdate: seconds => {
          if (vimeoSetupTokenRef.current !== token) return;
          updatePlaybackTime(seconds);
        },
        onPlay: () => {
          if (vimeoSetupTokenRef.current !== token) return;
          syncEmbedPlaybackState(true);
          setAwaitingUserStart(false);
        },
        onPause: () => {
          if (vimeoSetupTokenRef.current !== token) return;
          syncEmbedPlaybackState(false);
          const activePlayer = vimeoPlayerRef.current;
          if (activePlayer) {
            void activePlayer.getCurrentTime().then(time => {
              updatePlaybackTime(time);
            });
          }
        },
        onEnded: () => {
          if (vimeoSetupTokenRef.current !== token) return;
          if (endedRef.current) return;
          endedRef.current = true;
          syncEmbedPlaybackState(false);
          onEndedRef.current?.();
        },
      }).catch(() => {
        if (vimeoSetupTokenRef.current !== token) return;
        notifyEmbedListening(iframe, iframeSrc, 'vimeo');
      });
    },
    [destroyVimeoPlayer, iframeSrc, syncEmbedPlaybackState, updatePlaybackTime],
  );

  useEffect(() => {
    if (embedKind !== 'direct' || !trackPlaybackTime) {
      manualClockRef.current?.dispose();
      manualClockRef.current = null;
      setManualClockRunning(false);
      return;
    }

    const clock = createManualPlaybackClock(time => updatePlaybackTimeRef.current(time));
    manualClockRef.current = clock;
    return () => {
      clock.dispose();
      if (manualClockRef.current === clock) {
        manualClockRef.current = null;
      }
      setManualClockRunning(false);
    };
  }, [embedKind, trackPlaybackTime, iframeSrc]);

  useEffect(() => {
    autoSyncTimelineRef.current = true;
    timelineFollowRef.current = false;
    lastEmbedTimeTickRef.current = 0;
    lastEmbedTimeValueRef.current = -1;
    lastEmbedSignalRef.current = 0;
    stopManualTimeline();
  }, [iframeSrc, embedKind, stopManualTimeline]);

  useEffect(() => {
    if (embedKind !== 'direct' || !trackPlaybackTime) return;

    const isEmbedFocused = () => document.activeElement === iframeRef.current;

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (isEmbedFocused() || !autoSyncTimelineRef.current) return;
        syncEmbedPlaybackState(false);
      }, 0);
    };

    const onWindowBlur = () => {
      window.setTimeout(() => {
        if (!isEmbedFocused() || !autoSyncTimelineRef.current) return;
        if (Date.now() - lastEmbedSignalRef.current < 300) return;
        syncEmbedPlaybackState(!manualClockRef.current?.isRunning());
      }, 0);
    };

    document.addEventListener('focusout', onFocusOut);
    window.addEventListener('blur', onWindowBlur);

    return () => {
      document.removeEventListener('focusout', onFocusOut);
      window.removeEventListener('blur', onWindowBlur);
    };
  }, [embedKind, syncEmbedPlaybackState, trackPlaybackTime, iframeSrc]);

  useEffect(() => {
    if (embedKind !== 'direct' || !trackPlaybackTime) return;

    const watchPlaybackStall = window.setInterval(() => {
      if (!manualClockRef.current?.isRunning()) return;
      if (!autoSyncTimelineRef.current) return;
      if (lastEmbedTimeTickRef.current <= 0) return;
      if (Date.now() - lastEmbedTimeTickRef.current < 900) return;
      syncEmbedPlaybackState(false);
    }, 400);

    return () => window.clearInterval(watchPlaybackStall);
  }, [embedKind, syncEmbedPlaybackState, trackPlaybackTime, iframeSrc]);

  const handleManualClockStart = useCallback(() => {
    setTimelineFollow(true);
  }, [setTimelineFollow]);

  const ensureManualClockStarted = useCallback(() => {
    if (embedKind !== 'direct') return;
    setTimelineFollow(true);
  }, [embedKind, setTimelineFollow]);

  const handleManualClockPause = useCallback(() => {
    setTimelineFollow(false);
  }, [setTimelineFollow]);

  const handleManualClockReset = useCallback(() => {
    manualClockRef.current?.reset();
    timelineFollowRef.current = false;
    setManualClockRunning(false);
    onTimelineFollowChangeRef.current?.(false);
  }, []);

  const handleManualClockNudge = useCallback((delta: number) => {
    manualClockRef.current?.nudge(delta);
  }, []);

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
    if (embedKind === 'vimeo' && vimeoPlayerRef.current) {
      void vimeoPlayerRef.current.play().catch(() => {
        postEmbedPlay(iframe, iframeSrc, embedKind);
      });
      return;
    }
    if (embedKind === 'youtube' && youtubePlayerRef.current) {
      try {
        youtubePlayerRef.current.playVideo();
        return;
      } catch {
        /* fall through */
      }
    }
    postEmbedPlay(iframe, iframeSrc, embedKind);
  }, [embedKind, iframeSrc]);

  useEffect(() => {
    endedRef.current = false;
    embedPlayingRef.current = false;
    setEmbedPlaying(false);
    youtubeTimePollPendingRef.current = false;
    destroyEmbedApiPlayers();
    manualClockRef.current?.reset();
    setManualClockRunning(false);
    setCurrentTime(0);
    if (userActivated) {
      userActivatedRef.current = true;
      setAwaitingUserStart(false);
    } else if (autoPlay && embedKind !== 'direct') {
      setAwaitingUserStart(true);
    }
  }, [iframeSrc, autoPlay, embedKind, userActivated, destroyEmbedApiPlayers]);

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
    ensureManualClockStarted();
    forceEmbedPlay();
    window.setTimeout(forceEmbedPlay, 250);
    window.setTimeout(forceEmbedPlay, 750);
  }, [ensureManualClockStarted, forceEmbedPlay]);

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
      if (embedKind === 'direct' && trackPlaybackTimeRef.current) {
        if (isGenericEmbedPaused(event.data)) {
          lastEmbedSignalRef.current = Date.now();
          syncEmbedPlaybackState(false);
        } else if (isGenericEmbedPlaying(event.data)) {
          lastEmbedSignalRef.current = Date.now();
          syncEmbedPlaybackState(true);
          setAwaitingUserStart(false);
        }
        const genericTime = readGenericEmbedTime(event.data);
        if (genericTime != null) {
          noteDirectEmbedTime(genericTime);
          updatePlaybackTime(genericTime);
        }
      }

      if (!isYouTubeOrigin(event.origin) && !isVimeoOrigin(event.origin)) return;
      if (embedKind === 'youtube' && youtubePlayerRef.current) return;
      if (embedKind === 'vimeo' && vimeoPlayerRef.current) return;

      if (autoPlayRef.current && isEmbedReadyMessage(event.origin, event.data)) {
        if (userActivatedRef.current) {
          requestEmbedPlay();
        }
        if (iframeRef.current && isVimeoOrigin(event.origin)) {
          notifyVimeoListening(iframeRef.current);
        }
      }

      if (isEmbedPlayingMessage(event.origin, event.data)) {
        syncEmbedPlaybackState(true);
        setAwaitingUserStart(false);
      }

      if (isEmbedPausedMessage(event.origin, event.data)) {
        syncEmbedPlaybackState(false);
      }

      if (onEndedRef.current && isEmbedEndedMessage(event.origin, event.data)) {
        if (endedRef.current) return;
        endedRef.current = true;
        syncEmbedPlaybackState(false);
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
  }, [embedKind, noteDirectEmbedTime, requestEmbedPlay, syncEmbedPlaybackState, updatePlaybackTime]);

  useEffect(() => {
    if (!trackPlaybackTime || embedKind === 'direct') return;
    if (embedKind === 'youtube' || embedKind === 'vimeo') return;

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
        if (embedKind === 'youtube') {
          setupYouTubePlayer(node);
        } else if (embedKind === 'vimeo') {
          setupVimeoPlayer(node);
        } else {
          notifyEmbedListening(node, iframeSrc, embedKind);
        }
        if (autoPlayRef.current && userActivatedRef.current) {
          scheduleEmbedPlay();
        }
      };

      node.addEventListener('load', onLoad);
      iframeLoadCleanupRef.current = () => node.removeEventListener('load', onLoad);
    },
    [embedKind, iframeSrc, scheduleEmbedPlay, setupVimeoPlayer, setupYouTubePlayer],
  );

  useEffect(() => {
    return () => {
      destroyEmbedApiPlayers();
    };
  }, [destroyEmbedApiPlayers]);

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
      {showPlaybackHud ? (
        <VideoPlaybackMarkHud
          currentTime={currentTime}
          cues={cues}
          skipSegments={skipSegments}
          embedKind={embedKind}
          isPlaying={embedKind === 'direct' ? manualClockRunning : embedPlaying}
          manualClockRunning={manualClockRunning}
          onManualClockStart={handleManualClockStart}
          onManualClockPause={handleManualClockPause}
          onManualClockReset={handleManualClockReset}
          onManualClockNudge={handleManualClockNudge}
        />
      ) : null}
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
  playbackDebugHud = false,
  onPlaybackTimeChange,
  onTimelineFollowChange,
  playbackControlsRef,
}: UniversalVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<Player | null>(null);
  const autoPlayRef = useRef(autoPlay);
  const onEndedRef = useRef(onEnded);
  const trackPlaybackTimeRef = useRef(false);
  const videoTimeHandlerRef = useRef<(() => void) | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [nativePlaying, setNativePlaying] = useState(false);
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  const [embedOrigin] = useState(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
  );

  const playback = useMemo(
    () => resolveVideoJsPlayback(src, kind, autoPlay, embedOrigin || undefined),
    [src, kind, autoPlay, embedOrigin],
  );

  const usesVideoJs = playback?.mode === 'videojs';

  const trackPlaybackTime =
    cues.length > 0 ||
    editCueId != null ||
    skipSegments.length > 0 ||
    Boolean(onPlaybackTimeChange);
  const showPlaybackHud =
    playbackDebugHud && (cues.length > 0 || skipSegments.length > 0);

  autoPlayRef.current = autoPlay;
  onEndedRef.current = onEnded;
  trackPlaybackTimeRef.current = trackPlaybackTime;
  const reportPlaybackTime = usePlaybackTimeReporter(onPlaybackTimeChange);
  const updatePlaybackTimeRef = useRef<(time: number) => void>(() => {});

  const seekNative = useCallback((seconds: number) => {
    const fromPlayer = playerRef.current;
    if (fromPlayer && !fromPlayer.isDisposed()) {
      fromPlayer.currentTime(seconds);
      const time = fromPlayer.currentTime();
      if (typeof time === 'number' && Number.isFinite(time)) {
        updatePlaybackTimeRef.current(time);
      }
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.currentTime = seconds;
      updatePlaybackTimeRef.current(video.currentTime);
    }
  }, []);

  const pauseNative = useCallback(() => {
    const fromPlayer = playerRef.current;
    if (fromPlayer && !fromPlayer.isDisposed()) {
      fromPlayer.pause();
      setNativePlaying(false);
      return;
    }
    const video = videoRef.current;
    if (video) {
      video.pause();
      setNativePlaying(false);
    }
  }, []);

  const applyPlaybackTime = usePlaybackTimeWithSkips(skipSegments, seekNative);

  const updatePlaybackTime = useCallback(
    (time: number) => {
      const next = applyPlaybackTime(time);
      setCurrentTime(next);
      reportPlaybackTime(next);
    },
    [applyPlaybackTime, reportPlaybackTime],
  );
  updatePlaybackTimeRef.current = updatePlaybackTime;

  useEffect(() => {
    if (!playbackControlsRef || playback?.mode === 'iframe') return;
    playbackControlsRef.current = {
      seek: (seconds: number) => {
        seekNative(seconds);
      },
      pause: () => {
        pauseNative();
      },
      setTimelineFollow: () => {},
      isTimelineFollowEnabled: () => false,
      isTimelineFollowRunning: () => false,
    };
    return () => {
      playbackControlsRef.current = null;
    };
  }, [pauseNative, playback?.mode, playbackControlsRef, seekNative]);

  useEffect(() => {
    setCurrentTime(0);
    setNativePlaying(false);
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
        const reportSeekTime = () => {
          if (!trackPlaybackTimeRef.current) return;
          const time = player.currentTime();
          if (typeof time === 'number' && Number.isFinite(time)) updatePlaybackTime(time);
        };
        videoTimeHandlerRef.current = handler;
        player.on('timeupdate', handler);
        player.on('seeked', reportSeekTime);
        player.on('seeking', reportSeekTime);
        player.on('pause', reportSeekTime);
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
        setNativePlaying(false);
      });
      player.on('play', () => setNativePlaying(true));
      player.on('pause', () => setNativePlaying(false));
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
    const onSeeked = () => {
      if (!trackPlaybackTimeRef.current) return;
      const time = readNativeVideoCurrentTime(video);
      if (time != null) updatePlaybackTime(time);
    };
    const onPause = () => {
      if (!trackPlaybackTimeRef.current) return;
      const time = readNativeVideoCurrentTime(video);
      if (time != null) updatePlaybackTime(time);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('seeked', onSeeked);
    video.addEventListener('seeking', onSeeked);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('seeking', onSeeked);
      video.removeEventListener('pause', onPause);
    };
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
        playbackDebugHud={playbackDebugHud}
        onPlaybackTimeChange={onPlaybackTimeChange}
        onTimelineFollowChange={onTimelineFollowChange}
        playbackControlsRef={playbackControlsRef}
      />
    );
  }

  const timedOverlay = (
    <>
      <VideoTimedOverlay
        cues={cues}
        currentTime={currentTime}
        editCueId={editCueId}
        onCueLayoutChange={onCueLayoutChange}
        className="z-[1]"
      />
      {showPlaybackHud ? (
        <VideoPlaybackMarkHud
          currentTime={currentTime}
          cues={cues}
          skipSegments={skipSegments}
          embedKind="native"
          isPlaying={nativePlaying}
          className="z-[2]"
        />
      ) : null}
    </>
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
