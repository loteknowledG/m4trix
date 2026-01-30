"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
import { Upload, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import useSelection from "@/hooks/use-selection";
import MomentCard from "@/components/moment-card";
import { MomentsProvider } from "@/context/moments-collection";
import CollectionOverlay from "@/components/collection-overlay";

type Moment = { id: string; src: string; name?: string };

export default function StoryByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params as any)?.id as string | undefined;

  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const scope = id ? `story:${id}` : "";
  const selectedIds = useSelection((s) => (scope ? s.selections[scope] || [] : []));
  const toggleSelect = useSelection((s) => s.toggle);
  const clearSelection = useSelection((s) => s.clear);
  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const scrollAnimRef = useRef<number | null>(null);
  const scrollDirectionRef = useRef<number>(0);

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const stored = (await get<any>(`story:${id}`)) || null;
        if (!mounted) return;
        if (Array.isArray(stored)) {
          setMoments(stored.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name }))); 
        } else if (stored && Array.isArray(stored.items)) {
          setMoments(stored.items.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name })));
        } else {
          setMoments([]);
        }

        // try to get title from stored object or stories metadata
        let t = stored && stored.title ? stored.title : "";
        try {
          const saved = (await get<{ id: string; title?: string; count?: number }[]>("stories")) || [];
          const meta = saved.find((m) => m.id === id);
          if (meta && meta.title) t = meta.title;
        } catch (e) {
          // ignore
        }
        setTitle(t);
      } catch (err) {
        console.error("Failed to load story items", err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
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
        if (action === "move-to-heap") {
          const heap = (await get<any[]>("heap-moments")) || (await get<any[]>("heap-gifs")) || [];
            const moving = moments.filter((g) => ids.includes(g.id));
          const newHeap = [...heap, ...moving];
          await set("heap-moments", newHeap);
          // remove from story
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
          // update local state
          setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
          // update stories metadata count
          try {
            const saved = (await get<any>("stories")) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set("stories", saved);
              try { window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } })); } catch (e) {}
            }
          } catch (e) {}
          try { window.dispatchEvent(new CustomEvent("moments-updated", { detail: { count: newHeap.length } })); } catch (e) {}
        }

        if (action === "move-to-trash") {
          const trash = (await get<any[]>("trash-moments")) || (await get<any[]>("trash-gifs")) || [];
          const moving = moments.filter((g) => ids.includes(g.id));
          const newTrash = [...trash, ...moving];
          await set("trash-moments", newTrash);
          // remove from story (same as above)
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
          setMoments((prev) => prev.filter((g) => !ids.includes(g.id)));
          try {
            const saved = (await get<any>("stories")) || [];
            const idx = saved.findIndex((s: any) => s.id === id);
            if (idx > -1) {
              saved[idx].count = Math.max(0, (saved[idx].count || 0) - ids.length);
              await set("stories", saved);
              try { window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } })); } catch (e) {}
            }
          } catch (e) {}
        }
      } catch (e) {
        console.error("Failed to perform story action", e);
      } finally {
        // clear selection
        try { clearSelection(scope); } catch (e) {}
      }
    };
    window.addEventListener("story-action", handler as EventListener);
    return () => window.removeEventListener("story-action", handler as EventListener);
  }, [selectedIds, moments, id, clearSelection, scope]);

  const onDragStart = useCallback((e: React.DragEvent, idx: number) => {
    dragIndexRef.current = idx;
    try {
      e.dataTransfer.setData("text/plain", String(idx));
      e.dataTransfer.effectAllowed = "move";
    } catch (err) {}
  }, []);

  const onDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIndex(idx);
    try {
      e.dataTransfer.dropEffect = "move";
    } catch (err) {}

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
          return e.dataTransfer.getData("text/plain");
        } catch (err) {
          return String(dragIndexRef.current ?? "");
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
          window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
        } catch (e) {}
      } catch (err) {
        console.error("Failed to persist reordered story", err);
      }
    },
    [moments, id]
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
      } catch (e) {}
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
    window.addEventListener("dragend", onDragEndWin);
    return () => window.removeEventListener("dragend", onDragEndWin);
  }, []);

  useEffect(() => {
    const prev = document.title;
    if (!id) return () => {
      document.title = prev ?? "matrix";
    };

    const base = "matrix - story";
    document.title = title ? `${base} - ${title}` : base;
    return () => {
      document.title = prev ?? "matrix";
    };
  }, [id, title]);

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
      const saved = (await get<any>("stories")) || [];
      const idx = saved.findIndex((s: any) => s.id === id);
      if (idx > -1) {
        saved[idx].title = title;
        await set("stories", saved);
      }
      window.dispatchEvent(new CustomEvent("stories-updated", { detail: { id } }));
    } catch (e) {
      console.error("Failed to save story title", e);
    }
  }

  return (
      <ContentLayout
      title="Stories"
      navLeft={(
        <Button
          onClick={() => router.push('/stories')}
          className="rounded-md w-8 h-8 transform transition-transform duration-150 ease-out hover:-translate-y-1 hover:-translate-x-1 active:translate-y-1 active:translate-x-1 mc-shadow-hover mc-shadow-active"
          variant="outline"
          size="icon"
          aria-label="Back to list"
        >
          <ArrowLeft size={16} />
        </Button>
      )}
    >
      <ErrorBoundary>
        <div className="overflow-auto" style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}>
          <div className="py-4">
        <div className="mb-6">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            placeholder="Add a title"
            className="w-full text-5xl font-light bg-transparent border-0 focus:ring-0 placeholder:text-muted-foreground"
          />
        </div>
        {loading ? (
          <div className="text-sm text-muted-foreground">Loading…</div>
        ) : moments.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload size={16} />
              <div className="font-medium">No story selected</div>
            </div>
            <div className="text-sm">Create a new story from the heap to move moments here.</div>
          </div>
        ) : (
          <MomentsProvider collection={moments}>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {moments.map((g, idx) => (
                <div
                  key={g.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, idx)}
                  onDragEnd={() => {
                    dragIndexRef.current = null;
                    setDragOverIndex(null);
                    stopAutoScroll();
                  }}
                  onDragOver={(e) => onDragOver(e, idx)}
                  onDrop={(e) => onDrop(e, idx)}
                  className={
                    "relative rounded" + (dragOverIndex === idx ? " ring-2 ring-primary/50" : "")
                  }
                >
                  <MomentCard
                    item={{ ...g, selected: (selectedIds || []).includes(g.id) } as any}
                    anySelected={(selectedIds || []).length > 0}
                    toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                  />
                </div>
              ))}
            </div>
            <CollectionOverlay />
          </MomentsProvider>
        )}
          </div>
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
