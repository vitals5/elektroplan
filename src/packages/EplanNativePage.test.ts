import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { EdbProjectParser } from './EdbProjectParser';
import { EodRecord, readEodTable } from './EodReader';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { drawingToSvg, rotateDrawing } from '../model/ImportedDrawing';
import { PdfExporter } from '../export/PdfExporter';
import { Page, PlacedComponent } from '../model/types';

const archive = Buffer.concat(['Eplan Haus.zip.001', 'Eplan Haus.zip.002'].map(f => fs.readFileSync(f)));
const zip = await JSZip.loadAsync(archive);
const result = await EdbProjectParser.parseEdbProject(zip);
const page = result.project.pages.find(p => p.title === 'Einspeisung')!;
assert(page.importedDrawing);
assert.equal(page.wires.length, 91);
assert(!page.importedDrawing.diagnostics.some(d => /fehlt|nicht unterstützt/.test(d)));
assert.equal(page.plotFrame.titleBlock.date, '15.09.2026');
assert.equal(new Set(page.components.map(c => c.id)).size, page.components.length);
assert.equal(new Set(page.wires.map(w => w.id)).size, page.wires.length);
const component = (id: number, type = 17) => page.components.find(c => c.id === `eplan_13_${type}_${id}`)!;
const pin = (c: PlacedComponent, id: number) => {
  const p = c.importedSymbol!.pins.find(p => p.id === String(id))!;
  assert(p, `Missing pin ${id} on ${c.id}`);
  return { x: c.x + p.x, y: c.y + p.y, name: p.name };
};
const cad = (p: { x: number; y: number }) => ({ x: p.x * 420 / 1000, y: 297 - p.y * 420 / 1000 });
const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

// Independent coordinates and pin labels from PDF page 2 (Blatt 1).
for (const [id, x] of [[0x9a33, 56], [0x9a34, 92]]) {
  const c = component(id);
  assert.equal(c.bmk, '-Q12');
  assert.equal(c.importedSymbol!.pins.length, 8);
  const p = cad(pin(c, 0)); close(p.x, x); close(p.y, 252);
}
assert.equal(page.components.filter(c => c.bmk === '-Q12' && c.importedSymbol?.pins.length === 8).length, 2);
assert(!page.components.some(c => c.bmk === '-F02'), 'Deleted F02 must not reappear');
for (const [id, label, x] of [[0xab, 'L1', 156], [0xac, 'L2', 164], [0xad, 'L3', 172], [0x8991, 'PEN', 188]] as const) {
  const c = component(id), p = cad(pin(c, 0));
  assert.equal(c.deviceTag, label); close(p.x, x); close(p.y, 72);
}
for (const [terminal, fusePin] of [[0xab, 0], [0xac, 2], [0xad, 4]]) {
  assert(page.wires.some(w => w.from.componentId === component(terminal).id && w.to.componentId === component(0x8988).id && w.to.pinId === String(fusePin)), 'Phase-specific F0 connection');
}
assert.deepEqual(component(0x8988).importedSymbol!.pins.map(p => p.name), ['1', '2', '3', '4', '5', '6']);
assert.equal(component(0x89e4).functionText, 'Tarifsteuergerät');
assert(page.importedDrawing.graphics.some(g => g.kind === 'text' && g.text === 'Heizung'));
const si = component(0x2d4, 70), so = component(0x2da, 70);
close(cad(pin(si, 0)).y, 144);
assert(si.importedSymbol!.importedGraphics!.some(g => g.kind === 'text' && g.text === '1-2.7'));
assert(so.importedSymbol!.importedGraphics!.some(g => g.kind === 'text' && g.text === '1-2.8'));
assert(component(0x2e5, 70).importedSymbol!.importedGraphics!.some(g => g.kind === 'text' && g.text === 'PE.BU'));

function validateConnections(p: Page): void {
  for (const w of p.wires) {
    for (const ep of [w.from, w.to]) {
      const c = p.components.find(c => c.id === ep.componentId)!;
      assert(c); assert(c.pins[ep.pinId]); assert(c.importedSymbol!.pins.some(p => p.id === ep.pinId));
    }
    for (const point of w.waypoints ?? []) assert(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
}
validateConnections(page);
const saved = JSON.parse(JSON.stringify(page)) as Page;
const before = JSON.stringify(saved.wires);
AutoconnectEngine.updatePageAutoconnections(saved);
assert.equal(JSON.stringify(saved.wires), before, 'Opening the page must preserve its explicit native graph');
validateConnections(saved);
assert(saved.components.every(c => c.importedSymbol && c.importedSymbol.width > 0 && c.importedSymbol.height > 0));
assert.equal(drawingToSvg([{ kind: 'text', x: 0, y: 0, text: '<script>&"', size: 8, color: '#000000' }]).includes('<script>'), false);

const rotated = rotateDrawing([{ kind: 'line', x1: 0, y1: 0, x2: 4, y2: 0, color: '#000000' }], 90, 4, 4)[0];
assert(rotated.kind === 'line'); close(rotated.x1, 4); close(rotated.y1, 0); close(rotated.x2, 4); close(rotated.y2, 4);

// A truncated EOD slot must not read a coordinate from its neighbour.
assert.equal(new EodRecord(1, 17, 1, new Uint8Array([0x5a, 0xed, 0])).position, undefined);
assert.throws(() => readEodTable(new Uint8Array(2), new Uint8Array(), 'Function'), /Nicht unterstütztes/);
const nativeIps = readEodTable(await zip.file('EPLAN-Haus.edb/IPoint.eod')!.async('uint8array'),
  await zip.file('EPLAN-Haus.edb/IPoint.eox')!.async('uint8array'), 'IPoint');
const heating = nativeIps.find(r => r.id === 137)!;
assert(heating.partial); assert.equal(heating.pageId, 13); assert.equal(heating.bmk, 'L1NT/L2NT/L3NT/NNT');
assert(heating.position, 'Readable placement prefix retained with an explicit diagnostic');
assert(page.importedDrawing.diagnostics.some(d => /Datenpräfix/.test(d)), 'Do not hide incomplete source coverage');

const pdf = await PdfExporter.exportToPdf(result.project, {
  paperFormat: 'a3', colorMode: 'color', pageRange: 'current', currentPageId: page.id,
  interactiveCrossReferences: true, includeBookmarks: false, includeTerminalDiagram: false,
  includePartsList: false, plotFrame: true
});
assert(pdf.size > 5000);
assert.equal(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 4)), '%PDF');
console.log('EPLAN Einspeisung: native placements, 91 complete connection endpoints, phase pins, UTF-8, cross references, JSON round trip and PDF export verified.');
