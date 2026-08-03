export type CropRect = { x: number; y: number; zoom: number };

/** Logical crop workspace — preview scales to any pixel size from this. */
export const AVATAR_CROP_WORKSPACE = 400;

/** Crop circle diameter in workspace units (80% of workspace). */
export const AVATAR_CROP_CIRCLE = 320;

/** Vertical bias baked into export sampling (see cropAvatarFromImage). */
export const AVATAR_CROP_Y_BIAS = 20;

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

/** CSS transform for the crop preview image (WYSIWYG with cropAvatarFromImage). */
export function avatarCropPreviewTransform(crop: CropRect, workspacePx: number) {
  const zoom = clampCropZoom(crop.zoom);
  const workspaceScale = workspacePx / AVATAR_CROP_WORKSPACE;
  // translate(...) scale(zoom) applies scale first; effective pan is crop * zoom^2.
  return {
    translateX: crop.x * zoom * zoom * workspaceScale,
    translateY: (crop.y * zoom * zoom + AVATAR_CROP_Y_BIAS * zoom) * workspaceScale,
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

/** Draw the crop workspace exactly as the interactive preview shows it. */
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
  const { translateX, translateY } = avatarCropPreviewTransform(crop, workspaceSize);
  const center = workspaceSize / 2;

  ctx.clearRect(0, 0, workspaceSize, workspaceSize);
  ctx.save();
  ctx.translate(center + translateX, center + translateY);
  ctx.scale(zoom, zoom);
  ctx.translate(-center, -center);
  ctx.drawImage(image, offsetX, offsetY, displayWidth, displayHeight);
  ctx.restore();
}

/** Snapshot the square region inside the crop circle (WYSIWYG with the preview). */
export function captureAvatarCropCircle(
  image: CanvasImageSource,
  imageWidth: number,
  imageHeight: number,
  crop: CropRect,
  outputSize = 256,
  workspaceSize = AVATAR_CROP_WORKSPACE,
): HTMLCanvasElement {
  const workspace = document.createElement('canvas');
  workspace.width = workspaceSize;
  workspace.height = workspaceSize;
  const workspaceCtx = workspace.getContext('2d');
  if (!workspaceCtx) {
    throw new Error('Unable to create canvas context');
  }

  renderAvatarCropWorkspace(workspaceCtx, image, imageWidth, imageHeight, crop, workspaceSize);

  const inset = (workspaceSize - AVATAR_CROP_CIRCLE) / 2;
  const output = document.createElement('canvas');
  output.width = outputSize;
  output.height = outputSize;
  const outputCtx = output.getContext('2d');
  if (!outputCtx) {
    throw new Error('Unable to create canvas context');
  }

  outputCtx.drawImage(
    workspace,
    inset,
    inset,
    AVATAR_CROP_CIRCLE,
    AVATAR_CROP_CIRCLE,
    0,
    0,
    outputSize,
    outputSize,
  );

  return output;
}
