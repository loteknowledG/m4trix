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
      <DialogContent className="sm:max-w-[420px] max-h-[95vh] p-0 overflow-hidden flex flex-col bg-zinc-950 border-zinc-800 shadow-2xl">
        <DialogHeader className="p-4 border-b border-zinc-900 bg-zinc-950/50 backdrop-blur-md shrink-0">
          <DialogTitle className="text-sm font-medium text-zinc-100 font-mono tracking-tight uppercase flex items-center gap-2">
            <DialogDescription className="sr-only">Crop the selected image for avatar</DialogDescription>
            {isGif && (
              <span className="bg-amber-500/20 text-amber-500 text-[9px] px-1.5 py-0.5 rounded leading-none">
                GIF
              </span>
            )}
            Crop Avatar
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto relative bg-zinc-950 flex justify-center py-8">
          <div
            className={cn(
              'relative aspect-square w-[400px] h-[400px] shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden select-none touch-none',
              isHoveringEdge ? 'cursor-nwse-resize' : 'cursor-move'
            )}
            onPointerMove={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const dist = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
              );
              setIsHoveringEdge(dist > 145 && dist < 180);
            }}
            onWheel={e => {
              e.preventDefault();
              const zoomSpeed = 0.001;
              const newZoom = Math.min(Math.max(crop.zoom - e.deltaY * zoomSpeed, 1), 10);
              setCrop(prev => ({ ...prev, zoom: newZoom }));
            }}
            onPointerDown={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const centerX = rect.left + rect.width / 2;
              const centerY = rect.top + rect.height / 2;
              const distCenter = Math.sqrt(
                Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2)
              );

              if (distCenter > 145 && distCenter < 180) {
                const startDist = distCenter;
                const startZoom = crop.zoom;
                const onPointerMove = (moveEvent: PointerEvent) => {
                  const newDist = Math.sqrt(
                    Math.pow(moveEvent.clientX - centerX, 2) +
                      Math.pow(moveEvent.clientY - centerY, 2)
                  );
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
                  'w-full h-full object-contain max-w-none pointer-events-none',
                  `[transform:translate(${crop.x}px,_${crop.y}px)_scale(${crop.zoom})]`
                )}
              />
            )}

            <div className="absolute top-4 right-4 z-30 pointer-events-none">
              <div className="bg-black/60 backdrop-blur-md border border-white/10 px-2 py-1 rounded text-[10px] font-mono text-white/80 shadow-xl">
                {Math.round(crop.zoom * 100)}%
              </div>
            </div>

            <div className="absolute inset-0 z-20 overflow-hidden pointer-events-none">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[320px] aspect-square rounded-full border border-white/40 shadow-[0_0_0_1000px_rgba(0,0,0,0.3)]" />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-zinc-950 border-t border-zinc-900 shrink-0">
          <DialogFooter className="flex items-center gap-2 sm:gap-0 justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
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
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
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
