import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import type { MessageKey } from './i18n';

type Axis = 'width' | 'height' | 'both';
type Size = { width: number; height: number };
type Drag = { axis: Axis; x: number; y: number; pointerX: number; pointerY: number; width: number; height: number; zoom: number; next: Size; element: HTMLButtonElement; pointerId: number; viewport: HTMLElement; scrollX: number; scrollY: number };
const clamp = (value: number) => Math.max(100, Math.min(4096, Math.round(value)));

export default function CanvasResize({ width, height, zoom, disabled, onResize, t }: {
  width: number; height: number; zoom: number; disabled: boolean;
  onResize: (width: number, height: number) => void; t: (key: MessageKey) => string;
}) {
  const drag = useRef<Drag | null>(null);
  const frame = useRef(0);
  const [preview, setPreview] = useState<Size | null>(null);
  const cancel = () => {
    const current = drag.current; drag.current = null; setPreview(null);
    cancelAnimationFrame(frame.current);
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
  };
  useEffect(() => {
    const escape = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') cancel(); };
    window.addEventListener('keydown', escape);
    return () => { window.removeEventListener('keydown', escape); cancelAnimationFrame(frame.current); };
  }, []);
  const update = (current: Drag) => {
    const dx = (current.pointerX - current.x + current.viewport.scrollLeft - current.scrollX) / current.zoom;
    const dy = (current.pointerY - current.y + current.viewport.scrollTop - current.scrollY) / current.zoom;
    const next = { width: current.axis === 'height' ? current.width : clamp(current.width + dx), height: current.axis === 'width' ? current.height : clamp(current.height + dy) };
    if (next.width !== current.next.width || next.height !== current.next.height) { current.next = next; setPreview(next); }
  };
  const scrollAtEdge = () => {
    const current = drag.current; if (!current) return;
    const bounds = current.viewport.getBoundingClientRect();
    const speed = (position: number, start: number, end: number) => position > end - 48
      ? Math.min(18, Math.max(0, (position - end + 48) / 3))
      : position < start + 48 ? -Math.min(18, Math.max(0, (start + 48 - position) / 3)) : 0;
    current.viewport.scrollBy(current.axis === 'height' ? 0 : speed(current.pointerX, bounds.left, bounds.right), current.axis === 'width' ? 0 : speed(current.pointerY, bounds.top, bounds.bottom));
    update(current);
    frame.current = requestAnimationFrame(scrollAtEdge);
  };
  const start = (event: PointerEvent<HTMLButtonElement>, axis: Axis) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault(); event.stopPropagation();
    const viewport = event.currentTarget.closest<HTMLElement>('.viewport'); if (!viewport) return;
    drag.current = { axis, x: event.clientX, y: event.clientY, pointerX: event.clientX, pointerY: event.clientY, width, height, zoom, next: { width, height }, element: event.currentTarget, pointerId: event.pointerId, viewport, scrollX: viewport.scrollLeft, scrollY: viewport.scrollTop };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPreview({ width, height });
    frame.current = requestAnimationFrame(scrollAtEdge);
  };
  const move = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current; if (!current || event.pointerId !== current.pointerId) return;
    current.pointerX = event.clientX; current.pointerY = event.clientY;
    update(current);
  };
  const finish = (event: PointerEvent<HTMLButtonElement>) => {
    const current = drag.current; if (!current || event.pointerId !== current.pointerId) return;
    move(event);
    const next = current.next;
    cancel();
    if (next.width !== current.width || next.height !== current.height) onResize(next.width, next.height);
  };
  const key = (event: KeyboardEvent<HTMLButtonElement>, axis: Axis) => {
    if (disabled) return;
    const step = event.shiftKey ? 10 : 1;
    let w = width, h = height;
    if (axis !== 'height' && event.key === 'ArrowRight') w = clamp(w + step);
    else if (axis !== 'height' && event.key === 'ArrowLeft') w = clamp(w - step);
    else if (axis !== 'width' && event.key === 'ArrowDown') h = clamp(h + step);
    else if (axis !== 'width' && event.key === 'ArrowUp') h = clamp(h - step);
    else return;
    event.preventDefault(); event.stopPropagation();
    if (w !== width || h !== height) onResize(w, h);
  };
  const handles: { axis: Axis; label: MessageKey }[] = [{ axis: 'width', label: 'resizeWidth' }, { axis: 'height', label: 'resizeHeight' }, { axis: 'both', label: 'resizeCanvas' }];
  return <>
    <div className="canvas-scroll-extent" style={{ width: Math.max(width, preview?.width ?? width) * zoom + 48, height: Math.max(height, preview?.height ?? height) * zoom + 48 }}/>
    {preview && <div className="canvas-resize-preview" style={{ width: preview.width * zoom, height: preview.height * zoom }}><span role="status">{preview.width} × {preview.height} px</span></div>}
    {handles.map(({ axis, label }) => <button key={axis} type="button" className={`canvas-resize-handle resize-${axis}`} aria-label={t(label)} title={`${t(label)} — ${t('resizeHint')}`} disabled={disabled} onPointerDown={e => start(e, axis)} onPointerMove={move} onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={() => { if (drag.current) cancel(); }} onKeyDown={e => key(e, axis)}/>)}
  </>;
}
