export type CropRect = { x: number; y: number; zoom: number };

/** Logical crop workspace — preview scales to any pixel size from this. */
export const AVATAR_CROP_WORKSPACE = 400;

/** Crop circle diameter in workspace units (80% of workspace). */
export const AVATAR_CROP_CIRCLE = 320;

export function clampCropZoom(zoom: number): number {
  return Math.min(Math.max(zoom, 1), 10);
}

/** CSS transform for the crop preview image — same math everywhere we show a framed portrait. */
export function avatarCropPreviewTransform(crop: CropRect, workspacePx: number) {
  const zoom = clampCropZoom(crop.zoom);
  const workspaceScale = workspacePx / AVATAR_CROP_WORKSPACE;
  // translate(...) scale(zoom) applies scale first; effective pan is crop * zoom^2.
  return {
    translateX: crop.x * zoom * zoom * workspaceScale,
    translateY: crop.y * zoom * zoom * workspaceScale,
    scale: zoom,
  };
}

export function avatarCropPreviewStyle(crop: CropRect, workspacePx: number) {
  const { translateX, translateY, scale } = avatarCropPreviewTransform(crop, workspacePx);
  return {
    transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
    transformOrigin: 'center center',
  } as const;
}

/** Portrait display for GIF crops — same layout as the crop dialog (object-contain + circle). */
export function avatarCropPortraitStyle(crop: CropRect, circleDiameterPx: number) {
  const workspacePx = circleDiameterPx / (AVATAR_CROP_CIRCLE / AVATAR_CROP_WORKSPACE);
  return avatarCropPreviewStyle(crop, workspacePx);
}

export function avatarCropPortraitWorkspacePx(circleDiameterPx: number) {
  return circleDiameterPx / (AVATAR_CROP_CIRCLE / AVATAR_CROP_WORKSPACE);
}
