import assert from 'node:assert/strict';
import { PropertiesDialog } from './PropertiesDialog';
import { PlacedComponent, Project, SymbolDefinition } from '../model/types';

const symbol: SymbolDefinition = { id: 'eplan:SPECIAL:1:0', name: 'Source', category: 'connections', standard: 'DIN EN 60617',
  defaultBmkPrefix: '', defaultFunctionText: '', width: 20, height: 30, pins: [], svgContent: '<line x1="0" y1="0" x2="20" y2="30"/>',
  importedGraphics: [], description: '' };
const component: PlacedComponent = { id: 'c', symbolId: symbol.id, bmk: '-Q1', functionText: 'L1 <Prüfen> & "Ändern"\nZweite Zeile',
  x: 100.125, y: 200.625, rotation: 0, pins: {},
  bmkPosition: { preset: 'custom', fontSize: 7, offsetX: 2.125, offsetY: -1.625, visible: true, alignment: 'start' },
  functionTextPosition: { preset: 'custom', fontSize: 6, offsetX: 12.75, offsetY: -7.375, visible: true, alignment: 'start' },
  technicalDataPosition: { preset: 'right', fontSize: 5.5, offsetX: 1.25, offsetY: -2.875, visible: false, alignment: 'end' } };
const project = { symbolLibrary: [symbol], pages: [] } as unknown as Project;
const dialog = new PropertiesDialog(component, project, { onSave: () => undefined }) as any;
const fields: Record<string, any> = { '#propPosX': { value: '100.125' }, '#propPosY': { value: '200.625' } };
for (const [prefix, config] of [['Bmk', component.bmkPosition!], ['Fn', component.functionTextPosition!], ['Tech', component.technicalDataPosition!]] as const) {
  fields[`#prop${prefix}Preset`] = { value: config.preset };
  fields[`#prop${prefix}OffsetX`] = { value: String(config.offsetX) };
  fields[`#prop${prefix}OffsetY`] = { value: String(config.offsetY) };
  fields[`#prop${prefix}Alignment`] = { value: config.alignment };
  fields[`#prop${prefix}Rotation`] = { value: String(config.rotation ?? 0) };
  fields[`#prop${prefix}Visible`] = { checked: config.visible };
}
const modal = { querySelector: (selector: string) => fields[selector] ?? null, querySelectorAll: () => [] };
dialog.collectFormData(modal);
assert.equal(dialog.component.x, 100.125); assert.equal(dialog.component.y, 200.625);
for (const key of ['bmkPosition', 'functionTextPosition', 'technicalDataPosition'] as const) {
  for (const property of ['fontSize', 'offsetX', 'offsetY', 'visible', 'alignment', 'preset'] as const) {
    assert.equal(dialog.component[key][property], component[key]![property], `${key}.${property} survives saving the dialog`);
  }
}
fields['#propBmkOffsetX'].value = '-3.875';
dialog.collectFormData(modal);
assert.equal(dialog.component.bmkPosition.offsetX, -3.875);
assert.equal(dialog.component.bmkPosition.fontSize, 7);
const preview = dialog.generatePreviewSvg() as string;
assert.match(preview, />-Q1<\/text>/, 'Imported SPECIAL symbols use the regular editable label preview');
assert.match(preview, /L1 &lt;Prüfen&gt; &amp; &quot;Ändern&quot;/);
const form = dialog.renderActiveTabContent() as string;
assert.match(form, /<textarea[^>]*id="propFunctionText"[^>]*>L1 &lt;Prüfen&gt; &amp; &quot;Ändern&quot;\nZweite Zeile<\/textarea>/);
fields['#propFunctionText'] = { value: component.functionText };
dialog.collectFormData(modal);
assert.equal(dialog.component.functionText, component.functionText);
console.log('✓ Property dialog preserves imported layout precision and shows editable source labels');
