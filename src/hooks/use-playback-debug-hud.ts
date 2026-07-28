'use client';

import { useCallback, useState } from 'react';

export const PLAYBACK_DEBUG_HUD_STORAGE_KEY = 'm4trix:playback-debug-hud';

function readPlaybackDebugHudEnabled() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PLAYBACK_DEBUG_HUD_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function usePlaybackDebugHud() {
  const [enabled, setEnabled] = useState(readPlaybackDebugHudEnabled);

  const setPlaybackDebugHudEnabled = useCallback((value: boolean) => {
    setEnabled(value);
    try {
      window.localStorage.setItem(PLAYBACK_DEBUG_HUD_STORAGE_KEY, String(value));
    } catch {
      /* ignore storage failures */
    }
  }, []);

  return [enabled, setPlaybackDebugHudEnabled] as const;
}
