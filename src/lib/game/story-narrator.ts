import { CONNECTION_STORAGE_KEYS, getConnectionItem } from '@/lib/connection-storage';

import { DEFAULT_LMSTUDIO_URL, fetchAgentsWithLmstudioBrowserProxy, normalizeLmstudioUrl } from '@/lib/lmstudio';

import type { OrchestratedMessage } from '@/lib/agents/types';

import { extractAgentResponseText } from '@/lib/game/agent-response-text';

import { formatGameSpeakerLabel } from '@/lib/game/game-context';

import { NARRATOR_AGENT, SCENE_NARRATOR_AGENT } from '@/lib/game/narrator-agent';

import {

  formatOpenTodosForNarrator,

  parseNarratorTodoMarkers,

} from '@/lib/game/story-arc-progress';

import type { StoryArcStage } from '@/lib/game/story-arc';

import { getNextStoryArcStage, getStageTodos } from '@/lib/game/story-arc';

import { normalizeNarratorSummary } from '@/lib/game/dialogue-limits';



export type NarratorBeatResult = {

  text: string;

  completedTodoIds: string[];

  stageComplete: boolean;

};



export type SceneDialogLine = {
  speaker: string;
  text: string;
};

export type RunSceneNarratorBeatArgs = {
  connected: boolean;
  connectionModel: string | null;
  storyContext: string;
  sceneSummary: string;
  sceneLines: SceneDialogLine[];
  nextMomentName?: string;
  isLastMoment?: boolean;
  history: OrchestratedMessage[];
  arcStage?: StoryArcStage | null;
  completedTodoIds?: string[];
};

export type RunNarratorBeatArgs = {

  connected: boolean;

  connectionModel: string | null;

  storyContext: string;

  sceneSummary: string;

  userText: string;

  npcName: string;

  npcText: string;

  playerName?: string;

  history: OrchestratedMessage[];

  playerMode?: OrchestratedMessage['playerMode'];

  npcKnowsPlayer?: boolean;

  currentTurnNpcKnewPlayer?: boolean;

  arcStage?: StoryArcStage | null;

  completedTodoIds?: string[];

  /** When true, summarize only this turn — no arc/todo scoring or plot invention. */
  summarizeOnly?: boolean;

};



function hasOpenArcTodos(
  stage: StoryArcStage | null | undefined,
  completedIds: string[],
): boolean {
  if (!stage) return false;
  const completed = new Set(completedIds);
  return getStageTodos(stage).some((todo) => !completed.has(todo.id));
}

function buildSceneSummarySentence(
  sceneLines: SceneDialogLine[],
  options?: { nextMomentName?: string; isLastMoment?: boolean },
): string {
  const beats = sceneLines
    .map((line) => {
      const text = line.text.trim().replace(/^["']|["']$/g, '');
      if (!text) return '';
      return `${line.speaker} said "${text}"`;
    })
    .filter(Boolean);

  if (!beats.length) {
    return 'The scene unfolded quietly.';
  }

  let sentence = `In this scene, ${beats.join(', and ')}.`;

  if (!options?.isLastMoment && options?.nextMomentName?.trim()) {
    sentence = sentence.replace(/\.$/, '');
    sentence += `, and the story moved toward ${options.nextMomentName.trim()}.`;
  }

  return sentence;
}

function summarizePlayerLine(
  playerLine: string,
  playerLabel: string,
  playerMode?: OrchestratedMessage['playerMode'],
): string {
  const line = playerLine.trim();
  if (!line) return '';
  const punctuated = line.endsWith('.') || line.endsWith('!') || line.endsWith('?') ? line : `${line}.`;
  if (playerMode === 'do') return `${playerLabel} ${punctuated}`;
  if (playerMode === 'think') return `${playerLabel} thought: ${punctuated}`;
  return `${playerLabel} said: "${line.replace(/^["']|["']$/g, '')}".`;
}

export function buildSceneNarratorFallbackBeat(args: {
  sceneLines: SceneDialogLine[];
  nextMomentName?: string;
  isLastMoment?: boolean;
}): NarratorBeatResult {
  const text = normalizeNarratorSummary(
    buildSceneSummarySentence(args.sceneLines, {
      nextMomentName: args.nextMomentName,
      isLastMoment: args.isLastMoment,
    }),
  );

  return {
    text,
    completedTodoIds: [],
    stageComplete: false,
  };
}

export function buildNarratorFallbackBeat(args: {

  userText: string;

  npcText: string;

  npcName: string;

  playerName?: string;

  playerMode?: OrchestratedMessage['playerMode'];

}): NarratorBeatResult {

  const playerLine = args.userText.trim();
  const npcLine = args.npcText.trim();
  const playerLabel = args.playerName?.trim() || 'The player';

  const parts = [
    playerLine ? summarizePlayerLine(playerLine, playerLabel, args.playerMode) : '',
    npcLine ? `${args.npcName} said: "${npcLine.replace(/^["']|["']$/g, '')}".` : '',
  ].filter(Boolean);

  const text = normalizeNarratorSummary(parts.join(' ').trim() || 'The scene unfolded quietly.');
  return {
    text,
    completedTodoIds: [],
    stageComplete: false,
  };

}



export async function runSceneNarratorBeat({
  connected,
  connectionModel,
  storyContext,
  sceneSummary,
  sceneLines,
  nextMomentName,
  isLastMoment = false,
  history,
  arcStage,
  completedTodoIds = [],
}: RunSceneNarratorBeatArgs): Promise<NarratorBeatResult> {
  const fallback = () =>
    buildSceneNarratorFallbackBeat({ sceneLines, nextMomentName, isLastMoment });

  if (sceneLines.length === 0) {
    return fallback();
  }

  const summaryText = normalizeNarratorSummary(
    buildSceneSummarySentence(sceneLines, { nextMomentName, isLastMoment }),
  );

  const todoSection = formatOpenTodosForNarrator(arcStage, completedTodoIds);
  const needsTodoScoring = connected && hasOpenArcTodos(arcStage, completedTodoIds);

  if (!needsTodoScoring) {
    return {
      text: summaryText,
      completedTodoIds: [],
      stageComplete: false,
    };
  }

  const sceneLinesBlock = sceneLines
    .map((line) => `${line.speaker}: ${line.text.trim()}`)
    .join('\n');

  const prompt = [
    'Review the character lines and stage goals below.',
    'If any OPEN goal was clearly completed in this scene, output one line per goal: [DONE:todo-id]',
    'If every goal for this stage is now complete, also output [STAGE_COMPLETE] on its own line.',
    'Output ONLY those marker lines. If no goals were completed, output exactly: NONE',
    '',
    sceneSummary ? `Scene:\n${sceneSummary}` : '',
    '',
    `Character lines this scene:\n${sceneLinesBlock}`,
    '',
    `Stage goals:\n${todoSection}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const zenKey = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey) ?? undefined;
  const googleKey = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey) ?? undefined;
  const hfKey = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey) ?? undefined;
  const nvidiaKey = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey) ?? undefined;
  const activeProvider =
    getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||
    getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider) ||
    'zen';
  const lmstudioUrl = normalizeLmstudioUrl(
    getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl) || DEFAULT_LMSTUDIO_URL,
  );

  try {
    const res = await fetchAgentsWithLmstudioBrowserProxy({
      prompt,
      model: connectionModel,
      zenApiKey: zenKey,
      googleApiKey: googleKey,
      hfApiKey: hfKey,
      nvidiaApiKey: nvidiaKey,
      provider: activeProvider,
      lmstudioUrl: activeProvider === 'lmstudio' ? lmstudioUrl : undefined,
      agents: [SCENE_NARRATOR_AGENT],
      stateless: true,
      orchestration: 'parallel',
      interactionMode: 'neutral',
      story: sceneSummary,
      stream: false,
    });

    const raw = await res.text().catch(() => '');
    const rawText = res.ok ? extractAgentResponseText(raw).trim() : '';

    if (!rawText || /^none$/i.test(rawText)) {
      return {
        text: summaryText,
        completedTodoIds: [],
        stageComplete: false,
      };
    }

    const parsed = parseNarratorTodoMarkers(rawText);
    return {
      text: summaryText,
      completedTodoIds: parsed.completedTodoIds,
      stageComplete: parsed.stageComplete,
    };
  } catch (err) {
    console.warn('[game][narrator][scene] request failed', err);
    return {
      text: summaryText,
      completedTodoIds: [],
      stageComplete: false,
    };
  }
}

export async function runNarratorBeat({

  connected,

  connectionModel,

  storyContext,

  sceneSummary,

  userText,

  npcName,

  npcText,

  playerName,

  history,

  playerMode,

  npcKnowsPlayer,

  currentTurnNpcKnewPlayer,

  arcStage,

  completedTodoIds = [],

  summarizeOnly = false,

}: RunNarratorBeatArgs): Promise<NarratorBeatResult> {
  const fallbackBeat = buildNarratorFallbackBeat({
    userText,
    npcText,
    npcName,
    playerName,
    playerMode,
  });

  if (!connected) {
    return fallbackBeat;
  }

  const todoSection = summarizeOnly ? '' : formatOpenTodosForNarrator(arcStage, completedTodoIds);
  const needsTodoScoring = !summarizeOnly && hasOpenArcTodos(arcStage, completedTodoIds);

  if (summarizeOnly || !needsTodoScoring) {
    return fallbackBeat;
  }

  const npc = { name: npcName };
  const player = playerName ? { name: playerName } : null;
  const knowsPlayer = npcKnowsPlayer !== false;
  const formatSpeaker = (
    from: 'user' | 'agent',
    mode?: OrchestratedMessage['playerMode'],
    npcKnewPlayer?: boolean,
  ) =>
    formatGameSpeakerLabel(
      from,
      npc,
      player,
      from === 'user' ? (npcKnewPlayer ?? knowsPlayer) : true,
      mode,
    );

  const playerOnlyBeat = !npcText.trim();
  const prompt = [
    'Review the latest exchange and stage goals below.',
    'If any OPEN goal was clearly completed in this exchange, output one line per goal: [DONE:todo-id]',
    'If every goal for this stage is now complete, also output [STAGE_COMPLETE] on its own line.',
    'Output ONLY those marker lines. If no goals were completed, output exactly: NONE',
    '',
    sceneSummary ? `Scene:\n${sceneSummary}` : '',
    '',
    `Latest ${formatSpeaker('user', playerMode, currentTurnNpcKnewPlayer)}:\n${userText}`,
    playerOnlyBeat
      ? ''
      : `\nLatest ${formatSpeaker('agent')} (${npcName}):\n${npcText}`,
    '',
    `Stage goals:\n${todoSection}`,
  ]
    .filter(Boolean)
    .join('\n\n');



  const zenKey = getConnectionItem(CONNECTION_STORAGE_KEYS.zenKey) ?? undefined;

  const googleKey = getConnectionItem(CONNECTION_STORAGE_KEYS.googleKey) ?? undefined;

  const hfKey = getConnectionItem(CONNECTION_STORAGE_KEYS.hfKey) ?? undefined;

  const nvidiaKey = getConnectionItem(CONNECTION_STORAGE_KEYS.nvidiaKey) ?? undefined;

  const activeProvider =

    getConnectionItem(CONNECTION_STORAGE_KEYS.activeModelProvider) ||

    getConnectionItem(CONNECTION_STORAGE_KEYS.activeProvider) ||

    'zen';

  const lmstudioUrl = normalizeLmstudioUrl(

    getConnectionItem(CONNECTION_STORAGE_KEYS.lmstudioUrl) || DEFAULT_LMSTUDIO_URL,

  );



  try {

    const res = await fetchAgentsWithLmstudioBrowserProxy({

      prompt,

      model: connectionModel,

      zenApiKey: zenKey,

      googleApiKey: googleKey,

      hfApiKey: hfKey,

      nvidiaApiKey: nvidiaKey,

      provider: activeProvider,

      lmstudioUrl: activeProvider === 'lmstudio' ? lmstudioUrl : undefined,

      agents: [NARRATOR_AGENT],
      stateless: true,
      orchestration: 'parallel',
      interactionMode: 'neutral',
      story: sceneSummary,
      stream: false,
    });

    const raw = await res.text().catch(() => '');
    const rawText = res.ok ? extractAgentResponseText(raw).trim() : '';

    if (!rawText || /^none$/i.test(rawText)) {
      return fallbackBeat;
    }

    const parsed = parseNarratorTodoMarkers(rawText);
    return {
      text: fallbackBeat.text,
      completedTodoIds: parsed.completedTodoIds,
      stageComplete: parsed.stageComplete,
    };
  } catch (err) {
    console.warn('[game][narrator] request failed', err);
    return fallbackBeat;
  }
}



export function resolveNextArcStage(

  storyArc: { stages?: StoryArcStage[] } | null | undefined,

  currentStageNumber: number | null | undefined,

) {

  return getNextStoryArcStage(

    storyArc

      ? {

          id: 'runtime',

          name: 'runtime',

          stages: storyArc.stages ?? [],

        }

      : null,

    currentStageNumber,

  );

}

