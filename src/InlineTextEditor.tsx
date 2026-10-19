import { useEffect, useMemo, useRef } from 'react';
import type { Item } from './model';
import type { MessageKey } from './i18n';

export default function InlineTextEditor({ item, value, zoom, onChange, onConfirm, onCancel, t }: {
  item: Item; value: string; zoom: number; onChange: (value: string) => void;
  onConfirm: () => void; onCancel: () => void; t: (key: MessageKey) => string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const fontSize = item.fontSize ?? item.width * 2 + 18;
  const fontFamily = item.fontFamily ?? 'Arial';
  const size = useMemo(() => {
    const context = document.createElement('canvas').getContext('2d')!;
    context.font = `${fontSize}px ${fontFamily}`;
    const lines = value.split('\n');
    return {
      width: lines.reduce((width, line) => Math.max(width, context.measureText(line).width + 8), 180),
      height: lines.length * fontSize + 8,
    };
  }, [value, fontSize, fontFamily]);
  useEffect(() => {
    // Pointer-down creates the editor before the browser finishes focusing the canvas.
    const frame = requestAnimationFrame(() => input.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <textarea ref={input} className="inline-text-editor" autoFocus
    aria-label={t('canvasText')} placeholder={t('textPlaceholder')} title={t('textHint')}
    value={value} spellCheck={false}
    style={{
      left: item.x * zoom, top: item.y * zoom, color: item.color, fontFamily, fontSize, ...size,
      transform: `rotate(${item.rotation ?? 0}deg) scale(${zoom * (item.scaleX ?? 1)}, ${zoom * (item.scaleY ?? 1)})`,
    }}
    onChange={event => onChange(event.target.value)}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return;
      if (event.key === 'Escape') { event.stopPropagation(); onCancel(); }
      else if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); onConfirm(); }
    }}/ >;
}
