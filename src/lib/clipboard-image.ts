/**
 * Read the first image file from a paste event (browser / Grok → clipboard).
 */
export function getImageFileFromPasteEvent(e: React.ClipboardEvent | ClipboardEvent): File | null {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file && file.type.startsWith('image/')) return file;
    }
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** Copy a data URL or http(s) image URL to the system clipboard as PNG when possible. */
export async function copyImageToClipboardFromSrc(src: string): Promise<void> {
  if (!src.trim()) throw new Error('No image to copy.');

  const res = await fetch(src);
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('Clipboard item is not an image.');
  }

  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
    return;
  }

  throw new Error('Copying images requires a secure context and ClipboardItem support.');
}
