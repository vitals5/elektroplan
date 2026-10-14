// src/model/LabelLayout.ts
// Calculates exact screen coordinates, anchors, rotations, and styles for EPLAN component labels

import { PlacedComponent, TextFormatConfig, SymbolDefinition } from './types';

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
  const transform = rotation !== 0 ? `transform="rotate(${rotation}, ${x}, ${y})"` : '';

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
  const transform = rotation !== 0 ? `transform="rotate(${rotation}, ${x}, ${y})"` : '';

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
  const transform = rotation !== 0 ? `transform="rotate(${rotation}, ${x}, ${y})"` : '';

  return { x, y, anchor, rotation, fontSize, visible, transform };
}
