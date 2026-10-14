// src/model/symbols.ts
// Standard electrical symbols library according to DIN EN 60617 & IEC 60617

import { SymbolDefinition } from './types';

export const SYMBOL_DEFINITIONS: SymbolDefinition[] = [
  // --- 1. SCHÜTZE & RELAIS ---
  {
    id: 'contactor_coil',
    name: 'Schützspule',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Hauptschütz',
    width: 32,
    height: 48,
    isMaster: true,
    pins: [
      { id: 'A1', name: 'A1', x: 16, y: 0, direction: 'top', description: 'Spule Anschluss 1' },
      { id: 'A2', name: 'A2', x: 16, y: 48, direction: 'bottom', description: 'Spule Anschluss 2' }
    ],
    svgContent: `
      <rect x="6" y="14" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="0" x2="16" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="34" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <text x="16" y="27" font-size="9" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="currentColor">K</text>
    `,
    description: 'Relais- oder Schützspule mit Kontaktspiegel'
  },
  {
    id: 'contact_no',
    name: 'Schließer (Hilfskontakt)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Hilfskontakt',
    width: 24,
    height: 48,
    isContact: true,
    contactType: 'NO',
    pins: [
      { id: '13', name: '13', x: 12, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="32" r="1.5" fill="currentColor"/>
    `,
    description: 'Einfacher Hilfskontakt Schließer (13-14)'
  },
  {
    id: 'contact_nc',
    name: 'Öffner (Hilfskontakt)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Verriegelungskontakt',
    width: 24,
    height: 48,
    isContact: true,
    contactType: 'NC',
    pins: [
      { id: '21', name: '21', x: 12, y: 0, direction: 'top' },
      { id: '22', name: '22', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="2" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="30" x2="12" y2="30" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="16" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="32" r="1.5" fill="currentColor"/>
    `,
    description: 'Einfacher Hilfskontakt Öffner (21-22)'
  },
  {
    id: 'contactor_power_3p',
    name: 'Leistungsschaltglieder (3-polig)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Hauptschütz',
    width: 72,
    height: 48,
    isContact: true,
    contactType: 'PowerNO',
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 48, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 22 28 A 3 3 0 0 1 20 33" fill="none" stroke="currentColor" stroke-width="2"/>
      
      <!-- Pol 2 -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="46" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="32" x2="36" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 46 28 A 3 3 0 0 1 44 33" fill="none" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 3 -->
      <line x1="60" y1="0" x2="60" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="16" x2="70" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="32" x2="60" y2="48" stroke="currentColor" stroke-width="2"/>
      <path d="M 70 28 A 3 3 0 0 1 68 33" fill="none" stroke="currentColor" stroke-width="2"/>

      <!-- Mechanische Kopplung -->
      <line x1="18" y1="23" x2="66" y2="23" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: '3-polige Hauptschaltglieder für Motorabzweig'
  },

  // --- 2. SCHUTZEINRICHTUNGEN ---
  {
    id: 'motor_protective_switch',
    name: 'Motorschutzschalter (3-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-Q',
    defaultFunctionText: 'Motorschutzschalter',
    width: 72,
    height: 56,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 56, direction: 'bottom' },
      { id: '3', name: '3', x: 36, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 36, y: 56, direction: 'bottom' },
      { id: '5', name: '5', x: 60, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 60, y: 56, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="17,25 21,21 21,29" fill="currentColor"/>

      <!-- Pol 2 -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="46" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="32" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="41,25 45,21 45,29" fill="currentColor"/>

      <!-- Pol 3 -->
      <line x1="60" y1="0" x2="60" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="16" x2="70" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="60" y1="36" x2="60" y2="56" stroke="currentColor" stroke-width="2"/>
      <rect x="56" y="40" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="65,25 69,21 69,29" fill="currentColor"/>

      <!-- Mechanische Wirklinie -->
      <line x1="18" y1="25" x2="66" y2="25" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Motorschutzschalter mit thermischer und magnetischer Auslösung'
  },
  {
    id: 'fuse_1p',
    name: 'Sicherung (1-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'Steuersicherung',
    width: 24,
    height: 48,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <rect x="6" y="12" width="12" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="12" x2="12" y2="36" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schmelzsicherung 1-polig'
  },

  // --- 3. BEFEHLS- & MELDEGERÄTE ---
  {
    id: 'pushbutton_no',
    name: 'Taster (Schließer)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'Taster EIN',
    width: 24,
    height: 48,
    pins: [
      { id: '13', name: '13', x: 12, y: 0, direction: 'top' },
      { id: '14', name: '14', x: 12, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="22" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="32" x2="12" y2="48" stroke="currentColor" stroke-width="2"/>
      <line x1="18" y1="21" x2="18" y2="14" stroke="currentColor" stroke-width="1.5"/>
      <line x1="14" y1="14" x2="22" y2="14" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drucktaster Schließer mit Tastbetätigung'
  },
  {
    id: 'pushbutton_emergency_stop',
    name: 'Not-Halt-Taster (Öffner)',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-S',
    defaultFunctionText: 'NOT-HALT',
    width: 32,
    height: 48,
    pins: [
      { id: '11', name: '11', x: 16, y: 0, direction: 'top' },
      { id: '12', name: '12', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="16" x2="6" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="30" x2="16" y2="30" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="32" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
      <!-- Pilzkopf -->
      <line x1="11" y1="21" x2="11" y2="12" stroke="currentColor" stroke-width="1.5"/>
      <path d="M 5 12 Q 11 6 17 12" fill="none" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Not-Halt Taster mit Rastung und Pilzkopf'
  },
  {
    id: 'pilot_lamp',
    name: 'Meldeleuchte',
    category: 'controls',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-P',
    defaultFunctionText: 'Betriebsanzeige',
    width: 32,
    height: 48,
    pins: [
      { id: 'X1', name: 'X1', x: 16, y: 0, direction: 'top' },
      { id: 'X2', name: 'X2', x: 16, y: 48, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="16" y1="0" x2="16" y2="12" stroke="currentColor" stroke-width="2"/>
      <circle cx="16" cy="24" r="12" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="8" y1="16" x2="24" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="16" x2="8" y2="32" stroke="currentColor" stroke-width="2"/>
      <line x1="16" y1="36" x2="16" y2="48" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Optischer Signalgeber / Meldeleuchte'
  },

  // --- 4. MOTOREN & AKTOREN ---
  {
    id: 'motor_3phase',
    name: 'Drehstrommotor (3~)',
    category: 'motors',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-M',
    defaultFunctionText: 'Antriebsmotor',
    width: 72,
    height: 72,
    pins: [
      { id: 'U1', name: 'U1', x: 18, y: 0, direction: 'top' },
      { id: 'V1', name: 'V1', x: 36, y: 0, direction: 'top' },
      { id: 'W1', name: 'W1', x: 54, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 68, y: 36, direction: 'right' }
    ],
    svgContent: `
      <line x1="18" y1="0" x2="18" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="0" x2="36" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="54" y1="0" x2="54" y2="12" stroke="currentColor" stroke-width="2"/>
      <circle cx="36" cy="38" r="26" fill="none" stroke="currentColor" stroke-width="2"/>
      <text x="36" y="34" font-size="14" text-anchor="middle" font-family="sans-serif" font-weight="bold" fill="currentColor">M</text>
      <text x="36" y="50" font-size="11" text-anchor="middle" font-family="sans-serif" fill="currentColor">3 ~</text>
      <line x1="62" y1="36" x2="68" y2="36" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Drehstrom-Asynchronmotor mit PE-Anschluss'
  },

  // --- 5. KLEMMEN & VERBINDER ---
  {
    id: 'terminal_single',
    name: 'Reihenklemme',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'Reihenklemme',
    width: 20,
    height: 40,
    pins: [
      { id: '1', name: '1', x: 10, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 10, y: 40, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="10" y1="0" x2="10" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="10" cy="20" r="4" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="10" y1="24" x2="10" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Durchgangsklemme für Klemmenleiste'
  },
  {
    id: 'terminal_pe',
    name: 'Schutzleiter-Klemme (PE)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-X',
    defaultFunctionText: 'PE-Klemme',
    width: 24,
    height: 40,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 40, direction: 'bottom' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <circle cx="12" cy="20" r="4" fill="currentColor"/>
      <line x1="12" y1="24" x2="12" y2="40" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzleiterklemme mit Massekontakt'
  },
  {
    id: 'ground_pe',
    name: 'Erde / Schutzleiter (PE)',
    category: 'terminals',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'PE',
    defaultFunctionText: 'Masse/Erde',
    width: 24,
    height: 28,
    pins: [
      { id: 'PE', name: 'PE', x: 12, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="9" y1="24" x2="15" y2="24" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Schutzerde / Masseanschluss'
  },

  // --- 6. SPANNUNGSVERSORGUNG & TRAFO ---
  {
    id: 'power_supply_dc',
    name: 'Schaltnetzteil 24V DC',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-G',
    defaultFunctionText: 'Steuerspannung 24VDC',
    width: 56,
    height: 64,
    pins: [
      { id: 'L', name: 'L', x: 14, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 28, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 42, y: 0, direction: 'top' },
      { id: '+', name: '+', x: 18, y: 64, direction: 'bottom' },
      { id: '-', name: '-', x: 38, y: 64, direction: 'bottom' }
    ],
    svgContent: `
      <rect x="6" y="10" width="44" height="44" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="6" y1="54" x2="50" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <text x="16" y="26" font-size="9" text-anchor="middle" fill="currentColor">~</text>
      <text x="40" y="44" font-size="9" text-anchor="middle" fill="currentColor">=</text>
      <!-- Eingänge oben -->
      <line x1="14" y1="0" x2="14" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="28" y1="0" x2="28" y2="10" stroke="currentColor" stroke-width="2"/>
      <line x1="42" y1="0" x2="42" y2="10" stroke="currentColor" stroke-width="2"/>
      <!-- Ausgänge unten -->
      <line x1="18" y1="54" x2="18" y2="64" stroke="currentColor" stroke-width="2"/>
      <line x1="38" y1="54" x2="38" y2="64" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'AC/DC Schaltnetzteil 230V AC zu 24V DC'
  },
  {
    id: 'potential_arrow',
    name: 'Abbruchstelle (Potenzialpfeil)',
    category: 'supply',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: 'PF',
    defaultFunctionText: 'L1',
    width: 24,
    height: 24,
    pins: [
      { id: 'IN', name: 'IN', x: 12, y: 0, direction: 'top' }
    ],
    svgContent: `
      <line x1="12" y1="0" x2="12" y2="12" stroke="currentColor" stroke-width="2"/>
      <polygon points="12,22 6,12 18,12" fill="currentColor"/>
    `,
    description: 'Abbruchstelle für Seitenquerverweis (Potenzialweiterführung)'
  },

  // --- 7. EXTERNE EPLAN HERSTELLER-KOMPONENTEN ---
  {
    id: 'rcd_4p',
    name: 'FI-Schutzschalter (4-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI-Schutzschalter 40A/30mA',
    manufacturer: 'Hager',
    articleNumber: 'CDS440D',
    technicalCharacteristics: '4-polig 40A / 30mA Typ A',
    width: 84,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: '3', name: '3', x: 32, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 32, y: 60, direction: 'bottom' },
      { id: '5', name: '5', x: 52, y: 0, direction: 'top' },
      { id: '6', name: '6', x: 52, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 72, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 72, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 (L1) -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 2 (L2) -->
      <line x1="32" y1="0" x2="32" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="16" x2="40" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 3 (L3) -->
      <line x1="52" y1="0" x2="52" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="16" x2="60" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="36" x2="52" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 4 (N) -->
      <line x1="72" y1="0" x2="72" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="72" y1="16" x2="80" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="72" y1="36" x2="72" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Summenstromwandler (Ringkern-Oval) -->
      <ellipse cx="42" cy="48" rx="36" ry="7" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      
      <!-- Auslöserelais & Wirklinie -->
      <rect x="36" y="22" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="42" y1="32" x2="42" y2="41" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="26" x2="76" y2="26" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      
      <!-- Prüftaste T -->
      <text x="76" y="48" font-size="8" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'Hager CDS440D Fehlerstromschutzschalter 4-polig 40A / 30mA Typ A'
  },
  {
    id: 'rcd_2p',
    name: 'FI-Schutzschalter (2-polig)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI-Schutzschalter 25A/30mA',
    manufacturer: 'ABB',
    articleNumber: 'FH202-25/0.03',
    technicalCharacteristics: '2-polig 25A / 30mA Typ A',
    width: 48,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 36, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 36, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 (L) -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Pol 2 (N) -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Wandler & Auslöser -->
      <ellipse cx="24" cy="48" rx="20" ry="6" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      <rect x="18" y="22" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="32" x2="24" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="16" y1="26" x2="40" y2="26" stroke="currentColor" stroke-width="1" stroke-dasharray="2,2"/>
      <text x="40" y="48" font-size="8" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'ABB FH202 2-poliger Fehlerstromschutzschalter 25A / 30mA'
  },
  {
    id: 'rcbo_1p_n',
    name: 'FI/LS-Kombischalter (1P+N)',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'FI/LS B16/30mA',
    manufacturer: 'Siemens',
    articleNumber: '5SV1316-6KK16',
    technicalCharacteristics: '1P+N B16A / 30mA 6kA (1 TE)',
    width: 48,
    height: 60,
    pins: [
      { id: '1', name: '1', x: 12, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 12, y: 60, direction: 'bottom' },
      { id: 'N_in', name: 'N', x: 36, y: 0, direction: 'top' },
      { id: 'N_out', name: 'N', x: 36, y: 60, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Pol 1 mit thermischer & magnetischer Auslösung -->
      <line x1="12" y1="0" x2="12" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="16" x2="20" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="36" x2="12" y2="60" stroke="currentColor" stroke-width="2"/>
      <rect x="8" y="42" width="8" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <polygon points="16,25 20,21 20,29" fill="currentColor"/>

      <!-- Pol 2 (N) -->
      <line x1="36" y1="0" x2="36" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="16" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="36" x2="36" y2="60" stroke="currentColor" stroke-width="2"/>

      <!-- Differenzstromwandler -->
      <ellipse cx="24" cy="50" rx="18" ry="5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2,2"/>
      <text x="40" y="48" font-size="7" font-weight="bold" fill="currentColor">T</text>
    `,
    description: 'Siemens 5SV1 FI/LS-Schalter B16A / 30mA in 1 Teilungseinheit'
  },
  {
    id: 'impulse_relay_1no',
    name: 'Stromstoßrelais (1 Schließer)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Stromstoßschalter Licht',
    manufacturer: 'Finder',
    articleNumber: '20.21.8.230.4000',
    technicalCharacteristics: '230V AC 16A 1 Schließer',
    width: 48,
    height: 52,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 52, direction: 'bottom' },
      { id: '1', name: '1', x: 36, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 36, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Spulenkörper mit Stromstoß-Schrittsymbol -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="52" stroke="currentColor" stroke-width="2"/>
      <!-- Treppen-/Schrittsymbol im Relais -->
      <path d="M 6 30 L 10 30 L 10 24 L 14 24 L 14 18 L 18 18" fill="none" stroke="currentColor" stroke-width="1.5"/>

      <!-- Schaltglied (1-2) -->
      <line x1="36" y1="0" x2="36" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="18" x2="44" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="36" y1="34" x2="36" y2="52" stroke="currentColor" stroke-width="2"/>
      
      <!-- Mechanische Kopplung -->
      <line x1="20" y1="26" x2="40" y2="26" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Finder Serie 20 / Hager EPN510 Stromstoßschalter 230V AC 16A'
  },
  {
    id: 'impulse_relay_2no',
    name: 'Stromstoßrelais (2 Schließer)',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Stromstoßschalter 2-Kanal',
    manufacturer: 'Finder',
    articleNumber: '20.22.8.230.4000',
    technicalCharacteristics: '230V AC 16A 2 Schließer (Serienschaltung)',
    width: 64,
    height: 52,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 52, direction: 'bottom' },
      { id: '1', name: '1', x: 32, y: 0, direction: 'top' },
      { id: '2', name: '2', x: 32, y: 52, direction: 'bottom' },
      { id: '3', name: '3', x: 52, y: 0, direction: 'top' },
      { id: '4', name: '4', x: 52, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Spulenkörper -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="52" stroke="currentColor" stroke-width="2"/>
      <path d="M 6 30 L 10 30 L 10 24 L 14 24 L 14 18 L 18 18" fill="none" stroke="currentColor" stroke-width="1.5"/>

      <!-- Kontakt 1 (1-2) -->
      <line x1="32" y1="0" x2="32" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="18" x2="40" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="34" x2="32" y2="52" stroke="currentColor" stroke-width="2"/>

      <!-- Kontakt 2 (3-4) -->
      <line x1="52" y1="0" x2="52" y2="18" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="18" x2="60" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="52" y1="34" x2="52" y2="52" stroke="currentColor" stroke-width="2"/>

      <!-- Mechanische Koppelachse -->
      <line x1="20" y1="26" x2="56" y2="26" stroke="currentColor" stroke-width="1.5" stroke-dasharray="3,2"/>
    `,
    description: 'Finder Serie 20 / Eltako S12-200 Stromstoßschalter mit 2 Schließern'
  },
  {
    id: 'timer_relay_multifunction',
    name: 'Multifunktions-Zeitrelais',
    category: 'relays',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-K',
    defaultFunctionText: 'Zeitrelais Ansprechverzögert',
    manufacturer: 'Eaton',
    articleNumber: 'ETR4-69-A',
    technicalCharacteristics: '24-240V AC/DC 1 Wechsler',
    width: 48,
    height: 56,
    pins: [
      { id: 'A1', name: 'A1', x: 12, y: 0, direction: 'top' },
      { id: 'A2', name: 'A2', x: 12, y: 56, direction: 'bottom' },
      { id: 'B1', name: 'B1', x: 24, y: 0, direction: 'top' },
      { id: '15', name: '15', x: 38, y: 0, direction: 'top' },
      { id: '16', name: '16', x: 32, y: 56, direction: 'bottom' },
      { id: '18', name: '18', x: 44, y: 56, direction: 'bottom' }
    ],
    svgContent: `
      <!-- Zeitrelais-Spule mit gekreuztem Feld -->
      <rect x="4" y="14" width="16" height="24" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="4" y1="14" x2="12" y2="38" stroke="currentColor" stroke-width="1.5"/>
      <line x1="12" y1="0" x2="12" y2="14" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="38" x2="12" y2="56" stroke="currentColor" stroke-width="2"/>
      <line x1="24" y1="0" x2="24" y2="20" stroke="currentColor" stroke-width="1.5"/>

      <!-- Wechslerkontakt (15, 16, 18) mit Verzögerungssymbol -->
      <line x1="38" y1="0" x2="38" y2="16" stroke="currentColor" stroke-width="2"/>
      <line x1="38" y1="16" x2="32" y2="34" stroke="currentColor" stroke-width="2"/>
      <line x1="32" y1="36" x2="32" y2="56" stroke="currentColor" stroke-width="2"/>
      <line x1="44" y1="36" x2="44" y2="56" stroke="currentColor" stroke-width="2"/>
      <!-- Fallschirm / Verzögerungskappe -->
      <path d="M 33 22 A 4 4 0 0 1 39 22" fill="none" stroke="currentColor" stroke-width="1.5"/>
    `,
    description: 'Eaton ETR4-69-A / Finder 80.01 Multifunktionszeitrelais (Ansprech- & Rückfallverzögert)'
  },
  {
    id: 'surge_arrester_spd',
    name: 'Überspannungsableiter Typ 2',
    category: 'protection',
    standard: 'DIN EN 60617',
    defaultBmkPrefix: '-F',
    defaultFunctionText: 'Überspannungsschutz Typ 2',
    manufacturer: 'Dehn',
    articleNumber: 'DEHNguard DG M TNS 275',
    technicalCharacteristics: 'Typ 2 TNS-Netz 4-polig 20kA',
    width: 64,
    height: 52,
    pins: [
      { id: 'L1', name: 'L1', x: 10, y: 0, direction: 'top' },
      { id: 'L2', name: 'L2', x: 24, y: 0, direction: 'top' },
      { id: 'L3', name: 'L3', x: 38, y: 0, direction: 'top' },
      { id: 'N', name: 'N', x: 52, y: 0, direction: 'top' },
      { id: 'PE', name: 'PE', x: 31, y: 52, direction: 'bottom' }
    ],
    svgContent: `
      <!-- 4 Varistoren nebeneinander -->
      <rect x="6" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="4" y1="32" x2="16" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="0" x2="10" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="20" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="18" y1="32" x2="30" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="0" x2="24" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="34" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="32" y1="32" x2="44" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="38" y1="0" x2="38" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <rect x="48" y="16" width="8" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="46" y1="32" x2="58" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="52" y1="0" x2="52" y2="16" stroke="currentColor" stroke-width="1.5"/>

      <!-- Sammelschiene unten auf PE -->
      <line x1="10" y1="34" x2="10" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="24" y1="34" x2="24" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="38" y1="34" x2="38" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="52" y1="34" x2="52" y2="42" stroke="currentColor" stroke-width="1.5"/>
      <line x1="10" y1="42" x2="52" y2="42" stroke="currentColor" stroke-width="2"/>
      <line x1="31" y1="42" x2="31" y2="52" stroke="currentColor" stroke-width="2"/>
    `,
    description: 'Dehn DEHNguard M TNS 275 Überspannungsableiter Typ 2'
  }
];

export function getSymbolById(id: string): SymbolDefinition | undefined {
  return SYMBOL_DEFINITIONS.find(s => s.id === id);
}

