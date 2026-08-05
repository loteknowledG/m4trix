'use client';

import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  AVATAR_CROP_WORKSPACE,
  clampCropZoom,
} from '@/app/(site)/characters/avatar-crop-math';
import { AvatarCropWorkspaceView } from '@/components/avatar-crop-portrait';

type Crop = { x: number; y: number; zoom: number };

type AvatarCropDialogProps = {
  crop: Crop;
  croppingImage: string | null;
  isGif: boolean;
  isHoveringEdge: boolean;
  onApplyCrop: () => void | Promise<void>;
  onApplyGifImmediately: () => void | Promise<void>;
  onClose: () => void;
  open: boolean;
  isApplying?: boolean;
  setCrop: Dispatch<SetStateAction<Crop>>;
  setIsHoveringEdge: Dispatch<SetStateAction<boolean>>;
};

export function AvatarCropDialog({
  crop,
  croppingImage,
  isGif,
  isApplying = false,
  isHoveringEdge: _isHoveringEdge,
  onApplyCrop,
  onApplyGifImmediately,
  onClose,
  open,
  setCrop,
  setIsHoveringEdge,
}: AvatarCropDialogProps) {
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [workspacePx, setWorkspacePx] = useState(AVATAR_CROP_WORKSPACE);

  useEffect(() => {
    if (!open) return;
    const element = workspaceRef.current;
    if (!element) return;

    const updateSize = () => {
      setWorkspacePx(element.getBoundingClientRect().width);
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [open, croppingImage]);

  const startPan = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;

    e.preventDefault();
    const workspace = e.currentTarget;
    workspace.setPointerCapture(e.pointerId);
    setIsHoveringEdge(false);

    const rect = workspace.getBoundingClientRect();
    const scale = rect.width / AVATAR_CROP_WORKSPACE;
    const startCropX = crop.x;
    const startCropY = crop.y;
    const startClientX = e.clientX;
    const startClientY = e.clientY;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = (moveEvent.clientX - startClientX) / scale;
      const dy = (moveEvent.clientY - startClientY) / scale;
      setCrop(prev => ({
        ...prev,
        x: startCropX + dx,
        y: startCropY + dy,
      }));
    };

    const onUp = (upEvent: PointerEvent) => {
      workspace.releasePointerCapture(upEvent.pointerId);
      workspace.removeEventListener('pointermove', onMove);
      workspace.removeEventListener('pointerup', onUp);
      workspace.removeEventListener('pointercancel', onUp);
    };

    workspace.addEventListener('pointermove', onMove);
    workspace.addEventListener('pointerup', onUp);
    workspace.addEventListener('pointercancel', onUp);
  };

  const startResize = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const handle = e.currentTarget;
    handle.setPointerCapture(e.pointerId);
    setIsHoveringEdge(true);

    const startX = e.clientX;
    const startZoom = crop.zoom;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      const newZoom = clampCropZoom(startZoom + dx * 0.012);
      setCrop(prev => ({ ...prev, zoom: newZoom }));
    };

    const onUp = (upEvent: PointerEvent) => {
      handle.releasePointerCapture(upEvent.pointerId);
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      setIsHoveringEdge(false);
    };

    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] w-screen max-h-none max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 bg-zinc-950 p-0 shadow-none',
          'gap-0 overflow-hidden data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0',
          'data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:left-0 sm:top-0 sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none',
        )}
      >
        <DialogHeader className="shrink-0 border-b border-zinc-900 bg-zinc-950/50 p-4 backdrop-blur-md">
          <DialogTitle className="flex items-center gap-2 font-mono text-sm font-medium uppercase tracking-tight text-zinc-100">
            <DialogDescription className="sr-only">Crop the selected image for avatar</DialogDescription>
            {isGif && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 text-[9px] leading-none text-amber-500">
                GIF
              </span>
            )}
            Crop Avatar
          </DialogTitle>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-zinc-950 p-4">
          <div
            ref={workspaceRef}
            className="relative aspect-square w-[min(92vmin,720px)] max-w-full shrink-0 cursor-move touch-none select-none overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
            onPointerDown={startPan}
            onWheel={e => {
              e.preventDefault();
              const zoomSpeed = 0.001;
              const newZoom = clampCropZoom(crop.zoom - e.deltaY * zoomSpeed);
              setCrop(prev => ({ ...prev, zoom: newZoom }));
            }}
          >
            {croppingImage ? (
              <AvatarCropWorkspaceView
                src={croppingImage}
                crop={crop}
                displayPx={workspacePx}
                animated={isGif}
                className="pointer-events-none absolute inset-0"
              />
            ) : null}

            <div className="pointer-events-none absolute right-4 top-4 z-30">
              <div className="rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] text-white/80 shadow-xl backdrop-blur-md">
                {Math.round(crop.zoom * 100)}%
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
              <div className="relative aspect-square w-[80%]">
                <div className="absolute inset-0 rounded-full border-2 border-white/50 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
                <button
                  type="button"
                  data-resize-handle
                  aria-label="Drag to resize portrait"
                  title="Drag to resize"
                  className="pointer-events-auto absolute right-0 top-1/2 z-30 h-6 w-6 -translate-y-1/2 translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-cyan-500 shadow-lg touch-none hover:bg-cyan-400 active:scale-110"
                  onPointerDown={startResize}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-900 bg-zinc-950 p-4 sm:p-6">
          <label className="mb-4 flex items-center gap-3 px-1">
            <span className="shrink-0 text-[11px] uppercase tracking-wide text-zinc-500">Zoom</span>
            <input
              type="range"
              min={100}
              max={1000}
              step={5}
              value={Math.round(crop.zoom * 100)}
              onChange={event =>
                setCrop(prev => ({
                  ...prev,
                  zoom: clampCropZoom(Number(event.target.value) / 100),
                }))
              }
              className="w-full"
              aria-label="Portrait zoom"
            />
            <span className="w-10 shrink-0 text-right font-mono text-[11px] text-zinc-400">
              {Math.round(crop.zoom * 100)}%
            </span>
          </label>

          <DialogFooter className="flex items-center justify-between gap-2 sm:gap-0">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 transition-colors hover:text-zinc-300"
              onClick={onClose}
            >
              Cancel
            </Button>
            <div className="flex items-center gap-2">
              {isGif && (
                <Button
                  variant="outline"
                  size="sm"
                  className="border-zinc-800 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
                  disabled={isApplying}
                  onClick={() => void onApplyGifImmediately()}
                >
                  Skip Crop
                </Button>
              )}
              <Button
                size="sm"
                className="bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
                disabled={isApplying}
                onClick={() => void onApplyCrop()}
              >
                {isApplying ? 'Saving…' : isGif ? 'Apply Animated Crop' : 'Apply Crop'}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
