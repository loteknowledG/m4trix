"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { get, set } from "idb-keyval";
import { ContentLayout } from "@/components/admin-panel/content-layout";
import { Upload, ArrowLeft } from "lucide-react";
import MomentCard from "@/components/moment-card";

type GifItem = { id: string; src: string; name?: string };

export default function StoryByIdPage() {
  const params = useParams();
  const router = useRouter();
  const id = (params as any)?.id as string | undefined;

  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const clearSelection = () => setSelectedIds(new Set());

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
          setGifs(stored.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name }))); 
        } else if (stored && Array.isArray(stored.items)) {
          setGifs(stored.items.map((s: any) => ({ id: s.id || s, src: s.src || s, name: s.name })));
        } else {
          setGifs([]);
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
        ) : gifs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Upload size={16} />
              <div className="font-medium">No story selected</div>
            </div>
            <div className="text-sm">Create a new story from the heap to move GIFs here.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {gifs.map((g) => (
              <MomentCard
                key={g.id}
                item={{ ...g, selected: selectedIds.has(g.id) } as any}
                anySelected={selectedIds.size > 0}
                toggleSelect={(id: string) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>
    </ContentLayout>
  );
}
