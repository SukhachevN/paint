// Scanline flood fill. Only the changed region is stored, leaving other pixels untouched.
export function floodFill(canvas: HTMLCanvasElement, x: number, y: number, color: string, tolerance = 24) {
  const width = canvas.width, height = canvas.height;
  x = Math.max(0, Math.min(width - 1, Math.floor(x))); y = Math.max(0, Math.min(height - 1, Math.floor(y)));
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const source = context.getImageData(0, 0, width, height).data;
  const target = Array.from(source.subarray((y * width + x) * 4, (y * width + x) * 4 + 4));
  const replacement = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16), 255];
  if (target.every((v, i) => v === replacement[i])) return null;
  const visited = new Uint8Array(width * height);
  const stack = [y * width + x];
  let minX = width, minY = height, maxX = 0, maxY = 0;
  const matches = (index: number) => {
    if (visited[index]) return false;
    const offset = index * 4;
    return Math.abs(source[offset] - target[0]) <= tolerance && Math.abs(source[offset + 1] - target[1]) <= tolerance
      && Math.abs(source[offset + 2] - target[2]) <= tolerance && Math.abs(source[offset + 3] - target[3]) <= tolerance;
  };
  while (stack.length) {
    const seed = stack.pop()!;
    if (!matches(seed)) continue;
    const row = Math.floor(seed / width), startX = seed % width;
    let left = startX, right = startX;
    while (left > 0 && matches(row * width + left - 1)) left--;
    while (right < width - 1 && matches(row * width + right + 1)) right++;
    let above = false, below = false;
    for (let col = left; col <= right; col++) {
      const index = row * width + col; visited[index] = 1;
      if (row > 0 && matches(index - width)) { if (!above) stack.push(index - width); above = true; } else above = false;
      if (row < height - 1 && matches(index + width)) { if (!below) stack.push(index + width); below = true; } else below = false;
    }
    minX = Math.min(minX, left); maxX = Math.max(maxX, right); minY = Math.min(minY, row); maxY = Math.max(maxY, row);
  }
  const result = document.createElement('canvas'); result.width = maxX - minX + 1; result.height = maxY - minY + 1;
  const ctx = result.getContext('2d')!; const pixels = ctx.createImageData(result.width, result.height);
  for (let row = minY; row <= maxY; row++) for (let col = minX; col <= maxX; col++) {
    if (!visited[row * width + col]) continue;
    const offset = ((row - minY) * result.width + col - minX) * 4;
    pixels.data.set(replacement, offset);
  }
  ctx.putImageData(pixels, 0, 0);
  return { x: minX, y: minY, w: result.width, h: result.height, src: result.toDataURL('image/png') };
}
