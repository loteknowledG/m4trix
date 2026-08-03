import {
  captureAvatarCropCircle,
  type CropRect,
} from '@/app/(site)/characters/avatar-crop-math';

export type { CropRect };

function loadImage(imageSrc: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unable to load image'));
    img.src = imageSrc;
  });
}

/** Export exactly what appears inside the crop circle in the preview. */
export async function cropAvatarFromImage(
  imageSrc: string,
  crop: CropRect,
  size = 256,
): Promise<string> {
  const img = await loadImage(imageSrc);
  const output = captureAvatarCropCircle(
    img,
    img.naturalWidth,
    img.naturalHeight,
    crop,
    size,
  );
  return output.toDataURL('image/webp', 0.9);
}
