'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { get } from 'idb-keyval';
import { logger } from '@/lib/logger';
import { ContentLayout } from '@/components/admin-panel/content-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Marquee } from '@/components/ui/marquee';
// removed unused imports
import CountBadge from '@/components/ui/count-badge';

type StoryMeta = { id: string; title?: string; count?: number; titleMomentId?: string };

export default function StoriesPage() {
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);

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
      <ContentLayout title="Stories" navLeft={null}>
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
                  <Link key={s.id} href={`/stories/${s.id}`}>
                    <Card className="overflow-hidden hover:shadow-2xl transition-shadow duration-150 transition-transform duration-150 ease-out hover:-translate-y-2 hover:-translate-x-2 active:translate-y-2 active:translate-x-2 cursor-pointer">
                      <div className="relative">
                        {previews[s.id] ? (
                          <img
                            src={previews[s.id] || undefined}
                            alt={s.title ?? 'story'}
                            className="w-full h-32 object-cover"
                          />
                        ) : (
                          <div className="h-32 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-sm text-muted-foreground">
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
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </ContentLayout>
    </>
  );
}
