export interface StoryArcStage {
  stageNumber: number;
  stageName: string;
  shortDescription: string;
  emotionalState: string[];
  keyTags: string[];
  exampleDialogTone: string;
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
    .map((stage) => stage as Partial<StoryArcStage>)
    .filter(
      (stage) =>
        typeof stage.stageNumber === "number" &&
        typeof stage.stageName === "string" &&
        typeof stage.shortDescription === "string" &&
        Array.isArray(stage.emotionalState) &&
        Array.isArray(stage.keyTags) &&
        typeof stage.exampleDialogTone === "string",
    ) as StoryArcStage[];

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

