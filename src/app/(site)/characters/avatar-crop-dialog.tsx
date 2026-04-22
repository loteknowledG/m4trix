import type { Dispatch, SetStateAction } from 'react';
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

type Crop = { x: number; y: number; zoom: number };

type AvatarCropDialogProps = {
  crop: Crop;
  croppingImage: string | null;
  isGif: boolean;
  isHoveringEdge: boolean;
  onApplyCrop: () => void | Promise<void>;
  onApplyGifImmediately: () => void;
  onClose: () => void;
  open: boolean;
  setCrop: Dispatch<SetStateAction<Crop>>;
  setIsHoveringEdge: Dispatch<SetStateAction<boolean>>;
};

/** Original UI was 400px; edge zoom ring used 145–180px from center. */
const UI_BASE = 400;
const EDGE_INNER = 145 / UI_BASE;
const EDGE_OUTER = 180 / UI_BASE;

export function AvatarCropDialog({
  crop,
  croppingImage,
  isGif,
  isHoveringEdge,
  onApplyCrop,
  onApplyGifImmediately,
  onClose,
  open,
  setCrop,
  setIsHoveringEdge,
}: AvatarCropDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent
        className={cn(
          'fixed left-0 top-0 z-50 flex h-[100dvh] w-screen max-h-none max-w-none translate-x-0 translate-y-0 flex-col rounded-none border-0 bg-zinc-950 p-0 shadow-none',
          'gap-0 overflow-hidden data-[state=closed]:slide-out-to-left-0 data-[state=closed]:slide-out-to-top-0',
          'data-[state=open]:slide-in-from-left-0 data-[state=open]:slide-in-from-top-0 sm:left-0 sm:top-0 sm:max-w-none sm:translate-x-0 sm:translate-y-0 sm:rounded-none'
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
            className={cn(
              'relative aspect-square w-[min(92vmin,720px)] max-w-full shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 select-none touch-none',
              isHoveringEdge ? 'cursor-nwse-resize' : 'cursor-move'
            )}
            onPointerMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const w = rect.width;
              const centerX = rect.left + w / 2;
              const centerY = rect.top + rect.height / 2;
              const dist = Math.hypot(e.clientX - centerX, e.clientY - centerY);
              const inner = w * EDGE_INNER;
              const outer = w * EDGE_OUTER;
              setIsHoveringEdge(dist > inner && dist < outer);
            }}
            onWheel={e => {
              e.preventDefault();
              const zoomSpeed = 0.001;
              const newZoom = Math.min(Math.max(crop.zoom - e.deltaY * zoomSpeed, 1), 10);
              setCrop(prev => ({ ...prev, zoom: newZoom }));
            }}
            onPointerDown={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const w = rect.width;
              const centerX = rect.left + w / 2;
              const centerY = rect.top + rect.height / 2;
              const distCenter = Math.hypot(e.clientX - centerX, e.clientY - centerY);
              const inner = w * EDGE_INNER;
              const outer = w * EDGE_OUTER;

              if (distCenter > inner && distCenter < outer) {
                const startDist = distCenter;
                const startZoom = crop.zoom;
                const onPointerMove = (moveEvent: PointerEvent) => {
                  const newDist = Math.hypot(moveEvent.clientX - centerX, moveEvent.clientY - centerY);
                  const ratio = newDist / startDist;
                  const newZoom = Math.min(Math.max(startZoom / ratio, 1), 10);
                  setCrop(prev => ({ ...prev, zoom: newZoom }));
                };
                const onPointerUp = () => {
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);
                };
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
              } else {
                const startX = e.clientX - crop.x;
                const startY = e.clientY - crop.y;
                const onPointerMove = (moveEvent: PointerEvent) => {
                  setCrop(prev => ({
                    ...prev,
                    x: moveEvent.clientX - startX,
                    y: moveEvent.clientY - startY,
                  }));
                };
                const onPointerUp = () => {
                  window.removeEventListener('pointermove', onPointerMove);
                  window.removeEventListener('pointerup', onPointerUp);
                };
                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
              }
            }}
          >
            {croppingImage && (
              <img
                src={croppingImage}
                alt="Crop preview"
                className={cn(
                  'pointer-events-none h-full w-full max-w-none object-contain',
                  `[transform:translate(${crop.x}px,_${crop.y}px)_scale(${crop.zoom})]`
                )}
              />
            )}

            <div className="pointer-events-none absolute right-4 top-4 z-30">
              <div className="rounded border border-white/10 bg-black/60 px-2 py-1 font-mono text-[10px] text-white/80 shadow-xl backdrop-blur-md">
                {Math.round(crop.zoom * 100)}%
              </div>
            </div>

            <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="aspect-square w-[80%] rounded-full border border-white/40 shadow-[0_0_0_100vmax_rgba(0,0,0,0.35)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-zinc-900 bg-zinc-950 p-4 sm:p-6">
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
                  onClick={onApplyGifImmediately}
                >
                  Skip Crop
                </Button>
              )}
              <Button
                size="sm"
                className="bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary/90"
                onClick={onApplyCrop}
              >
                {isGif ? 'Apply Animated Crop' : 'Apply Crop'}
              </Button>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
