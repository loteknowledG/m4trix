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

