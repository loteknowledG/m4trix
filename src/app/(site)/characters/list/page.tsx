'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Pressable } from '@/components/ui/pressable';
import { Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Marquee } from '@/components/ui/marquee';
import { GrUserAdd } from 'react-icons/gr';

type Agent = {
  id: string;
  name: string;
  description: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';
const SELECTED_AGENT_KEY = 'PLAYGROUND_SELECTED_AGENT_ID';

export default function AgentsListPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      const storedSelected = (await idbGet(SELECTED_AGENT_KEY)) as string | undefined;
      if (!mounted) return;

      if (stored && Array.isArray(stored)) {
        setAgents(stored);
        if (storedSelected && stored.some(agent => agent.id === storedSelected)) {
          setSelectedAgentId(storedSelected);
        } else if (stored.length > 0) {
          setSelectedAgentId(stored[0].id);
        }
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
    router.push(`/characters/${newAgent.id}`);
  };

  const moveAgentToTrash = async (id: string) => {
    const removed = agents.find(a => a.id === id);
    if (!removed) return;

    // Remove from active characters
    const nextAgents = agents.filter(a => a.id !== id);
    await saveAgents(nextAgents);

    // Persist into trash-characters (new bucket)
    try {
      const currentTrash = (await idbGet('trash-characters')) as Agent[] | undefined;
      await idbSet('trash-characters', currentTrash ? [...currentTrash, removed] : [removed]);
    } catch (e) {
      /* ignore
       * In case this app does not currently use trash-characters, at least we still remove from active list.
       */
    }

    if (selectedAgentId === id) {
      setSelectedAgentId(nextAgents.length > 0 ? nextAgents[0].id : null);
    }
    window.dispatchEvent(new Event('characters-updated'));
  };

  const navRight = selectedAgentId ? (
    <Pressable
      onClick={() => moveAgentToTrash(selectedAgentId)}
      className="w-9 h-9 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title="Move to Trash"
      aria-label="Move selected character to trash"
    >
      <Trash2 size={18} />
    </Pressable>
  ) : null;

  useEffect(() => {
    if (selectedAgentId) {
      void idbSet(SELECTED_AGENT_KEY, selectedAgentId);
    } else {
      void idbSet(SELECTED_AGENT_KEY, null);
    }
  }, [selectedAgentId]);

  return (
    <ContentLayout title="Characters" navLeft={null} navRight={navRight}>
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
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`relative group rounded-xl ${
                    isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                  }`}
                >
                  <div
                    className={`absolute top-2 left-2 z-10 h-6 w-6 rounded-full border-2 border-white/70 bg-black/40 flex items-center justify-center transition-opacity ${
                      isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                    onClick={e => {
                      e.preventDefault();
                      setSelectedAgentId(isSelected ? null : agent.id);
                    }}
                  >
                    <input
                      type="radio"
                      name="agent-selection"
                      checked={isSelected}
                      onChange={() => setSelectedAgentId(agent.id)}
                      className="sr-only"
                      aria-label={isSelected ? 'Selected character' : 'Select character'}
                    />
                    {isSelected ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                  </div>
                  <Link
                    href={`/characters/${agent.id}`}
                    className="block"
                    onClick={() => setSelectedAgentId(isSelected ? null : agent.id)}
                  >
                    <Card
                      className={`overflow-hidden transition-shadow duration-150 cursor-pointer ${
                        isSelected ? 'bg-primary/10 shadow-lg' : 'shadow-sm'
                      }`}
                    >
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
              );
            })}
          </div>
        )}
      </div>

      <Button
        onClick={addAgentViaFab}
        size="icon"
        variant="default"
        className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-shadow duration-150"
        aria-label="Add character"
      >
        <GrUserAdd className="h-5 w-5" />
      </Button>
    </ContentLayout>
  );
}
