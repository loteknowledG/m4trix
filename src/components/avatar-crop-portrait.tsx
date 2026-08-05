'use client';

import {
  avatarCropPortraitStyle,
  avatarCropPortraitWorkspacePx,
  type CropRect,
} from '@/app/(site)/characters/avatar-crop-math';
import { cn } from '@/lib/utils';

type AvatarCropPortraitProps = {
  src: string;
  crop: CropRect;
  /** Visible circle diameter in pixels. */
  sizePx: number;
  alt?: string;
  className?: string;
  imageClassName?: string;
};

/** Mask the source image with the same crop frame used in the crop dialog. */
export function AvatarCropPortrait({
  src,
  crop,
  sizePx,
  alt = '',
  className,
  imageClassName,
}: AvatarCropPortraitProps) {
  const workspacePx = avatarCropPortraitWorkspacePx(sizePx);
  const workspaceOffsetPx = (sizePx - workspacePx) / 2;

  return (
    <div
      className={cn('relative overflow-hidden rounded-full', className)}
      style={{ width: sizePx, height: sizePx }}
    >
      <div
        className="absolute aspect-square"
        style={{
          width: workspacePx,
          height: workspacePx,
          left: workspaceOffsetPx,
          top: workspaceOffsetPx,
        }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className={cn('pointer-events-none h-full w-full max-w-none object-contain', imageClassName)}
          style={avatarCropPortraitStyle(crop, sizePx)}
        />
      </div>
    </div>
  );
}
