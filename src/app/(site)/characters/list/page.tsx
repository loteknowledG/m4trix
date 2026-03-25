'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Marquee } from '@/components/ui/marquee';

type Agent = {
  id: string;
  name: string;
  description: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';

export default function AgentsListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);

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

  const addAgent = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Agent name is required');
      return;
    }

    const next: Agent = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: trimmedName,
      description: description.trim(),
    };

    setName('');
    setDescription('');
    setError(null);
    await saveAgents([...agents, next]);
  };

  const removeAgent = async (id: string) => {
    await saveAgents(agents.filter(a => a.id !== id));
    window.dispatchEvent(new Event('characters-updated'));
  };

  const agentCount = useMemo(() => agents.length, [agents]);

  return (
    <ContentLayout title="Characters" navLeft={null}>
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
            {agents.map(agent => (
              <div key={agent.id} className="relative group">
                <Link href={`/characters/${agent.id}`} className="block">
                  <Card className="overflow-hidden hover:shadow-2xl transition-shadow duration-150 transition-transform duration-150 ease-out hover:-translate-y-2 hover:-translate-x-2 active:translate-y-2 active:translate-x-2 cursor-pointer">
                    <div className="relative aspect-square">
                      <div className="h-full w-full bg-zinc-900 dark:bg-zinc-800" />
                      <div className="absolute inset-0 flex flex-col justify-end p-3 bg-gradient-to-t from-black/65 to-transparent">
                        <Marquee className="font-bold text-lg text-white truncate">
                          {agent.name && agent.name.trim() ? agent.name : 'Untitled'}
                        </Marquee>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </ContentLayout>
  );
}
