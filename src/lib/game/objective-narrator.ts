import { clampDialogueSentences } from '@/lib/game/dialogue-limits';

export type ObjectiveFleshOutLines = {
  lead: string;
  submit: string;
  demand: string;
  obey: string;
};

export type ObjectiveExchange = {
  playerName: string;
  npcName: string;
  playerText: string;
  npcText: string;
};

const LABEL_MAP: Record<string, keyof ObjectiveFleshOutLines> = {
  LEAD: 'lead',
  LEAD_PLAYER: 'lead',
  SUBMIT: 'submit',
  SUBMIT_NPC: 'submit',
  LEAD_NPC: 'submit',
  DEMAND: 'demand',
  DEMAND_PLAYER: 'demand',
  OBEY: 'obey',
  OBEY_NPC: 'obey',
};

function stripQuotes(text: string): string {
  return text.trim().replace(/^["“”']+|["“”']+$/g, '').trim();
}

function oneSpokenSentence(text: string): string {
  return clampDialogueSentences(stripQuotes(text), 1);
}

function spokenBeat(speaker: string, text: string): string {
  const line = oneSpokenSentence(text);
  if (!line) return '';
  const name = speaker.trim() || 'Someone';
  return `${name} said: "${line.replace(/"/g, '')}"`;
}

export function parseObjectiveFleshOut(raw: string): ObjectiveFleshOutLines | null {
  const cleaned = (raw || '')
    .replace(/```(?:\w+)?/g, '')
    .trim();
  if (!cleaned) return null;

  const lines = cleaned
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: Partial<ObjectiveFleshOutLines> = {};
  const unlabeled: string[] = [];

  for (const line of lines) {
    const match = line.match(/^([A-Z_]+)\s*[:\-]\s*(.+)$/i);
    if (!match?.[1] || !match[2]) {
      unlabeled.push(stripQuotes(line));
      continue;
    }
    const key = LABEL_MAP[match[1].toUpperCase()];
    const value = oneSpokenSentence(match[2]);
    if (key && value) {
      parsed[key] = value;
    } else {
      unlabeled.push(stripQuotes(line));
    }
  }

  const missing = (['lead', 'submit', 'demand', 'obey'] as const).filter((key) => !parsed[key]);
  if (missing.length) {
    const extras = unlabeled.map(oneSpokenSentence).filter(Boolean);
    for (const key of missing) {
      const next = extras.shift();
      if (!next) break;
      parsed[key] = next;
    }
  }

  if (!parsed.lead || !parsed.submit || !parsed.demand || !parsed.obey) return null;

  return {
    lead: parsed.lead,
    submit: parsed.submit,
    demand: parsed.demand,
    obey: parsed.obey,
  };
}

export function formatObjectiveNarratorBeat(
  exchange: ObjectiveExchange,
  extra: ObjectiveFleshOutLines,
): string {
  const player = exchange.playerName.trim() || 'The player';
  const npc = exchange.npcName.trim() || 'The other character';
  return [
    spokenBeat(player, extra.lead),
    spokenBeat(npc, extra.submit),
    spokenBeat(player, exchange.playerText),
    spokenBeat(npc, exchange.npcText),
    spokenBeat(player, extra.demand),
    spokenBeat(npc, extra.obey),
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildObjectiveFleshOutPrompt(args: {
  objective: string;
  exchange: ObjectiveExchange;
  storyContext?: string;
}): string {
  const player = args.exchange.playerName.trim() || 'the player';
  const npc = args.exchange.npcName.trim() || 'the other character';
  return [
    args.storyContext?.trim() ? `Story context:\n${args.storyContext.trim()}` : '',
    `Stage objective:\n${args.objective.trim()}`,
    `Player character: ${player}`,
    `NPC character: ${npc}`,
    `Actual player line (do not rewrite):\n${args.exchange.playerText.trim()}`,
    `Actual NPC line (do not rewrite):\n${args.exchange.npcText.trim()}`,
    [
      'The player and NPC each said only one short line.',
      'Flesh the exchange out so the scene takes one step toward the objective.',
      `Invent four extra spoken lines: ${player} leads, ${npc} submits, then after the actual lines ${player} demands and ${npc} obeys.`,
      'Each invented line is one sentence of dialogue only. No quotation marks. No speaker names. No narration.',
      'Do not copy or paraphrase the actual lines in the invented lines.',
      '',
      'Output exactly these four labeled lines:',
      'LEAD: <one sentence the player said first, pushing toward the objective>',
      `SUBMIT: <one sentence ${npc} said in reply, submitting to ${player}>`,
      'DEMAND: <one sentence the player then demanded that advances the objective>',
      `OBEY: <one sentence ${npc} said, showing obedience to ${player}>`,
    ].join('\n'),
  ]
    .filter(Boolean)
    .join('\n\n');
}
