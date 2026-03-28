import type { MutableRefObject, RefObject } from 'react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { AgentCard } from '@/components/agent-card';
import { cn } from '@/lib/utils';
import { Trash2, User } from 'lucide-react';
import type { Agent, AgentId } from './types';

type ImportedAgent = { label: string; description: string };

type CharactersSidebarProps = {
  agents: Agent[];
  dragOverId: string | null;
  isRunning: boolean;
  onAgentAvatarUpload: (file: File, id: AgentId) => void;
  onAgentDelete: (id: AgentId) => void;
  onAgentImportMarkdown: (file: File, id: AgentId) => Promise<ImportedAgent | null>;
  onAgentNameChange: (id: AgentId, name: string) => void;
  onAgentDescriptionChange: (id: AgentId, description: string) => void;
  onAgentExport: (agent: Agent) => void;
  onPrompterAgentChange: (agent: Agent | null) => void;
  onPrompterAvatarUpload: (file: File) => void;
  onPrompterImportMarkdown: (file: File) => Promise<ImportedAgent | null>;
  onPrompterNameChange: (name: string) => void;
  onPrompterDescriptionChange: (description: string) => void;
  onPrompterExport: () => void;
  onPrompterRemove: () => void;
  onRestartSituation: () => void;
  onStoryChange: (value: string) => void;
  personaRef: MutableRefObject<HTMLDivElement | null>;
  prompterAgent: Agent | null;
  showBackstory: boolean;
  sidebarOpen: boolean;
  sidebarScrollRef: MutableRefObject<HTMLDivElement | null>;
  story: string;
  storyTextareaRef: MutableRefObject<HTMLTextAreaElement | null>;
  toggleBackstory: () => void;
};

export function CharactersSidebar({
  agents,
  dragOverId,
  isRunning,
  onAgentAvatarUpload,
  onAgentDelete,
  onAgentDescriptionChange,
  onAgentExport,
  onAgentImportMarkdown,
  onAgentNameChange,
  onPrompterAgentChange,
  onPrompterAvatarUpload,
  onPrompterDescriptionChange,
  onPrompterExport,
  onPrompterImportMarkdown,
  onPrompterNameChange,
  onPrompterRemove,
  onRestartSituation,
  onStoryChange,
  personaRef,
  prompterAgent,
  showBackstory,
  sidebarOpen,
  sidebarScrollRef,
  story,
  storyTextareaRef,
  toggleBackstory,
}: CharactersSidebarProps) {
  return (
    <aside
      className={cn(
        'flex flex-col gap-4 self-stretch h-full min-h-0 overflow-hidden rounded-xl border bg-background/40 p-4 transition-all duration-300 ease-in-out max-h-[calc(100vh_-_var(--app-header-height,_56px)_-_48px)]',
        sidebarOpen ? 'w-[300px] opacity-100' : 'w-0 p-0 border-0 opacity-0 pointer-events-none'
      )}
    >
      <div
        ref={sidebarScrollRef as unknown as RefObject<HTMLDivElement>}
        className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-zinc-900"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Characters
            </p>
          </div>
        </div>

        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <p className="text-[11px] text-muted-foreground">
              No characters in the team. Import or add one to get started!
            </p>
          </div>
        ) : (
          agents.map(agent => (
            <AgentCard
              key={agent.id}
              name={agent.name}
              description={agent.description}
              avatarUrl={agent.avatarUrl}
              avatarCrop={agent.avatarCrop}
              dragOverId={dragOverId}
              onAvatarUpload={file => onAgentAvatarUpload(file, agent.id)}
              onImport={async file => {
                if (file.type.startsWith('image/')) {
                  onAgentAvatarUpload(file, agent.id);
                  toast.success(`Profile picture imported for "${agent.name || 'Agent'}".`);
                  return;
                }

                const imported = await onAgentImportMarkdown(file, agent.id);
                if (!imported) return;
                onAgentNameChange(agent.id, imported.label);
                onAgentDescriptionChange(agent.id, imported.description);
                toast.success(`Agent "${imported.label}" imported successfully!`);
              }}
              onExport={() => {
                onAgentExport(agent);
              }}
              onDelete={() => onAgentDelete(agent.id)}
              onNameChange={name => onAgentNameChange(agent.id, name)}
              onDescriptionChange={description => onAgentDescriptionChange(agent.id, description)}
              isUser={false}
            />
          ))
        )}

        <div ref={personaRef as unknown as RefObject<HTMLDivElement>} className="mt-6 border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Prompter
            </p>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                onClick={toggleBackstory}
              >
                <User className="h-3 w-3" />
                {showBackstory ? 'Hide Story' : 'Set Story'}
              </button>

              <button
                className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-destructive hover:text-destructive/80 transition-colors"
                onClick={onRestartSituation}
                title="Restart conversation (keeps backstory)"
              >
                <Trash2 className="h-3 w-3" />
                Restart
              </button>
            </div>
          </div>

          {showBackstory && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 rounded-lg border bg-background/60 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Your Persona
                  </p>
                </div>
                <AgentCard
                  name={prompterAgent?.name || ''}
                  description={prompterAgent?.description || ''}
                  avatarUrl={prompterAgent?.avatarUrl}
                  avatarCrop={prompterAgent?.avatarCrop}
                  dragOverId={dragOverId}
                  onAvatarUpload={onPrompterAvatarUpload}
                  onImport={async file => {
                    if (file.type.startsWith('image/')) {
                      onPrompterAvatarUpload(file);
                      toast.success('Profile picture imported for Prompter.');
                      return;
                    }

                    const imported = await onPrompterImportMarkdown(file);
                    if (!imported) return;
                    onPrompterAgentChange({
                      id: 'user-agent',
                      name: imported.label,
                      description: imported.description,
                      avatarUrl: prompterAgent?.avatarUrl || '',
                    });
                    toast.success(`Prompter "${imported.label}" imported successfully!`);
                  }}
                  onExport={onPrompterExport}
                  onNameChange={name => onPrompterNameChange(name)}
                  onDescriptionChange={description => onPrompterDescriptionChange(description)}
                  onRemove={onPrompterRemove}
                  isUser={true}
                />
              </div>

              <div className="flex flex-col gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Global Story Context
                </p>
                <Textarea
                  ref={storyTextareaRef as unknown as RefObject<HTMLTextAreaElement>}
                  autoComplete="off"
                  className="min-h-[80px] bg-muted/30 text-[11px] placeholder:italic"
                  disabled={isRunning}
                  onChange={e => onStoryChange(e.target.value)}
                  placeholder="Provide global story context or character details for the characters..."
                  value={story}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
