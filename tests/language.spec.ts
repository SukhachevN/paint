import { test, expect } from '@playwright/test';

for (const [locale, language, saveLabel] of [
  ['ru-RU', 'ru', 'Сохранить PNG'],
  ['en-US', 'en', 'Save PNG'],
  ['pt-BR', 'pt', 'Salvar PNG'],
  ['pt-PT', 'pt', 'Salvar PNG'],
  ['es-MX', 'es', 'Guardar PNG'],
  ['fr-CA', 'fr', 'Enregistrer PNG'],
  ['de-DE', 'de', 'PNG speichern'],
  ['nl-BE', 'nl', 'PNG opslaan'],
  ['ja-JP', 'en', 'Save PNG'],
] as const) {
  test.describe(`system locale ${locale}`, () => {
    test.use({ locale });
    test('selects the primary system language with English fallback', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('lang', language);
      await expect(page.getByRole('button', { name: saveLabel, exact: true })).toBeVisible();
      await expect(page.locator('.language-control select')).toHaveValue('system');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('lang', language);
    });
  });
}

test.describe('manual language preference', () => {
  test.use({ locale: 'en-GB' });
  test('switches all dialogs, keeps artwork and persists the selection', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Draft saved')).toBeVisible();
    await page.getByRole('button', { name: 'Text', exact: true }).click();
    const box = (await page.locator('.canvas-wrap').boundingBox())!;
    await page.mouse.click(box.x + 220, box.y + 120);
    await expect(page.getByRole('heading', { name: 'Add text' })).toBeVisible();
    await page.getByLabel('Canvas text').fill('Мой текст / my text');
    await page.getByRole('button', { name: 'Done', exact: true }).click();
    await page.locator('.language-control select').selectOption('ru');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByText('Черновик сохранён')).toBeVisible();
    await page.getByRole('button', { name: 'Справка', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Под рукой' })).toBeVisible();
    await page.getByRole('button', { name: 'Понятно', exact: true }).click();
    await page.reload();
    await expect(page.locator('.language-control select')).toHaveValue('ru');
    await expect(page.getByText('Черновик сохранён')).toBeVisible();
    const text = await page.evaluate(() => new Promise<string>(resolve => {
      const req = indexedDB.open('keyval-store');
      req.onsuccess = () => { const db = req.result; const get = db.transaction('keyval').objectStore('keyval').get('paint-draft-v1'); get.onsuccess = () => { resolve(get.result.items[0].text); db.close(); }; };
    }));
    expect(text).toBe('Мой текст / my text');
    await page.locator('.language-control select').selectOption('en');
    await page.getByRole('button', { name: 'New', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New canvas' })).toBeVisible();
    await expect(page.getByLabel('Width', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
    await page.getByLabel('Shape style').selectOption('both');
    await expect(page.getByLabel('Fill color')).toBeVisible();
    await page.getByRole('button', { name: 'Help', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Quick reference' })).toBeVisible();
    await page.getByRole('button', { name: 'Got it', exact: true }).click();
    await page.setViewportSize({ width: 768, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
    await page.locator('.language-control select').selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.reload();
    await expect(page.locator('.language-control select')).toHaveValue('system');
  });

  test('invalid saved setting falls back to system and works with storage blocked', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('paint-language-v1', 'unsupported'));
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('Storage blocked'); }; });
    await page.getByLabel('Interface language').selectOption('ru');
    await expect(page.getByRole('button', { name: 'Сохранить PNG', exact: true })).toBeVisible();
  });
});

for (const [language, saved, help, title, dismiss, newButton, newTitle, cancel, width, height, textTool, addText, canvasText, done] of [
  ['pt', 'Rascunho salvo', 'Ajuda', 'Referência rápida', 'Entendi', 'Novo', 'Nova tela', 'Cancelar', 'Largura', 'Altura', 'Texto', 'Adicionar texto', 'Texto na tela', 'Concluído'],
  ['es', 'Borrador guardado', 'Ayuda', 'Referencia rápida', 'Entendido', 'Nuevo', 'Nuevo lienzo', 'Cancelar', 'Ancho', 'Alto', 'Texto', 'Añadir texto', 'Texto en el lienzo', 'Listo'],
  ['fr', 'Brouillon enregistré', 'Aide', 'Aide rapide', 'Compris', 'Nouveau', 'Nouvelle zone de dessin', 'Annuler', 'Largeur', 'Hauteur', 'Texte', 'Ajouter du texte', 'Texte du dessin', 'Terminé'],
  ['de', 'Entwurf gespeichert', 'Hilfe', 'Kurzanleitung', 'Verstanden', 'Neu', 'Neue Zeichenfläche', 'Abbrechen', 'Breite', 'Höhe', 'Text', 'Text hinzufügen', 'Text auf der Zeichenfläche', 'Fertig'],
  ['nl', 'Concept opgeslagen', 'Help', 'Snelgids', 'Begrepen', 'Nieuw', 'Nieuw tekenblad', 'Annuleren', 'Breedte', 'Hoogte', 'Tekst', 'Tekst toevoegen', 'Tekst op het tekenblad', 'Klaar'],
] as const) {
  test(`manual ${language} translates dialogs, preserves text and persists after reload`, async ({ page }) => {
    await page.goto('/');
    await page.locator('.language-control select').selectOption(language);
    await expect(page.getByText(saved, { exact: true })).toBeVisible();
    await page.getByRole('button', { name: help, exact: true }).click();
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await page.getByRole('button', { name: dismiss, exact: true }).click();
    await page.getByRole('button', { name: newButton, exact: true }).click();
    await expect(page.getByRole('heading', { name: newTitle, exact: true })).toBeVisible();
    await expect(page.getByLabel(width, { exact: true })).toBeVisible();
    await expect(page.getByLabel(height, { exact: true })).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: cancel, exact: true }).click();
    await page.getByRole('button', { name: textTool, exact: true }).click();
    const box = (await page.locator('.canvas-wrap').boundingBox())!;
    await page.mouse.click(box.x + 100, box.y + 100);
    await expect(page.getByRole('heading', { name: addText, exact: true })).toBeVisible();
    await page.getByLabel(canvasText, { exact: true }).fill('Olá / ¡Hola! / Bonjour / Grüße / Hallo');
    await page.getByRole('button', { name: done, exact: true }).click();
    await expect(page.getByText(saved, { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('.language-control select')).toHaveValue(language);
    await expect(page.getByText(saved, { exact: true })).toBeVisible();
    const text = await page.evaluate(() => new Promise<string>(resolve => {
      const req = indexedDB.open('keyval-store');
      req.onsuccess = () => { const db = req.result; const get = db.transaction('keyval').objectStore('keyval').get('paint-draft-v1'); get.onsuccess = () => { resolve(get.result.items[0].text); db.close(); }; };
    }));
    expect(text).toBe('Olá / ¡Hola! / Bonjour / Grüße / Hallo');
    await page.setViewportSize({ width: 768, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  });
}

test.describe('macOS system language', () => {
  test.use({ locale: 'en-US' });
  test('uses the native primary language instead of the WebView preference', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'isTauri', { value: true });
      Object.defineProperty(window, '__TAURI_INTERNALS__', { value: { invoke: async (command: string) => command === 'system_language' ? 'ru-RU' : null } });
    });
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
    await expect(page.getByRole('button', { name: 'Сохранить PNG', exact: true })).toBeVisible();
    await page.locator('.language-control select').selectOption('en');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await page.locator('.language-control select').selectOption('system');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ru');
  });
});
