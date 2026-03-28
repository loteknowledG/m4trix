export type CropRect = { x: number; y: number; zoom: number };

export async function cropAvatarFromImage(
  imageSrc: string,
  crop: CropRect,
  size = 256
): Promise<string> {
  const img = new Image();
  img.src = imageSrc;
  await new Promise<void>(resolve => {
    img.onload = () => resolve();
  });

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Unable to create canvas context');
  }

  const UI_WORKSPACE = 400;
  const UI_CROP_CIRCLE = 320;

  const scaleToFit = Math.min(UI_WORKSPACE / img.width, UI_WORKSPACE / img.height);
  const displayWidth = img.width * scaleToFit;
  const displayHeight = img.height * scaleToFit;
  const offsetX = (UI_WORKSPACE - displayWidth) / 2;
  const offsetY = (UI_WORKSPACE - displayHeight) / 2;

  const cropCenterX = UI_WORKSPACE / 2 - crop.x * crop.zoom;
  const cropCenterY = UI_WORKSPACE / 2 - crop.y * crop.zoom - 20;
  const sourceCenterX = (cropCenterX - offsetX) / scaleToFit;
  const sourceCenterY = (cropCenterY - offsetY) / scaleToFit;
  const sourceSize = UI_CROP_CIRCLE / crop.zoom / scaleToFit;

  const sx = sourceCenterX - sourceSize / 2;
  const sy = sourceCenterY - sourceSize / 2;

  ctx.drawImage(img, sx, sy, sourceSize, sourceSize, 0, 0, size, size);
  return canvas.toDataURL('image/webp', 0.9);
}
