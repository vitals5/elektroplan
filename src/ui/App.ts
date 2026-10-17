// src/ui/App.ts
// Main application controller for Elektroplan (Elektro-CAD CAE Suite)

import { Project, Page, PlacedComponent, Wire } from '../model/types';
import { getSymbolDefinitions, getSymbolById, getSymbolForComponent, setProjectSymbolLibrary, mergeProjectSymbolLibrary } from '../model/symbols';
import { CadCanvas } from '../editor/CadCanvas';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { PackageHandler, PackageInspectionResult } from '../packages/PackageHandler';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { PartsListGenerator } from '../reports/PartsList';
import { PdfExportDialog } from './PdfExportDialog';
import { PartCatalogue, MANUFACTURER_PARTS, ManufacturerPart } from '../model/PartCatalogue';
import { MobileConnectDialog } from './MobileConnectDialog';
import { PropertiesDialog } from './PropertiesDialog';
import { SymbolSelectionDialog } from './SymbolSelectionDialog';
import { PlausibilityDialog } from './PlausibilityDialog';
import { AutoconnectEngine } from '../model/AutoconnectEngine';
import { MacroManager, WindowMacro, PageMacro, MacroItem } from '../model/MacroManager';
import { MacroSelectionDialog } from './MacroSelectionDialog';

export class App {
  private project!: Project;
  private canvas!: CadCanvas;
  private selectedComponent: PlacedComponent | null = null;
  private selectedWire: Wire | null = null;
  private activeLeftTab: 'pages' | 'symbols' | 'macros' | 'terminals' | 'bom' | 'parts' = 'pages';
  private activeRightTab: 'properties' | 'archive' = 'properties';
  private symbolCategoryFilter: string = 'all';
  private macroCategoryFilter: string = 'all';
  private macroSearchQuery: string = '';
  private manufacturerFilter: string = 'all';
  private manufacturerSearchQuery: string = '';
  private leftDrawerOpen: boolean = false;
  private rightDrawerOpen: boolean = false;

  private leftSidebarWidth: number = 280;
  private rightSidebarWidth: number = 300;
  private isLeftCollapsed: boolean = false;
  private isRightCollapsed: boolean = false;

  constructor() {
    const savedLeftW = localStorage.getItem('elektroplan_left_w');
    if (savedLeftW) this.leftSidebarWidth = parseInt(savedLeftW, 10) || 280;
    const savedRightW = localStorage.getItem('elektroplan_right_w');
    if (savedRightW) this.rightSidebarWidth = parseInt(savedRightW, 10) || 300;

    // Default panels to collapsed on mobile / small screens
    if (window.innerWidth <= 960) {
      this.isLeftCollapsed = true;
      this.isRightCollapsed = true;
    }

    this.initDefaultProject();
    this.renderLayout();
    this.initCanvas();
    this.initPanelResizers();
    this.updateUI();

    if (this.isLeftCollapsed) this.setLeftPanelCollapsed(true);
    if (this.isRightCollapsed) this.setRightPanelCollapsed(true);
  }

  private initDefaultProject(): void {
    const dummyFile = new File([''], 'Projekt_Einspeisung.zw1');
    // Generates the initial project with Cover, 400V Motor circuit, and 24V DC control circuit
    const res = (PackageHandler as any).createProjectFromPackageMetadata('Anlagensteuerung', '', []);
    this.project = res;
    setProjectSymbolLibrary(this.project);
    for (const p of this.project.pages) {
      AutoconnectEngine.updatePageAutoconnections(p);
    }
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
  }

  private renderLayout(): void {
    const root = document.getElementById('app');
    if (!root) return;

    root.innerHTML = `
      <!-- Elektro-CAD Menüzeile -->
      <nav class="ecad-menubar" id="ecadMenubar">
        <div class="menu-item">
          Projekt
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuNew">📄 Neu... <span class="opt-key">Strg+N</span></div>
            <label class="menu-opt" style="margin:0; cursor:pointer;">📂 Öffnen (.zw1, .zip, .001/.002, .xml, .json)... <span class="opt-key">Strg+O</span><input type="file" id="menuFileInput" accept=".zw1,.zip,.edz,.xml,.json,.elk,.001,.002,.003" multiple style="display:none;"></label>
            <div class="menu-opt" id="menuSave">💾 Speichern <span class="opt-key">Strg+S</span></div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuExportPdf">📑 Intelligenter PDF-Export (DIN A3)... <span class="opt-key">Strg+P</span></div>
            <div class="menu-opt" id="menuExportZw1">📦 Als Projekt-Archiv (.zw1) exportieren...</div>
            <div class="menu-opt" id="menuExportXml">📋 Als Projekt-XML exportieren...</div>
            <div class="menu-opt" id="menuExportPageMacro">📦 Aktuelle Seite als .ems exportieren...</div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuPrint">🖨️ Drucken / Plotten...</div>
          </div>
        </div>
        <div class="menu-item">
          Bearbeiten
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuDuplicate">📋 Duplizieren <span class="opt-key">Strg+D</span></div>
            <div class="menu-opt" id="menuRotate">🔄 Um 90° drehen <span class="opt-key">R</span></div>
            <div class="menu-opt" id="menuDelete">🗑️ Löschen <span class="opt-key">Entf</span></div>
          </div>
        </div>
        <div class="menu-item">
          Ansicht
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuFit">🔍 Ganzes Blatt (Fit) <span class="opt-key">F</span></div>
            <div class="menu-opt" id="menuZoom100">📐 Originalgröße (100%)</div>
            <div class="menu-opt" id="menuZoomIn">➕ Ausschnitt vergrößern</div>
            <div class="menu-opt" id="menuZoomOut">➖ Ausschnitt verkleinern</div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuGridFull">📐 Vollraster (4 mm) <span class="opt-key">Alt+1</span></div>
            <div class="menu-opt" id="menuGridHalf">📐 Halbraster (2 mm) <span class="opt-key">H / Alt+2</span></div>
            <div class="menu-opt" id="menuGridFine">📐 Feinraster (1 mm) <span class="opt-key">Alt+3</span></div>
            <div class="menu-opt" id="menuGridOff">📐 Rasterfang Aus <span class="opt-key">Alt+0</span></div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuToggleAutoconnect">⚡ Autoconnecting umschalten</div>
          </div>
        </div>
        <div class="menu-item">
          Einfügen
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuInsertSym">⚡ Symbol auswählen... <span class="opt-key">Einfg</span></div>
            <div class="menu-opt" id="menuInsertMacro">📦 Makro auswählen (.ema)...</div>
            <div class="menu-opt" id="menuWire">🔌 Verbindungslinie (Verdrahten) <span class="opt-key">D</span></div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuNewPage">📄 Neue Seite anlegen...</div>
            <div class="menu-opt" id="menuInsertPageMacro">📄 Seitenmakro anfügen (.ems)...</div>
          </div>
        </div>
        <div class="menu-item">
          Projektdaten
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuPlausibility">📋 Prüflauf / Plausibilitätsprüfung ausführen...</div>
            <div class="menu-opt" id="menuRecalcCrossRef">🔄 Querverweise & Kontaktspiegel neu berechnen</div>
            <div class="menu-sep"></div>
            <div class="menu-opt" id="menuShowTerminals">🔌 Klemmenplan (-X1) anzeigen</div>
            <div class="menu-opt" id="menuShowBom">📊 Artikel-Stückliste anzeigen</div>
          </div>
        </div>
        <div class="menu-item">
          Hilfe
          <div class="menu-dropdown">
            <div class="menu-opt" id="menuMobile">📱 Auf dem Smartphone testen (QR-Code)...</div>
            <div class="menu-opt" id="menuShortcuts">⌨️ Tastenkürzel-Übersicht...</div>
            <div class="menu-opt" id="menuAbout">ℹ️ Über Elektroplan</div>
          </div>
        </div>
      </nav>

      <!-- Main Toolbar -->
      <header class="app-header">
        <div class="brand-section">
          <button class="btn btn-drawer-toggle" id="btnToggleLeftSidebar" title="Menü (Seiten, Symbole, Artikel)">☰ <span class="hide-mobile">Seiten</span></button>
          <div class="brand-logo">
            ⚡ Elektroplan <span class="badge-cad">CAD</span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted); border-left: 1px solid var(--border-color); padding-left: 10px;" class="hide-mobile" id="headerProjectName">
            ${this.project.name}
          </span>
        </div>

        <div class="toolbar">
          <button class="btn btn-mobile-highlight" id="btnMobileConnect" title="Auf dem Smartphone testen">📱 <span class="hide-mobile">Mobil testen</span></button>
          
          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 2px;"></div>

          <button class="btn" id="btnNewProject" title="Neues Projekt anlegen (Strg+N)">📄 <span class="hide-mobile">Neu</span></button>
          <label class="btn" title="Projekt (.zw1, .zip, .edz, .xml oder .json) öffnen" style="margin: 0; cursor: pointer;">
            📂 <span class="hide-mobile">Öffnen</span>
            <input type="file" id="fileInput" accept=".zw1,.zip,.edz,.xml,.json,.elk,.001,.002,.003" multiple style="display: none;">
          </label>
          <button class="btn" id="btnSaveJson" title="Projekt speichern (Strg+S)">💾 <span class="hide-mobile">Speichern</span></button>
          
          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 2px;"></div>

          <!-- Symbol & Insertion Tools -->
          <button class="btn btn-primary" id="btnOpenSymbolSelection" title="Symbolauswahl öffnen (Einfg)">⚡ <span class="hide-mobile">Symbol (Einfg)</span></button>
          <button class="btn active" id="btnToolSelect" title="Auswahlwerkzeug">👆 <span class="hide-mobile">Auswählen</span></button>
          <button class="btn" id="btnToolWire" title="Verbindungslinie zeichnen (D)">🔌 <span class="hide-mobile">Verdrahten</span></button>
          <button class="btn" id="btnToolRotate" title="Ausgewähltes Bauteil um 90° drehen (R)">🔄 <span class="hide-mobile">Drehen (R)</span></button>
          <button class="btn" id="btnToolDuplicate" title="Ausgewähltes Bauteil duplizieren (Strg+D)">📋 <span class="hide-mobile">Duplizieren</span></button>
          <button class="btn" id="btnToolDelete" title="Ausgewähltes Element löschen (Entf)">🗑️ <span class="hide-mobile">Löschen</span></button>

          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 2px;"></div>

          <!-- Engineering & Export Tools -->
          <button class="btn" id="btnPlausibility" title="Prüflauf / Plausibilitätskontrolle durchführen">📋 <span class="hide-mobile">Prüflauf</span></button>
          <button class="btn btn-primary" id="btnExportPdf" title="Intelligenter PDF-Export mit interaktiven Querverweisen">📑 PDF</button>
          <button class="btn hide-mobile" id="btnExportZw1" title="Als Projekt-Archiv (.zw1) exportieren">📦 .zw1</button>

          <div style="width: 1px; height: 20px; background-color: var(--border-color); margin: 0 2px;"></div>

          <!-- Zoom & Grid -->
          <button class="btn" id="btnZoomIn" title="Vergrößern">➕</button>
          <button class="btn" id="btnZoomOut" title="Verkleinern">➖</button>
          <button class="btn" id="btnZoomFit" title="Blatt formatfüllend anpassen (F)">🔍 Fit</button>
          <button class="btn active" id="btnGridSnap" title="Raster umschalten (Vollraster / Halbraster / Feinraster / Aus - Tastenkürzel: H)">📐 <span class="hide-mobile">Raster: </span>1x</button>
          <button class="btn hide-mobile active" id="btnAutoconnect" title="Autoconnecting ein/aus">⚡ Autoconnect</button>

          <button class="btn btn-drawer-toggle" id="btnToggleRightSidebar" title="Eigenschaften & Inspektor">⚙️ <span class="hide-mobile">Eigenschaften</span></button>
        </div>
      </header>

      <!-- Backdrop for mobile drawers -->
      <div class="drawer-backdrop" id="drawerBackdrop"></div>

      <!-- Main Workspace -->
      <div class="main-container" id="mainContainer">
        <!-- Left Sidebar -->
        <aside class="sidebar" id="leftSidebar" style="width: ${this.leftSidebarWidth}px;">
          <div class="sidebar-top-bar">
            <span class="sidebar-heading">PROJEKT & SYMBOLE</span>
            <button class="btn-panel-collapse" id="btnCollapseLeft" title="Linkes Panel einklappen (◀)">◀</button>
          </div>
          <div class="tab-nav">
            <button class="tab-btn active" data-tab="pages">Seiten</button>
            <button class="tab-btn" data-tab="symbols">Symbole</button>
            <button class="tab-btn" data-tab="macros">Makros</button>
            <button class="tab-btn" data-tab="parts">Artikel</button>
            <button class="tab-btn" data-tab="terminals">Klemmen</button>
            <button class="tab-btn" data-tab="bom">Stückliste</button>
          </div>
          <div class="tab-content" id="leftTabContent"></div>
        </aside>

        <!-- Left Resizer Splitter -->
        <div class="sidebar-resizer" id="leftResizer" title="Breite anpassen (ziehen)">
          <div class="resizer-handle"></div>
          <button class="resizer-expand-btn left" id="btnExpandLeft" title="Linkes Panel einblenden" style="display: none;">▶</button>
        </div>

        <!-- Center CAD Canvas -->
        <main class="canvas-wrapper" id="canvasContainer">
          <!-- Floating Symbol Placement Banner -->
          <div class="place-hint-banner" id="placeHintBanner" style="display: none;">
            <span id="placeHintText">📍 Bauteil gewählt: Tippe auf den Plan</span>
            <button class="btn-banner-close" id="btnCancelPlace" title="Platzieren abbrechen">✕</button>
          </div>

          <!-- Floating Selection Action Bar (always visible on canvas when component selected) -->
          <div class="selection-floating-bar" id="selectionFloatingBar" style="
            position: absolute;
            bottom: 64px;
            left: 50%;
            transform: translateX(-50%);
            display: none;
            background: rgba(30, 36, 46, 0.96);
            backdrop-filter: blur(12px);
            border: 1px solid #4a5568;
            box-shadow: 0 10px 28px rgba(0,0,0,0.7);
            border-radius: 8px;
            padding: 8px 14px;
            z-index: 1000;
            align-items: center;
            gap: 10px;
          ">
            <span id="selectionFloatingTag" style="font-weight: bold; font-family: monospace; color: #f6e05e; font-size: 13px;">-K1</span>
            <button class="btn btn-primary" id="btnFloatingEdit" style="padding: 6px 14px; font-size: 12px; font-weight: 600; background: #3182ce; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">
              <span>⚡ BMK & Beschriftung bearbeiten...</span>
            </button>
            <button class="btn" id="btnFloatingExportMacro" style="padding: 6px 10px; font-size: 12px; background: rgba(66, 153, 225, 0.2); border-color: #3182ce;" title="Als .ema Makro speichern">📦 Makro</button>
            <button class="btn" id="btnFloatingRotate" style="padding: 6px 10px; font-size: 12px;" title="90° Drehen">🔄</button>
            <button class="btn" id="btnFloatingDelete" style="padding: 6px 10px; font-size: 12px; color: #fc8181; border-color: #e53e3e;" title="Löschen">🗑️</button>
          </div>

          <!-- Mobile Floating Action Bar -->
          <div class="mobile-floating-bar" id="mobileFloatingBar">
            <button class="btn-fab btn-fab-primary" id="fabEdit" title="BMK & Beschriftung editieren">⚡ Edit</button>
            <button class="btn-fab" id="fabFit" title="Blatt anpassen">🔍 Fit</button>
            <button class="btn-fab" id="fabWire" title="Verdrahten">🔌 Draht</button>
            <button class="btn-fab" id="fabRotate" title="Drehen">🔄 Drehen</button>
            <button class="btn-fab" id="fabDelete" title="Löschen">🗑️ Löschen</button>
            <button class="btn-fab" id="fabPdf" title="PDF Export">📑 PDF</button>
          </div>
        </main>

        <!-- Right Resizer Splitter -->
        <div class="sidebar-resizer right" id="rightResizer" title="Breite anpassen (ziehen)">
          <div class="resizer-handle"></div>
          <button class="resizer-expand-btn right" id="btnExpandRight" title="Rechtes Panel einblenden" style="display: none;">◀</button>
        </div>

        <!-- Right Sidebar -->
        <aside class="sidebar right" id="rightSidebar" style="width: ${this.rightSidebarWidth}px;">
          <div class="sidebar-top-bar">
            <span class="sidebar-heading">EIGENSCHAFTEN</span>
            <button class="btn-panel-collapse" id="btnCollapseRight" title="Rechtes Panel einklappen (▶)">▶</button>
          </div>
          <div class="tab-nav">
            <button class="tab-btn active" data-right-tab="properties">Eigenschaften</button>
            <button class="tab-btn" data-right-tab="archive">Archiv / REA</button>
          </div>
          <div class="tab-content" id="rightTabContent"></div>
        </aside>
      </div>

      <!-- Bottom Status Bar -->
      <footer class="status-bar">
        <div id="statusLeft">Bereit | DIN EN 81346 / IEC 60617 | Elektro-CAD Modus</div>
        <div id="statusRight">Seite 1 / 3 | Raster: 10px (4mm) | Querverweise: Aktiv</div>
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
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onSelectWire: (wire) => {
        this.selectedWire = wire;
        this.selectedComponent = null;
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      },
      onOpenProperties: (comp) => {
        this.openPropertiesDialog(comp);
      },
      onOpenSymbolSelection: () => {
        new SymbolSelectionDialog({
          onSelect: (sym) => {
            this.canvas.setSymbolToPlace(sym.id);
          }
        }).show();
      },
      onOpenMacroSelection: () => {
        this.openMacroSelectionDialog();
      },
      onExportSelectedMacro: (comps) => {
        this.exportComponentsAsMacro(comps);
      },
      onNavigateToPage: (pageId) => {
        this.canvas.setPage(pageId);
        this.updateUI();
      },
      onProjectModified: () => {
        const banner = document.getElementById('placeHintBanner');
        if (banner) banner.style.display = 'none';
        this.updateUI();
      }
    });

    // Support dragging macro files (.ema, .ems, .edz) directly onto CAD canvas
    container.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    container.addEventListener('drop', async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && (file.name.endsWith('.ema') || file.name.endsWith('.ems') || file.name.endsWith('.edz') || file.name.endsWith('.xml') || file.name.endsWith('.json'))) {
        await this.handleMacroFileDrop(file, e.clientX, e.clientY);
      }
    });

    // Make sure initial page is loaded
    this.canvas.setPage(this.project.activePageId || this.project.pages[0].id);
  }

  public openPropertiesDialog(comp: PlacedComponent): void {
    new PropertiesDialog(comp, this.project, {
      onSave: (updated) => {
        // 1. Mutate the original comp in-place so all references stay updated
        Object.assign(comp, updated);
        this.selectedComponent = comp;

        // 2. Also ensure activePage components array has this exact updated object
        const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
        if (activePage) {
          const idx = activePage.components.findIndex(c => c.id === comp.id);
          if (idx !== -1) {
            activePage.components[idx] = comp;
          }
          if (this.canvas.autoconnectEnabled) {
            AutoconnectEngine.updatePageAutoconnections(activePage);
          }
        }

        // 3. Mark change, recalculate cross references, re-render canvas and UI
        this.notifyChange();
        this.updateFloatingSelectionBar();
        this.renderRightTab();
      }
    }).show();
  }

  public updateFloatingSelectionBar(): void {
    const bar = document.getElementById('selectionFloatingBar');
    const tag = document.getElementById('selectionFloatingTag');
    const btnEdit = document.getElementById('btnFloatingEdit');
    const btnRot = document.getElementById('btnFloatingRotate');
    const btnDel = document.getElementById('btnFloatingDelete');

    if (bar && tag) {
      if (this.selectedComponent) {
        tag.textContent = `${this.selectedComponent.bmk} (${this.selectedComponent.functionText || 'Bauteil'})`;
        if (btnEdit) btnEdit.style.display = 'inline-flex';
        if (btnRot) btnRot.style.display = 'inline-block';
        if (btnDel) {
          btnDel.title = 'Bauteil löschen';
          btnDel.textContent = '🗑️';
        }
        bar.style.display = 'flex';
      } else if (this.selectedWire) {
        tag.textContent = `🔌 Leitung: ${this.selectedWire.potential} (${this.selectedWire.color || 'BK'}, ${this.selectedWire.crossSection || '1.5mm²'})`;
        if (btnEdit) btnEdit.style.display = 'none';
        if (btnRot) btnRot.style.display = 'none';
        if (btnDel) {
          btnDel.title = 'Leitung trennen / löschen';
          btnDel.textContent = '🗑️ Trennen';
        }
        bar.style.display = 'flex';
      } else {
        bar.style.display = 'none';
      }
    }
  }

  public setLeftPanelCollapsed(collapsed: boolean): void {
    this.isLeftCollapsed = collapsed;
    const sidebar = document.getElementById('leftSidebar');
    const expandBtn = document.getElementById('btnExpandLeft');
    const toggleBtn = document.getElementById('btnToggleLeftSidebar');
    const resizer = document.getElementById('leftResizer');

    if (sidebar) {
      if (collapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0px';
        if (expandBtn) expandBtn.style.display = 'flex';
        toggleBtn?.classList.remove('active');
        resizer?.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = `${this.leftSidebarWidth}px`;
        if (expandBtn) expandBtn.style.display = 'none';
        toggleBtn?.classList.add('active');
        resizer?.classList.remove('collapsed');
      }
    }
    setTimeout(() => this.canvas?.fitToScreen(), 120);
  }

  public setRightPanelCollapsed(collapsed: boolean): void {
    this.isRightCollapsed = collapsed;
    const sidebar = document.getElementById('rightSidebar');
    const expandBtn = document.getElementById('btnExpandRight');
    const toggleBtn = document.getElementById('btnToggleRightSidebar');
    const resizer = document.getElementById('rightResizer');

    if (sidebar) {
      if (collapsed) {
        sidebar.classList.add('collapsed');
        sidebar.style.width = '0px';
        if (expandBtn) expandBtn.style.display = 'flex';
        toggleBtn?.classList.remove('active');
        resizer?.classList.add('collapsed');
      } else {
        sidebar.classList.remove('collapsed');
        sidebar.style.width = `${this.rightSidebarWidth}px`;
        if (expandBtn) expandBtn.style.display = 'none';
        toggleBtn?.classList.add('active');
        resizer?.classList.remove('collapsed');
      }
    }
    setTimeout(() => this.canvas?.fitToScreen(), 120);
  }

  private initPanelResizers(): void {
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    const leftSidebar = document.getElementById('leftSidebar');
    const rightSidebar = document.getElementById('rightSidebar');
    const mainContainer = document.getElementById('mainContainer');

    if (leftResizer && leftSidebar && mainContainer) {
      const onMove = (clientX: number) => {
        if (this.isLeftCollapsed) {
          this.setLeftPanelCollapsed(false);
        }
        const rect = mainContainer.getBoundingClientRect();
        let newW = clientX - rect.left;
        newW = Math.max(160, Math.min(newW, Math.min(550, window.innerWidth - 200)));
        this.leftSidebarWidth = newW;
        leftSidebar.style.width = `${newW}px`;
        localStorage.setItem('elektroplan_left_w', String(newW));
      };

      const startLeftDrag = (e: MouseEvent | TouchEvent) => {
        if ((e.target as HTMLElement).closest('.resizer-expand-btn')) return;
        e.preventDefault();
        document.body.classList.add('resizing');
        const moveHandler = (ev: MouseEvent | TouchEvent) => {
          const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          onMove(clientX);
        };
        const upHandler = () => {
          document.body.classList.remove('resizing');
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('mouseup', upHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('touchend', upHandler);
          this.canvas?.fitToScreen();
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', upHandler);
      };

      leftResizer.addEventListener('mousedown', startLeftDrag);
      leftResizer.addEventListener('touchstart', startLeftDrag, { passive: false });
    }

    if (rightResizer && rightSidebar && mainContainer) {
      const onMove = (clientX: number) => {
        if (this.isRightCollapsed) {
          this.setRightPanelCollapsed(false);
        }
        const rect = mainContainer.getBoundingClientRect();
        let newW = rect.right - clientX;
        newW = Math.max(160, Math.min(newW, Math.min(550, window.innerWidth - 200)));
        this.rightSidebarWidth = newW;
        rightSidebar.style.width = `${newW}px`;
        localStorage.setItem('elektroplan_right_w', String(newW));
      };

      const startRightDrag = (e: MouseEvent | TouchEvent) => {
        if ((e.target as HTMLElement).closest('.resizer-expand-btn')) return;
        e.preventDefault();
        document.body.classList.add('resizing');
        const moveHandler = (ev: MouseEvent | TouchEvent) => {
          const clientX = 'touches' in ev ? ev.touches[0].clientX : ev.clientX;
          onMove(clientX);
        };
        const upHandler = () => {
          document.body.classList.remove('resizing');
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('mouseup', upHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('touchend', upHandler);
          this.canvas?.fitToScreen();
        };
        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('mouseup', upHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('touchend', upHandler);
      };

      rightResizer.addEventListener('mousedown', startRightDrag);
      rightResizer.addEventListener('touchstart', startRightDrag, { passive: false });
    }
  }

  public onSymbolSelectedToPlace(symId: string, customName?: string): void {
    this.canvas.setSymbolToPlace(symId);
    if (window.innerWidth <= 960) {
      this.setLeftPanelCollapsed(true);
      const banner = document.getElementById('placeHintBanner');
      const bannerText = document.getElementById('placeHintText');
      if (banner && bannerText) {
        bannerText.textContent = `📍 ${customName || 'Bauteil'} gewählt: Tippe auf den Plan`;
        banner.style.display = 'flex';
      }
    }
  }

  private bindHeaderEvents(): void {
    // Panel Toggles & Collapse Buttons
    document.getElementById('btnToggleLeftSidebar')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(!this.isLeftCollapsed);
    });

    document.getElementById('btnToggleRightSidebar')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(!this.isRightCollapsed);
    });

    document.getElementById('btnCollapseLeft')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(true);
    });

    document.getElementById('btnExpandLeft')?.addEventListener('click', () => {
      this.setLeftPanelCollapsed(false);
    });

    document.getElementById('btnCollapseRight')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(true);
    });

    document.getElementById('btnExpandRight')?.addEventListener('click', () => {
      this.setRightPanelCollapsed(false);
    });

    // Mobile Connect Dialog
    document.getElementById('btnMobileConnect')?.addEventListener('click', () => {
      MobileConnectDialog.show();
    });

    // Fit to screen
    document.getElementById('btnZoomFit')?.addEventListener('click', () => {
      this.canvas.fitToScreen();
    });

    // Floating action buttons (mobile bar & selection bar)
    document.getElementById('fabEdit')?.addEventListener('click', () => {
      if (this.selectedComponent) {
        this.openPropertiesDialog(this.selectedComponent);
      } else {
        alert('Bitte tippen Sie zuerst ein Bauteil im Plan an.');
      }
    });

    document.getElementById('btnFloatingEdit')?.addEventListener('click', () => {
      if (this.selectedComponent) {
        this.openPropertiesDialog(this.selectedComponent);
      }
    });

    document.getElementById('btnFloatingExportMacro')?.addEventListener('click', () => {
      this.exportSelectedAsWindowMacro();
    });

    document.getElementById('btnFloatingRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('btnFloatingDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
      this.updateFloatingSelectionBar();
    });

    document.getElementById('fabFit')?.addEventListener('click', () => {
      this.canvas.fitToScreen();
    });

    document.getElementById('fabWire')?.addEventListener('click', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });

    document.getElementById('fabRotate')?.addEventListener('click', () => {
      this.canvas.rotateSelected();
    });

    document.getElementById('fabDelete')?.addEventListener('click', () => {
      this.canvas.deleteSelected();
    });

    document.getElementById('fabPdf')?.addEventListener('click', () => {
      new PdfExportDialog(this.project, this.project.activePageId).show();
    });

    // Cancel placement
    document.getElementById('btnCancelPlace')?.addEventListener('click', () => {
      this.canvas.setMode('select');
      const banner = document.getElementById('placeHintBanner');
      if (banner) banner.style.display = 'none';
    });

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

    // Toolbar Actions
    document.getElementById('btnOpenSymbolSelection')?.addEventListener('click', () => {
      new SymbolSelectionDialog({
        onSelect: (sym) => this.canvas.setSymbolToPlace(sym.id)
      }).show();
    });

    document.getElementById('btnToolDuplicate')?.addEventListener('click', () => {
      this.canvas.duplicateSelected();
    });

    document.getElementById('btnPlausibility')?.addEventListener('click', () => {
      new PlausibilityDialog(this.project, {
        onNavigateToPage: (pageId) => {
          this.canvas.setPage(pageId);
          this.updateUI();
        }
      }).show();
    });

    // Menubar interactions
    this.bindMenubarEvents();

    // Zoom
    document.getElementById('btnZoomIn')?.addEventListener('click', () => this.canvas.zoomIn());
    document.getElementById('btnZoomOut')?.addEventListener('click', () => this.canvas.zoomOut());
    document.getElementById('btnZoomReset')?.addEventListener('click', () => this.canvas.resetZoom());

    // Grid snap
    const btnGrid = document.getElementById('btnGridSnap');
    btnGrid?.addEventListener('click', () => {
      this.canvas.cycleGridResolution();
      this.updateGridButtonState();
    });

    // Autoconnect toggle
    const btnAuto = document.getElementById('btnAutoconnect');
    btnAuto?.addEventListener('click', () => {
      this.canvas.autoconnectEnabled = !this.canvas.autoconnectEnabled;
      btnAuto.classList.toggle('active', this.canvas.autoconnectEnabled);
      if (this.canvas.autoconnectEnabled) {
        const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
        if (activePage) AutoconnectEngine.updatePageAutoconnections(activePage);
        this.canvas.render();
      }
    });

    // File Open
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        await this.handleFilesOpen(files);
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

    // Export .zw1
    document.getElementById('btnExportZw1')?.addEventListener('click', async () => {
      await this.exportZw1();
    });

    // Export XML
    document.getElementById('btnExportXml')?.addEventListener('click', () => {
      this.exportXml();
    });

    // Smart PDF Export
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

  private bindMenubarEvents(): void {
    const menubar = document.getElementById('ecadMenubar');
    if (!menubar) return;

    const menuItems = menubar.querySelectorAll<HTMLElement>('.menu-item');

    const closeAllMenus = () => {
      menuItems.forEach(item => item.classList.remove('open'));
    };

    menuItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if ((e.target as HTMLElement).closest('.menu-dropdown')) return;
        const isOpen = item.classList.contains('open');
        closeAllMenus();
        if (!isOpen) {
          item.classList.add('open');
        }
      });

      item.addEventListener('mouseenter', () => {
        const anyOpen = Array.from(menuItems).some(m => m.classList.contains('open'));
        if (anyOpen) {
          closeAllMenus();
          item.classList.add('open');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!menubar.contains(e.target as Node)) {
        closeAllMenus();
      }
    });

    const bindMenuOpt = (id: string, action: () => void) => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        action();
      });
    };

    // Projekt
    bindMenuOpt('menuNew', () => {
      if (confirm('Möchten Sie ein neues leeres Projekt anlegen? Nicht gespeicherte Änderungen gehen verloren.')) {
        this.createNewProject();
      }
    });

    const menuFileInput = document.getElementById('menuFileInput') as HTMLInputElement;
    menuFileInput?.addEventListener('change', async (e) => {
      closeAllMenus();
      const files = (e.target as HTMLInputElement).files;
      if (files?.length) await this.handleFilesOpen(files);
    });

    bindMenuOpt('menuSave', () => this.saveProjectJson());
    bindMenuOpt('menuExportPdf', () => new PdfExportDialog(this.project, this.project.activePageId).show());
    bindMenuOpt('menuExportZw1', async () => await this.exportZw1());
    bindMenuOpt('menuExportXml', () => this.exportXml());
    bindMenuOpt('menuExportPageMacro', () => this.exportCurrentPageAsPageMacro());
    bindMenuOpt('menuPrint', () => window.print());

    // Bearbeiten
    bindMenuOpt('menuDuplicate', () => this.canvas.duplicateSelected());
    bindMenuOpt('menuRotate', () => this.canvas.rotateSelected());
    bindMenuOpt('menuDelete', () => this.canvas.deleteSelected());

    // Ansicht
    bindMenuOpt('menuFit', () => this.canvas.fitToScreen());
    bindMenuOpt('menuZoom100', () => this.canvas.resetZoom());
    bindMenuOpt('menuZoomIn', () => this.canvas.zoomIn());
    bindMenuOpt('menuZoomOut', () => this.canvas.zoomOut());
    bindMenuOpt('menuGridFull', () => {
      this.canvas.setGridResolution('full');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridHalf', () => {
      this.canvas.setGridResolution('half');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridFine', () => {
      this.canvas.setGridResolution('fine');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuGridOff', () => {
      this.canvas.setGridResolution('off');
      this.updateGridButtonState();
    });
    bindMenuOpt('menuToggleAutoconnect', () => {
      this.canvas.autoconnectEnabled = !this.canvas.autoconnectEnabled;
      document.getElementById('btnAutoconnect')?.classList.toggle('active', this.canvas.autoconnectEnabled);
      if (this.canvas.autoconnectEnabled) {
        const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
        if (activePage) AutoconnectEngine.updatePageAutoconnections(activePage);
        this.canvas.render();
      }
    });

    // Einfügen
    bindMenuOpt('menuInsertSym', () => {
      new SymbolSelectionDialog({
        onSelect: (sym) => this.canvas.setSymbolToPlace(sym.id)
      }).show();
    });
    bindMenuOpt('menuInsertMacro', () => {
      this.openMacroSelectionDialog('window');
    });
    bindMenuOpt('menuWire', () => {
      this.canvas.setMode('wire');
      this.updateToolButtons('btnToolWire');
    });
    bindMenuOpt('menuNewPage', () => this.addNewPage());
    bindMenuOpt('menuInsertPageMacro', () => {
      this.openMacroSelectionDialog('page');
    });

    // Projektdaten
    bindMenuOpt('menuPlausibility', () => {
      new PlausibilityDialog(this.project, {
        onNavigateToPage: (pageId) => {
          this.canvas.setPage(pageId);
          this.updateUI();
        }
      }).show();
    });
    bindMenuOpt('menuRecalcCrossRef', () => {
      CrossReferenceEngine.updateProjectCrossReferences(this.project);
      this.canvas.render();
      alert('Querverweise und Kontaktspiegel für alle Schaltzeichen wurden erfolgreich neu berechnet.');
    });
    bindMenuOpt('menuShowTerminals', () => {
      this.activeLeftTab = 'terminals';
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === 'terminals'));
      this.renderLeftTab();
    });
    bindMenuOpt('menuShowBom', () => {
      this.activeLeftTab = 'bom';
      document.querySelectorAll('[data-tab]').forEach(b => b.classList.toggle('active', (b as HTMLElement).dataset.tab === 'bom'));
      this.renderLeftTab();
    });

    // Hilfe
    bindMenuOpt('menuMobile', () => MobileConnectDialog.show());
    bindMenuOpt('menuShortcuts', () => {
      alert(
        'Elektro-CAD Tastatur-Kürzel:\n\n' +
        '• Einfg: Symbolauswahl öffnen\n' +
        '• Tab: Symbol während Vorschau um 90° drehen\n' +
        '• D / W: Verbindungslinie zeichnen (Verdrahten)\n' +
        '• Doppelklick: Eigenschaften (Schaltzeichen)\n' +
        '• Rechtsklick: Kontextmenü\n' +
        '• Strg+D: Ausgewähltes Bauteil duplizieren\n' +
        '• R: Ausgewähltes Bauteil um 90° drehen\n' +
        '• Entf / Backspace: Ausgewähltes Element löschen\n' +
        '• F: Ganzes Blatt anzeigen (Fit)\n' +
        '• H: Halbraster umschalten (4px / 2mm)\n' +
        '• Alt+1 / Alt+2 / Alt+3 / Alt+0: Voll-, Halb-, Feinraster, Aus\n' +
        '• Shift / Alt beim Verschieben: Halbraster-Fang\n' +
        '• Strg+P: Intelligenter PDF-Export (DIN A3)\n' +
        '• Strg+S: Projekt speichern\n' +
        '• Esc: Modus / Platzierung abbrechen'
      );
    });
    bindMenuOpt('menuAbout', () => {
      alert(
        'Elektroplan - CAE & Elektro-CAD Suite\n' +
        'Version 2.0 (CAD & Engineering Suite)\n\n' +
        'Unterstützte Standards:\n' +
        '• Projektarchive (.zw1) (Backup/Restore)\n' +
        '• Artikel- und Makropakete (.edz)\n' +
        '• XML Schaltplan-Schemata\n' +
        '• DIN EN 81346 Strukturierung (=Anlage +Ort -BMK :Pin)\n' +
        '• IEC 60617 genormte elektrotechnische Symbole\n' +
        '• Automatische Querverweisberechnung & Kontaktspiegel\n' +
        '• Klemmenpläne (-X1) und automatisierte Stücklisten\n' +
        '• Windows Desktop (Electron) & Mobile/PWA Web App'
      );
    });
  }

  private updateToolButtons(activeId: string): void {
    ['btnToolSelect', 'btnToolWire'].forEach(id => {
      document.getElementById(id)?.classList.toggle('active', id === activeId);
    });
  }

  public updateGridButtonState(): void {
    const btnGrid = document.getElementById('btnGridSnap');
    if (btnGrid && this.canvas) {
      const res = this.canvas.gridResolution;
      const isSnap = this.canvas.gridSnap && res !== 'off';
      btnGrid.classList.toggle('active', isSnap);
      let label = '1x';
      if (!isSnap) label = 'Aus';
      else if (res === 'half') label = '½';
      else if (res === 'fine') label = '¼';
      btnGrid.innerHTML = `📐 <span class="hide-mobile">Raster: </span>${label}`;
    }
    this.updateStatusBar();
  }

  private updateStatusBar(): void {
    const statusRight = document.getElementById('statusRight');
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (statusRight && activePage && this.canvas) {
      statusRight.textContent = `Seite ${activePage.pageNumber} (${activePage.title}) | Raster: ${this.canvas.getGridLabel()} | Bauteile: ${activePage.components.length} | Leitungen: ${activePage.wires.length}`;
    }
  }

  private updateUI(): void {
    const projNameEl = document.getElementById('headerProjectName');
    if (projNameEl) projNameEl.textContent = this.project.name;

    this.updateGridButtonState();
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
    } else if (this.activeLeftTab === 'macros') {
      this.renderMacrosTab(container);
    } else if (this.activeLeftTab === 'parts') {
      this.renderPartsCatalogueTab(container);
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
        if (window.innerWidth <= 960) {
          this.setLeftPanelCollapsed(true);
        }
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
          <option value="project" ${this.symbolCategoryFilter === 'project' ? 'selected' : ''}>Projektbibliothek (mitgeliefert)</option>
          <option value="relays" ${this.symbolCategoryFilter === 'relays' ? 'selected' : ''}>Schütze & Relais</option>
          <option value="protection" ${this.symbolCategoryFilter === 'protection' ? 'selected' : ''}>Schutzeinrichtungen</option>
          <option value="controls" ${this.symbolCategoryFilter === 'controls' ? 'selected' : ''}>Befehls- & Meldegeräte</option>
          <option value="motors" ${this.symbolCategoryFilter === 'motors' ? 'selected' : ''}>Motoren & Aktoren</option>
          <option value="terminals" ${this.symbolCategoryFilter === 'terminals' ? 'selected' : ''}>Klemmen & Verbinder</option>
          <option value="connections" ${this.symbolCategoryFilter === 'connections' ? 'selected' : ''}>🔗 Verbindungssymbole (T-Stücke, Winkel)</option>
          <option value="supply" ${this.symbolCategoryFilter === 'supply' ? 'selected' : ''}>Spannungsversorgung</option>
        </select>
      </div>
      <div class="symbol-grid">
    `;

    const filtered = this.symbolCategoryFilter === 'all'
      ? getSymbolDefinitions()
      : this.symbolCategoryFilter === 'project' ? this.project.symbolLibrary ?? []
      : getSymbolDefinitions().filter(s => s.category === this.symbolCategoryFilter);

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
          ${sym.source ? `<div class="symbol-bmk">${sym.source.library} / ${sym.source.number} · ${sym.source.variant}</div>` : ''}
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
        const sym = getSymbolById(symId);
        this.onSymbolSelectedToPlace(symId, sym?.name);
        this.renderSymbolsTab(container);
      });
    });
  }

  private renderMacrosTab(container: HTMLElement): void {
    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase;">Makro-Bibliothek</span>
        <div style="display: flex; gap: 4px;">
          <button class="btn" id="btnOpenMacroDialog" style="padding: 2px 7px; font-size: 11px;" title="Große Makro-Bibliothek öffnen">🔍 Groß</button>
          <label class="btn btn-primary" style="padding: 2px 7px; font-size: 11px; margin: 0; cursor: pointer;" title="Makrodatei (.ema, .ems, .edz, .xml, .json) importieren">
            + Import
            <input type="file" id="macroTabFileInput" accept=".ema,.ems,.edz,.xml,.json" style="display: none;">
          </label>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 8px;">
        <select class="form-input" id="macroCategorySelect">
          <option value="all" ${this.macroCategoryFilter === 'all' ? 'selected' : ''}>Alle Makros</option>
          <option value="window" ${this.macroCategoryFilter === 'window' ? 'selected' : ''}>📦 Fenstermakros (.ema)</option>
          <option value="page" ${this.macroCategoryFilter === 'page' ? 'selected' : ''}>📄 Seitenmakros (.ems)</option>
          <option value="motor" ${this.macroCategoryFilter === 'motor' ? 'selected' : ''}>⚙️ Motoren & Antriebe</option>
          <option value="power" ${this.macroCategoryFilter === 'power' ? 'selected' : ''}>⚡ Stromversorgung</option>
          <option value="safety" ${this.macroCategoryFilter === 'safety' ? 'selected' : ''}>🛡️ Not-Halt & Sicherheit</option>
          <option value="user" ${this.macroCategoryFilter === 'user' ? 'selected' : ''}>⭐ Eigene Importe</option>
        </select>
        <input class="form-input" id="macroTabSearch" placeholder="Suche (z.B. Motor, 24V)..." value="${this.macroSearchQuery}">
      </div>

      <div class="dropzone" id="macroTabDropzone" style="padding: 8px 10px; margin-bottom: 8px; text-align: center; border: 1px dashed var(--border-color); border-radius: 4px; background: rgba(0,0,0,0.15); cursor: pointer;" title="Klicken oder Datei (.ema/.ems) hier ablegen">
        <div style="font-size: 11px; color: var(--text-muted);">
          📥 .ema / .ems / .edz hier ablegen
        </div>
      </div>

      <div class="macro-list" style="display: flex; flex-direction: column; gap: 8px; overflow-y: auto;">
    `;

    let list = MacroManager.getAllMacros();
    if (this.macroCategoryFilter === 'window') {
      list = list.filter(m => m.type === 'ema');
    } else if (this.macroCategoryFilter === 'page') {
      list = list.filter(m => m.type === 'ems');
    } else if (this.macroCategoryFilter === 'user') {
      list = list.filter(m => !m.isBuiltIn);
    } else if (this.macroCategoryFilter === 'motor') {
      list = list.filter(m => m.category.includes('Motor') || m.name.includes('Motor'));
    } else if (this.macroCategoryFilter === 'power') {
      list = list.filter(m => m.category.includes('Strom') || m.category.includes('Versorgung') || m.name.includes('24V'));
    } else if (this.macroCategoryFilter === 'safety') {
      list = list.filter(m => m.category.includes('Sicherheit') || m.name.includes('HALT'));
    } else if (this.macroCategoryFilter !== 'all') {
      list = list.filter(m => m.category.toLowerCase().includes(this.macroCategoryFilter.toLowerCase()));
    }

    if (this.macroSearchQuery) {
      const q = this.macroSearchQuery.toLowerCase();
      list = list.filter(m => {
        const titleMatch = m.name.toLowerCase().includes(q);
        const descMatch = (m.description || '').toLowerCase().includes(q);
        const catMatch = (m.category || '').toLowerCase().includes(q);
        const bmkMatch = m.type === 'ema'
          ? (m as WindowMacro).components.some(c => c.bmk.toLowerCase().includes(q) || (c.functionText || '').toLowerCase().includes(q))
          : (m as PageMacro).page.components.some(c => c.bmk.toLowerCase().includes(q));
        return titleMatch || descMatch || catMatch || bmkMatch;
      });
    }

    if (list.length === 0) {
      html += `
        <div style="padding: 24px 10px; text-align: center; color: var(--text-muted); font-size: 11px;">
          Keine Makros gefunden.<br>
          Importieren Sie Ihre .ema/.ems Makros mit dem Button oben.
        </div>
      `;
    } else {
      for (const m of list) {
        const isWindow = m.type === 'ema';
        const typeBadge = isWindow
          ? '<span style="background: rgba(66, 153, 225, 0.25); color: #63b3ed; border: 1px solid #3182ce; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMA</span>'
          : '<span style="background: rgba(159, 122, 234, 0.25); color: #b794f4; border: 1px solid #805ad5; font-size: 9px; padding: 1px 4px; border-radius: 3px; font-weight: bold;">.EMS</span>';

        const thumbSvg = MacroManager.generateMacroSvgThumbnail(m);
        const compCount = isWindow ? (m as WindowMacro).components.length : (m as PageMacro).page.components.length;
        const bmkSummary = isWindow
          ? (m as WindowMacro).components.map(c => c.bmk).filter(Boolean).slice(0, 4).join(', ')
          : (m as PageMacro).page.components.map(c => c.bmk).filter(Boolean).slice(0, 4).join(', ');

        const isCurrentPlacing = isWindow && this.canvas.mode === 'place_macro' && this.canvas.activeMacroToPlace?.id === m.id;

        html += `
          <div class="symbol-card ${isCurrentPlacing ? 'selected' : ''}" style="display: flex; flex-direction: column; gap: 6px; padding: 8px; border: 1px solid ${isCurrentPlacing ? '#63b3ed' : 'var(--border-color)'};">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px;">
              <div style="font-size: 11px; font-weight: 600; color: #edf2f7; line-height: 1.3;">${m.name}</div>
              ${typeBadge}
            </div>

            <div style="background: #181b22; border: 1px solid #2d3748; border-radius: 3px; height: 75px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
              ${thumbSvg}
            </div>

            <div style="font-size: 10px; color: var(--text-muted); line-height: 1.3; max-height: 26px; overflow: hidden;">
              ${m.description || 'Schaltungsmakro'}
            </div>

            <div style="font-size: 9px; font-family: monospace; color: #f6e05e;">
              ${compCount} Bauteile: ${bmkSummary || '–'}
            </div>

            <div style="display: flex; gap: 4px; margin-top: 2px;">
              ${isWindow ? `
                <button class="btn btn-primary btn-tab-place-macro" data-macro-id="${m.id}" style="flex: 1; padding: 3px 6px; font-size: 11px; justify-content: center;">
                  ⚡ Platzieren
                </button>
              ` : `
                <button class="btn btn-primary btn-tab-add-page-macro" data-macro-id="${m.id}" style="flex: 1; padding: 3px 6px; font-size: 11px; justify-content: center;">
                  📄 Seite anfügen
                </button>
              `}
              <button class="btn btn-tab-export-macro" data-macro-id="${m.id}" style="padding: 3px 6px; font-size: 11px;" title="Als .ema/.ems exportieren">💾</button>
              ${!m.isBuiltIn ? `
                <button class="btn btn-tab-delete-macro" data-macro-id="${m.id}" style="padding: 3px 6px; font-size: 11px; color: #fc8181; border-color: #e53e3e;" title="Löschen">🗑️</button>
              ` : ''}
            </div>
          </div>
        `;
      }
    }

    html += `</div>`;
    container.innerHTML = html;

    this.bindMacrosTabEvents(container);
  }

  private bindMacrosTabEvents(container: HTMLElement): void {
    document.getElementById('btnOpenMacroDialog')?.addEventListener('click', () => {
      this.openMacroSelectionDialog();
    });

    document.getElementById('macroCategorySelect')?.addEventListener('change', (e) => {
      this.macroCategoryFilter = (e.target as HTMLSelectElement).value;
      this.renderMacrosTab(container);
    });

    document.getElementById('macroTabSearch')?.addEventListener('input', (e) => {
      this.macroSearchQuery = (e.target as HTMLInputElement).value.trim();
      this.renderMacrosTab(container);
    });

    // File input import
    const fileInput = document.getElementById('macroTabFileInput') as HTMLInputElement;
    fileInput?.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        await this.importMacroFile(file);
      }
    });

    // Dropzone import
    const dropzone = document.getElementById('macroTabDropzone');
    if (dropzone) {
      dropzone.addEventListener('click', () => {
        fileInput?.click();
      });
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
        const file = e.dataTransfer?.files?.[0];
        if (file) {
          await this.importMacroFile(file);
        }
      });
    }

    // Place window macro buttons
    container.querySelectorAll('.btn-tab-place-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        const macro = MacroManager.getAllMacros().find(m => m.id === id);
        if (macro && macro.type === 'ema') {
          this.startPlacingWindowMacro(macro as WindowMacro);
          this.renderMacrosTab(container);
        }
      });
    });

    // Add page macro buttons
    container.querySelectorAll('.btn-tab-add-page-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        const macro = MacroManager.getAllMacros().find(m => m.id === id);
        if (macro && macro.type === 'ems') {
          this.addPageFromMacro(macro as PageMacro);
        }
      });
    });

    // Export buttons
    container.querySelectorAll('.btn-tab-export-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        const macro = MacroManager.getAllMacros().find(m => m.id === id);
        if (macro) {
          this.downloadMacro(macro);
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-tab-delete-macro').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.macroId!;
        if (confirm('Möchten Sie dieses Makro wirklich aus Ihrer Bibliothek entfernen?')) {
          MacroManager.deleteMacro(id);
          this.renderMacrosTab(container);
        }
      });
    });
  }

  public openMacroSelectionDialog(defaultCategory?: string): void {
    new MacroSelectionDialog({
      onSelectWindowMacro: (wm) => {
        this.startPlacingWindowMacro(wm);
      },
      onSelectPageMacro: (pm) => {
        this.addPageFromMacro(pm);
      }
    }).show();
  }

  public startPlacingWindowMacro(macro: WindowMacro): void {
    // Resolve portable project symbols before the canvas draws the placement preview.
    macro = JSON.parse(JSON.stringify(macro));
    mergeProjectSymbolLibrary(this.project, macro.symbolLibrary ?? [], macro.components);
    this.canvas.setMacroToPlace(macro);
    if (window.innerWidth <= 960) {
      this.setLeftPanelCollapsed(true);
    }
    const banner = document.getElementById('placeHintBanner');
    const bannerText = document.getElementById('placeHintText');
    if (banner && bannerText) {
      bannerText.textContent = `📍 Makro "${macro.name}" gewählt: Tippe auf den Plan zum Platzieren`;
      banner.style.display = 'flex';
    }
  }

  public addPageFromMacro(macro: PageMacro): void {
    const newPage = MacroManager.instantiatePageMacro(macro, this.project);
    this.canvas.setPage(newPage.id);
    this.updateUI();
    alert(`Seitenmakro "${macro.name}" wurde als Blatt ${newPage.pageNumber} (${newPage.title}) angefügt.`);
  }

  public async importMacroFile(file: File): Promise<void> {
    try {
      const imported = await MacroManager.parseMacroFile(file);
      MacroManager.addMacro(imported);
      if (this.activeLeftTab === 'macros') {
        const container = document.getElementById('leftTabContent');
        if (container) this.renderMacrosTab(container);
      }
      alert(`Makro "${imported.name}" erfolgreich importiert (${imported.type === 'ema' ? '.ema Fenstermakro' : '.ems Seitenmakro'})!`);
    } catch (err: any) {
      alert(`Fehler beim Importieren des Makros: ${err.message}`);
    }
  }

  public exportSelectedAsWindowMacro(): void {
    if (!this.selectedComponent) {
      alert('Bitte wählen Sie zuerst ein Bauteil im Plan aus.');
      return;
    }
    this.exportComponentsAsMacro([this.selectedComponent]);
  }

  public exportComponentsAsMacro(comps: PlacedComponent[]): void {
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!activePage || comps.length === 0) return;

    const defaultName = comps.length === 1
      ? `Makro_${comps[0].bmk}`
      : `Makro_${comps[0].bmk}_Gruppe`;

    const name = prompt('Name für das neue Fenstermakro (.ema):', defaultName);
    if (!name) return;

    const desc = prompt('Beschreibung des Makros:', comps[0].functionText || 'Benutzerdefiniertes Schaltungsmakro') || '';

    const macro = MacroManager.createMacroFromComponents(
      name,
      'Eigene Fenstermakros',
      desc,
      comps,
      activePage.wires
    );

    MacroManager.addMacro(macro);

    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);

    if (this.activeLeftTab === 'macros') {
      const container = document.getElementById('leftTabContent');
      if (container) this.renderMacrosTab(container);
    }

    alert(`Fenstermakro "${name}" (.ema) wurde erfolgreich erstellt, heruntergeladen und zu Ihrer Makro-Bibliothek hinzugefügt!`);
  }

  public exportCurrentPageAsPageMacro(): void {
    const activePage = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!activePage) return;

    const defaultName = `Seitenmakro_Blatt_${activePage.pageNumber}_${activePage.title.replace(/\s+/g, '_')}`;
    const name = prompt('Name für das Seitenmakro (.ems):', defaultName);
    if (!name) return;

    const desc = prompt('Beschreibung des Seitenmakros:', `${activePage.title} (${activePage.higherLevel}${activePage.location})`) || '';

    const macro = MacroManager.createMacroFromPage(
      activePage,
      name,
      'Eigene Seitenmakros'
    );

    MacroManager.addMacro(macro);

    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);

    if (this.activeLeftTab === 'macros') {
      const container = document.getElementById('leftTabContent');
      if (container) this.renderMacrosTab(container);
    }

    alert(`Seitenmakro "${name}" (.ems) wurde erfolgreich erstellt, heruntergeladen und zu Ihrer Makro-Bibliothek hinzugefügt!`);
  }

  public downloadMacro(macro: MacroItem): void {
    const { blob, filename } = MacroManager.exportMacro(macro);
    this.downloadBlob(blob, filename);
  }

  private async handleMacroFileDrop(file: File, clientX: number, clientY: number): Promise<void> {
    try {
      const imported = await MacroManager.parseMacroFile(file);
      MacroManager.addMacro(imported);
      if (imported.type === 'ema') {
        const wm = imported as WindowMacro;
        const world = this.canvas.screenToWorld(clientX, clientY);
        this.canvas.placeMacroAt(world.x, world.y, wm);
        this.updateUI();
        alert(`Fenstermakro "${wm.name}" (.ema) direkt platziert und in der Makro-Bibliothek gespeichert!`);
      } else {
        const pm = imported as PageMacro;
        this.addPageFromMacro(pm);
      }
    } catch (err: any) {
      alert(`Fehler beim Verarbeiten des Makros: ${err.message}`);
    }
  }

  private renderPartsCatalogueTab(container: HTMLElement): void {
    let html = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Artikel-Stammdaten & Katalog
      </div>

      <div style="display: flex; gap: 6px; margin-bottom: 8px;">
        <select class="form-input" id="mfrSelect" style="flex: 1;">
          <option value="all" ${this.manufacturerFilter === 'all' ? 'selected' : ''}>Alle Hersteller</option>
          <option value="Hager" ${this.manufacturerFilter === 'Hager' ? 'selected' : ''}>Hager</option>
          <option value="Finder" ${this.manufacturerFilter === 'Finder' ? 'selected' : ''}>Finder</option>
          <option value="Siemens" ${this.manufacturerFilter === 'Siemens' ? 'selected' : ''}>Siemens</option>
          <option value="ABB" ${this.manufacturerFilter === 'ABB' ? 'selected' : ''}>ABB</option>
          <option value="Eaton" ${this.manufacturerFilter === 'Eaton' ? 'selected' : ''}>Eaton</option>
          <option value="Dehn" ${this.manufacturerFilter === 'Dehn' ? 'selected' : ''}>Dehn</option>
        </select>
        <input class="form-input" id="mfrSearch" placeholder="Suche (z.B. FI, Stromstoß)..." value="${this.manufacturerSearchQuery}" style="flex: 1.2;">
      </div>

      <div class="parts-list" style="display: flex; flex-direction: column; gap: 8px;">
    `;

    let parts = MANUFACTURER_PARTS;
    if (this.manufacturerFilter !== 'all') {
      parts = parts.filter(p => p.manufacturer.toLowerCase() === this.manufacturerFilter.toLowerCase());
    }
    if (this.manufacturerSearchQuery) {
      const q = this.manufacturerSearchQuery.toLowerCase();
      parts = parts.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.articleNumber.toLowerCase().includes(q) || 
        p.description.toLowerCase().includes(q) ||
        p.technicalData.toLowerCase().includes(q)
      );
    }

    for (const part of parts) {
      html += `
        <div class="part-item-card" data-part-id="${part.id}" style="
          background: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 6px;
          padding: 8px 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        ">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
            <span style="font-weight: 600; font-size: 11px; color: var(--accent-bright);">${part.manufacturer}</span>
            <span style="font-family: monospace; font-size: 10px; background: rgba(246, 224, 94, 0.15); color: var(--warning); padding: 1px 4px; border-radius: 3px;">
              ${part.articleNumber}
            </span>
          </div>

          <div style="font-weight: 500; font-size: 11px; margin-bottom: 3px; color: var(--text-main);">
            ${part.name}
          </div>

          <div style="font-size: 10px; color: var(--text-muted); margin-bottom: 6px;">
            ${part.technicalData}
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
            <span style="font-size: 9px; color: #718096;">${part.widthModules || 'Normbauform'}</span>
            <button class="btn btn-primary btn-place-part" data-part-id="${part.id}" style="padding: 2px 6px; font-size: 10px;">
              ⚡ Im Plan platzieren
            </button>
          </div>
        </div>
      `;
    }

    html += `</div>`;
    container.innerHTML = html;

    // Events
    document.getElementById('mfrSelect')?.addEventListener('change', (e) => {
      this.manufacturerFilter = (e.target as HTMLSelectElement).value;
      this.renderPartsCatalogueTab(container);
    });

    document.getElementById('mfrSearch')?.addEventListener('input', (e) => {
      this.manufacturerSearchQuery = (e.target as HTMLInputElement).value;
      this.renderPartsCatalogueTab(container);
    });

    container.querySelectorAll('.btn-place-part, .part-item-card').forEach(el => {
      el.addEventListener('click', (e) => {
        const partId = (e.currentTarget as HTMLElement).dataset.partId!;
        const part = MANUFACTURER_PARTS.find(p => p.id === partId);
        if (part) {
          this.onSymbolSelectedToPlace(part.symbolId, `${part.manufacturer} ${part.name}`);
          if (this.selectedComponent) {
            this.selectedComponent.manufacturer = part.manufacturer;
            this.selectedComponent.articleNumber = part.articleNumber;
            this.selectedComponent.functionText = part.name;
            this.selectedComponent.technicalCharacteristics = part.technicalData;
            this.notifyChange();
          }
        }
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
      this.renderArchiveInspectorTab(container);
    }
  }

  private renderPropertiesTab(container: HTMLElement): void {
    if (this.selectedComponent) {
      const comp = this.selectedComponent;
      const sym = getSymbolForComponent(comp);

      const bmkPreset = comp.bmkPosition?.preset || 'top';

      container.innerHTML = `
        <button class="btn btn-primary" id="btnOpenFullPropModal" style="width: 100%; margin-bottom: 12px; font-weight: 600; font-size: 12px; padding: 8px 12px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #3182ce; box-shadow: 0 2px 6px rgba(0,0,0,0.3);">
          <span>⚡ Eigenschaften-Editierfenster...</span>
          <span style="font-size: 10px; opacity: 0.8; font-family: monospace;">[Enter / F2]</span>
        </button>

        <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px;">
          Bauteileigenschaften (${sym?.name || comp.symbolId})
        </div>

        <div class="form-group">
          <label class="form-label">Betriebsmittelkennzeichen (BMK)</label>
          <input class="form-input" id="propBmk" value="${comp.bmk}">
        </div>

        <div class="form-group">
          <label class="form-label">Gerätebezeichnung</label>
          <input class="form-input" id="propDeviceTag" value="${comp.deviceTag || ''}" placeholder="z.B. Hauptschütz, Netzteil">
        </div>

        <div class="form-group">
          <label class="form-label">Funktionstext</label>
          <input class="form-input" id="propFunctionText" value="${comp.functionText || ''}">
        </div>

        <div class="form-group">
          <label class="form-label">Position der BMK-Beschriftung</label>
          <select class="form-input" id="propQuickBmkPreset">
            <option value="top" ${bmkPreset === 'top' ? 'selected' : ''}>Oben zentriert (Standard)</option>
            <option value="top_left" ${bmkPreset === 'top_left' ? 'selected' : ''}>Oben links</option>
            <option value="top_right" ${bmkPreset === 'top_right' ? 'selected' : ''}>Oben rechts</option>
            <option value="bottom" ${bmkPreset === 'bottom' ? 'selected' : ''}>Unten zentriert</option>
            <option value="bottom_left" ${bmkPreset === 'bottom_left' ? 'selected' : ''}>Unten links</option>
            <option value="bottom_right" ${bmkPreset === 'bottom_right' ? 'selected' : ''}>Unten rechts</option>
            <option value="left" ${bmkPreset === 'left' ? 'selected' : ''}>Links daneben</option>
            <option value="right" ${bmkPreset === 'right' ? 'selected' : ''}>Rechts daneben</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Technische Kennwerte</label>
          <input class="form-input" id="propTechnical" value="${comp.technicalCharacteristics || ''}">
        </div>

        <div class="form-group" style="background: rgba(99, 179, 237, 0.08); padding: 8px; border-radius: 4px; border: 1px dashed var(--accent);">
          <label class="form-label" style="color: var(--accent-bright);">📦 Artikel aus Katalog zuweisen</label>
          <select class="form-input" id="propAssignPartSelect">
            <option value="">-- Hersteller-Artikel wählen --</option>
            ${MANUFACTURER_PARTS.map(p => `
              <option value="${p.id}" ${comp.articleNumber === p.articleNumber ? 'selected' : ''}>
                ${p.manufacturer} - ${p.articleNumber} (${p.name})
              </option>
            `).join('')}
          </select>
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
          <label class="form-label">Querverweis / Kontaktspiegel</label>
          <div style="padding: 8px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; font-family: monospace; font-size: 11px; color: var(--warning);">
            ${comp.crossRef || 'Keine Querverweise aktiv'}
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 14px;">
          <button class="btn btn-primary" id="btnPropApply" style="flex: 1; font-weight: 600; padding: 7px 10px; background: #38a169;">
            💾 Übernehmen (OK)
          </button>
        </div>

        <div style="display: flex; gap: 8px; margin-top: 8px;">
          <button class="btn" id="btnPropRotate" style="flex: 1;">🔄 90° Drehen</button>
          <button class="btn" id="btnPropDelete" style="flex: 1; border-color: var(--danger); color: var(--danger);">🗑️ Löschen</button>
        </div>
      `;

      // Form bindings
      document.getElementById('btnPropApply')?.addEventListener('click', () => {
        const bmkInput = document.getElementById('propBmk') as HTMLInputElement;
        if (bmkInput) comp.bmk = bmkInput.value.trim() || comp.bmk;

        const devInput = document.getElementById('propDeviceTag') as HTMLInputElement;
        if (devInput) comp.deviceTag = devInput.value.trim();

        const fnInput = document.getElementById('propFunctionText') as HTMLInputElement;
        if (fnInput) comp.functionText = fnInput.value.trim();

        const techInput = document.getElementById('propTechnical') as HTMLInputElement;
        if (techInput) comp.technicalCharacteristics = techInput.value.trim();

        const artInput = document.getElementById('propArticle') as HTMLInputElement;
        if (artInput) comp.articleNumber = artInput.value.trim();

        const mfrInput = document.getElementById('propManufacturer') as HTMLInputElement;
        if (mfrInput) comp.manufacturer = mfrInput.value.trim();

        const hlInput = document.getElementById('propHigherLevel') as HTMLInputElement;
        if (hlInput) comp.higherLevelFunction = hlInput.value.trim();

        const locInput = document.getElementById('propLocation') as HTMLInputElement;
        if (locInput) comp.mountingLocation = locInput.value.trim();

        this.notifyChange();
        this.updateFloatingSelectionBar();

        const applyBtn = document.getElementById('btnPropApply');
        if (applyBtn) {
          const orig = applyBtn.innerHTML;
          applyBtn.innerHTML = '✓ Übernommen!';
          setTimeout(() => { applyBtn.innerHTML = orig; }, 1200);
        }
      });

      document.getElementById('btnOpenFullPropModal')?.addEventListener('click', () => {
        this.openPropertiesDialog(comp);
      });

      document.getElementById('propBmk')?.addEventListener('input', (e) => {
        comp.bmk = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propDeviceTag')?.addEventListener('input', (e) => {
        comp.deviceTag = (e.target as HTMLInputElement).value;
        this.notifyChange();
      });
      document.getElementById('propQuickBmkPreset')?.addEventListener('change', (e) => {
        const preset = (e.target as HTMLSelectElement).value as any;
        if (!comp.bmkPosition) {
          comp.bmkPosition = { preset: 'top', visible: true };
        }
        comp.bmkPosition.preset = preset;
        this.notifyChange();
      });
      document.getElementById('propAssignPartSelect')?.addEventListener('change', (e) => {
        const partId = (e.target as HTMLSelectElement).value;
        const part = MANUFACTURER_PARTS.find(p => p.id === partId);
        if (part) {
          comp.manufacturer = part.manufacturer;
          comp.articleNumber = part.articleNumber;
          comp.technicalCharacteristics = part.technicalData;
          comp.functionText = part.name;
          this.notifyChange();
        }
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

  private renderArchiveInspectorTab(container: HTMLElement): void {
    container.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: var(--text-muted); text-transform: uppercase; margin-bottom: 8px;">
        Archiv & REA Inspektor
      </div>

      <div class="dropzone" id="archiveDropzone">
        <div style="font-size: 24px; margin-bottom: 8px;">📦</div>
        <div style="font-size: 12px; font-weight: 500;">Projekt- oder Archiv-Datei hier ablegen</div>
        <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">Unterstützt .zw1 (Backup), .edz (Makros), .xml, .elk</div>
      </div>

      <div id="inspectorDetails" style="font-size: 11px;">
        <div style="padding: 10px; background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 4px; line-height: 1.5; color: var(--text-muted);">
          <strong style="color: var(--accent-bright);">Unterstützte Formate:</strong><br>
          • <strong>.zw1:</strong> Komprimiertes Projektbackup (enthält .elk und *.edb Datenbankverzeichnis).<br>
          • <strong>.edz:</strong> Artikel- und Makropakete.<br>
          • <strong>XML:</strong> XML-Schema für Stromlaufpläne und Stammdaten.<br>
          • <strong>Querverweise:</strong> Automatische Berechnung von Kontaktspiegeln und Abbruchstellen nach DIN EN 81346.
        </div>
      </div>
    `;

    const dropzone = document.getElementById('archiveDropzone');
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
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
          await this.handleFilesOpen(files);
        }
      });
      dropzone.addEventListener('click', () => {
        document.getElementById('fileInput')?.click();
      });
    }
  }

  private async handleFileOpen(file: File): Promise<void> {
    await this.handleFilesOpen([file]);
  }

  private async handleFilesOpen(files: FileList | File[]): Promise<void> {
    try {
      const result: PackageInspectionResult = await PackageHandler.inspectFiles(files);
      
      if (result.extractedProject) {
        this.project = result.extractedProject;
        setProjectSymbolLibrary(this.project);
        this.selectedComponent = null;
        this.selectedWire = null;
        this.canvas.setProject(this.project);
        if (this.project.activePageId) {
          this.canvas.setPage(this.project.activePageId);
        }
        this.canvas.fitToScreen();
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
                ${result.entries.slice(0, 50).map(e => `<div>${e.type === 'elk' ? '⭐' : (e.type === 'edb' ? '📁' : '📄')} ${e.path}</div>`).join('')}
                ${result.entries.length > 50 ? `<div>... und ${result.entries.length - 50} weitere Einträge</div>` : ''}
              </div>
            </div>
          `;
        }

        const displayName = files.length > 1 ? `${files.length} Archivteile (${result.filename})` : (files[0]?.name || result.filename);
        detailsContainer.innerHTML = `
          <div style="padding: 10px; background-color: var(--bg-secondary); border: 1px solid var(--accent); border-radius: 4px;">
            <div style="font-weight: bold; color: var(--success); margin-bottom: 4px;">✓ ${displayName} erfolgreich analysiert</div>
            <div>Format: <strong>${result.format}</strong></div>
            <div>Projektname: <strong>${result.projectName}</strong></div>
            <div>Seiten im Projekt: <strong>${result.extractedProject?.pages.length || 0}</strong></div>
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

    setProjectSymbolLibrary(this.project);
    this.selectedComponent = null;
    this.selectedWire = null;
    this.canvas.setProject(this.project);
    this.updateUI();
  }

  private saveProjectJson(): void {
    const jsonStr = JSON.stringify(this.project, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    this.downloadBlob(blob, `${this.project.name}.json`);
  }

  private async exportZw1(): Promise<void> {
    const blob = await PackageHandler.exportToZw1(this.project);
    this.downloadBlob(blob, `${this.project.name}.zw1`);
  }

  private exportXml(): void {
    const xml = PackageHandler.generateProjectXml(this.project);
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
