import type { StoryArc, StoryArcStage } from '@/lib/game/story-arc';
import { getNextStoryArcStage, getStageTodos, isStageComplete } from '@/lib/game/story-arc';

export type StoryArcTodoProgress = {
  completedTodoIdsByStage: Record<string, string[]>;
};

export type ParsedNarratorMarkers = {
  text: string;
  completedTodoIds: string[];
  stageComplete: boolean;
};

const DONE_MARKER = /^\[DONE:\s*([^\]\s]+)\s*\]\s*$/i;
const STAGE_COMPLETE_MARKER = '[STAGE_COMPLETE]';

export function emptyStoryArcTodoProgress(): StoryArcTodoProgress {
  return { completedTodoIdsByStage: {} };
}

export function getCompletedTodoIds(
  progress: StoryArcTodoProgress | null | undefined,
  stageNumber: number,
): string[] {
  const key = String(stageNumber);
  const ids = progress?.completedTodoIdsByStage?.[key];
  return Array.isArray(ids) ? [...ids] : [];
}

export function mergeCompletedTodos(
  progress: StoryArcTodoProgress | null | undefined,
  stageNumber: number,
  newlyCompleted: string[],
): StoryArcTodoProgress {
  const base = progress ?? emptyStoryArcTodoProgress();
  const key = String(stageNumber);
  const existing = new Set(getCompletedTodoIds(base, stageNumber));
  for (const id of newlyCompleted) {
    if (id.trim()) existing.add(id.trim());
  }
  return {
    completedTodoIdsByStage: {
      ...base.completedTodoIdsByStage,
      [key]: [...existing],
    },
  };
}

export function parseNarratorTodoMarkers(raw: string): ParsedNarratorMarkers {
  const completedTodoIds: string[] = [];
  let stageComplete = false;

  const text = raw
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (trimmed.toUpperCase() === STAGE_COMPLETE_MARKER) {
        stageComplete = true;
        return false;
      }
      const doneMatch = trimmed.match(DONE_MARKER);
      if (doneMatch?.[1]) {
        completedTodoIds.push(doneMatch[1].trim());
        return false;
      }
      return true;
    })
    .join('\n')
    .trim();

  return { text, completedTodoIds, stageComplete };
}

export function evaluateStageProgressWithArc(args: {
  storyArc: StoryArc | null | undefined;
  currentStageNumber: number | null | undefined;
  progress: StoryArcTodoProgress | null | undefined;
  newlyCompleted: string[];
  stageCompleteFlag: boolean;
}): {
  progress: StoryArcTodoProgress;
  stageWon: boolean;
  nextStageNumber: number | null;
  nextStage: StoryArcStage | null;
} {
  const stage =
    args.storyArc?.stages?.find((item) => item.stageNumber === args.currentStageNumber) ?? null;
  const merged = mergeCompletedTodos(
    args.progress,
    stage?.stageNumber ?? args.currentStageNumber ?? 0,
    args.newlyCompleted,
  );

  if (!stage || args.currentStageNumber == null) {
    return {
      progress: merged,
      stageWon: false,
      nextStageNumber: null,
      nextStage: null,
    };
  }

  const completed = getCompletedTodoIds(merged, stage.stageNumber);
  const stageWon = args.stageCompleteFlag || isStageComplete(stage, completed);
  const nextStage = stageWon
    ? getNextStoryArcStage(args.storyArc, stage.stageNumber)
    : null;

  return {
    progress: merged,
    stageWon,
    nextStageNumber: nextStage?.stageNumber ?? null,
    nextStage,
  };
}

export function formatOpenTodosForNarrator(
  stage: StoryArcStage | null | undefined,
  completedIds: string[],
): string {
  if (!stage) return '';
  const completed = new Set(completedIds);
  const todos = getStageTodos(stage);
  if (!todos.length) return '';

  return todos
    .map((todo) => {
      const status = completed.has(todo.id) ? 'done' : 'open';
      return `- [${todo.id}] ${todo.text} (${status})`;
    })
    .join('\n');
}
