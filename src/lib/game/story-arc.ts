import type {
  CheckpointObjective,
  ObjectiveInteractionType,
  ObjectiveType,
  SceneObject,
} from './objectives';

export type { CheckpointObjective, ObjectiveInteractionType, ObjectiveType, SceneObject };

export interface StoryArcStage {
  stageNumber: number;
  stageName: string;
  shortDescription: string;
  emotionalState: string[];
  keyTags: string[];
  passTest: string[];
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
  }
> & {
    objectives?: CheckpointObjective[];
    sceneObjects?: SceneObject[];
  };

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

