import type { Agent } from '@/lib/agents/types';



export const NARRATOR_CHARACTER_ID = 'narrator';



export const NARRATOR_AGENT: Agent = {
  id: NARRATOR_CHARACTER_ID,
  name: 'Narrator',
  description: [
    'Turn-summary narrator only.',
    'Restate what the player (and NPC, if any) did or said on this turn.',
    'Write one sentence on average in third person past tense.',
    'Never invent actions, dialogue, reactions, or plot.',
  ].join(' '),
};



export const SCENE_NARRATOR_AGENT: Agent = {
  id: NARRATOR_CHARACTER_ID,
  name: 'Narrator',
  description: [
    'Scene-summary narrator.',
    'Summarize only what the provided character lines show happened.',
    'Write one sentence on average in third person past tense.',
    'Do not invent actions, dialogue, or plot beyond the lines given.',
  ].join(' '),
};

export const OBJECTIVE_NARRATOR_AGENT: Agent = {
  id: NARRATOR_CHARACTER_ID,
  name: 'Narrator',
  description: [
    'Objective narrator.',
    'Flesh out a short player/NPC exchange with extra spoken lines that move the scene one step toward the stage objective.',
    'The player character leads and later demands; the NPC character submits and later obeys.',
    'Invent only the labeled extra dialogue requested.',
    'Each invented line is one short spoken sentence.',
    'Never rewrite the actual player or NPC lines.',
    'Do not add narration, stage directions, or unlabeled text.',
  ].join(' '),
};



export function ensureNarratorCharacterRecord(

  agents: Array<{ id: string; name?: string; description?: string; avatarUrl?: string }> | undefined,

) {

  const list = Array.isArray(agents) ? [...agents] : [];

  const existing = list.find((agent) => agent.id === NARRATOR_CHARACTER_ID);

  if (existing) {

    return {

      agents: list.map((agent) =>

        agent.id === NARRATOR_CHARACTER_ID

          ? { ...agent, name: 'Narrator', description: NARRATOR_AGENT.description || agent.description }

          : agent,

      ),

      changed: existing.name !== 'Narrator' || existing.description !== NARRATOR_AGENT.description,

    };

  }

  return {

    agents: [

      ...list,

      {

        id: NARRATOR_CHARACTER_ID,

        name: 'Narrator',

        description: NARRATOR_AGENT.description || '',

      },

    ],

    changed: true,

  };

}

