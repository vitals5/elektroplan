// src/ui/App.ts
// Main application controller for Elektroplan (EPLAN Electric P8 compatible CAD Suite)

import { Project, Page, PlacedComponent, Wire } from '../model/types';
import { SYMBOL_DEFINITIONS, getSymbolById } from '../model/symbols';
import { CadCanvas } from '../editor/CadCanvas';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { EplanPackageHandler, EplanInspectionResult } from '../eplan/EplanPackageHandler';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { PartsListGenerator } from '../reports/PartsList';
import { PdfExportDialog } from './PdfExportDialog';

export class App {
  private project!: Project;
  private canvas!: CadCanvas;
  private selectedComponent: PlacedComponent | null = null;
  private selectedWire: Wire | null = null;
  private activeLeftTab: 'pages' | 'symbols' | 'terminals' | 'bom' = 'pages';
  private activeRightTab: 'properties' | 'eplan' = 'properties';
  private symbolCategoryFilter: string = 'all';

  constructor() {
    this.initDefaultProject();
    this.renderLayout();
    this.initCanvas();
    this.updateUI();
  }

  private initDefaultProject(): void {
    const dummyFile = new File([''], 'Projekt_Einspeisung.zw1');
    // Generates the initial project with Cover, 400V Motor circuit, and 24V DC control circuit
    const res = (EplanPackageHandler as any).createProjectFromEplanMetadata('Anlagensteuerung_P8', '', []);
    this.project = res;
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
  }

  private renderLayout(): void {
    const root = document.getElementById('app');
    if (!root) return;

    root.innerHTML = `
      <!-- Header Toolbar -->
      <header class="app-header">
        <div class="brand-section">
          <div class="brand-logo">
            ⚡ Elektroplan <span class="badge-eplan">EPLAN P8</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); border-left: 1px solid var(--border-color); padding-left: 10px;" id="headerProjectName">
            ${this.project.name}
          </span>
        </div>

        <div class="toolbar">
          <button class="btn" id="btnNewProject" title="Neues Projekt anlegen">📄 Neu</button>
          <label class="btn" title="EPLAN .zw1, .edz, .xml oder .json öffnen" style="margin: 0;">
            📂 Öffnen
            <input type="file" id="fileInput" accept=".zw1,.edz,.xml,.json,.elk" style="display: none;">
          </label>
          <button class="btn" id="btnSaveJson" title="Projekt speichern">💾 Speichern</button>
          
          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 4px;"></div>

          <button class="btn btn-primary" id="btnExportPdf" title="Intelligenter EPLAN P8 PDF-Export mit interaktiven Querverweisen">📑 PDF Export</button>
          <button class="btn" id="btnExportZw1" title="Als EPLAN .zw1 Backup exportieren">📦 EPLAN .zw1</button>
          <button class="btn" id="btnExportXml" title="Als EPLAN XML exportieren">📋 EPLAN XML</button>
          <button class="btn" id="btnPrintSvg" title="Drucken / Als SVG speichern">🖨️ Drucken / SVG</button>

          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 4px;"></div>

          <button class="btn active" id="btnToolSelect" title="Auswahlwerkzeug">👆 Auswählen</button>
          <button class="btn" id="btnToolWire" title="Verbindungslinie zeichnen">🔌 Verdrahten</button>
          <button class="btn" id="btnToolRotate" title="Ausgewähltes Bauteil um 90° drehen (R)">🔄 Drehen</button>
          <button class="btn" id="btnToolDelete" title="Ausgewähltes Element löschen (Entf)">🗑️ Löschen</button>

          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 4px;"></div>

          <button class="btn" id="btnZoomIn" title="Vergrößern">➕</button>
          <button class="btn" id="btnZoomOut" title="Verkleinern">➖</button>
          <button class="btn" id="btnZoomReset" title="100% Zoom">1:1</button>
          <button class="btn active" id="btnGridSnap" title="Rasterfang ein/aus">📐 Rasterfang</button>
        </div>
      </header>

      <!-- Main Workspace -->
      <div class="main-container">
        <!-- Left Sidebar -->
        <aside class="sidebar">
          <div class="tab-nav">
            <button class="tab-btn active" data-tab="pages">Seiten</button>
            <button class="tab-btn" data-tab="symbols">Symbole</button>
            <button class="tab-btn" data-tab="terminals">Klemmenplan</button>
            <button class="tab-btn" data-tab="bom">Stückliste</button>
          </div>
          <div class="tab-content" id="leftTabContent"></div>
        </aside>

        <!-- Center CAD Canvas -->
        <main class="canvas-wrapper" id="canvasContainer"></main>

        <!-- Right Sidebar -->
        <aside class="sidebar right">
          <div class="tab-nav">
            <button class="tab-btn active" data-right-tab="properties">Eigenschaften</button>
            <button class="tab-btn" data-right-tab="eplan">EPLAN / REA Inspektor</button>
          </div>
          <div class="tab-content" id="rightTabContent"></div>
        </aside>
      </div>

      <!-- Bottom Status Bar -->
      <footer class="status-bar">
        <div id="statusLeft">Bereit | DIN EN 81346-2 / IEC 60617</div>
        <div id="statusRight">Seite 1 / 3 | Raster: 10px (4mm) | Koordinaten: X: 0, Y: 0</div>
      </footer>
    `;

    this.bindHeaderEvents();
  }

  private initCanvas(): void {
    const container = document.getElementById('canvasContainer');
    if (!container) return;

    this.canvas = new CadCanvas(container, this.project, {
      onSelectComponent: (comp) => {
        this.selectedComponent = comp;
        this.selectedWire = null;
        this.renderRightTab();
      },
      onSelectWire: (wire) => {
        this.selectedWire = wire;
        this.selectedComponent = null;
        this.renderRightTab();
      },
      onProjectModified: () => {
        this.updateUI();
      }
    });

    // Make sure initial page is loaded
    this.canvas.setPage(this.project.activePageId || this.project.pages[0].id);
  }

  private bindHeaderEvents(): void {
    // Left tabs
    document.querySelectorAll('[data-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.activeLeftTab = target.dataset.tab as any;
        document.querySelectorAll('[data-tab]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.renderLeftTab();
      });
    });

    // Right tabs
    document.querySelectorAll('[data-right-tab]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget as HTMLElement;
        this.activeRightTab = target.dataset.rightTab as any;
        document.querySelectorAll('[data-right-tab]').forEach(b => b.classList.remove('active'));
        target.classList.add('active');
        this.renderRightTab();
      });
    });

    // Tools
    document.getElementById('btnToolSelect')?.addEventListener('click', () => {
      this.canvas.setMode('select');
      this.updateToolButtons('btnToolSelect');
    });

    document.getElementById('btnToolWire')?.addEventListener('click', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });

    document.getElementById('btnToolRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
    });

    document.getElementById('btnToolDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });

    // Zoom
    document.getElementById('btnZoomIn')?.addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('btnZoomOut')?.addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('btnZoomReset')?.addEventListener('click', () => this.canvas.resetZoom());

    // Grid snap
    const btnGrid = document.getElementById('btnGridSnap');
    btnGrid?.addEventListener('click', () => {
      this.canvas.gridSnap = !this.canvas.gridSnap;
      btnGrid.classList.toggle('active', this.canvas.gridSnap);
    });

    // File Open
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.handleFileOpen(file);
      }
    });

    // New Project
    document.getElementById('btnNewProject')?.addEventListener('click', () => {
      if (confirm('Möchten Sie ein neues leeres Projekt anlegen? Nicht gespeicherte Änderungen gehen verloren.')) {
        this.createNewProject();
      }
    });

    // Save JSON
    document.getElementById('btnSaveJson')?.addEventListener('click', () => {
      this.saveProjectJson();
    });

    // Export EPLAN .zw1
    document.getElementById('btnExportZw1')?.addEventListener('click', async () => {
      await this.exportZw1();
    });

    // Export EPLAN XML
    document.getElementById('btnExportXml')?.addEventListener('click', () => {
      this.exportXml();
    });

    // Smart EPLAN PDF Export
    document.getElementById('btnExportPdf')?.addEventListener('click', () => {
      new PdfExportDialog(this.project, this.project.activePageId).show();
    });

    // Print / SVG
    document.getElementById('btnPrintSvg')?.addEventListener('click', () => {
      window.print();
    });

    // Native Electron menu integration
    if ((window as any).electronAPI) {
      const api = (window as any).electronAPI;
      api.onMenuAction('menu:new', () => this.createNewProject());
      api.onMenuAction('menu:save', () => this.saveProjectJson());
      api.onMenuAction('menu:exportZw1', () => this.exportZw1());
      api.onMenuAction('menu:exportXml', () => this.exportXml());
      api.onMenuAction('menu:exportPdf', () => new PdfExportDialog(this.project, this.project.activePageId).show());
      api.onMenuAction('menu:rotate', () => this.canvas.rotateSelected());
      api.onMenuAction('menu:fileOpened', (fileInfo: { path: string; name: string; data: number[] }) => {
        const uint8 = new Uint8Array(fileInfo.data);
        const file = new File([uint8], fileInfo.name);
        this.handleFileOpen(file);
      });
    }
  }

  private updateToolButtons(activeId: string): void {
    ['btnToolSelect', 'btnToolWire'].forEach(id => {
      document.getElementById(id)?.classList.toggle('active', id === activeId);
    });
  }

  private updateUI(): void {
    const projNameEl = document.getElementById('headerProjectName');
    if (projNameEl) projNameEl.textContent = this.project.name;

    const statusRight = document.getElementById('statusRight');
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (statusRight && activePage) {
      statusRight.textContent = `Seite ${activePage.pageNumber} (${activePage.title}) | Bauteile: ${activePage.components.length} | Leitungen: ${activePage.wires.length}`;
    }

    this.renderLeftTab();
    this.renderRightTab();
  }

  private renderLeftTab(): void {
    const container = document.getElementById('leftTabContent');
    if (!container) return;

    if (this.activeLeftTab === 'pages') {
      this.renderPagesTab(container);
    } else if (this.activeLeftTab === 'symbols') {
      this.renderSymbolsTab(container);
    } else if (this.activeLeftTab === 'terminals') {
      this.renderTerminalsTab(container);
    } else if (this.activeLeftTab === 'bom') {
      this.renderBomTab(container);
    }
  }

  private renderPagesTab(container: HTMLElement): void {
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">Projektseiten (DIN EN 81346)</span>
        <button class="btn btn-primary" id="btnAddPage" style="padding: 2px 8px; font-size: 11px;">+ Seite</button>
      </div>
      <div class="page-tree">
    `;

    for (const page of this.project.pages) {
      const isActive = page.id === this.project.activePageId;
      const icon = page.pageType === 'cover' ? '📄' : (page.pageType === 'schematic' ? '⚡' : '📋');
      html += `
        <div class="tree-node ${isActive ? 'active' : ''}" data-page-id="${page.id}">
          <span>${icon}</span>
          <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <div style="font-weight: 500;">Blatt ${page.pageNumber}: ${page.title}</div>
            <div style="font-size: 10px; color: ${isActive ? '#e2e8f0' : 'var(--text-muted)'};">${page.higherLevel}${page.location}</div>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Events
    container.querySelectorAll('[data-page-id]').forEach(node => {
      node.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.pageId!;
        this.canvas.setPage(id);
        this.updateUI();
      });
    });

    document.getElementById('btnAddPage')?.addEventListener('click', () => {
      this.addNewPage();
    });
  }

  private addNewPage(): void {
    const num = (this.project.pages.length).toString();
    const newPage: Page = {
      id: 'p_' + Math.random().toString(36).substring(2, 9),
      pageNumber: num,
      pageType: 'schematic',
      title: `Schaltplan Seite ${num}`,
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
          projectTitle: this.project.name,
          commission: 'KOM-2026',
          company: this.project.company,
          author: this.project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: num,
          totalSheets: (this.project.pages.length + 1).toString()
        }
      }
    };

    this.project.pages.push(newPage);
    this.canvas.setPage(newPage.id);
    this.updateUI();
  }

  private renderSymbolsTab(container: HTMLElement): void {
    let categoriesHtml = `
      <div style="margin-bottom: 8px;">
        <select class="form-input" id="symbolCategorySelect">
          <option value="all" ${this.symbolCategoryFilter === 'all' ? 'selected' : ''}>Alle Kategorien</option>
          <option value="relays" ${this.symbolCategoryFilter === 'relays' ? 'selected' : ''}>Schütze & Relais</option>
          <option value="protection" ${this.symbolCategoryFilter === 'protection' ? 'selected' : ''}>Schutzeinrichtungen</option>
          <option value="controls" ${this.symbolCategoryFilter === 'controls' ? 'selected' : ''}>Befehls- & Meldegeräte</option>
          <option value="motors" ${this.symbolCategoryFilter === 'motors' ? 'selected' : ''}>Motoren & Aktoren</option>
          <option value="terminals" ${this.symbolCategoryFilter === 'terminals' ? 'selected' : ''}>Klemmen & Verbinder</option>
          <option value="supply" ${this.symbolCategoryFilter === 'supply' ? 'selected' : ''}>Spannungsversorgung</option>
        </select>
      </div>
      <div class="symbol-grid">
    `;

    const filtered = this.symbolCategoryFilter === 'all'
      ? SYMBOL_DEFINITIONS
      : SYMBOL_DEFINITIONS.filter(s => s.category === this.symbolCategoryFilter);

    for (const sym of filtered) {
      const isSelected = this.canvas.activeSymbolToPlace === sym.id && this.canvas.mode === 'place_symbol';
      categoriesHtml += `
        <div class="symbol-card ${isSelected ? 'selected' : ''}" data-symbol-id="${sym.id}" title="${sym.description}">
          <div class="symbol-preview-svg">
            <svg width="40" height="40" viewBox="0 0 ${sym.width} ${sym.height}">
              <g color="#e2e8f0">${sym.svgContent}</g>
            </svg>
          </div>
          <div class="symbol-title">${sym.name}</div>
          <div class="symbol-bmk">BMK: ${sym.defaultBmkPrefix}</div>
        </div>
      `;
    }

    categoriesHtml += `</div>`;
    container.innerHTML = categoriesHtml;

    // Events
    document.getElementById('symbolCategorySelect')?.addEventListener('change', (e) => {
      this.symbolCategoryFilter = (e.target as HTMLSelectElement).value;
      this.renderSymbolsTab(container);
    });

    container.querySelectorAll('[data-symbol-id]').forEach(card => {
      card.addEventListener('click', (e) => {
        const symId = (e.currentTarget as HTMLElement).dataset.symbolId!;
        this.canvas.setSymbolToPlace(symId);
        this.renderSymbolsTab(container);
      });
    });
  }

  private renderTerminalsTab(container: HTMLElement): void {
    const strips = TerminalDiagramGenerator.generateTerminalReport(this.project);

    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Klemmenplan-Auswertung (DIN EN 81346)
      </div>
    `;

    if (strips.size === 0) {
      html += `<div style="font-size: 11px; color: var(--text-muted); padding: 12px 0;">Keine Klemmenleisten im Projekt platziert.</div>`;
    } else {
      for (const [stripName, entries] of strips.entries()) {
        html += `
          <div style="margin-bottom: 16px;">
            <div style="font-size: 12px; font-weight: bold; color: var(--warning); margin-bottom: 4px;">Klemmenleiste: ${stripName}</div>
            <table class="report-table">
              <thead>
                <tr>
                  <th>Klemme</th>
                  <th>Intern</th>
                  <th>Extern</th>
                  <th>Funktion</th>
                </tr>
              </thead>
              <tbody>
        `;
        for (const entry of entries) {
          html += `
            <tr>
              <td style="font-family: monospace; font-weight: bold; color: var(--accent-bright);">${entry.terminalNumber}</td>
              <td style="font-family: monospace;">${entry.internalTarget}</td>
              <td style="font-family: monospace;">${entry.externalTarget}</td>
              <td>${entry.functionText}</td>
            </tr>
          `;
        }
        html += `</tbody></table></div>`;
      }
    }

    container.innerHTML = html;
  }

  private renderBomTab(container: HTMLElement): void {
    const parts = PartsListGenerator.generatePartsList(this.project);

    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Stückliste / Artikelliste (BOM)
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th>Menge</th>
            <th>Artikelnummer</th>
            <th>Beschreibung</th>
            <th>Hersteller</th>
            <th>BMK-Liste</th>
          </tr>
        </thead>
        <tbody>
    `;

    for (const part of parts) {
      html += `
        <tr>
          <td style="font-weight: bold; color: var(--warning);">${part.quantity}x</td>
          <td style="font-family: monospace; color: var(--accent-bright);">${part.articleNumber}</td>
          <td>${part.description}</td>
          <td>${part.manufacturer}</td>
          <td style="font-family: monospace; color: #a0aec0;">${part.bmkList.join(', ')}</td>
        </tr>
      `;
    }

    html += `</tbody></table>`;
    container.innerHTML = html;
  }

  private renderRightTab(): void {
    const container = document.getElementById('rightTabContent');
    if (!container) return;

    if (this.activeRightTab === 'properties') {
      this.renderPropertiesTab(container);
    } else {
      this.renderEplanInspectorTab(container);
    }
  }

  private renderPropertiesTab(container: HTMLElement): void {
    if (this.selectedComponent) {
      const comp = this.selectedComponent;
      const sym = getSymbolById(comp.symbolId);

      container.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          Bauteileigenschaften (${sym?.name || comp.symbolId})
        </div>

        <div class="form-group">
          <label class="form-label">Betriebsmittelkennzeichen (BMK)</label>
          <input class="form-input" id="propBmk" value="${comp.bmk}">
        </div>

        <div class="form-group">
          <label class="form-label">Funktionstext</label>
          <input class="form-input" id="propFunctionText" value="${comp.functionText || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Technische Kennwerte</label>
          <input class="form-input" id="propTechnical" value="${comp.technicalCharacteristics || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Artikelnummer</label>
          <input class="form-input" id="propArticle" value="${comp.articleNumber || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Hersteller</label>
          <input class="form-input" id="propManufacturer" value="${comp.manufacturer || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Anlagen- / Ortskennzeichen</label>
          <div style="display: flex; gap: 6px;">
            <input class="form-input" id="propHigherLevel" placeholder="=Anlage" value="${comp.higherLevelFunction || ''}">
            <input class="form-input" id="propLocation" placeholder="+Ort" value="${comp.mountingLocation || ''}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">EPLAN Querverweis / Kontaktspiegel</label>
          <div style="padding: 8px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace; font-size: 11px; color: var(--warning);">
            ${comp.crossRef || 'Keine Querverweise aktiv'}
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 16px;">
          <button class="btn" id="btnPropRotate" style="flex: 1;">🔄 90° Drehen</button>
          <button class="btn" id="btnPropDelete" style="flex: 1; border-color: var(--danger); color: var(--danger);">🗑️ Löschen</button>
        </div>
      `;

      // Form bindings
      document.getElementById('propBmk')?.addEventListener('input', (e) => {
        comp.bmk = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propFunctionText')?.addEventListener('input', (e) => {
        comp.functionText = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propTechnical')?.addEventListener('input', (e) => {
        comp.technicalCharacteristics = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propArticle')?.addEventListener('input', (e) => {
        comp.articleNumber = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propManufacturer')?.addEventListener('input', (e) => {
        comp.manufacturer = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propHigherLevel')?.addEventListener('input', (e) => {
        comp.higherLevelFunction = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propLocation')?.addEventListener('input', (e) => {
        comp.mountingLocation = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });

      document.getElementById('btnPropRotate')?.addEventListener('click', () => this.canvas.rotateSelected());
      document.getElementById('btnPropDelete')?.addEventListener('click', () => this.canvas.deleteSelected());

    } else if (this.selectedWire) {
      const wire = this.selectedWire;

      container.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          Verbindungseigenschaften (Leitung)
        </div>

        <div class="form-group">
          <label class="form-label">Potenzialbezeichnung</label>
          <input class="form-input" id="propWirePotential" value="${wire.potential}">
        </div>

        <div class="form-group">
          <label class="form-label">Querschnitt</label>
          <input class="form-input" id="propWireSection" value="${wire.crossSection || '1.5mm²'}">
        </div>

        <div class="form-group">
          <label class="form-label">Aderfarbe</label>
          <select class="form-input" id="propWireColor">
            <option value="BK" ${wire.color === 'BK' ? 'selected' : ''}>BK (Schwarz - Phase)</option>
            <option value="BU" ${wire.color === 'BU' ? 'selected' : ''}>BU (Hellblau - Neutralleiter)</option>
            <option value="GNYE" ${wire.color === 'GNYE' ? 'selected' : ''}>GNYE (Grün/Gelb - Schutzleiter PE)</option>
            <option value="RD" ${wire.color === 'RD' ? 'selected' : ''}>RD (Rot - Steuerstrom AC)</option>
            <option value="DBU" ${wire.color === 'DBU' ? 'selected' : ''}>DBU (Dunkelblau - Steuerspannung DC)</option>
          </select>
        </div>

        <button class="btn" id="btnDeleteWire" style="width: 100%; margin-top: 16px; border-color: var(--danger); color: var(--danger);">
          🗑️ Leitung löschen
        </button>
      `;

      document.getElementById('propWirePotential')?.addEventListener('input', (e) => {
        wire.potential = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propWireSection')?.addEventListener('input', (e) => {
        wire.crossSection = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propWireColor')?.addEventListener('change', (e) => {
        wire.color = (e.target as HTMLSelectElement).value;
        this.notifyChange();
      });
      document.getElementById('btnDeleteWire')?.addEventListener('click', () => this.canvas.deleteSelected());

    } else {
      // Project / Page properties
      const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
      container.innerHTML = `
        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          Seiteneigenschaften (Blatt ${activePage?.pageNumber || '1'})
        </div>

        <div class="form-group">
          <label class="form-label">Seitentitel</label>
          <input class="form-input" id="pageTitleInput" value="${activePage?.title || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Anlagenkennzeichen (=Anlage)</label>
          <input class="form-input" id="pageHigherLevelInput" value="${activePage?.higherLevel || '=A1'}">
        </div>

        <div class="form-group">
          <label class="form-label">Ortskennzeichen (+Ort)</label>
          <input class="form-input" id="pageLocationInput" value="${activePage?.location || '+S1'}">
        </div>

        <div style="margin-top: 20px; font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          Projekteigenschaften
        </div>

        <div class="form-group">
          <label class="form-label">Projektname</label>
          <input class="form-input" id="projNameInput" value="${this.project.name}">
        </div>

        <div class="form-group">
          <label class="form-label">Firma</label>
          <input class="form-input" id="projCompanyInput" value="${this.project.company}">
        </div>

        <div class="form-group">
          <label class="form-label">Ersteller / Bearbeiter</label>
          <input class="form-input" id="projAuthorInput" value="${this.project.author}">
        </div>
      `;

      document.getElementById('pageTitleInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.title = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('pageHigherLevelInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.higherLevel = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('pageLocationInput')?.addEventListener('input', (e) => {
        if (activePage) activePage.location = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('projNameInput')?.addEventListener('input', (e) => {
        this.project.name = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('projCompanyInput')?.addEventListener('input', (e) => {
        this.project.company = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('projAuthorInput')?.addEventListener('input', (e) => {
        this.project.author = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
    }
  }

  private renderEplanInspectorTab(container: HTMLElement): void {
    container.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        EPLAN Electric P8 & REA Inspektor
      </div>

      <div class="dropzone" id="eplanDropzone">
        <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
        <div style="font-size: 12px; font-weight: 500;">EPLAN-Datei hier ablegen</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Unterstützt .zw1 (Backup), .edz (Makros), .xml, .elk</div>
      </div>

      <div id="inspectorDetails" style="font-size: 11px;">
        <div style="padding: 10px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; line-height: 1.5; color: var(--text-muted);">
          <strong style="color: var(--accent-bright);">Kompatibilität mit EPLAN Electric P8:</strong><br>
          • <strong>.zw1:</strong> Komprimiertes EPLAN Projektbackup (enthält .elk und *.edb Datenbankverzeichnis).<br>
          • <strong>.edz:</strong> EPLAN Data Portal Artikel- und Makropaket.<br>
          • <strong>XML:</strong> EPLAN-Schema für Stromlaufpläne und Stammdaten.<br>
          • <strong>Querverweise:</strong> Automatische Berechnung von Kontaktspiegeln und Abbruchstellen nach DIN EN 81346.
        </div>
      </div>
    `;

    const dropzone = document.getElementById('eplanDropzone');
    if (dropzone) {
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--accent-bright)';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
      });
      dropzone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        const file = e.dataTransfer?.files[0];
        if (file) {
          await this.handleFileOpen(file);
        }
      });
      dropzone.addEventListener('click', () => {
        document.getElementById('fileInput')?.click();
      });
    }
  }

  private async handleFileOpen(file: File): Promise<void> {
    try {
      const result: EplanInspectionResult = await EplanPackageHandler.inspectFile(file);
      
      if (result.extractedProject) {
        this.project = result.extractedProject;
        this.canvas.setProject(this.project);
        this.updateUI();
      }

      // Display inspection findings
      const detailsContainer = document.getElementById('inspectorDetails');
      if (detailsContainer) {
        let entriesSummary = '';
        if (result.entries.length > 0) {
          entriesSummary = `
            <div style="margin-top: 10px;">
              <strong>Gefundene Archivelemente (${result.entries.length}):</strong>
              <div style="max-height: 150px; overflow-y: auto; background: var(--bg-primary); padding: 6px; border-radius: 4px; margin-top: 4px; font-family: monospace; font-size: 10px;">
                ${result.entries.map(e => `<div>${e.type === 'elk' ? '⭐' : (e.type === 'edb' ? '📁' : '📄')} ${e.path}</div>`).join('')}
              </div>
            </div>
          `;
        }

        detailsContainer.innerHTML = `
          <div style="padding: 10px; background-color: var(--bg-secondary); border: 1px solid var(--accent); border-radius: 4px;">
            <div style="font-weight: bold; color: var(--success); margin-bottom: 4px;">✓ ${file.name} analysiert</div>
            <div>Format: <strong>${result.format}</strong></div>
            <div>Projektname: <strong>${result.projectName}</strong></div>
            ${entriesSummary}
            <div style="margin-top: 8px; font-size: 10px; color: var(--warning);">
              ${result.messages.join('<br>')}
            </div>
          </div>
        `;
      }
    } catch (err: any) {
      alert(`Fehler beim Öffnen der Datei: ${err.message}`);
    }
  }

  private createNewProject(): void {
    this.project = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: 'Neues_Elektroplan_Projekt',
      description: 'Erstellt mit Elektroplan Suite',
      standard: 'DIN EN 81346-2 / IEC 60617',
      version: '1.0',
      created: new Date().toISOString().split('T')[0],
      modified: new Date().toISOString().split('T')[0],
      author: 'Planer',
      company: 'Engineering Büro',
      pages: [
        {
          id: 'p_1',
          pageNumber: '1',
          pageType: 'schematic',
          title: 'Stromlaufplan Seite 1',
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
              projectTitle: 'Neues_Elektroplan_Projekt',
              commission: 'KOM-001',
              company: 'Engineering Büro',
              author: 'Planer',
              date: new Date().toISOString().split('T')[0],
              revision: '1.0',
              sheetNumber: '1',
              totalSheets: '1'
            }
          }
        }
      ],
      activePageId: 'p_1'
    };

    this.canvas.setProject(this.project);
    this.updateUI();
  }

  private saveProjectJson(): void {
    const jsonStr = JSON.stringify(this.project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.downloadBlob(blob, `${this.project.name}.json`);
  }

  private async exportZw1(): Promise<void> {
    const blob = await EplanPackageHandler.exportToZw1(this.project);
    this.downloadBlob(blob, `${this.project.name}.zw1`);
  }

  private exportXml(): void {
    const xml = EplanPackageHandler.generateEplanXml(this.project);
    const blob = new Blob([xml], { type: 'application/xml' });
    this.downloadBlob(blob, `${this.project.name}.xml`);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private notifyChange(): void {
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    this.canvas.render();
    this.updateUI();
  }
}
