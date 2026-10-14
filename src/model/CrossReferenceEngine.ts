// src/model/CrossReferenceEngine.ts
// Calculates automatic cross-references (Kontaktspiegel & Querverweise) according to DIN EN 81346 logic

import { Project, PlacedComponent, Page } from './types';
import { getSymbolById } from './symbols';

export interface ContactMirrorItem {
  type: 'PowerNO' | 'NO' | 'NC' | 'Changeover';
  pinNames: string;
  targetPageNumber: string;
  targetCol: number;
  slaveId: string;
}

export interface MasterCrossReferenceInfo {
  masterId: string;
  bmk: string;
  contacts: ContactMirrorItem[];
}

export class CrossReferenceEngine {
  /**
   * Calculates path/column (0..9) based on X coordinate within standard DIN A3 frame
   */
  public static calculatePath(x: number, frameWidth = 1000): number {
    // 10 columns across page width: 0 to 9
    const leftMargin = 50;
    const rightMargin = 50;
    const usableWidth = frameWidth - leftMargin - rightMargin;
    const colWidth = usableWidth / 10;
    
    if (x < leftMargin) return 0;
    if (x >= frameWidth - rightMargin) return 9;
    const col = Math.floor((x - leftMargin) / colWidth);
    return Math.max(0, Math.min(9, col));
  }

  /**
   * Recalculates all cross-references across all pages in the project
   */
  public static updateProjectCrossReferences(project: Project): void {
    // Collect all components across all pages
    const componentLocations: {
      comp: PlacedComponent;
      page: Page;
      col: number;
    }[] = [];

    for (const page of project.pages) {
      for (const comp of page.components) {
        const col = this.calculatePath(comp.x);
        componentLocations.push({ comp, page, col });
      }
    }

    // Group by BMK
    const bmkGroups = new Map<string, typeof componentLocations>();
    for (const item of componentLocations) {
      const bmk = item.comp.bmk.trim();
      if (!bmk) continue;
      if (!bmkGroups.has(bmk)) {
        bmkGroups.set(bmk, []);
      }
      bmkGroups.get(bmk)!.push(item);
    }

    // Process each BMK group (e.g. all components named "-K1")
    for (const [bmk, items] of bmkGroups.entries()) {
      // Find masters (e.g. coils) and slaves (e.g. contacts)
      const masters = items.filter(i => {
        const sym = getSymbolById(i.comp.symbolId);
        return sym?.isMaster === true;
      });

      const slaves = items.filter(i => {
        const sym = getSymbolById(i.comp.symbolId);
        return sym?.isContact === true;
      });

      if (masters.length > 0) {
        const primaryMaster = masters[0];
        
        // Update cross-reference string on each slave contact pointing to master
        for (const slave of slaves) {
          slave.comp.crossRef = `/${primaryMaster.page.pageNumber}.${primaryMaster.col}`;
        }

        // Calculate contact mirror items for master
        const mirrorItems: ContactMirrorItem[] = [];
        for (const slave of slaves) {
          const sym = getSymbolById(slave.comp.symbolId);
          const pinKeys = Object.keys(sym?.pins || {});
          const pinNames = pinKeys.map(k => sym?.pins.find(p => p.id === k)?.name || k).join('-');

          mirrorItems.push({
            type: sym?.contactType || 'NO',
            pinNames: pinNames || '13-14',
            targetPageNumber: slave.page.pageNumber,
            targetCol: slave.col,
            slaveId: slave.comp.id
          });
        }

        // Store formatted summary on master component
        primaryMaster.comp.crossRef = mirrorItems.length > 0 
          ? mirrorItems.map(m => `${m.pinNames}: /${m.targetPageNumber}.${m.targetCol}`).join(' | ')
          : '';
      } else if (items.length > 1) {
        // Pairs / multiple components with same BMK without explicit master
        // Terminals in the same strip do not cross-reference each other
        const isTerminalGroup = items.every(i => {
          const sym = getSymbolById(i.comp.symbolId);
          return sym?.category === 'terminals';
        });

        if (!isTerminalGroup) {
          for (let i = 0; i < items.length; i++) {
            const others = items.filter((_, idx) => idx !== i);
            items[i].comp.crossRef = others.map(o => `/${o.page.pageNumber}.${o.col}`).join(', ');
          }
        } else {
          for (const item of items) {
            item.comp.crossRef = '';
          }
        }
      } else {
        items[0].comp.crossRef = '';
      }
    }
  }

  /**
   * Retrieves detailed contact mirror items for rendering under a contactor coil
   */
  public static getContactMirror(masterComp: PlacedComponent, project: Project): ContactMirrorItem[] {
    const sym = getSymbolById(masterComp.symbolId);
    if (!sym?.isMaster) return [];

    const mirror: ContactMirrorItem[] = [];
    const bmk = masterComp.bmk.trim();

    for (const page of project.pages) {
      for (const comp of page.components) {
        if (comp.id === masterComp.id) continue;
        if (comp.bmk.trim() !== bmk) continue;

        const compSym = getSymbolById(comp.symbolId);
        if (compSym?.isContact) {
          const pinNames = compSym.pins.map(p => p.name).join('-');
          const col = this.calculatePath(comp.x);
          mirror.push({
            type: compSym.contactType || 'NO',
            pinNames,
            targetPageNumber: page.pageNumber,
            targetCol: col,
            slaveId: comp.id
          });
        }
      }
    }

    return mirror;
  }
}
