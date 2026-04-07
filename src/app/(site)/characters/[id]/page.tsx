'use client';

import Link from 'next/link';
import { useEffect, useState, DragEvent } from 'react';
import { useParams } from 'next/navigation';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { QuillEditor } from '@/components/quill-editor';
import { cn } from '@/lib/utils';

type Agent = {
  id: string;
  name: string;
  description: string;
  avatarUrl?: string;
  avatarCrop?: {
    x: number;
    y: number;
    zoom: number;
  };
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
  const [isDragActive, setIsDragActive] = useState(false);
  const [avatarCrop, setAvatarCrop] = useState({ x: 0, y: 0, zoom: 1 });

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
        const newAgent = {
          id: agentId,
          name: '',
          description: '',
          avatarUrl: undefined,
          avatarCrop: { x: 0, y: 0, zoom: 1 },
        };
        const next = (stored ?? []).concat(newAgent);
        await idbSet(AGENTS_KEY, next);
        setAgent(newAgent);
        setNameValue('');
        setDescriptionValue('');
        setAvatarCrop({ x: 0, y: 0, zoom: 1 });
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

  const saveAgent = async (updatedAgent?: Agent) => {
    if (!agent && !updatedAgent) return;
    const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
    const currentAgent = updatedAgent ?? agent;
    if (!currentAgent) return;
    const trimmedName = nameValue.trim() || 'Untitled';
    const trimmedDescription = descriptionValue.trim();
    const updated = (stored ?? []).map(a =>
      a.id === currentAgent.id
        ? {
            ...a,
            name: trimmedName,
            description: trimmedDescription,
            avatarUrl: currentAgent.avatarUrl,
          }
        : a
    );
    await idbSet(AGENTS_KEY, updated);
    const nextAgent = {
      ...currentAgent,
      name: trimmedName,
      description: trimmedDescription,
      avatarUrl: currentAgent.avatarUrl,
      avatarCrop: avatarCrop,
    };

    setAgent(nextAgent);
    setAvatarCrop(currentAgent.avatarCrop ?? { x: 0, y: 0, zoom: 1 });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('characters-updated'));
    }
  };

  const persistAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const dataUrl = event.target?.result as string;
      if (!agent) return;
      const updatedAgent = {
        ...agent,
        avatarUrl: dataUrl,
      };
      setAgent(updatedAgent);
      await saveAgent(updatedAgent);
    };
    reader.readAsDataURL(file);
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      persistAvatar(file);
    }
  };

  const handleNameCommit = async () => {
    setIsEditingName(false);
    await saveAgent();
  };

  return (
    <ContentLayout title="" navLeft={null}>
      <div className="flex h-[calc(100vh_-_var(--app-header-height,_56px)_-_4rem)] min-h-0 flex-col overflow-hidden">
        <div
          className={cn(
            'flex-1 min-h-0 overflow-y-auto rounded-lg border border-dashed p-6',
            isDragActive ? 'border-primary bg-primary/10' : 'border-transparent'
          )}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="w-full space-y-4">
          {isEditingName ? (
            <input
              className="w-full text-5xl font-light bg-transparent border border-zinc-600 rounded px-3 py-2"
              placeholder="Add name"
              aria-label="Character name"
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
          <QuillEditor
            className="character-description-editor"
            value={descriptionValue}
            onChange={setDescriptionValue}
            onBlur={() => {
              void saveAgent();
            }}
            placeholder="No description"
          />
          {agent?.avatarUrl && (
            <div className="mx-auto relative mt-4 h-56 w-56 overflow-hidden rounded-lg border border-zinc-700">
              <img
                src={agent.avatarUrl}
                alt="Character avatar"
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </div>
      </div>
      </div>
    </ContentLayout>
  );
}
