'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { logger } from '@/lib/logger';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { SquarePen, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Marquee } from '@/components/ui/marquee';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { MomentMedia } from '@/components/moment-media';
import {
  createEmptyStory,
  moveStoriesToTrash,
  storyEditorHref,
  storyPreviewMap,
  type StoryMeta,
} from '@/lib/stories';
import { toast } from 'sonner';

export default function StoriesPage() {
  const router = useRouter();
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [selectedStories, setSelectedStories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const selectedStoryIds = Object.keys(selectedStories).filter(id => selectedStories[id]);

  const toggleStorySelection = (storyId: string, selected: boolean) => {
    setSelectedStories(prev => ({
      ...prev,
      [storyId]: selected,
    }));
  };

  const createNewStory = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const meta = await createEmptyStory();
      setStories(prev => [meta, ...prev.filter(story => story.id !== meta.id)]);
      setPreviews(prev => ({ ...prev, [meta.id]: null }));
      router.push(storyEditorHref(meta.id));
    } catch (err) {
      logger.error('Failed to create story', err);
    } finally {
      setCreating(false);
    }
  };

  const moveSelectedToTrash = useCallback(async () => {
    const ids = Object.keys(selectedStories).filter((id) => selectedStories[id]);
    if (ids.length === 0) return;

    const ok =
      typeof window !== 'undefined'
        ? window.confirm(
            ids.length === 1
              ? 'Move this story to trash?'
              : `Move ${ids.length} stories to trash?`,
          )
        : true;
    if (!ok) return;

    try {
      const moved = await moveStoriesToTrash(ids);
      if (moved === 0) {
        toast.error('Could not move stories — try refreshing the page');
        return;
      }

      setStories((prev) => prev.filter((story) => !ids.includes(story.id)));
      setSelectedStories({});
      setPreviews((prev) => {
        const next = { ...prev };
        ids.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      toast.success(moved === 1 ? 'Story moved to trash' : `${moved} stories moved to trash`);
    } catch (err) {
      logger.error('Failed to move selected stories to trash', err);
      toast.error('Failed to move stories to trash');
    }
  }, [selectedStories]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<StoryMeta[]>('stories')) || [];
        if (!mounted) return;
        setStories(saved);
        setPreviews(storyPreviewMap(saved));
      } catch (err) {
        logger.error('Failed to load stories', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const reload = async () => {
      try {
        const saved = (await get<StoryMeta[]>('stories')) || [];
        setStories(saved);
        setPreviews(storyPreviewMap(saved));
      } catch (err) {
        logger.error('Failed to reload stories', err);
      }
    };
    window.addEventListener('stories-updated', reload);
    return () => window.removeEventListener('stories-updated', reload);
  }, []);

  useEffect(() => {
    const prev = document.title;
    document.title = 'm4trix - stories';
    return () => {
      document.title = prev ?? 'm4trix';
    };
  }, []);

  return (
    <>
      <ContentLayout
        title="Stories"
        navLeft={null}
        navRight={
          selectedStoryIds.length > 0 ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void moveSelectedToTrash();
                    }}
                    className="m4-circle-action bg-destructive/10 text-destructive hover:bg-destructive/20"
                    aria-label="Move to Trash"
                  >
                    <Trash2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10}>
                  <p>Move to Trash</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null
        }
      >
        <div
          className="overflow-auto"
          style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}
        >
          <div className="py-4">
            {loading ? (
              <div className="text-sm text-muted-foreground">Loading…</div>
            ) : stories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No stories yet. Tap + to create one.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stories.map(s => (
                  <Card
                    key={s.id}
                    className={`group relative overflow-hidden transition-shadow duration-150 transition-transform duration-150 ease-out hover:shadow-2xl hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-0.5 active:translate-x-0.5 ${
                      selectedStories[s.id] ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="relative aspect-square">
                      <label
                        className={`absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-white/70 bg-black/45 transition-opacity ${
                          selectedStories[s.id] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 cursor-pointer accent-primary"
                          checked={Boolean(selectedStories[s.id])}
                          onClick={e => e.stopPropagation()}
                          onChange={e => toggleStorySelection(s.id, e.target.checked)}
                          aria-label={`Select ${s.title && s.title.trim() ? s.title : 'Untitled'}`}
                        />
                      </label>
                      <Link
                        href={storyEditorHref(s.id)}
                        className="block h-full w-full"
                      >
                        <span className="sr-only">
                          Open {s.title && s.title.trim() ? s.title : 'Untitled'}
                        </span>
                        {previews[s.id] ? (
                          <MomentMedia
                            src={previews[s.id]!}
                            alt={s.title ?? 'story'}
                            className="w-full h-full object-cover"
                            autoPlay
                          />
                        ) : (
                          <div className="h-full w-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm text-muted-foreground">
                            No preview
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-2">
                          <div className="flex flex-col">
                            <Marquee className="font-medium text-white truncate">
                              {s.title && s.title.trim() ? s.title : 'Untitled'}
                            </Marquee>
                            <div className="text-xs text-white">{s.count ?? 0}</div>
                          </div>
                        </div>
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ContentLayout>

      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => void createNewStory()}
              size="icon"
              variant="raised"
              disabled={creating}
              className="pushable-effect pushable-wall-neutral pointer-events-auto fixed bottom-6 right-6 z-50 h-12 w-12 min-h-12 min-w-12 rounded-full border-2 border-border bg-[#c90084] text-white shadow-lg shadow-black/30 hover:bg-[#c90084] transition-transform transition-shadow duration-150 ease-out disabled:opacity-70"
              aria-label="New story"
            >
              <SquarePen className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>New story</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
