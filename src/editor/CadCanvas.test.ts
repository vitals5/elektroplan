import assert from 'node:assert/strict';
import { CadCanvas } from './CadCanvas';
import { PdfExporter } from '../export/PdfExporter';
import { arcPoints, drawingToSvg, rotateDrawing } from '../model/ImportedDrawing';
import { Page, PlacedComponent, Project, SymbolDefinition } from '../model/types';

const symbol: SymbolDefinition = {
  id: 'source:test:17:0', name: 'Source library switch', category: 'protection',
  standard: 'DIN EN 60617', defaultBmkPrefix: '-Q', defaultFunctionText: '', description: '',
  width: 20, height: 30, pins: [{ id: '1', name: '1', x: 10, y: 0, direction: 'top' }], svgContent: '',
  importedGraphics: [
    { kind: 'line', x1: 10, y1: 0, x2: 10, y2: 30, color: '#000000' },
    { kind: 'circle', x: 10, y: 15, radius: 3, color: '#0000ff' },
    { kind: 'arc', x: 10, y: 15, radius: 5, startAngle: 0, endAngle: 90, color: '#000000' },
    { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 2 }], color: '#000000' },
  ],
};
const component: PlacedComponent = { id: 'placed', symbolId: symbol.id, bmk: '-Q1', functionText: 'Hauptschalter', technicalCharacteristics: '63 A',
  x: 100, y: 150, rotation: 90, pins: { '1': { customLabel: 'L1' } }, bmkPosition: { preset: 'left', offsetX: 3 } };
const page = { id: 'p', pageNumber: '2', title: 'Einspeisung',higherLevel:'',location:'', components: [component], wires: [],
  plotFrame: { width: 1000, height: 700 }, importedDrawing: { source: 'EPLAN_P8', graphics: [], diagnostics: [] } } as unknown as Page;
const project = { pages: [page], symbolLibrary: [symbol] } as Project;
const canvas = Object.assign(Object.create(CadCanvas.prototype), { activePage: page, project, selectedComponentId: component.id });
const svg = canvas.renderComponents() as string;
assert.match(svg, /class="component selected"/);
assert.match(svg, /rotate\(90, 10, 15\)/);
assert.match(svg, /stroke="currentColor"/);
assert.match(svg, /fill="none"/);
assert.match(svg, />-Q1<\/text>/);
assert.match(svg, />Hauptschalter<\/text>/);
assert.match(svg, />63 A<\/text>/);
assert.match(svg, />L1<\/text>/);
component.bmk = '-Q99'; component.functionText = 'Geändert'; component.pins['1'].customLabel = 'L2';
const editedSvg = canvas.renderComponents() as string;
assert.match(editedSvg, />-Q99<\/text>/);
assert.match(editedSvg, />Geändert<\/text>/);
assert.match(editedSvg, />L2<\/text>/);
assert.doesNotMatch(editedSvg, />-Q1<\/text>/);
component.functionText = 'Zeile 1\nZeile 2';
assert.match(canvas.renderComponents(), /<tspan[^>]*>Zeile 1<\/tspan><tspan[^>]*>Zeile 2<\/tspan>/);
component.functionText = 'Geändert';

// An import metadata flag must not change editor paper, grid or frame renderer.
const scene: any = { activePage: page, svg: { innerHTML: '' }, scale: 1, panX: 0, panY: 0,
  getEffectiveGridSize: () => 8, renderPlotFrame: () => '<g id="normal-frame"/>',
};
for (const name of ['renderCables', 'renderWires', 'renderComponents', 'renderImages', 'renderBoxes', 'renderTexts', 'renderAutoconnectPreview', 'renderInteractiveWire', 'renderHoveredPin', 'renderGhostSymbol']) scene[name] = () => '';
CadCanvas.prototype.render.call(scene);
assert.match(scene.svg.innerHTML, /fill="#1a202c"/);
assert.match(scene.svg.innerHTML, /fill="url\(#cadGrid\)"/);
assert.match(scene.svg.innerHTML, /id="normal-frame"/);
assert.doesNotMatch(scene.svg.innerHTML, /fill="#ffffff"/);

const texts: string[] = [], lines: number[][] = [], drawColors: unknown[][] = [];
const pdf: any = {};
for (const name of ['setLineWidth', 'setLineDashPattern', 'setTextColor', 'setFillColor', 'setFont', 'setFontSize', 'circle', 'rect', 'path', 'fillStroke', 'stroke']) pdf[name] = () => undefined;
pdf.text = (text: string) => texts.push(text);
pdf.line = (...coords: number[]) => lines.push(coords);
pdf.setDrawColor = (...color: unknown[]) => drawColors.push(color);
(PdfExporter as any).renderComponents(pdf, page, project, 420, 297, { colorMode: 'color' }, new Map());
assert.ok(texts.includes('-Q99') && texts.includes('Geändert') && texts.includes('63 A') && texts.includes('L2'));
assert.deepEqual(drawColors[0], [0, 0, 0], 'Library outlines must use black on white PDF paper');
assert.ok(lines.length > 0, 'The source vectors are exported rather than a fallback symbol');

const arc = { kind: 'arc' as const, x: 0, y: 0, radius: 10, startAngle: 0, endAngle: 90, color: '#000000' };
const points = arcPoints(arc);
assert.deepEqual(points[0], { x: 10, y: 0 });
assert.ok(Math.abs(points.at(-1)!.x) < 1e-9 && Math.abs(points.at(-1)!.y - 10) < 1e-9);
assert.match(drawingToSvg([arc]), /<polyline/);
const rotated = rotateDrawing([{ kind: 'rect', x: 0, y: 0, width: 10, height: 20, color: '#000000' }], 45, 10, 20);
assert.equal(rotated[0].kind, 'polygon', 'Rotation must preserve rectangle corners, not collapse to its diagonal bounds');
console.log('✓ Standard editor and PDF rendering for shared imported library symbols');

// Moving either end of an explicitly routed source wire must preserve its
// anchors, stay connected and remain orthogonal in editor, drag and PDF paths.
const { orthogonalWirePoints, wirePinDirection } = await import('../model/WireRouting');
const anchors = [{ x: 0, y: 20 }, { x: 30, y: 20 }];
const originalAnchors = JSON.stringify(anchors);
assert.deepEqual(orthogonalWirePoints({ x: 0, y: 0 }, { x: 30, y: 40 }, anchors, 'bottom', 'top'),
  [{ x: 0, y: 0 }, ...anchors, { x: 30, y: 40 }]);
const movedFrom = { x: 10, y: 5 }, movedTo = { x: 40, y: 50 };
const routed = orthogonalWirePoints(movedFrom, movedTo, anchors, 'right', 'bottom');
assert.deepEqual(routed[0], movedFrom); assert.deepEqual(routed.at(-1), movedTo);
assert.ok(routed.slice(1).every((p, i) => p.x === routed[i].x || p.y === routed[i].y));
for (const anchor of anchors) assert.ok(routed.some(p => p.x === anchor.x && p.y === anchor.y));
assert.ok(routed[1].x > movedFrom.x && routed[1].y === movedFrom.y, 'Leave the rotated pin in its outward direction');
assert.ok(routed.at(-2)!.y > movedTo.y && routed.at(-2)!.x === movedTo.x, 'Approach the terminal from its outward side');
assert.equal(JSON.stringify(anchors), originalAnchors, 'Rendering must not mutate stored source routes');
assert.equal(wirePinDirection(page, project, { componentId: component.id, pinId: '1' }), 'right');
console.log('✓ Explicit wire anchors remain orthogonal and attached when components move');

// Labels follow the component anchor, but keep their independent text angle.
component.rotation = 180;
const upright = canvas.renderComponents();
assert.match(upright, /rotate\(180, 10, 15\)/);
assert.match(upright, /transform="rotate\(-180,/);
const pdfTexts: {text: string; x: number; y: number; angle: number}[] = [];
pdf.text = (text: string, x: number, y: number, options: any = {}) => pdfTexts.push({text,x,y,angle:options.angle ?? 0});
(PdfExporter as any).renderComponents(pdf, page, project, 420, 297, { colorMode: 'color' }, new Map());
assert.equal(Math.abs(pdfTexts.find(t => t.text === '-Q99')!.angle), 0);
const lettering = rotateDrawing([{kind:'text',x:5,y:8,size:6,text:'M',color:'#000',rotation:0}],180,20,30)[0];
assert.deepEqual(lettering, {kind:'text',x:15,y:22,size:6,text:'M',color:'#000',rotation:0});
console.log('✓ Rotation moves labels and internal lettering without turning their text upside down');

// PDF outlines must rotate with the electrical pins, including built-in symbols.
const { getSymbolById } = await import('../model/symbols');
const { AutoconnectEngine } = await import('../model/AutoconnectEngine');
const builtIn = getSymbolById('contact_no')!;
for (const rotation of [90,180,270] as const) {
  const c = {...component,symbolId:builtIn.id,rotation,bmk:'-K1',functionText:'Licht'};
  const p = {...page,components:[c]};
  lines.length=0;
  (PdfExporter as any).renderComponents(pdf,p,{...project,pages:[p]},420,297,{colorMode:'color'},new Map());
  for (const pin of builtIn.pins) {
    const world = AutoconnectEngine.getRotatedPinInfo(c,pin,builtIn);
    const x=world.worldX*.42,y=world.worldY*297/700;
    assert(lines.some(l=>Math.hypot(l[0]-x,l[1]-y)<1e-7 || Math.hypot(l[2]-x,l[3]-y)<1e-7),`PDF outline meets rotated ${rotation}° pin ${pin.id}`);
  }
}
console.log('✓ Built-in PDF contours remain attached to rotated electrical pins');

component.crossRef='/2.4';component.crossRefFontSize=3;component.pinLabelFontSize=4;
component.bmkPosition={...component.bmkPosition,fontSize:5};
const sizes: {text:string;size:number}[]=[];let currentSize=0;
pdf.setFontSize=(size:number)=>{currentSize=size;};pdf.text=(text:string)=>sizes.push({text,size:currentSize});
(PdfExporter as any).renderComponents(pdf,page,project,420,297,{colorMode:'color'},new Map());
assert(Math.abs(sizes.find(t=>t.text==='-Q99')!.size-5*297/700*72/25.4)<1e-7);
assert(Math.abs(sizes.find(t=>t.text==='/2.4')!.size-3*297/700*72/25.4)<1e-7);
assert.match(canvas.renderComponents(),/font-size="3"/);
console.log('✓ Individual label and cross-reference sizes are reflected in SVG and physical PDF fonts');
