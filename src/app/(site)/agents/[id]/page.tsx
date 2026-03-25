'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { get as idbGet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { ContentLayout } from '@/components/admin-panel/content-layout';

type Agent = {
  id: string;
  name: string;
  description: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';

type Props = {
  params: {
    id: string;
  };
};

export default function AgentDetailPage({ params }: Props) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      if (!mounted) return;
      const found = (stored || []).find(a => a.id === params.id);
      setAgent(found || null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [params.id]);

  if (loading) {
    return (
      <ContentLayout title="Agent" navLeft={null}>
        <p>Loading...</p>
      </ContentLayout>
    );
  }

  if (!agent) {
    return (
      <ContentLayout title="Agent not found" navLeft={null}>
        <p>Agent '{params.id}' not found.</p>
        <Link href="/agents/list">
          <Button>Back to agents list</Button>
        </Link>
      </ContentLayout>
    );
  }

  return (
    <ContentLayout title={`Agent: ${agent.name || 'Untitled'}`} navLeft={null}>
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          <h1 className="text-2xl font-bold">{agent.name}</h1>
          <p className="text-sm text-muted-foreground">{agent.description || 'No description'}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/agents/list">
            <Button variant="secondary">Back to list</Button>
          </Link>
          <Link href={`/agents/${agent.id}/chat`}>
            <Button>Open chat</Button>
          </Link>
        </div>
      </div>
    </ContentLayout>
  );
}
