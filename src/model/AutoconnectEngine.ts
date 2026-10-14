// src/model/AutoconnectEngine.ts
// EPLAN Electric P8 compatible Autoconnecting Engine
// Automatically detects and forms orthogonal electrical connections between aligned pins

import { PlacedComponent, PinDefinition, SymbolDefinition, Wire, Page } from './types';
import { getSymbolById } from './symbols';

export interface RotatedPinInfo {
  componentId: string;
  pinId: string;
  pinName: string;
  worldX: number;
  worldY: number;
  direction: 'top' | 'bottom' | 'left' | 'right';
}

export interface AutoconnectPair {
  pin1: RotatedPinInfo;
  pin2: RotatedPinInfo;
  orientation: 'vertical' | 'horizontal';
  distance: number;
}

export interface AutoconnectPreviewSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  targetX: number;
  targetY: number;
  orientation: 'vertical' | 'horizontal';
}

export class AutoconnectEngine {
  private static readonly MAX_AUTOCONNECT_DISTANCE = 800; // max distance in px along grid line
  private static readonly MIN_AUTOCONNECT_DISTANCE = 8;   // min distance to avoid same-point self-loops

  /**
   * Calculates world coordinates and effective rotated direction of a pin.
   * Rotation center is (sym.width / 2, sym.height / 2).
   */
  public static getRotatedPinInfo(
    comp: PlacedComponent,
    pinDef: PinDefinition,
    sym: SymbolDefinition
  ): RotatedPinInfo {
    const rot = comp.rotation || 0;
    let rx = pinDef.x;
    let ry = pinDef.y;
    let dir = pinDef.direction;

    if (rot !== 0) {
      const rad = (rot * Math.PI) / 180;
      const cx = sym.width / 2;
      const cy = sym.height / 2;
      const dx = pinDef.x - cx;
      const dy = pinDef.y - cy;
      rx = cx + (dx * Math.cos(rad) - dy * Math.sin(rad));
      ry = cy + (dx * Math.sin(rad) + dy * Math.cos(rad));

      // Direction rotation (90° clockwise maps top -> right -> bottom -> left -> top)
      const dirs: ('top' | 'right' | 'bottom' | 'left')[] = ['top', 'right', 'bottom', 'left'];
      const idx = dirs.indexOf(pinDef.direction);
      if (idx !== -1) {
        const steps = Math.round(rot / 90) % 4;
        dir = dirs[(idx + steps) % 4];
      }
    }

    return {
      componentId: comp.id,
      pinId: pinDef.id,
      pinName: pinDef.name,
      worldX: Math.round(comp.x + rx),
      worldY: Math.round(comp.y + ry),
      direction: dir
    };
  }

  /**
   * Extracts all active pins with world coordinates and rotated directions from a list of components.
   */
  public static getAllPins(components: PlacedComponent[]): RotatedPinInfo[] {
    const pins: RotatedPinInfo[] = [];
    for (const comp of components) {
      const sym = getSymbolById(comp.symbolId);
      if (!sym) continue;
      for (const pinDef of sym.pins) {
        pins.push(this.getRotatedPinInfo(comp, pinDef, sym));
      }
    }
    return pins;
  }

  /**
   * Finds all valid autoconnect pairs according to EPLAN Electric P8 rules:
   * - Vertical: pin1.x === pin2.x, pin1 points 'bottom', pin2 points 'top', no intermediate pins
   * - Horizontal: pin1.y === pin2.y, pin1 points 'right', pin2 points 'left', no intermediate pins
   */
  public static findAutoconnectPairs(components: PlacedComponent[]): AutoconnectPair[] {
    const allPins = this.getAllPins(components);
    const pairs: AutoconnectPair[] = [];

    // Group pins by X (for vertical connections)
    const pinsByX = new Map<number, RotatedPinInfo[]>();
    // Group pins by Y (for horizontal connections)
    const pinsByY = new Map<number, RotatedPinInfo[]>();

    for (const pin of allPins) {
      if (!pinsByX.has(pin.worldX)) pinsByX.set(pin.worldX, []);
      pinsByX.get(pin.worldX)!.push(pin);

      if (!pinsByY.has(pin.worldY)) pinsByY.set(pin.worldY, []);
      pinsByY.get(pin.worldY)!.push(pin);
    }

    // 1. Vertical Autoconnect: same X coordinate
    pinsByX.forEach((pins) => {
      if (pins.length < 2) return;
      // Sort vertically from top to bottom
      pins.sort((a, b) => a.worldY - b.worldY);

      for (let i = 0; i < pins.length - 1; i++) {
        const topPin = pins[i];
        const bottomPin = pins[i + 1];

        if (topPin.componentId === bottomPin.componentId) continue;

        const distance = bottomPin.worldY - topPin.worldY;
        if (distance >= this.MIN_AUTOCONNECT_DISTANCE && distance <= this.MAX_AUTOCONNECT_DISTANCE) {
          // Top pin must face downwards ('bottom') and bottom pin must face upwards ('top')
          if (topPin.direction === 'bottom' && bottomPin.direction === 'top') {
            pairs.push({
              pin1: topPin,
              pin2: bottomPin,
              orientation: 'vertical',
              distance
            });
          }
        }
      }
    });

    // 2. Horizontal Autoconnect: same Y coordinate
    pinsByY.forEach((pins) => {
      if (pins.length < 2) return;
      // Sort horizontally from left to right
      pins.sort((a, b) => a.worldX - b.worldX);

      for (let i = 0; i < pins.length - 1; i++) {
        const leftPin = pins[i];
        const rightPin = pins[i + 1];

        if (leftPin.componentId === rightPin.componentId) continue;

        const distance = rightPin.worldX - leftPin.worldX;
        if (distance >= this.MIN_AUTOCONNECT_DISTANCE && distance <= this.MAX_AUTOCONNECT_DISTANCE) {
          // Left pin must face rightwards ('right') and right pin must face leftwards ('left')
          if (leftPin.direction === 'right' && rightPin.direction === 'left') {
            pairs.push({
              pin1: leftPin,
              pin2: rightPin,
              orientation: 'horizontal',
              distance
            });
          }
        }
      }
    });

    return pairs;
  }

  /**
   * Recalculates all autoconnections for a page.
   * Manual wires (isAutoconnect !== true) are preserved.
   * Obsolete autoconnections are cleared; valid new ones are added.
   */
  public static updatePageAutoconnections(page: Page): void {
    const manualWires = page.wires.filter(w => !w.isAutoconnect);
    const existingAutoWires = page.wires.filter(w => w.isAutoconnect);

    // Existing manual wire map for fast lookup: key = minComp:pin|maxComp:pin
    const manualWireSet = new Set<string>();
    for (const w of manualWires) {
      const k1 = `${w.from.componentId}:${w.from.pinId}|${w.to.componentId}:${w.to.pinId}`;
      const k2 = `${w.to.componentId}:${w.to.pinId}|${w.from.componentId}:${w.from.pinId}`;
      manualWireSet.add(k1);
      manualWireSet.add(k2);
    }

    const pairs = this.findAutoconnectPairs(page.components);
    const newAutoWires: Wire[] = [];

    for (const pair of pairs) {
      const key = `${pair.pin1.componentId}:${pair.pin1.pinId}|${pair.pin2.componentId}:${pair.pin2.pinId}`;
      if (manualWireSet.has(key)) {
        // User already drew a manual wire here; do not duplicate
        continue;
      }

      // Check if we already have an autowire for this pair to keep its ID and attributes
      const existing = existingAutoWires.find(w =>
        (w.from.componentId === pair.pin1.componentId && w.from.pinId === pair.pin1.pinId &&
         w.to.componentId === pair.pin2.componentId && w.to.pinId === pair.pin2.pinId) ||
        (w.from.componentId === pair.pin2.componentId && w.from.pinId === pair.pin2.pinId &&
         w.to.componentId === pair.pin1.componentId && w.to.pinId === pair.pin1.pinId)
      );

      const potentialInfo = this.inferPotential(pair.pin1, pair.pin2);

      if (existing) {
        newAutoWires.push(existing);
      } else {
        newAutoWires.push({
          id: 'auto_w_' + Math.random().toString(36).substring(2, 9),
          from: {
            componentId: pair.pin1.componentId,
            pinId: pair.pin1.pinId
          },
          to: {
            componentId: pair.pin2.componentId,
            pinId: pair.pin2.pinId
          },
          potential: potentialInfo.potential,
          color: potentialInfo.color,
          crossSection: '1.5mm²',
          isAutoconnect: true
        });
      }
    }

    page.wires = [...manualWires, ...newAutoWires];
  }

  /**
   * Generates live autoconnect preview lines for a component being dragged or placed.
   */
  public static getAutoconnectPreview(
    existingComponents: PlacedComponent[],
    activeComp: PlacedComponent
  ): AutoconnectPreviewSegment[] {
    const sym = getSymbolById(activeComp.symbolId);
    if (!sym) return [];

    const activePins = sym.pins.map(p => this.getRotatedPinInfo(activeComp, p, sym));
    // Filter out the activeComp if it already exists in existingComponents
    const otherComps = existingComponents.filter(c => c.id !== activeComp.id);
    const otherPins = this.getAllPins(otherComps);

    const previews: AutoconnectPreviewSegment[] = [];

    for (const aPin of activePins) {
      if (aPin.direction === 'top' || aPin.direction === 'bottom') {
        // Look for matching pins on same X
        const candidates = otherPins
          .filter(p => p.worldX === aPin.worldX)
          .sort((a, b) => a.worldY - b.worldY);

        if (aPin.direction === 'top') {
          // Needs pin above us facing 'bottom'
          const above = candidates.filter(p => p.worldY < aPin.worldY && p.direction === 'bottom');
          if (above.length > 0) {
            const nearest = above[above.length - 1]; // closest above
            const dist = aPin.worldY - nearest.worldY;
            if (dist >= this.MIN_AUTOCONNECT_DISTANCE && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'vertical'
              });
            }
          }
        } else if (aPin.direction === 'bottom') {
          // Needs pin below us facing 'top'
          const below = candidates.filter(p => p.worldY > aPin.worldY && p.direction === 'top');
          if (below.length > 0) {
            const nearest = below[0]; // closest below
            const dist = nearest.worldY - aPin.worldY;
            if (dist >= this.MIN_AUTOCONNECT_DISTANCE && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'vertical'
              });
            }
          }
        }
      } else if (aPin.direction === 'left' || aPin.direction === 'right') {
        // Look for matching pins on same Y
        const candidates = otherPins
          .filter(p => p.worldY === aPin.worldY)
          .sort((a, b) => a.worldX - b.worldX);

        if (aPin.direction === 'left') {
          // Needs pin to the left facing 'right'
          const leftOf = candidates.filter(p => p.worldX < aPin.worldX && p.direction === 'right');
          if (leftOf.length > 0) {
            const nearest = leftOf[leftOf.length - 1]; // closest left
            const dist = aPin.worldX - nearest.worldX;
            if (dist >= this.MIN_AUTOCONNECT_DISTANCE && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'horizontal'
              });
            }
          }
        } else if (aPin.direction === 'right') {
          // Needs pin to the right facing 'left'
          const rightOf = candidates.filter(p => p.worldX > aPin.worldX && p.direction === 'left');
          if (rightOf.length > 0) {
            const nearest = rightOf[0]; // closest right
            const dist = nearest.worldX - aPin.worldX;
            if (dist >= this.MIN_AUTOCONNECT_DISTANCE && dist <= this.MAX_AUTOCONNECT_DISTANCE) {
              previews.push({
                x1: aPin.worldX,
                y1: aPin.worldY,
                x2: nearest.worldX,
                y2: nearest.worldY,
                targetX: nearest.worldX,
                targetY: nearest.worldY,
                orientation: 'horizontal'
              });
            }
          }
        }
      }
    }

    return previews;
  }

  /**
   * Infers wire potential and color from connected pin names.
   */
  private static inferPotential(pin1: RotatedPinInfo, pin2: RotatedPinInfo): { potential: string; color: string } {
    const names = [pin1.pinName.toUpperCase(), pin2.pinName.toUpperCase(), pin1.pinId.toUpperCase(), pin2.pinId.toUpperCase()];

    if (names.some(n => n === 'PE' || n === 'GND')) {
      return { potential: 'PE', color: 'GNYE' };
    }
    if (names.some(n => n === 'N')) {
      return { potential: 'N', color: 'BU' };
    }
    if (names.some(n => n === 'L1' || n === '1' || n === '2')) {
      return { potential: 'L1', color: 'BK' };
    }
    if (names.some(n => n === 'L2' || n === '3' || n === '4')) {
      return { potential: 'L2', color: 'BK' };
    }
    if (names.some(n => n === 'L3' || n === '5' || n === '6')) {
      return { potential: 'L3', color: 'BK' };
    }
    if (names.some(n => n === '+24V' || n === '24V' || n === '+')) {
      return { potential: '+24V', color: 'RD' };
    }
    if (names.some(n => n === '0V' || n === '-')) {
      return { potential: '0V', color: 'BU' };
    }
    return { potential: 'Signal', color: 'BK' };
  }
}
