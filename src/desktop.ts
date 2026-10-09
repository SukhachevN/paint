import { isTauri } from '@tauri-apps/api/core';
export const desktop = isTauri();

export async function readClipboardImage(): Promise<Blob> {
  const { readImage } = await import('@tauri-apps/plugin-clipboard-manager');
  const image = await readImage();
  try {
    const [size, rgba] = await Promise.all([image.size(), image.rgba()]);
    if (size.width > 8192 || size.height > 8192 || size.width * size.height > 32_000_000) throw new Error('Изображение слишком большое');
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    canvas.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(rgba), size.width, size.height), 0, 0);
    return await new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Не удалось прочитать картинку')), 'image/png'));
  } finally { await image.close(); }
}

export async function writeClipboardImage(blob: Blob) {
  const { writeImage } = await import('@tauri-apps/plugin-clipboard-manager');
  const { Image } = await import('@tauri-apps/api/image');
  const image = await Image.fromBytes(new Uint8Array(await blob.arrayBuffer()));
  try { await writeImage(image); } finally { await image.close(); }
}

export async function savePng(blob: Blob, name: string, filterName = 'PNG image'): Promise<boolean> {
  const { save } = await import('@tauri-apps/plugin-dialog');
  const path = await save({ defaultPath: name, filters: [{ name: filterName, extensions: ['png'] }] });
  if (!path) return false;
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  return true;
}
