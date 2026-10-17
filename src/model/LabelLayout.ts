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

  return { x, y, anchor, rotation, fontSize, visible, transform };
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

  return { x, y, anchor, rotation, fontSize, visible, transform };
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

  return { x, y, anchor, rotation, fontSize, visible, transform };
}

/** Keep the automatic interruption layout unless an instance overrides it. */
export function computeCrossReferencePosition(comp: PlacedComponent, sym: SymbolDefinition, project: Project): CalculatedLabelPosition {
  const cfg = comp.crossRefPosition;
  const arrow = interruptionLabelPosition(project, comp, sym);
  const hasTech = computeTechnicalDataPosition(comp, sym).visible && !!(comp.deviceTag || comp.technicalCharacteristics);
  const bottom = sym.height + (hasTech ? 38 : 24);
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
