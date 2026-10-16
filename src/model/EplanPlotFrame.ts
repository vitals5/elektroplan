import { DrawingPrimitive, Page } from './types';

/** F26-style A3 plot frame in the same millimetre coordinate system as P8. */
export function eplanPlotFrame(page: Page): DrawingPrimitive[] {
  const s = page.plotFrame.width / 420, g: DrawingPrimitive[] = [], color = '#74a348';
  const line = (x1: number, y1: number, x2: number, y2: number) => g.push({ kind: 'line', x1: x1 * s,
    y1: y1 * s, x2: x2 * s, y2: y2 * s, color, width: 0.45 });
  const text = (x: number, y: number, value: string, size = 2) => g.push({ kind: 'text', x: x * s, y: y * s,
    text: value, size: size * s, color });
  line(0, 0, 420, 0); line(0, 5, 420, 5); line(0, 281, 420, 281); line(0, 297, 420, 297);
  line(0, 0, 0, 297); line(420, 0, 420, 297);
  for (let i = 0; i < 10; i++) { line(i * 42, 0, i * 42, 5); text(i * 42 + 20, 3.6, String(i), 1.6); }
  for (const x of [60, 100, 184, 230, 300, 370, 400]) line(x, 281, x, 297);
  for (const y of [285, 289, 293]) { line(0, y, 100, y); line(370, y, 420, y); }
  for (const x of [20, 40]) line(x, 281, x, 297);
  const tb = page.plotFrame.titleBlock;
  text(61, 284, 'Datum'); text(73, 284, tb.date); text(61, 288, 'Bearb.'); text(73, 288, tb.author);
  text(61, 292, 'Gepr.'); text(61, 296, 'Urspr.'); text(1, 296, 'Änderung'); text(21, 296, 'Datum'); text(41, 296, 'Name');
  text(101, 292, tb.projectTitle.split(' - ').slice(1).join(' - ') || tb.projectTitle, 2.5);
  text(101, 296, 'Ersatz von'); text(142, 296, 'Ersetzt durch');
  text(185, 285, tb.company, 3); text(231, 285, page.title, 3);
  text(371, 284, page.higherLevel.replace(/^=/, '= ')); text(371, 288, page.location.replace(/^\+/, '+ '));
  text(401, 292, 'Blatt   ' + page.pageNumber); text(401, 296, 'Seite   ' + tb.sheetNumber);
  return g;
}
