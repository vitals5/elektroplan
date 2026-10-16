import JSZip from 'jszip';
import { DrawingPrimitive, PinDefinition, SymbolDefinition, TextFormatConfig } from '../model/types';
import { drawingToSvg } from '../model/ImportedDrawing';
import { EodRecord, eplanText, readIndexedEodRecords } from './EodReader';

export const EPLAN_SCALE = 1000 / 420;
export type Point = { x: number; y: number };
export type LibraryEntry = {
  definition: SymbolDefinition;
  /** Insertion point in the normalized, y-down library definition. */
  origin: Point;
  labels: Map<number, Point>;
};
const zero = { x: 0, y: 0 };
const direction: Record<number, PinDefinition['direction']> = { 1: 'top', 2: 'right', 4: 'bottom', 8: 'left' };

/** Only immutable geometry and physical pins belong to a library definition. */
export function eplanPrimitives(record: EodRecord): DrawingPrimitive[] {
  const s = EPLAN_SCALE, at = (p: Point) => ({ x: p.x * s, y: -p.y * s });
  const color = 'currentColor', width = 0.55;
  if (record.type === 0x1f) {
    const a = at(record.point(0xec73) ?? zero), b = at(record.point(0xec74) ?? zero);
    return [{ kind: 'line', x1: a.x, y1: a.y, x2: b.x, y2: b.y, color, width }];
  }
  if (record.type === 0x20) {
    const center = at(record.point(0xec8b) ?? zero), radius = record.point(0xec8c);
    if (!radius) return [];
    const fill = record.number(0xec8e, 1) === 1 ? color : undefined;
    return [{ kind: 'circle', ...center, radius: Math.hypot(radius.x, radius.y) * s, color, fill }];
  }
  if (record.type === 0x59) {
    const a = at(record.point(0xf0d3) ?? zero), b = at(record.point(0xf0d4) ?? zero);
    return [{ kind: 'rect', x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
      width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y), color, lineWidth: width }];
  }
  if (record.type === 0x22) {
    const points: Point[] = [];
    for (let i = record.find(0xeccd); i >= 0; i = record.find(0xeccd, i + 18)) {
      const p = new EodRecord(0, 0, 0, record.data.subarray(i)).point(0xeccd);
      if (p) points.push(at(p));
    }
    if (points.length < 2) return [];
    const closed = points.length > 2 && Math.hypot(points[0].x - points.at(-1)!.x, points[0].y - points.at(-1)!.y) < 1e-6;
    if (closed) return [{ kind: 'polygon', points, color, width }];
    return points.slice(1).map((p, i) => ({ kind: 'line', x1: points[i].x, y1: points[i].y, x2: p.x, y2: p.y, color, width }));
  }
  if (record.type === 0x1e) {
    const text = eplanText(record.string(0xec5f));
    // A literal tilde is a P8 placeholder, not an immutable printed label.
    if (!text || text === '~') return [];
    return [{ kind: 'text', ...at(record.point(0xec55) ?? zero), text, color,
      size: (record.double(0xee21) ?? 2.5) * s }];
  }
  return [];
}

export function translatePrimitives(graphics: DrawingPrimitive[], dx: number, dy: number): DrawingPrimitive[] {
  return graphics.map(g => g.kind === 'line' ? { ...g, x1: g.x1 + dx, y1: g.y1 + dy, x2: g.x2 + dx, y2: g.y2 + dy }
    : g.kind === 'polygon' ? { ...g, points: g.points.map(p => ({ x: p.x + dx, y: p.y + dy })) }
    : { ...g, x: g.x + dx, y: g.y + dy });
}

export function normalizeDefinition(definition: SymbolDefinition, labels = new Map<number, Point>()): LibraryEntry {
  const bounds: Point[] = [{ x: 0, y: 0 }, ...definition.pins];
  for (const g of definition.importedGraphics ?? []) {
    if (g.kind === 'line') bounds.push({ x: g.x1, y: g.y1 }, { x: g.x2, y: g.y2 });
    else if (g.kind === 'rect') bounds.push(g, { x: g.x + g.width, y: g.y + g.height });
    else if (g.kind === 'circle' || g.kind === 'arc') bounds.push({ x: g.x - g.radius, y: g.y - g.radius }, { x: g.x + g.radius, y: g.y + g.radius });
    else if (g.kind === 'polygon') bounds.push(...g.points);
    else bounds.push({ x: g.x, y: g.y - g.size }, { x: g.x + g.text.length * g.size * 0.55, y: g.y });
  }
  const minX = Math.min(...bounds.map(p => p.x)), minY = Math.min(...bounds.map(p => p.y));
  definition.width = Math.max(1, Math.max(...bounds.map(p => p.x)) - minX);
  definition.height = Math.max(1, Math.max(...bounds.map(p => p.y)) - minY);
  definition.pins = definition.pins.map(p => ({ ...p, x: p.x - minX, y: p.y - minY }));
  definition.importedGraphics = translatePrimitives(definition.importedGraphics ?? [], -minX, -minY);
  definition.svgContent = drawingToSvg(definition.importedGraphics, { color: 'currentColor' });
  return { definition, origin: { x: -minX, y: -minY }, labels };
}

/** Property-placement subrecords are separate from the variant's physical pin list. */
export function propertyPositions(data: Uint8Array): Map<number, Point> {
  const result = new Map<number, Point>();
  for (let i = 0; i + 6 < data.length; i++) {
    if (data[i] !== 0x65 || data[i + 1] !== 0xea || data[i + 2] !== 0x35) continue;
    let end = i + 4;
    while (end + 3 < data.length && !(data[end] === 0x65 && data[end + 1] === 0xea)) end++;
    const r = new EodRecord(0, 0x35, 0, data.subarray(i, end + 3));
    const field = r.number(0xed63), point = r.point(0xec55);
    if (field && point && !result.has(field)) result.set(field, point);
  }
  return result;
}

export function labelPosition(entry: LibraryEntry, field: number, override?: Map<number, Point>): TextFormatConfig {
  const p = override?.get(field) ?? entry.labels.get(field);
  if (!p) return { visible: field === 20010 };
  const d = entry.definition;
  const base = field === 20010 ? { x: d.width / 2, y: -8 }
    : { x: d.width / 2, y: d.height + (field === 20011 ? 12 : 22) };
  return { preset: 'custom', offsetX: entry.origin.x + p.x * EPLAN_SCALE - base.x,
    offsetY: entry.origin.y - p.y * EPLAN_SCALE - base.y, alignment: 'start', fontSize: field === 20010 ? 7 : 6, visible: true };
}

/** Embedded master data, indexed by the project setting and original symbol numbers. */
export class EplanSymbolLibrary {
  private entries = new Map<string, LibraryEntry>();
  private names: string[];
  readonly diagnostics: string[] = [];
  readonly definitions: SymbolDefinition[] = [];
  private constructor(private zip: JSZip, private root: string, names: string[]) { this.names = names; }

  static async create(zip: JSZip, root: string): Promise<EplanSymbolLibrary> {
    const setting = zip.file(`${root}Settings.xdb/Setting.eod`);
    if (!setting) throw new Error('EPLAN-Bibliotheksverzeichnis Settings.xdb/Setting.eod fehlt.');
    const data = await setting.async('uint8array');
    const key = new TextEncoder().encode('TrDMProject.EmbeddedMasterDataLibraries.SymbolLibs');
    let start = -1;
    outer: for (let i = 0; i <= data.length - key.length; i++) {
      for (let j = 0; j < key.length; j++) if (data[i + j] !== key[j]) continue outer;
      start = i + key.length; break;
    }
    if (start < 0) throw new Error('Keine Zuordnung der eingebetteten EPLAN-Symbolbibliotheken gefunden.');
    let names: string[] | undefined;
    for (let i = start; i + 11 < Math.min(data.length, start + 1024); i++) {
      if (data[i] !== 0x95 || data[i + 1] !== 3 || data[i + 2] !== 0x92) continue;
      const v = new DataView(data.buffer, data.byteOffset + i + 3, 8);
      const length = v.getUint32(0, true), count = v.getUint32(4, true);
      if (length < 4 || count > 1024 || i + 7 + length > data.length) continue;
      names = new TextDecoder().decode(data.subarray(i + 11, i + 7 + length)).split('\0').slice(0, count); break;
    }
    if (!names) throw new Error('Die EPLAN-Bibliothekszuordnung ist nicht lesbar.');
    return new EplanSymbolLibrary(zip, root, names);
  }

  private loaded = new Set<number>();
  async prepare(records: EodRecord[]): Promise<void> {
    const requested = new Set(records.filter(r => r.symbol !== undefined).map(r => `${r.number(0xef4d) ?? 0}:${r.symbol}:${r.variant}`));
    const indexes = new Set(records.filter(r => r.symbol !== undefined).map(r => r.number(0xef4d) ?? 0));
    // Keep the archive's data buffers bounded: each library is released before the next.
    for (const index of indexes) await this.load(index, requested);
  }

  private async load(index: number, requested: Set<string>): Promise<void> {
    if (this.loaded.has(index)) return;
    this.loaded.add(index);
    const library = this.names[index];
    if (!library) { this.diagnostics.push(`Symbolbibliothek mit Index ${index} fehlt.`); return; }
    const table = async (name: string, size: number): Promise<EodRecord[]> => {
      const path = `${this.root}${library}.sdb/${name}`;
      const data = this.zip.file(`${path}.eod`), ix = this.zip.file(`${path}.eox`);
      if (!data || !ix) throw new Error(`Eingebettete Symbolbibliothek unvollständig: ${path}`);
      return readIndexedEodRecords(await data.async('uint8array'), await ix.async('uint8array'), { size, typedIndex: false }, name);
    };
    const [symbols, variants, instances] = await Promise.all([table('Symbol', 901), table('Variant', 635), table('Instance', 134)]);
    const symbolsById = new Map(symbols.map(s => [s.id, s]));
    const shapes = new Map<number, EodRecord[]>();
    for (const instance of instances) {
      if (instance.number(0xebf1) !== 0x2d) continue;
      const id = instance.number(0xebf1, 4, 4)!;
      if (!shapes.has(id)) shapes.set(id, []);
      shapes.get(id)!.push(instance);
    }
    for (const variant of variants) {
      const symbol = symbolsById.get(variant.number(0xed95, 4, 4)!);
      if (!symbol) continue;
      const number = symbol.number(0xeb52) ?? 0, variantIndex = variant.number(0xed96, 1) ?? 0;
      if (!requested.has(`${index}:${number}:${variantIndex}`)) continue;
      const pins: PinDefinition[] = [];
      const propertyStart = variant.find(0xea65), pinData = propertyStart >= 0 ? variant.data.subarray(0, propertyStart) : variant.data;
      const header = new EodRecord(0, 0, 0, pinData);
      for (let i = header.find(0xed97); i >= 0; i = header.find(0xed97, i + 2)) {
        let end = i + 2;
        while (end + 1 < pinData.length && !(pinData[end] === 255 && pinData[end + 1] === 255)) end++;
        const pin = new EodRecord(0, 0, 0, pinData.subarray(i, end));
        const index = pin.number(0xedbd) ?? 0, p = pin.point(0xedbe) ?? zero;
        pins.push({ id: String(index), name: String(index + 1), x: p.x * EPLAN_SCALE, y: -p.y * EPLAN_SCALE,
          direction: direction[pin.number(0xedbf, 1) ?? 1] ?? 'top' });
      }
      const name = symbol.string(0xeb51) || String(number);
      const description = eplanText(symbol.string(0xeb53));
      const functionClass = symbol.number(0xefc5);
      const definition: SymbolDefinition = {
        id: `eplan:${library}:${number}:${variantIndex}`, name: `${library} / ${name} [${number}:${variantIndex}]`,
        category: functionClass === 100 || functionClass === 1302 ? 'terminals' : functionClass === 1303 ? 'controls'
          : functionClass === 200 ? 'relays' : library === 'SPECIAL' ? 'connections' : /^F/.test(name) ? 'protection' : /^K/.test(name) ? 'relays'
          : /^X/.test(name) ? 'terminals' : 'controls',
        standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '',
        width: 1, height: 1, pins, svgContent: '', description: description || `${library}: ${name}`,
        importedGraphics: (shapes.get(variant.id) ?? []).flatMap(eplanPrimitives), source: { library, number, variant: variantIndex },
        isMaster: functionClass === 200 || undefined,
        isContact: functionClass === 201 || functionClass === 202 || undefined,
        contactType: functionClass === 202 ? 'NC' : functionClass === 201 ? (symbol.number(0xefc7) === 3 ? 'PowerNO' : 'NO') : undefined
      };
      const entry = normalizeDefinition(definition, propertyPositions(variant.data));
      this.entries.set(`${index}:${number}:${variantIndex}`, entry);
    }
  }

  resolve(record: EodRecord): LibraryEntry | undefined {
    const key = `${record.number(0xef4d) ?? 0}:${record.symbol ?? 0}:${record.variant}`;
    return this.entries.get(key);
  }

  use(entry: LibraryEntry): void {
    if (!this.definitions.some(d => d.id === entry.definition.id)) this.definitions.push(entry.definition);
  }
}
