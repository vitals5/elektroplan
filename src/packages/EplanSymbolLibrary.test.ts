import assert from 'node:assert/strict';
import fs from 'node:fs';
import JSZip from 'jszip';
import { EodRecord, readEodTable } from './EodReader';
import { EPLAN_SCALE, EplanSymbolLibrary, eplanPrimitives, normalizeDefinition, sourcePinLabelPositions } from './EplanSymbolLibrary';
import { PinDefinition, SymbolDefinition } from '../model/types';

const u16 = (n: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const f64 = (n: number) => { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; };
const tag = (n: number, payload: Uint8Array) => Buffer.concat([u16(n), payload]);
const pin: PinDefinition = { id: '0', name: '1', x: 0, y: -4 * EPLAN_SCALE, direction: 'top' };
const layers = new Map([[420, { lineWidth: 0.35, fontSize: 1.8 }]]);
const close = (a: number, b: number) => assert(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
function placement(options: { index?: number; orientation?: number; alignment?: number; point?: Buffer; angle?: number; font?: number } = {}) {
  return Buffer.concat([
    tag(0xea65, u16(0x35)), tag(0xea64, u16(1)), tag(0xea67, Buffer.concat([u16(0x2d), u32(2692)])),
    tag(0xebfb, u16(420)), tag(0xec55, options.point ?? Buffer.concat([f64(0.6), f64(0.6)])),
    tag(0xec57, u16(options.alignment ?? 20)),
    ...(options.angle === undefined ? [] : [tag(0xee22, f64(options.angle))]),
    ...(options.font === undefined ? [] : [tag(0xee21, f64(options.font))]),
    u16(0xffff), tag(0xed63, u16(20028)), tag(0xed64, u16(options.index ?? 1)),
    tag(0xee19, Buffer.from([options.orientation ?? 2])), tag(0xee1a, Buffer.from([16])), u16(0xffff)
  ]);
}

const [placed] = sourcePinLabelPositions(Buffer.concat([
  placement({ orientation: 1, point: Buffer.concat([f64(-10), f64(-10)]) }), placement()
]), [pin], layers);
assert(placed.labelPosition);
close(placed.labelPosition.fontSize, 1.8 * EPLAN_SCALE * 1.242);
close(placed.labelPosition.x, 0.6 * EPLAN_SCALE);
close(placed.labelPosition.y, -4.6 * EPLAN_SCALE - placed.labelPosition.fontSize * 0.12753948);
assert.equal(placed.labelPosition.rotation, 0);
assert.equal(sourcePinLabelPositions(placement({ index: 2 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ orientation: 1 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ alignment: 123 }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement().subarray(0, -1), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ font: NaN }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ angle: NaN }), [pin], layers)[0].labelPosition, undefined);
assert.equal(sourcePinLabelPositions(placement({ angle: -16002 }), [pin], layers)[0].labelPosition?.rotation, 0);
assert.equal(sourcePinLabelPositions(placement(), [pin], new Map())[0].labelPosition, undefined);
// A truncated object must not take its missing suffix or coordinates from the next object.
assert(sourcePinLabelPositions(Buffer.concat([placement().subarray(0, 30), placement()]), [pin], layers)[0].labelPosition);
// Float mantissa bytes resembling ED63 / property 20011 are data, not a field.
const fakeTagFloat = Buffer.from('63ed2b4e0000e03f', 'hex');
const [floatPlacement] = sourcePinLabelPositions(placement({ point: Buffer.concat([fakeTagFloat, f64(0.6)]) }), [pin], layers);
assert(floatPlacement.labelPosition);
close(floatPlacement.labelPosition.x, fakeTagFloat.readDoubleLE() * EPLAN_SCALE);
const [rotated] = sourcePinLabelPositions(placement({ angle: Math.PI / 2 }), [pin], layers);
assert.equal(rotated.labelPosition?.rotation, 270);

const definition: SymbolDefinition = { id: 'test', name: 'test', category: 'controls', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', width: 0, height: 0, pins: [placed], svgContent: '', description: '' };
const normalized = normalizeDefinition(definition);
close(definition.pins[0].labelPosition!.y, placed.labelPosition.y + normalized.origin.y);
close(definition.pins[0].labelPosition!.x, placed.labelPosition.x + normalized.origin.x);

const line = new EodRecord(1, 0x1f, 1, Buffer.concat([tag(0xebfb, u16(420)),
  tag(0xec73, Buffer.concat([f64(0), f64(1)])), tag(0xec74, Buffer.concat([f64(0), f64(2)]))]));
const [graphic] = eplanPrimitives(line, layers);
assert.equal(graphic.kind, 'line');
if (graphic.kind === 'line') close(graphic.width!, 0.35 * EPLAN_SCALE);

// Real indexed variant records verify the layout across all used project pages.
const zip = await JSZip.loadAsync(Buffer.concat(['Eplan Haus.zip.001', 'Eplan Haus.zip.002'].map(f => fs.readFileSync(f))));
const root = 'EPLAN-Haus.edb/';
const records: EodRecord[] = [];
for (const table of ['Function', 'Instance', 'IPoint', 'Potential'] as const) records.push(...readEodTable(
  await zip.file(`${root}${table}.eod`)!.async('uint8array'), await zip.file(`${root}${table}.eox`)!.async('uint8array'), table));
const library = await EplanSymbolLibrary.create(zip, root);
await library.prepare(records);
const entries = new Map(records.filter(r => r.symbol !== undefined).map(r => {
  const entry = library.resolve(r)!; return [entry.definition.id, entry];
}));
assert.equal([...entries.values()].flatMap(e => e.definition.pins).filter(p => p.labelPosition).length, 107);
const f0 = library.resolve(records.find(r => r.id === 0x8988 && r.pageId === 13 && r.type === 17)!)!;
const f0pin = f0.definition.pins.find(p => p.id === '0')!.labelPosition!;
// PDF reference F0 pin 1 baseline: (443.906 pt, 669.302 pt).
close((156 + (f0pin.x - f0.origin.x) / EPLAN_SCALE) * 72 / 25.4, 443.9055118110236);
assert(Math.abs(((297 - 56) + (f0pin.y - f0.origin.y) / EPLAN_SCALE) * 72 / 25.4 - 669.302001953125) < 0.001);
const special = [...entries.values()].filter(e => e.definition.source!.library === 'SPECIAL'
  && [8, 17, 75, 77, 78].includes(e.definition.source!.number));
assert(special.length);
assert(special.every(e => e.definition.pins.every(p => !p.labelPosition)), 'Connection graphics do not get synthetic physical pin labels');
// World-independent source coordinates corroborated against the PDF export:
// directional junctions have diagonal strokes, not synthesized circular dots.
for (const [number, variant, segments] of [
  [64, 0, [[-2, 0, 0, 0], [0, 0, 0, -2], [0, -2, 2, 0]]],
  [66, 0, [[0, -2, 0, 2], [0, -2, 2, 0]]],
  [66, 1, [[0, 2, 0, -2], [0, 2, 2, 0]]],
  [69, 0, [[0, 2, 0, -2], [0, 2, 2, 0], [-2, 0, 0, -2]]],
  [72, 0, [[0, 2, 0, 0], [-2, 0, 0, 0], [0, 2, 2, 0]]]
] as const) {
  const entry = [...entries.values()].find(e => e.definition.source!.library === 'SPECIAL'
    && e.definition.source!.number === number && e.definition.source!.variant === variant)!;
  assert(entry, `Missing source variant ${number}:${variant}`);
  const actual = entry.definition.importedGraphics!.map(g => {
    assert.equal(g.kind, 'line');
    if (g.kind !== 'line') throw new Error('Expected source line');
    close(g.width! / EPLAN_SCALE, 0.25);
    const round = (n: number) => Math.round(n * 1e6) / 1e6 || 0;
    return [round((g.x1 - entry.origin.x) / EPLAN_SCALE), round(-(g.y1 - entry.origin.y) / EPLAN_SCALE),
      round((g.x2 - entry.origin.x) / EPLAN_SCALE), round(-(g.y2 - entry.origin.y) / EPLAN_SCALE)];
  });
  assert.deepEqual(actual, segments);
}
console.log('EPLAN source pin-label layouts: passed (107 used library pin labels)');
