'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { Button } from '@/components/ui/button';
import { DialogLineStyleEditor } from '@/components/dialog-line-style-editor';
import { CharacterTtsProfileEditor } from '@/components/character-tts-profile-editor';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { DescriptionEditor } from '@/components/description-editor';
import { cn } from '@/lib/utils';
import {
  normalizeCharacterDialogStyle,
  resolveCharacterDialogStyle,
  type CharacterDialogStyle,
} from '@/lib/character-dialog-style';
import {
  normalizeCharacterTtsVoice,
  resolveCharacterTtsVoice,
  type CharacterTtsVoice,
} from '@/lib/character-tts-profile';
import { AvatarCropDialog } from '@/app/(site)/characters/avatar-crop-dialog';
import {
  avatarCropPortraitStyle,
  avatarCropPortraitWorkspacePx,
} from '@/app/(site)/characters/avatar-crop-math';
import { useAvatarCropper } from '@/app/(site)/characters/use-avatar-cropper';
import { Trash2, ChevronLeft, ImagePlus, User } from '@/components/icons';
import { getImageFileFromPasteEvent } from '@/lib/clipboard-image';
import { toast } from 'sonner';

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
  dialogStyle?: CharacterDialogStyle;
  ttsVoice?: CharacterTtsVoice;
  /** @deprecated migrated to ttsVoice */
  ttsProfile?: string;
};

const AGENTS_KEY = 'PLAYGROUND_AGENTS';
const PORTRAIT_SIZE_PX = 160;
const PORTRAIT_WORKSPACE_PX = avatarCropPortraitWorkspacePx(PORTRAIT_SIZE_PX);
const PORTRAIT_WORKSPACE_OFFSET_PX = (PORTRAIT_SIZE_PX - PORTRAIT_WORKSPACE_PX) / 2;

function normalizeDescription(value: string) {
  if (!value) return '';

  return value
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<(?!\/?(img|source|\/?)(?:[^>]|\/(?!>))*?>)/gi, '')
    .replace(/&nbsp;/gi, ' ');
}

export default function CharacterDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const agentId = searchParams.get('id')?.trim() ?? '';
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [dialogStyle, setDialogStyle] = useState<CharacterDialogStyle>({});
  const [ttsVoice, setTtsVoice] = useState<CharacterTtsVoice>(resolveCharacterTtsVoice(null));
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const lastSavedStyleRef = useRef<string>('');

  const persistAgentRecord = useCallback(async (record: Agent) => {
    const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
    const trimmedName = nameValue.trim() || 'Untitled';
    const trimmedDescription = descriptionValue.trim();
    const normalizedDialogStyle = normalizeCharacterDialogStyle(dialogStyle);
    const normalizedTtsVoice = normalizeCharacterTtsVoice(ttsVoice);
    const saved: Agent = {
      ...record,
      name: trimmedName,
      description: trimmedDescription,
      dialogStyle: normalizedDialogStyle,
      ttsVoice: normalizedTtsVoice,
      ttsProfile: undefined,
    };
    const updated = (stored ?? []).map(a => (a.id === saved.id ? saved : a));
    await idbSet(AGENTS_KEY, updated);
    setAgent(saved);
    lastSavedStyleRef.current = JSON.stringify({
      dialogStyle: normalizedDialogStyle ?? {},
      ttsVoice: normalizedTtsVoice,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('characters-updated'));
    }
  }, [descriptionValue, dialogStyle, nameValue, ttsVoice]);

  const updateAgentAvatar = useCallback(
    (id: string, updates: Partial<Pick<Agent, 'avatarUrl' | 'avatarCrop'>>) => {
      if (!agent || agent.id !== id) return;
      void persistAgentRecord({ ...agent, ...updates }).then(() => {
        toast.success('Avatar portrait updated.');
      });
    },
    [agent, persistAgentRecord],
  );

  const {
    applyGifImmediately,
    clearCropper,
    crop,
    croppingImage,
    handleApplyCrop,
    handleAvatarUpload,
    isGif,
    isHoveringEdge,
    setCrop,
    setIsHoveringEdge,
  } = useAvatarCropper<Agent>({
    updateAgent: updateAgentAvatar,
    updatePrompterAgent: () => {},
  });

  const saveAgent = useCallback(async (updatedAgent?: Agent) => {
    if (!agent && !updatedAgent) return;
    const currentAgent = updatedAgent ?? agent;
    if (!currentAgent) return;
    await persistAgentRecord(currentAgent);
  }, [agent, persistAgentRecord]);

  useEffect(() => {
    if (loading || !agent) return;

    const serialized = JSON.stringify({
      dialogStyle: normalizeCharacterDialogStyle(dialogStyle) ?? {},
      ttsVoice: normalizeCharacterTtsVoice(ttsVoice),
    });
    if (serialized === lastSavedStyleRef.current) return;

    const saveTimer = window.setTimeout(() => {
      void saveAgent();
    }, 350);

    return () => window.clearTimeout(saveTimer);
  }, [agent, dialogStyle, loading, saveAgent, ttsVoice]);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    (async () => {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      if (!mounted) return;
      const found = (stored || []).find(a => a.id === agentId);

      if (found) {
        setAgent(found);
        setNameValue(found.name);
        setDescriptionValue(normalizeDescription(found.description));
        const loadedDialogStyle = normalizeCharacterDialogStyle(found.dialogStyle) ?? {};
        const loadedTtsVoice = resolveCharacterTtsVoice(found.ttsVoice, found.ttsProfile);
        setDialogStyle(loadedDialogStyle);
        setTtsVoice(loadedTtsVoice);
        lastSavedStyleRef.current = JSON.stringify({
          dialogStyle: loadedDialogStyle,
          ttsVoice: loadedTtsVoice,
        });
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
        setDialogStyle({});
        setTtsVoice(resolveCharacterTtsVoice(null));
        lastSavedStyleRef.current = JSON.stringify({
          dialogStyle: {},
          ttsVoice: resolveCharacterTtsVoice(null),
        });
        setIsEditingName(true);
      }

      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [agentId]);

  if (!agentId) {
    return (
      <ContentLayout
        title="Character"
        navLeft={
          <Link href="/characters/list">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Back to characters">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <p>Missing character id.</p>
        <Link href="/characters/list">
          <Button>Back to characters list</Button>
        </Link>
      </ContentLayout>
    );
  }

  if (loading) {
    return (
      <ContentLayout
        title="Agent"
        navLeft={
          <Link href="/characters/list">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Back to characters">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <p>Loading...</p>
      </ContentLayout>
    );
  }

  if (!agent) {
    return (
      <ContentLayout
        title="Character not found"
        navLeft={
          <Link href="/characters/list">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Back to characters">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
        }
      >
        <p>Character &apos;{agentId}&apos; not found.</p>
        <Link href="/characters/list">
          <Button>Back to characters list</Button>
        </Link>
      </ContentLayout>
    );
  }

  const queueAvatarPortrait = (file: File) => {
    if (!agent) return;
    handleAvatarUpload(file, agent.id);
    toast.success('Opening avatar crop…');
  };

  const onAvatarDragEnter = (e: DragEvent<HTMLLabelElement>) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    setAvatarDragActive(true);
  };

  const onAvatarDragLeave = (e: DragEvent<HTMLLabelElement>) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setAvatarDragActive(false);
  };

  const onAvatarDragOver = (e: DragEvent<HTMLLabelElement>) => {
    if (!e.dataTransfer?.types || !Array.from(e.dataTransfer.types).includes('Files')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setAvatarDragActive(true);
  };

  const onAvatarDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setAvatarDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      queueAvatarPortrait(file);
    }
  };

  const handleNameCommit = async () => {
    setIsEditingName(false);
    await saveAgent();
  };

  const handleDeleteAgent = async () => {
    if (!agent) return;
    const confirmed =
      typeof window === 'undefined'
        ? true
        : window.confirm(`Delete ${agent.name.trim() ? agent.name : 'this character'}? This cannot be undone.`);
    if (!confirmed) return;

    try {
      const stored = (await idbGet(AGENTS_KEY)) as Agent[] | undefined;
      const nextAgents = (stored ?? []).filter(a => a.id !== agent.id);
      await idbSet(AGENTS_KEY, nextAgents);

      const currentTrash = (await idbGet('trash-characters')) as Agent[] | undefined;
      const removed = stored?.find(a => a.id === agent.id) ?? agent;
      await idbSet('trash-characters', currentTrash ? [...currentTrash, removed] : [removed]);
      window.dispatchEvent(new Event('characters-updated'));
      router.push('/characters/list');
    } catch (err) {
      console.error('Failed to delete character', err);
    }
  };

  const navLeft = (
    <Link href="/characters/list">
      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label="Back to characters">
        <ChevronLeft className="h-4 w-4" />
      </Button>
    </Link>
  );

  const navRight = (
    <Button
      variant="destructive"
      size="icon"
      onClick={() => {
        void handleDeleteAgent();
      }}
      aria-label="Delete character"
      title="Delete character"
      className="h-9 w-9 rounded-full"
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );

  return (
    <ContentLayout title="" navLeft={navLeft} navRight={navRight}>
      <div className="flex h-[calc(100vh_-_var(--app-header-height,_56px)_-_4rem)] min-h-0 flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto rounded-lg p-6">
          <div className="w-full space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1">
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
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2 sm:items-end">
              <span className="text-xs font-medium text-zinc-400">Avatar portrait</span>
            <label
              className={cn(
                'group relative flex h-40 w-40 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/60',
                'border-zinc-600/80 bg-zinc-950/40 hover:border-zinc-500',
                avatarDragActive &&
                  'border-cyan-400 border-solid bg-cyan-500/15 shadow-[0_0_0_2px_rgba(34,211,238,0.45)] ring-2 ring-cyan-300/50',
              )}
              tabIndex={0}
              title="Drop an image to set avatar portrait, paste from clipboard, or click to choose a file"
              onPaste={e => {
                const file = getImageFileFromPasteEvent(e);
                if (!file) return;
                e.preventDefault();
                queueAvatarPortrait(file);
              }}
              onDragEnter={onAvatarDragEnter}
              onDragLeave={onAvatarDragLeave}
              onDragOver={onAvatarDragOver}
              onDrop={onAvatarDrop}
            >
              {agent.avatarUrl ? (
                agent.avatarCrop ? (
                  <div
                    className="absolute aspect-square"
                    style={{
                      width: PORTRAIT_WORKSPACE_PX,
                      height: PORTRAIT_WORKSPACE_PX,
                      left: PORTRAIT_WORKSPACE_OFFSET_PX,
                      top: PORTRAIT_WORKSPACE_OFFSET_PX,
                    }}
                  >
                    <img
                      src={agent.avatarUrl}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full max-w-none object-contain"
                      style={avatarCropPortraitStyle(agent.avatarCrop, PORTRAIT_SIZE_PX)}
                    />
                  </div>
                ) : (
                  <img
                    src={agent.avatarUrl}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )
              ) : (
                <User className="h-14 w-14 text-zinc-600" aria-hidden />
              )}
              <div
                className={cn(
                  'absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-3 text-center transition-opacity',
                  avatarDragActive
                    ? 'bg-cyan-950/80 opacity-100'
                    : agent.avatarUrl
                      ? 'bg-black/50 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
                      : 'bg-black/25 opacity-100',
                )}
              >
                <ImagePlus
                  className={cn(
                    'h-7 w-7 text-zinc-300 drop-shadow',
                    avatarDragActive && 'text-cyan-100',
                  )}
                />
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wide text-zinc-300',
                    avatarDragActive && 'text-cyan-50',
                  )}
                >
                  {avatarDragActive ? 'Drop portrait' : 'Avatar portrait'}
                </span>
                <span className="text-[9px] leading-tight text-zinc-400">
                  Drop, click, or paste
                </span>
              </div>
              <input
                type="file"
                className="hidden"
                accept="image/*"
                aria-label="Upload avatar portrait"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) queueAvatarPortrait(file);
                  e.target.value = '';
                }}
              />
            </label>
            </div>
          </div>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium text-zinc-300">Description & dialog style</h2>
              <p className="text-xs text-zinc-500">
                Edit the description on the left — styling updates live as you adjust controls.
              </p>
            </div>
            <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
              <DescriptionEditor
                className="character-description-editor lg:sticky lg:top-4"
                value={descriptionValue}
                onChange={setDescriptionValue}
                onBlur={() => {
                  void saveAgent();
                }}
                placeholder="No description"
                dialogStyle={dialogStyle}
              />
              <DialogLineStyleEditor
                values={resolveCharacterDialogStyle(dialogStyle)}
                onChange={patch => {
                  setDialogStyle(prev => ({ ...prev, ...patch }));
                }}
              />
              <CharacterTtsProfileEditor
                value={ttsVoice}
                previewText={
                  nameValue.trim()
                    ? `Hello. I'm ${nameValue.trim()}. This is how I will sound.`
                    : undefined
                }
                onChange={setTtsVoice}
              />
            </div>
          </section>
        </div>
      </div>
      </div>

      <AvatarCropDialog
        open={Boolean(croppingImage)}
        croppingImage={croppingImage}
        crop={crop}
        setCrop={setCrop}
        isGif={isGif}
        isHoveringEdge={isHoveringEdge}
        setIsHoveringEdge={setIsHoveringEdge}
        onApplyCrop={handleApplyCrop}
        onApplyGifImmediately={applyGifImmediately}
        onClose={clearCropper}
      />
    </ContentLayout>
  );
}
