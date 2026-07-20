import { get, set } from 'idb-keyval';
import type { CheckpointObjective, StageObjectives } from './objectives';
import { normalizeObjectives } from './objectives';

export interface ObjectiveProgress {
  objectiveId: string;
  currentCount: number;
  completed: boolean;
}

export interface StageProgress {
  storyId: string;
  stageNumber: number;
  objectives: ObjectiveProgress[];
  completedAt?: number;
}

export interface GameObjectiveState {
  [gameId: string]: {
    [storyId: string]: {
      [stageNumber: number]: StageProgress;
    };
  };
}

const OBJECTIVE_PROGRESS_KEY = 'objective-progress';

export async function loadObjectiveProgress(
  gameId: string,
  storyId: string,
): Promise<Record<number, StageProgress>> {
  try {
    const stored = await get<GameObjectiveState>(OBJECTIVE_PROGRESS_KEY);
    return stored?.[gameId]?.[storyId] ?? {};
  } catch {
    return {};
  }
}

export async function saveObjectiveProgress(
  gameId: string,
  storyId: string,
  stageProgress: Record<number, StageProgress>,
): Promise<void> {
  try {
    const stored = (await get<GameObjectiveState>(OBJECTIVE_PROGRESS_KEY)) ?? {};
    if (!stored[gameId]) stored[gameId] = {};
    if (!stored[gameId][storyId]) stored[gameId][storyId] = {};
    stored[gameId][storyId] = { ...stored[gameId][storyId], ...stageProgress };
    await set(OBJECTIVE_PROGRESS_KEY, stored);
  } catch (e) {
    console.error('[objectives] Failed to save progress', e);
  }
}

export function checkObjectiveCompletion(
  objective: CheckpointObjective,
  currentCount: number = 1,
): boolean {
  return currentCount >= objective.requiredCount;
}

export function findMatchingObjective(
  objectId: string,
  objectLocationId: string | undefined,
  objectives: CheckpointObjective[],
  interactionType?: string,
): CheckpointObjective | null {
  return objectives.find((obj) => {
    if (obj.completed) return false;
    if (obj.targetObjectId && obj.targetObjectId !== objectId) return false;
    if (obj.targetLocationId && obj.targetLocationId !== objectLocationId) return false;
    if (obj.interactionType && interactionType && obj.interactionType !== interactionType) return false;
    return true;
  }) ?? null;
}

export function markObjectiveComplete(
  objectives: CheckpointObjective[],
  objectiveId: string,
  countIncrement: number = 1,
): { objectives: CheckpointObjective[]; allComplete: boolean } {
  const updated = objectives.map((obj) => {
    if (obj.id !== objectiveId) return obj;
    const newCount = (obj.requiredCount - (obj.requiredCount - 1)) + countIncrement;
    const completed = newCount >= obj.requiredCount;
    return { ...obj, completed };
  });
  const allComplete = updated.every((obj) => obj.completed);
  return { objectives: updated, allComplete };
}

export function getActiveObjectives(
  objectives: CheckpointObjective[],
): CheckpointObjective[] {
  return objectives.filter((obj) => !obj.completed);
}

export function getCompletedObjectives(
  objectives: CheckpointObjective[],
): CheckpointObjective[] {
  return objectives.filter((obj) => obj.completed);
}

export function countIncompleteObjectives(
  objectives: CheckpointObjective[],
): number {
  return objectives.filter((obj) => !obj.completed).length;
}

export async function resetStageObjectives(
  gameId: string,
  storyId: string,
  stageNumber: number,
): Promise<void> {
  try {
    const stored = (await get<GameObjectiveState>(OBJECTIVE_PROGRESS_KEY)) ?? {};
    if (stored[gameId]?.[storyId]?.[stageNumber]) {
      const stageProg = stored[gameId][storyId][stageNumber];
      const resetObjectives = stageProg.objectives.map((obj) => ({
        ...obj,
        currentCount: 0,
        completed: false,
      }));
      stored[gameId][storyId][stageNumber] = {
        ...stageProg,
        objectives: resetObjectives,
        completedAt: undefined,
      };
      await set(OBJECTIVE_PROGRESS_KEY, stored);
    }
  } catch (e) {
    console.error('[objectives] Failed to reset stage objectives', e);
  }
}

export function formatObjectiveMessage(
  objective: CheckpointObjective,
  success: boolean = true,
): string {
  if (success && objective.completionMessage) {
    return objective.completionMessage;
  }
  if (success) {
    return `Completed: ${objective.description}`;
  }
  return objective.description;
}