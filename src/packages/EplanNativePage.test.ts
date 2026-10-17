import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { EdbProjectParser } from './EdbProjectParser';
import { EodRecord, readEodTable } from './EodReader';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { getSymbolById, getSymbolForComponent, setProjectSymbolLibrary } from '../model/symbols';
import { PdfExporter } from '../export/PdfExporter';
import { connectionCutouts, supersededConnectionGraphics } from '../model/ConnectionGraphics';
import { CadCanvas } from '../editor/CadCanvas';
import { EPLAN_SCALE } from './EplanSymbolLibrary';
import { componentInsertionPoint } from '../model/SymbolGeometry';
import { gridForPage, snapSymbolPosition } from '../model/DrawingGrid';
import { Page, PlacedComponent, Project } from '../model/types';

const archive = Buffer.concat(['Eplan Haus.zip.001', 'Eplan Haus.zip.002'].map(f => fs.readFileSync(f)));
const zip = await JSZip.loadAsync(archive);
const { project, messages } = await EdbProjectParser.parseEdbProject(zip);
const page = project.pages.find(p => p.title === 'Einspeisung')!;
assert(project.symbolLibrary?.length);
assert.equal(page.importedDrawing, undefined, 'No special page drawing / theme path');
assert.equal(page.wires.length, 91);
assert.equal(page.plotFrame.titleBlock.date, '15.09.2026');
assert.equal(project.drawingUnitsPerMm, EPLAN_SCALE);
assert.deepEqual(page.grid, { spacing: 4 * EPLAN_SCALE, origin: { x: 0, y: 297 * EPLAN_SCALE } });
assert(!messages.some(d => /Bibliotheksanschluss.*fehlt|Anschluss nicht auflösbar|Bibliothekssymbol nicht auflösbar/.test(d)), 'Every source reference must resolve');
const component = (id: number, type = 17) => page.components.find(c => c.id === `eplan_13_${type}_${id}`)!;
const symbol = (c: PlacedComponent) => getSymbolForComponent(c, project)!;
const pin = (c: PlacedComponent, id: number) => {
  const s = symbol(c), p = s.pins.find(p => p.id === String(id))!;
  assert(p, `Missing physical pin ${id} on ${c.id}`);
  return AutoconnectEngine.getRotatedPinInfo(c, p, s);
};
const source = (p: { worldX: number; worldY: number }) => ({ x: p.worldX * 420 / 1000, y: 297 - p.worldY * 420 / 1000 });
const close = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

for (const [id, x] of [[0x9a33, 56], [0x9a34, 92]]) {
  const c = component(id);
  assert.equal(c.bmk, '-Q12'); assert.equal(symbol(c).pins.length, 8);
  const p = source(pin(c, 0)); close(p.x, x); close(p.y, 252);
}
assert.equal(component(0x9a33).symbolId, component(0x9a34).symbolId);
assert.strictEqual(symbol(component(0x9a33)), symbol(component(0x9a34)), 'Placements share one master definition');
assert.deepEqual(symbol(component(0x9a33)).source, { library: 'IEC_symbol', number: 1526, variant: 0 });
assert.equal(symbol(component(0x9a33)).importedGraphics!.length, 28, 'Actual QLTR4_2 source contours');
const insertion = componentInsertionPoint(component(0x9a33), symbol(component(0x9a33)));
close(insertion.x / EPLAN_SCALE, 56); close(297 - insertion.y / EPLAN_SCALE, 248);
const snappedQ12 = snapSymbolPosition(component(0x9a33), symbol(component(0x9a33)), 0, gridForPage(page), page.grid!.spacing);
close(snappedQ12.x, component(0x9a33).x); close(snappedQ12.y, component(0x9a33).y);
// Two upward-facing inputs must connect above the devices through the original
// corners, even though both endpoints have the same Y coordinate.
const q12UpperWire = page.wires.find(w => w.id === 'eplan_wire_13_24338')!;
assert.deepEqual(q12UpperWire.waypoints!.map(p => ({ x: Math.round(p.x / EPLAN_SCALE), y: Math.round(297 - p.y / EPLAN_SCALE) })),
  [{ x: 92, y: 280 }, { x: 56, y: 280 }]);
assert(page.wires.every(w => Math.abs(w.lineWidth! / EPLAN_SCALE - 0.25) < 1e-8));
const t66 = component(153626, 42), t66Symbol = symbol(t66);
assert(t66Symbol.connectionGraphic);
assert.equal(t66.source!.routingUsed, true);
assert(page.components.some(c => c.source?.objectType === 42 && c.source.routingUsed === false), 'Unused automatic routing records stay in the model as nonprinting helpers');
assert(t66Symbol.importedGraphics!.every(g => g.kind === 'line' && Math.abs(g.width! / EPLAN_SCALE - 0.25) < 1e-8));
assert(t66Symbol.pins.every(p => !p.labelPosition), 'Do not print physical indices on a routing node');
const bus = symbol(component(152377, 130));
assert.deepEqual([...new Set(bus.importedGraphics!.map(g => g.kind === 'line' ? Math.round(g.width! / EPLAN_SCALE * 100) / 100 : -1))].sort(), [0.25, 1]);
const replaced = supersededConnectionGraphics(page, project);
assert(replaced.has(component(38842).id), 'Explicit directed T replaces the co-located functional distributor ink');
assert(!replaced.has(component(38837).id), 'A distributor without an explicit routing glyph retains its real dot');
assert(connectionCutouts(page, project).length > 0);
const nodeSvg: any = Object.assign(Object.create(CadCanvas.prototype), { activePage: page, project, mode: 'select' });
assert.doesNotMatch(nodeSvg.renderWires(), /junction-dot/);
assert.doesNotMatch(nodeSvg.renderComponents(), /pin-handle/);
assert(!page.components.some(c => c.bmk === '-F02'), 'Deleted F02 must not reappear');
for (const [id, label, x] of [[0xab, 'L1', 156], [0xac, 'L2', 164], [0xad, 'L3', 172], [0x8991, 'PEN', 188]] as const) {
  const c = component(id), p = source(pin(c, 0));
  assert.equal(c.deviceTag, label); close(p.x, x); close(p.y, 74);
}
for (const [terminal, fusePin] of [[0xab, 0], [0xac, 2], [0xad, 4]]) {
  assert(page.wires.some(w => w.from.componentId === component(terminal).id && w.to.componentId === component(0x8988).id && w.to.pinId === String(fusePin)), 'Phase-specific F0 physical connection');
}
assert.equal(component(0x89e4).functionText, 'Tarifsteuergerät');
assert(page.components.some(c => c.functionText === 'Heizung'), 'Free texts are regular editable elements');
assert.equal(component(0x2d4, 70).crossRef, '/1-2.7');
assert.equal(component(0x2da, 70).crossRef, '/1-2.8');
CrossReferenceEngine.updateProjectCrossReferences(project);
assert.equal(component(0xab).crossRef ?? '', '', 'A terminal is not a cross-reference to every matching strip pin');
assert.equal(component(0x2d4, 70).crossRef, '/1-2.7', 'Explicit interruption-point references survive editor updates');

const allComponents = new Map(project.pages.flatMap(p => p.components).map(c => [c.id, c]));
const definitionIds = new Set(project.symbolLibrary!.map(s => s.id));
assert.equal(definitionIds.size, project.symbolLibrary!.length);
let wires = 0;
function validateConnections(p: Page): void {
  for (const w of p.wires) {
    for (const ep of [w.from, w.to]) {
      const c = p.components.find(c => c.id === ep.componentId)!;
      assert(c); assert(c.pins[ep.pinId]); assert(symbol(c).pins.some(p => p.id === ep.pinId));
    }
    for (const point of w.waypoints ?? []) assert(Number.isFinite(point.x) && Number.isFinite(point.y));
  }
}
for (const p of project.pages) {
  assert(p.grid, 'Every native page retains its physical grid and origin');
  assert.equal(p.importedDrawing, undefined);
  assert.equal(new Set(p.components.map(c => c.id)).size, p.components.length);
  for (const c of p.components) {
    assert(!c.importedSymbol, 'No geometry copied into placements');
    assert(definitionIds.has(c.symbolId), `Missing shared symbol ${c.symbolId}`);
    assert.strictEqual(getSymbolById(c.symbolId, project), symbol(c));
  }
  validateConnections(p);
  for (const c of p.components.filter(c => symbol(c).source)) {
    const definition = symbol(c);
    assert(definition.insertionPoint && definition.unitsPerMm === EPLAN_SCALE);
    for (const physicalPin of definition.pins) {
      const info = AutoconnectEngine.getRotatedPinInfo(c, physicalPin, definition);
      // Real contact edges at .75 mm remain exact quarter-mm coordinates;
      // coarse raster snapping must not round them away from their contour.
      for (const value of [info.worldX / EPLAN_SCALE, (297 - info.worldY / EPLAN_SCALE)])
        close(value * 4, Math.round(value * 4));
    }
  }
  const before = JSON.stringify(p.wires);
  AutoconnectEngine.updatePageAutoconnections(p);
  assert.equal(JSON.stringify(p.wires), before, `Opening ${p.title} must not invent connections`);
  wires += p.wires.length;
}
assert.equal(wires, 1753, 'All explicitly drawn native connections across all pages');
assert.equal(project.logicalConnections!.length, 162, 'Logical connections have no drawable page');
assert.equal(wires + project.logicalConnections!.length, 1915, 'No source connection silently lost');
for (const w of project.logicalConnections!) {
  for (const ep of [w.from, w.to]) {
    const c = allComponents.get(ep.componentId)!;
    assert(c?.pins[ep.pinId]); assert(symbol(c).pins.some(p => p.id === ep.pinId));
  }
}
for (const title of ['PV-Anlage', 'FI-Schalter Haus', 'Raumthermostate 1', 'Stromstoßrelais 1', 'Küche', 'Server']) {
  const other = project.pages.find(p => p.title === title)!;
  assert(other?.components.some(c => symbol(c).source), `${title} uses the embedded-library importer`);
  assert(other.wires.length > 0);
}

const restored = JSON.parse(JSON.stringify(project)) as Project;
setProjectSymbolLibrary(restored);
const editedPage = restored.pages.find(p => p.id === page.id)!;
const c = editedPage.components.find(c => c.id === component(0x9a33).id)!;
const s = getSymbolForComponent(c, restored)!;
const previousPin = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
c.bmk = '-Q99'; c.functionText = 'Bearbeitet'; c.technicalCharacteristics = '80 A';
c.pins['0'].customLabel = 'L1 neu'; c.x += 16; c.y += 8;
const moved = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
close(moved.worldX, previousPin.worldX + 16); close(moved.worldY, previousPin.worldY + 8);
c.rotation = 90;
const rotated = AutoconnectEngine.getRotatedPinInfo(c, s.pins[0], s);
assert.equal(rotated.direction, 'right');
assert(Number.isFinite(rotated.worldX) && Number.isFinite(rotated.worldY));
const roundtrip = JSON.parse(JSON.stringify(restored)) as Project;
const reloaded = roundtrip.pages.find(p => p.id === page.id)!.components.find(x => x.id === c.id)!;
assert.equal(reloaded.bmk, '-Q99'); assert.equal(reloaded.functionText, 'Bearbeitet');
assert.equal(reloaded.pins['0'].customLabel, 'L1 neu'); assert.equal(reloaded.rotation, 90);
assert.equal(getSymbolForComponent(reloaded, roundtrip)!.pins.length, 8);
const pdf = await PdfExporter.exportToPdf(roundtrip, {
  paperFormat: 'a3', colorMode: 'color', pageRange: 'current', currentPageId: page.id,
  interactiveCrossReferences: true, includeBookmarks: false, includeTerminalDiagram: false,
  includePartsList: false, plotFrame: true
});
const pdfData = await pdf.arrayBuffer();
assert.equal(new TextDecoder().decode(pdfData.slice(0, 4)), '%PDF');
assert(pdfData.byteLength > 5000);
assert.equal(new EodRecord(1, 17, 1, new Uint8Array([0x5a, 0xed, 0])).position, undefined);
assert.throws(() => readEodTable(new Uint8Array(2), new Uint8Array(), 'Function'), /Nicht unterstütztes/);
assert(page.importDiagnostics!.some(d => /Datenpräfix/.test(d)), 'Partial coverage remains explicit');
console.log('✓ General embedded-library import: all active pages, 1753 drawn + 162 logical connections, editable shared symbols, JSON and PDF');
