// src/model/types.ts
// Data structures following IEC 81346 / DIN EN 60617 / EPLAN Electric P8 standard

export type PageType = 'cover' | 'schematic' | 'terminal_diagram' | 'parts_list' | 'overview';

export interface PinDefinition {
  id: string;
  name: string;
  x: number;
  y: number;
  direction: 'top' | 'bottom' | 'left' | 'right';
  description?: string;
}

export interface SymbolDefinition {
  id: string;
  name: string;
  category: 'supply' | 'protection' | 'relays' | 'controls' | 'terminals' | 'motors' | 'sensors' | 'connections';
  standard: 'DIN EN 60617';
  defaultBmkPrefix: string;
  defaultFunctionText: string;
  width: number;
  height: number;
  pins: PinDefinition[];
  // SVG drawing paths or markup relative to (0, 0)
  svgContent: string;
  description: string;
  isMaster?: boolean; // e.g. Contactor coil
  isContact?: boolean; // e.g. Contactor auxiliary contact
  contactType?: 'NO' | 'NC' | 'Changeover' | 'PowerNO';
  manufacturer?: string;
  articleNumber?: string;
  technicalCharacteristics?: string;
}

export interface TextFormatConfig {
  preset: 'top' | 'bottom' | 'left' | 'right' | 'top_left' | 'top_right' | 'bottom_left' | 'bottom_right' | 'custom';
  offsetX?: number;             // X offset in px relative to default position
  offsetY?: number;             // Y offset in px relative to default position
  alignment?: 'start' | 'middle' | 'end';
  rotation?: 0 | 90 | 180 | 270;
  fontSize?: number;            // in px, e.g. 8, 10, 12
  visible?: boolean;
}

export interface PlacedComponent {
  id: string;
  symbolId: string;
  bmk: string;                  // e.g. "-K1", "-Q1", "-F1"
  deviceTag?: string;           // Gerätebezeichnung z.B. "Hauptschütz K1", "Motorschutzschalter"
  higherLevelFunction?: string; // e.g. "=A1" (Anlage)
  mountingLocation?: string;    // e.g. "+S1" (Schaltschrank / Ort)
  functionText: string;         // e.g. "Hauptantrieb Förderband"
  additionalText?: string;      // Zusatztext / Graviertext
  technicalCharacteristics?: string; // e.g. "4.0kW 400V 8.5A"
  articleNumber?: string;       // e.g. "3RT2026-1BB40"
  manufacturer?: string;        // e.g. "Siemens"
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  pins: {
    [pinId: string]: {
      wireIds?: string[];
      customLabel?: string;
    };
  };
  crossRef?: string;            // Calculated cross-reference, e.g. "/1.4"
  // EPLAN P8 Label positioning & display properties
  bmkPosition?: TextFormatConfig;
  functionTextPosition?: TextFormatConfig;
  technicalDataPosition?: TextFormatConfig;
}

export interface Wire {
  id: string;
  from: {
    componentId: string;
    pinId: string;
  };
  to: {
    componentId: string;
    pinId: string;
  };
  potential: string;            // 'L1', 'L2', 'L3', 'N', 'PE', '+24V', '0V', 'Signal'
  wireNumber?: string;          // e.g. "101", "102"
  crossSection?: string;        // e.g. "1.5mm²"
  color?: string;               // e.g. "BK", "BU", "GNYE", "RD"
  waypoints?: { x: number; y: number }[];
  isAutoconnect?: boolean;
}

export interface TitleBlock {
  projectTitle: string;
  commission: string;           // Kommission / Auftrags-Nr.
  company: string;
  author: string;
  date: string;
  revision: string;
  sheetNumber: string;
  totalSheets: string;
}

export interface Page {
  id: string;
  pageNumber: string;           // e.g. "1", "2", "3"
  pageType: PageType;
  title: string;                // e.g. "Einspeisung & Steuerspannung"
  higherLevel: string;          // =Anlage (z.B. "=H1")
  location: string;             // +Ort (z.B. "+S1")
  components: PlacedComponent[];
  wires: Wire[];
  plotFrame: {
    type: 'DIN_A3_LANDSCAPE';
    width: number;              // in mm, default 420
    height: number;             // in mm, default 297
    columns: number;            // 0..9 (10 paths per page)
    rows: string[];             // A..F
    titleBlock: TitleBlock;
  };
}

export interface Project {
  id: string;
  name: string;
  description: string;
  standard: 'DIN EN 81346-2 / IEC 60617';
  version: string;
  created: string;
  modified: string;
  author: string;
  company: string;
  pages: Page[];
  activePageId: string;
}

export interface CrossReference {
  masterId: string;
  slaveId: string;
  masterPageNumber: string;
  masterPath: number;
  slavePageNumber: string;
  slavePath: number;
  contactType: string;
}
