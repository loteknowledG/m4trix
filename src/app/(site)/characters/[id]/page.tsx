'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { ContentLayout } from '@/components/admin-panel/content-layout';

type Agent = {
  id: string;
  name: string;
  description: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';

export default function AgentDetailPage() {
  const params = useParams();
  const rawAgentId = params?.id;
  const agentId = Array.isArray(rawAgentId) ? rawAgentId[0] ?? '' : rawAgentId ?? '';
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      if (!mounted) return;
      const found = (stored || []).find(a => a.id === agentId);

      if (found) {
        setAgent(found);
        setNameValue(found.name);
        setDescriptionValue(found.description);
        setIsEditingName(found.name.trim() === '');
      } else {
        const newAgent = { id: agentId, name: '', description: '' };
        const next = (stored ?? []).concat(newAgent);
        await idbSet(AGENTS_KEY, next);
        setAgent(newAgent);
        setNameValue('');
        setDescriptionValue('');
        setIsEditingName(true);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [agentId]);

  if (loading) {
    return (
      <ContentLayout title="Agent" navLeft={null}>
        <p>Loading...</p>
      </ContentLayout>
    );
  }

  if (!agent) {
    return (
      <ContentLayout title="Character not found" navLeft={null}>
        <p>Character '{agentId}' not found.</p>
        <Link href="/characters/list">
          <Button>Back to characters list</Button>
        </Link>
      </ContentLayout>
    );
  }

  const saveAgent = async () => {
    if (!agent) return;
    const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
    const trimmedName = nameValue.trim() || 'Untitled';
    const trimmedDescription = descriptionValue.trim();
    const updated = (stored ?? []).map(a =>
      a.id === agent.id
        ? {
            ...a,
            name: trimmedName,
            description: trimmedDescription,
          }
        : a
    );
    await idbSet(AGENTS_KEY, updated);
    setAgent({
      ...agent,
      name: trimmedName,
      description: trimmedDescription,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('characters-updated'));
    }
  };

  const handleNameCommit = async () => {
    setIsEditingName(false);
    await saveAgent();
  };

  return (
    <ContentLayout title={`Character: ${agent.name || 'Untitled'}`} navLeft={null}>
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-5">
          {isEditingName ? (
            <input
              className="w-full text-5xl font-light bg-transparent border border-zinc-600 rounded px-3 py-2"
              placeholder="Add name"
              value={nameValue}
              onChange={e => setNameValue(e.target.value)}
              onBlur={handleNameCommit}
              onKeyDown={async e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  await handleNameCommit();
                }
                if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setNameValue(agent.name || '');
                }
              }}
              autoFocus
            />
          ) : (
            <h1
              className="text-5xl font-light cursor-pointer"
              onClick={() => setIsEditingName(true)}
            >
              {nameValue.trim() ? nameValue : 'Untitled'}
            </h1>
          )}
          <textarea
            className="mt-4 w-full rounded border border-zinc-700 p-2 bg-zinc-900 text-sm"
            value={descriptionValue}
            onChange={e => setDescriptionValue(e.target.value)}
            onBlur={saveAgent}
            placeholder="No description"
            rows={3}
          />
        </div>
        <div className="flex gap-2">
          <Link href="/characters/list">
            <Button variant="secondary">Back to list</Button>
          </Link>
          <Link href={`/characters/${agent.id}/chat`}>
            <Button>Open chat</Button>
          </Link>
        </div>
      </div>
    </ContentLayout>
  );
}
