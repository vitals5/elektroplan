import JSZip from 'jszip';
import { DrawingPrimitive, Page, PinDefinition, PlacedComponent, Wire } from '../model/types';
import { EodRecord, eplanText, readEodTable, EOD_LAYOUTS } from './EodReader';

const SCALE = 1000 / 420;
const BLUE = '#0000ff', RED = '#ff0000';
type Point = { x: number; y: number };
const canvas = (p: Point): Point => ({ x: p.x * SCALE, y: (297 - p.y) * SCALE });
const identity = (r: EodRecord) => `${r.type}:${r.id}`;

/** Native placements for the symbol families verified against the P8 Einspeisung export. */
export class EplanNativePage {
  static async import(zip: JSZip, root: string, pageId: number, page: Page, pageNumbers: Map<number, string>): Promise<boolean> {
    if (page.title !== 'Einspeisung') return false;
    const tables = {} as Record<keyof typeof EOD_LAYOUTS, EodRecord[]>;
    for (const name of Object.keys(EOD_LAYOUTS) as (keyof typeof EOD_LAYOUTS)[]) {
      const data = zip.file(`${root}${name}.eod`), index = zip.file(`${root}${name}.eox`);
      if (!data || !index) return false;
      const bytes = await data.async('uint8array');
      if (bytes.length % EOD_LAYOUTS[name].size !== 0) return false;
      tables[name] = readEodTable(bytes, await index.async('uint8array'), name);
    }
    const pageRecord = tables.Page.find(r => r.id === pageId);
    const stamp = pageRecord?.string(0x2b10, 4);
    if (stamp && /^\d+$/.test(stamp)) page.plotFrame.titleBlock.date = new Date(Number(stamp) * 1000).toISOString().slice(0, 10).split('-').reverse().join('.');
    const editor = pageRecord?.string(0x2b0e, 4);
    if (editor) page.plotFrame.titleBlock.author = editor;
    const functions = tables.Function.filter(r => r.pageId === pageId);
    const instances = tables.Instance.filter(r => r.pageId === pageId);
    const ipoints = tables.IPoint.filter(r => r.pageId === pageId);
    const potentials = tables.Potential.filter(r => r.pageId === pageId);
    const connections = tables.Connection.filter(r => r.pageId === pageId);
    if (!functions.length || !connections.length) return false;
    const diagnostics: string[] = [];
    const graphics: DrawingPrimitive[] = [];
    const components: PlacedComponent[] = [];
    const objects = new Map<string, PlacedComponent>();
    const points = new Map<string, { point: Point; direction?: PinDefinition['direction'] }>();
    const routingNodes = [...instances.filter(r => r.type === 0x2a), ...functions.filter(r => r.symbol === 321)]
      .flatMap(r => r.position ? [r.position] : []);
    const referenced = new Set(connections.flatMap(r => [
      `${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`,
      `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`
    ]));

    const make = (record: EodRecord, category: 'protection' | 'connections' | 'controls' = 'connections') => {
      const pos = record.position;
      if (!pos) return;
      const g: DrawingPrimitive[] = [], pins: PinDefinition[] = [];
      const addLine = (x1: number, y1: number, x2: number, y2: number, color = BLUE, width = 0.55) =>
        g.push({ kind: 'line', x1: x1 * SCALE, y1: -y1 * SCALE, x2: x2 * SCALE, y2: -y2 * SCALE, color, width });
      const text = (x: number, y: number, value: string, color = BLUE, size = 3, anchor: 'start' | 'end' | 'middle' = 'start') => {
        if (value) g.push({ kind: 'text', x: x * SCALE, y: -y * SCALE, text: value, color, size: size * SCALE, anchor });
      };
      const circle = (x: number, y: number, radius = 1, color = BLUE, fill?: string) =>
        g.push({ kind: 'circle', x: x * SCALE, y: -y * SCALE, radius: radius * SCALE, color, fill });
      const pin = (i: number, x: number, y: number, direction?: PinDefinition['direction'], name = '') => {
        pins.push({ id: String(i), name, x: x * SCALE, y: -y * SCALE, direction: direction ?? 'top' });
        points.set(`${identity(record)}:${i}`, { point: { x: pos.x + x, y: pos.y + y }, direction });
      };
      const symbol = record.symbol, variant = record.variant;
      const bmk = record.bmk ? '-' + record.bmk : '';
      const terminal = record.string(0x4e3e, 4);
      const label = eplanText(record.string(0x4e2b, 4));
      const tech = eplanText(record.string(0x4e3b, 4));
      let description = label;
      if (record.type === 0x46) {
        const name = record.string(0xee2c) + record.string(0xee2d) + (record.string(0xee2e) ? '.' + record.string(0xee2e) : '');
        const other = tables.IPoint.find(r => r.pageId !== pageId && r.bmk === record.bmk && r.position && r.pageId && pageNumbers.has(r.pageId));
        const reference = other ? `${pageNumbers.get(other.pageId!)}.${Math.floor(other.position!.x / 42)}` : '';
        const up = variant === 1 || variant === 5, down = variant === 3;
        for (let i = 0; i < 2; i++) pin(i, 0, 0, up ? 'bottom' : down ? 'top' : 'left', name);
        if (up || down) {
          const sign = up ? 1 : -1;
          addLine(0, 0, 0, -3 * sign, RED);
          addLine(0, 0, -0.8, -2 * sign, RED, 1.2);
          addLine(0, 0, 0.8, -2 * sign, RED, 1.2);
          text(0, up ? -6 : -5, name, BLUE, 3, 'middle');
          text(0, up && variant !== 5 ? 4 : -9, reference, '#74a348', 2.2, 'middle');
        } else {
          addLine(-3, 0, 0, 0, RED);
          addLine(0, 0, -2, 0.8, RED, 1.2); addLine(0, 0, -2, -0.8, RED, 1.2);
          text(1, -1, name, BLUE, 3);
          text(1 + name.length * 1.7, -1, reference ? '/ ' + reference : '', '#74a348', 2.2);
        }
        description = name;
      } else if (symbol === 0 && record.type === 0x11) {
        const a = record.point(0xeb1e), b = record.point(0xeb1f);
        if (!a || !b) return;
        g.push({ kind: 'rect', x: Math.min(a.x, b.x) * SCALE, y: -Math.max(a.y, b.y) * SCALE,
          width: Math.abs(b.x - a.x) * SCALE, height: Math.abs(b.y - a.y) * SCALE, color: BLUE, dash: [5, 4] });
        text(-1, -3.5, bmk, BLUE, 3, 'end');
        text(-1, -22, label, '#000000', 2, 'end');
      } else if (symbol === 174 || symbol === 1022 || symbol === 98 || symbol === 1526) {
        const count = symbol === 1526 ? 4 : symbol === 98 ? 1 : 3;
        const top = symbol === 1022 ? 5 : 4, bottom = symbol === 1022 ? -5 : -4;
        const names = record.pins;
        for (let pole = 0; pole < count; pole++) {
          const x = pole * 8;
          pin(pole * 2, x, top, 'top', names[pole * 2] ?? String(pole * 2 + 1));
          pin(pole * 2 + 1, x, bottom, 'bottom', names[pole * 2 + 1] ?? String(pole * 2 + 2));
          addLine(x, top, x, 2); addLine(x, -2, x, bottom);
          addLine(x, -2, x - 2.5, 2.5);
          if (symbol === 1022) {
            addLine(x - 3, 2, x - 1.4, 2.5); addLine(x - 1.4, 2.5, x, -2);
            addLine(x, -2, x - 1.6, -2.5); addLine(x - 1.6, -2.5, x - 3, 2);
          } else if (symbol !== 1526) {
            addLine(x - 2, 1, x - 4.5, -0.5); addLine(x - 2.3, 0.5, x - 4.8, -1);
          }
          text(x + 1, top, names[pole * 2] || String(pole * 2 + 1), '#000000', 2);
          text(x + 1, bottom - 1, names[pole * 2 + 1] || String(pole * 2 + 2), '#000000', 2);
        }
        if (count > 1) { addLine(-2, 0, (count - 1) * 8, 0); }
        // A device box owns the common BMK for distributed switching contacts.
        if (symbol !== 1526) { text(-6, 0, bmk, BLUE, 3, 'end'); text(-6, -3, tech || label, '#000000', 2, 'end'); }
        category = 'protection';
      } else if (symbol === 20) {
        pin(0, 0, 4, 'top', 'A1'); pin(1, 0, -4, 'bottom', 'A2');
        addLine(0, 4, 0, 2); addLine(0, -2, 0, -4);
        g.push({ kind: 'rect', x: -4 * SCALE, y: -2 * SCALE, width: 8 * SCALE, height: 4 * SCALE, color: BLUE });
        text(-6, -1, bmk, BLUE, 3, 'end'); text(1, 3, 'A1', '#000000', 2); text(1, -5, 'A2', '#000000', 2);
        category = 'controls';
      } else if (symbol === 17 || symbol === 30 || symbol === 1117) {
        const names = record.pins;
        const isTerminal = record.number(0xefc5) === 100;
        const name = terminal || names[0] || '';
        const direction = variant === 2 ? 'bottom' : variant === 4 ? 'left' : 'top';
        pin(0, 0, 0, direction, name);
        if (isTerminal) {
          pin(1, 0, 0, 'bottom', name);
          if (symbol === 1117) { pin(2, 0, 0, 'left', name); pin(3, 0, 0, 'right', name); }
        }
        circle(0, 0, symbol === 17 ? 1 : 0.8);
        if (isTerminal || symbol === 17) text(1.5, -1, name, '#000000', 2);
        else {
          addLine(-4, 0, 8, 0, BLUE, 0.4);
          text(0, variant === 2 ? 2 : -3, record.bmk + (name ? ':' + name : ''), '#000000', 2, 'middle');
          if (record.string(0xee2c) === 'PE') {
            addLine(0, 0, 3, -4, '#000000', 0.4);
            for (let j = 0; j < 3; j++) addLine(1.5 + j * 0.5, -4 - j * 0.6, 4.5 - j * 0.5, -4 - j * 0.6, '#000000', 0.4);
          }
        }
        // Print strip name once at its first terminal.
        if (bmk && isTerminal && !components.some(c => c.bmk === bmk)) text(-4, 0, bmk, BLUE, 3, 'end');
      } else if (symbol === 321) {
        for (let i = 0; i < 3; i++) pin(i, 0, 0);
        circle(0, 0, 0.7, RED, RED);
      } else if (record.type === 0x82 && [75, 77, 78].includes(symbol ?? -1)) {
        for (let i = 0; i < 4; i++) pin(i, 0, 0, i >= 2 ? 'left' : undefined);
        text(-2, 1, record.string(0x4a7e, 4), RED, 1.6, 'end');
      } else if (record.type === 0x3b && symbol === 308) {
        addLine(0, 4, 0, -4, '#000000', 0.8); addLine(-1, 1, 1, -1, '#000000', 0.5);
        const section = record.string(0x791a, 4);
        if (record.number(0xed63) === 0x791f && section && section !== '0' && section !== '-16002') {
          const offset = record.point(0xec55) ?? { x: 1.5, y: 0.5 };
          text(offset.x, offset.y, section + ' mm²', BLUE, 3);
        }
        const color = record.string(0x791c, 4);
        if (color) text(1, 0.5, color, RED, 1.8);
      } else if (record.type === 0x5d && symbol === 18) {
        pin(0, 0, 0, 'top'); circle(0, 0, 1, '#000000');
        text(0, -4, record.string(0xf0fb), '#000000', 2, 'middle');
      } else if (record.type === 0x58) {
        const a = record.point(0xeb1e), b = record.point(0xeb1f);
        // Structure box extents use their own F0BF/F0C0 properties.
        const x = record.point(0xf0bf), y = record.point(0xf0c0);
        const p1 = x ?? a, p2 = y ?? b;
        if (!p1 || !p2) return;
        g.push({ kind: 'rect', x: p1.x * SCALE, y: -p2.y * SCALE, width: (p2.x - p1.x) * SCALE,
          height: (p2.y - p1.y) * SCALE, color: '#008080', dash: [6, 2, 1, 2] });
        text(-1, -3, '+' + record.string(0x04b0, 4), BLUE, 3, 'end');
        text(-1, -6, tech, '#000000', 2, 'end'); text(-1, -9, label, '#000000', 2, 'end');
      } else {
        if (referenced.has(identity(record))) diagnostics.push(`Symbol ${symbol} an Objekt ${identity(record)} wird noch nicht unterstützt.`);
        return;
      }
      const x = canvas(pos), id = `eplan_${pageId}_${record.type}_${record.id}`;
      const comp: PlacedComponent = {
        id, symbolId: `eplan_${record.type}_${symbol ?? 0}_${variant}`, bmk,
        functionText: description, technicalCharacteristics: tech, deviceTag: terminal || undefined,
        higherLevelFunction: page.higherLevel, mountingLocation: page.location,
        x: x.x, y: x.y, rotation: 0, pins: Object.fromEntries(pins.map(p => [p.id, { customLabel: p.name, wireIds: [] }])),
        importedSymbol: { id: `eplan_${record.type}_${symbol ?? 0}_${variant}`, name: description || bmk || `EPLAN ${symbol}`,
          category, standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '', width: 1, height: 1,
          pins, svgContent: '', description: `EPLAN P8 Objekt ${record.id}, Symbol ${symbol}, Variante ${variant}`,
          importedGraphics: g }
      };
      // Symbols use a real bounding box, so imported placements remain selectable.
      const bounds: Point[] = pins.map(p => ({ x: p.x, y: p.y }));
      for (const item of g) {
        if (item.kind === 'line') bounds.push({ x: item.x1, y: item.y1 }, { x: item.x2, y: item.y2 });
        else if (item.kind === 'rect') bounds.push({ x: item.x, y: item.y }, { x: item.x + item.width, y: item.y + item.height });
        else if (item.kind === 'circle') bounds.push({ x: item.x - item.radius, y: item.y - item.radius }, { x: item.x + item.radius, y: item.y + item.radius });
        else {
          const width = Math.max(...item.text.split('\n').map(t => t.length)) * item.size * 0.55;
          const left = item.x - (item.anchor === 'end' ? width : item.anchor === 'middle' ? width / 2 : 0);
          bounds.push({ x: left, y: item.y - item.size }, { x: left + width, y: item.y + (item.text.split('\n').length - 1) * item.size * 1.2 });
        }
      }
      const minX = Math.min(0, ...bounds.map(p => p.x)), minY = Math.min(0, ...bounds.map(p => p.y));
      comp.x += minX; comp.y += minY;
      comp.importedSymbol!.width = Math.max(1, ...bounds.map(p => p.x)) - minX;
      comp.importedSymbol!.height = Math.max(1, ...bounds.map(p => p.y)) - minY;
      for (const p of pins) { p.x -= minX; p.y -= minY; }
      for (const item of g) {
        if (item.kind === 'line') { item.x1 -= minX; item.x2 -= minX; item.y1 -= minY; item.y2 -= minY; }
        else { item.x -= minX; item.y -= minY; }
      }
      objects.set(identity(record), comp); components.push(comp);
    };
    for (const r of functions) make(r);
    for (const r of ipoints) make(r);
    for (const r of potentials) make(r);
    for (const r of instances.filter(r => r.type === 0x82)) make(r);

    // Non-electrical primitives belong to the page, rather than invented devices.
    for (const r of instances) {
      if (r.type === 0x1e) {
        const p = r.point(0xec55);
        if (!p) continue;
        const height = r.double(0xee21) ?? 2.5;
        graphics.push({ kind: 'text', ...canvas(p), text: eplanText(r.string(0xec5f)), size: height * SCALE, color: BLUE });
      }
      if (r.type === 0x1f) {
        const a = r.point(0xec73), b = r.point(0xec74);
        if (a && b) graphics.push({ kind: 'line', x1: canvas(a).x, y1: canvas(a).y,
          x2: canvas(b).x, y2: canvas(b).y, color: '#000000', width: 0.5 });
      } else if (r.type === 0x20) {
        const center = r.point(0xec8b), radius = r.point(0xec8c);
        if (center && radius) graphics.push({ kind: 'circle', ...canvas(center), radius: Math.abs(radius.x) * SCALE, color: '#000000' });
      } else if (r.type === 0x59) {
        const a = r.point(0xf0d3), b = r.point(0xf0d4);
        if (a && b) graphics.push({ kind: 'rect', x: Math.min(a.x, b.x) * SCALE, y: canvas({ x: 0, y: Math.max(a.y, b.y) }).y,
          width: Math.abs(a.x - b.x) * SCALE, height: Math.abs(a.y - b.y) * SCALE, color: '#000000', lineWidth: 1 });
      }
    }
    const wires: Wire[] = [];
    for (const r of connections) {
      const fromKey = `${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`;
      const toKey = `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`;
      const fromPin = r.number(0xeb2c) ?? 0, toPin = r.number(0xeb2f) ?? 0;
      const a = points.get(`${fromKey}:${fromPin}`), b = points.get(`${toKey}:${toPin}`);
      const from = objects.get(fromKey), to = objects.get(toKey);
      if (!a || !b || !from || !to) {
        diagnostics.push(`Verbindung ${r.id}: Anschluss ${!a ? fromKey + ':' + fromPin : toKey + ':' + toPin} fehlt.`);
        continue;
      }
      const route = this.route(a, b, routingNodes);
      const wire: Wire = { id: `eplan_wire_${pageId}_${r.id}`, from: { componentId: from.id, pinId: String(fromPin) },
        to: { componentId: to.id, pinId: String(toPin) }, potential: 'Signal', color: 'RD',
        crossSection: r.string(0x791a, 4) || undefined, waypoints: route.map(canvas) };
      wires.push(wire);
      from.pins[String(fromPin)].wireIds!.push(wire.id); to.pins[String(toPin)].wireIds!.push(wire.id);
    }
    const partial = [...functions, ...instances, ...ipoints, ...connections].filter(r => r.partial);
    if (partial.length) diagnostics.push(`${partial.length} Datensätze haben nur einen lesbaren Datenpräfix; Platzierungen wurden soweit lesbar übernommen.`);
    page.components = components; page.wires = wires; page.texts = []; page.boxes = [];
    page.plotFrame.height = 297 * SCALE;
    page.importedDrawing = { source: 'EPLAN_P8', graphics, diagnostics };
    return true;
  }

  /** Route only an explicit native connection, using the original angle / T nodes. */
  private static route(a: { point: Point; direction?: PinDefinition['direction'] },
    b: { point: Point; direction?: PinDefinition['direction'] }, corners: Point[]): Point[] {
    const nodes = [a.point, b.point, ...corners];
    const distance = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
    distance[0] = 0;
    const faces = (p: Point, q: Point, direction?: PinDefinition['direction']) => !direction ||
      (direction === 'top' && q.y > p.y && q.x === p.x) || (direction === 'bottom' && q.y < p.y && q.x === p.x) ||
      (direction === 'left' && q.x < p.x && q.y === p.y) || (direction === 'right' && q.x > p.x && q.y === p.y);
    for (let step = 0; step < nodes.length; step++) {
      let u = -1;
      for (let i = 0; i < nodes.length; i++) if (!visited.has(i) && (u < 0 || distance[i] < distance[u])) u = i;
      if (u < 0 || !Number.isFinite(distance[u]) || u === 1) break;
      visited.add(u);
      for (let v = 0; v < nodes.length; v++) {
        if (v === u || visited.has(v)) continue;
        const p = nodes[u], q = nodes[v];
        if (p.x !== q.x && p.y !== q.y) continue;
        if (u === 0 && !faces(p, q, a.direction) || v === 1 && !faces(q, p, b.direction)) continue;
        const d = distance[u] + Math.abs(p.x - q.x) + Math.abs(p.y - q.y) + 0.01;
        if (d < distance[v]) { distance[v] = d; previous[v] = u; }
      }
    }
    if (Number.isFinite(distance[1])) {
      const path: Point[] = [];
      for (let i = 1; i >= 0; i = previous[i]) path.unshift(nodes[i]);
      return path.slice(1, -1);
    }
    // Preserve both exact endpoints when a native route node is absent.
    if (a.point.x === b.point.x || a.point.y === b.point.y) return [];
    const vertical = a.direction === 'top' || a.direction === 'bottom';
    return [vertical ? { x: a.point.x, y: b.point.y } : { x: b.point.x, y: a.point.y }];
  }
}
