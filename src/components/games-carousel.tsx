'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { pressableClass } from '@/components/ui/pressable';
import { safeGet } from '@/lib/storage-compat';

type StoryMeta = { id: string; title?: string; count?: number };

type GamesCarouselProps = {
  onTitleChange?: (title: string) => void;
};

export default function GamesCarousel({ onTitleChange }: GamesCarouselProps) {
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [emblaApi, setEmblaApi] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const setTitleFromIndex = useCallback(
    (index: number) => {
      const title = stories[index]?.title || 'Games';
      onTitleChange?.(title);
    },
    [stories, onTitleChange]
  );

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await safeGet<any[]>('stories')) || [];
        if (!mounted) return;
        setStories(saved);

        // load preview (title moment src if set, else first item src) for each story
        const previewEntries = await Promise.all(
          saved.map(async s => {
            try {
              const items = (await safeGet<any>(`story:${s.id}`)) || [];
              // Check for titleMomentId in story meta or object
              const titleMomentId = s.titleMomentId || (items && items.titleMomentId);
              let momentsArr = Array.isArray(items)
                ? items
                : items && Array.isArray(items.items)
                ? items.items
                : [];
              let src = null;
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

        setCurrentIndex(0);
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

  useEffect(() => {
    if (!stories.length) return;
    setTitleFromIndex(currentIndex);
  }, [stories, currentIndex, setTitleFromIndex]);

  useEffect(() => {
    if (!emblaApi) return;

    const onSelect = () => {
      const idx = emblaApi.selectedScrollSnap();
      setCurrentIndex(idx);
    };

    emblaApi.on('select', onSelect);
    onSelect();

    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi]);

  if (loading) {
    return <div className="text-center text-gray-300">Loading...</div>;
  }

  if (stories.length === 0) {
    return <div className="text-center text-gray-300">No stories yet</div>;
  }

  return (
    <Carousel
      className="w-full h-[100vh] overflow-visible bg-zinc-800"
      opts={{ loop: true }}
      setApi={setEmblaApi}
    >
      <CarouselContent>
        {stories.map(story => (
          <CarouselItem key={story.id}>
            <Link href={`/games/new?game=${encodeURIComponent(story.id)}`}>
              <div className="h-[100vh] w-full max-w-full bg-zinc-800 rounded-lg cursor-pointer overflow-hidden flex items-center justify-center mx-auto">
                {previews[story.id] ? (
                  <img
                    src={previews[story.id] || undefined}
                    alt={story.title ?? 'story'}
                    className="h-full w-auto object-contain"
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
      <CarouselPrevious
        className="left-1 top-[54%] -mt-6 z-10"
        buttonClassName={`h-12 w-12 bg-[#c90084]/80 ${pressableClass}`}
      />
      <CarouselNext
        className="right-1 top-[54%] -mt-6 z-10"
        buttonClassName={`h-12 w-12 bg-[#c90084]/80 ${pressableClass}`}
      />
    </Carousel>
  );
}
