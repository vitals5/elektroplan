// src/packages/EdbProjectParser.ts
// Intelligent parser and reconstructor for CAD project archives (.edb / .elk / .zw1 / .zip)
// Extracts pages, symbols, functions, coordinates, and potential connections following IEC 81346.

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, PageType } from '../model/types';
import { SYMBOL_DEFINITIONS } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';

export interface ExtractedPageMeta {
  pageId: number;
  pageNumber: string;
  location: string;
  higherLevel: string;
  title: string;
}

export interface ExtractedFunction {
  bmk: string;
  funcText: string;
}

export interface ExtractedInstance {
  x: number;
  y: number;
  text: string;
}

export class EdbProjectParser {
  /**
   * Parses an EDB project structure inside a ZIP archive (.zw1 or .zip).
   */
  public static async parseEdbProject(
    zip: JSZip,
    projectNameHint?: string
  ): Promise<{ project: Project; messages: string[] }> {
    const messages: string[] = [];

    // 1. Locate and parse ProjectInfo.xml
    let projectName = projectNameHint || 'Projekt';
    let description = 'Importiertes Projekt';
    let company = 'Engineering Büro';
    let author = 'Planer';
    let created = new Date().toISOString().split('T')[0];
    let modified = created;

    const xmlZipEntry = zip.file(/ProjectInfo\.xml$/i)[0];
    if (xmlZipEntry) {
      const xmlText = await xmlZipEntry.async('text');
      messages.push(`Projektdaten XML gefunden: ${xmlZipEntry.name}`);

      const getProp = (id: string): string => {
        const m = xmlText.match(new RegExp(`<Property[^>]*id="${id}"[^>]*>([^<]+)<\\/Property>`));
        return m ? m[1].trim() : '';
      };

      const rawDesc = getProp('10011');
      if (rawDesc) {
        if (rawDesc.includes('de_DE@')) {
          description = rawDesc.split('de_DE@')[1].split(';')[0];
        } else {
          description = rawDesc.split(';')[0];
        }
      }

      const rawComp = getProp('10015');
      if (rawComp) company = rawComp;

      const rawAuthor = getProp('10020');
      if (rawAuthor) author = rawAuthor;

      const rawCreated = getProp('10021');
      if (rawCreated && /^\d+$/.test(rawCreated)) {
        try {
          created = new Date(parseInt(rawCreated, 10) * 1000).toISOString().split('T')[0];
        } catch {
          // ignore
        }
      }

      const rawModified = getProp('10023');
      if (rawModified && /^\d+$/.test(rawModified)) {
        try {
          modified = new Date(parseInt(rawModified, 10) * 1000).toISOString().split('T')[0];
        } catch {
          // ignore
        }
      }

      const rawFullName = getProp('10009');
      if (rawFullName) {
        const base = rawFullName.split(/[\\/]/).pop()?.replace(/\.elk$/i, '');
        if (base) projectName = base;
      }
    }

    // 2. Locate Page.eod
    const pageZipEntry = zip.file(/Page\.eod$/i)[0];
    if (!pageZipEntry) {
      throw new Error('Keine Page.eod Datenbank im Archiv gefunden.');
    }
    const pageBuf = await pageZipEntry.async('uint8array');
    messages.push(`Seitendatenbank eingelesen: ${pageZipEntry.name} (${pageBuf.length} Bytes)`);

    // 3. Extract all page records from Page.eod
    const rawPages = this.extractPages(pageBuf);
    messages.push(`${rawPages.length} Projektseiten in der Datenbank identifiziert.`);

    // 4. Locate and parse Function.eod & Instance.eod
    const funcZipEntry = zip.file(/Function\.eod$/i)[0];
    const instZipEntry = zip.file(/Instance\.eod$/i)[0];

    const funcsByPage = new Map<number, ExtractedFunction[]>();
    if (funcZipEntry) {
      const funcBuf = await funcZipEntry.async('uint8array');
      this.extractFunctions(funcBuf, funcsByPage);
      messages.push(`Funktionen und Betriebsmittel extrahiert (${funcsByPage.size} referenzierte Seiten).`);
    }

    const instancesByPage = new Map<number, ExtractedInstance[]>();
    if (instZipEntry) {
      const instBuf = await instZipEntry.async('uint8array');
      this.extractInstances(instBuf, instancesByPage);
      messages.push(`Platzierungen und Koordinaten extrahiert (${instancesByPage.size} referenzierte Seiten).`);
    }

    // 5. Construct Page models with PlacedComponents & Autoconnections
    const pages: Page[] = [];

    for (let i = 0; i < rawPages.length; i++) {
      const rp = rawPages[i];
      const pageId = rp.pageId;
      const fList = funcsByPage.get(pageId) || [];
      const iList = instancesByPage.get(pageId) || [];

      // Determine PageType
      let pageType: PageType = 'schematic';
      if (rp.title.toLowerCase().includes('titelblatt') || rp.location === 'EAA' || rp.pageNumber === '0') {
        pageType = 'cover';
      } else if (rp.location === 'PLG_ST' || rp.title.toLowerCase().includes('steckerplan')) {
        pageType = 'terminal_diagram';
      }

      const higherLevel = rp.higherLevel ? (rp.higherLevel.startsWith('=') ? rp.higherLevel : '=' + rp.higherLevel) : '=A1';
      const location = rp.location ? (rp.location.startsWith('+') ? rp.location : '+' + rp.location) : '+S1';

      // Build components for this page
      const components: PlacedComponent[] = this.buildPageComponents(
        pageId,
        rp.pageNumber,
        higherLevel,
        location,
        pageType,
        fList,
        iList
      );

      const page: Page = {
        id: `page_${pageId}_${rp.pageNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        pageNumber: rp.pageNumber,
        pageType,
        title: rp.title || `Seite ${rp.pageNumber}`,
        higherLevel,
        location,
        components,
        wires: [],
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 1000,
          height: 700,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: description ? `${projectName} - ${description}` : projectName,
            commission: 'KOM-2024-01',
            company,
            author,
            date: modified || created,
            revision: '1.0',
            sheetNumber: rp.pageNumber,
            totalSheets: String(rawPages.length)
          }
        }
      };

      // Automatically route connections where pins align
      if (pageType === 'schematic') {
        AutoconnectEngine.updatePageAutoconnections(page);
      }

      pages.push(page);
    }

    // Determine initial active page (first schematic page, or page 1)
    let activePageId = pages[0]?.id || 'p_1';
    const firstSchematic = pages.find(p => p.pageType === 'schematic' && p.pageNumber === '1') 
      || pages.find(p => p.pageType === 'schematic') 
      || pages[0];
    if (firstSchematic) activePageId = firstSchematic.id;

    const totalCompCount = pages.reduce((acc, p) => acc + p.components.length, 0);
    const totalWireCount = pages.reduce((acc, p) => acc + p.wires.length, 0);
    messages.push(`Erfolgreich rekonstruiert: ${pages.length} Seiten, ${totalCompCount} Komponenten, ${totalWireCount} automatische Verbindungen.`);

    const project: Project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: projectName,
      description,
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '2024.0',
      created,
      modified,
      author,
      company,
      pages,
      activePageId
    };

    return { project, messages };
  }

  /**
   * Extracts page records from Page.eod
   */
  private static extractPages(buf: Uint8Array): ExtractedPageMeta[] {
    const pages: ExtractedPageMeta[] = [];
    const marker = [0x04, 0x2b, 0x00, 0x00];
    let idx = 0;

    while ((idx = this.indexOf(buf, marker, idx)) !== -1) {
      const numStart = idx + 4;
      let numEnd = numStart;
      while (numEnd < buf.length && buf[numEnd] >= 0x20 && buf[numEnd] <= 0x7e) numEnd++;

      if (numEnd > numStart && buf[numEnd] === 0x00 && buf[numEnd + 1] === 0xff && buf[numEnd + 2] === 0xff) {
        const pageNumber = this.decodeUtf8(buf.subarray(numStart, numEnd));

        // Location backwards before idx
        let locEnd = idx - 1;
        while (locEnd > 0 && buf[locEnd] === 0) locEnd--;
        let locStart = locEnd;
        while (locStart > 0 && buf[locStart] >= 0x20 && buf[locStart] <= 0x7e) locStart--;
        const location = this.decodeUtf8(buf.subarray(locStart + 1, locEnd + 1));

        // HigherLevel backwards before locStart
        let hlEnd = locStart - 4;
        while (hlEnd > 0 && buf[hlEnd] === 0) hlEnd--;
        let hlStart = hlEnd;
        while (hlStart > 0 && buf[hlStart] >= 0x20 && buf[hlStart] <= 0x7e) hlStart--;
        const higherLevel = this.decodeUtf8(buf.subarray(hlStart + 1, hlEnd + 1));

        // Title: search backwards for ??_??@ or de_DE@
        const searchChunk = buf.subarray(Math.max(0, idx - 1200), idx);
        let title = '';
        const deTag = [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40]; // de_DE@
        const qqTag = [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40]; // ??_??@

        const deIdx = this.lastIndexOf(searchChunk, deTag, searchChunk.length);
        const qqIdx = this.lastIndexOf(searchChunk, qqTag, searchChunk.length);

        if (deIdx > qqIdx && deIdx !== -1) {
          const s = this.indexOf(searchChunk, [0x3b], deIdx); // semicolon
          if (s !== -1) title = this.decodeUtf8(searchChunk.subarray(deIdx + 6, s));
        } else if (qqIdx !== -1) {
          const s = this.indexOf(searchChunk, [0x3b], qqIdx);
          if (s !== -1) title = this.decodeUtf8(searchChunk.subarray(qqIdx + 6, s));
        }

        // Page Object ID: search backwards for ffff 61ea 0400 [uint32]
        let pageId = 0;
        const idMarker = [0xff, 0xff, 0x61, 0xea, 0x04, 0x00];
        const idIdx = this.lastIndexOf(searchChunk, idMarker, searchChunk.length);
        if (idIdx !== -1 && idIdx + 10 <= searchChunk.length) {
          pageId = this.readUint32LE(searchChunk, idIdx + 6);
        }

        pages.push({ pageId, pageNumber, location, higherLevel, title });
      }

      idx += 4;
    }

    return pages;
  }

  /**
   * Extracts function and BMK definitions from Function.eod
   */
  private static extractFunctions(buf: Uint8Array, map: Map<number, ExtractedFunction[]>): void {
    const bmkTag = [0x19, 0xeb];
    const pageIdTag = [0xf1, 0xeb, 0x04, 0x00];
    let offset = 0;

    while ((offset = this.indexOf(buf, bmkTag, offset)) !== -1) {
      const bStart = offset + 2;
      let bEnd = bStart;
      while (bEnd < buf.length && buf[bEnd] >= 0x20 && buf[bEnd] <= 0x7e) bEnd++;

      if (bEnd > bStart && buf[bEnd] === 0x00) {
        const bmk = this.decodeUtf8(buf.subarray(bStart, bEnd));

        let funcText = '';
        if (buf[bEnd + 1] === 0x1a && buf[bEnd + 2] === 0xeb) {
          const fStart = bEnd + 3;
          let fEnd = fStart;
          while (fEnd < buf.length && buf[fEnd] >= 0x20 && buf[fEnd] <= 0x7e) fEnd++;
          if (fEnd > fStart && buf[fEnd] === 0x00) {
            funcText = this.decodeUtf8(buf.subarray(fStart, fEnd));
          }
        }

        const searchSlice = buf.subarray(bEnd, Math.min(buf.length, bEnd + 100));
        const pIdx = this.indexOf(searchSlice, pageIdTag, 0);
        if (pIdx !== -1 && pIdx + 8 <= searchSlice.length) {
          const pageId = this.readUint32LE(searchSlice, pIdx + 4);
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ bmk, funcText });
        }
      }

      offset += 2;
    }
  }

  /**
   * Extracts placement coordinates and text instances from Instance.eod
   */
  private static extractInstances(buf: Uint8Array, map: Map<number, ExtractedInstance[]>): void {
    const pageIdTag = [0xf1, 0xeb, 0x04, 0x00];
    const symCoordTag = [0x5a, 0xed];
    const txtCoordTag = [0x55, 0xec];
    const deTag = [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40];
    const qqTag = [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40];

    let offset = 0;
    while ((offset = this.indexOf(buf, pageIdTag, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const chunk = buf.subarray(offset, Math.min(buf.length, offset + 250));

        let x = 0;
        let y = 0;
        let text = '';

        const symIdx = this.indexOf(chunk, symCoordTag, 0);
        if (symIdx !== -1 && symIdx + 18 <= chunk.length) {
          x = this.readDoubleLE(chunk, symIdx + 2);
          y = this.readDoubleLE(chunk, symIdx + 10);
        }

        const txtIdx = this.indexOf(chunk, txtCoordTag, 0);
        if (txtIdx !== -1 && txtIdx + 18 <= chunk.length) {
          x = this.readDoubleLE(chunk, txtIdx + 2);
          y = this.readDoubleLE(chunk, txtIdx + 10);
        }

        const deIdx = this.indexOf(chunk, deTag, 0);
        const qqIdx = this.indexOf(chunk, qqTag, 0);
        if (deIdx !== -1) {
          const s = this.indexOf(chunk, [0x3b], deIdx);
          if (s !== -1) text = this.decodeUtf8(chunk.subarray(deIdx + 6, s));
        } else if (qqIdx !== -1) {
          const s = this.indexOf(chunk, [0x3b], qqIdx);
          if (s !== -1) text = this.decodeUtf8(chunk.subarray(qqIdx + 6, s));
        }

        if (x > 0 || y > 0 || text.length > 0) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, text });
        }
      }

      offset += 4;
    }
  }

  /**
   * Constructs PlacedComponents for a page with mapped IEC symbols and coordinates
   */
  private static buildPageComponents(
    pageId: number,
    pageNumber: string,
    higherLevel: string,
    location: string,
    pageType: PageType,
    funcs: ExtractedFunction[],
    instances: ExtractedInstance[]
  ): PlacedComponent[] {
    const components: PlacedComponent[] = [];

    // Filter meaningful instances with coordinates or text
    const validInstances = instances.filter(i => (i.x > 0 && i.y > 0) || i.text.trim().length > 0);

    // Track used BMKs to group multi-pole functions or terminals
    const processedBmks = new Set<string>();
    let colIndex = 0;

    // 1. Process Functions
    for (let fIdx = 0; fIdx < funcs.length; fIdx++) {
      const fn = funcs[fIdx];
      const rawBmk = fn.bmk.trim();
      if (!rawBmk) continue;

      // Group identical auxiliary pins under master BMK
      const bmkKey = `${rawBmk}_${fn.funcText}`;
      if (processedBmks.has(bmkKey) && !rawBmk.match(/^[0-9]+$/)) {
        continue;
      }
      processedBmks.add(bmkKey);

      // Determine symbol and position
      const matchingInst = validInstances[fIdx % Math.max(1, validInstances.length)];

      let x = 120 + (colIndex % 9) * 85;
      let y = 180 + Math.floor(colIndex / 9) * 120;

      if (matchingInst && matchingInst.x > 0 && matchingInst.y > 0) {
        // Map mm coordinates (420 x 297 mm) to canvas pixels (1000 x 700 px)
        x = Math.round(matchingInst.x * 2.38);
        y = Math.round(matchingInst.y * 2.38);
      }

      // Clamp within DIN A3 drawing bounds
      x = Math.max(90, Math.min(920, x));
      y = Math.max(120, Math.min(620, y));

      const symbolInfo = this.resolveSymbolForBmk(rawBmk, fn.funcText, pageType);

      // Normalize BMK display string
      let displayBmk = rawBmk;
      if (!displayBmk.startsWith('-') && !displayBmk.startsWith('/') && !displayBmk.startsWith('+')) {
        if (/^[A-Za-z]/.test(displayBmk)) {
          displayBmk = '-' + displayBmk;
        }
      }

      const compId = `comp_${pageId}_${colIndex}_${rawBmk.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      // Initialize pins
      const pinsObj: PlacedComponent['pins'] = {};
      symbolInfo.pins.forEach(p => {
        pinsObj[p.id] = { wireIds: [] };
      });

      components.push({
        id: compId,
        symbolId: symbolInfo.symbolId,
        bmk: displayBmk,
        higherLevelFunction: higherLevel,
        mountingLocation: location,
        functionText: fn.funcText || matchingInst?.text || symbolInfo.defaultText,
        x,
        y,
        rotation: 0,
        pins: pinsObj
      });

      colIndex++;
    }

    // 2. If page is schematic and has few or no components, add standard supply rails
    if (pageType === 'schematic') {
      const hasL1 = components.some(c => c.bmk.includes('L1') || c.functionText.includes('L1'));
      if (!hasL1) {
        components.unshift(
          {
            id: `comp_pf_${pageId}_l1`,
            symbolId: 'potential_arrow_down',
            bmk: `/${pageNumber}.1`,
            functionText: 'L1',
            x: 120,
            y: 80,
            rotation: 0,
            pins: { '1': { wireIds: [] } }
          },
          {
            id: `comp_pf_${pageId}_n`,
            symbolId: 'potential_arrow_down',
            bmk: `/${pageNumber}.2`,
            functionText: 'N',
            x: 205,
            y: 80,
            rotation: 0,
            pins: { '1': { wireIds: [] } }
          },
          {
            id: `comp_pf_${pageId}_pe`,
            symbolId: 'potential_arrow_down',
            bmk: `/${pageNumber}.3`,
            functionText: 'PE',
            x: 290,
            y: 80,
            rotation: 0,
            pins: { '1': { wireIds: [] } }
          }
        );
      }
    }

    return components;
  }

  /**
   * Resolves appropriate IEC symbol from library based on BMK prefix, function text, or circuit type
   */
  private static resolveSymbolForBmk(
    bmk: string,
    funcText: string,
    _pageType: PageType
  ): { symbolId: string; defaultText: string; pins: { id: string }[] } {
    const upperBmk = bmk.toUpperCase();
    const upperText = funcText.toUpperCase();

    // Potentials
    if (upperBmk.startsWith('L1') || upperBmk === 'L' || upperBmk.includes('+24V') || upperBmk.includes('24 V')) {
      return { symbolId: 'potential_arrow_down', defaultText: bmk, pins: [{ id: '1' }] };
    }
    if (upperBmk.startsWith('L2') || upperBmk.startsWith('L3')) {
      return { symbolId: 'potential_arrow_down', defaultText: bmk, pins: [{ id: '1' }] };
    }
    if (upperBmk === 'N' || upperBmk === 'PE' || upperBmk === 'PEN' || upperBmk.includes('0V') || upperBmk.includes('N(-)')) {
      return { symbolId: 'potential_arrow_down', defaultText: bmk, pins: [{ id: '1' }] };
    }

    // Fuses / Protection
    if (upperBmk.startsWith('F') || upperText.includes('SICHERUNG') || upperText.includes('FI')) {
      return {
        symbolId: 'fuse_1p',
        defaultText: 'Sicherung',
        pins: [{ id: '1' }, { id: '2' }]
      };
    }

    // Circuit breakers / Power contacts
    if (upperBmk.startsWith('Q')) {
      return {
        symbolId: 'motor_protective_switch',
        defaultText: 'Motorschutzschalter',
        pins: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }, { id: '6' }]
      };
    }

    // Contactor / Relay coil or contacts
    if (upperBmk.startsWith('K') || upperBmk.startsWith('E') || upperBmk.startsWith('G') || upperBmk.startsWith('H')) {
      if (upperText.includes('RELAIS') || upperText.includes('SCHÜTZ') || upperText.includes('SPULE') || upperBmk.startsWith('K')) {
        return {
          symbolId: 'contactor_coil',
          defaultText: 'Relaisspule',
          pins: [{ id: 'A1' }, { id: 'A2' }]
        };
      }
      return {
        symbolId: 'contact_no',
        defaultText: 'Schließer',
        pins: [{ id: '13' }, { id: '14' }]
      };
    }

    // Pushbutton / Switch
    if (upperBmk.startsWith('S') || upperText.includes('TASTER') || upperText.includes('SCHALTER')) {
      if (upperText.includes('AUS') || upperText.includes('STOP') || upperText.includes('NOT')) {
        return {
          symbolId: 'contact_nc',
          defaultText: 'Taster Öffner',
          pins: [{ id: '21' }, { id: '22' }]
        };
      }
      return {
        symbolId: 'pushbutton_no',
        defaultText: 'Taster Schließer',
        pins: [{ id: '13' }, { id: '14' }]
      };
    }

    // Terminals / Terminal Strips
    if (upperBmk.startsWith('X') || upperBmk.startsWith('XS') || /^[0-9]+$/.test(upperBmk)) {
      return {
        symbolId: 'terminal_single',
        defaultText: 'Reihenklemme',
        pins: [{ id: '1' }, { id: '2' }]
      };
    }

    // Motor
    if (upperBmk.startsWith('M') || upperText.includes('MOTOR') || upperText.includes('ROLLADEN')) {
      return {
        symbolId: 'motor_3phase',
        defaultText: 'Motor',
        pins: [{ id: 'U' }, { id: 'V' }, { id: 'W' }, { id: 'PE' }]
      };
    }

    // Indicator / Pilot Lamp
    if (upperBmk.startsWith('P') || upperText.includes('LEUCHTE') || upperText.includes('LAMPE') || upperText.includes('LICHT')) {
      return {
        symbolId: 'pilot_lamp',
        defaultText: 'Meldeleuchte',
        pins: [{ id: 'X1' }, { id: 'X2' }]
      };
    }

    // PLC / Controller Module
    if (upperBmk.startsWith('A')) {
      return {
        symbolId: 'contactor_coil',
        defaultText: 'Steuerungsmodul',
        pins: [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    // Default fallback
    const fallbackSym = SYMBOL_DEFINITIONS.find(s => s.id === 'terminal_single') || SYMBOL_DEFINITIONS[0];
    return {
      symbolId: fallbackSym.id,
      defaultText: fallbackSym.defaultFunctionText,
      pins: fallbackSym.pins.map(p => ({ id: p.id }))
    };
  }

  // Helper utility methods for binary parsing

  private static indexOf(buf: Uint8Array, needle: number[], start: number = 0): number {
    const nLen = needle.length;
    if (nLen === 0) return start;
    const max = buf.length - nLen;
    for (let i = Math.max(0, start); i <= max; i++) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (buf[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  private static lastIndexOf(buf: Uint8Array, needle: number[], end: number): number {
    const nLen = needle.length;
    if (nLen === 0) return end;
    const max = Math.min(buf.length - nLen, end);
    for (let i = max; i >= 0; i--) {
      let found = true;
      for (let j = 0; j < nLen; j++) {
        if (buf[i + j] !== needle[j]) {
          found = false;
          break;
        }
      }
      if (found) return i;
    }
    return -1;
  }

  private static readUint32LE(buf: Uint8Array, offset: number): number {
    return (
      (buf[offset] |
        (buf[offset + 1] << 8) |
        (buf[offset + 2] << 16) |
        (buf[offset + 3] << 24)) >>> 0
    );
  }

  private static readDoubleLE(buf: Uint8Array, offset: number): number {
    const view = new DataView(buf.buffer, buf.byteOffset + offset, 8);
    return view.getFloat64(0, true);
  }

  private static decodeUtf8(bytes: Uint8Array): string {
    return new TextDecoder('utf-8').decode(bytes);
  }
}
