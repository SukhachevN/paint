import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

async function pixel(page: Page, x: number, y: number) {
  return page.locator('.canvas-wrap').evaluate((el, p) => {
    const layers = el.querySelectorAll('canvas');
    const output = document.createElement('canvas'); output.width = layers[0].width; output.height = layers[0].height;
    const ctx = output.getContext('2d')!;
    ctx.drawImage(layers[0], 0, 0); ctx.drawImage(layers[1], 0, 0);
    const ratio = output.width / el.clientWidth;
    return Array.from(ctx.getImageData(Math.round(p[0] * ratio), Math.round(p[1] * ratio), 1, 1).data);
  }, [x, y]);
}

test('bucket fills a closed outline, preserves outside, undo/redo and restores the fill', async ({ page }) => {
  await waitReady(page);
  await draw(page, 'Прямоугольник', [150, 120], [400, 280]);
  await page.getByRole('button', { name: 'Цвет #ef4444', exact: true }).click();
  await page.keyboard.press('g');
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.click(box.x + 250, box.y + 200);
  const filled = await draft(page);
  expect(filled.items.at(-1).type).toBe('bucket');
  expect(await pixel(page, 250, 200)).toEqual([239, 68, 68, 255]);
  expect(await pixel(page, 100, 100)).toEqual([255, 255, 255, 255]);
  await page.mouse.click(box.x + 250, box.y + 200);
  expect((await draft(page)).items).toHaveLength(2);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  await draft(page); expect(await pixel(page, 250, 200)).toEqual([255, 255, 255, 255]);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  await draft(page); expect(await pixel(page, 250, 200)).toEqual([239, 68, 68, 255]);
  await page.reload(); await expect(page.getByText('Черновик сохранён')).toBeVisible();
  await expect.poll(() => pixel(page, 250, 200)).toEqual([239, 68, 68, 255]);
  await page.screenshot({ path: 'test-results/bucket.png' });
});

test('bucket fills only the connected image region and eraser reveals the original', async ({ page }) => {
  await waitReady(page);
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 400; c.height = 300;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 400, 300);
    ctx.fillStyle = '#000'; ctx.fillRect(198, 0, 4, 300);
    const blob = await new Promise<Blob>(r => c.toBlob(b => r(b!)));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'regions.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
  });
  await expect(page.getByText('Картинка на холсте — можно рисовать поверх')).toBeVisible();
  const original = (await draft(page)).items[0];
  await page.getByRole('button', { name: 'Цвет #ef4444', exact: true }).click();
  await page.getByRole('button', { name: 'Ведёрко', exact: true }).click();
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  const zoom = box.width / 400;
  await page.mouse.click(box.x + 100 * zoom, box.y + 100 * zoom);
  expect((await draft(page)).items[0]).toEqual(original);
  expect(await pixel(page, 100 * zoom, 100 * zoom)).toEqual([239, 68, 68, 255]);
  expect(await pixel(page, 300 * zoom, 100 * zoom)).toEqual([255, 255, 255, 255]);
  expect(await pixel(page, 200 * zoom, 100 * zoom)).toEqual([0, 0, 0, 255]);
  await draw(page, 'Ластик', [90 * zoom, 100 * zoom], [110 * zoom, 100 * zoom]);
  await draft(page); expect(await pixel(page, 100 * zoom, 100 * zoom)).toEqual([255, 255, 255, 255]);
});

async function waitReady(page: Page) {
  await page.goto('/');
  await expect(page.getByText('Черновик сохранён')).toBeVisible();
}
async function draw(page: Page, tool: string, from = [150, 120], to = [400, 280]) {
  await page.getByRole('button', { name: tool, exact: true }).click();
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.move(box.x + from[0], box.y + from[1]); await page.mouse.down();
  await page.mouse.move(box.x + to[0], box.y + to[1], { steps: 15 }); await page.mouse.up();
}
async function draft(page: Page) {
  await page.waitForTimeout(700);
  return page.evaluate(() => new Promise<any>((resolve, reject) => {
    const req = indexedDB.open('keyval-store');
    req.onsuccess = () => { const db = req.result; const query = db.transaction('keyval').objectStore('keyval').get('paint-draft-v1'); query.onsuccess = () => { resolve(query.result); db.close(); }; query.onerror = reject; };
    req.onerror = reject;
  }));
}

test('drawing, text, undo/redo, PNG export and draft restore', async ({ page }) => {
  await waitReady(page);
  await draw(page, 'Кисть');
  expect((await draft(page)).items[0].type).toBe('pen');
  await draw(page, 'Прямоугольник', [250, 230], [450, 360]);
  await draw(page, 'Овал', [420, 130], [600, 240]);
  await draw(page, 'Стрелка', [280, 180], [420, 180]);
  await page.getByRole('button', { name: 'Текст', exact: true }).click();
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.click(box.x + 300, box.y + 100);
  await page.getByRole('textbox', { name: 'Текст на холсте' }).fill('Привет, Paint!');
  await page.getByRole('button', { name: 'Готово' }).click();
  expect((await draft(page)).items).toHaveLength(5);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect((await draft(page)).items).toHaveLength(4);
  await page.keyboard.press('Control+Shift+z');
  expect((await draft(page)).items).toHaveLength(5);
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG' }).click();
  const download = await downloadEvent;
  const stream = (await download.createReadStream())!;
  const parts: Buffer[] = []; for await (const chunk of stream) parts.push(Buffer.from(chunk));
  const png = Buffer.concat(parts);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1200); expect(png.readUInt32BE(20)).toBe(800);
  await page.reload(); await expect(page.getByText('Черновик сохранён')).toBeVisible();
  expect((await draft(page)).items).toHaveLength(5);
  await page.screenshot({ path: 'test-results/editor.png' });
});

test('clipboard image paste, annotation eraser preserves image, selection and delete', async ({ page }) => {
  await waitReady(page);
  // Exercise the actual paste handler without reading or replacing the user's clipboard.
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 800; canvas.height = 500;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#22c55e'; ctx.fillRect(0, 0, 800, 500);
    const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!)));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'screenshot.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
  });
  await expect(page.getByText('800 × 500 px')).toBeVisible();
  await draw(page, 'Кисть', [100, 100], [350, 100]);
  await draw(page, 'Ластик', [100, 100], [350, 100]);
  const d = await draft(page);
  expect(d.items.map((i: any) => i.type)).toEqual(['image', 'pen', 'eraser']);
  const sample = await page.locator('.canvas-wrap').evaluate(el => {
    const layers = el.querySelectorAll('canvas');
    const combined = document.createElement('canvas'); combined.width = layers[0].width; combined.height = layers[0].height;
    const ctx = combined.getContext('2d')!; layers.forEach(c => ctx.drawImage(c, 0, 0));
    const ratio = combined.width / el.clientWidth;
    return Array.from(ctx.getImageData(Math.round(220 * ratio), Math.round(100 * ratio), 1, 1).data);
  });
  expect(sample).toEqual([34, 197, 94, 255]);
  await draw(page, 'Прямоугольник', [300, 180], [450, 280]);
  expect((await draft(page)).items.at(-1).type).toBe('rect');
  await page.getByRole('button', { name: 'Выделение', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.click(box.x + 375, box.y + 180);
  await expect(page.getByRole('button', { name: 'Удалить выбранное' })).toBeEnabled();
  await page.mouse.move(box.x + 375, box.y + 180); await page.mouse.down();
  await page.mouse.move(box.x + 415, box.y + 220, { steps: 10 }); await page.mouse.up();
  const moved = (await draft(page)).items.at(-1);
  expect(moved.x).toBeGreaterThan(300);
  const z = box.width / d.width;
  const handle = { x: box.x + (moved.x + moved.w + 5) * z, y: box.y + (moved.y + moved.h + 5) * z };
  await page.mouse.move(handle.x, handle.y); await page.mouse.down();
  await page.mouse.move(handle.x + 40, handle.y + 30, { steps: 10 }); await page.mouse.up();
  expect((await draft(page)).items.at(-1).scaleX).toBeGreaterThan(1);
  await page.keyboard.press('Delete');
  expect((await draft(page)).items).toHaveLength(3);
});

test('new canvas can be undone and narrow viewport remains usable', async ({ page }) => {
  await waitReady(page); await draw(page, 'Линия');
  await page.getByRole('button', { name: 'Новый', exact: true }).click();
  await page.getByLabel('Ширина', { exact: true }).fill('640');
  await page.getByLabel('Высота', { exact: true }).fill('480');
  await page.getByRole('button', { name: 'Создать', exact: true }).click();
  expect((await draft(page)).width).toBe(640);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect((await draft(page)).items).toHaveLength(1);
  await page.setViewportSize({ width: 768, height: 800 });
  await page.getByRole('button', { name: 'Вписать холст' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});

test('filled rectangle and ellipse render pixels, support selected changes and restore', async ({ page }) => {
  await waitReady(page);
  await page.getByRole('button', { name: 'Прямоугольник', exact: true }).click();
  await page.getByLabel('Стиль фигуры').selectOption('fill');
  await page.getByLabel('Цвет заливки').fill('#ef4444');
  await draw(page, 'Прямоугольник', [150, 120], [350, 270]);
  await page.getByRole('button', { name: 'Овал', exact: true }).click();
  await page.getByLabel('Стиль фигуры').selectOption('both');
  await page.getByLabel('Цвет заливки').fill('#22c55e');
  await draw(page, 'Овал', [450, 120], [650, 270]);
  const d = await draft(page);
  expect(d.items.map((i: any) => i.shapeStyle)).toEqual(['fill', 'both']);
  const samples = await page.locator('.canvas-wrap').evaluate(el => {
    const layer = el.querySelectorAll('canvas')[1]; const ratio = layer.width / el.clientWidth;
    const ctx = layer.getContext('2d')!;
    return [[250, 195], [550, 195]].map(([x, y]) => Array.from(ctx.getImageData(Math.round(x * ratio), Math.round(y * ratio), 1, 1).data));
  });
  expect(samples).toEqual([[239, 68, 68, 255], [34, 197, 94, 255]]);
  await page.getByRole('button', { name: 'Выделение', exact: true }).click();
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.click(box.x + 250, box.y + 195);
  await expect(page.getByLabel('Стиль фигуры')).toHaveValue('fill');
  await page.getByLabel('Стиль фигуры').selectOption('outline');
  expect((await draft(page)).items[0].shapeStyle).toBe('outline');
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect((await draft(page)).items[0].shapeStyle).toBe('fill');
  await page.reload(); await expect(page.getByText('Черновик сохранён')).toBeVisible();
  expect((await draft(page)).items[1].fillColor).toBe('#22c55e');
});

test('large eraser has a separate size and clearing restores images with undo', async ({ page }) => {
  await waitReady(page);
  await page.getByRole('button', { name: 'Прямоугольник', exact: true }).click();
  await page.getByLabel('Стиль фигуры').selectOption('fill');
  await page.getByLabel('Цвет заливки').fill('#ef4444');
  await draw(page, 'Прямоугольник', [150, 120], [450, 420]);
  await page.getByRole('button', { name: 'Ластик', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Размер ластика' }).fill('256');
  await draw(page, 'Ластик', [250, 240], [350, 240]);
  const erased = await draft(page);
  expect(erased.items.at(-1).width).toBe(256);
  const alpha = await page.locator('.canvas-wrap').evaluate(el => {
    const canvas = el.querySelectorAll('canvas')[1], ratio = canvas.width / el.clientWidth;
    const ctx = canvas.getContext('2d')!;
    return [160, 400].map(y => ctx.getImageData(Math.round(300 * ratio), Math.round(y * ratio), 1, 1).data[3]);
  });
  expect(alpha).toEqual([0, 255]);
  await page.getByRole('button', { name: 'Кисть', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Толщина' })).toHaveValue('4');
  await page.getByRole('button', { name: 'Ластик', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Размер ластика' })).toHaveValue('256');
  await page.getByRole('spinbutton', { name: 'Размер ластика' }).fill('512');
  await expect(page.getByRole('slider', { name: 'Размер ластика' })).toHaveValue('512');
  await page.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 400; canvas.height = 300;
    const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!)));
    const transfer = new DataTransfer(); transfer.items.add(new File([blob], 'test.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer }));
  });
  await expect(page.getByText('Картинка на холсте — можно рисовать поверх')).toBeVisible();
  const before = await draft(page);
  await page.getByRole('button', { name: 'Очистить холст', exact: true }).click();
  const cleared = await draft(page);
  expect(cleared.items).toEqual([]); expect(cleared.width).toBe(before.width); expect(cleared.height).toBe(before.height);
  await expect(page.getByRole('button', { name: 'Очистить холст', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect((await draft(page)).items).toEqual(before.items);
});

test('direct dragging shows the object bounds before release and follows the object', async ({ page }) => {
  await waitReady(page);
  await draw(page, 'Прямоугольник', [150, 120], [400, 280]);
  await page.getByRole('button', { name: 'Выделение', exact: true }).click();
  await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  await page.mouse.move(box.x + 260, box.y + 120); await page.mouse.down();
  await expect(page.getByRole('button', { name: 'Удалить выбранное' })).toBeEnabled();
  const bounds = async () => page.locator('.canvas-wrap').evaluate(el => {
    const c = el.querySelectorAll('canvas')[2]; const pixels = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, maxX = -1;
    for (let p = 3; p < pixels.length; p += 4) if (pixels[p]) { const x = ((p - 3) / 4) % c.width; minX = Math.min(minX, x); maxX = Math.max(maxX, x); }
    return { minX, maxX };
  });
  const start = await bounds(); expect(start.maxX).toBeGreaterThan(start.minX);
  await page.mouse.move(box.x + 310, box.y + 170, { steps: 15 });
  const moved = await bounds(); expect(moved.minX).toBeGreaterThan(start.minX + 20);
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Удалить выбранное' })).toBeEnabled();
});

test('canvas handles resize without scaling artwork, undo, restore and export the new size', async ({ page }) => {
  await waitReady(page); await draw(page, 'Прямоугольник', [150, 120], [400, 280]);
  const original = await draft(page);
  const canvas = (await page.locator('.canvas-wrap').boundingBox())!;
  const zoom = canvas.width / original.width;
  const handle = (await page.getByRole('button', { name: 'Изменить размер холста', exact: true }).boundingBox())!;
  const start = { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 };
  await page.mouse.move(start.x, start.y); await page.mouse.down();
  await page.mouse.move(start.x - 200 * zoom, start.y - 100 * zoom, { steps: 12 });
  await expect(page.locator('.canvas-resize-preview')).toBeVisible();
  await expect(page.locator('.canvas-resize-preview')).toContainText('1000 × 700 px');
  await page.screenshot({ path: 'test-results/resize-preview.png' });
  await page.mouse.up();
  await expect(page.locator('.canvas-resize-preview')).toHaveCount(0);
  const resized = await draft(page);
  expect([resized.width, resized.height]).toEqual([1000, 700]);
  expect(resized.items).toEqual(original.items);
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect(await draft(page)).toEqual(original);
  await page.getByRole('button', { name: 'Повторить', exact: true }).click();
  expect((await draft(page)).width).toBe(1000);
  await page.reload(); await expect(page.getByText('Черновик сохранён')).toBeVisible();
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Сохранить PNG', exact: true }).click();
  const stream = (await (await downloading).createReadStream())!;
  const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const png = Buffer.concat(chunks);
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1000, 700]);
});

test('resizing beyond the window autoscrolls and allows navigation to the enlarged canvas edges', async ({ page }) => {
  await waitReady(page);
  await draw(page, 'Прямоугольник');
  const original = await draft(page);
  const area = (await page.locator('.viewport').boundingBox())!;
  const corner = (await page.getByRole('button', { name: 'Изменить размер холста', exact: true }).boundingBox())!;
  await page.mouse.move(corner.x + 6, corner.y + 6); await page.mouse.down();
  await page.mouse.move(area.x + area.width - 5, area.y + area.height - 5, { steps: 10 });
  await expect.poll(async () => {
    const label = await page.locator('.canvas-resize-preview').innerText();
    return Number(label.split(' × ')[0]);
  }).toBeGreaterThan(original.width + 500);
  await page.mouse.up();
  const enlarged = await draft(page);
  expect(enlarged.width).toBeGreaterThan(original.width + 500);
  expect(enlarged.height).toBeGreaterThan(original.height);
  expect(enlarged.items).toEqual(original.items);
  const overflow = await page.locator('.viewport').evaluate(el => ({ x: el.scrollWidth > el.clientWidth, y: el.scrollHeight > el.clientHeight }));
  expect(overflow).toEqual({ x: true, y: true });
  await page.locator('.viewport').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight; });
  const edge = (await page.getByRole('button', { name: 'Изменить размер холста', exact: true }).boundingBox())!;
  expect(edge.x).toBeGreaterThan(area.x); expect(edge.x + edge.width).toBeLessThan(area.x + area.width);
  expect(edge.y).toBeGreaterThan(area.y); expect(edge.y + edge.height).toBeLessThan(area.y + area.height);
  await page.screenshot({ path: 'test-results/oversized-canvas.png' });
  await page.locator('.viewport').evaluate(el => { el.scrollLeft = 0; el.scrollTop = 0; });
  await page.getByRole('button', { name: 'Отменить', exact: true }).click();
  expect(await draft(page)).toEqual(original);
});

test('any visible part of an edge resizes even when its middle is offscreen', async ({ page }) => {
  await waitReady(page);
  await page.locator('.zoom-value').click();
  const width = page.getByRole('button', { name: 'Изменить ширину холста', exact: true });
  await width.focus();
  for (let i = 0; i < 200; i++) await page.keyboard.press('Shift+ArrowRight');
  const height = page.getByRole('button', { name: 'Изменить высоту холста', exact: true });
  await height.focus();
  for (let i = 0; i < 150; i++) await page.keyboard.press('Shift+ArrowDown');
  const before = await draft(page);
  await page.locator('.viewport').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = 0; });
  const area = (await page.locator('.viewport').boundingBox())!;
  const right = (await width.boundingBox())!;
  expect(right.y + right.height / 2).toBeGreaterThan(area.y + area.height);
  await page.mouse.move(right.x + 6, area.y + 100); await page.mouse.down();
  await page.mouse.move(right.x + 6 - 100, area.y + 100, { steps: 10 }); await page.mouse.up();
  expect((await draft(page)).width).toBe(before.width - 100);
  await page.locator('.viewport').evaluate(el => { el.scrollLeft = el.scrollWidth; el.scrollTop = el.scrollHeight; });
  const bottom = (await height.boundingBox())!;
  expect(bottom.x + bottom.width / 2).toBeLessThan(area.x);
  await page.mouse.move(area.x + 200, bottom.y + 6); await page.mouse.down();
  await page.mouse.move(area.x + 200, bottom.y + 6 - 100, { steps: 10 }); await page.mouse.up();
  expect((await draft(page)).height).toBe(before.height - 100);
});

test('edge handles change one dimension, Escape cancels and keyboard resizing works', async ({ page }) => {
  await waitReady(page);
  const box = (await page.locator('.canvas-wrap').boundingBox())!;
  const z = box.width / 1200;
  const w = page.getByRole('button', { name: 'Изменить ширину холста', exact: true });
  const wb = (await w.boundingBox())!;
  await page.mouse.move(wb.x + 6, wb.y + 6); await page.mouse.down();
  await page.mouse.move(wb.x + 6 + 120 * z, wb.y + 6, { steps: 10 }); await page.mouse.up();
  expect([(await draft(page)).width, (await draft(page)).height]).toEqual([1320, 800]);
  const h = page.getByRole('button', { name: 'Изменить высоту холста', exact: true });
  const hb = (await h.boundingBox())!;
  await page.mouse.move(hb.x + 6, hb.y + 6); await page.mouse.down();
  await page.mouse.move(hb.x + 6, hb.y + 6 - 50 * z, { steps: 10 });
  await page.keyboard.press('Escape'); await page.mouse.up();
  expect((await draft(page)).height).toBe(800);
  await h.focus(); await page.keyboard.press('Shift+ArrowUp');
  expect((await draft(page)).height).toBe(790);
  await w.focus(); await page.keyboard.press('ArrowRight');
  expect((await draft(page)).width).toBe(1321);
});
