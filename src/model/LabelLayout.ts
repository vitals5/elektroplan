// src/model/LabelLayout.ts
// Calculates exact screen coordinates, anchors, rotations, and styles for component labels

import { PlacedComponent, TextFormatConfig, SymbolDefinition, Project } from './types';
import { interruptionLabelPosition } from './ConnectionSymbols';

export interface CalculatedLabelPosition {
  x: number;
  y: number;
  anchor: 'start' | 'middle' | 'end';
  rotation: number;
  fontSize: number;
  fontColor?: string;
  visible: boolean;
  transform: string;
}

export function computeBmkPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.bmkPosition;
  const preset = cfg?.preset || 'top';
  let x = sym.width / 2;
  let y = -8;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'top':
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -8;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -8;
      anchor = 'end';
      break;
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 26;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 26;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 26;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = -8;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 10;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}) };
}

export function computeFunctionTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.functionTextPosition;
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 12;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 12;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 12;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -20;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -20;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -20;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 12;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 12;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 12;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== false;
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}) };
}

export function computeTechnicalDataPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.technicalDataPosition;
  const preset = cfg?.preset || 'bottom';
  let x = sym.width / 2;
  let y = sym.height + 22;
  let anchor: 'start' | 'middle' | 'end' = 'middle';

  switch (preset) {
    case 'bottom':
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
    case 'bottom_left':
      x = 0;
      y = sym.height + 22;
      anchor = 'start';
      break;
    case 'bottom_right':
      x = sym.width;
      y = sym.height + 22;
      anchor = 'end';
      break;
    case 'top':
      x = sym.width / 2;
      y = -32;
      anchor = 'middle';
      break;
    case 'top_left':
      x = 0;
      y = -32;
      anchor = 'start';
      break;
    case 'top_right':
      x = sym.width;
      y = -32;
      anchor = 'end';
      break;
    case 'left':
      x = -8;
      y = sym.height / 2 + 22;
      anchor = 'end';
      break;
    case 'right':
      x = sym.width + 8;
      y = sym.height / 2 + 22;
      anchor = 'start';
      break;
    case 'custom':
    default:
      x = sym.width / 2;
      y = sym.height + 22;
      anchor = 'middle';
      break;
  }

  x += (cfg?.offsetX || 0);
  y += (cfg?.offsetY || 0);

  if (cfg?.alignment) {
    anchor = cfg.alignment;
  }

  const rotation = cfg?.rotation || 0;
  const fontSize = cfg?.fontSize || 8;
  const visible = cfg?.visible !== undefined ? cfg.visible : !!(comp.deviceTag || comp.technicalCharacteristics);
  const transform = labelTransform(x, y, comp.rotation, rotation);

  return { x, y, anchor, rotation, fontSize, visible, transform, ...(cfg?.fontColor ? { fontColor: cfg.fontColor } : {}) };
}

/** Keep the automatic interruption layout unless an instance overrides it. */
export function computeCrossReferencePosition(comp: PlacedComponent, sym: SymbolDefinition, project: Project): CalculatedLabelPosition {
  const cfg = comp.crossRefPosition;
  const arrow = interruptionLabelPosition(project, comp, sym);
  const hasTech = computeTechnicalDataPosition(comp, sym).visible && !!(comp.deviceTag || comp.technicalCharacteristics);
  const extra = comp.additionalText && computeAdditionalTextPosition(comp,sym);
  const bottom = Math.max(sym.height + (hasTech ? 38 : 24), extra && extra.visible ? extra.y + extra.fontSize * 1.7 : 0);
  let x = arrow?.referenceX ?? sym.width / 2;
  let y = arrow?.referenceY ?? bottom;
  let anchor: CalculatedLabelPosition['anchor'] = arrow?.anchor ?? 'middle';
  switch (cfg?.preset) {
    case 'top': x = sym.width / 2; y = -20; anchor = 'middle'; break;
    case 'top_left': x = 0; y = -20; anchor = 'start'; break;
    case 'top_right': x = sym.width; y = -20; anchor = 'end'; break;
    case 'bottom': x = sym.width / 2; y = bottom; anchor = 'middle'; break;
    case 'bottom_left': x = 0; y = bottom; anchor = 'start'; break;
    case 'bottom_right': x = sym.width; y = bottom; anchor = 'end'; break;
    case 'left': x = -8; y = sym.height / 2; anchor = 'end'; break;
    case 'right': x = sym.width + 8; y = sym.height / 2; anchor = 'start'; break;
  }
  x += cfg?.offsetX ?? 0;
  y += cfg?.offsetY ?? 0;
  anchor = cfg?.alignment ?? anchor;
  const rotation = cfg?.rotation ?? 0;
  return { x, y, anchor, rotation, visible: cfg?.visible !== false,
    fontSize: comp.crossRefFontSize ?? cfg?.fontSize ?? 8, transform: labelTransform(x, y, comp.rotation, rotation) };
}

/** Counter-rotate text about its own anchor; the component still moves the anchor. */
export function labelTransform(x: number, y: number, componentRotation = 0, textRotation = 0): string {
  const angle = textRotation - componentRotation;
  return angle ? `transform="rotate(${angle}, ${x}, ${y})"` : '';
}

/** Text entered by the user reveals an inherited hidden import label, while an
 * explicit visibility choice always remains in force. */
export function setComponentLabelText(comp: PlacedComponent,
  property: 'functionText' | 'additionalText' | 'deviceTag' | 'technicalCharacteristics', value: string): boolean {
  if (comp[property] === value) return false;
  comp[property] = value;
  const key = property === 'functionText' ? 'functionTextPosition' : property === 'additionalText' ? 'additionalTextPosition' : 'technicalDataPosition';
  if (value.trim() && comp.source && comp[key]?.visible === false && !comp[key]?.visibilityExplicit)
    comp[key] = { ...comp[key], visible: true };
  return true;
}

/** Zusatztext has its own editable layout, below the other populated labels. */
export function computeAdditionalTextPosition(comp: PlacedComponent, sym: SymbolDefinition): CalculatedLabelPosition {
  const cfg = comp.additionalTextPosition;
  const pos = computeTechnicalDataPosition({ ...comp, technicalDataPosition: cfg }, sym);
  if (cfg?.preset === 'custom') {
    pos.y = sym.height + 34 + (cfg.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  } else if (!cfg?.preset || cfg.preset === 'bottom' || cfg.preset === 'bottom_left' || cfg.preset === 'bottom_right') {
    const lines = Math.max(1, (comp.functionText || '').split('\n').length);
    const fn = computeFunctionTextPosition(comp, sym), tech = computeTechnicalDataPosition(comp, sym);
    const lowest = Math.max(sym.height + 12,
      comp.functionText && fn.visible ? fn.y + (lines - 1) * fn.fontSize * 1.2 : 0,
      (comp.deviceTag || comp.technicalCharacteristics) && tech.visible ? tech.y + Math.max(0, ((comp.deviceTag || '').split('\n').length - 1)) * tech.fontSize * 1.2 : 0);
    pos.y = lowest + pos.fontSize * 1.4 + (cfg?.offsetY || 0);
    pos.transform = labelTransform(pos.x, pos.y, comp.rotation, pos.rotation);
  }
  pos.visible = cfg?.visible !== false;
  return pos;
}

/** Upgrade inherited hidden defaults in already saved imported projects once.
 * New user visibility choices are persisted and are never changed here. */
export function revealImportedComponentLabels(project: Project): void {
  for (const page of project.pages) for (const comp of page.components) {
    if (!comp.source) continue;
    for (const [property, hasText] of [
      ['functionTextPosition', !!comp.functionText?.trim()],
      ['additionalTextPosition', !!comp.additionalText?.trim()],
      ['technicalDataPosition', !!(comp.deviceTag?.trim() || comp.technicalCharacteristics?.trim())],
    ] as const) {
      if (hasText && comp[property]?.visible === false && !comp[property]?.visibilityExplicit)
        comp[property] = { ...comp[property], visible: true };
    }
  }
}
