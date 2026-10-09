import { useEffect, useState } from 'react';
import { Arrow, Ellipse, Image as CanvasImage, Line, Rect, Text } from 'react-konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import type { Item } from './model';
type Props = { item: Item; movable: boolean; onSelect: (id: string) => void; onChange: (id: string, change: Partial<Item>) => void; onEdit: (item: Item) => void };
export default function Shape({ item, movable, onSelect, onChange, onEdit }: Props) {
  const [image, setImage] = useState<HTMLImageElement>();
  useEffect(() => {
    if (!item.src) return;
    const img = new window.Image();
    img.onload = () => setImage(img);
    img.src = item.src;
    return () => { img.onload = null; };
  }, [item.src]);
  const common = {
    id: item.id, x: item.x, y: item.y, scaleX: item.scaleX ?? 1, scaleY: item.scaleY ?? 1, rotation: item.rotation ?? 0,
    draggable: movable && item.type !== 'eraser', listening: movable && item.type !== 'eraser',
    onClick: () => onSelect(item.id), onTap: () => onSelect(item.id),
    onPointerDown: () => onSelect(item.id),
    onDragStart: () => onSelect(item.id),
    onDblClick: () => { if (item.type === 'text') onEdit(item); },
    onDragEnd: (e: KonvaEventObject<DragEvent>) => onChange(item.id, { x: e.target.x(), y: e.target.y() }),
    onTransformEnd: (e: KonvaEventObject<Event>) => onChange(item.id, { x: e.target.x(), y: e.target.y(), scaleX: e.target.scaleX(), scaleY: e.target.scaleY(), rotation: e.target.rotation() }),
  };
  const stroke = { stroke: item.color, strokeWidth: item.width, hitStrokeWidth: Math.max(14, item.width), lineCap: 'round' as const, lineJoin: 'round' as const };
  const shapeStyle = item.shapeStyle ?? 'outline';
  const fill = shapeStyle === 'outline' ? undefined : item.fillColor ?? item.color;
  const strokeEnabled = shapeStyle !== 'fill';
  switch (item.type) {
    case 'image':
    case 'bucket': return <CanvasImage {...common} image={image} width={item.w} height={item.h} />;
    case 'rect': return <Rect {...common} {...stroke} fill={fill} strokeEnabled={strokeEnabled} width={item.w} height={item.h} />;
    case 'ellipse': return <Ellipse {...common} {...stroke} fill={fill} strokeEnabled={strokeEnabled} radiusX={(item.w ?? 0) / 2} radiusY={(item.h ?? 0) / 2} offsetX={-(item.w ?? 0) / 2} offsetY={-(item.h ?? 0) / 2} />;
    case 'arrow': return <Arrow {...common} {...stroke} fill={item.color} points={item.points ?? []} pointerLength={12 + item.width} pointerWidth={10 + item.width} />;
    case 'text': return <Text {...common} text={item.text} fill={item.color} fontSize={item.width * 2 + 18} fontFamily="Arial" />;
    default: return <Line {...common} {...stroke} points={item.points ?? []} globalCompositeOperation={item.type === 'eraser' ? 'destination-out' : 'source-over'} />;
  }
}
