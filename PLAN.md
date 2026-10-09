# Paint implementation plan

## Goal

Quickly sketch a simple diagram or paste a screenshot, annotate it, and copy or save the result. Keep the number of steps between launching the app and drawing as small as possible.

## Stack

**React + TypeScript + Vite + Konva.** React handles the UI, Konva handles canvas rendering and object interaction, and TypeScript defines the document model and tools. IndexedDB stores a local draft. No backend, authentication or synchronization is required for the first version.

An object-based document works well for diagrams: arrows, labels and images can be moved or resized after creation. PNGs are generated on export. A fully pixel-oriented editor would require a dedicated raster layer in the future.

## Phase 1 — working first version (completed)

1. Canvas, tools, palette, stroke thickness and zoom.
2. Brush, annotation eraser, shapes, arrows and text.
3. Image import through the clipboard, file picker and drag-and-drop.
4. Object selection, movement, scaling, rotation and deletion.
5. Undo/redo and a new canvas with custom dimensions.
6. PNG export and copying PNGs to the clipboard.
7. One locally saved draft in IndexedDB.
8. Build checks and integration tests in Chrome.

## Phase 2 — everyday usability

Completed improvements:

- Shape outline, fill or both, with a separate fill color and editing of selected shapes.
- Paint bucket for connected regions on drawings and imported images.
- Separate eraser sizing and clearing the entire canvas with undo.
- Immediate object bounds when selecting and dragging.
- Canvas resizing from any part of the right or bottom edge, with automatic scrolling beyond the window, preview, cancellation and undo/redo.
- English, Russian, Portuguese, Spanish, French, German and Dutch UI, system-language detection and persistent manual selection.

Future improvements:

- Save and open editable projects; support multiple drafts.
- Image cropping, eyedropper, dashed strokes and a highlighter.
- Edit the color and thickness of selected objects; change object stacking order.
- Panning, wheel-based zoom and full touch support.
- Focus management within dialogs and additional accessibility checks.
- PWA installation and offline use through a service worker.

## Phase 3 — standalone macOS app (completed)

- Tauri wrapper using the same editor UI.
- Native image clipboard and PNG save dialog.
- App icon and a standalone Paint.app for Apple Silicon.
- Opening images from Finder, a DMG installer and distribution signing remain future improvements.

## First-version acceptance criteria

- Paste a screenshot, draw an arrow and a circle, then save a PNG.
- Undo/redo restores the expected objects.
- The eraser preserves the original image.
- Export retains document dimensions regardless of view zoom.
- Reopening restores the latest saved draft.
- The web app starts from its project directory with `npm run dev`.
