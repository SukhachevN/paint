# Paint

A local drawing app for quick diagrams and screenshot annotations, inspired by Microsoft Paint. Runs in a browser or as a standalone macOS app.

[Русская документация](README.ru.md)

## Features

- Brush, eraser, paint bucket, lines, arrows, rectangles, ellipses and text.
- Paste images from the clipboard, open files or drag them onto the canvas.
- Outline, fill or both for rectangles and ellipses, with a separate fill color. Hold Shift for squares and circles.
- Paint bucket fills a connected region on drawings or pasted images. A closed outline contains the fill; bucket fills can be undone or erased.
- Select, move, scale and rotate objects. Selection bounds appear immediately when dragging. Double-click text to edit it.
- Separate eraser size from 1 to 512 px (64 px by default). The eraser removes annotations and fills while preserving original images.
- Clear the entire canvas with one button; undo restores its contents.
- Resize using any part of the right or bottom edge, or the bottom-right corner. Hold the edge near the window boundary to keep expanding with automatic scrolling. Navigate oversized canvases using horizontal and vertical scrolling.
- Resizing preserves artwork scale. Content outside a smaller canvas reappears when the canvas expands again. A dashed preview shows the new size; Escape cancels. Focus an edge and use arrow keys for 1 px adjustments, or Shift+arrows for 10 px.
- Zoom controls and fit-to-window view. Canvas dimensions range from 100 to 4096 px per axis.
- Undo/redo for the last 50 actions, including canvas size changes.
- Save or copy a PNG at the document's original resolution, without selection handles or UI.
- Automatically save one draft locally and restore it when reopening the app.
- English and Russian UI. The default follows the primary system/browser language: Russian for `ru`, English otherwise. Manual language selection is remembered.

An empty canvas adopts the first pasted image's dimensions, capped at 4096 px. Subsequent images fit within the current canvas. The maximum input file size is 30 MB.

## Web development

Requires **Node.js 22.12+** (Node.js 24+ also works).

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite, usually `http://127.0.0.1:5173`.

```sh
npm run build    # TypeScript check and production build in dist/
npm run preview  # Preview the production build
npm test         # Integration tests using installed Google Chrome
```

Tests use Playwright and expect Google Chrome to be installed. They cover drawing, selection, fills, erasing, clipboard image import, undo/redo, PNG export, draft restoration, language selection and canvas resizing with scrolling.

## macOS app

The built **Paint.app** includes the frontend and runs without Node.js, a terminal or a web server. Place it in `~/Applications` or `/Applications`, then launch it from Finder, Dock or Spotlight (`⌘Space` → `Paint`). You can create a desktop alias for convenient access.

To build it yourself, install Xcode Command Line Tools and a current stable Rust toolchain (Rust 1.90 or newer; update stable if dependency requirements change).

```sh
npm ci
npm run desktop:dev    # Development in a native window
npm run desktop:build  # Build and locally sign Paint.app
```

The app bundle is generated at `src-tauri/target/release/bundle/macos/Paint.app`. The build script applies and verifies an ad-hoc macOS signature for local use. Distribution to other computers may require Developer ID signing and notarization.

The macOS app uses the system clipboard for image paste/copy and the native save dialog for PNG export. Its draft is stored separately from the browser version. The tested build targets Apple Silicon and macOS 12+.

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| V | Select |
| B | Brush |
| E | Eraser |
| G | Paint bucket |
| L | Line |
| A | Arrow |
| R | Rectangle |
| O | Ellipse |
| T | Text |
| ⌘/Ctrl+V | Paste image |
| ⌘/Ctrl+Z | Undo |
| ⌘/Ctrl+Shift+Z | Redo |
| ⌘/Ctrl+S | Save PNG |
| Delete / Backspace | Delete selected object |
| Escape | Close dialog or cancel drawing/resize |
| Shift while drawing | Square/circle or line direction in 45° steps |

## Stack and storage

React, TypeScript, Vite, Konva/react-konva, idb-keyval and Lucide icons. The desktop app uses Tauri 2 with native clipboard and file APIs.

No server or account is required. Images stay local. The document stores images and individual drawing objects, enabling undo and object transforms. Fonts are supplied by the system.

The browser draft is stored in IndexedDB and belongs to that browser profile and origin. A different port or browser has separate storage. Undo history does not survive reopening the app, and clearing browser data removes the draft. Export a PNG to keep a drawing independently of the app.

Browser clipboard buttons depend on API support and permissions; HTTPS is required outside localhost. If a clipboard button is unavailable, use the paste shortcut or open an image file, and save PNG instead of copying it.

## Roadmap

See [PLAN.md](PLAN.md) for the implementation plan and future ideas (in Russian). The web and macOS versions share the same editor.
