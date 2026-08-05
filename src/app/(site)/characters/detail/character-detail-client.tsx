'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { HeaderBackButton } from '@/components/ui/header-back-button';
import { Trash2, ImagePlus, User } from '@/components/icons';
import { getImageFileFromPasteEvent } from '@/lib/clipboard-image';
import { readStorageKey, writeStorageKey } from '@/lib/storage-ready';
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
  const backNav = <HeaderBackButton href="/characters/list" label="Back to characters" />;
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descriptionValue, setDescriptionValue] = useState('');
  const [dialogStyle, setDialogStyle] = useState<CharacterDialogStyle>({});
  const [ttsVoice, setTtsVoice] = useState<CharacterTtsVoice>(resolveCharacterTtsVoice(null));
  const [avatarDragActive, setAvatarDragActive] = useState(false);
  const lastSavedStyleRef = useRef<string>('');
  const agentRef = useRef<Agent | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const persistQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    agentRef.current = agent;
  }, [agent]);

  const persistAgentRecord = useCallback(async (record: Agent) => {
    const persist = async () => {
      const stored = (await readStorageKey<Agent[]>(AGENTS_KEY)) as Agent[] | undefined;
      const trimmedName = nameValue.trim() || 'Untitled';
      const trimmedDescription = descriptionValue.trim();
      const normalizedDialogStyle = normalizeCharacterDialogStyle(dialogStyle);
      const normalizedTtsVoice = normalizeCharacterTtsVoice(ttsVoice);
      const latest = agentRef.current?.id === record.id ? agentRef.current : null;
      const saved: Agent = {
        ...(latest ?? record),
        ...record,
        name: trimmedName,
        description: trimmedDescription,
        dialogStyle: normalizedDialogStyle,
        ttsVoice: normalizedTtsVoice,
        ttsProfile: undefined,
      };
      if (record.avatarUrl !== undefined) {
        saved.avatarUrl = record.avatarUrl;
      }
      if ('avatarCrop' in record) {
        saved.avatarCrop = record.avatarCrop;
      }
      const updated = (stored ?? []).map(a => (a.id === saved.id ? saved : a));
      await writeStorageKey(AGENTS_KEY, updated);
      agentRef.current = saved;
      setAgent(saved);
      lastSavedStyleRef.current = JSON.stringify({
        dialogStyle: normalizedDialogStyle ?? {},
        ttsVoice: normalizedTtsVoice,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('characters-updated'));
      }
    };

    persistQueueRef.current = persistQueueRef.current.then(persist, persist);
    await persistQueueRef.current;
  }, [descriptionValue, dialogStyle, nameValue, ttsVoice]);

  const updateAgentAvatar = useCallback(
    async (id: string, updates: Partial<Pick<Agent, 'avatarUrl' | 'avatarCrop'>>) => {
      const current = agentRef.current ?? agent;
      if (!current || current.id !== id) {
        throw new Error('Character not ready to save avatar.');
      }
      if (saveTimerRef.current != null) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      const next: Agent = { ...current, ...updates };
      agentRef.current = next;
      setAgent(next);

      try {
        await persistAgentRecord(next);
        toast.success(
          updates.avatarCrop ? 'Animated avatar crop saved.' : 'Avatar portrait updated.',
        );
      } catch (error) {
        agentRef.current = current;
        setAgent(current);
        throw error;
      }
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
    isApplying,
    isGif,
    isHoveringEdge,
    setCrop,
    setIsHoveringEdge,
  } = useAvatarCropper<Agent>({
    updateAgent: updateAgentAvatar,
    updatePrompterAgent: () => {},
  });

  const saveAgent = useCallback(async (updatedAgent?: Agent) => {
    const currentAgent = updatedAgent ?? agentRef.current ?? agent;
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
      saveTimerRef.current = null;
      void saveAgent();
    }, 350);
    saveTimerRef.current = saveTimer;

    return () => {
      window.clearTimeout(saveTimer);
      if (saveTimerRef.current === saveTimer) {
        saveTimerRef.current = null;
      }
    };
  }, [agent, dialogStyle, loading, saveAgent, ttsVoice]);

  useEffect(() => {
    if (!agentId) {
      setLoading(false);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    (async () => {
      try {
        const stored = (await readStorageKey<Agent[]>(AGENTS_KEY)) as Agent[] | undefined;
        if (cancelled) return;
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
          await writeStorageKey(AGENTS_KEY, next);
          if (cancelled) return;
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
      } catch (error) {
        if (cancelled) return;
        console.error('[character-detail] failed to load agent', error);
        setAgent(null);
        setLoadError(
          error instanceof Error ? error.message : 'Failed to load character from local storage.',
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [agentId, loadAttempt]);

  if (!agentId) {
    return (
      <ContentLayout
        title="Character"
        navLeft={backNav}
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
        navLeft={backNav}
      >
        <p className="text-sm text-muted-foreground">Loading character…</p>
      </ContentLayout>
    );
  }

  if (loadError) {
    return (
      <ContentLayout
        title="Character"
        navLeft={backNav}
      >
        <div className="space-y-4">
          <p className="text-sm text-red-300">{loadError}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => setLoadAttempt(attempt => attempt + 1)}>
              Retry
            </Button>
            <Link href="/characters/list">
              <Button variant="outline">Back to characters list</Button>
            </Link>
          </div>
        </div>
      </ContentLayout>
    );
  }

  if (!agent) {
    return (
      <ContentLayout
        title="Character not found"
        navLeft={backNav}
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
      const stored = (await readStorageKey<Agent[]>(AGENTS_KEY)) as Agent[] | undefined;
      const nextAgents = (stored ?? []).filter(a => a.id !== agent.id);
      await writeStorageKey(AGENTS_KEY, nextAgents);

      const currentTrash = (await readStorageKey<Agent[]>('trash-characters')) as Agent[] | undefined;
      const removed = stored?.find(a => a.id === agent.id) ?? agent;
      await writeStorageKey('trash-characters', currentTrash ? [...currentTrash, removed] : [removed]);
      window.dispatchEvent(new Event('characters-updated'));
      router.push('/characters/list');
    } catch (err) {
      console.error('Failed to delete character', err);
    }
  };

  const navLeft = backNav;

  const navRight = (
    <button
      type="button"
      onClick={() => {
        void handleDeleteAgent();
      }}
      aria-label="Delete character"
      title="Delete character"
      className={cn(
        'm4-paper-card inline-flex h-9 w-9 items-center justify-center rounded-full',
        'border border-destructive/30 bg-background text-destructive',
        'hover:bg-destructive/10',
      )}
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );

  const avatarDisplayKey = [
    agent.avatarUrl ?? '',
    agent.avatarCrop?.x ?? 0,
    agent.avatarCrop?.y ?? 0,
    agent.avatarCrop?.zoom ?? 1,
  ].join(':');

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
                      key={avatarDisplayKey}
                      src={agent.avatarUrl}
                      alt=""
                      draggable={false}
                      className="pointer-events-none h-full w-full max-w-none object-contain"
                      style={avatarCropPortraitStyle(agent.avatarCrop, PORTRAIT_SIZE_PX)}
                    />
                  </div>
                ) : (
                  <img
                    key={avatarDisplayKey}
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
        isApplying={isApplying}
        isHoveringEdge={isHoveringEdge}
        setIsHoveringEdge={setIsHoveringEdge}
        onApplyCrop={handleApplyCrop}
        onApplyGifImmediately={applyGifImmediately}
        onClose={clearCropper}
      />
    </ContentLayout>
  );
}
