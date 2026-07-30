'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  computeMomentDialogDuration,
  computeMomentDialogLoopDuration,
  dispatchMomentDialogUpdated,
  ensureCharacterPositions,
  ensureTimedDialogScript,
  loadMomentDialogScript,
  momentDialogUpdateMatches,
  MOMENT_DIALOG_UPDATED,
  type MomentDialogUpdatedDetail,
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

  const applyScript = useCallback(
    (
      script: Awaited<ReturnType<typeof ensureTimedDialogScript>>,
      cancelled: () => boolean,
      options?: { restart?: boolean; bumpLoop?: boolean },
    ) => {
      if (cancelled()) return;

      const linesExist = script.lines.length > 0;
      const sceneDuration = computeMomentDialogDuration(script);
      const playbackLoopDuration = computeMomentDialogLoopDuration(script);

      setDuration(sceneDuration);
      setLoopDuration(Math.max(0.5, playbackLoopDuration));

      if (options?.restart) {
        setLoopEpoch(epoch => epoch + 1);
        setCurrentTime(0);
        setPlaying(linesExist);
        setHasLines(linesExist);
        return;
      }

      if (options?.bumpLoop) {
        setLoopEpoch(epoch => epoch + 1);
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
    [],
  );

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
      applyScript(script, cancelled, { restart });
    },
    [applyScript, storyId],
  );

  const syncFromDetail = useCallback(
    (detail: MomentDialogUpdatedDetail, cancelled: () => boolean, restart = false) => {
      const linesExist = detail.script.lines.length > 0;
      if (!linesExist) {
        setHasLines(false);
        setPlaying(false);
      } else {
        setHasLines(true);
        setDuration(computeMomentDialogDuration(detail.script));
        setLoopDuration(Math.max(0.5, computeMomentDialogLoopDuration(detail.script)));
      }

      void loadStorySceneCharacters(storyId).then(characters => {
        if (cancelled()) return;
        const script = ensureTimedDialogScript(
          ensureCharacterPositions(detail.script, characters),
          characters,
        );
        applyScript(script, cancelled, restart ? { restart: true } : { bumpLoop: true });
      });
    },
    [applyScript, storyId],
  );

  const refreshPlayback = useCallback(
    async (restart = false) => {
      if (!momentId) return;
      const characters = await loadStorySceneCharacters(storyId);
      const fallbackOrder = characters.map(character => character.id);
      const loaded = await loadMomentDialogScript(momentId, storyId, fallbackOrder);
      const script = ensureTimedDialogScript(
        ensureCharacterPositions(loaded, characters),
        characters,
      );
      applyScript(script, () => false, { restart });
      dispatchMomentDialogUpdated({ momentId, storyId, script });
    },
    [applyScript, momentId, storyId],
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

    const onDialogUpdated = (event: Event) => {
      const detail = (event as CustomEvent<MomentDialogUpdatedDetail>).detail;
      if (!momentDialogUpdateMatches(detail, momentId, storyId)) return;
      syncFromDetail(detail, isCancelled);
    };

    window.addEventListener('moments-updated', onMomentsUpdated);
    window.addEventListener(MOMENT_DIALOG_UPDATED, onDialogUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('moments-updated', onMomentsUpdated);
      window.removeEventListener(MOMENT_DIALOG_UPDATED, onDialogUpdated);
    };
  }, [momentId, storyId, syncFromDetail, syncFromStorage]);

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
    refreshPlayback,
  };
}
