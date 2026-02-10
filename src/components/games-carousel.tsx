'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { get } from 'idb-keyval';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';

type StoryMeta = { id: string; title?: string; count?: number };

export default function GamesCarousel() {
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

        const previewEntries = await Promise.all(
          saved.map(async s => {
            try {
              const items = (await get<any>(`story:${s.id}`)) || [];
              const first =
                Array.isArray(items) && items.length > 0
                  ? items[0]
                  : items && items.items && items.items[0]
                  ? items.items[0]
                  : null;
              const src = first ? first.src || first : null;
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
        console.error('Failed to load stories', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return <div className="text-center text-gray-300">Loading...</div>;
  }

  if (stories.length === 0) {
    return <div className="text-center text-gray-300">No stories yet</div>;
  }

  return (
    <Carousel className="w-full overflow-visible" opts={{ loop: true }}>
      <CarouselContent>
        {stories.map(story => (
          <CarouselItem key={story.id}>
            <Link href={`/stories/${story.id}`}>
              <div className="w-[72%] max-w-[380px] aspect-square bg-zinc-800 rounded-lg cursor-pointer overflow-hidden flex items-center justify-center mx-auto">
                {previews[story.id] ? (
                  <img
                    src={previews[story.id] || undefined}
                    alt={story.title ?? 'story'}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    No preview
                  </div>
                )}
              </div>
            </Link>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-1 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/40 hover:bg-black/60 z-10" />
      <CarouselNext className="right-1 top-1/2 -translate-y-1/2 h-12 w-12 bg-black/40 hover:bg-black/60 z-10" />
    </Carousel>
  );
}
