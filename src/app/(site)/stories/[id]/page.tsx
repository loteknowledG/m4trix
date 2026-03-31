'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { get, set } from 'idb-keyval';
import useSelection from '@/hooks/use-selection';
import { useSidebar } from '@/hooks/use-sidebar';
import { logger } from '@/lib/logger';
import { Marquee } from '@/components/ui/marquee';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import ErrorBoundary from '@/components/error-boundary';
import { MomentsProvider } from '@/context/moments-collection';
import MomentsGrid from '@/components/moments-grid';
import CollectionOverlay from '@/components/collection-overlay';
import { SelectionHeaderBar } from '@/components/ui/selection-header-bar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Trash2, Upload } from 'lucide-react';
import { LuNotebookText } from 'react-icons/lu';
import { IoBanOutline } from 'react-icons/io5';
import { GrUserFemale } from 'react-icons/gr';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { useRouter, useParams } from 'next/navigation';

type Moment = { id: string; src: string; name?: string; fingerprint?: string };
type Character = { id: string; name?: string };

export default function StoryPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [storyInfoOpen, setStoryInfoOpen] = useState(false);
  const [assignNpcOpen, setAssignNpcOpen] = useState(false);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [assignedNpcId, setAssignedNpcId] = useState<string | null>(null);

  const selectedIds = useSelection(s => s.selections['stories'] || []);
  const toggleSelect = useSelection(s => s.toggle);
  const setSelectionStore = useSelection(s => s.set);
  const clearSelection = useSelection(s => s.clear);
  const scope = 'stories';

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollDirectionRef = useRef<number | null>(null);
  const scrollAnimRef = useRef<number | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setMoments([]);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const stored = (await get<any>(`story:${id}`)) || null;
        if (!mounted) return;

        let loadedMoments: Moment[] = [];
        if (Array.isArray(stored)) {
          loadedMoments = stored.map((s: any) => ({
            id: s.id || s,
            src: s.src || s,
            name: s.name,
          }));
        } else if (stored && Array.isArray(stored.items)) {
          loadedMoments = stored.items.map((s: any) => ({
            id: s.id || s,
            src: s.src || s,
            name: s.name,
          }));
        }

        setMoments(loadedMoments);

        // try to get title from stored object or stories metadata
        let t = stored && stored.title ? stored.title : '';
        try {
          const saved =
            (await get<{ id: string; title?: string; count?: number; npcId?: string }[]>('stories')) || [];
          const meta = saved.find((m: any) => m.id === id);
          if (meta && meta.title) t = meta.title;
          setAssignedNpcId(meta?.npcId || null);
        } catch (e) {
          /* ignore */
        }
        setTitle(t);
      } catch (err) {
        logger.error('Failed to load story items', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [id]);

  // listen for toolbar actions dispatched from navbar
  useEffect(() => {
    const handler = async (e: Event) => {
      const ev = e as CustomEvent;
      const action = ev?.detail?.action;
      if (!action) return;
      const ids = Array.from(selectedIds || []);
      if (!ids.length) return;

      try {
        if (action === 'move-to-heap') {
          const heap = (await get<any[]>('heap-moments')) || (await get<any[]>('heap-gifs')) || [];
          const moving = moments.filter(g => ids.includes(g.id));
          const newHeap = [...heap, ...moving];
          await set('heap-moments', newHeap);
          // remove from story
          const storyKey = `story:${id}`;
          const stored = (await get<any>(storyKey)) || [];
          let remaining: any[] = [];
          if (Array.isArray(stored)) {
            try {
              window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
            } catch (e) {
              /* ignore */
            }
          } else if (stored && Array.isArray(stored.items)) {
            remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
            stored.items = remaining;
            await set(storyKey, stored);
          }
          await set(storyKey, remaining);
          // update local state
          setMoments(prev => prev.filter(g => !ids.includes(g.id)));
          // update stories metadata count
          try {
            const saved = (await get<any>('stories')) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set('stories', saved);
              try {
                window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
              } catch (e) {
                /* ignore */
              }
            }
          } catch (e) {
            /* ignore */
          }
          try {
            window.dispatchEvent(
              new CustomEvent('moments-updated', { detail: { count: newHeap.length } })
            );
          } catch (e) {
            /* ignore */
          }
        }

        if (action === 'move-to-trash') {
          const trash =
            (await get<any[]>('trash-moments')) || (await get<any[]>('trash-gifs')) || [];
          const moving = moments.filter(g => ids.includes(g.id));
          const newTrash = [...trash, ...moving];
          await set('trash-moments', newTrash);
          // remove from story (same as above)
          const storyKey = `story:${id}`;
          const stored = (await get<any>(storyKey)) || [];
          let remaining: any[] = [];
          try {
            window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
          } catch (e) {
            /* ignore */
          }
          if (Array.isArray(stored)) {
            remaining = stored.filter((s: any) => !ids.includes(s.id || s));
          } else if (stored && Array.isArray(stored.items)) {
            remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
            stored.items = remaining;
            await set(storyKey, stored);
          }
          try {
            clearSelection(scope);
          } catch (e) {
            /* ignore */
          }
          setMoments(prev => prev.filter(g => !ids.includes(g.id)));
          try {
            const saved = (await get<any>('stories')) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set('stories', saved);
              try {
                window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
              } catch (e) {
                /* ignore */
              }
            }
          } catch (e) {
            /* ignore */
          }
        }
      } catch (e) {
        logger.error('Failed to perform story action', e);
      } finally {
        // clear selection
        try {
          clearSelection(scope);
        } catch (e) {
          /* ignore */
        }
      }
    };
    window.addEventListener('story-action', handler as EventListener);
    return () => window.removeEventListener('story-action', handler as EventListener);
  }, [selectedIds, moments, id, clearSelection, scope]);

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragIndexRef.current = idx;
    try {
      e.dataTransfer.setData('text/plain', String(idx));
      e.dataTransfer.effectAllowed = 'move';
    } catch (err) {
      /* ignore */
    }
  }, []);

  // set story's saved count to exact number
  const setStoryCount = useCallback(
    async (count: number) => {
      if (!id) return;
      try {
        const saved = (await get<any[]>('stories')) || [];
        const idx = saved.findIndex(s => s.id === id);
        if (idx > -1) {
          saved[idx].count = count;
          await set('stories', saved);
          try {
            window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
          } catch {}
        }
      } catch (e) {
        /* ignore */
      }
    },
    [id]
  );

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
    try {
      e.dataTransfer.dropEffect = 'move';
    } catch (err) {
      /* ignore */
    }

    // Only auto-scroll when a drag is active (dragIndexRef is set).
    if (dragIndexRef.current === null) return;

    // auto-scroll when pointer nears top/bottom of viewport
    const margin = 80; // px from edge to start scrolling
    const y = e.clientY;
    const vh = window.innerHeight;
    if (y < margin) {
      scrollDirectionRef.current = -1;
      startAutoScroll();
    } else if (y > vh - margin) {
      scrollDirectionRef.current = 1;
      startAutoScroll();
    } else {
      scrollDirectionRef.current = 0;
      stopAutoScroll();
    }
  }, []);

  const onDrop = useCallback(
    async (e: React.DragEvent, idx: number) => {
      e.preventDefault();
      const fromStr = (() => {
        try {
          return e.dataTransfer.getData('text/plain');
        } catch (err) {
          return String(dragIndexRef.current ?? '');
        }
      })();
      const from = fromStr ? Number(fromStr) : null;
      const to = idx;
      setDragOverIndex(null);
      dragIndexRef.current = null;
      stopAutoScroll();
      if (from === null || Number.isNaN(from) || from === to) return;

      const next = [...moments];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);

      setMoments(next);
      try {
        const storyKey = `story:${id}`;
        // Persist the reordered array (store raw items)
        await set(storyKey, next);
        try {
          window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
        } catch (e) {
          /* ignore */
        }
      } catch (err) {
        logger.error('Failed to persist reordered story', err);
      }
    },
    [moments, id]
  );

  // allow dropping external images/URLs to append to story
  const handleExternalDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      const addSrc = async (src: string, fingerprint?: string) => {
        setMoments(ms => {
          // avoid duplicates by fingerprint (when available) or by src
          if (
            ms.some(m =>
              fingerprint && m.fingerprint ? m.fingerprint === fingerprint : m.src === src
            )
          ) {
            setStoryCount(ms.length).catch(() => {});
            return ms;
          }

          const newMoment: Moment = { id: crypto.randomUUID(), src, fingerprint };
          const updated = [...ms, newMoment];
          set(`story:${id}`, updated).catch(() => {});
          setStoryCount(updated.length).catch(() => {});
          return updated;
        });
      };

      if (e.dataTransfer.files && e.dataTransfer.files.length) {
        for (const file of Array.from(e.dataTransfer.files)) {
          if (file.type.startsWith('image/')) {
            const fingerprint = `${file.name}:${file.size}:${file.lastModified}`;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => reject(reader.error);
              reader.readAsDataURL(file);
            });
            await addSrc(dataUrl, fingerprint);
          }
        }
        return;
      }
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        // normalize URL for dedupe by stripping query params
        const normalized = text.split('?')[0];
        await addSrc(text, normalized);
      }
    },
    [id]
  );

  function startAutoScroll() {
    if (scrollAnimRef.current) return;
    const step = () => {
      const dir = scrollDirectionRef.current;
      if (!dir) {
        scrollAnimRef.current = null;
        return;
      }
      try {
        window.scrollBy({ top: dir * 12 });
      } catch (e) {
        /* ignore */
      }
      scrollAnimRef.current = requestAnimationFrame(step);
    };
    scrollAnimRef.current = requestAnimationFrame(step);
  }

  function stopAutoScroll() {
    if (scrollAnimRef.current) {
      cancelAnimationFrame(scrollAnimRef.current);
      scrollAnimRef.current = null;
    }
  }

  useEffect(() => {
    const onDragEndWin = () => {
      dragIndexRef.current = null;
      setDragOverIndex(null);
      stopAutoScroll();
    };
    window.addEventListener('dragend', onDragEndWin);
    return () => {
      window.removeEventListener('dragend', onDragEndWin);
      // clear any selections scoped to this story when leaving
      clearSelection(scope);
    };
  }, [clearSelection, scope]);

  useEffect(() => {
    const prev = document.title;
    if (!id)
      return () => {
        document.title = prev ?? 'm4trix';
      };

    const base = 'm4trix - story';
    document.title = title ? `${base} - ${title}` : base;
    return () => {
      document.title = prev ?? 'm4trix';
    };
  }, [id, title]);

  const router = useRouter();
  const setSidebarOpen = useSidebar(s => s.setIsOpen);

  const loadCharacters = useCallback(async () => {
    try {
      const saved = (await get<Character[]>('PLAYGROUND_AGENTS')) || [];
      setCharacters(Array.isArray(saved) ? saved : []);
    } catch (e) {
      setCharacters([]);
    }
  }, []);

  const createCharacter = useCallback(async () => {
    try {
      const saved = (await get<any[]>('PLAYGROUND_AGENTS')) || [];
      const newCharacter = {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: '',
        description: '',
      };
      const next = [...saved, newCharacter];
      await set('PLAYGROUND_AGENTS', next);
      setCharacters(next);
      try {
        window.dispatchEvent(new Event('characters-updated'));
      } catch (e) {
        /* ignore */
      }
    } catch (e) {
      logger.error('Failed to create character', e);
    }
  }, []);

  const assignNpcToStory = useCallback(
    async (characterId: string) => {
      if (!id) return;
      try {
        const saved = (await get<any[]>('stories')) || [];
        const idx = saved.findIndex((s: any) => s.id === id);
        if (idx > -1) {
          saved[idx] = { ...saved[idx], npcId: characterId };
          await set('stories', saved);
        }
        setAssignedNpcId(characterId);
        setAssignNpcOpen(false);
      } catch (e) {
        logger.error('Failed to assign NPC', e);
      }
    },
    [id]
  );

  async function handleDeleteStory() {
    if (!id) return;
    try {
      // confirm destructive action with user
      const ok =
        typeof window !== 'undefined'
          ? window.confirm('Delete this story? This cannot be undone.')
          : true;
      if (!ok) return;

      const storyKey = `story:${id}`;
      // clear stored story items
      await set(storyKey, []);

      // remove from stories metadata
      try {
        const saved = (await get<any>('stories')) || [];
        const remaining = (Array.isArray(saved) ? saved : []).filter((s: any) => s.id !== id);
        await set('stories', remaining);
      } catch (e) {
        // ignore
      }

      try {
        window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
      } catch (e) {
        /* ignore */
      }
      try {
        clearSelection(scope);
      } catch (e) {
        /* ignore */
      }
      setMoments([]);
      // navigate back to stories list
      try {
        router.push('/stories');
      } catch (e) {
        /* ignore */
      }
    } catch (err) {
      logger.error('Failed to delete story', err);
    }
  }

  async function handleTitleBlur() {
    if (!id) return;
    try {
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || {};
      if (Array.isArray(stored)) {
        // keep array form
        await set(storyKey, stored);
      } else {
        stored.title = title;
        await set(storyKey, stored);
      }

      // update stories metadata
      const saved = (await get<any>('stories')) || [];
      const idx = saved.findIndex((s: any) => s.id === id);
      if (idx > -1) {
        saved[idx].title = title;
        await set('stories', saved);
      }
      window.dispatchEvent(new CustomEvent('stories-updated', { detail: { id } }));
    } catch (e) {
      logger.error('Failed to save story title', e);
    }
  }

  const moveToTrash = useCallback(async () => {
    try {
      const ids = selectedIds || [];
      if (!ids.length) return;
      const toMove = moments.filter(m => ids.includes(m.id));
      const existingTrash =
        (await get<any[]>('trash-moments')) || (await get<any[]>('trash-gifs')) || [];
      const newTrash = [...existingTrash, ...toMove];
      await set('trash-moments', newTrash);

      // remove moved items from this story
      setMoments(prev => prev.filter(m => !ids.includes(m.id)));

      // update stored story list
      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      let remaining: any[] = [];
      if (Array.isArray(stored)) {
        remaining = stored.filter((s: any) => !ids.includes(s.id || s));
      } else if (stored && Array.isArray(stored.items)) {
        remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
        stored.items = remaining;
        await set(storyKey, stored);
      }
      await set(storyKey, remaining);

      // keep story count in sync
      setStoryCount(remaining.length).catch(() => {});

      try {
        window.dispatchEvent(
          new CustomEvent('moments-updated', {
            detail: { count: newTrash.length, source: 'story' },
          })
        );
      } catch (e) {
        /* ignore */
      }
      clearSelection(scope);
    } catch (err) {
      logger.error('Failed to move selected to trash', err);
    }
  }, [clearSelection, id, moments, scope, selectedIds]);

  const moveToHeap = useCallback(async () => {
    try {
      const ids = selectedIds || [];
      if (!ids.length) return;
      const toMove = moments.filter(m => ids.includes(m.id));
      const existingHeap =
        (await get<any[]>('heap-moments')) || (await get<any[]>('heap-gifs')) || [];
      const newHeap = [...existingHeap, ...toMove];
      await set('heap-moments', newHeap);

      // remove moved items from this story
      setMoments(prev => prev.filter(m => !ids.includes(m.id)));

      const storyKey = `story:${id}`;
      const stored = (await get<any>(storyKey)) || [];
      let remaining: any[] = [];
      if (Array.isArray(stored)) {
        remaining = stored.filter((s: any) => !ids.includes(s.id || s));
      } else if (stored && Array.isArray(stored.items)) {
        remaining = stored.items.filter((s: any) => !ids.includes(s.id || s));
        stored.items = remaining;
        await set(storyKey, stored);
      }
      await set(storyKey, remaining);

      setStoryCount(remaining.length).catch(() => {});
      try {
        window.dispatchEvent(
          new CustomEvent('moments-updated', {
            detail: { count: newHeap.length, source: 'heap' },
          })
        );
      } catch (e) {
        /* ignore */
      }
      clearSelection(scope);
    } catch (err) {
      logger.error('Failed to move selected to heap', err);
    }
  }, [clearSelection, id, moments, scope, selectedIds]);

  return (
    <>
      <ContentLayout
        title={title || 'Stories'}
        titleMarquee
        navLeft={
          <SelectionHeaderBar
            selectedIds={selectedIds || []}
            moments={moments}
            showSelectAll={(selectedIds || []).length > 0}
            onSelectAll={() => {
              if ((selectedIds || []).length !== moments.length) {
                setSelectionStore(
                  scope,
                  moments.map(m => m.id)
                );
              } else {
                clearSelection(scope);
              }
            }}
            onClearSelection={() => clearSelection(scope)}
          />
        }
        navRight={
          <div className="flex items-center gap-2">
            {!(selectedIds || []).length ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-transparent text-foreground hover:bg-accent/10 transition-colors"
                      aria-label="Story info"
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        setStoryInfoOpen(true);
                      }}
                    >
                      <LuNotebookText size={18} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={10}>
                    <p>Story info</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}

            {(selectedIds || []).length > 0 ? (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          moveToHeap();
                        }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-transparent text-destructive hover:text-destructive/80 transition-colors"
                        aria-label="Remove from story"
                      >
                        <IoBanOutline size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Remove from story</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          e.preventDefault();
                          moveToTrash();
                        }}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        aria-label="Move selected to trash"
                      >
                        <Trash2 size={18} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={10}>
                      <p>Move to Trash</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            ) : null}
          </div>
        }
      >
        <ErrorBoundary>
          <div
            className="overflow-auto h-[calc(100vh_-_var(--app-header-height,56px))]"
            onDragOver={e => e.preventDefault()}
            onDrop={handleExternalDrop}
          >
            <div className="py-4">
              <div className="mb-6">
                {editingTitle ? (
                  <input
                    autoFocus
                    aria-label="Edit story title"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    onBlur={async () => {
                      await handleTitleBlur();
                      setEditingTitle(false);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      } else if (e.key === 'Escape') {
                        e.preventDefault();
                        setEditingTitle(false);
                      }
                    }}
                    className="w-full text-5xl font-light bg-transparent border-0 focus:ring-0 placeholder:text-muted-foreground"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTitle(true)}
                    className="w-full text-left text-5xl font-light bg-transparent border-0 focus:outline-none"
                    aria-label="Edit story title"
                  >
                    <Marquee
                      className="text-5xl font-light"
                      duration="8s"
                      gap="13rem"
                      distance="200%"
                    >
                      {title.trim() ? title : 'Add a title'}
                    </Marquee>
                  </button>
                )}
              </div>
              {loading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : moments.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Upload size={16} />
                    <div className="font-medium">No story selected</div>
                  </div>
                  <div className="text-sm">
                    Create a new story from the heap to move moments here.
                  </div>
                  <div className="mt-4">
                    <button
                      onClick={handleDeleteStory}
                      className="inline-flex items-center px-3 py-1.5 rounded border text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                    >
                      Delete story
                    </button>
                  </div>
                </div>
              ) : (
                <MomentsProvider collection={moments}>
                  {moments.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <Upload size={16} />
                        <div className="font-medium">No story selected</div>
                      </div>
                      <div className="text-sm">
                        Create a new story from the heap to move moments here.
                      </div>
                      <div className="mt-4">
                        <button
                          onClick={handleDeleteStory}
                          className="inline-flex items-center px-3 py-1.5 rounded border text-sm text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          Delete story
                        </button>
                      </div>
                    </div>
                  ) : (
                    <MomentsGrid
                      moments={moments}
                      selectedIds={selectedIds}
                      toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                      onDragStart={onDragStart}
                      onDragEnd={(_idx: number) => {
                        dragIndexRef.current = null;
                        setDragOverIndex(null);
                        stopAutoScroll();
                      }}
                      onDragOver={onDragOver}
                      onDrop={onDrop}
                      dragOverIndex={dragOverIndex}
                    />
                  )}
                  <CollectionOverlay />
                </MomentsProvider>
              )}
            </div>
          </div>
        </ErrorBoundary>
      </ContentLayout>{' '}
      {/* Right-side drawer for story info, similar to the moment tag drawer */}
      <div
        className={`fixed right-0 top-0 h-full w-80 max-w-full bg-background/95 border-l border-border z-[1150] transform transition-transform duration-300 ease-in-out ${
          storyInfoOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-hidden={storyInfoOpen ? 'false' : 'true'}
      >
        <div className="h-full flex flex-col p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium">Story info</h3>
            <div className="flex items-center gap-1">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                        loadCharacters();
                        setAssignNpcOpen(true);
                        setStoryInfoOpen(false);
                      }}
                      className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-accent/20 text-foreground"
                      aria-label="Assign NPC"
                    >
                      <GrUserFemale size={16} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    <p>Assign NPC</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <button
                type="button"
                onClick={() => setStoryInfoOpen(false)}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-transparent hover:bg-accent/20 text-foreground"
                aria-label="Close story info"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto space-y-4 text-sm">
            <div>
              <div className="text-xs uppercase text-muted-foreground mb-1">Title</div>
              <div className="font-medium break-words">
                {title && title.trim().length > 0 ? title : 'Untitled story'}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground mb-0.5">Moments</div>
                <div className="text-base font-semibold">{moments.length}</div>
              </div>
              {id ? (
                <div>
                  <div className="text-muted-foreground mb-0.5">Story ID</div>
                  <div className="text-[11px] break-all text-foreground/80">{id}</div>
                </div>
              ) : null}
            </div>

            <div className="pt-2 border-t border-border/40 space-y-2">
              <div className="text-xs text-muted-foreground">
                Story metadata is stored locally in your browser (IndexedDB). Deleting the story
                will remove its moments from this view, but not from Heap or Trash.
              </div>
              <button
                type="button"
                onClick={async () => {
                  await handleDeleteStory();
                  setStoryInfoOpen(false);
                }}
                className="inline-flex items-center justify-center px-3 py-1.5 rounded border text-xs text-destructive border-destructive/40 hover:bg-destructive/10"
              >
                Delete story
              </button>
            </div>
          </div>
        </div>
      </div>
      <Sheet open={assignNpcOpen} onOpenChange={setAssignNpcOpen}>
        <SheetContent side="center" onClick={e => e.stopPropagation()}>
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Assign NPC</SheetTitle>
              <SheetClose />
            </div>
            <SheetDescription className="text-sm">
              Create a new character or select one to assign to this story.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-3 overflow-y-auto max-h-[60vh]">
            <button
              type="button"
              onClick={createCharacter}
              className="flex items-center gap-3 w-full p-3 rounded border"
            >
              <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">+</div>
              <div className="text-sm">New character</div>
            </button>
            {characters.length === 0 ? (
              <div className="text-sm text-muted-foreground">No characters yet.</div>
            ) : (
              characters.map(character => (
                <button
                  key={character.id}
                  type="button"
                  onClick={() => assignNpcToStory(character.id)}
                  className={`flex items-center justify-between gap-3 w-full p-3 rounded hover:bg-accent text-left ${
                    assignedNpcId === character.id ? 'border border-primary/60' : ''
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center">
                      <GrUserFemale size={16} />
                    </div>
                    <div className="text-sm truncate">
                      {character.name && character.name.trim() ? character.name : 'Untitled'}
                    </div>
                  </div>
                  {assignedNpcId === character.id ? (
                    <span className="text-xs text-primary">Assigned</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
