import { useCallback, useEffect, useRef, useState } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { get, set } from 'idb-keyval';
import { ArrowUpRight, Check, ChevronDown, Circle, Copy, Download, Eraser, FileImage, HelpCircle, ImagePlus, Maximize, Minus, MousePointer2, PaintBucket, Pencil, Plus, Redo2, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Shape from './Shape';
import CanvasResize from './CanvasResize';
import { floodFill } from './floodFill';
import { useLanguage } from './i18n';
import type { MessageKey, LanguagePreference } from './i18n';
import { desktop, readClipboardImage, writeClipboardImage, savePng } from './desktop';
import { blank, isDocument } from './model';
import type { Document, Item, Tool, ShapeStyle } from './model';

const tools: { id: Tool; label: MessageKey; key: string; icon: LucideIcon }[] = [
  { id: 'select', label: 'select', key: 'V', icon: MousePointer2 },
  { id: 'pen', label: 'pen', key: 'B', icon: Pencil },
  { id: 'eraser', label: 'eraser', key: 'E', icon: Eraser },
  { id: 'bucket', label: 'bucket', key: 'G', icon: PaintBucket },
  { id: 'line', label: 'line', key: 'L', icon: Minus },
  { id: 'arrow', label: 'arrow', key: 'A', icon: ArrowUpRight },
  { id: 'rect', label: 'rect', key: 'R', icon: Square },
  { id: 'ellipse', label: 'ellipse', key: 'O', icon: Circle },
  { id: 'text', label: 'text', key: 'T', icon: Type },
];
const colors = ['#202938', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899'];
const storageKey = 'paint-draft-v1';
type History = { doc: Document; past: Document[]; future: Document[] };
type TextEdit = { x: number; y: number; value: string; id?: string };
const isInput = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest('input, textarea, select, [contenteditable="true"]'));

export default function App() {
  const { preference, chooseLanguage, t } = useLanguage();
  const [history, setHistory] = useState<History>({ doc: blank(), past: [], future: [] });
  const historyRef = useRef(history); historyRef.current = history;
  const doc = history.doc;
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#3b82f6');
  const [width, setWidth] = useState(4);
  const [eraserWidth, setEraserWidth] = useState(64);
  const strokeWidth = tool === 'eraser' ? eraserWidth : width;
  const [shapeStyle, setShapeStyle] = useState<ShapeStyle>('outline');
  const [fillColor, setFillColor] = useState('#bfdbfe');
  const [zoom, setZoom] = useState(0.75);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Item | null>(null);
  const draftRef = useRef<Item | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [textEdit, setTextEdit] = useState<TextEdit | null>(null);
  const [dialog, setDialog] = useState<'new' | 'help' | null>(null);
  const [newSize, setNewSize] = useState({ width: 1200, height: 800 });
  const [notice, setNotice] = useState<MessageKey | ''>('');
  const [saved, setSaved] = useState<MessageKey>('loadingDraft');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [filling, setFilling] = useState(false);
  const fillPending = useRef(false);
  const [dragOver, setDragOver] = useState(false);
  const stage = useRef<Konva.Stage>(null);
  const transformer = useRef<Konva.Transformer>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const documentGeneration = useRef(0);
  const nativePastePending = useRef(false);

  const notify = useCallback((message: MessageKey) => setNotice(message), []);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(''), 5000); return () => clearTimeout(timer); }, [notice]);
  const commit = useCallback((next: Document | ((d: Document) => Document)) => {
    setHistory(h => ({ doc: typeof next === 'function' ? next(h.doc) : next, past: [...h.past.slice(-49), h.doc], future: [] }));
  }, []);
  const undo = useCallback(() => {
    setSelected(null);
    setHistory(h => h.past.length ? { doc: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.doc, ...h.future] } : h);
  }, []);
  const redo = useCallback(() => {
    setSelected(null);
    setHistory(h => h.future.length ? { doc: h.future[0], past: [...h.past, h.doc], future: h.future.slice(1) } : h);
  }, []);
  const change = useCallback((id: string, changes: Partial<Item>) => commit(d => ({ ...d, items: d.items.map(i => i.id === id ? { ...i, ...changes } : i) })), [commit]);
  const remove = useCallback(() => {
    if (selected) { commit(d => ({ ...d, items: d.items.filter(i => i.id !== selected) })); setSelected(null); }
  }, [selected, commit]);
  const clearCanvas = () => {
    documentGeneration.current++;
    commit(d => ({ ...d, items: [] }));
    setSelected(null); draftRef.current = null; setDraft(null);
    notify('canvasCleared');
  };
  const selectItem = useCallback((id: string) => {
    setSelected(id);
    const node = stage.current?.findOne(`#${id}`);
    if (node && transformer.current) {
      transformer.current.nodes([node]);
      transformer.current.getLayer()?.draw();
    }
  }, []);
  const resizeCanvas = (width: number, height: number) => {
    commit(d => ({ ...d, width, height }));
    setSelected(null);
  };
  const fit = useCallback((w = historyRef.current.doc.width, h = historyRef.current.doc.height) => {
    const area = viewport.current;
    if (area) setZoom(Math.max(0.1, Math.min(1, (area.clientWidth - 96) / w, (area.clientHeight - 96) / h)));
  }, []);

  useEffect(() => {
    mounted.current = true;
    get(storageKey).then(value => {
      if (!mounted.current) return;
      if (isDocument(value)) { setHistory({ doc: value, past: [], future: [] }); fit(value.width, value.height); }
      else fit();
      setSaved('draftSaved');
    }).catch(() => { if (mounted.current) { setSaved('autosaveUnavailable'); fit(); } })
      .finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; };
  }, [fit]);
  // Serialize writes so an older, larger draft cannot overwrite a newer one.
  const saveQueue = useRef(Promise.resolve());
  const saveRevision = useRef(0);
  useEffect(() => {
    if (!ready) return;
    const revision = ++saveRevision.current;
    setSaved('saving');
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => {}).then(() => set(storageKey, doc)).then(() => {
        if (mounted.current && revision === saveRevision.current) setSaved('draftSaved');
      }).catch(() => { if (mounted.current && revision === saveRevision.current) setSaved('draftSaveFailed'); });
    }, 350);
    return () => clearTimeout(timer);
  }, [doc, ready]);

  useEffect(() => {
    const node = selected ? stage.current?.findOne(`#${selected}`) : null;
    transformer.current?.nodes(node ? [node] : []);
  }, [selected, doc, tool]);

  const importImage = useCallback(async (file: Blob) => {
    if (file.size > 30 * 1024 * 1024) { notify('imageTooLarge'); return; }
    if (!file.type.startsWith('image/')) { notify('chooseImage'); return; }
    const generation = documentGeneration.current;
    setBusy(true);
    try {
      const src = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
      const img = await new Promise<HTMLImageElement>((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = src; });
      if (generation !== documentGeneration.current) return;
      const current = historyRef.current.doc;
      const empty = current.items.length === 0;
      const ratio = empty ? Math.min(1, 4096 / img.width, 4096 / img.height) : Math.min(1, current.width / img.width, current.height / img.height);
      const w = Math.round(img.width * ratio), h = Math.round(img.height * ratio);
      const item: Item = { id: crypto.randomUUID(), type: 'image', x: empty ? 0 : (current.width - w) / 2, y: empty ? 0 : (current.height - h) / 2, w, h, src, color: '#000000', width: 0 };
      commit(d => ({ ...d, width: empty ? Math.max(100, w) : d.width, height: empty ? Math.max(100, h) : d.height, items: [...d.items, item] }));
      if (empty) fit(Math.max(100, w), Math.max(100, h));
      setSelected(null); setTool('pen'); notify('imageReady');
    } catch { notify('imageFailed'); }
    finally { setBusy(false); }
  }, [commit, fit, notify]);

  const pasteNative = useCallback(async () => {
    if (nativePastePending.current) return;
    nativePastePending.current = true;
    try { await importImage(await readClipboardImage()); }
    catch { notify('nativeClipboardEmpty'); }
    finally { nativePastePending.current = false; }
  }, [importImage, notify]);

  useEffect(() => {
    const paste = (e: ClipboardEvent) => {
      if (!ready || isInput(e.target) || dialog) return;
      if (desktop) { e.preventDefault(); void pasteNative(); return; }
      const item = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'));
      const file = item?.getAsFile();
      if (file) { e.preventDefault(); void importImage(file); }
    };
    window.addEventListener('paste', paste); return () => window.removeEventListener('paste', paste);
  }, [importImage, dialog, ready, pasteNative]);

  const pasteButton = async () => {
    if (desktop) { await pasteNative(); return; }
    try {
      if (!navigator.clipboard?.read) throw new Error();
      const clipboard = await navigator.clipboard.read();
      for (const item of clipboard) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) { await importImage(await item.getType(type)); return; }
      }
      notify('clipboardEmpty');
    } catch { notify('pasteFallback'); }
  };

  const exportBlob = useCallback(async (): Promise<Blob> => {
    const s = stage.current; if (!s) throw new Error(t('canvasUnavailable'));
    const selectionTransformer = transformer.current; const visible = selectionTransformer?.visible(); selectionTransformer?.hide();
    let canvas: HTMLCanvasElement;
    try { canvas = s.toCanvas({ x: 0, y: 0, width: s.width(), height: s.height(), pixelRatio: 1 / s.scaleX() }); }
    finally { if (visible) selectionTransformer?.show(); }
    return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error()), 'image/png'));
  }, [t]);
  const download = useCallback(async () => {
    try {
      const blob = await exportBlob();
      const name = `paint-${new Date().toISOString().slice(0, 10)}.png`;
      if (desktop) { if (await savePng(blob, name, t('pngFilter'))) notify('pngSaved'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); notify('pngSaved');
    } catch { notify('pngFailed'); }
  }, [exportBlob, notify, t]);
  const copy = useCallback(async () => {
    try {
      if (desktop) { await writeClipboardImage(await exportBlob()); notify('copied'); return; }
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') throw new Error();
      // Start clipboard write during the click to preserve Safari user activation.
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': exportBlob() })]); notify('copied');
    } catch { notify(desktop ? 'copyFailed' : 'copyDenied'); }
  }, [exportBlob, notify]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setDialog(null); setTextEdit(null); setSelected(null); draftRef.current = null; setDraft(null); return; }
      if (!ready || isInput(e.target) || dialog || textEdit) return;
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
      else if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); void download(); }
      else if (desktop && mod && e.key.toLowerCase() === 'v') { e.preventDefault(); void pasteNative(); }
      else if (desktop && mod && e.key.toLowerCase() === 'c') { e.preventDefault(); void copy(); }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(); }
      else if (!mod && !e.altKey) { const next = tools.find(t => t.key.toLowerCase() === e.key.toLowerCase()); if (next) { setTool(next.id); setSelected(null); } }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [redo, undo, download, remove, dialog, textEdit, ready, pasteNative, copy]);

  const pointer = () => {
    const s = stage.current; const p = s?.getPointerPosition();
    return p && s ? { x: Math.max(0, Math.min(doc.width, p.x / s.scaleX())), y: Math.max(0, Math.min(doc.height, p.y / s.scaleY())) } : null;
  };
  const pointerDown = (event: KonvaEventObject<PointerEvent>) => {
    if (!ready || busy || fillPending.current || textEdit || event.evt.button !== 0) return;
    if (tool === 'select') { if (event.target === stage.current || event.target.id() === 'background') setSelected(null); return; }
    const p = pointer(); if (!p) return;
    setSelected(null);
    if (tool === 'bucket') { void fillAt(p.x, p.y); return; }
    if (tool === 'text') { setTextEdit({ ...p, value: '' }); return; }
    origin.current = p;
    const item: Item = { id: crypto.randomUUID(), type: tool, ...p, color, width: strokeWidth, points: [0, 0, 0.01, 0.01], w: 0, h: 0, ...((tool === 'rect' || tool === 'ellipse') ? { shapeStyle, fillColor } : {}) };
    draftRef.current = item; setDraft(item);
    stage.current?.content.setPointerCapture(event.evt.pointerId);
  };
  const fillAt = async (x: number, y: number) => {
    const s = stage.current; if (!s || fillPending.current) return;
    const current = historyRef.current.doc;
    fillPending.current = true; setFilling(true);
    try {
      // Wait for bitmap nodes, including a just-pasted image or the preceding fill.
      const deadline = performance.now() + 3000;
      await new Promise<void>(r => requestAnimationFrame(() => r()));
      while (s.find('Image').some(node => !(node as Konva.Image).image())) {
        if (performance.now() > deadline) throw new Error('Image not ready');
        await new Promise<void>(r => requestAnimationFrame(() => r()));
      }
      if (historyRef.current.doc !== current) return;
      const overlay = transformer.current, visible = overlay?.visible(); overlay?.hide();
      let canvas: HTMLCanvasElement;
      try { canvas = s.toCanvas({ x: 0, y: 0, width: s.width(), height: s.height(), pixelRatio: 1 / s.scaleX() }); }
      finally { if (visible) overlay?.show(); }
      const region = floodFill(canvas, x, y, color);
      if (region) commit(d => ({ ...d, items: [...d.items, { id: crypto.randomUUID(), type: 'bucket', color, width: 0, ...region }] }));
    } catch { notify('fillFailed'); }
    finally { fillPending.current = false; setFilling(false); }
  };
  const pointerMove = (event: KonvaEventObject<PointerEvent>) => {
    const item = draftRef.current; const p = pointer(); if (!item || !p) return;
    const start = origin.current;
    let dx = p.x - start.x, dy = p.y - start.y;
    let next: Item;
    if (item.type === 'pen' || item.type === 'eraser') next = { ...item, points: [...item.points!, p.x - item.x, p.y - item.y] };
    else {
      if (event.evt.shiftKey) {
        if (item.type === 'rect' || item.type === 'ellipse') { const size = Math.max(Math.abs(dx), Math.abs(dy)); dx = (Math.sign(dx) || 1) * size; dy = (Math.sign(dy) || 1) * size; }
        else { const angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * Math.PI / 4; const length = Math.hypot(dx, dy); dx = Math.cos(angle) * length; dy = Math.sin(angle) * length; }
      }
      next = item.type === 'rect' || item.type === 'ellipse'
        ? { ...item, x: Math.min(start.x, start.x + dx), y: Math.min(start.y, start.y + dy), w: Math.abs(dx), h: Math.abs(dy) }
        : { ...item, points: [0, 0, dx, dy] };
    }
    draftRef.current = next; setDraft(next);
  };
  const pointerUp = () => {
    const item = draftRef.current; if (!item) return;
    draftRef.current = null; setDraft(null);
    if ((item.type === 'rect' || item.type === 'ellipse') && ((item.w ?? 0) < 1 || (item.h ?? 0) < 1)) return;
    commit(d => ({ ...d, items: [...d.items, item] }));
  };
  const confirmText = () => {
    if (!textEdit) return;
    const value = textEdit.value.trim();
    if (value) {
      if (textEdit.id) change(textEdit.id, { text: value });
      else commit(d => ({ ...d, items: [...d.items, { id: crypto.randomUUID(), type: 'text', x: textEdit.x, y: textEdit.y, text: value, color, width }] }));
    }
    setTextEdit(null);
  };
  const activeTool = tools.find(t => t.id === tool)!;
  const empty = doc.items.length === 0 && !draft;
  const selectedItem = doc.items.find(i => i.id === selected);
  const selectedShape = selectedItem && (selectedItem.type === 'rect' || selectedItem.type === 'ellipse') ? selectedItem : undefined;
  const showShapeOptions = tool === 'rect' || tool === 'ellipse' || !!selectedShape;
  const shownStyle = selectedShape ? selectedShape.shapeStyle ?? 'outline' : shapeStyle;
  const shownFill = selectedShape ? selectedShape.fillColor ?? selectedShape.color : fillColor;

  return <div className="app">
    <header className="header">
      <div className="brand"><span className="brand-icon"><Pencil size={21} /></span><div><h1>paint<span className="brand-dot">.</span></h1><span className="brand-caption">{t('tagline')}</span></div></div>
      <div className="document-name">{t('untitled')} <span className="tag">{t('local')}</span></div>
      <div className="header-actions"><label className="language-control"><select aria-label={t('language')} value={preference} onChange={e => chooseLanguage(e.target.value as LanguagePreference)}><option value="system">{t('systemLanguage')}</option><option value="ru">Русский</option><option value="en">English</option></select></label><button className="button subtle" onClick={copy} disabled={!ready || busy || filling}><Copy size={16} /><span>{t('copy')}</span></button><button className="button primary" onClick={download} disabled={!ready || busy || filling}><Download size={16} /><span>{t('savePng')}</span></button></div>
    </header>
    <div className="toolbar">
      <div className="toolbar-section"><button className="button" onClick={() => setDialog('new')} disabled={!ready}><Plus size={17} />{t('new')}</button><button className="button" onClick={() => input.current?.click()} disabled={!ready || busy || filling}><FileImage size={17} />{t('open')}</button><button className="button" onClick={pasteButton} disabled={!ready || busy || filling}><ImagePlus size={17} />{t('paste')} <kbd>⌘ / Ctrl V</kbd></button></div>
      <div className="toolbar-section history-buttons"><button className="icon-button" aria-label={t('undo')} title={`${t('undo')} (⌘/Ctrl+Z)`} disabled={!history.past.length} onClick={undo}><Undo2 size={19} /></button><button className="icon-button" aria-label={t('redo')} title={`${t('redo')} (⌘/Ctrl+Shift+Z)`} disabled={!history.future.length} onClick={redo}><Redo2 size={19} /></button><span className="separator"/><button className="icon-button danger" aria-label={t('deleteSelected')} title={`${t('deleteSelected')} (Delete)`} onClick={remove} disabled={!selected}><Trash2 size={17} /></button></div>
      <button className="button clear-button danger" onClick={clearCanvas} disabled={!ready || busy || filling || !doc.items.length} title={t('clearHint')}><Trash2 size={16}/>{t('clearCanvas')}</button>
      <button className="icon-button help-button" onClick={() => setDialog('help')} aria-label={t('help')}><HelpCircle size={19}/></button>
    </div>
    <main className="main">
      <aside className="tools" aria-label={t('tools')}>{tools.map(({ id, label, key, icon: Icon }) => <button key={id} className={`tool ${tool === id ? 'active' : ''}`} aria-label={t(label)} aria-pressed={tool === id} title={`${t(label)} (${key})`} onClick={() => { setTool(id); setSelected(null); }}><Icon size={21} strokeWidth={1.8}/><span className="tool-tooltip">{t(label)}<kbd>{key}</kbd></span></button>)}<div className="tool-divider"/><button className="tool" aria-label={t('openImage')} title={t('openImage')} onClick={() => input.current?.click()}><ImagePlus size={21} strokeWidth={1.8}/></button></aside>
      <section className="workspace">
        <div className="properties"><span className="property-label">{t(activeTool.label)}</span><span className="separator"/><div className="palette" aria-label={t('color')}>{colors.map(c => <button key={c} className={`swatch ${color === c ? 'chosen' : ''}`} style={{ background: c }} aria-label={`${t('color')} ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>{color === c && <Check size={12} color={c === '#ffffff' || c === '#eab308' ? '#202938' : '#fff'}/>}</button>)}<label className="custom-color" title={t('customColor')}><input aria-label={t('customColor')} type="color" value={color} onChange={e => setColor(e.target.value)}/><Plus size={12}/></label></div>{tool !== 'bucket' && <><span className="separator"/><label className="width-control"><span>{t(tool === 'eraser' ? 'eraserSize' : 'thickness')}</span><input aria-label={t(tool === 'eraser' ? 'eraserSize' : 'thickness')} type="range" min="1" max={tool === 'eraser' ? 512 : 32} value={strokeWidth} onChange={e => (tool === 'eraser' ? setEraserWidth : setWidth)(Number(e.target.value))}/><input className="width-number" aria-label={t(tool === 'eraser' ? 'eraserSize' : 'thickness')} type="number" min="1" max={tool === 'eraser' ? 512 : 32} value={strokeWidth} onChange={e => { const n = Number(e.target.value); if (Number.isFinite(n)) (tool === 'eraser' ? setEraserWidth : setWidth)(Math.max(1, Math.min(tool === 'eraser' ? 512 : 32, n))); }}/><span>px</span></label></>}
          {showShapeOptions && <div className="shape-options"><span className="separator"/><label><span>{t('shape')}</span><select aria-label={t('shapeStyle')} value={shownStyle} onChange={e => { const style = e.target.value as ShapeStyle; setShapeStyle(style); if (selectedShape) change(selectedShape.id, { shapeStyle: style }); }}><option value="outline">{t('outline')}</option><option value="fill">{t('fill')}</option><option value="both">{t('outlineFill')}</option></select></label>{shownStyle !== 'outline' && <label className="fill-picker"><span>{t('fill')}</span><input aria-label={t('fillColor')} type="color" value={shownFill} onChange={e => { setFillColor(e.target.value); if (selectedShape) change(selectedShape.id, { fillColor: e.target.value }); }}/></label>}</div>}
        </div>
        <div className={`viewport ${dragOver ? 'drag-over' : ''}`} ref={viewport} onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false); }} onDrop={e => { e.preventDefault(); setDragOver(false); const f = Array.from(e.dataTransfer.files).find(f => f.type.startsWith('image/')); if (f && ready) void importImage(f); else notify('dropFile'); }}>
          <div className="canvas-wrap" style={{ width: doc.width * zoom, height: doc.height * zoom }}><Stage ref={stage} width={doc.width * zoom} height={doc.height * zoom} scaleX={zoom} scaleY={zoom} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { draftRef.current = null; setDraft(null); }} style={{ cursor: tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair', touchAction: 'none' }}>
            <Layer><Rect id="background" width={doc.width} height={doc.height} fill="white"/>{doc.items.filter(i => i.type === 'image').map(item => <Shape key={item.id} item={item} movable={tool === 'select'} onSelect={selectItem} onChange={change} onEdit={i => setTextEdit({ x: i.x, y: i.y, value: i.text ?? '', id: i.id })}/>)}</Layer>
            <Layer>{doc.items.filter(i => i.type !== 'image').map(item => <Shape key={item.id} item={item} movable={tool === 'select'} onSelect={selectItem} onChange={change} onEdit={i => setTextEdit({ x: i.x, y: i.y, value: i.text ?? '', id: i.id })}/>)}{draft && <Shape item={draft} movable={false} onSelect={() => {}} onChange={() => {}} onEdit={() => {}}/>}</Layer>
            <Layer><Transformer ref={transformer} rotateEnabled={true} borderStroke="#3b82f6" anchorStroke="#3b82f6" anchorFill="white" anchorSize={8} padding={5} flipEnabled={false} boundBoxFunc={(oldBox, newBox) => Math.abs(newBox.width) < 5 || Math.abs(newBox.height) < 5 ? oldBox : newBox}/></Layer>
          </Stage>{empty && <div className="empty-state"><div className="empty-icon"><Pencil size={28} strokeWidth={1.5}/></div><h2>{t('emptyTitle')}</h2><p>{t('emptyLine1')}<br/>{t('emptyLine2')}</p><div className="empty-shortcut"><kbd>⌘ / Ctrl</kbd><span>+</span><kbd>V</kbd><span>{t('pasteImage')}</span></div></div>}<CanvasResize width={doc.width} height={doc.height} zoom={zoom} disabled={!ready || busy || filling || !!dialog || !!textEdit} onResize={resizeCanvas} t={t}/></div>
          {dragOver && <div className="drop-message"><ImagePlus size={24}/>{t('dropImage')}</div>}
        </div>
        <footer className="statusbar"><div className="status-left"><span className="status-dot"/><span>{t(saved)}</span><span className="status-size">{doc.width} × {doc.height} px</span></div><div className="zoom"><button className="icon-button" aria-label={t('zoomOut')} onClick={() => setZoom(z => Math.max(0.1, z - 0.1))}><Minus size={15}/></button><button className="zoom-value" title={t('zoom100')} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%<ChevronDown size={12}/></button><button className="icon-button" aria-label={t('zoomIn')} onClick={() => setZoom(z => Math.min(3, z + 0.1))}><Plus size={15}/></button><span className="separator"/><button className="icon-button" aria-label={t('fitCanvas')} title={t('fitWindow')} onClick={() => fit()}><Maximize size={16}/></button></div></footer>
      </section>
    </main>
    <input ref={input} type="file" accept="image/*" hidden onChange={e => { const file = e.target.files?.[0]; if (file) void importImage(file); e.target.value = ''; }}/>
    {(notice || busy || filling) && <div className="toast" role="status">{filling ? t('filling') : busy ? t('openingImage') : notice ? t(notice) : ''}</div>}
    {textEdit && <div className="modal-backdrop"><form className="modal" role="dialog" aria-modal="true" aria-labelledby="text-title" onSubmit={e => { e.preventDefault(); confirmText(); }}><div className="modal-heading"><h2 id="text-title">{textEdit.id ? t('editText') : t('addText')}</h2><button type="button" className="icon-button" aria-label={t('close')} onClick={() => setTextEdit(null)}><X size={20}/></button></div><textarea autoFocus aria-label={t('canvasText')} placeholder={t('textPlaceholder')} value={textEdit.value} onChange={e => setTextEdit({ ...textEdit, value: e.target.value })}/><p className="modal-hint">{t('textHint')}</p><div className="modal-actions"><button type="button" className="button" onClick={() => setTextEdit(null)}>{t('cancel')}</button><button className="button primary" type="submit">{t('done')}</button></div></form></div>}
    {dialog && <div className="modal-backdrop"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div className="modal-heading"><h2 id="dialog-title">{dialog === 'new' ? t('newCanvas') : t('helpTitle')}</h2><button autoFocus className="icon-button" aria-label={t('close')} onClick={() => setDialog(null)}><X size={20}/></button></div>{dialog === 'new' ? <><p>{t('replaceWarning')}</p><div className="size-inputs"><label>{t('width')}<input type="number" min="100" max="4096" value={newSize.width} onChange={e => setNewSize({ ...newSize, width: Number(e.target.value) })}/></label><span>×</span><label>{t('height')}<input type="number" min="100" max="4096" value={newSize.height} onChange={e => setNewSize({ ...newSize, height: Number(e.target.value) })}/></label></div><p className="modal-hint">{t('sizeHint')}</p><div className="modal-actions"><button className="button" onClick={() => setDialog(null)}>{t('cancel')}</button><button className="button primary" disabled={![newSize.width, newSize.height].every(n => Number.isInteger(n) && n >= 100 && n <= 4096)} onClick={() => { documentGeneration.current++; commit({ ...blank(), ...newSize }); setSelected(null); draftRef.current = null; setDraft(null); setDialog(null); fit(newSize.width, newSize.height); }}>{t('create')}</button></div></> : <><p>{t('helpIntro')}</p><div className="shortcuts"><div><span>{t('pasteShortcut')}</span><kbd>⌘ / Ctrl V</kbd></div><div><span>{t('undoRedo')}</span><kbd>⌘ / Ctrl ⇧ Z</kbd></div><div><span>{t('savePng')}</span><kbd>⌘ / Ctrl S</kbd></div><div><span>{t('deleteObject')}</span><kbd>Delete</kbd></div><div><span>{t('constrain')}</span><kbd>{t('shiftDraw')}</kbd></div></div><p className="modal-hint">{t('helpDetails')}</p><div className="modal-actions"><button className="button primary" onClick={() => setDialog(null)}>{t('gotIt')}</button></div></>}</div></div>}
  </div>;
}
