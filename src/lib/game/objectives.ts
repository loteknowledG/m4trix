export type ObjectiveInteractionType = 'pickup' | 'reach' | 'interact' | 'use';

export type ObjectiveType =
  | 'collect-object'
  | 'reach-location'
  | 'interact-npc'
  | 'custom';

export interface CheckpointObjective {
  id: string;
  type: ObjectiveType;
  description: string;
  targetObjectId?: string;
  targetLocationId?: string;
  requiredCount: number;
  interactionType?: ObjectiveInteractionType;
  completed: boolean;
  completionMessage?: string;
}

export interface StageObjectives {
  [stageNumber: number]: CheckpointObjective[];
}

export interface SceneObject {
  id: string;
  name: string;
  displayName?: string;
  type: 'collectible' | 'door' | 'npc' | 'prop' | 'vehicle' | 'key' | 'other';
  description?: string;
  isObjectiveTarget?: boolean;
  locationId?: string;
}

export interface SceneObjectMap {
  [objectId: string]: SceneObject;
}

export interface CheckpointProgress {
  storyId: string;
  stageNumber: number;
  completedObjectiveIds: string[];
  totalObjectives: number;
}

export function createObjective(
  partial: Partial<CheckpointObjective> & { description: string; type: ObjectiveType },
): CheckpointObjective {
  return {
    id: partial.id ?? `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: partial.type,
    description: partial.description,
    targetObjectId: partial.targetObjectId,
    targetLocationId: partial.targetLocationId,
    requiredCount: partial.requiredCount ?? 1,
    interactionType: partial.interactionType,
    completed: partial.completed ?? false,
    completionMessage: partial.completionMessage,
  };
}

export function createSceneObject(
  partial: Partial<SceneObject> & { name: string },
): SceneObject {
  return {
    id: partial.id ?? `obj-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: partial.name,
    displayName: partial.displayName,
    type: partial.type ?? 'other',
    description: partial.description,
    isObjectiveTarget: partial.isObjectiveTarget ?? false,
    locationId: partial.locationId,
  };
}

export function isObjectiveComplete(
  objective: CheckpointObjective,
  currentCount: number = 1,
): boolean {
  return currentCount >= objective.requiredCount;
}

export function getIncompleteObjectives(
  objectives: CheckpointObjective[],
): CheckpointObjective[] {
  return objectives.filter((obj) => !obj.completed);
}

export function getCompletedObjectives(
  objectives: CheckpointObjective[],
): CheckpointObjective[] {
  return objectives.filter((obj) => obj.completed);
}

export function normalizeObjectives(value: unknown): StageObjectives {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: StageObjectives = {};
  for (const [rawKey, rawObjs] of Object.entries(value)) {
    const stageNumber = Number(rawKey);
    if (!Number.isFinite(stageNumber)) continue;
    if (!Array.isArray(rawObjs)) continue;
    next[stageNumber] = rawObjs.filter(
      (obj): obj is CheckpointObjective =>
        obj !== null &&
        typeof obj === 'object' &&
        typeof obj.description === 'string' &&
        typeof obj.type === 'string',
    );
  }
  return next;
}

export function normalizeSceneObjects(value: unknown): SceneObjectMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const next: SceneObjectMap = {};
  for (const [id, obj] of Object.entries(value)) {
    if (
      obj !== null &&
      typeof obj === 'object' &&
      typeof (obj as SceneObject).name === 'string'
    ) {
      next[id] = obj as SceneObject;
    }
  }
  return next;
}