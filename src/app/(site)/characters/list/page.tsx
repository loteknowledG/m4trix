'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Marquee } from '@/components/ui/marquee';
import { GrUserAdd } from 'react-icons/gr';
import { characterDetailHref } from '@/lib/character-routes';

type Agent = {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';

export default function AgentsListPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      if (!mounted) return;

      if (stored && Array.isArray(stored)) {
        setAgents(stored);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const saveAgents = async (next: Agent[]) => {
    setAgents(next);
    await idbSet(AGENTS_KEY, next);
    window.dispatchEvent(new Event('characters-updated'));
  };

  const addAgentViaFab = async () => {
    const newAgent: Agent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: '',
      description: '',
    };

    const next = [...agents, newAgent];
    setAgents(next);
    await idbSet(AGENTS_KEY, next);
    window.dispatchEvent(new Event('characters-updated'));
    router.push(characterDetailHref(newAgent.id));
  };

  return (
    <>
    <ContentLayout title="Characters" navLeft={null} navRight={null}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold"></h1>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-muted-foreground">
            No characters yet. Add one above.
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {agents.map(agent => {
              return (
                <div key={agent.id} className="relative group rounded-xl">
                  <Link
                    href={characterDetailHref(agent.id)}
                    className="block"
                  >
                    <Card
                      className="m4-paper-card overflow-hidden cursor-pointer"
                    >
                      <div className="relative aspect-square">
                        {agent.avatarUrl ? (
                          <img
                            src={agent.avatarUrl}
                            alt={agent.name && agent.name.trim() ? agent.name : 'Untitled'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-900 dark:bg-zinc-800" />
                        )}
                        <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/65 to-transparent">
                          <Marquee className="font-bold text-lg text-white truncate">
                            {agent.name && agent.name.trim() ? agent.name : 'Untitled'}
                          </Marquee>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </ContentLayout>

      <Button
        onClick={addAgentViaFab}
        size="icon"
        variant="raised"
        className="pushable-effect pushable-wall-neutral pointer-events-auto fixed bottom-6 right-6 z-50 h-12 w-12 min-h-12 min-w-12 rounded-full border-2 border-border bg-[#c90084] text-white shadow-lg shadow-black/30 hover:bg-[#c90084] transition-transform transition-shadow duration-150 ease-out"
        aria-label="Add character"
      >
        <GrUserAdd className="h-5 w-5" />
      </Button>
    </>
  );
}
