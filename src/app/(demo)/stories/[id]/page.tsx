"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import ErrorBoundary from "@/components/error-boundary";
import { Upload, ArrowLeft } from "lucide-react";
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
        <button
          onClick={() => router.back()}
          className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-zinc-100 dark:hover:bg-zinc-700"
          aria-label="Back"
        >
          <ArrowLeft size={16} />
        </button>
      )}
    >
      <ErrorBoundary>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {moments.map((g) => (
                <MomentCard
                  key={g.id}
                  item={{ ...g, selected: (selectedIds || []).includes(g.id) } as any}
                  anySelected={(selectedIds || []).length > 0}
                  toggleSelect={(tid: string) => toggleSelect(scope, tid)}
                />
              ))}
            </div>
            <CollectionOverlay />
          </MomentsProvider>
        )}
        </div>
      </ErrorBoundary>
    </ContentLayout>
  );
}
