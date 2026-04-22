'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  buildGrokImagePrompt,
  copyTextToClipboard,
  mapCharacterChatToGrokLines,
} from '@/lib/grok-image-prompt';
import type { Agent } from '@/app/(site)/characters/types';
import type { ChatMessage } from '@/app/(site)/characters/types';

const COPY_TOAST =
  'Prompt copied. Paste it to Grok, generate the image, then drag it back here.';

export type GrokImagePromptButtonProps = {
  agents: Agent[];
  prompterAgent: Agent | null;
  messages: ChatMessage[];
  story: string;
  /** Optional: current beat, location, time — from caller if you track it elsewhere */
  sceneContext?: string;
  /** Visual focus; defaults to first agent in `agents` */
  focusAgentId?: string | null;
  /** Max non-empty chat lines in the prompt; omit for no limit (full transcript). */
  maxChatMessages?: number;
  disabled?: boolean;
  className?: string;
};

export function GrokImagePromptButton({
  agents,
  prompterAgent,
  messages,
  story,
  sceneContext,
  focusAgentId,
  maxChatMessages,
  disabled,
  className,
}: GrokImagePromptButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const agentsById = useMemo(() => {
    const acc: Record<string, Agent> = {};
    for (const a of agents) acc[a.id] = a;
    return acc;
  }, [agents]);

  const agentNameById = useMemo(() => {
    const acc: Record<string, string> = {};
    for (const a of agents) acc[a.id] = (a.name || '').trim() || a.id;
    return acc;
  }, [agents]);

  const promptPreview = useMemo(() => {
    const userSpeakerName = (prompterAgent?.name || '').trim() || 'You';
    const chatLines = mapCharacterChatToGrokLines(messages, {
      userSpeakerName,
      agentNameById,
    });
    return buildGrokImagePrompt({
      story,
      sceneContext,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        roleLabel: 'Character',
      })),
      prompterAgent: prompterAgent
        ? {
            id: prompterAgent.id,
            name: prompterAgent.name,
            description: prompterAgent.description,
            roleLabel: 'Prompter',
          }
        : null,
      chatLines,
      ...(maxChatMessages !== undefined ? { maxChatLines: maxChatMessages } : {}),
      focusAgentId,
    });
  }, [
    agents,
    agentNameById,
    focusAgentId,
    maxChatMessages,
    messages,
    prompterAgent,
    sceneContext,
    story,
  ]);

  const handleOpen = () => setOpen(true);

  const handleCopy = async () => {
    setBusy(true);
    try {
      await copyTextToClipboard(promptPreview);
      toast.success(COPY_TOAST, { duration: 9000 });
      setOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not copy to clipboard.';
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        disabled={disabled}
        onClick={handleOpen}
        title="Build a Grok-ready prompt from this chat and copy it"
      >
        Generate Image with Grok
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950 text-zinc-100">
          <DialogHeader>
            <DialogTitle className="text-base">Image prompt for Grok</DialogTitle>
            <DialogDescription className="text-xs text-zinc-400 leading-relaxed">
              m4trix stays local: nothing is sent automatically. The preview is the full prompt—copy
              pastes exactly what you see. Paste into Grok, then save or drag the image back here.
            </DialogDescription>
          </DialogHeader>

          <ol className="list-decimal space-y-1.5 pl-4 text-xs text-zinc-300">
            <li>Click &quot;Copy prompt&quot; below.</li>
            <li>Open Grok and paste the prompt.</li>
            <li>Generate the image there, then drag the file back into m4trix.</li>
          </ol>

          <div className="max-h-[min(50vh,28rem)] overflow-auto rounded-md border border-zinc-800 bg-black/40 p-2 text-[11px] leading-snug text-zinc-400 font-mono whitespace-pre-wrap">
            {promptPreview}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void handleCopy()} disabled={busy}>
              {busy ? 'Copying…' : 'Copy prompt'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
