'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import { Marquee } from '@/components/ui/marquee';
import { getVideoThumbnail } from '@/lib/video-utils';
import type { PlaylistVideo } from '@/lib/playlists';
import { cn } from '@/lib/utils';

type PlaylistRollerDeckProps = {
  videos: PlaylistVideo[];
  selectedId: string | null;
  onSelect: (videoId: string) => void;
  className?: string;
};

export default function PlaylistRollerDeck({
  videos,
  selectedId,
  onSelect,
  className,
}: PlaylistRollerDeckProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const scrollToVideo = useCallback(
    (videoId: string) => {
      const idx = videos.findIndex(v => v.id === videoId);
      if (idx >= 0 && api) {
        api.scrollTo(idx);
      }
    },
    [api, videos]
  );

  useEffect(() => {
    if (!api) return;

    const onSelectSlide = () => {
      const idx = api.selectedScrollSnap();
      setSelectedIndex(idx);
      const video = videos[idx];
      if (video && video.id !== selectedId) {
        onSelect(video.id);
      }
    };

    onSelectSlide();
    api.on('select', onSelectSlide);
    api.on('reInit', onSelectSlide);
    return () => {
      api.off('select', onSelectSlide);
      api.off('reInit', onSelectSlide);
    };
  }, [api, videos, selectedId, onSelect]);

  useEffect(() => {
    if (!selectedId) return;
    scrollToVideo(selectedId);
  }, [selectedId, scrollToVideo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!api) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        api.scrollPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        api.scrollNext();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [api]);

  if (videos.length === 0) {
    return (
      <div className={cn('py-8 text-center text-sm text-muted-foreground', className)}>
        No videos in this playlist yet. Add a URL or upload below.
      </div>
    );
  }

  return (
    <div className={cn('w-full px-2', className)}>
      <Carousel
        setApi={setApi}
        opts={{
          align: 'center',
          containScroll: 'keepSnaps',
          loop: videos.length > 1,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {videos.map((video, index) => {
            const isCenter = index === selectedIndex;
            return (
              <CarouselItem
                key={video.id}
                className="basis-[55%] sm:basis-[45%] md:basis-[35%] lg:basis-[28%] pl-2 md:pl-4"
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect(video.id);
                    api?.scrollTo(index);
                  }}
                  className={cn(
                    'group w-full overflow-hidden rounded-xl border-2 border-border bg-card text-left shadow-[2px_2px_0_0_hsl(var(--foreground))] transition-all duration-200 ease-out',
                    isCenter
                      ? 'scale-100 opacity-100 ring-2 ring-primary/60'
                      : 'scale-[0.88] opacity-60 hover:opacity-80'
                  )}
                >
                  <div className="relative aspect-video w-full overflow-hidden bg-zinc-900">
                    <img
                      src={getVideoThumbnail(video.src)}
                      alt={video.name || 'Video thumbnail'}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="px-2 py-2">
                    <Marquee className="text-xs font-medium">
                      {video.name?.trim() ? video.name : 'Untitled'}
                    </Marquee>
                  </div>
                </button>
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </div>
  );
}
