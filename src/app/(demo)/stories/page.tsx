"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { get } from "idb-keyval";
import { logger } from "@/lib/logger";
import { ContentLayout } from "@/components/admin-panel/content-layout";
// removed unused imports
import CountBadge from "@/components/ui/count-badge";

type StoryMeta = { id: string; title?: string; count?: number };

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await get<StoryMeta[]>("stories")) || [];
        if (!mounted) return;
        setStories(saved);

        // load preview (first item src) for each story
        const previewEntries = await Promise.all(
          saved.map(async (s) => {
            try {
              const items = (await get<any>(`story:${s.id}`)) || [];
              const first = Array.isArray(items) && items.length > 0 ? items[0] : (items && items.items && items.items[0]) || null;
              const src = first ? (first.src || first) : null;
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
        logger.error("Failed to load stories", err);
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
    document.title = "matrix - stories";
    return () => {
      document.title = prev ?? "matrix";
    };
  }, []);

  return (
    <ContentLayout title="Stories" navLeft={null}>
      <div className="overflow-auto" style={{ height: 'calc(100vh - var(--app-header-height, 56px))' }}>
        <div className="py-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : stories.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No stories yet. Create one from the heap.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {stories.map((s) => (
                <Link
                  key={s.id}
                  href={`/stories/${s.id}`}
                  className="block border rounded-lg overflow-hidden shadow-sm transition-transform duration-150 ease-out transform hover:-translate-y-1 hover:-translate-x-1 hover:shadow-lg active:translate-y-1 active:translate-x-1 active:shadow-sm mc-shadow-hover mc-shadow-active"
                >
                  <div className="bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden">
                    {previews[s.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previews[s.id] || undefined} alt={s.title ?? "story"} className="w-full h-auto object-contain" />
                    ) : (
                      <div className="text-sm text-muted-foreground">No preview</div>
                    )}
                  </div>
                  <div className="p-4 flex items-center justify-between">
                    <div className="font-medium truncate">{s.title && s.title.trim() ? s.title : "Untitled"}</div>
                    <CountBadge value={s.count ?? 0} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </ContentLayout>
  );
}
