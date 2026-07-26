import type {
  CheckpointObjective,
  ObjectiveInteractionType,
  ObjectiveType,
  SceneObject,
} from './objectives';

export type { CheckpointObjective, ObjectiveInteractionType, ObjectiveType, SceneObject };

export interface StoryArcTodoItem {
  id: string;
  text: string;
}

export interface StoryArcStage {
  stageNumber: number;
  stageName: string;
  shortDescription: string;
  emotionalState: string[];
  keyTags: string[];
  passTest: string[];
  todos: StoryArcTodoItem[];
  exampleDialogTone: string;
  powerDynamic: string;
  objectives?: CheckpointObjective[];
  sceneObjects?: SceneObject[];
}

export interface StoryArc {
  id: string;
  name: string;
  description?: string;
  stages: StoryArcStage[];
  metadata?: Record<string, unknown>;
}

/**
 * Story-level arc state for local-first persistence.
 * Supports one main arc plus optional side arcs.
 */
export interface StoryArcState {
  mainArcId: string | null;
  arcs: StoryArc[];
  currentStageByArcId: Record<string, number>;
}

export function getCurrentStage(storyArc: StoryArc, currentProgress: number): StoryArcStage | null {
  if (!storyArc?.stages?.length) return null;
  const sorted = [...storyArc.stages].sort((a, b) => a.stageNumber - b.stageNumber);
  const clampedProgress = Number.isFinite(currentProgress)
    ? Math.max(0, Math.min(1, currentProgress))
    : 0;
  const index = Math.min(sorted.length - 1, Math.floor(clampedProgress * sorted.length));
  return sorted[index] ?? null;
}

export function suggestNextStage(
  storyArc: StoryArc,
  currentStageNumber: number,
  recentHighlights: string[] = [],
): StoryArcStage | null {
  if (!storyArc?.stages?.length) return null;
  const sorted = [...storyArc.stages].sort((a, b) => a.stageNumber - b.stageNumber);
  const currentIndex = sorted.findIndex((stage) => stage.stageNumber === currentStageNumber);
  if (currentIndex < 0) return sorted[0] ?? null;
  const current = sorted[currentIndex];
  const next = sorted[currentIndex + 1] ?? null;
  if (!next) return current;

  const highlightText = recentHighlights.join(" ").toLowerCase();
  const matchedCurrentTags = current.keyTags.filter((tag) =>
    highlightText.includes(tag.toLowerCase()),
  ).length;
  const matchedNextTags = next.keyTags.filter((tag) =>
    highlightText.includes(tag.toLowerCase()),
  ).length;

  // Move forward when highlights begin matching the next stage more than the current stage.
  return matchedNextTags > matchedCurrentTags ? next : current;
}

type RawStoryArcStage = Partial<
  StoryArcStage & {
    shortDesc?: string;
    name?: string;
    stage?: number;
    todos?: Array<{ id?: string; text?: string } | string>;
  }
> & {
    objectives?: CheckpointObjective[];
    sceneObjects?: SceneObject[];
  };

export function createStoryArcTodo(text: string): StoryArcTodoItem {
  return {
    id: `todo-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    text: text.trim(),
  };
}

function normalizeTodoItems(raw: RawStoryArcStage): StoryArcTodoItem[] {
  if (Array.isArray(raw.todos) && raw.todos.length > 0) {
    return raw.todos
      .map((item: { id?: string; text?: string } | string, index: number) => {
        if (typeof item === 'string') {
          const text = item.trim();
          return text ? createStoryArcTodo(text) : null;
        }
        if (item && typeof item === 'object' && typeof item.text === 'string' && item.text.trim()) {
          return {
            id:
              typeof item.id === 'string' && item.id.trim()
                ? item.id.trim()
                : `todo-${index + 1}-${Math.random().toString(16).slice(2, 6)}`,
            text: item.text.trim(),
          };
        }
        return null;
      })
      .filter((item): item is StoryArcTodoItem => item !== null);
  }

  if (Array.isArray(raw.passTest)) {
    return raw.passTest
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => createStoryArcTodo(value));
  }

  return [];
}

export function getStageTodos(stage: StoryArcStage | null | undefined): StoryArcTodoItem[] {
  if (!stage) return [];
  if (Array.isArray(stage.todos) && stage.todos.length > 0) return stage.todos;
  if (Array.isArray(stage.passTest) && stage.passTest.length > 0) {
    return stage.passTest.map((value) => createStoryArcTodo(value));
  }
  return [];
}

export function isStageComplete(
  stage: StoryArcStage | null | undefined,
  completedTodoIds: string[],
): boolean {
  const todos = getStageTodos(stage);
  if (!todos.length) return false;
  const completed = new Set(completedTodoIds);
  return todos.every((todo) => completed.has(todo.id));
}

export function getNextStoryArcStage(
  storyArc: StoryArc | null | undefined,
  currentStageNumber: number | null | undefined,
): StoryArcStage | null {
  if (!storyArc?.stages?.length || currentStageNumber == null) return null;
  const sorted = [...storyArc.stages].sort((a, b) => a.stageNumber - b.stageNumber);
  const index = sorted.findIndex((stage) => stage.stageNumber === currentStageNumber);
  if (index < 0) return sorted[0] ?? null;
  return sorted[index + 1] ?? null;
}

export function createEmptyStoryArc(storyId: string, title: string): StoryArc {
  return {
    id: storyId ? `story-${storyId}-arc` : `story-arc-${Date.now()}`,
    name: title.trim() || 'Story Arc',
    description: 'Player-led stages with todo goals tracked by the narrator during play.',
    stages: [],
  };
}

export function addStoryArcStage(arc: StoryArc): StoryArc {
  const sorted = [...arc.stages].sort((a, b) => a.stageNumber - b.stageNumber);
  const nextNumber = sorted.length ? sorted[sorted.length - 1].stageNumber + 1 : 1;
  return {
    ...arc,
    stages: [
      ...sorted,
      {
        stageNumber: nextNumber,
        stageName: `Stage ${nextNumber}`,
        shortDescription: '',
        emotionalState: [],
        keyTags: [],
        passTest: [],
        todos: [],
        exampleDialogTone: '',
        powerDynamic: '',
      },
    ],
  };
}

export function removeStoryArcStage(arc: StoryArc, stageNumber: number): StoryArc {
  const stages = arc.stages
    .filter((stage) => stage.stageNumber !== stageNumber)
    .sort((a, b) => a.stageNumber - b.stageNumber)
    .map((stage, index) => ({ ...stage, stageNumber: index + 1 }));
  return { ...arc, stages };
}

export function updateStoryArcStage(arc: StoryArc, nextStage: StoryArcStage): StoryArc {
  const stages = [...arc.stages];
  const index = stages.findIndex((stage) => stage.stageNumber === nextStage.stageNumber);
  if (index >= 0) {
    stages[index] = nextStage;
  } else {
    stages.push(nextStage);
  }
  return {
    ...arc,
    stages: stages.sort((a, b) => a.stageNumber - b.stageNumber),
  };
}

export function normalizeStoryArcStage(
  raw: RawStoryArcStage,
  fallbackStageNumber?: number,
): StoryArcStage | null {
  const stageNumber =
    typeof raw.stageNumber === "number"
      ? raw.stageNumber
      : typeof raw.stage === "number"
        ? raw.stage
        : fallbackStageNumber;
  if (stageNumber == null || !Number.isFinite(stageNumber)) return null;

  return {
    stageNumber,
    stageName:
      typeof raw.stageName === "string"
        ? raw.stageName
        : typeof raw.name === "string"
          ? raw.name
          : "",
    shortDescription:
      typeof raw.shortDescription === "string"
        ? raw.shortDescription
        : typeof raw.shortDesc === "string"
          ? raw.shortDesc
          : "",
    emotionalState: Array.isArray(raw.emotionalState)
      ? raw.emotionalState.filter((value): value is string => typeof value === "string")
      : [],
    keyTags: Array.isArray(raw.keyTags)
      ? raw.keyTags.filter((value): value is string => typeof value === "string")
      : [],
    passTest: Array.isArray(raw.passTest)
      ? raw.passTest.filter((value): value is string => typeof value === "string")
      : [],
    todos: normalizeTodoItems(raw),
    exampleDialogTone:
      typeof raw.exampleDialogTone === "string" ? raw.exampleDialogTone : "",
    powerDynamic: typeof raw.powerDynamic === "string" ? raw.powerDynamic : "",
    objectives: Array.isArray(raw.objectives) ? raw.objectives.filter(Boolean) : undefined,
    sceneObjects: Array.isArray(raw.sceneObjects) ? raw.sceneObjects.filter(Boolean) : undefined,
  };
}

export function parseStoryArcJson(input: string): StoryArc {
  const parsed = JSON.parse(input) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid story arc JSON: expected an object.");
  }

  const arc = parsed as Partial<StoryArc>;
  if (!arc.id || !arc.name || !Array.isArray(arc.stages)) {
    throw new Error("Invalid story arc JSON: missing id, name, or stages.");
  }

  const cleanedStages = arc.stages
    .map((stage, index) =>
      normalizeStoryArcStage(stage as RawStoryArcStage, index + 1),
    )
    .filter((stage): stage is StoryArcStage => stage !== null);

  if (!cleanedStages.length) {
    throw new Error("Invalid story arc JSON: no valid stages found.");
  }

  return {
    id: arc.id,
    name: arc.name,
    description: arc.description,
    stages: cleanedStages.sort((a, b) => a.stageNumber - b.stageNumber),
    metadata: arc.metadata,
  };
}

