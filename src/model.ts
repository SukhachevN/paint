export type Tool = 'select' | 'pen' | 'eraser' | 'bucket' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text';
export type ShapeStyle = 'outline' | 'fill' | 'both';
export type Item = {
  id: string; type: Tool | 'image'; x: number; y: number; color: string; width: number;
  w?: number; h?: number; points?: number[]; text?: string; src?: string;
  scaleX?: number; scaleY?: number; rotation?: number;
  shapeStyle?: ShapeStyle; fillColor?: string;
};
export type Document = { version: 1; width: number; height: number; items: Item[] };
export const blank = (): Document => ({ version: 1, width: 1200, height: 800, items: [] });
export function isDocument(value: unknown): value is Document {
  if (!value || typeof value !== 'object') return false;
  const d = value as Document;
  return d.version === 1 && Number.isFinite(d.width) && d.width >= 100 && d.width <= 4096
    && Number.isFinite(d.height) && d.height >= 100 && d.height <= 4096 && Array.isArray(d.items)
    && d.items.every(i => i && typeof i.id === 'string' && Number.isFinite(i.x) && Number.isFinite(i.y)
      && ['select','pen','eraser','bucket','line','arrow','rect','ellipse','text','image'].includes(i.type));
}
