import { CONNECTION_STORAGE_KEYS, getConnectionItem } from '@/lib/connection-storage';

import { DEFAULT_LMSTUDIO_URL, fetchAgentsWithLmstudioBrowserProxy, normalizeLmstudioUrl } from '@/lib/lmstudio';

import type { OrchestratedMessage } from '@/lib/agents/types';

import { extractAgentResponseText } from '@/lib/game/agent-response-text';

import { formatGameSpeakerLabel } from '@/lib/game/game-context';

import { NARRATOR_AGENT } from '@/lib/game/narrator-agent';

import {

  formatOpenTodosForNarrator,

  parseNarratorTodoMarkers,

} from '@/lib/game/story-arc-progress';

import type { StoryArcStage } from '@/lib/game/story-arc';

import { getNextStoryArcStage } from '@/lib/game/story-arc';



export type NarratorBeatResult = {

  text: string;

  completedTodoIds: string[];

  stageComplete: boolean;

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

};



function clipSnippet(value: string, max = 140): string {

  const compact = value.trim().replace(/\s+/g, ' ');

  if (!compact) return '';

  if (compact.length <= max) return compact;

  return `${compact.slice(0, max - 1).trim()}…`;

}



export function buildNarratorFallbackBeat(args: {

  userText: string;

  npcText: string;

  npcName: string;

  playerName?: string;

}): NarratorBeatResult {

  const playerLine = clipSnippet(args.userText, 100);

  const npcLine = clipSnippet(args.npcText, 160);

  const playerLabel = args.playerName?.trim() || 'The player';



  const parts = [

    playerLine

      ? `${playerLabel} ${playerLine.endsWith('.') ? playerLine : `${playerLine}.`}`

      : '',

    npcLine ? `${args.npcName} ${npcLine.endsWith('.') ? npcLine : `${npcLine}.`}` : '',

  ].filter(Boolean);



  return { text: parts.join(' '), completedTodoIds: [], stageComplete: false };

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

}: RunNarratorBeatArgs): Promise<NarratorBeatResult> {

  const fallback = () =>

    buildNarratorFallbackBeat({ userText, npcText, npcName, playerName });



  if (!connected) {

    return fallback();

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



  const todoSection = formatOpenTodosForNarrator(arcStage, completedTodoIds);

  const arcSection = arcStage

    ? [

        `Current stage: ${arcStage.stageNumber}${arcStage.stageName ? ` — ${arcStage.stageName}` : ''}`,

        arcStage.shortDescription ? `Stage note: ${arcStage.shortDescription}` : '',

        todoSection ? `Stage todo goals:\n${todoSection}` : '',

      ]

        .filter(Boolean)

        .join('\n')

    : '';



  const prompt = [

    'Write an observational narrator beat after this player/NPC exchange.',

    'Recount what just happened in third person past tense (2–4 sentences).',

    'Include mood, body language, and setting — not new dialogue.',

    'Do not tell anyone what to do next or steer the scene. The player leads.',

    todoSection

      ? 'Review the stage todo goals. If this exchange clearly completed any OPEN goals, append one line per goal: [DONE:todo-id]. If every goal for this stage is now done, also append [STAGE_COMPLETE] on its own line. Put these markers AFTER your narrator text.'

      : '',

    '',

    storyContext ? `Story context:\n${storyContext}` : '',

    sceneSummary ? `Scene:\n${sceneSummary}` : '',

    arcSection ? `Arc:\n${arcSection}` : '',

    '',

    `Latest ${formatSpeaker('user', playerMode, currentTurnNpcKnewPlayer)}:\n${userText}`,

    '',

    `Latest ${formatSpeaker('agent')} (${npcName}):\n${npcText}`,

    '',

    `Recent history:\n${history

      .slice(-8)

      .map((msg) =>

        `${formatSpeaker(msg.from, msg.from === 'user' ? msg.playerMode : undefined, msg.npcKnewPlayer)}: ${msg.text}`,

      )

      .join('\n')}`,

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

      story: storyContext || sceneSummary,

      history: history.slice(-8),

      stream: false,

    });



    const raw = await res.text().catch(() => '');

    const rawText = res.ok ? extractAgentResponseText(raw) : '';



    if (!rawText) {

      console.warn('[game][narrator] empty model response', {

        ok: res.ok,

        status: res.status,

        provider: activeProvider,

      });

      return fallback();

    }



    const parsed = parseNarratorTodoMarkers(rawText);

    if (!parsed.text) {

      return fallback();

    }

    return parsed;

  } catch (err) {

    console.warn('[game][narrator] request failed', err);

    return fallback();

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

