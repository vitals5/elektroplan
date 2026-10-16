// src/model/MacroManager.ts
// CAE/CAD-kompatibler Makro-Manager & Bibliothek für Fenstermakros (.ema) und Seitenmakros (.ems)

import JSZip from 'jszip';
import { Project, Page, PlacedComponent, Wire, SymbolDefinition } from './types';
import { getSymbolForComponent, getComponentSymbolLibrary, mergeProjectSymbolLibrary } from './symbols';

export interface WindowMacro {
  id: string;
  name: string;
  type: 'ema';
  category: string;
  description: string;
  components: PlacedComponent[];
  symbolLibrary?: SymbolDefinition[];
  wires?: Wire[];
  width: number;
  height: number;
  handlePoint?: { x: number; y: number };
  isBuiltIn?: boolean;
  author?: string;
  version?: string;
  created?: string;
}

export interface PageMacro {
  id: string;
  name: string;
  type: 'ems';
  category: string;
  description: string;
  page: Page;
  symbolLibrary?: SymbolDefinition[];
  isBuiltIn?: boolean;
  author?: string;
  version?: string;
  created?: string;
}

export type MacroItem = WindowMacro | PageMacro;

const STORAGE_KEY = 'elektroplan_user_macros';

// --- OUT-OF-THE-BOX STANDARD MACROS (.EMA & .EMS) ---
export const BUILTIN_MACROS: MacroItem[] = [
  // 1. Motorabzweig 400V AC
  {
    id: 'macro_ema_motorabzweig_400v',
    name: 'Motorabzweig 400V AC (Standard)',
    type: 'ema',
    category: 'Motoren & Antriebe',
    description: 'Einspeisung L1-L3, Motorschutzschalter, Leistungsschütz, Reihenklemmen und Drehstrommotor (fluchtend im 24px-Raster)',
    width: 120,
    height: 380,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_q1',
        symbolId: 'motor_overload_switch',
        bmk: '-Q1',
        functionText: 'Motorschutzschalter',
        technicalCharacteristics: '2.8 - 4.0A',
        articleNumber: '3RV2011-1EA10',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_k1',
        symbolId: 'contactor_power_3p',
        bmk: '-K1',
        functionText: 'Hauptschütz Antrieb',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 0,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_1',
        symbolId: 'terminal_pe',
        bmk: '-X1:1',
        functionText: 'Klemme L1',
        x: 0,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_2',
        symbolId: 'terminal_pe',
        bmk: '-X1:2',
        functionText: 'Klemme L2',
        x: 24,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_x1_3',
        symbolId: 'terminal_pe',
        bmk: '-X1:3',
        functionText: 'Klemme L3',
        x: 48,
        y: 190,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_m1',
        symbolId: 'motor_3p',
        bmk: '-M1',
        functionText: 'Hauptantrieb Förderband',
        technicalCharacteristics: '1.5kW 400V 3.2A',
        x: 0,
        y: 270,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 2. Wendeschützschaltung 400V AC
  {
    id: 'macro_ema_wendeschuetz_400v',
    name: 'Wendeschützschaltung 400V AC',
    type: 'ema',
    category: 'Motoren & Antriebe',
    description: 'Motorschutzschalter mit zwei gegenseitig verriegelten Schützen für Rechts-/Linkslauf',
    width: 220,
    height: 380,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_wq1',
        symbolId: 'motor_overload_switch',
        bmk: '-Q1',
        functionText: 'Motorschutzschalter',
        technicalCharacteristics: '2.8 - 4.0A',
        articleNumber: '3RV2011-1EA10',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wk1',
        symbolId: 'contactor_power_3p',
        bmk: '-K1',
        functionText: 'Schütz Rechtslauf',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 0,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wk2',
        symbolId: 'contactor_power_3p',
        bmk: '-K2',
        functionText: 'Schütz Linkslauf (Phasen L1/L3 getauscht)',
        technicalCharacteristics: '4.0kW 400V AC',
        articleNumber: '3RT2016-1BB41',
        manufacturer: 'Siemens',
        x: 88,
        y: 100,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_wm1',
        symbolId: 'motor_3p',
        bmk: '-M1',
        functionText: 'Reversierantrieb',
        technicalCharacteristics: '1.5kW 400V 3.2A',
        x: 0,
        y: 270,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 3. 24V DC Steuerstrom-Versorgung
  {
    id: 'macro_ema_power_supply_24v',
    name: 'Steuerstromversorgung 24V DC',
    type: 'ema',
    category: 'Steuerung & Versorgung',
    description: '230V AC Absicherung, Schaltnetzteil 230V/24V 5A und sekundäre 24V DC Absicherung',
    width: 180,
    height: 280,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_ps_f1',
        symbolId: 'fuse_1p',
        bmk: '-F1',
        functionText: 'Primärsicherung Netzteil',
        technicalCharacteristics: 'B6A 230V AC',
        articleNumber: 'MBN106',
        manufacturer: 'Hager',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ps_t1',
        symbolId: 'transformer_supply',
        bmk: '-T1',
        functionText: 'Schaltnetzteil 24V DC / 5A',
        technicalCharacteristics: 'In: 230V AC | Out: 24V DC 120W',
        articleNumber: '6EP1333-1LB00',
        manufacturer: 'Siemens',
        x: 0,
        y: 80,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ps_f2',
        symbolId: 'fuse_1p',
        bmk: '-F2',
        functionText: 'Sekundärabsicherung Steuerstrom',
        technicalCharacteristics: '4A elektronisch',
        articleNumber: 'EPD24-4A',
        manufacturer: 'Siemens',
        x: 0,
        y: 190,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 4. NOT-HALT Sicherheitskreis 2-kanalig
  {
    id: 'macro_ema_estop_circuit',
    name: 'NOT-HALT Sicherheitskreis (2-kanalig)',
    type: 'ema',
    category: 'Sicherheitstechnik',
    description: 'Zweikanaliger Not-Halt Pilztaster mit 2 Öffnerkontakten und Quittiertaster',
    width: 140,
    height: 260,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_es_s1',
        symbolId: 'estop_pushbutton',
        bmk: '-S1',
        functionText: 'NOT-HALT Bedienpult',
        technicalCharacteristics: '2NC Zwangsöffnung',
        articleNumber: '3SU1801-0NA00-2AA2',
        manufacturer: 'Siemens',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_es_s2',
        symbolId: 'pushbutton_no',
        bmk: '-S2',
        functionText: 'Quittierung / Reset',
        technicalCharacteristics: '1NO 24V DC',
        articleNumber: '3SU1000-0AB20-0AA0',
        manufacturer: 'Siemens',
        x: 0,
        y: 80,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_es_k1',
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: 'Sicherheits-Hauptschütz',
        technicalCharacteristics: 'Spule: 24V DC',
        x: 0,
        y: 160,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 5. Lichtsteuerung mit Stromstoßschalter
  {
    id: 'macro_ema_impulse_relay_light',
    name: 'Lichtsteuerung Stromstoßschalter',
    type: 'ema',
    category: 'Gebäude & Installation',
    description: 'Stromstoßrelais (Schrittschalter) mit Tastereingang für Flur- oder Hallenbeleuchtung',
    width: 120,
    height: 240,
    isBuiltIn: true,
    components: [
      {
        id: 'comp_ir_k1',
        symbolId: 'impulse_relay_1no',
        bmk: '-K1',
        functionText: 'Stromstoßrelais Beleuchtung',
        technicalCharacteristics: '16A 250V AC | Spule: 230V AC',
        articleNumber: '20.21.8.230.4000',
        manufacturer: 'Finder',
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ir_s1',
        symbolId: 'pushbutton_no',
        bmk: '-S1',
        functionText: 'Taster Licht Tür 1',
        x: 0,
        y: 90,
        rotation: 0,
        pins: {}
      },
      {
        id: 'comp_ir_s2',
        symbolId: 'pushbutton_no',
        bmk: '-S2',
        functionText: 'Taster Licht Tür 2',
        x: 0,
        y: 170,
        rotation: 0,
        pins: {}
      }
    ]
  },

  // 6. Seitenmakro: Vollständige Hauptstrom-Einspeisung (.ems)
  {
    id: 'macro_ems_full_feed_page',
    name: 'Hauptstrom-Einspeisung & Drehstromabzweig',
    type: 'ems',
    category: 'Komplette Seiten',
    description: 'Vollständige DIN A3 Stromlaufplan-Seite mit 3-phasiger Einspeisung, Motorschutz, Hauptschütz und Klemmenleiste',
    isBuiltIn: true,
    page: {
      id: 'template_page_feed',
      pageNumber: '1',
      pageType: 'schematic',
      title: 'Hauptstrom-Einspeisung 400V AC',
      higherLevel: '=A1',
      location: '+S1',
      components: [
        {
          id: 'p_feed_l1',
          symbolId: 'potential_arrow_down',
          bmk: '/1.1',
          functionText: 'L1',
          x: 220,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_l2',
          symbolId: 'potential_arrow_down',
          bmk: '/1.2',
          functionText: 'L2',
          x: 244,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_l3',
          symbolId: 'potential_arrow_down',
          bmk: '/1.3',
          functionText: 'L3',
          x: 268,
          y: 70,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_q1',
          symbolId: 'motor_overload_switch',
          bmk: '-Q1',
          functionText: 'Hauptmotorschutz',
          technicalCharacteristics: '2.8 - 4.0A',
          x: 220,
          y: 140,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_k1',
          symbolId: 'contactor_power_3p',
          bmk: '-K1',
          functionText: 'Hauptschütz',
          technicalCharacteristics: '4.0kW 400V AC',
          x: 220,
          y: 250,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_1',
          symbolId: 'terminal_pe',
          bmk: '-X1:1',
          functionText: 'L1',
          x: 220,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_2',
          symbolId: 'terminal_pe',
          bmk: '-X1:2',
          functionText: 'L2',
          x: 244,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_x1_3',
          symbolId: 'terminal_pe',
          bmk: '-X1:3',
          functionText: 'L3',
          x: 268,
          y: 360,
          rotation: 0,
          pins: {}
        },
        {
          id: 'p_feed_m1',
          symbolId: 'motor_3p',
          bmk: '-M1',
          functionText: 'Förderbandantrieb',
          technicalCharacteristics: '1.5kW 400V',
          x: 220,
          y: 440,
          rotation: 0,
          pins: {}
        }
      ],
      wires: [],
      plotFrame: {
        type: 'DIN_A3_LANDSCAPE',
        width: 1000,
        height: 700,
        columns: 10,
        rows: ['A', 'B', 'C', 'D', 'E', 'F'],
        titleBlock: {
          projectTitle: 'Hauptstrom-Einspeisung',
          commission: 'MAKRO-EMS-001',
          company: 'Elektro Engineering',
          author: 'Planer',
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: '1',
          totalSheets: '1'
        }
      }
    }
  }
];

export class MacroManager {
  /**
   * Retrieves all available macros (built-in + user imported).
   */
  public static getAllMacros(): MacroItem[] {
    const userMacros = this.getUserMacros();
    return [...BUILTIN_MACROS, ...userMacros];
  }

  /**
   * Retrieves user-defined / imported macros from localStorage.
   */
  public static getUserMacros(): MacroItem[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored) as MacroItem[];
    } catch (e) {
      return [];
    }
  }

  /**
   * Saves user macros to localStorage.
   */
  public static saveUserMacros(macros: MacroItem[]): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(macros));
    } catch (e) {
      console.error('Failed to save user macros to localStorage:', e);
    }
  }

  /**
   * Adds a new macro to the user's library.
   */
  public static addMacro(macro: MacroItem): void {
    const macros = this.getUserMacros();
    // Replace if id exists, otherwise prepend
    const idx = macros.findIndex(m => m.id === macro.id);
    if (idx >= 0) {
      macros[idx] = macro;
    } else {
      macros.unshift(macro);
    }
    this.saveUserMacros(macros);
  }

  /**
   * Deletes a user-defined macro by ID.
   */
  public static deleteMacro(macroId: string): boolean {
    const macros = this.getUserMacros();
    const filtered = macros.filter(m => m.id !== macroId);
    if (filtered.length !== macros.length) {
      this.saveUserMacros(filtered);
      return true;
    }
    return false;
  }

  /**
   * Parses an uploaded macro file (.ema, .ems, .edz, .xml, .json).
   * Robust multi-format parser supporting XML, JSON, ZIP and binary fallback.
   */
  public static async parseMacroFile(file: File): Promise<MacroItem> {
    const filename = file.name;
    const lowerName = filename.toLowerCase();
    const isPageMacro = lowerName.endsWith('.ems');

    // 1. Try parsing as ZIP archive (many .edz and modern packed .ema/.ems are ZIPs)
    try {
      const zip = await JSZip.loadAsync(file);
      return await this.parseZipMacro(zip, filename, isPageMacro);
    } catch {
      // Not a ZIP archive, continue to text/XML/JSON
    }

    // 2. Read as text
    const text = await file.text();

    // 2a. Check if valid JSON
    try {
      const parsed = JSON.parse(text);
      if (parsed.type === 'ema' || parsed.type === 'ems' || parsed.components || parsed.page) {
        return this.normalizeParsedJsonMacro(parsed, filename, isPageMacro);
      }
    } catch {
      // Not JSON, continue to XML
    }

    // 2b. Check if XML
    if (text.includes('<') && text.includes('>')) {
      try {
        return this.parseXmlMacro(text, filename, isPageMacro);
      } catch (xmlErr) {
        console.warn('XML macro parsing error, falling back to heuristic:', xmlErr);
      }
    }

    // 3. Fallback: Binary / heuristic string scanner for binary CAD macro streams
    return this.parseBinaryHeuristicMacro(file, filename, isPageMacro);
  }

  /**
   * Parses macro content inside a ZIP container (.edz or zipped .ema/.ems).
   */
  private static async parseZipMacro(zip: JSZip, filename: string, isPageMacro: boolean): Promise<MacroItem> {
    // Look for XML or JSON entries
    let xmlContent = '';
    let jsonContent = '';

    const entries = Object.keys(zip.files);
    for (const path of entries) {
      const entry = zip.files[path];
      if (entry.dir) continue;
      const lower = path.toLowerCase();
      if (lower.endsWith('.xml') || lower.endsWith('.ema') || lower.endsWith('.ems')) {
        const content = await entry.async('text');
        if (content.includes('<') && content.includes('>')) {
          xmlContent = content;
          break;
        }
      } else if (lower.endsWith('.json')) {
        jsonContent = await entry.async('text');
        break;
      }
    }

    if (jsonContent) {
      try {
        const parsed = JSON.parse(jsonContent);
        return this.normalizeParsedJsonMacro(parsed, filename, isPageMacro);
      } catch {}
    }

    if (xmlContent) {
      return this.parseXmlMacro(xmlContent, filename, isPageMacro);
    }

    // Fallback: create generic macro from entry names
    return this.createGenericMacro(filename, `ZIP-Makropaket mit ${entries.length} Einträgen`, isPageMacro);
  }

  /**
   * Parses XML-formatted CAD macro content.
   */
  private static parseXmlMacro(xmlContent: string, filename: string, isPageMacro: boolean): MacroItem {
    let macroName = filename.replace(/\.(ema|ems|xml|edz)$/i, '');
    let description = `Importiertes Makro aus ${filename}`;
    const components: PlacedComponent[] = [];
    let minX = Infinity;
    let minY = Infinity;

    if (typeof DOMParser !== 'undefined') {
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlContent, 'text/xml');

      const nameAttr = doc.querySelector('Macro, WindowMacro, PageMacro, ProjectXml, Project')?.getAttribute('name');
      if (nameAttr) macroName = nameAttr;

      const desc = doc.querySelector('Description, Remark')?.textContent;
      if (desc) description = desc;

      const componentNodes = Array.from(doc.querySelectorAll('Component, PlacedComponent, Object[type="Symbol"], SymbolInstance'));
      for (let i = 0; i < componentNodes.length; i++) {
        const node = componentNodes[i];
        const symbolId = node.getAttribute('symbolId')
          || node.getAttribute('symbol')
          || node.getAttribute('name')
          || 'contact_no';
        
        const bmk = node.getAttribute('bmk')
          || node.getAttribute('deviceTag')
          || `-K${i + 1}`;

        const rawX = parseFloat(node.getAttribute('x') || `${i * 30}`);
        const rawY = parseFloat(node.getAttribute('y') || '0');
        const rotation = (parseInt(node.getAttribute('rotation') || '0', 10) as any) || 0;

        if (rawX < minX) minX = rawX;
        if (rawY < minY) minY = rawY;

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId,
          bmk,
          functionText: node.getAttribute('functionText') || '',
          technicalCharacteristics: node.getAttribute('technical') || '',
          articleNumber: node.getAttribute('article') || '',
          manufacturer: node.getAttribute('manufacturer') || '',
          x: rawX,
          y: rawY,
          rotation,
          pins: {}
        });
      }
    } else {
      // Universal Regex XML Parser (e.g. for Node.js / test environments)
      const nameMatch = xmlContent.match(/<Macro[^>]+name="([^"]+)"/i) || xmlContent.match(/<Name>([^<]+)<\/Name>/i);
      if (nameMatch) macroName = nameMatch[1];

      const descMatch = xmlContent.match(/<Description>([^<]+)<\/Description>/i);
      if (descMatch) description = descMatch[1];

      const compTagRegex = /<Component\b([^>]*)\/?>/gi;
      let match;
      let i = 0;
      while ((match = compTagRegex.exec(xmlContent)) !== null) {
        const attrs = match[1];
        const getAttr = (name: string) => {
          const m = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
          return m ? m[1] : '';
        };

        const symbolId = getAttr('symbolId') || getAttr('symbol') || getAttr('name') || 'contact_no';
        const bmk = getAttr('bmk') || getAttr('deviceTag') || `-K${i + 1}`;
        const rawX = parseFloat(getAttr('x') || `${i * 30}`);
        const rawY = parseFloat(getAttr('y') || '0');
        const rotation = (parseInt(getAttr('rotation') || '0', 10) as any) || 0;

        if (rawX < minX) minX = rawX;
        if (rawY < minY) minY = rawY;

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId,
          bmk,
          functionText: getAttr('functionText') || '',
          technicalCharacteristics: getAttr('technical') || '',
          articleNumber: getAttr('article') || '',
          manufacturer: getAttr('manufacturer') || '',
          x: rawX,
          y: rawY,
          rotation,
          pins: {}
        });
        i++;
      }
    }

    // Normalize coordinates so the macro starts at relative (0, 0)
    if (components.length > 0 && minX !== Infinity && minY !== Infinity) {
      for (const c of components) {
        c.x -= minX;
        c.y -= minY;
      }
    }

    if (components.length === 0) {
      // If no explicit component tags were found, create a placeholder device block
      components.push({
        id: 'comp_' + Math.random().toString(36).substring(2, 9),
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: macroName,
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      });
    }

    let maxX = 0;
    let maxY = 0;
    for (const c of components) {
      const sym = getSymbolForComponent(c);
      const w = sym ? sym.width : 40;
      const h = sym ? sym.height : 48;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    }

    if (isPageMacro) {
      const pageMacro: PageMacro = {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name: macroName,
        type: 'ems',
        category: 'Importierte Seitenmakros',
        description,
        isBuiltIn: false,
        created: new Date().toISOString().split('T')[0],
        page: {
          id: 'page_ems_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: macroName,
          higherLevel: '=A1',
          location: '+S1',
          components,
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: macroName,
              commission: 'IMPORT',
              company: 'Makro-Import',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
      return pageMacro;
    }

    const windowMacro: WindowMacro = {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name: macroName,
      type: 'ema',
      category: 'Eigene Fenstermakros',
      description,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(80, maxX),
      height: Math.max(60, maxY),
      components
    };

    return windowMacro;
  }

  /**
   * Heuristic scanner for binary CAD macro streams (.ema & .ems).
   * Extracts text, BMK strings and component signatures.
   */
  private static async parseBinaryHeuristicMacro(file: File, filename: string, isPageMacro: boolean): Promise<MacroItem> {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);

    // Extract ASCII / UTF-8 strings longer than 3 chars
    const extractedStrings: string[] = [];
    let currentStr = '';
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i];
      if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
        currentStr += String.fromCharCode(b);
      } else {
        if (currentStr.length >= 3) {
          extractedStrings.push(currentStr.trim());
        }
        currentStr = '';
      }
    }

    const name = filename.replace(/\.(ema|ems|edz)$/i, '');
    const bmkRegex = /^[=-]?[A-Z]{1,3}\d+$/;
    const detectedBmks = extractedStrings.filter(s => bmkRegex.test(s));

    // Construct components matching detected BMKs or default
    const components: PlacedComponent[] = [];
    const uniqueBmks = Array.from(new Set(detectedBmks)).slice(0, 10);

    if (uniqueBmks.length > 0) {
      uniqueBmks.forEach((bmk, idx) => {
        let symId = 'contact_no';
        if (bmk.startsWith('-Q')) symId = 'motor_overload_switch';
        else if (bmk.startsWith('-K')) symId = 'contactor_coil';
        else if (bmk.startsWith('-M')) symId = 'motor_3p';
        else if (bmk.startsWith('-F')) symId = 'fuse_1p';
        else if (bmk.startsWith('-S')) symId = 'pushbutton_no';
        else if (bmk.startsWith('-X')) symId = 'terminal_pe';

        components.push({
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId: symId,
          bmk,
          functionText: `Bauteil ${bmk}`,
          x: idx * 40,
          y: 0,
          rotation: 0,
          pins: {}
        });
      });
    } else {
      components.push({
        id: 'comp_' + Math.random().toString(36).substring(2, 9),
        symbolId: 'contactor_coil',
        bmk: '-K1',
        functionText: name,
        x: 0,
        y: 0,
        rotation: 0,
        pins: {}
      });
    }

    if (isPageMacro) {
      return {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name,
        type: 'ems',
        category: 'Importierte Seitenmakros',
        description: `Aus Datei ${filename} extrahierte Seite (${components.length} Bauteile)`,
        isBuiltIn: false,
        created: new Date().toISOString().split('T')[0],
        page: {
          id: 'page_ems_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: name,
          higherLevel: '=A1',
          location: '+S1',
          components,
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: name,
              commission: 'BIN-IMPORT',
              company: 'Makro-Import',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name,
      type: 'ema',
      category: 'Importierte Fenstermakros',
      description: `Aus Datei ${filename} rekonstruierte Teilschaltung (${components.length} Bauteile)`,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(80, components.length * 40),
      height: 100,
      components
    };
  }

  private static normalizeParsedJsonMacro(parsed: any, filename: string, isPageMacro: boolean): MacroItem {
    const name = parsed.name || filename.replace(/\.(ema|ems|json)$/i, '');
    const id = parsed.id || (isPageMacro ? 'user_ems_' : 'user_ema_') + Math.random().toString(36).substring(2, 9);
    
    if (parsed.type === 'ems' || parsed.page || isPageMacro) {
      return {
        id,
        name,
        type: 'ems',
        category: parsed.category || 'Importierte Seitenmakros',
        description: parsed.description || `Seitenmakro aus ${filename}`,
        symbolLibrary: parsed.symbolLibrary,
        page: parsed.page || {
          id: 'page_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: name,
          components: parsed.components || [],
          wires: parsed.wires || [],
          plotFrame: { type: 'DIN_A3_LANDSCAPE', width: 1000, height: 700, columns: 10, rows: ['A', 'B', 'C', 'D', 'E', 'F'], titleBlock: { projectTitle: name } }
        },
        isBuiltIn: false,
        created: new Date().toISOString().split('T')[0]
      };
    }

    return {
      id,
      name,
      type: 'ema',
      category: parsed.category || 'Importierte Fenstermakros',
      description: parsed.description || `Fenstermakro aus ${filename}`,
      symbolLibrary: parsed.symbolLibrary,
      components: parsed.components || [],
      wires: parsed.wires || [],
      width: parsed.width || 120,
      height: parsed.height || 160,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0]
    };
  }

  private static createGenericMacro(name: string, description: string, isPageMacro: boolean): MacroItem {
    const cleanName = name.replace(/\.(ema|ems|edz)$/i, '');
    if (isPageMacro) {
      return {
        id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        type: 'ems',
        category: 'Importierte Makros',
        description,
        isBuiltIn: false,
        page: {
          id: 'page_' + Math.random().toString(36).substring(2, 9),
          pageNumber: '1',
          pageType: 'schematic',
          title: cleanName,
          higherLevel: '=A1',
          location: '+S1',
          components: [],
          wires: [],
          plotFrame: {
            type: 'DIN_A3_LANDSCAPE',
            width: 1000,
            height: 700,
            columns: 10,
            rows: ['A', 'B', 'C', 'D', 'E', 'F'],
            titleBlock: {
              projectTitle: cleanName,
              commission: 'KOM-2026',
              company: 'Elektro Engineering',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      };
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name: cleanName,
      type: 'ema',
      category: 'Importierte Makros',
      description,
      width: 100,
      height: 100,
      isBuiltIn: false,
      components: [
        {
          id: 'comp_' + Math.random().toString(36).substring(2, 9),
          symbolId: 'contactor_coil',
          bmk: '-K1',
          functionText: cleanName,
          x: 0,
          y: 0,
          rotation: 0,
          pins: {}
        }
      ]
    };
  }

  /**
   * Creates a Window Macro (.ema) from a selection of components.
   */
  public static createMacroFromComponents(
    name: string,
    category: string,
    description: string,
    components: PlacedComponent[],
    wires?: Wire[]
  ): WindowMacro {
    if (components.length === 0) {
      throw new Error('Keine Bauteile für das Makro ausgewählt.');
    }

    // Find bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const c of components) {
      const sym = getSymbolForComponent(c);
      const w = sym ? sym.width : 40;
      const h = sym ? sym.height : 48;
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x + w > maxX) maxX = c.x + w;
      if (c.y + h > maxY) maxY = c.y + h;
    }

    // Clone components with relative positions
    const clonedComponents: PlacedComponent[] = components.map(c => ({
      ...JSON.parse(JSON.stringify(c)),
      x: c.x - minX,
      y: c.y - minY
    }));

    // Clone internal wires that connect between selected components
    const compIds = new Set(components.map(c => c.id));
    const internalWires: Wire[] = [];
    if (wires) {
      for (const w of wires) {
        if (compIds.has(w.from.componentId) && compIds.has(w.to.componentId)) {
          internalWires.push(JSON.parse(JSON.stringify(w)));
        }
      }
    }

    return {
      id: 'user_ema_' + Math.random().toString(36).substring(2, 9),
      name,
      type: 'ema',
      category: category || 'Eigene Fenstermakros',
      description,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      width: Math.max(40, maxX - minX),
      height: Math.max(40, maxY - minY),
      components: clonedComponents,
      symbolLibrary: getComponentSymbolLibrary(components),
      wires: internalWires
    };
  }

  /**
   * Creates a Page Macro (.ems) from an existing Page.
   */
  public static createMacroFromPage(page: Page, name?: string, category?: string): PageMacro {
    const pageClone: Page = JSON.parse(JSON.stringify(page));
    pageClone.id = 'macro_page_' + Math.random().toString(36).substring(2, 9);
    
    return {
      id: 'user_ems_' + Math.random().toString(36).substring(2, 9),
      name: name || page.title || `Seitenmakro Seite ${page.pageNumber}`,
      type: 'ems',
      category: category || 'Eigene Seitenmakros',
      description: `Seitenmakro erstellt aus Blatt ${page.pageNumber}`,
      isBuiltIn: false,
      created: new Date().toISOString().split('T')[0],
      page: pageClone,
      symbolLibrary: getComponentSymbolLibrary(page.components)
    };
  }

  /**
   * Instantiates a Window Macro (.ema) at target coordinates.
   * Performs BMK auto-incrementing and ID remapping so inserted components don't conflict.
   */
  public static instantiateWindowMacro(
    macro: WindowMacro,
    targetX: number,
    targetY: number,
    existingComponents: PlacedComponent[],
    project?: Project
  ): { components: PlacedComponent[]; wires: Wire[] } {
    // 1. Calculate next available numbers for each BMK prefix
    const bmkMap = new Map<string, string>(); // old BMK -> new BMK
    const idMap = new Map<string, string>();   // old comp ID -> new comp ID

    // Group macro components by BMK prefix
    for (const comp of macro.components) {
      if (!comp.bmk) continue;
      const match = comp.bmk.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)?(.*)$/);
      const prefix = match ? match[3] : comp.bmk.replace(/\d+.*$/, '');

      if (!bmkMap.has(comp.bmk)) {
        // Find highest existing index for this prefix in existing components and mapped components
        let maxIndex = 0;
        const allBmks = [...existingComponents.map(c => c.bmk), ...Array.from(bmkMap.values())];
        for (const b of allBmks) {
          if (!b) continue;
          const bMatch = b.match(/^(=[^+]+)?(\+[^-]+)?(-[A-Za-z]+)(\d+)/);
          if (bMatch && bMatch[3] === prefix) {
            const num = parseInt(bMatch[4], 10);
            if (!isNaN(num) && num > maxIndex) maxIndex = num;
          }
        }
        const nextNum = maxIndex + 1;
        bmkMap.set(comp.bmk, `${prefix}${nextNum}`);
      }
    }

    // 2. Clone and place components
    const newComponents: PlacedComponent[] = macro.components.map(c => {
      const newId = 'comp_' + Math.random().toString(36).substring(2, 9);
      idMap.set(c.id, newId);

      const assignedBmk = bmkMap.get(c.bmk) || c.bmk;

      return {
        ...JSON.parse(JSON.stringify(c)),
        id: newId,
        bmk: assignedBmk,
        x: targetX + c.x,
        y: targetY + c.y
      };
    });

    // 3. Clone and remap wires
    const newWires: Wire[] = [];
    if (macro.wires) {
      for (const w of macro.wires) {
        const fromId = idMap.get(w.from.componentId);
        const toId = idMap.get(w.to.componentId);
        if (fromId && toId) {
          newWires.push({
            ...JSON.parse(JSON.stringify(w)),
            id: 'w_' + Math.random().toString(36).substring(2, 9),
            from: { ...w.from, componentId: fromId },
            to: { ...w.to, componentId: toId }
          });
        }
      }
    }

    if (project) mergeProjectSymbolLibrary(project, macro.symbolLibrary ?? [], newComponents);
    return { components: newComponents, wires: newWires };
  }

  /**
   * Instantiates a Page Macro (.ems) by appending a cloned page to the project.
   */
  public static instantiatePageMacro(macro: PageMacro, project: Project): Page {
    const pageClone: Page = JSON.parse(JSON.stringify(macro.page));
    mergeProjectSymbolLibrary(project, macro.symbolLibrary ?? [], pageClone.components);
    const newPageId = 'page_' + Math.random().toString(36).substring(2, 9);
    pageClone.id = newPageId;

    // Determine next page number
    let maxPageNum = 0;
    for (const p of project.pages) {
      const num = parseInt(p.pageNumber, 10);
      if (!isNaN(num) && num > maxPageNum) maxPageNum = num;
    }
    const nextNum = (maxPageNum + 1).toString();
    pageClone.pageNumber = nextNum;
    pageClone.title = `${macro.name} (Seite ${nextNum})`;

    if (pageClone.plotFrame?.titleBlock) {
      pageClone.plotFrame.titleBlock.sheetNumber = nextNum;
      pageClone.plotFrame.titleBlock.totalSheets = (project.pages.length + 1).toString();
      pageClone.plotFrame.titleBlock.date = new Date().toISOString().split('T')[0];
    }

    // Remap component IDs to avoid collisions
    const idMap = new Map<string, string>();
    for (const c of pageClone.components) {
      const oldId = c.id;
      const newId = 'comp_' + Math.random().toString(36).substring(2, 9);
      idMap.set(oldId, newId);
      c.id = newId;
    }
    for (const w of pageClone.wires) {
      w.id = 'w_' + Math.random().toString(36).substring(2, 9);
      if (idMap.has(w.from.componentId)) w.from.componentId = idMap.get(w.from.componentId)!;
      if (idMap.has(w.to.componentId)) w.to.componentId = idMap.get(w.to.componentId)!;
    }

    return pageClone;
  }

  /**
   * Exports a Window Macro (.ema) or Page Macro (.ems) as an XML/JSON file.
   */
  public static exportMacro(macro: MacroItem): { blob: Blob; filename: string } {
    const cleanName = macro.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const ext = macro.type === 'ema' ? 'ema' : 'ems';
    const filename = `${cleanName}.${ext}`;

    // Our portable JSON macro format retains project master data, physical pins,
    // label formatting and routes which the legacy XML subset cannot represent.
    if (macro.symbolLibrary?.length) {
      return { blob: new Blob([JSON.stringify(macro, null, 2)], { type: 'application/json' }), filename };
    }

    // Generate XML schema for maximal CAD compatibility
    let xml = `<?xml version="1.0" encoding="utf-8"?>\n`;
    xml += `<Macro xmlns="http://www.elektroplan.de/schema/cad" type="${macro.type === 'ema' ? 'WindowMacro' : 'PageMacro'}" name="${macro.name}" version="2.0">\n`;
    xml += `  <Header>\n`;
    xml += `    <Name>${this.escapeXml(macro.name)}</Name>\n`;
    xml += `    <Category>${this.escapeXml(macro.category)}</Category>\n`;
    xml += `    <Description>${this.escapeXml(macro.description)}</Description>\n`;
    xml += `    <Created>${macro.created || new Date().toISOString()}</Created>\n`;
    xml += `    <Type>${macro.type}</Type>\n`;
    xml += `  </Header>\n`;

    if (macro.type === 'ema') {
      xml += `  <WindowMacroData width="${macro.width}" height="${macro.height}">\n`;
      xml += `    <Components count="${macro.components.length}">\n`;
      for (const c of macro.components) {
        xml += `      <Component id="${c.id}" symbolId="${c.symbolId}" bmk="${this.escapeXml(c.bmk)}" x="${c.x}" y="${c.y}" rotation="${c.rotation || 0}" functionText="${this.escapeXml(c.functionText || '')}" technical="${this.escapeXml(c.technicalCharacteristics || '')}" article="${this.escapeXml(c.articleNumber || '')}" manufacturer="${this.escapeXml(c.manufacturer || '')}"/>\n`;
      }
      xml += `    </Components>\n`;
      if (macro.wires && macro.wires.length > 0) {
        xml += `    <Wires count="${macro.wires.length}">\n`;
        for (const w of macro.wires) {
          xml += `      <Wire id="${w.id}" fromComp="${w.from.componentId}" fromPin="${w.from.pinId}" toComp="${w.to.componentId}" toPin="${w.to.pinId}" potential="${w.potential}" color="${w.color || ''}"/>\n`;
        }
        xml += `    </Wires>\n`;
      }
      xml += `  </WindowMacroData>\n`;
    } else {
      xml += `  <PageMacroData>\n`;
      xml += `    <Page title="${this.escapeXml(macro.page.title)}" pageNumber="${macro.page.pageNumber}" higherLevel="${this.escapeXml(macro.page.higherLevel || '')}" location="${this.escapeXml(macro.page.location || '')}">\n`;
      xml += `      <Components count="${macro.page.components.length}">\n`;
      for (const c of macro.page.components) {
        xml += `        <Component id="${c.id}" symbolId="${c.symbolId}" bmk="${this.escapeXml(c.bmk)}" x="${c.x}" y="${c.y}" rotation="${c.rotation || 0}" functionText="${this.escapeXml(c.functionText || '')}" technical="${this.escapeXml(c.technicalCharacteristics || '')}" article="${this.escapeXml(c.articleNumber || '')}" manufacturer="${this.escapeXml(c.manufacturer || '')}"/>\n`;
      }
      xml += `      </Components>\n`;
      xml += `    </Page>\n`;
      xml += `  </PageMacroData>\n`;
    }
    xml += `</Macro>\n`;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    return { blob, filename };
  }

  /**
   * Generates a mini SVG preview markup of a macro.
   */
  public static generateMacroSvgThumbnail(macro: MacroItem, width: number = 80, height: number = 60): string {
    const isWindow = macro.type === 'ema';
    const components = isWindow ? (macro as WindowMacro).components : (macro as PageMacro).page.components;
    const mWidth = isWindow ? (macro as WindowMacro).width : ((macro as PageMacro).page.plotFrame?.width || 1000);
    const mHeight = isWindow ? (macro as WindowMacro).height : ((macro as PageMacro).page.plotFrame?.height || 700);

    const scale = Math.min(
      (width - 16) / Math.max(mWidth, 40),
      (height - 16) / Math.max(mHeight, 40),
      0.8
    );

    let symbolsPreview = '';
    for (const c of components.slice(0, 8)) {
      const sym = macro.symbolLibrary?.find(symbol => symbol.id === c.symbolId) ?? getSymbolForComponent(c);
      if (sym) {
        symbolsPreview += `
          <g transform="translate(${c.x * scale + 8}, ${c.y * scale + 8}) scale(${scale})">
            ${sym.svgContent}
          </g>
        `;
      }
    }

    const strokeColor = isWindow ? '#63b3ed' : '#b794f4';
    const borderColor = isWindow ? '#3182ce' : '#805ad5';

    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="background: rgba(0,0,0,0.25); border-radius: 4px;">
        <rect width="100%" height="100%" fill="none" stroke="${borderColor}" stroke-dasharray="2,2" stroke-width="1"/>
        <g stroke="${strokeColor}" fill="none">
          ${symbolsPreview}
        </g>
      </svg>
    `;
  }

  private static escapeXml(unsafe: string): string {
    return unsafe.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }
}
