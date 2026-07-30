'use client';

import { forwardRef } from 'react';
import { isMomentVideoSrc, normalizeMomentSrc } from '@/lib/moments';
import { cn } from '@/lib/utils';

type MomentMediaProps = {
  src: string;
  alt?: string;
  className?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  playsInline?: boolean;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
  onClick?: (event: React.MouseEvent<HTMLImageElement | HTMLVideoElement>) => void;
};

export const MomentMedia = forwardRef<HTMLImageElement | HTMLVideoElement, MomentMediaProps>(
  function MomentMedia(
    {
      src,
      alt = 'moment',
      className,
      autoPlay = false,
      loop = true,
      muted = true,
      controls = false,
      playsInline = true,
      referrerPolicy = 'no-referrer',
      onClick,
    },
    ref,
  ) {
    const normalized = normalizeMomentSrc(src);

    if (isMomentVideoSrc(normalized)) {
      return (
        <video
          ref={ref as React.Ref<HTMLVideoElement>}
          src={normalized}
          className={cn(className)}
          autoPlay={autoPlay}
          loop={loop}
          muted={muted}
          controls={controls}
          playsInline={playsInline}
          preload="metadata"
          draggable={false}
          onDragStart={(event) => event.preventDefault()}
          onClick={onClick}
        />
      );
    }

    return (
      <img
        ref={ref as React.Ref<HTMLImageElement>}
        src={normalized}
        alt={alt}
        referrerPolicy={referrerPolicy}
        className={className}
        draggable={false}
        onDragStart={(event) => event.preventDefault()}
        onClick={onClick}
      />
    );
  },
);
