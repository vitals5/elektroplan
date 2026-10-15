// src/packages/EdbProjectParser.ts
// Intelligent parser and reconstructor for CAD project archives (.edb / .elk / .zw1 / .zip)
// Extracts pages, symbols, functions, coordinates, and potential connections following IEC 81346.

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, PageType, Wire, PageText } from '../model/types';
import { SYMBOL_DEFINITIONS, getSymbolById } from '../model/symbols';
import { AutoconnectEngine } from '../model/AutoconnectEngine';

export interface ExtractedPageMeta {
  pageId: number;
  pageNumber: string;
  location: string;
  higherLevel: string;
  title: string;
}

export interface RawFunction {
  x: number;
  y: number;
  bmk: string;
  strings: string[];
  pins: string[];
}

export interface RawIPoint {
  x: number;
  y: number;
  name: string;
}

export interface RawText {
  x: number;
  y: number;
  text: string;
}

export interface RawConnection {
  from: string;
  to: string;
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

    // 3. Extract and sort all page records from Page.eod
    const rawPages = this.extractPages(pageBuf);
    messages.push(`${rawPages.length} Projektseiten in der Datenbank identifiziert.`);

    // 4. Locate and parse Function.eod, IPoint.eod, Instance.eod, Connection.eod
    const funcZipEntry = zip.file(/Function\.eod$/i)[0];
    const ipointZipEntry = zip.file(/IPoint\.eod$/i)[0];
    const instZipEntry = zip.file(/Instance\.eod$/i)[0];
    const connZipEntry = zip.file(/Connection\.eod$/i)[0];

    const funcsByPage = new Map<number, RawFunction[]>();
    if (funcZipEntry) {
      const funcBuf = await funcZipEntry.async('uint8array');
      this.extractFunctions(funcBuf, funcsByPage);
      messages.push(`Funktionen und Betriebsmittel extrahiert (${funcsByPage.size} referenzierte Seiten).`);
    }

    const ipointsByPage = new Map<number, RawIPoint[]>();
    if (ipointZipEntry) {
      const ipointBuf = await ipointZipEntry.async('uint8array');
      this.extractIPoints(ipointBuf, ipointsByPage);
      messages.push(`Abbruchstellen / Potentialverweise extrahiert (${ipointsByPage.size} referenzierte Seiten).`);
    }

    const textsByPage = new Map<number, RawText[]>();
    if (instZipEntry) {
      const instBuf = await instZipEntry.async('uint8array');
      this.extractTexts(instBuf, textsByPage);
      messages.push(`Freie Texte und Kabelbeschriftungen extrahiert (${textsByPage.size} referenzierte Seiten).`);
    }

    const connsByPage = new Map<number, RawConnection[]>();
    if (connZipEntry) {
      const connBuf = await connZipEntry.async('uint8array');
      this.extractConnections(connBuf, connsByPage);
      messages.push(`Verbindungsdefinitionen extrahiert (${connsByPage.size} referenzierte Seiten).`);
    }

    // 5. Construct Page models with PlacedComponents, Wires & Free Texts
    const pages: Page[] = [];
    const totalSheetsCount = rawPages.length;

    for (let i = 0; i < rawPages.length; i++) {
      const rp = rawPages[i];
      const pageId = rp.pageId;
      const fList = funcsByPage.get(pageId) || [];
      const ipList = ipointsByPage.get(pageId) || [];
      const tList = textsByPage.get(pageId) || [];
      const cList = connsByPage.get(pageId) || [];

      // Determine PageType
      let pageType: PageType = 'schematic';
      if (rp.title.toLowerCase().includes('titelblatt') || rp.location === 'EAA' || rp.pageNumber === '0') {
        pageType = 'cover';
      } else if (rp.location === 'PLG_ST' || rp.title.toLowerCase().includes('steckerplan')) {
        pageType = 'terminal_diagram';
      }

      const higherLevel = rp.higherLevel ? (rp.higherLevel.startsWith('=') ? rp.higherLevel : '=' + rp.higherLevel) : '=A1';
      const location = rp.location ? (rp.location.startsWith('+') ? rp.location : '+' + rp.location) : '+S1';

      // Sheet number display: e.g. "1 / 45"
      const sheetNumDisplay = `${i + 1} / ${totalSheetsCount}`;

      // Build components for this page (functions + interruption points)
      const components: PlacedComponent[] = this.buildPageComponents(
        pageId,
        rp.pageNumber,
        higherLevel,
        location,
        pageType,
        fList,
        ipList
      );

      // Build free texts for this page
      const texts: PageText[] = this.buildPageTexts(pageId, tList);

      // Build wires for this page
      const wires: Wire[] = this.buildPageWires(components, cList);

      const page: Page = {
        id: `page_${pageId}_${rp.pageNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`,
        pageNumber: rp.pageNumber,
        pageType,
        title: rp.title || `Seite ${rp.pageNumber}`,
        higherLevel,
        location,
        components,
        wires,
        texts,
        plotFrame: {
          type: 'DIN_A3_LANDSCAPE',
          width: 1000,
          height: 700,
          columns: 10,
          rows: ['A', 'B', 'C', 'D', 'E', 'F'],
          titleBlock: {
            projectTitle: description ? `${projectName} - ${description}` : projectName,
            commission: 'KOM-2026',
            company,
            author,
            date: modified || created,
            revision: '1.0',
            sheetNumber: sheetNumDisplay,
            totalSheets: String(totalSheetsCount)
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
    const totalTextCount = pages.reduce((acc, p) => acc + (p.texts?.length || 0), 0);
    messages.push(`Erfolgreich rekonstruiert: ${pages.length} Seiten, ${totalCompCount} Komponenten, ${totalTextCount} Texte, ${totalWireCount} Verbindungen.`);

    const project: Project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: projectName,
      description,
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '2026.0',
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
   * Extracts page records from Page.eod and sorts them in document sequence.
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

        // Title: search backwards for de_DE@ or ??_??@
        const searchChunk = buf.subarray(Math.max(0, idx - 1200), idx);
        let title = '';
        const deTag = [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40]; // de_DE@
        const qqTag = [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40]; // ??_??@

        const deIdx = this.lastIndexOf(searchChunk, deTag, searchChunk.length);
        const qqIdx = this.lastIndexOf(searchChunk, qqTag, searchChunk.length);

        if (deIdx > qqIdx && deIdx !== -1) {
          const s = this.indexOf(searchChunk, [0x3b], deIdx);
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

    // Sort pages in natural CAD document sequence:
    // 1. Cover (+EAA)
    // 2. Schematic (+ET1 / +S1 / =A1) ordered by sheet number (1, 1-1, 1-2, 2, 3, 4, ...)
    // 3. Terminal / connector diagrams (+PLG_ST)
    pages.sort((a, b) => {
      if (a.location === 'EAA' && b.location !== 'EAA') return -1;
      if (b.location === 'EAA' && a.location !== 'EAA') return 1;
      if (a.location === 'PLG_ST' && b.location !== 'PLG_ST') return 1;
      if (b.location === 'PLG_ST' && a.location !== 'PLG_ST') return -1;

      const partsA = a.pageNumber.split('-').map(Number);
      const partsB = b.pageNumber.split('-').map(Number);
      const scoreA = partsA[0] * 100 + (partsA[1] || 0);
      const scoreB = partsB[0] * 100 + (partsB[1] || 0);
      return scoreA - scoreB;
    });

    return pages;
  }

  /**
   * Extracts function and BMK definitions with CAD mm coordinates from Function.eod
   */
  private static extractFunctions(buf: Uint8Array, map: Map<number, RawFunction[]>): void {
    const pageMarker = [0xf1, 0xeb, 0x04, 0x00];
    const coordMarker = [0x5a, 0xed];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(Math.max(0, offset - 100), Math.min(buf.length, offset + 400));

        let x = 0;
        let y = 0;
        const cIdx = this.indexOf(slice, coordMarker, 0);
        if (cIdx !== -1 && cIdx + 18 <= slice.length) {
          x = this.readDoubleLE(slice, cIdx + 2);
          y = this.readDoubleLE(slice, cIdx + 10);
        }

        // BMK: 0x2cee (prefix) + 0x2dee (counter) or 0xf0ea
        let bmk = '';
        const pfxIdx = this.indexOf(slice, [0x2c, 0xee], 0);
        const cntIdx = this.indexOf(slice, [0x2d, 0xee], 0);
        if (pfxIdx !== -1) {
          const pfx = this.decodeUtf8(slice.subarray(pfxIdx + 2, pfxIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          let cnt = '';
          if (cntIdx !== -1) {
            cnt = this.decodeUtf8(slice.subarray(cntIdx + 2, cntIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          }
          bmk = '-' + pfx + cnt;
        } else {
          const bmkIdx = this.indexOf(slice, [0xf0, 0xea], 0);
          if (bmkIdx !== -1) {
            bmk = this.decodeUtf8(slice.subarray(bmkIdx + 2, Math.min(slice.length, bmkIdx + 40))).replace(/[^\x20-\x7e]/g, ' ').trim();
          }
        }

        // Multilingual strings (function text, technical characteristics, device descriptions)
        const strings: string[] = [];
        for (let i = 0; i < slice.length - 6; i++) {
          if (slice[i] === 0x3f && slice[i + 1] === 0x3f && slice[i + 2] === 0x5f) { // ??_??@
            let s = i + 6;
            let str = '';
            while (s < slice.length && slice[s] !== 0x3b && slice[s] !== 0x00) {
              str += String.fromCharCode(slice[s++]);
            }
            if (str.trim().length > 0 && !strings.includes(str.trim())) {
              strings.push(str.trim());
            }
          }
        }

        // Direct function text (0x1aeb)
        let ftIdx = 0;
        while ((ftIdx = this.indexOf(slice, [0x1a, 0xeb], ftIdx)) !== -1) {
          let s = ftIdx + 2;
          let str = '';
          while (s < slice.length && slice[s] >= 0x20 && slice[s] <= 0xfe && slice[s] !== 0x00) {
            str += String.fromCharCode(slice[s++]);
          }
          const clean = str.trim();
          if (clean.length > 0 && !strings.includes(clean)) {
            strings.push(clean);
          }
          ftIdx += 2;
        }

        // Pins (0x19eb)
        const pins: string[] = [];
        let pinOffset = 0;
        while ((pinOffset = this.indexOf(slice, [0x19, 0xeb], pinOffset)) !== -1) {
          const pinStr = this.decodeUtf8(slice.subarray(pinOffset + 2, pinOffset + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
          if (pinStr.length > 0 && !pins.includes(pinStr)) {
            pins.push(pinStr);
          }
          pinOffset += 2;
        }

        if (x > 0 || y > 0 || bmk.length > 0) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, bmk, strings, pins });
        }
      }
      offset += 4;
    }
  }

  /**
   * Extracts interruption points (Abbruchstellen / Potentialverweise) from IPoint.eod
   */
  private static extractIPoints(buf: Uint8Array, map: Map<number, RawIPoint[]>): void {
    const pageMarker = [0xf1, 0xeb, 0x04, 0x00];
    const coordMarker = [0x5a, 0xed];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(offset, Math.min(buf.length, offset + 350));

        let x = 0;
        let y = 0;
        const cIdx = this.indexOf(slice, coordMarker, 0);
        if (cIdx !== -1 && cIdx + 18 <= slice.length) {
          x = this.readDoubleLE(slice, cIdx + 2);
          y = this.readDoubleLE(slice, cIdx + 10);
        }

        let pfx = '';
        let cnt = '';
        const pIdx = this.indexOf(slice, [0x2c, 0xee], 0);
        if (pIdx !== -1) {
          pfx = this.decodeUtf8(slice.subarray(pIdx + 2, pIdx + 10)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
        }
        const cntIdx = this.indexOf(slice, [0x2d, 0xee], 0);
        if (cntIdx !== -1) {
          cnt = this.decodeUtf8(slice.subarray(cntIdx + 2, cntIdx + 50)).split('\0')[0].replace(/[^\x20-\x7e]/g, '');
        }

        const name = (pfx + cnt).trim();
        if (name && (x > 0 || y > 0)) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, name });
        }
      }
      offset += 4;
    }
  }

  /**
   * Extracts free texts, section titles, and cable labels from Instance.eod
   */
  private static extractTexts(buf: Uint8Array, map: Map<number, RawText[]>): void {
    const pageMarker = [0xf1, 0xeb, 0x04, 0x00];
    const coordMarker = [0x55, 0xec];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(offset, Math.min(buf.length, offset + 250));

        let x = 0;
        let y = 0;
        const cIdx = this.indexOf(slice, coordMarker, 0);
        if (cIdx !== -1 && cIdx + 18 <= slice.length) {
          x = this.readDoubleLE(slice, cIdx + 2);
          y = this.readDoubleLE(slice, cIdx + 10);
        }

        let text = '';
        const deIdx = this.indexOf(slice, [0x64, 0x65, 0x5f, 0x44, 0x45, 0x40], 0);
        const qqIdx = this.indexOf(slice, [0x3f, 0x3f, 0x5f, 0x3f, 0x3f, 0x40], 0);
        if (deIdx !== -1) {
          const s = deIdx + 6;
          let e = s;
          while (e < slice.length && slice[e] !== 0x3b && slice[e] !== 0x00) e++;
          text = this.decodeUtf8(slice.subarray(s, e)).trim();
        } else if (qqIdx !== -1) {
          const s = qqIdx + 6;
          let e = s;
          while (e < slice.length && slice[e] !== 0x3b && slice[e] !== 0x00) e++;
          text = this.decodeUtf8(slice.subarray(s, e)).trim();
        }

        if (text && (x > 0 || y > 0)) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ x, y, text });
        }
      }
      tOffset: offset += 4;
    }
  }

  /**
   * Extracts explicit source and target connections from Connection.eod
   */
  private static extractConnections(buf: Uint8Array, map: Map<number, RawConnection[]>): void {
    const pageMarker = [0xf2, 0xeb, 0x04, 0x00];
    let offset = 0;

    while ((offset = this.indexOf(buf, pageMarker, offset)) !== -1) {
      if (offset + 8 <= buf.length) {
        const pageId = this.readUint32LE(buf, offset + 4);
        const slice = buf.subarray(offset, Math.min(buf.length, offset + 350));

        let from = '';
        let to = '';
        const fIdx = this.indexOf(slice, [0x03, 0xfa], 0);
        if (fIdx !== -1) {
          from = this.decodeUtf8(slice.subarray(fIdx + 2, fIdx + 100)).split('\0')[0].trim();
        }
        const tIdx = this.indexOf(slice, [0x04, 0xfa], 0);
        if (tIdx !== -1) {
          to = this.decodeUtf8(slice.subarray(tIdx + 2, tIdx + 100)).split('\0')[0].trim();
        }

        if (from || to) {
          if (!map.has(pageId)) map.set(pageId, []);
          map.get(pageId)!.push({ from, to });
        }
      }
      offset += 4;
    }
  }

  /**
   * Transforms CAD millimeter coordinates (420 x 297 mm, bottom-left origin)
   * into CadCanvas pixels (1000 x 700 px, top-left origin).
   */
  private static toCanvas(cadX: number, cadY: number): { x: number; y: number } {
    const x = Math.round((cadX / 420) * 1000);
    const y = Math.round(((297 - cadY) / 297) * 700);
    return {
      x: Math.max(35, Math.min(960, x)),
      y: Math.max(35, Math.min(640, y))
    };
  }

  /**
   * Constructs PlacedComponents for a page with mapped IEC symbols, real coordinates, and interruption points.
   */
  private static buildPageComponents(
    pageId: number,
    pageNumber: string,
    higherLevel: string,
    location: string,
    pageType: PageType,
    rawFuncs: RawFunction[],
    rawIPoints: RawIPoint[]
  ): PlacedComponent[] {
    const components: PlacedComponent[] = [];
    const placedBmks = new Set<string>();

    // 1. Process Functions
    for (let fIdx = 0; fIdx < rawFuncs.length; fIdx++) {
      const fn = rawFuncs[fIdx];
      let bmk = fn.bmk.trim();
      if (!bmk || bmk.startsWith('.N') || bmk.includes('Elektroverteilung')) continue;

      if (!bmk.startsWith('-') && !bmk.startsWith('/') && !bmk.startsWith('+')) {
        if (/^[A-Za-z]/.test(bmk)) bmk = '-' + bmk;
      }

      // Avoid placing duplicate poles for the same multi-pole device
      const existing = components.find(c => c.bmk === bmk && Math.abs(c.x - this.toCanvas(fn.x, fn.y).x) < 45);
      if (existing) {
        for (const s of fn.strings) {
          if (!s.match(/^[A-Z0-9\/-]+$/) && !s.includes('Elektroverteilung') && !existing.functionText.includes(s)) {
            existing.functionText = existing.functionText
              ? `${existing.functionText} / ${s}`
              : s;
          }
        }
        continue;
      }

      const canvasCoord = this.toCanvas(fn.x, fn.y);

      // Determine function text and technical characteristics
      const meaningfulStrings = fn.strings.filter(s => !s.match(/^[A-Z0-9\/-]+$/) && !s.includes('Elektroverteilung'));
      const funcText = meaningfulStrings.join(' / ');
      const techData = fn.strings.find(s => s.match(/(?:NH|\d+\s*A|\d+\s*W|S751|Goodwe|GMK|WWC|Finder|ESR|EUD|S2U|C10|C16|B16|B10|B6)/i)) || '';

      const symInfo = this.resolveSymbol(bmk, funcText, techData, pageType);

      const compId = `comp_${pageId}_${fIdx}_${bmk.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

      // Initialize pins
      const pinsObj: PlacedComponent['pins'] = {};
      symInfo.defaultPins.forEach(p => {
        pinsObj[p.id] = { wireIds: [] };
      });

      components.push({
        id: compId,
        symbolId: symInfo.symbolId,
        bmk,
        higherLevelFunction: higherLevel,
        mountingLocation: location,
        functionText: funcText || symInfo.defaultText,
        technicalCharacteristics: techData,
        x: canvasCoord.x,
        y: canvasCoord.y,
        rotation: 0,
        pins: pinsObj
      });

      placedBmks.add(bmk);
    }

    // 2. Process Interruption Points (IPoint)
    for (let ipIdx = 0; ipIdx < rawIPoints.length; ipIdx++) {
      const ip = rawIPoints[ipIdx];
      const canvasCoord = this.toCanvas(ip.x, ip.y);

      // Point right if on right half, point left if on left half
      const isRight = canvasCoord.x > 500;
      const symbolId = isRight ? 'potential_arrow_right' : 'potential_arrow_left';

      const ipCompId = `comp_ip_${pageId}_${ipIdx}`;

      components.push({
        id: ipCompId,
        symbolId,
        bmk: `/${pageNumber}.${ipIdx + 1}`,
        higherLevelFunction: higherLevel,
        mountingLocation: location,
        functionText: ip.name,
        x: canvasCoord.x,
        y: canvasCoord.y,
        rotation: 0,
        pins: { '1': { wireIds: [] } }
      });
    }

    return components;
  }

  /**
   * Constructs PageText entries from extracted text instances
   */
  private static buildPageTexts(pageId: number, rawTexts: RawText[]): PageText[] {
    const texts: PageText[] = [];

    for (let i = 0; i < rawTexts.length; i++) {
      const rt = rawTexts[i];
      const canvasCoord = this.toCanvas(rt.x, rt.y);
      const isHeader = rt.text.length > 3 && !rt.text.includes('mm²') && !rt.text.match(/^(?:br|sw|gr|bl|BK|BU|GNYE)$/);

      texts.push({
        id: `txt_${pageId}_${i}`,
        text: rt.text,
        x: canvasCoord.x,
        y: canvasCoord.y,
        fontSize: isHeader ? 11 : 9,
        fontWeight: isHeader ? 'bold' : 'normal',
        fontColor: isHeader ? '#63b3ed' : '#cbd5e0'
      });
    }

    return texts;
  }

  /**
   * Constructs Wire connections from Connection.eod definitions
   */
  private static buildPageWires(components: PlacedComponent[], rawConns: RawConnection[]): Wire[] {
    const wires: Wire[] = [];

    for (let i = 0; i < rawConns.length; i++) {
      const rc = rawConns[i];
      const fromMatch = this.findMatchingPin(components, rc.from);
      const toMatch = this.findMatchingPin(components, rc.to);

      if (fromMatch && toMatch && fromMatch.componentId !== toMatch.componentId) {
        wires.push({
          id: `w_eod_${i}`,
          from: fromMatch,
          to: toMatch,
          potential: 'L1',
          color: 'BK',
          crossSection: '1.5mm²'
        });
      }
    }

    return wires;
  }

  private static findMatchingPin(components: PlacedComponent[], targetStr: string): { componentId: string; pinId: string } | null {
    if (!targetStr) return null;
    // Extract BMK and Pin from target string like "=Elektroverteilung+ET1-Q12:1" or "-F0:3"
    const m = targetStr.match(/(-[A-Za-z0-9_.]+)(?::([A-Za-z0-9_.]+))?/);
    if (!m) return null;

    const bmk = m[1];
    const pin = m[2] || '1';

    const comp = components.find(c => c.bmk === bmk);
    if (!comp) return null;

    const sym = getSymbolById(comp.symbolId);
    if (!sym) return null;

    const matchingPin = sym.pins.find(p => p.id === pin || p.name === pin) || sym.pins[0];
    if (!matchingPin) return null;

    return { componentId: comp.id, pinId: matchingPin.id };
  }

  /**
   * Resolves the exact DIN EN 60617 symbol based on BMK prefix, function text, and technical data.
   */
  private static resolveSymbol(
    bmk: string,
    funcText: string,
    techData: string,
    _pageType: PageType
  ): { symbolId: string; defaultText: string; defaultPins: { id: string }[] } {
    const uBmk = bmk.toUpperCase();
    const uText = funcText.toUpperCase();
    const uTech = techData.toUpperCase();

    // 1. RCDs (FI-Schutzschalter)
    if (
      uBmk === '-Q0' || uBmk === '-Q1' || uBmk === '-Q2' || uBmk === '-Q3' || uBmk === '-Q4' || uBmk === '-Q5' ||
      uText.includes('FI-SCHALTER') || uText.includes('40 A') || uTech.includes('30 MA')
    ) {
      const sym = getSymbolById('rcd_4p');
      return {
        symbolId: 'rcd_4p',
        defaultText: 'FI-Schutzschalter 40A / 30mA',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 2. Changeover switches (Netz-Notstrom)
    if (uBmk === '-Q12' || uText.includes('NOTSTROM') || uText.includes('UMSCHALT')) {
      const sym = getSymbolById('changeover_switch_4p');
      return {
        symbolId: 'changeover_switch_4p',
        defaultText: 'Netz Notstrom Umschaltung',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 3. Main switches / Isolators
    if (uBmk.startsWith('-Q') && (uText.includes('HAUPTSCHALTER') || uBmk === '-Q10' || uBmk === '-Q11')) {
      const sym = getSymbolById('main_switch_4p');
      return {
        symbolId: 'main_switch_4p',
        defaultText: funcText || 'Hauptschalter 4P',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 4. NH Fuses
    if (uBmk === '-F0' || uTech.includes('NH') || uText.includes('HAUSANSCHLUSS')) {
      const sym = getSymbolById('fuse_switch_3p');
      return {
        symbolId: 'fuse_switch_3p',
        defaultText: 'NH-Sicherungslasttrennschalter',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 5. 3-Pole Circuit Breakers
    if (
      ['-F01', '-F02', '-F2', '-F10', '-F11', '-F22', '-F28', '-F32', '-F40', '-F46', '-F48', '-F61', '-F62'].includes(uBmk) ||
      uTech.includes('S751/3') || uTech.includes('C20') || uTech.includes('C32A')
    ) {
      const sym = getSymbolById('circuit_breaker_3p');
      return {
        symbolId: 'circuit_breaker_3p',
        defaultText: funcText || (uTech ? `LS-Schalter ${uTech}` : 'LS-Schalter 3P'),
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 6. 1-Pole Circuit Breakers
    if (uBmk.startsWith('-F')) {
      const sym = getSymbolById('circuit_breaker_1p');
      return {
        symbolId: 'circuit_breaker_1p',
        defaultText: funcText || (uTech ? `LS-Schalter ${uTech}` : 'LS-Schalter 1P'),
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    // 7. Energy Meters
    if (uBmk === '-Z1' || uBmk === '-Z2' || uBmk === '-Z3') {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: funcText || 'Drehstromzähler',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    if (uBmk === '-P3' || uText.includes('SMARTMETER') || uTech.includes('GMK330')) {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: 'Smartmeter GMK330',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    if (uBmk === '-P102' || uText.includes('TARIF')) {
      const sym = getSymbolById('energy_meter_3p');
      return {
        symbolId: 'energy_meter_3p',
        defaultText: 'Tarifsteuergerät',
        defaultPins: [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]
      };
    }

    // 8. Solar Inverters & Storage
    if (uBmk === '-TB1' || uTech.includes('GOODWE') || uText.includes('WECHSELRICHTER')) {
      const sym = getSymbolById('inverter_solar');
      return {
        symbolId: 'inverter_solar',
        defaultText: 'Hybridwechselrichter Goodwe ESA 15kW',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L1' }, { id: 'N' }]
      };
    }

    // 9. Relays & Actuators
    if (['-K20', '-K21', '-K22', '-K23', '-K24', '-K25'].includes(uBmk) || uTech.includes('ESR12Z')) {
      const sym = getSymbolById('electronic_relay_4ch');
      return {
        symbolId: 'electronic_relay_4ch',
        defaultText: funcText || 'ESR12Z-4DX-UC 4-Kanal (Zentral Ein / Aus)',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K26', '-K27'].includes(uBmk) || uTech.includes('EUD12D')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: 'EUD12D-UC Dimmer',
        defaultPins: [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K28', '-K30'].includes(uBmk) || uTech.includes('FINDER') || uTech.includes('S2U')) {
      const sym = getSymbolById('timer_relay_multifunction');
      return {
        symbolId: 'timer_relay_multifunction',
        defaultText: funcText || 'Zeitrelais',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (['-K100', '-K101', '-K102', '-K103', '-K104'].includes(uBmk) || uText.includes('WIFI')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: 'ESP8266 Wifi Relais Board',
        defaultPins: [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    if (uBmk.startsWith('-K')) {
      const sym = getSymbolById('contactor_coil');
      return {
        symbolId: 'contactor_coil',
        defaultText: funcText || 'Schütz / Relais',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'A1' }, { id: 'A2' }]
      };
    }

    // 10. Thermostats & Valves
    if (uBmk.startsWith('-S20') || uText.includes('RAUMTHERMOSTAT')) {
      const sym = getSymbolById('thermostat_box');
      return {
        symbolId: 'thermostat_box',
        defaultText: funcText || 'Raumthermostat',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    if (uBmk.startsWith('-Y20') || uText.includes('STELLANTRIEB')) {
      const sym = getSymbolById('valve_actuator');
      return {
        symbolId: 'valve_actuator',
        defaultText: funcText || 'Stellantrieb',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'X1' }, { id: 'X2' }]
      };
    }

    // 11. Motors
    if (uBmk === '-M101' || uText.includes('BRUNNENPUMPE 3~')) {
      const sym = getSymbolById('motor_3phase');
      return {
        symbolId: 'motor_3phase',
        defaultText: 'Brunnenpumpe (M 3~)',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'U1' }, { id: 'V1' }, { id: 'W1' }]
      };
    }

    if (uBmk.startsWith('-M') && (uText.includes('ROLLADEN') || uText.includes('PUMPE') || uText.includes('ABSAUGUNG') || uText.includes('TORANTRIEB') || uBmk.match(/^-M\d+$/))) {
      const sym = getSymbolById('motor_1phase');
      return {
        symbolId: 'motor_1phase',
        defaultText: funcText || 'Motor 1~',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'L' }, { id: 'N' }, { id: 'PE' }]
      };
    }

    // 12. Sockets & Switches
    if (uBmk.startsWith('-XB') || uText.includes('SCHALTERSTECKDOSE')) {
      const sym = getSymbolById('socket_switch');
      return {
        symbolId: 'socket_switch',
        defaultText: funcText || 'Schaltersteckdose',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: '2' }]
      };
    }

    if (uBmk.startsWith('-M1') && !uBmk.startsWith('-M10') && !uBmk.startsWith('-M14')) {
      const sym = getSymbolById('socket_schuko');
      return {
        symbolId: 'socket_schuko',
        defaultText: funcText || 'Steckdose',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: '1' }, { id: 'N' }]
      };
    }

    // 13. Lamps & Lights
    if (uText.includes('LEUCHTE') || uText.includes('LAMPE') || uText.includes('LICHT') || uBmk.startsWith('-E')) {
      const sym = getSymbolById('light_bulb');
      return {
        symbolId: 'light_bulb',
        defaultText: funcText || 'Leuchte',
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'x1' }, { id: 'x2' }]
      };
    }

    // 14. Network
    if (uBmk.startsWith('ETH') || uText.includes('NETZWERKDOSE')) {
      const sym = getSymbolById('rj45_port');
      return {
        symbolId: 'rj45_port',
        defaultText: funcText || bmk,
        defaultPins: sym ? sym.pins.map(p => ({ id: p.id })) : [{ id: 'ETH' }]
      };
    }

    // 15. Default fallback
    const fallback = getSymbolById('terminal_single') || SYMBOL_DEFINITIONS[0];
    return {
      symbolId: fallback.id,
      defaultText: fallback.defaultFunctionText,
      defaultPins: fallback.pins.map(p => ({ id: p.id }))
    };
  }

  // Utility byte methods
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
