'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  computeMomentDialogDuration,
  computeMomentDialogLoopDuration,
  ensureCharacterPositions,
  ensureTimedDialogScript,
  loadMomentDialogScript,
} from '@/lib/moment-dialog';
import { loadStorySceneCharacters } from '@/lib/scene-characters';

export function useMomentDialogPlayback(
  momentId: string | null,
  storyId?: string | null,
) {
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(30);
  const [loopDuration, setLoopDuration] = useState(30);
  const [hasLines, setHasLines] = useState(false);
  const [loopEpoch, setLoopEpoch] = useState(0);

  const syncFromStorage = useCallback(
    async (activeMomentId: string, cancelled: () => boolean, restart = false) => {
      const characters = await loadStorySceneCharacters(storyId);
      if (cancelled()) return;

      const fallbackOrder = characters.map(character => character.id);
      const loaded = await loadMomentDialogScript(activeMomentId, storyId, fallbackOrder);
      if (cancelled()) return;

      const script = ensureTimedDialogScript(
        ensureCharacterPositions(loaded, characters),
        characters,
      );
      const linesExist = script.lines.length > 0;
      const sceneDuration = computeMomentDialogDuration(script);
      const playbackLoopDuration = computeMomentDialogLoopDuration(script);

      setDuration(sceneDuration);
      setLoopDuration(Math.max(0.5, playbackLoopDuration));

      if (restart) {
        setLoopEpoch(epoch => epoch + 1);
        setCurrentTime(0);
        setPlaying(linesExist);
        setHasLines(linesExist);
        return;
      }

      setHasLines(previousHasLines => {
        if (linesExist && !previousHasLines) {
          setLoopEpoch(epoch => epoch + 1);
          setCurrentTime(0);
          setPlaying(true);
        } else if (!linesExist) {
          setPlaying(false);
        }
        return linesExist;
      });
    },
    [storyId],
  );

  useEffect(() => {
    if (!momentId) {
      setPlaying(false);
      setCurrentTime(0);
      setHasLines(false);
      return;
    }

    let cancelled = false;
    const isCancelled = () => cancelled;

    void syncFromStorage(momentId, isCancelled, true).catch(() => {
      if (!cancelled) {
        setHasLines(false);
        setPlaying(false);
        setCurrentTime(0);
      }
    });

    const onMomentsUpdated = () => {
      void syncFromStorage(momentId, isCancelled, false).catch(() => {
        /* ignore refresh errors */
      });
    };

    window.addEventListener('moments-updated', onMomentsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('moments-updated', onMomentsUpdated);
    };
  }, [momentId, storyId, syncFromStorage]);

  useEffect(() => {
    if (!playing || !hasLines) return;

    const id = window.setInterval(() => {
      setCurrentTime(previous => {
        const next = previous + 0.1;
        if (next >= loopDuration) {
          setLoopEpoch(epoch => epoch + 1);
          return 0;
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(id);
  }, [hasLines, loopDuration, playing]);

  return {
    currentTime,
    playing,
    setPlaying,
    setCurrentTime,
    hasLines,
    duration,
    loopEpoch,
  };
}
