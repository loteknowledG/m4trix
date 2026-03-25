'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

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
    window.dispatchEvent(new Event('agents-updated'));
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
    window.dispatchEvent(new Event('agents-updated'));
  };

  const agentCount = useMemo(() => agents.length, [agents]);

  return (
    <ContentLayout title="Agents" navLeft={null}>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Agents</h1>
            <p className="text-sm text-muted-foreground">
              Stories-style list with detail/chat routes.
            </p>
          </div>
          <span className="rounded bg-zinc-900 px-3 py-1 text-xs text-muted-foreground">
            {agentCount} agents
          </span>
        </div>

        {agents.length === 0 ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-8 text-center text-sm text-muted-foreground">
            No agents yet. Add one above.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {agents.map(agent => (
              <Card key={agent.id} className="transition hover:shadow-lg">
                <CardHeader>
                  <CardTitle>
                    <Link href="/agents/list" className="text-lg font-bold hover:text-primary">
                      {agent.name || 'untitled'}
                    </Link>
                  </CardTitle>
                  <CardDescription>{agent.description || 'No description'}</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <Link
                      href="/agents/list"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Details
                    </Link>
                    <Link
                      href={`/agents/${agent.id}/chat`}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Chat
                    </Link>
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => removeAgent(agent.id)}>
                    Delete
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </ContentLayout>
  );
}
