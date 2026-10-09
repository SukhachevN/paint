import { useCallback, useEffect, useState } from 'react';
import { desktop } from './desktop';
import { invoke } from '@tauri-apps/api/core';
import pt from './locales/pt';
import es from './locales/es';
import fr from './locales/fr';
import de from './locales/de';
import nl from './locales/nl';

export const languages = [
  { code: 'en', name: 'English' },
  { code: 'ru', name: 'Русский' },
  { code: 'pt', name: 'Português' },
  { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' },
  { code: 'de', name: 'Deutsch' },
  { code: 'nl', name: 'Nederlands' },
] as const;
export type Language = typeof languages[number]['code'];
export type LanguagePreference = Language | 'system';
const preferenceKey = 'paint-language-v1';
export const en = {
  "select": "Select",
  "pen": "Brush",
  "eraser": "Eraser",
  "bucket": "Paint bucket",
  "filling": "Filling region…",
  "fillFailed": "Could not fill the region. Try again.",
  "line": "Line",
  "arrow": "Arrow",
  "rect": "Rectangle",
  "ellipse": "Ellipse",
  "text": "Text",
  "loadingDraft": "Loading draft…",
  "draftSaved": "Draft saved",
  "autosaveUnavailable": "Autosave unavailable",
  "saving": "Saving…",
  "draftSaveFailed": "Could not save draft",
  "imageTooLarge": "Image is too large. Maximum size is 30 MB.",
  "chooseImage": "Choose an image file.",
  "imageReady": "Image added — ready for annotations",
  "imageFailed": "Could not open the image. Try PNG, JPEG or WebP.",
  "nativeClipboardEmpty": "No image available in the clipboard. Copy a screenshot and try again.",
  "clipboardEmpty": "No image in the clipboard. Copy an image or a screenshot.",
  "pasteFallback": "Press ⌘V / Ctrl+V to paste an image, or open a file.",
  "canvasUnavailable": "Canvas unavailable",
  "pngSaved": "PNG saved",
  "pngFailed": "Could not save PNG",
  "copied": "Drawing copied to clipboard",
  "copyFailed": "Could not copy the drawing. Try saving a PNG.",
  "copyDenied": "Clipboard access was denied. Save the drawing as PNG.",
  "tagline": "a place for your ideas",
  "untitled": "Untitled",
  "local": "LOCAL",
  "copy": "Copy",
  "savePng": "Save PNG",
  "new": "New",
  "open": "Open",
  "paste": "Paste",
  "undo": "Undo",
  "redo": "Redo",
  "deleteSelected": "Delete selected",
  "help": "Help",
  "tools": "Tools",
  "openImage": "Open image",
  "color": "Color",
  "customColor": "Custom color",
  "thickness": "Thickness",
  "shape": "Shape",
  "shapeStyle": "Shape style",
  "outline": "Outline",
  "fill": "Fill",
  "outlineFill": "Outline + fill",
  "fillColor": "Fill color",
  "dropFile": "Drop an image file",
  "emptyTitle": "Start with a blank canvas",
  "emptyLine1": "Draw an idea or paste an image",
  "emptyLine2": "to add your annotations",
  "pasteImage": "paste an image",
  "dropImage": "Drop the image to add it to the canvas",
  "zoomOut": "Zoom out",
  "zoomIn": "Zoom in",
  "zoom100": "Zoom to 100%",
  "fitCanvas": "Fit canvas",
  "fitWindow": "Fit canvas to window",
  "openingImage": "Opening image…",
  "editText": "Edit text",
  "addText": "Add text",
  "close": "Close",
  "canvasText": "Canvas text",
  "textPlaceholder": "Your label…",
  "textHint": "Text will appear where you clicked.",
  "cancel": "Cancel",
  "done": "Done",
  "newCanvas": "New canvas",
  "helpTitle": "Quick reference",
  "replaceWarning": "The current drawing will be replaced. Save it as PNG if you want to keep a copy.",
  "width": "Width",
  "height": "Height",
  "sizeHint": "From 100 to 4096 pixels on each side.",
  "create": "Create",
  "helpIntro": "Paste a screenshot, choose a tool and draw. Everything stays on this device.",
  "pasteShortcut": "Paste image",
  "undoRedo": "Undo / redo",
  "deleteObject": "Delete object",
  "constrain": "Constrain shape / line",
  "shiftDraw": "Shift + draw",
  "helpDetails": "Select (V) to move and resize objects. Double-click text to edit it. The eraser removes annotations while preserving the original image. In the browser, clipboard buttons depend on permissions; you can also try ⌘V / Ctrl+V to paste.",
  "gotIt": "Got it",
  "language": "Interface language",
  "systemLanguage": "System",
  "pageTitle": "Paint — quick drawings and annotations",
  "pngFilter": "PNG image",
  "eraserSize": "Eraser size",
  "clearCanvas": "Clear canvas",
  "clearHint": "Clear the canvas, including images. Undo restores everything.",
  "canvasCleared": "Canvas cleared — Undo restores the drawing",
  "resizeWidth": "Resize canvas width",
  "resizeHeight": "Resize canvas height",
  "resizeCanvas": "Resize canvas",
  "resizeHint": "Drag to resize. Arrow keys: 1 px, Shift: 10 px. Escape cancels."
};
export type MessageKey = keyof typeof en;
const ru: Record<MessageKey, string> = {
  "select": "Выделение",
  "pen": "Кисть",
  "eraser": "Ластик",
  "bucket": "Ведёрко",
  "filling": "Заливаю область…",
  "fillFailed": "Не удалось залить область. Попробуй ещё раз.",
  "line": "Линия",
  "arrow": "Стрелка",
  "rect": "Прямоугольник",
  "ellipse": "Овал",
  "text": "Текст",
  "loadingDraft": "Загрузка черновика…",
  "draftSaved": "Черновик сохранён",
  "autosaveUnavailable": "Автосохранение недоступно",
  "saving": "Сохраняю…",
  "draftSaveFailed": "Не удалось сохранить черновик",
  "imageTooLarge": "Картинка слишком большая. Максимум — 30 МБ.",
  "chooseImage": "Выбери файл изображения.",
  "imageReady": "Картинка на холсте — можно рисовать поверх",
  "imageFailed": "Не удалось открыть картинку. Попробуй PNG, JPEG или WebP.",
  "nativeClipboardEmpty": "В буфере нет доступной картинки. Скопируй скриншот и попробуй ещё раз.",
  "clipboardEmpty": "В буфере нет картинки. Скопируй изображение или скриншот.",
  "pasteFallback": "Нажми ⌘V / Ctrl+V для вставки картинки или открой файл.",
  "canvasUnavailable": "Холст недоступен",
  "pngSaved": "PNG сохранён",
  "pngFailed": "Не удалось сохранить PNG",
  "copied": "Рисунок скопирован в буфер",
  "copyFailed": "Не удалось скопировать рисунок. Попробуй сохранить PNG.",
  "copyDenied": "Браузер не разрешил копирование. Сохрани рисунок как PNG.",
  "tagline": "место для твоих идей",
  "untitled": "Без названия",
  "local": "ЛОКАЛЬНО",
  "copy": "Копировать",
  "savePng": "Сохранить PNG",
  "new": "Новый",
  "open": "Открыть",
  "paste": "Вставить",
  "undo": "Отменить",
  "redo": "Повторить",
  "deleteSelected": "Удалить выбранное",
  "help": "Справка",
  "tools": "Инструменты",
  "openImage": "Открыть картинку",
  "color": "Цвет",
  "customColor": "Свой цвет",
  "thickness": "Толщина",
  "shape": "Фигура",
  "shapeStyle": "Стиль фигуры",
  "outline": "Контур",
  "fill": "Заливка",
  "outlineFill": "Контур + заливка",
  "fillColor": "Цвет заливки",
  "dropFile": "Перетащи файл изображения",
  "emptyTitle": "Начни с чистого листа",
  "emptyLine1": "Нарисуй идею или вставь картинку,",
  "emptyLine2": "чтобы сделать на ней пометки",
  "pasteImage": "вставить картинку",
  "dropImage": "Отпусти картинку, чтобы добавить её на холст",
  "zoomOut": "Уменьшить",
  "zoomIn": "Увеличить",
  "zoom100": "Масштаб 100%",
  "fitCanvas": "Вписать холст",
  "fitWindow": "Вписать холст в окно",
  "openingImage": "Открываю картинку…",
  "editText": "Редактировать текст",
  "addText": "Добавить текст",
  "close": "Закрыть",
  "canvasText": "Текст на холсте",
  "textPlaceholder": "Твоя подпись…",
  "textHint": "Текст появится в точке, на которую ты нажал.",
  "cancel": "Отмена",
  "done": "Готово",
  "newCanvas": "Новый холст",
  "helpTitle": "Под рукой",
  "replaceWarning": "Текущий рисунок будет заменён. Сохрани его как PNG, если хочешь оставить копию.",
  "width": "Ширина",
  "height": "Высота",
  "sizeHint": "От 100 до 4096 пикселей по каждой стороне.",
  "create": "Создать",
  "helpIntro": "Вставь скриншот, выбери инструмент и рисуй. Всё остаётся на этом устройстве.",
  "pasteShortcut": "Вставить изображение",
  "undoRedo": "Отменить / повторить",
  "deleteObject": "Удалить объект",
  "constrain": "Ровная фигура / линия",
  "shiftDraw": "Shift + рисование",
  "helpDetails": "Выделение (V) — перемещение и размер объектов. Двойной клик по тексту — редактирование. Ластик стирает пометки, сохраняя исходную картинку. Кнопки буфера зависят от разрешений браузера; для вставки всегда можно попробовать ⌘V / Ctrl+V.",
  "gotIt": "Понятно",
  "language": "Язык интерфейса",
  "systemLanguage": "Системный",
  "pageTitle": "Paint — быстрые рисунки и пометки",
  "pngFilter": "PNG изображение",
  "eraserSize": "Размер ластика",
  "clearCanvas": "Очистить холст",
  "clearHint": "Очистить холст вместе с картинками. Отмена вернёт рисунок.",
  "canvasCleared": "Холст очищен — можно вернуть рисунок кнопкой отмены",
  "resizeWidth": "Изменить ширину холста",
  "resizeHeight": "Изменить высоту холста",
  "resizeCanvas": "Изменить размер холста",
  "resizeHint": "Потяни для изменения размера. Стрелки: 1 px, Shift: 10 px. Escape отменяет."
};

const dictionaries: Record<Language, Record<MessageKey, string>> = { en, ru, pt, es, fr, de, nl };
function isLanguage(value: string | null): value is Language {
  return languages.some(({ code }) => code === value);
}
export function systemLanguage(locale = navigator.language): Language {
  const primary = locale.toLowerCase().split(/[-_]/)[0];
  return isLanguage(primary) ? primary : 'en';
}
function readPreference(): LanguagePreference {
  try {
    const saved = localStorage.getItem(preferenceKey);
    return isLanguage(saved) ? saved : 'system';
  } catch { return 'system'; }
}
export function useLanguage() {
  const [preference, setPreference] = useState<LanguagePreference>(readPreference);
  const [system, setSystem] = useState(systemLanguage);
  const language = preference === 'system' ? system : preference;
  const t = useCallback((key: MessageKey): string => dictionaries[language][key], [language]);
  const chooseLanguage = (next: LanguagePreference) => {
    setPreference(next);
    try { localStorage.setItem(preferenceKey, next); } catch { /* Still works for this session. */ }
  };
  useEffect(() => {
    let active = true;
    const update = async () => {
      let locale = navigator.language;
      if (desktop) {
        try {
          const native = await invoke<string | null>('system_language');
          if (native) locale = native;
        } catch { /* Use the WebView language if the native API is unavailable. */ }
      }
      if (active) setSystem(systemLanguage(locale));
    };
    void update();
    window.addEventListener('languagechange', update);
    return () => { active = false; window.removeEventListener('languagechange', update); };
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = t('pageTitle');
  }, [language, t]);
  return { preference, language, chooseLanguage, t };
}
