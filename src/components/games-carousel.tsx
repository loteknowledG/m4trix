'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { safeGet } from '@/lib/storage-compat';
import { storyPreviewMap, type StoryMeta } from '@/lib/stories';

type GamesCarouselProps = {
  onTitleChange?: (title: string) => void;
};

const CLICK_MOVE_THRESHOLD_PX = 8;

function gameHref(storyId: string) {
  return `/games/new/?game=${encodeURIComponent(storyId)}`;
}

export default function GamesCarousel({ onTitleChange }: GamesCarouselProps) {
  const router = useRouter();
  const [stories, setStories] = useState<StoryMeta[]>([]);
  const [previews, setPreviews] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [emblaApi, setEmblaApi] = useState<any | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);

  const setTitleFromIndex = useCallback(
    (index: number) => {
      const title = stories[index]?.title || 'Games';
      onTitleChange?.(title);
    },
    [stories, onTitleChange]
  );

  useEffect(() => {
    for (const story of stories) {
      router.prefetch(gameHref(story.id));
    }
  }, [router, stories]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const saved = (await safeGet<StoryMeta[]>('stories')) || [];
        if (!mounted) return;
        setStories(saved);
        setPreviews(storyPreviewMap(saved));
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

  const openGame = useCallback(
    (storyId: string) => {
      router.push(gameHref(storyId));
    },
    [router]
  );

  const handlePointerDown = (event: React.PointerEvent) => {
    pointerDownRef.current = { x: event.clientX, y: event.clientY };
  };

  const handleSlideClick = (event: React.MouseEvent, storyId: string) => {
    const start = pointerDownRef.current;
    pointerDownRef.current = null;
    if (start) {
      const moved = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (moved > CLICK_MOVE_THRESHOLD_PX) return;
    }
    // Embla swallows <Link> navigations after tiny drag movements — force open.
    event.preventDefault();
    openGame(storyId);
  };

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
            <button
              type="button"
              className="h-[100vh] w-full max-w-full bg-zinc-800 rounded-lg cursor-pointer overflow-hidden flex items-center justify-center mx-auto border-0 p-0"
              aria-label={`Open game ${story.title || story.id}`}
              onPointerDown={handlePointerDown}
              onClick={event => handleSlideClick(event, story.id)}
            >
              {previews[story.id] ? (
                (previews[story.id] || '').endsWith('.mp4') ? (
                  <video
                    src={previews[story.id] || undefined}
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="h-full w-auto object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <img
                    src={previews[story.id] || undefined}
                    alt={story.title ?? 'story'}
                    className="h-full w-auto object-contain pointer-events-none"
                    draggable={false}
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  No preview
                </div>
              )}
            </button>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="left-1 top-[54%] -mt-6 z-10" buttonClassName="bg-[#c90084]/80 text-white hover:bg-[#c90084]" />
      <CarouselNext className="right-1 top-[54%] -mt-6 z-10" buttonClassName="bg-[#c90084]/80 text-white hover:bg-[#c90084]" />
    </Carousel>
  );
}
