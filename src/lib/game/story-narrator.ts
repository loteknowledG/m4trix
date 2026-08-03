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

import { normalizeNarratorSummary } from '@/lib/game/dialogue-limits';



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

  /** When true, summarize only this turn — no arc/todo scoring or plot invention. */
  summarizeOnly?: boolean;

};



function clipSnippet(value: string, max = 140): string {

  const compact = value.trim().replace(/\s+/g, ' ');

  if (!compact) return '';

  if (compact.length <= max) return compact;

  return `${compact.slice(0, max - 1).trim()}…`;

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

export function buildNarratorFallbackBeat(args: {

  userText: string;

  npcText: string;

  npcName: string;

  playerName?: string;

  playerMode?: OrchestratedMessage['playerMode'];

}): NarratorBeatResult {

  const playerLine = clipSnippet(args.userText, 200);

  const npcLine = clipSnippet(args.npcText, 200);

  const playerLabel = args.playerName?.trim() || 'The player';

  const parts = [

    playerLine ? summarizePlayerLine(playerLine, playerLabel, args.playerMode) : '',

    npcLine ? `${args.npcName} said: "${npcLine.replace(/^["']|["']$/g, '')}".` : '',

  ].filter(Boolean);

  const text = normalizeNarratorSummary(parts.join(' ').trim(), !npcLine);
  return {
    text,
    completedTodoIds: [],
    stageComplete: false,
  };

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

  const fallback = () =>

    buildNarratorFallbackBeat({ userText, npcText, npcName, playerName, playerMode });



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



  const todoSection = summarizeOnly ? '' : formatOpenTodosForNarrator(arcStage, completedTodoIds);

  const arcSection =
    summarizeOnly || !arcStage
      ? ''
      : [

          `Current stage: ${arcStage.stageNumber}${arcStage.stageName ? ` — ${arcStage.stageName}` : ''}`,

          arcStage.shortDescription ? `Stage note: ${arcStage.shortDescription}` : '',

          todoSection ? `Stage todo goals:\n${todoSection}` : '',

        ]

          .filter(Boolean)

          .join('\n');

  const playerOnlyBeat = !npcText.trim();

  const prompt = summarizeOnly

    ? [

        'Summarize ONLY what happened on this turn.',

        'Write one sentence when possible; never more than two short sentences.',

        'Use third person past tense.',

        'Restate the player line (and NPC line if present). Do not add new actions, dialogue, reactions, consequences, mood, or setting details that are not in the lines below.',

        'Do not advance the plot, invent events, or say what happens next.',

        'Do not assign points, stats, or rewards (that system is not active yet).',

        '',

        sceneSummary ? `Scene label:\n${sceneSummary}` : '',

        '',

        `Player turn (${formatSpeaker('user', playerMode, currentTurnNpcKnewPlayer)}):\n${userText}`,

        playerOnlyBeat

          ? ''

          : `\nNPC turn (${npcName}):\n${npcText}`,

      ]

        .filter(Boolean)

        .join('\n\n')

    : [

        'Summarize ONLY what happened on this turn.',

        'Write one sentence when possible; never more than two short sentences.',

        'Use third person past tense.',

        'Restate what the player and NPC did or said. Do not invent new events, dialogue, or plot.',

        'Do not advance the story or say what happens next.',

        todoSection

          ? 'Review the stage todo goals. If this exchange clearly completed any OPEN goals, append one line per goal: [DONE:todo-id]. If every goal for this stage is now done, also append [STAGE_COMPLETE] on its own line. Put these markers AFTER your summary.'

          : '',

        '',

        storyContext ? `Story context:\n${storyContext}` : '',

        sceneSummary ? `Scene:\n${sceneSummary}` : '',

        arcSection ? `Arc:\n${arcSection}` : '',

        '',

        `Latest ${formatSpeaker('user', playerMode, currentTurnNpcKnewPlayer)}:\n${userText}`,

        '',

        playerOnlyBeat

          ? 'No NPC line this beat — summarize only the player turn above.'

          : `Latest ${formatSpeaker('agent')} (${npcName}):\n${npcText}`,

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

    return {
      ...parsed,
      text: normalizeNarratorSummary(parsed.text, summarizeOnly && playerOnlyBeat),
    };

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

