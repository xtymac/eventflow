/**
 * Compress an image File to a JPEG data URL.
 * Resizes to maxWidth (preserving aspect ratio), encodes at given quality.
 * Throws if result exceeds maxBytes.
 */
export async function compressImageToDataUrl(
  file: File,
  maxWidth = 1200,
  quality = 0.7,
  maxBytes = 300_000, // ~300 KB base64 budget
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = bitmap.width > maxWidth ? maxWidth / bitmap.width : 1;
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  if (blob.size > maxBytes) {
    throw new Error(`圧縮後も${Math.round(blob.size / 1024)}KBあり、上限(${Math.round(maxBytes / 1024)}KB)を超えています`);
  }

  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Max photos allowed per case */
export const MAX_PHOTOS_PER_CASE = 3;
