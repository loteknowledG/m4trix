'use client';
import { SelectionHeaderBar } from '@/components/ui/selection-header-bar';

import { useEffect, useState } from 'react';
import { del, get, set } from 'idb-keyval';
import { logger } from '@/lib/logger';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import { MomentsProvider } from '@/context/moments-collection';
import MomentsGrid from '@/components/moments-grid';
import { Trash2, RotateCcw } from '@/components/icons';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type Moment = { id: string; src: string; name?: string };
type TrashedStory = { id: string; title?: string; count?: number };
const momentKey = (id: string) => `moment:${id}`;
const storyKey = (id: string) => `story:${id}`;

export default function TrashPage() {
  const [moments, setMoments] = useState<Moment[]>([]);
  const [stories, setStories] = useState<TrashedStory[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const selectedIds = Object.keys(selected).filter(k => selected[k]);
  const selectedMomentIds = selectedIds
    .filter(id => id.startsWith('moment:'))
    .map(id => id.replace('moment:', ''));
  const selectedStoryIds = selectedIds
    .filter(id => id.startsWith('story:'))
    .map(id => id.replace('story:', ''));

  const load = async () => {
    try {
      const saved = (await get<any[]>('trash-moments')) || (await get<any[]>('trash-gifs')) || [];
      const trashedStories = (await get<TrashedStory[]>('trash-stories')) || [];
      if (Array.isArray(saved))
        setMoments(saved.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name })));
      else setMoments([]);
      setStories(Array.isArray(trashedStories) ? trashedStories : []);
    } catch (e) {
      logger.error('Failed to load trash', e);
      setMoments([]);
      setStories([]);
    }
  };

  const anySelected = Object.keys(selected).some(k => selected[k]);

  const toggleSelect = (id: string) => {
    setSelected(s => ({ ...s, [id]: !s[id] }));
  };

  const clearSelection = () => setSelected({});

  const restoreSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      const trash = (await get<any[]>('trash-moments')) || (await get<any[]>('trash-gifs')) || [];
      const toRestore = trash.filter((t: any) => selectedMomentIds.includes(t.id || t));
      const remaining = trash.filter((t: any) => !selectedMomentIds.includes(t.id || t));
      // write remaining back to trash
      await set('trash-moments', remaining);
      // append to heap
      const heap = (await get<any[]>('heap-moments')) || (await get<any[]>('heap-gifs')) || [];
      const newHeap = [...heap, ...toRestore];
      await set('heap-moments', newHeap);

      if (selectedStoryIds.length > 0) {
        const trashStories = (await get<TrashedStory[]>('trash-stories')) || [];
        const restoreStories = trashStories.filter(s => selectedStoryIds.includes(s.id));
        const remainingStories = trashStories.filter(s => !selectedStoryIds.includes(s.id));
        const existingStories = (await get<TrashedStory[]>('stories')) || [];
        await set('stories', [...restoreStories, ...existingStories]);
        await set('trash-stories', remainingStories);
        await Promise.all(
          selectedStoryIds.map(async id => {
            const stored = await get<any>(`trash-story:${id}`);
            if (stored !== undefined) {
              await set(`story:${id}`, stored);
              await del(`trash-story:${id}`);
            }
          })
        );
      }
      // refresh
      clearSelection();
      await load();
      try {
        window.dispatchEvent(new Event('moments-updated'));
        window.dispatchEvent(new CustomEvent('stories-updated', { detail: {} }));
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      logger.error('Failed to restore selected moments', e);
    }
  };

  const deleteSelectedPermanently = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`Delete ${selectedIds.length} item(s) permanently? This cannot be undone.`)) return;
    try {
      const trash = (await get<any[]>('trash-moments')) || (await get<any[]>('trash-gifs')) || [];
      const remaining = trash.filter((t: any) => !selectedMomentIds.includes(t.id || t));
      await set('trash-moments', remaining);
      if (selectedStoryIds.length > 0) {
        const trashStories = (await get<TrashedStory[]>('trash-stories')) || [];
        await set(
          'trash-stories',
          trashStories.filter(s => !selectedStoryIds.includes(s.id))
        );
      }
      clearSelection();
      await load();
      try {
        window.dispatchEvent(new Event('moments-updated'));
        window.dispatchEvent(new CustomEvent('stories-updated', { detail: {} }));
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      logger.error('Failed to delete selected moments', e);
    }
  };

  useEffect(() => {
    load();
    const h = () => load();
    try {
      window.addEventListener('moments-updated', h as EventListener);
      window.addEventListener('stories-updated', h as EventListener);
    } catch (e) {
      /* ignore */
    }
    return () => {
      try {
        window.removeEventListener('moments-updated', h as EventListener);
        window.removeEventListener('stories-updated', h as EventListener);
      } catch (e) {
        /* ignore */
      }
    };
  }, []);

  return (
    <ContentLayout
      title="Trash"
      navLeft={
        anySelected ? (
          <SelectionHeaderBar
            selectedIds={selectedIds}
            moments={[
              ...moments.map(m => ({ id: momentKey(m.id) })),
              ...stories.map(s => ({ id: storyKey(s.id) })),
            ]}
            onSelectAll={() => {
              setSelected(
                Object.fromEntries([
                  ...moments.map(m => [momentKey(m.id), true]),
                  ...stories.map(s => [storyKey(s.id), true]),
                ])
              );
            }}
            onClearSelection={clearSelection}
          />
        ) : null
      }
      navRight={
        anySelected ? (
          <TooltipProvider>
            <div className="flex items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={restoreSelected}
                    title="Restore selected moments"
                    className="m4-circle-action bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    <RotateCcw size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10}>
                  <p>Restore to Heap</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={deleteSelectedPermanently}
                    title="Delete selected moments permanently"
                    className="m4-circle-action bg-destructive/10 text-destructive hover:bg-destructive/20"
                  >
                    <Trash2 size={18} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={10}>
                  <p>Delete permanently</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        ) : null
      }
    >
      <ErrorBoundary>
        <div className="overflow-auto h-[calc(100vh_-_var(--app-header-height,56px))]">
          <div className="py-4">
            {moments.length === 0 && stories.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No items in Trash.</div>
            ) : null}
            {moments.length > 0 ? (
              <MomentsProvider collection={moments}>
                <MomentsGrid
                  moments={moments}
                  selectedIds={selectedMomentIds}
                  toggleSelect={(id: string) => toggleSelect(momentKey(id))}
                />
              </MomentsProvider>
            ) : null}
            {stories.length > 0 ? (
              <div className="mt-8">
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">Trashed Stories</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {stories.map(story => (
                    <Card
                      key={story.id}
                      className={`group overflow-hidden transition-shadow duration-150 transition-transform duration-150 ease-out hover:shadow-2xl hover:-translate-y-0.5 hover:-translate-x-0.5 active:translate-y-0.5 active:translate-x-0.5 ${
                        selected[storyKey(story.id)] ? 'ring-2 ring-primary' : ''
                      }`}
                    >
                      <div className="relative aspect-square bg-zinc-100 dark:bg-zinc-800">
                        <label
                          className={`absolute left-2 top-2 z-10 flex h-6 w-6 cursor-pointer items-center justify-center rounded border border-white/70 bg-black/45 transition-opacity ${
                            selected[storyKey(story.id)] ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer accent-primary"
                            checked={Boolean(selected[storyKey(story.id)])}
                            onChange={e => {
                              setSelected(prev => ({
                                ...prev,
                                [storyKey(story.id)]: e.target.checked,
                              }));
                            }}
                            aria-label={`Select ${story.title && story.title.trim() ? story.title : 'Untitled'}`}
                          />
                        </label>
                        <div className="absolute inset-0 flex items-end bg-gradient-to-t from-black/60 to-transparent p-2">
                          <div className="flex flex-col">
                            <div className="font-medium text-white truncate">
                              {story.title && story.title.trim() ? story.title : 'Untitled'}
                            </div>
                            <div className="text-xs text-white">{story.count ?? 0} items</div>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
