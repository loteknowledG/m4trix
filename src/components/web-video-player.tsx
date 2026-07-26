'use client';

import { useEffect, useRef, useState } from 'react';
import { getEmbedUrl, getVideoEmbedKind } from '@/lib/video-utils';
import { cn } from '@/lib/utils';

type WebVideoPlayerProps = {
  src: string;
  autoPlay?: boolean;
  className?: string;
  onEnded?: () => void;
};

export default function WebVideoPlayer({
  src,
  autoPlay = false,
  className,
  onEnded,
}: WebVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const embedKind = getVideoEmbedKind(src);
  const embedUrl = embedKind !== 'direct' ? getEmbedUrl(src) : null;

  useEffect(() => {
    setError(null);
  }, [src]);

  useEffect(() => {
    if (embedKind !== 'direct' || !videoRef.current) return;
    const video = videoRef.current;
    if (autoPlay) {
      void video.play().catch(() => {
        /* autoplay may be blocked */
      });
    }
  }, [src, autoPlay, embedKind]);

  if (!src) {
    return (
      <div
        className={cn(
          'flex aspect-video w-full items-center justify-center rounded-xl bg-zinc-900 text-sm text-muted-foreground',
          className
        )}
      >
        Select a video from the deck below
      </div>
    );
  }

  if (embedUrl) {
    return (
      <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-black', className)}>
        <iframe
          key={embedUrl}
          src={embedUrl}
          title="Video player"
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={cn('relative aspect-video w-full overflow-hidden rounded-xl bg-black', className)}>
      <video
        ref={videoRef}
        key={src}
        src={src}
        controls
        playsInline
        autoPlay={autoPlay}
        className="h-full w-full"
        onError={() => setError('Unable to play this video')}
        onEnded={onEnded}
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-sm text-white">
          {error}
        </div>
      )}
    </div>
  );
}
