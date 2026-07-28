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
    if (payload.event === 'timeupdate' && payload.data && typeof payload.data === 'object') {
      const seconds = (payload.data as { seconds?: number }).seconds;
      if (typeof seconds === 'number' && Number.isFinite(seconds)) return seconds;
    }
  }

  return null;
}

function postYouTubeMessage(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  message: Record<string, unknown>,
) {
  const win = iframe.contentWindow;
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!win || !targetOrigin) return;
  win.postMessage(JSON.stringify(message), targetOrigin);
}

export function notifyYouTubeListening(iframe: HTMLIFrameElement, iframeSrc: string) {
  postYouTubeMessage(iframe, iframeSrc, {
    event: 'listening',
    id: 1,
    channel: 'widget',
  });
}

export function notifyVimeoListening(iframe: HTMLIFrameElement, iframeSrc: string) {
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  const win = iframe.contentWindow;
  if (!targetOrigin || !win) return;

  for (const event of ['finish', 'play', 'pause', 'timeupdate'] as const) {
    win.postMessage(JSON.stringify({ method: 'addEventListener', value: event }), targetOrigin);
  }
}

export function notifyEmbedListening(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  embedKind: VideoEmbedKind,
) {
  if (embedKind === 'youtube') {
    notifyYouTubeListening(iframe, iframeSrc);
  } else if (embedKind === 'vimeo') {
    notifyVimeoListening(iframe, iframeSrc);
  }
}

/** Kick YouTube into sending infoDelivery updates that include currentTime. */
export function activateYouTubeTimeUpdates(iframe: HTMLIFrameElement, iframeSrc: string) {
  notifyYouTubeListening(iframe, iframeSrc);
  postYouTubeMessage(iframe, iframeSrc, {
    event: 'listening',
    func: 'getPlayerState',
    args: [],
    id: 1,
  });
  postYouTubeMessage(iframe, iframeSrc, {
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
  const win = iframe.contentWindow;
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!win || !targetOrigin) return;

  if (embedKind === 'youtube') {
    if (youtubePollPending) youtubePollPending.current = true;
    postYouTubeMessage(iframe, iframeSrc, {
      event: 'listening',
      func: 'getCurrentTime',
      args: [],
      id: 1,
    });
    return;
  }

  if (embedKind === 'vimeo') {
    win.postMessage(JSON.stringify({ method: 'getCurrentTime' }), targetOrigin);
  }
}

export function seekEmbedTime(
  iframe: HTMLIFrameElement,
  iframeSrc: string,
  embedKind: VideoEmbedKind,
  seconds: number,
) {
  const win = iframe.contentWindow;
  const targetOrigin = getEmbedTargetOrigin(iframeSrc);
  if (!win || !targetOrigin) return;

  if (embedKind === 'youtube') {
    postYouTubeMessage(iframe, iframeSrc, {
      event: 'command',
      func: 'seekTo',
      args: [seconds, true],
      id: 1,
    });
    return;
  }

  if (embedKind === 'vimeo') {
    win.postMessage(JSON.stringify({ method: 'setCurrentTime', value: seconds }), targetOrigin);
  }
}
