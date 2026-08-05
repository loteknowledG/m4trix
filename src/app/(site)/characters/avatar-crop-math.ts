export type CropRect = { x: number; y: number; zoom: number };

/** Logical crop workspace — pan/zoom coords and layout math use this size. */
export const AVATAR_CROP_WORKSPACE = 400;

/** Crop circle diameter in workspace units (80% of workspace). */
export const AVATAR_CROP_CIRCLE = 320;

export function clampCropZoom(zoom: number): number {
  return Math.min(Math.max(zoom, 1), 10);
}

export function objectContainLayout(
  imageWidth: number,
  imageHeight: number,
  workspaceSize = AVATAR_CROP_WORKSPACE,
) {
  const scaleToFit = Math.min(workspaceSize / imageWidth, workspaceSize / imageHeight);
  const displayWidth = imageWidth * scaleToFit;
  const displayHeight = imageHeight * scaleToFit;
  const offsetX = (workspaceSize - displayWidth) / 2;
  const offsetY = (workspaceSize - displayHeight) / 2;
  return { scaleToFit, displayWidth, displayHeight, offsetX, offsetY };
}

/** Pan offset after zoom — matches canvas transform order (scale around center, then pan). */
export function avatarCropPreviewTransform(crop: CropRect, workspaceSize = AVATAR_CROP_WORKSPACE) {
  const zoom = clampCropZoom(crop.zoom);
  return {
    translateX: crop.x * zoom * zoom,
    translateY: crop.y * zoom * zoom,
    scale: zoom,
    center: workspaceSize / 2,
  };
}

export function avatarCropPortraitWorkspacePx(circleDiameterPx: number) {
  return circleDiameterPx / (AVATAR_CROP_CIRCLE / AVATAR_CROP_WORKSPACE);
}

/** Draw the crop workspace the same way everywhere (preview, profile, sidebar). */
export function renderAvatarCropWorkspace(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  crop: CropRect,
  workspaceSize = AVATAR_CROP_WORKSPACE,
) {
  const zoom = clampCropZoom(crop.zoom);
  const { displayWidth, displayHeight, offsetX, offsetY } = objectContainLayout(
    imageWidth,
    imageHeight,
    workspaceSize,
  );
  const { translateX, translateY, center } = avatarCropPreviewTransform(crop, workspaceSize);

  ctx.clearRect(0, 0, workspaceSize, workspaceSize);
  ctx.save();
  ctx.translate(center + translateX, center + translateY);
  ctx.scale(zoom, zoom);
  ctx.translate(-center, -center);
  ctx.drawImage(image, offsetX, offsetY, displayWidth, displayHeight);
  ctx.restore();
}
