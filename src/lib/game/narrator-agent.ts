import type { Agent } from '@/lib/agents/types';



export const NARRATOR_CHARACTER_ID = 'narrator';



export const NARRATOR_AGENT: Agent = {

  id: NARRATOR_CHARACTER_ID,

  name: 'Narrator',

  description: [

    'Turn-summary narrator only.',

    'Restate what the player (and NPC, if any) did or said on this turn in one sentence when possible, never more than two.',

    'Third person past tense.',

    'Never invent actions, dialogue, reactions, or plot.',

    'Never advance the story or say what happens next.',

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

