import { DrawingPrimitive } from './types';

export const escapeSvg = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function drawingToSvg(graphics: DrawingPrimitive[]): string {
  return graphics.map(g => {
    const color = escapeSvg(g.color);
    switch (g.kind) {
      case 'line': return `<line x1="${g.x1}" y1="${g.y1}" x2="${g.x2}" y2="${g.y2}" stroke="${color}" stroke-width="${g.width ?? 0.6}" ${g.dash ? `stroke-dasharray="${g.dash.join(',')}"` : ''}/>`;
      case 'rect': return `<rect x="${g.x}" y="${g.y}" width="${g.width}" height="${g.height}" fill="none" stroke="${color}" stroke-width="${g.lineWidth ?? 0.6}" ${g.dash ? `stroke-dasharray="${g.dash.join(',')}"` : ''}/>`;
      case 'circle': return `<circle cx="${g.x}" cy="${g.y}" r="${g.radius}" fill="${g.fill ? escapeSvg(g.fill) : 'white'}" stroke="${color}" stroke-width="0.5"/>`;
      case 'text': return `<text x="${g.x}" y="${g.y}" fill="${color}" font-family="Arial, sans-serif" font-size="${g.size}" text-anchor="${g.anchor ?? 'start'}" ${g.rotation ? `transform="rotate(${g.rotation},${g.x},${g.y})"` : ''}>${g.text.split('\n').map((t, i) => `<tspan x="${g.x}" dy="${i ? g.size * 1.2 : 0}">${escapeSvg(t)}</tspan>`).join('')}</text>`;
    }
  }).join('');
}

/** Keep native vectors and native pin rotation in the same local coordinate system. */
export function rotateDrawing(graphics: DrawingPrimitive[], angle: number, width: number, height: number): DrawingPrimitive[] {
  if (!angle) return graphics;
  const radians = angle * Math.PI / 180, cos = Math.cos(radians), sin = Math.sin(radians);
  const point = (x: number, y: number) => ({ x: width / 2 + (x - width / 2) * cos - (y - height / 2) * sin,
    y: height / 2 + (x - width / 2) * sin + (y - height / 2) * cos });
  return graphics.map(g => {
    if (g.kind === 'line') {
      const a = point(g.x1, g.y1), b = point(g.x2, g.y2);
      return { ...g, x1: a.x, y1: a.y, x2: b.x, y2: b.y };
    }
    if (g.kind === 'rect') {
      const a = point(g.x, g.y), b = point(g.x + g.width, g.y + g.height);
      return { ...g, x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
    }
    const p = point(g.x, g.y);
    return g.kind === 'text' ? { ...g, ...p, rotation: (g.rotation ?? 0) + angle } : { ...g, ...p };
  });
}
