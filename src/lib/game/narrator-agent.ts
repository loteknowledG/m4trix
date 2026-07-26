import type { Agent } from '@/lib/agents/types';



export const NARRATOR_CHARACTER_ID = 'narrator';



export const NARRATOR_AGENT: Agent = {

  id: NARRATOR_CHARACTER_ID,

  name: 'Narrator',

  description: [

    'Third-person observational narrator for an interactive story.',

    'After each player/NPC exchange, recount what just happened in 2–4 sentences.',

    'Describe mood and physical beats only — never dialogue, never directions, never what should happen next.',

    'The player leads the scene; the narrator does not advance or steer it.',

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

