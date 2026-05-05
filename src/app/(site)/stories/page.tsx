'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import { logger } from '@/lib/logger';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Trash2 } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Marquee } from '@/components/ui/marquee';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type StoryMeta = { id: string; title?: string; count?: number; titleMomentId?: string };

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [selectedStories, setSelectedStories] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const selectedStoryIds = Object.keys(selectedStories).filter(id => selectedStories[id]);

  const toggleStorySelection = (storyId: string, selected: boolean) => {
    setSelectedStories(prev => ({
      ...prev,
      [storyId]: selected,
    }));
  };

  const moveSelectedToTrash = async () => {
    if (selectedStoryIds.length === 0) return;

    try {
      const selectedSet = new Set(selectedStoryIds);
      const remainingStories = stories.filter(story => !selectedSet.has(story.id));
      const toTrash = stories.filter(story => selectedSet.has(story.id));
      const existingTrash = (await get<StoryMeta[]>('trash-stories')) || [];

      await set('stories', remainingStories);
      await set('trash-stories', [...toTrash, ...existingTrash]);
      await Promise.all(
        selectedStoryIds.map(async id => {
          const storyPayload = await get<any>(`story:${id}`);
          if (storyPayload !== undefined) {
            await set(`trash-story:${id}`, storyPayload);
          }
          await del(`story:${id}`);
        })
      );

      setStories(remainingStories);
      setSelectedStories({});
      setPreviews(prev => {
        const next = { ...prev };
        selectedStoryIds.forEach(id => {
          delete next[id];
        });
        return next;
      });
      window.dispatchEvent(new CustomEvent('stories-updated', { detail: {} }));
    } catch (err) {
      logger.error('Failed to move selected stories to trash', err);
    }
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<StoryMeta[]>('stories')) || [];
        if (!mounted) return;
        setStories(saved);

        // load preview (first item src) for each story
        const previewEntries = await Promise.all(
          saved.map(async s => {
            try {
              const items = (await get<any>(`story:${s.id}`)) || [];
              let src = null;
              // Check for titleMomentId in story meta or object
              const titleMomentId = s.titleMomentId || (items && items.titleMomentId);
              let momentsArr = Array.isArray(items)
                ? items
                : items && Array.isArray(items.items)
                ? items.items
                : [];
              if (titleMomentId && Array.isArray(momentsArr)) {
                const titleMoment = momentsArr.find((m: any) => m.id === titleMomentId);
                src = titleMoment ? titleMoment.src || titleMoment : null;
              }
              // fallback to first moment if no title moment
              if (!src && Array.isArray(momentsArr) && momentsArr.length > 0) {
                src = momentsArr[0].src || momentsArr[0];
              }
              return [s.id, src] as const;
            } catch (e) {
              return [s.id, null] as const;
            }
          })
        );
        if (!mounted) return;
        const map: Record<string, string | null> = {};
        previewEntries.forEach(([id, src]) => (map[id] = src));
        setPreviews(map);
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
                    onClick={moveSelectedToTrash}
                    title="Move selected stories to trash"
                    className="m4-circle-action bg-destructive/10 text-destructive hover:bg-destructive/20"
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
                No stories yet. Create one from the heap.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {stories.map(s => (
                  <Card
                    key={s.id}
                    className={`group overflow-hidden transition-shadow duration-150 transition-transform duration-150 ease-out hover:shadow-2xl hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-0.5 active:translate-x-0.5 ${
                      selectedStories[s.id] ? 'ring-2 ring-primary' : ''
                    }`}
                  >
                    <div className="relative aspect-square">
                      <Link href={`/stories/${s.id}`} className="absolute inset-0 z-0">
                        <span className="sr-only">Open {s.title && s.title.trim() ? s.title : 'Untitled'}</span>
                      </Link>
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
                      {previews[s.id] ? (
                        <img
                          src={previews[s.id] || undefined}
                          alt={s.title ?? 'story'}
                          className="w-full h-full object-cover"
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
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </ContentLayout>
    </>
  );
}
