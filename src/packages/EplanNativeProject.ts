import JSZip from 'jszip';
import { DrawingPrimitive, Page, PinDefinition, PlacedComponent, Project, SymbolDefinition, Wire } from '../model/types';
import { EodRecord, eplanText, readEodTable, EOD_LAYOUTS } from './EodReader';
import { EplanSymbolLibrary, EPLAN_SCALE as SCALE, LibraryEntry, Point,
  eplanPrimitives, labelPosition, normalizeDefinition, propertyPositions, translatePrimitives } from './EplanSymbolLibrary';

const canvas = (p: Point): Point => ({ x: p.x * SCALE, y: (297 - p.y) * SCALE });
const identity = (r: EodRecord) => `${r.type}:${r.id}`;
type Endpoint = { point: Point; direction: PinDefinition['direction'] };
type Tables = Record<keyof typeof EOD_LAYOUTS, EodRecord[]>;

/** Page-independent importer: source placements reference the embedded master data. */
export class EplanNativeProject {
  readonly messages: string[] = [];
  private graphics = new Map<string, LibraryEntry>();
  private recordsByPage = new Map<number, EodRecord[]>();
  private connectionsByPage = new Map<number, EodRecord[]>();
  get pages() {
    return this.tables.Page.filter(r => r.string(0x2b04, 4)).map(r => ({
      pageId: r.id, pageNumber: r.string(0x2b04, 4), title: eplanText(r.string(0x2b03, 4)),
      higherLevel: r.string(0x044c, 4), location: r.string(0x04b0, 4)
    })).sort((a, b) => {
      const rank = (location: string) => location === 'EAA' ? 0 : /^(TERM_|PLG_)/.test(location) ? 2 : 1;
      return rank(a.location) - rank(b.location) || a.pageNumber.localeCompare(b.pageNumber, 'de', { numeric: true });
    });
  }
  private constructor(private tables: Tables, readonly library: EplanSymbolLibrary) {
    const objects = [...tables.Function, ...tables.IPoint, ...tables.Potential, ...tables.Instance];
    const byIdentity = new Map(objects.map(r => [identity(r), r]));
    const pageOf = (r: EodRecord, seen = new Set<string>()): number | undefined => {
      if (r.pageId) return r.pageId;
      const key = identity(r);
      if (seen.has(key)) return;
      seen.add(key);
      const parentType = r.number(0xebf1), parentId = r.number(0xebf1, 4, 4);
      if (parentType === 4) return parentId;
      const parent = byIdentity.get(`${parentType}:${parentId}`);
      return parent ? pageOf(parent, seen) : undefined;
    };
    for (const r of objects) {
      const page = pageOf(r);
      if (!page) continue;
      if (!this.recordsByPage.has(page)) this.recordsByPage.set(page, []);
      this.recordsByPage.get(page)!.push(r);
    }
    for (const r of tables.Connection) {
      const page = r.pageId;
      if (!page) continue;
      if (!this.connectionsByPage.has(page)) this.connectionsByPage.set(page, []);
      this.connectionsByPage.get(page)!.push(r);
    }
  }

  finalize(project: Project): void {
    const components = new Map(project.pages.flatMap(p => p.components).filter(c => c.source)
      .map(c => [`${c.source!.objectType}:${c.source!.objectId}`, c]));
    project.logicalConnections = [];
    for (const r of this.tables.Connection.filter(c => !c.pageId)) {
      const from = components.get(`${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`);
      const to = components.get(`${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`);
      const fromPin = String(r.number(0xeb2c) ?? 0), toPin = String(r.number(0xeb2f) ?? 0);
      if (!from?.pins[fromPin] || !to?.pins[toPin]) {
        this.messages.push(`Logische Verbindung ${r.id}: Anschluss nicht auflösbar.`); continue;
      }
      project.logicalConnections.push({ id: `eplan_logical_${r.id}`,
        from: { componentId: from.id, pinId: fromPin }, to: { componentId: to.id, pinId: toPin },
        potential: 'Signal', color: r.string(0x791c, 4) || undefined, crossSection: r.string(0x791a, 4) || undefined });
    }
    this.messages.push(`${project.logicalConnections.length} logische Verbindungen ohne gezeichnete Seite separat übernommen.`);
  }

  static async create(zip: JSZip, root: string): Promise<EplanNativeProject | undefined> {
    const tables = {} as Tables;
    for (const name of Object.keys(EOD_LAYOUTS) as (keyof Tables)[]) {
      const data = zip.file(`${root}${name}.eod`), index = zip.file(`${root}${name}.eox`);
      if (!data || !index) return;
      const bytes = await data.async('uint8array');
      if (bytes.length % EOD_LAYOUTS[name].size !== 0) return;
      tables[name] = readEodTable(bytes, await index.async('uint8array'), name);
    }
    const library = await EplanSymbolLibrary.create(zip, root);
    await library.prepare([...tables.Function, ...tables.IPoint, ...tables.Potential, ...tables.Instance]);
    const importer = new EplanNativeProject(tables, library);
    importer.messages.push(...library.diagnostics);
    return importer;
  }

  private graphicEntry(graphics: DrawingPrimitive[], name: string): LibraryEntry {
    const key = JSON.stringify(graphics);
    let entry = this.graphics.get(key);
    if (entry) return entry;
    // FNV identity is an app-generated graphic resource, not an EPLAN symbol number.
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) hash = Math.imul(hash ^ key.charCodeAt(i), 16777619);
    const base = `eplan:graphic:${(hash >>> 0).toString(16)}`;
    let id = base, suffix = 0;
    while (this.library.definitions.some(d => d.id === id)) id = `${base}:${++suffix}`;
    const definition: SymbolDefinition = { id, name, category: 'controls', standard: 'DIN EN 60617',
      defaultBmkPrefix: '', defaultFunctionText: '', width: 1, height: 1, unitsPerMm: SCALE, pins: [], svgContent: '',
      description: 'Freies Grafikobjekt aus den Projektdaten', importedGraphics: graphics };
    entry = normalizeDefinition(definition);
    this.graphics.set(key, entry);
    this.library.use(entry);
    return entry;
  }

  private sizedEntry(entry: LibraryEntry, record: EodRecord): LibraryEntry {
    const a = record.point(record.type === 0x58 ? 0xf0bf : 0xeb1e);
    const b = record.point(record.type === 0x58 ? 0xf0c0 : 0xeb1f);
    if (!a || !b || entry.definition.pins.length) return entry;
    const box = { kind: 'rect' as const, x: Math.min(a.x, b.x) * SCALE, y: -Math.max(a.y, b.y) * SCALE,
      width: Math.abs(b.x - a.x) * SCALE, height: Math.abs(b.y - a.y) * SCALE,
      color: 'currentColor', dash: record.type === 0x58 ? [6, 2, 1, 2] : [5, 4] };
    const key = `${entry.definition.id}:${JSON.stringify(box)}`;
    let sized = this.graphics.get(key);
    if (!sized) {
      sized = normalizeDefinition({ ...entry.definition, id: `${entry.definition.id}:size:${a.x},${a.y},${b.x},${b.y}`,
        name: `${entry.definition.name} (${Math.abs(b.x - a.x)} × ${Math.abs(b.y - a.y)} mm)`,
        pins: [], importedGraphics: [box] }, entry.labels);
      this.graphics.set(key, sized);
    }
    return sized;
  }

  importPage(pageId: number, page: Page, pageNumbers: Map<number, string>): void {
    const records = this.recordsByPage.get(pageId) ?? [];
    const connections = this.connectionsByPage.get(pageId) ?? [];
    const pageRecord = this.tables.Page.find(r => r.id === pageId);
    const stamp = pageRecord?.string(0x2b10, 4), editor = pageRecord?.string(0x2b0e, 4);
    if (stamp && /^\d+$/.test(stamp)) page.plotFrame.titleBlock.date = new Date(Number(stamp) * 1000).toISOString().slice(0, 10).split('-').reverse().join('.');
    if (editor) page.plotFrame.titleBlock.author = editor;
    const diagnostics: string[] = [], components: PlacedComponent[] = [];
    const objects = new Map<string, PlacedComponent>(), points = new Map<string, Endpoint>();
    const referenced = new Set(connections.flatMap(r => [`${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`,
      `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`]));
    const add = (r: EodRecord, entry: LibraryEntry, position: Point): PlacedComponent => {
      // 1400 is the source function definition for an electrical distributor.
      // Its symbol can be superseded by a co-located graphical routing node.
      if ([0x2a, 0x82].includes(r.type) || r.type === 17 && r.number(0xefc5) === 1400)
        entry.definition.connectionGraphic = true;
      this.library.use(entry);
      const p = canvas(position), d = entry.definition;
      const pinLabels = r.pins;
      const functionText = eplanText(r.string(0x4e2b, 4) || r.string(0xeb1a));
      const comp: PlacedComponent = {
        id: `eplan_${pageId}_${r.type}_${r.id}`, symbolId: d.id,
        source: { format: 'EPLAN_P8', objectType: r.type, objectId: r.id },
        x: p.x - entry.origin.x, y: p.y - entry.origin.y, rotation: 0,
        bmk: r.bmk && r.type !== 0x46 ? '-' + r.bmk : '', functionText,
        technicalCharacteristics: eplanText(r.string(0x4e3b, 4)), deviceTag: r.string(0x4e3e, 4) || undefined,
        higherLevelFunction: page.higherLevel, mountingLocation: page.location,
        pins: Object.fromEntries(d.pins.map(pin => [pin.id, { customLabel: pinLabels[Number(pin.id)] ?? pin.name, wireIds: [] as string[] }]))
      };
      const overrides = propertyPositions(r.data);
      comp.bmkPosition = labelPosition(entry, 20010, overrides);
      comp.functionTextPosition = labelPosition(entry, 20011, overrides);
      comp.technicalDataPosition = labelPosition(entry, 20027, overrides);
      if (r.type === 0x46) {
        comp.functionText = r.string(0xee2c) + r.string(0xee2d) + (r.string(0xee2e) ? '.' + r.string(0xee2e) : '');
        const other = this.tables.IPoint.find(ip => ip.pageId !== pageId && ip.bmk === r.bmk && ip.position && ip.pageId && pageNumbers.has(ip.pageId));
        if (other) comp.crossRef = `/${pageNumbers.get(other.pageId!)}.${Math.floor(other.position!.x / 42)}`;
        comp.bmkPosition.visible = false;
        if (!comp.functionTextPosition.visible) comp.functionTextPosition = { preset: 'right', fontSize: 7, visible: true };
      }
      for (const pin of d.pins) {
        points.set(`${identity(r)}:${pin.id}`, { point: { x: position.x + (pin.x - entry.origin.x) / SCALE,
          y: position.y - (pin.y - entry.origin.y) / SCALE }, direction: pin.direction });
      }
      components.push(comp); objects.set(identity(r), comp);
      return comp;
    };
    for (const r of records) {
      if (r.symbol !== undefined) {
        const entry = this.library.resolve(r);
        if (!entry || !r.position) {
          diagnostics.push(`Objekt ${identity(r)}: ${!entry ? 'Bibliothekssymbol nicht auflösbar' : 'Platzierung fehlt'}.`);
          continue;
        }
        add(r, this.sizedEntry(entry, r), r.position);
      } else if (r.type === 0x1e) {
        const position = r.point(0xec55), value = eplanText(r.string(0xec5f));
        if (!position || !value) continue;
        const size = (r.double(0xee21) ?? 2.5) * SCALE;
        const width = Math.max(1, ...value.split('\n').map(s => s.length)) * size * 0.6;
        const key = `text:${size}:${width}:${value.split('\n').length}`;
        let entry = this.graphics.get(key);
        if (!entry) {
          entry = { definition: { id: `eplan:annotation:${size}:${width}:${value.split('\n').length}`, name: 'Projekttext',
            category: 'controls', standard: 'DIN EN 60617', defaultBmkPrefix: '', defaultFunctionText: '',
            width, height: size * Math.max(1, value.split('\n').length), unitsPerMm: SCALE, insertionPoint: { x: 0, y: size },
            pins: [], svgContent: '', importedGraphics: [], description: 'Editierbarer Projekttext' },
            origin: { x: 0, y: size }, labels: new Map() };
          this.graphics.set(key, entry);
        }
        const comp = add(r, entry, position);
        comp.functionText = value;
        comp.bmkPosition = { visible: false }; comp.technicalDataPosition = { visible: false };
        comp.functionTextPosition = { preset: 'custom', offsetX: -width / 2,
          offsetY: size - entry.definition.height - 12, fontSize: size, alignment: 'start', visible: true };
      } else {
        const graphics = eplanPrimitives(r, this.library.layers);
        if (!graphics.length) continue;
        const first = graphics[0];
        const anchor = first.kind === 'line' ? { x: first.x1, y: first.y1 }
          : first.kind === 'polygon' ? first.points[0] : first;
        const entry = this.graphicEntry(translatePrimitives(graphics, -anchor.x, -anchor.y), 'Projektgrafik');
        const comp = add(r, entry, { x: anchor.x / SCALE, y: -anchor.y / SCALE });
        comp.bmk = ''; comp.functionText = '';
        comp.bmkPosition = { visible: false }; comp.functionTextPosition = { visible: false }; comp.technicalDataPosition = { visible: false };
      }
    }
    const corners = records.filter(r => r.type === 0x2a).flatMap(r => r.position ? [r.position] : []);
    const wires: Wire[] = [];
    const sourceSegments: [Point, Point][] = [];
    for (const r of connections) {
      const fromKey = `${r.number(0xeb2b)}:${r.number(0xeb2b, 4, 4)}`, toKey = `${r.number(0xeb2e)}:${r.number(0xeb2e, 4, 4)}`;
      const fromPin = r.number(0xeb2c) ?? 0, toPin = r.number(0xeb2f) ?? 0;
      const a = points.get(`${fromKey}:${fromPin}`), b = points.get(`${toKey}:${toPin}`);
      const from = objects.get(fromKey), to = objects.get(toKey);
      if (!a || !b || !from || !to) {
        diagnostics.push(`Verbindung ${r.id}: Bibliotheksanschluss ${!a ? fromKey + ':' + fromPin : toKey + ':' + toPin} fehlt.`);
        continue;
      }
      const route = this.route(a, b, corners);
      const routePoints = [a.point, ...route, b.point];
      for (let i = 1; i < routePoints.length; i++) sourceSegments.push([routePoints[i - 1], routePoints[i]]);
      const wire: Wire = { id: `eplan_wire_${pageId}_${r.id}`, from: { componentId: from.id, pinId: String(fromPin) },
        to: { componentId: to.id, pinId: String(toPin) }, potential: 'Signal',
        lineWidth: (this.library.layers.get(311)?.lineWidth ?? 0.25) * SCALE,
        color: r.string(0x791c, 4) || undefined, crossSection: r.string(0x791a, 4) || undefined,
        waypoints: route.map(canvas) };
      wires.push(wire);
      from.pins[String(fromPin)].wireIds!.push(wire.id); to.pins[String(toPin)].wireIds!.push(wire.id);
    }
    // P8 retains automatic routing records that are not on any drawn source
    // connection. They are not printed; keep them in the editable model rather
    // than painting dangling corners from this unused routing cache.
    for (const r of records.filter(r => r.type === 0x2a && r.position)) {
      const comp = objects.get(identity(r));
      if (!comp?.source) continue;
      const p = r.position!;
      comp.source.routingUsed = sourceSegments.some(([a, b]) => {
        const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
        if (length < 1e-12) return false;
        const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / length;
        return t >= -1e-8 && t <= 1 + 1e-8 && Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy) < 1e-6;
      });
    }
    for (const key of referenced) if (!objects.has(key)) diagnostics.push(`Referenziertes Objekt ${key} fehlt.`);
    const partial = records.filter(r => r.partial);
    if (partial.length) diagnostics.push(`${partial.length} Datensätze haben nur einen lesbaren Datenpräfix; unvollständige Eigenschaften sind nicht validiert.`);
    const byId = new Map(this.library.definitions.map(d => [d.id, d]));
    const drawingOrder = (c: PlacedComponent) => {
      const d = byId.get(c.symbolId)!;
      return c.symbolId.startsWith('eplan:graphic:') ? 0 : d.source?.library === 'SPECIAL' && [0, 2].includes(d.source.number) ? 1
        : c.symbolId.startsWith('eplan:annotation:') ? 3 : 2;
    };
    components.sort((a, b) => drawingOrder(a) - drawingOrder(b));
    page.components = components; page.wires = wires; page.texts = []; page.boxes = [];
    page.plotFrame.height = 297 * SCALE;
    page.grid = { spacing: 4 * SCALE, origin: { x: 0, y: page.plotFrame.height } };
    page.connectionMode = 'explicit';
    page.importDiagnostics = diagnostics;
    delete page.importedDrawing;
  }

  /** Route explicit source connections; geometric nodes never create new net edges. */
  private route(a: Endpoint, b: Endpoint, corners: Point[]): Point[] {
    const nodes = [a.point, b.point, ...corners];
    const distance = nodes.map(() => Infinity), previous = nodes.map(() => -1), visited = new Set<number>();
    distance[0] = 0;
    const faces = (p: Point, q: Point, direction: PinDefinition['direction']) =>
      (direction === 'top' && q.y > p.y && q.x === p.x) || (direction === 'bottom' && q.y < p.y && q.x === p.x) ||
      (direction === 'left' && q.x < p.x && q.y === p.y) || (direction === 'right' && q.x > p.x && q.y === p.y);
    // Aligned pins may face the same way, e.g. both Q12 inputs point up. Their
    // connection must still travel through the source corners above the device.
    if (faces(a.point, b.point, a.direction) && faces(b.point, a.point, b.direction)) return [];
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
    return [a.direction === 'top' || a.direction === 'bottom'
      ? { x: a.point.x, y: b.point.y } : { x: b.point.x, y: a.point.y }];
  }
}
