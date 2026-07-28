import type { MutableRefObject } from 'react';
import {
  getEmbedTargetOrigin,
  isVimeoOrigin,
  isYouTubeOrigin,
  type VideoEmbedKind,
} from '@/lib/video-utils';

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

function readYouTubeInfoTime(info: unknown): number | null {
  if (!info || typeof info !== 'object') return null;
  const record = info as Record<string, unknown>;
  const currentTime = record.currentTime;
  if (typeof currentTime === 'number' && Number.isFinite(currentTime) && currentTime >= 0) {
    return currentTime;
  }
  const mediaReferenceTime = record.mediaReferenceTime;
  if (
    typeof mediaReferenceTime === 'number' &&
    Number.isFinite(mediaReferenceTime) &&
    mediaReferenceTime >= 0
  ) {
    return mediaReferenceTime;
  }
  return null;
}

export function readEmbedCurrentTime(
  origin: string,
  data: unknown,
  youtubePollPending?: MutableRefObject<boolean>,
): number | null {
  const payload = parseMessageData(data);
  if (!payload) return null;

  if (isYouTubeOrigin(origin)) {
    if (payload.event === 'infoDelivery') {
      const info = payload.info;
      const fromObject = readYouTubeInfoTime(info);
      if (fromObject != null) return fromObject;

      if (typeof info === 'number' && Number.isFinite(info) && info >= 0) {
        if (youtubePollPending?.current) {
          youtubePollPending.current = false;
          return info;
        }
      }
    }
  }

  if (isVimeoOrigin(origin)) {
    if (payload.event === 'getCurrentTime') {
      const value = payload.data;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      if (typeof value === 'string') {
        const parsed = parseFloat(value);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    if (payload.event === 'timeupdate') {
      if (typeof payload.data === 'number' && Number.isFinite(payload.data)) {
        return payload.data;
      }
      if (payload.data && typeof payload.data === 'object') {
        const seconds = (payload.data as { seconds?: number }).seconds;
        if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;
      }
    }
  }

  return null;
}

function postYouTubeMessage(
  iframe: HTMLIFrameElement,
  message: Record<string, unknown>,
) {
  const win = iframe.contentWindow;
  if (!win) return;
  win.postMessage(JSON.stringify(message), '*');
}

function postVimeoMessage(iframe: HTMLIFrameElement, message: Record<string, unknown>) {
  const win = iframe.contentWindow;
  if (!win) return;
  const targetOrigin = getEmbedTargetOrigin(iframe.src) ?? '*';
  win.postMessage(JSON.stringify(message), targetOrigin);
  win.postMessage(JSON.stringify(message), '*');
}

export function notifyYouTubeListening(iframe: HTMLIFrameElement) {
  postYouTubeMessage(iframe, {
    event: 'listening',
    id: 1,
    channel: 'widget',
  });
}

export function notifyVimeoListening(iframe: HTMLIFrameElement) {
  for (const event of ['finish', 'play', 'pause', 'timeupdate'] as const) {
    postVimeoMessage(iframe, { method: 'addEventListener', value: event });
  }
}

export function notifyEmbedListening(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  embedKind: VideoEmbedKind,
) {
  if (embedKind === 'youtube') {
    notifyYouTubeListening(iframe);
  } else if (embedKind === 'vimeo') {
    notifyVimeoListening(iframe);
  }
}

/** Fallback when the YouTube IFrame API is unavailable. */
export function activateYouTubeTimeUpdates(iframe: HTMLIFrameElement) {
  notifyYouTubeListening(iframe);
  postYouTubeMessage(iframe, {
    event: 'listening',
    func: 'getPlayerState',
    args: [],
    id: 1,
  });
  postYouTubeMessage(iframe, {
    event: 'listening',
    func: 'getCurrentTime',
    args: [],
    id: 1,
  });
}

export function requestEmbedCurrentTime(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  embedKind: VideoEmbedKind,
  youtubePollPending?: MutableRefObject<boolean>,
) {
  if (embedKind === 'youtube') {
    if (youtubePollPending) youtubePollPending.current = true;
    postYouTubeMessage(iframe, {
      event: 'listening',
      func: 'getCurrentTime',
      args: [],
      id: 1,
    });
    return;
  }

  if (embedKind === 'vimeo') {
    postVimeoMessage(iframe, { method: 'getCurrentTime' });
  }
}

export function pauseEmbedPlayback(
  iframe: HTMLIFrameElement,
  embedKind: VideoEmbedKind,
) {
  if (embedKind === 'youtube') {
    postYouTubeMessage(iframe, {
      event: 'command',
      func: 'pauseVideo',
      args: [],
      id: 1,
    });
    return;
  }

  if (embedKind === 'vimeo') {
    postVimeoMessage(iframe, { method: 'pause' });
  }
}

export function seekEmbedTime(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  embedKind: VideoEmbedKind,
  seconds: number,
) {
  if (embedKind === 'youtube') {
    postYouTubeMessage(iframe, {
      event: 'command',
      func: 'seekTo',
      args: [seconds, true],
      id: 1,
    });
    return;
  }

  if (embedKind === 'vimeo') {
    postVimeoMessage(iframe, { method: 'setCurrentTime', value: seconds });
  }
}
