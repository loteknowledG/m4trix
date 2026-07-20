'use client';

import { useCallback, useState } from 'react';
import type { CheckpointObjective, SceneObject } from '@/lib/game/objectives';
import {
  checkObjectiveCompletion,
  findMatchingObjective,
  formatObjectiveMessage,
  loadObjectiveProgress,
  markObjectiveComplete,
  saveObjectiveProgress,
  type StageProgress,
} from '@/lib/game/objective-manager';

interface UseObjectiveInteractionOptions {
  gameId: string;
  storyId: string;
  initialObjectives?: CheckpointObjective[];
  onObjectiveCompleted?: (objective: CheckpointObjective, allComplete: boolean) => void;
  onStageCompleted?: (stageNumber: number) => void;
}

export function useObjectiveInteraction({
  gameId,
  storyId,
  initialObjectives = [],
  onObjectiveCompleted,
  onStageCompleted,
}: UseObjectiveInteractionOptions) {
  const [activeObjectives, setActiveObjectives] = useState<CheckpointObjective[]>(initialObjectives);
  const [currentStage, setCurrentStage] = useState<number>(1);
  const [stageProgress, setStageProgress] = useState<Record<number, StageProgress>>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const displayToast = useCallback((message: string) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const loadProgress = useCallback(async () => {
    const progress = await loadObjectiveProgress(gameId, storyId);
    setStageProgress(progress);
  }, [gameId, storyId]);

  const interactWithObject = useCallback(
    async (
      objectId: string,
      objectLocationId: string | undefined,
      interactionType?: string,
    ) => {
      const stageObj = stageProgress[currentStage];
      const objectives = stageObj
        ? stageObj.objectives.map((p) => {
            const found = initialObjectives.find((o) => o.id === p.objectiveId);
            return found ? { ...found, completed: p.completed } : null;
          }).filter(Boolean) as CheckpointObjective[]
        : activeObjectives;

      const matching = findMatchingObjective(
        objectId,
        objectLocationId,
        objectives,
        interactionType,
      );

      if (!matching) return null;

      const { objectives: updated, allComplete } = markObjectiveComplete(
        objectives,
        matching.id,
        1,
      );

      setActiveObjectives(updated);

      const message = formatObjectiveMessage(matching, true);
      displayToast(message);

      const newProgress: Record<number, StageProgress> = {
        ...stageProgress,
        [currentStage]: {
          storyId,
          stageNumber: currentStage,
          objectives: updated.map((obj) => ({
            objectiveId: obj.id,
            currentCount: obj.requiredCount,
            completed: obj.completed,
          })),
          completedAt: allComplete ? Date.now() : undefined,
        },
      };
      setStageProgress(newProgress);
      await saveObjectiveProgress(gameId, storyId, newProgress);

      onObjectiveCompleted?.(matching, allComplete);

      if (allComplete) {
        onStageCompleted?.(currentStage);
      }

      return matching;
    },
    [
      activeObjectives,
      currentStage,
      displayToast,
      initialObjectives,
      onObjectiveCompleted,
      onStageCompleted,
      stageProgress,
      storyId,
      gameId,
    ],
  );

  const setObjectivesForStage = useCallback(
    (stageNumber: number, objectives: CheckpointObjective[]) => {
      setCurrentStage(stageNumber);
      setActiveObjectives(objectives);
    },
    [],
  );

  const resetStage = useCallback(
    async (stageNumber: number) => {
      const reset: Record<number, StageProgress> = {
        ...stageProgress,
        [stageNumber]: {
          storyId,
          stageNumber,
          objectives: activeObjectives.map((obj) => ({
            objectiveId: obj.id,
            currentCount: 0,
            completed: false,
          })),
        },
      };
      setStageProgress(reset);
      setActiveObjectives((prev) =>
        prev.map((obj) => ({ ...obj, completed: false })),
      );
      await saveObjectiveProgress(gameId, storyId, reset);
    },
    [activeObjectives, gameId, stageProgress, storyId],
  );

  return {
    activeObjectives,
    currentStage,
    stageProgress,
    toastMessage,
    showToast,
    interactWithObject,
    setObjectivesForStage,
    resetStage,
    loadProgress,
  };
}

export function getObjectInteractionTarget(
  object: SceneObject,
  interactionType?: string,
): string | undefined {
  if (object.type === 'collectible' || object.type === 'key') {
    return 'pickup';
  }
  if (object.type === 'door') {
    return 'reach';
  }
  return interactionType;
}