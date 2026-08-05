'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AVATAR_CROP_WORKSPACE,
  avatarCropPortraitWorkspacePx,
  avatarCropPreviewTransform,
  objectContainLayout,
  renderAvatarCropWorkspace,
  type CropRect,
} from '@/app/(site)/characters/avatar-crop-math';
import { cn } from '@/lib/utils';

type AvatarCropWorkspaceViewProps = {
  src: string;
  crop: CropRect;
  /** Rendered square size in CSS pixels. */
  displayPx: number;
  className?: string;
  /** When true, keep an animated GIF playing via img + letterbox layout. */
  animated?: boolean;
};

function useImageDimensions(src: string) {
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      setDims({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      if (!cancelled) setDims(null);
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src]);

  return dims;
}

function isAnimatedImageSrc(src: string) {
  return src.startsWith('data:image/gif') || /\.gif($|\?)/i.test(src);
}

/** Single renderer for crop preview and saved portraits — letterbox + zoom/pan. */
export function AvatarCropWorkspaceView({
  src,
  crop,
  displayPx,
  className,
  animated = false,
}: AvatarCropWorkspaceViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [imageReady, setImageReady] = useState(false);
  const dims = useImageDimensions(src);
  const scale = displayPx / AVATAR_CROP_WORKSPACE;

  useEffect(() => {
    if (animated) {
      imageRef.current = null;
      setImageReady(false);
      return;
    }

    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (cancelled) return;
      imageRef.current = img;
      setImageReady(true);
    };
    img.onerror = () => {
      if (!cancelled) {
        imageRef.current = null;
        setImageReady(false);
      }
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
  }, [src, animated]);

  useEffect(() => {
    if (animated || !imageReady || !dims) return;
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    canvas.width = AVATAR_CROP_WORKSPACE;
    canvas.height = AVATAR_CROP_WORKSPACE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderAvatarCropWorkspace(ctx, img, dims.width, dims.height, crop);
  }, [animated, crop, dims, imageReady]);

  if (!dims) {
    return (
      <div
        className={cn('bg-zinc-900', className)}
        style={{ width: displayPx, height: displayPx }}
        aria-hidden
      />
    );
  }

  if (animated) {
    const layout = objectContainLayout(dims.width, dims.height, AVATAR_CROP_WORKSPACE);
    const { translateX, translateY, scale: zoom, center } = avatarCropPreviewTransform(crop);

    return (
      <div
        className={cn('relative overflow-hidden', className)}
        style={{ width: displayPx, height: displayPx }}
      >
        <div
          className="absolute left-0 top-0 origin-top-left"
          style={{
            width: AVATAR_CROP_WORKSPACE,
            height: AVATAR_CROP_WORKSPACE,
            transform: `scale(${scale})`,
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate(${translateX}px, ${translateY}px) scale(${zoom})`,
              transformOrigin: `${center}px ${center}px`,
            }}
          >
            <img
              src={src}
              alt=""
              draggable={false}
              className="pointer-events-none max-w-none"
              style={{
                position: 'absolute',
                left: layout.offsetX,
                top: layout.offsetY,
                width: layout.displayWidth,
                height: layout.displayHeight,
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{ width: displayPx, height: displayPx }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 max-w-none origin-top-left"
        style={{
          width: AVATAR_CROP_WORKSPACE,
          height: AVATAR_CROP_WORKSPACE,
          transform: `scale(${scale})`,
        }}
      />
    </div>
  );
}

type AvatarCropPortraitProps = {
  src: string;
  crop: CropRect;
  /** Visible circle diameter in pixels. */
  sizePx: number;
  className?: string;
};

/** Circular mask over the shared crop workspace renderer. */
export function AvatarCropPortrait({ src, crop, sizePx, className }: AvatarCropPortraitProps) {
  const workspacePx = avatarCropPortraitWorkspacePx(sizePx);
  const workspaceOffsetPx = (sizePx - workspacePx) / 2;

  return (
    <div
      className={cn('relative overflow-hidden rounded-full', className)}
      style={{ width: sizePx, height: sizePx }}
    >
      <div
        className="absolute"
        style={{
          width: workspacePx,
          height: workspacePx,
          left: workspaceOffsetPx,
          top: workspaceOffsetPx,
        }}
      >
        <AvatarCropWorkspaceView
          src={src}
          crop={crop}
          displayPx={workspacePx}
          animated={isAnimatedImageSrc(src)}
        />
      </div>
    </div>
  );
}
