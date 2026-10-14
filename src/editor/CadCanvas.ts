// src/editor/CadCanvas.ts
// Interactive SVG-based CAD drawing canvas for electrical schematics (EPLAN P8 style)

import { Project, Page, PlacedComponent, Wire } from '../model/types';
import { getSymbolById } from '../model/symbols';
import { CrossReferenceEngine } from '../model/CrossReferenceEngine';
import { AutoconnectEngine, AutoconnectPreviewSegment } from '../model/AutoconnectEngine';
import { computeBmkPosition, computeFunctionTextPosition, computeTechnicalDataPosition } from '../model/LabelLayout';

export type EditorMode = 'select' | 'wire' | 'place_symbol' | 'pan';

export interface CadCanvasCallbacks {
  onSelectComponent: (component: PlacedComponent | null) => void;
  onSelectWire: (wire: Wire | null) => void;
  onOpenProperties?: (component: PlacedComponent) => void;
  onOpenSymbolSelection?: () => void;
  onNavigateToPage?: (pageId: string) => void;
  onProjectModified: () => void;
}

export class CadCanvas {
  private container: HTMLElement;
  private svg: SVGSVGElement;
  private project: Project;
  private activePage: Page;
  private callbacks: CadCanvasCallbacks;

  // Viewport transformation
  private scale: number = 1.0;
  private panX: number = 20;
  private panY: number = 20;
  private isPanning: boolean = false;
  private startPan: { x: number; y: number } = { x: 0, y: 0 };

  // Editor State
  public mode: EditorMode = 'select';
  public gridSnap: boolean = true;
  public gridSize: number = 10; // 10px per raster unit
  public autoconnectEnabled: boolean = true;
  public activeSymbolToPlace: string | null = null;
  public ghostRotation: 0 | 90 | 180 | 270 = 0;
  public selectedComponentId: string | null = null;
  public selectedWireId: string | null = null;
  public hoveredPin: { componentId: string; pinId: string } | null = null;

  // Dragging components
  private isDraggingComponent: boolean = false;
  private dragOffset: { x: number; y: number } = { x: 0, y: 0 };

  // Wiring State
  private wireStart: { componentId: string; pinId: string } | null = null;
  private currentMousePos: { x: number; y: number } = { x: 0, y: 0 };

  // Touch gesture state
  private touchMode: 'none' | 'pan' | 'pinch' | 'drag' = 'none';
  private initialPinchDist: number = 0;
  private initialPinchScale: number = 1.0;
  private initialPinchCenter: { x: number; y: number } = { x: 0, y: 0 };
  private initialPan: { x: number; y: number } = { x: 0, y: 0 };
  private lastTapTime: number = 0;
  private lastTapComponentId: string | null = null;

  constructor(container: HTMLElement, project: Project, callbacks: CadCanvasCallbacks) {
    this.container = container;
    this.project = project;
    this.callbacks = callbacks;
    this.activePage = this.getOrCreateActivePage();

    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('class', 'cad-viewport');
    this.svg.style.width = '100%';
    this.svg.style.height = '100%';
    this.svg.style.display = 'block';
    this.svg.style.userSelect = 'none';
    this.svg.style.touchAction = 'none';
    this.container.appendChild(this.svg);

    this.bindEvents();
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.render();
  }

  public setPage(pageId: string): void {
    const page = this.project.pages.find(p => p.id === pageId);
    if (page) {
      this.activePage = page;
      this.project.activePageId = pageId;
      this.selectedComponentId = null;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(null);
      this.callbacks.onSelectWire(null);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.render();
    }
  }

  public setProject(project: Project): void {
    this.project = project;
    this.activePage = this.getOrCreateActivePage();
    this.selectedComponentId = null;
    this.selectedWireId = null;
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.render();
  }

  public setMode(mode: EditorMode): void {
    this.mode = mode;
    this.wireStart = null;
    this.render();
  }

  public setSymbolToPlace(symbolId: string): void {
    this.activeSymbolToPlace = symbolId;
    this.mode = 'place_symbol';
    this.ghostRotation = 0;
    this.render();
  }

  public zoomIn(): void {
    this.scale = Math.min(3.0, this.scale * 1.15);
    this.render();
  }

  public zoomOut(): void {
    this.scale = Math.max(0.3, this.scale / 1.15);
    this.render();
  }

  public resetZoom(): void {
    this.scale = 1.0;
    this.panX = 30;
    this.panY = 30;
    this.render();
  }

  public fitToScreen(): void {
    const rect = this.container.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      // Normblatt DIN A3 is roughly 1188 x 840
      const padding = 15;
      const scaleX = (rect.width - padding * 2) / 1200;
      const scaleY = (rect.height - padding * 2) / 850;
      this.scale = Math.max(0.2, Math.min(1.2, Math.min(scaleX, scaleY)));
      this.panX = Math.round((rect.width - 1200 * this.scale) / 2);
      this.panY = Math.round((rect.height - 850 * this.scale) / 2);
      this.render();
    }
  }

  public rotateSelected(delta: number = 90): void {
    if (!this.selectedComponentId) return;
    const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
    if (comp) {
      comp.rotation = (((comp.rotation || 0) + delta + 360) % 360) as any;
      AutoconnectEngine.clearSuppressedForComponent(this.activePage, comp.id);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  public duplicateSelected(): void {
    if (!this.selectedComponentId) return;
    const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
    if (!comp) return;

    const sym = getSymbolById(comp.symbolId);
    const existingCount = this.activePage.components.filter(c => c.symbolId === comp.symbolId).length;
    const prefix = sym?.defaultBmkPrefix || '-K';
    const newBmk = prefix ? `${prefix}${existingCount + 1}` : '';

    const newComp: PlacedComponent = {
      ...JSON.parse(JSON.stringify(comp)),
      id: 'comp_' + Math.random().toString(36).substring(2, 9),
      bmk: newBmk,
      x: comp.x + this.gridSize * 4,
      y: comp.y + this.gridSize * 4,
    };

    this.activePage.components.push(newComp);
    this.selectedComponentId = newComp.id;
    this.callbacks.onSelectComponent(newComp);
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.notifyModified();
    this.render();
  }

  public deleteSelected(): void {
    if (this.selectedComponentId) {
      this.activePage.components = this.activePage.components.filter(c => c.id !== this.selectedComponentId);
      // Remove attached wires
      this.activePage.wires = this.activePage.wires.filter(
        w => w.from.componentId !== this.selectedComponentId && w.to.componentId !== this.selectedComponentId
      );
      this.selectedComponentId = null;
      this.callbacks.onSelectComponent(null);
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    } else if (this.selectedWireId) {
      const wire = this.activePage.wires.find(w => w.id === this.selectedWireId);
      if (wire) {
        AutoconnectEngine.suppressAutoconnection(this.activePage, wire);
      }
      this.activePage.wires = this.activePage.wires.filter(w => w.id !== this.selectedWireId);
      this.selectedWireId = null;
      this.callbacks.onSelectWire(null);
      this.notifyModified();
      this.render();
    }
  }

  private getOrCreateActivePage(): Page {
    let page = this.project.pages.find(p => p.id === this.project.activePageId);
    if (!page && this.project.pages.length > 0) {
      page = this.project.pages[0];
      this.project.activePageId = page.id;
    }
    return page!;
  }

  private snap(val: number): number {
    if (!this.gridSnap) return Math.round(val);
    return Math.round(val / this.gridSize) * this.gridSize;
  }

  private screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect();
    const x = (clientX - rect.left - this.panX) / this.scale;
    const y = (clientY - rect.top - this.panY) / this.scale;
    return { x, y };
  }

  private bindEvents(): void {
    // Mouse events
    this.svg.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.svg.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.svg.addEventListener('dblclick', (e) => this.onDoubleClick(e));
    this.svg.addEventListener('contextmenu', (e) => this.onContextMenu(e));

    // Touch events for smartphone / tablet gestures
    this.svg.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
    window.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
    window.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });
    window.addEventListener('touchcancel', (e) => this.onTouchEnd(e), { passive: false });

    // Keyboard shortcuts (EPLAN P8 standard shortcuts)
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      
      if (e.key === 'Tab') {
        if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
          e.preventDefault();
          this.ghostRotation = ((this.ghostRotation + 90) % 360) as any;
          this.render();
        } else if (this.selectedComponentId) {
          e.preventDefault();
          this.rotateSelected();
        }
      } else if (e.key === 'Enter' || e.key === 'F2') {
        if (this.selectedComponentId) {
          const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
          if (comp) {
            e.preventDefault();
            this.callbacks.onOpenProperties?.(comp);
          }
        }
      } else if (e.key === 'Insert' || e.key === 'e' || e.key === 'E') {
        this.callbacks.onOpenSymbolSelection?.();
      } else if (e.key === 'w' || e.key === 'W' || e.key === 'd' || e.key === 'D') {
        this.setMode(this.mode === 'wire' ? 'select' : 'wire');
      } else if (e.key === 'f' || e.key === 'F') {
        this.fitToScreen();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelected();
      } else if (e.key === 'r' || e.key === 'R') {
        if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
          e.preventDefault();
          this.ghostRotation = ((this.ghostRotation + 90) % 360) as any;
          this.render();
        } else {
          this.rotateSelected();
        }
      } else if (e.key === 'Escape') {
        this.mode = 'select';
        this.wireStart = null;
        this.activeSymbolToPlace = null;
        this.render();
      } else if (e.ctrlKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        this.duplicateSelected();
      }
    });
  }

  private onDoubleClick(e: MouseEvent): void {
    const world = this.screenToWorld(e.clientX, e.clientY);
    const comp = this.findComponentAt(world.x, world.y);
    if (comp) {
      this.callbacks.onOpenProperties?.(comp);
    }
  }

  private onContextMenu(e: MouseEvent): void {
    e.preventDefault();
    const world = this.screenToWorld(e.clientX, e.clientY);
    const comp = this.findComponentAt(world.x, world.y);
    const wire = this.findWireAt(world.x, world.y);

    if (comp) {
      this.selectedComponentId = comp.id;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(comp);
      this.callbacks.onSelectWire(null);
      this.render();
    } else if (wire) {
      this.selectedWireId = wire.id;
      this.selectedComponentId = null;
      this.callbacks.onSelectWire(wire);
      this.callbacks.onSelectComponent(null);
      this.render();
    }

    this.showContextMenu(e.clientX, e.clientY, comp, wire);
  }

  private showContextMenu(clientX: number, clientY: number, comp: PlacedComponent | null, wire: Wire | null): void {
    const existing = document.getElementById('eplanContextMenu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'eplanContextMenu';
    menu.className = 'eplan-context-menu';
    menu.style.position = 'fixed';
    menu.style.left = `${clientX}px`;
    menu.style.top = `${clientY}px`;
    menu.style.zIndex = '3000';

    let items = '';
    if (comp) {
      const sym = getSymbolById(comp.symbolId);
      items += `
        <div class="ctx-header"><strong>${comp.bmk}</strong> (${sym?.name || 'Bauteil'})</div>
        <div class="ctx-item" data-action="properties">⚙️ Eigenschaften... <span class="ctx-key">DblClick</span></div>
        <div class="ctx-item" data-action="rotate">🔄 Um 90° drehen <span class="ctx-key">R</span></div>
        <div class="ctx-item" data-action="duplicate">📋 Duplizieren <span class="ctx-key">Strg+D</span></div>
        ${comp.crossRef ? `<div class="ctx-item" data-action="jump-crossref">🔗 Querverweis folgen (${comp.crossRef})</div>` : ''}
        <div class="ctx-sep"></div>
        <div class="ctx-item ctx-danger" data-action="delete">🗑️ Löschen <span class="ctx-key">Entf</span></div>
      `;
    } else if (wire) {
      items += `
        <div class="ctx-header">Verbindung: <strong>${wire.potential}</strong></div>
        <div class="ctx-item" data-action="delete">🗑️ Verbindung löschen <span class="ctx-key">Entf</span></div>
      `;
    } else {
      items += `
        <div class="ctx-item" data-action="insert-sym">➕ Symbol einfügen... <span class="ctx-key">Einfg</span></div>
        <div class="ctx-item" data-action="wire">🔌 Verbinden / Verdrahten <span class="ctx-key">D</span></div>
        <div class="ctx-sep"></div>
        <div class="ctx-item" data-action="fit">🔍 Ansicht: Ganzes Blatt <span class="ctx-key">F</span></div>
        <div class="ctx-item" data-action="reset-zoom">📐 100% Zoom (1:1)</div>
        <div class="ctx-item" data-action="toggle-grid">📐 Rasterfang: ${this.gridSnap ? 'Aktiv (10px)' : 'Aus'}</div>
      `;
    }

    menu.innerHTML = items;
    document.body.appendChild(menu);

    const closeMenu = () => menu.remove();
    setTimeout(() => {
      window.addEventListener('click', closeMenu, { once: true });
      window.addEventListener('contextmenu', closeMenu, { once: true });
    }, 10);

    menu.querySelectorAll('.ctx-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        closeMenu();
        if (action === 'properties' && comp) {
          this.callbacks.onOpenProperties?.(comp);
        } else if (action === 'rotate') {
          this.rotateSelected();
        } else if (action === 'duplicate') {
          this.duplicateSelected();
        } else if (action === 'delete') {
          this.deleteSelected();
        } else if (action === 'insert-sym') {
          this.callbacks.onOpenSymbolSelection?.();
        } else if (action === 'wire') {
          this.setMode('wire');
        } else if (action === 'fit') {
          this.fitToScreen();
        } else if (action === 'reset-zoom') {
          this.resetZoom();
        } else if (action === 'toggle-grid') {
          this.gridSnap = !this.gridSnap;
          this.render();
        } else if (action === 'jump-crossref' && comp?.crossRef) {
          const match = comp.crossRef.match(/\/(\d+)/);
          if (match) {
            const pageNum = match[1];
            const targetPage = this.project.pages.find(p => p.pageNumber === pageNum);
            if (targetPage && this.callbacks.onNavigateToPage) {
              this.callbacks.onNavigateToPage(targetPage.id);
            }
          }
        }
      });
    });
  }

  public placeSymbolAt(worldX: number, worldY: number): PlacedComponent | null {
    if (!this.activeSymbolToPlace) return null;
    const sym = getSymbolById(this.activeSymbolToPlace);
    if (!sym) return null;

    const existingCount = this.activePage.components.filter(c => c.symbolId === sym.id).length;
    const prefix = sym.defaultBmkPrefix || '';
    const bmk = prefix ? `${prefix}${existingCount + 1}` : '';

    const newComp: PlacedComponent = {
      id: 'comp_' + Math.random().toString(36).substring(2, 9),
      symbolId: sym.id,
      bmk,
      higherLevelFunction: this.activePage.higherLevel,
      mountingLocation: this.activePage.location,
      functionText: sym.defaultFunctionText,
      technicalCharacteristics: sym.technicalCharacteristics || '',
      articleNumber: sym.articleNumber || '',
      manufacturer: sym.manufacturer || '',
      x: this.snap(worldX),
      y: this.snap(worldY),
      rotation: this.ghostRotation || 0,
      pins: {}
    };

    this.activePage.components.push(newComp);
    this.selectedComponentId = newComp.id;
    this.callbacks.onSelectComponent(newComp);
    if (this.autoconnectEnabled) {
      AutoconnectEngine.updatePageAutoconnections(this.activePage);
    }
    this.notifyModified();
    this.render();
    return newComp;
  }

  private handlePinClick(clickedPin: { componentId: string; pinId: string }): void {
    if (this.mode === 'wire' || this.wireStart !== null) {
      if (!this.wireStart) {
        this.wireStart = clickedPin;
        this.mode = 'wire';
      } else if (this.wireStart.componentId !== clickedPin.componentId || this.wireStart.pinId !== clickedPin.pinId) {
        // Complete wire
        const wire: Wire = {
          id: 'w_' + Math.random().toString(36).substring(2, 9),
          from: this.wireStart,
          to: clickedPin,
          potential: 'L1',
          color: 'BK',
          crossSection: '1.5mm²'
        };
        this.activePage.wires.push(wire);
        this.wireStart = null;
        this.notifyModified();
      }
      this.render();
    }
  }

  private onMouseDown(e: MouseEvent): void {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+Click -> Pan
      this.isPanning = true;
      this.startPan = { x: e.clientX - this.panX, y: e.clientY - this.panY };
      return;
    }

    if (e.button !== 0) return;

    const world = this.screenToWorld(e.clientX, e.clientY);

    if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
      this.placeSymbolAt(world.x, world.y);
      return;
    }

    // Check if clicked on a pin only in wire mode
    if (this.mode === 'wire' || this.wireStart !== null) {
      const clickedPin = this.findPinAt(world.x, world.y);
      if (clickedPin) {
        this.handlePinClick(clickedPin);
        return;
      }
    }

    // Check if clicked on a component
    const clickedComp = this.findComponentAt(world.x, world.y, false);
    if (clickedComp) {
      this.selectedComponentId = clickedComp.id;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(clickedComp);
      this.callbacks.onSelectWire(null);

      this.isDraggingComponent = true;
      this.dragOffset = {
        x: world.x - clickedComp.x,
        y: world.y - clickedComp.y
      };
      this.updateSelectionClasses();
      return;
    }

    // Check if clicked on a wire
    const clickedWire = this.findWireAt(world.x, world.y);
    if (clickedWire) {
      this.selectedWireId = clickedWire.id;
      this.selectedComponentId = null;
      this.callbacks.onSelectWire(clickedWire);
      this.callbacks.onSelectComponent(null);
      this.updateSelectionClasses();
      return;
    }

    // Clicked empty background
    this.selectedComponentId = null;
    this.selectedWireId = null;
    this.callbacks.onSelectComponent(null);
    this.callbacks.onSelectWire(null);
    this.updateSelectionClasses();
  }

  private onMouseMove(e: MouseEvent): void {
    if (this.isPanning) {
      this.panX = e.clientX - this.startPan.x;
      this.panY = e.clientY - this.startPan.y;
      this.render();
      return;
    }

    const world = this.screenToWorld(e.clientX, e.clientY);
    this.currentMousePos = world;

    if (this.isDraggingComponent && this.selectedComponentId) {
      const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
      if (comp) {
        const sym = getSymbolById(comp.symbolId);
        comp.x = this.snap(world.x - this.dragOffset.x);
        comp.y = this.snap(world.y - this.dragOffset.y);
        const el = this.svg.getElementById(comp.id);
        if (el && sym) {
          el.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})`);
        }
        this.updateConnectedWiresFast(comp.id);
        this.updateAutoconnectPreviewLayer();
      }
      return;
    }

    // Check hovered pin for visual snap highlight
    const pin = this.findPinAt(world.x, world.y);
    const pinChanged = (pin?.componentId !== this.hoveredPin?.componentId || pin?.pinId !== this.hoveredPin?.pinId);
    if (pinChanged) {
      this.hoveredPin = pin;
    }

    if (this.mode === 'place_symbol' || this.wireStart || pinChanged) {
      this.render();
    }
  }

  private onMouseUp(): void {
    if (this.isPanning) {
      this.isPanning = false;
    }
    if (this.isDraggingComponent) {
      this.isDraggingComponent = false;
      if (this.selectedComponentId) {
        AutoconnectEngine.clearSuppressedForComponent(this.activePage, this.selectedComponentId);
      }
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const newScale = Math.max(0.3, Math.min(3.0, this.scale * zoomFactor));
    this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
    this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
    this.scale = newScale;
    this.render();
  }

  private onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 2) {
      e.preventDefault();
      this.touchMode = 'pinch';
      this.isDraggingComponent = false;
      this.isPanning = false;

      const t0 = e.touches[0];
      const t1 = e.touches[1];
      this.initialPinchDist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      this.initialPinchScale = this.scale;
      this.initialPinchCenter = {
        x: (t0.clientX + t1.clientX) / 2,
        y: (t0.clientY + t1.clientY) / 2
      };
      this.initialPan = { x: this.panX, y: this.panY };
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const world = this.screenToWorld(touch.clientX, touch.clientY);

      // Symbol placing
      if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
        e.preventDefault();
        this.placeSymbolAt(world.x, world.y);
        this.mode = 'select';
        return;
      }

      // Check pin in wire mode only
      if (this.mode === 'wire' || this.wireStart !== null) {
        const clickedPin = this.findPinAt(world.x, world.y);
        if (clickedPin) {
          e.preventDefault();
          this.handlePinClick(clickedPin);
          return;
        }
      }

      // Check component (with finger touch hitbox padding)
      const clickedComp = this.findComponentAt(world.x, world.y, true);
      if (clickedComp) {
        e.preventDefault();
        this.selectedComponentId = clickedComp.id;
        this.selectedWireId = null;
        this.callbacks.onSelectComponent(clickedComp);
        this.callbacks.onSelectWire(null);

        // Touch double-tap detection to open properties on mobile
        const now = Date.now();
        if (now - this.lastTapTime < 350 && this.lastTapComponentId === clickedComp.id) {
          this.callbacks.onOpenProperties?.(clickedComp);
          this.lastTapTime = 0;
          this.lastTapComponentId = null;
          return;
        }
        this.lastTapTime = now;
        this.lastTapComponentId = clickedComp.id;

        this.touchMode = 'drag';
        this.isDraggingComponent = true;
        this.dragOffset = {
          x: world.x - clickedComp.x,
          y: world.y - clickedComp.y
        };
        // DO NOT call this.render() here: keeping DOM intact avoids cancelling touch stream in Mobile Chrome
        this.updateSelectionClasses();
        return;
      }

      // Check wire (with touch padding)
      const clickedWire = this.findWireAt(world.x, world.y, true);
      if (clickedWire) {
        e.preventDefault();
        this.selectedWireId = clickedWire.id;
        this.selectedComponentId = null;
        this.callbacks.onSelectWire(clickedWire);
        this.callbacks.onSelectComponent(null);
        this.updateSelectionClasses();
        return;
      }

      // 1-finger pan on empty background
      this.touchMode = 'pan';
      this.isPanning = true;
      this.startPan = { x: touch.clientX - this.panX, y: touch.clientY - this.panY };
      this.selectedComponentId = null;
      this.selectedWireId = null;
      this.callbacks.onSelectComponent(null);
      this.callbacks.onSelectWire(null);
      this.updateSelectionClasses();
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (e.touches.length === 2 && this.touchMode === 'pinch') {
      e.preventDefault();
      const t0 = e.touches[0];
      const t1 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (this.initialPinchDist > 0) {
        const pinchFactor = dist / this.initialPinchDist;
        const targetScale = Math.max(0.2, Math.min(3.5, this.initialPinchScale * pinchFactor));

        const centerScreenX = (t0.clientX + t1.clientX) / 2;
        const centerScreenY = (t0.clientY + t1.clientY) / 2;
        const deltaCenterX = centerScreenX - this.initialPinchCenter.x;
        const deltaCenterY = centerScreenY - this.initialPinchCenter.y;

        const rect = this.svg.getBoundingClientRect();
        const originX = this.initialPinchCenter.x - rect.left;
        const originY = this.initialPinchCenter.y - rect.top;

        this.panX = originX - (originX - this.initialPan.x) * (targetScale / this.initialPinchScale) + deltaCenterX;
        this.panY = originY - (originY - this.initialPan.y) * (targetScale / this.initialPinchScale) + deltaCenterY;
        this.scale = targetScale;

        this.render();
      }
      return;
    }

    if (e.touches.length === 1) {
      const touch = e.touches[0];
      if (this.touchMode === 'pan' && this.isPanning) {
        e.preventDefault();
        this.panX = touch.clientX - this.startPan.x;
        this.panY = touch.clientY - this.startPan.y;
        this.render();
        return;
      }

      if (this.touchMode === 'drag' && this.isDraggingComponent && this.selectedComponentId) {
        e.preventDefault();
        const world = this.screenToWorld(touch.clientX, touch.clientY);
        const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
        if (comp) {
          const sym = getSymbolById(comp.symbolId);
          comp.x = this.snap(world.x - this.dragOffset.x);
          comp.y = this.snap(world.y - this.dragOffset.y);
          // Fast DOM update for smooth 60fps drag without replacing innerHTML:
          const el = this.svg.getElementById(comp.id);
          if (el && sym) {
            el.setAttribute('transform', `translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})`);
          }
          this.updateConnectedWiresFast(comp.id);
          this.updateAutoconnectPreviewLayer();
        }
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    if (this.touchMode === 'pinch' && e.touches.length < 2) {
      this.touchMode = 'none';
    }

    if (this.touchMode === 'pan') {
      this.isPanning = false;
      this.touchMode = 'none';
    }

    if (this.touchMode === 'drag') {
      this.isDraggingComponent = false;
      this.touchMode = 'none';
      if (this.selectedComponentId) {
        AutoconnectEngine.clearSuppressedForComponent(this.activePage, this.selectedComponentId);
      }
      if (this.autoconnectEnabled) {
        AutoconnectEngine.updatePageAutoconnections(this.activePage);
      }
      this.notifyModified();
      this.render();
    }
  }

  private updateSelectionClasses(): void {
    this.svg.querySelectorAll('.component').forEach(el => {
      const isSel = el.id === this.selectedComponentId;
      el.classList.toggle('selected', isSel);
      const selRect = el.querySelector('.selection-rect') as SVGElement | null;
      if (selRect) {
        selRect.style.display = isSel ? 'block' : 'none';
      }
    });
    this.svg.querySelectorAll('.wire').forEach(el => {
      el.classList.toggle('selected', el.id === this.selectedWireId);
    });
  }

  private updateConnectedWiresFast(componentId: string): void {
    for (const wire of this.activePage.wires) {
      if (wire.from.componentId === componentId || wire.to.componentId === componentId) {
        const p1 = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
        const p2 = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
        if (p1 && p2) {
          const wireEl = this.svg.getElementById(wire.id);
          const pathEl = wireEl?.querySelector('path');
          if (pathEl) {
            const midY = (p1.y + p2.y) / 2;
            pathEl.setAttribute('d', `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`);
          }
        }
      }
    }
  }

  private notifyModified(): void {
    CrossReferenceEngine.updateProjectCrossReferences(this.project);
    this.callbacks.onProjectModified();
  }

  private findComponentAt(x: number, y: number, isTouch: boolean = false): PlacedComponent | null {
    const pad = isTouch ? 20 : 6;
    for (let i = this.activePage.components.length - 1; i >= 0; i--) {
      const comp = this.activePage.components[i];
      const sym = getSymbolById(comp.symbolId);
      if (!sym) continue;
      
      const rot = comp.rotation || 0;
      const cx = comp.x + sym.width / 2;
      const cy = comp.y + sym.height / 2;
      let halfW = sym.width / 2;
      let halfH = sym.height / 2;
      if (rot === 90 || rot === 270) {
        halfW = sym.height / 2;
        halfH = sym.width / 2;
      }

      if (x >= cx - halfW - pad && x <= cx + halfW + pad && y >= cy - halfH - pad && y <= cy + halfH + pad) {
        return comp;
      }
    }
    return null;
  }

  private findPinAt(x: number, y: number): { componentId: string; pinId: string } | null {
    const pinRadius = 8;
    for (const comp of this.activePage.components) {
      const sym = getSymbolById(comp.symbolId);
      if (!sym) continue;
      for (const pin of sym.pins) {
        const pCoord = this.getPinCoordinates(comp.id, pin.id);
        if (!pCoord) continue;
        const dist = Math.hypot(x - pCoord.x, y - pCoord.y);
        if (dist <= pinRadius) {
          return { componentId: comp.id, pinId: pin.id };
        }
      }
    }
    return null;
  }

  private findWireAt(x: number, y: number, isTouch: boolean = false): Wire | null {
    const hitTolerance = isTouch ? 22 : 12;
    for (const wire of this.activePage.wires) {
      const p1 = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
      const p2 = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
      if (!p1 || !p2) continue;

      if (p1.x === p2.x || p1.y === p2.y) {
        const d = this.distToSegment(x, y, p1.x, p1.y, p2.x, p2.y);
        if (d < hitTolerance) return wire;
      } else {
        const midY = (p1.y + p2.y) / 2;
        const d1 = this.distToSegment(x, y, p1.x, p1.y, p1.x, midY);
        const d2 = this.distToSegment(x, y, p1.x, midY, p2.x, midY);
        const d3 = this.distToSegment(x, y, p2.x, midY, p2.x, p2.y);
        if (d1 < hitTolerance || d2 < hitTolerance || d3 < hitTolerance) {
          return wire;
        }
      }
    }
    return null;
  }

  private distToSegment(x: number, y: number, x1: number, y1: number, x2: number, y2: number): number {
    const l2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    if (l2 === 0) return Math.hypot(x - x1, y - y1);
    let t = ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1)));
  }

  public getPinCoordinates(componentId: string, pinId: string): { x: number; y: number } | null {
    const comp = this.activePage.components.find(c => c.id === componentId);
    if (!comp) return null;
    const sym = getSymbolById(comp.symbolId);
    if (!sym) return null;
    const pin = sym.pins.find(p => p.id === pinId);
    if (!pin) return null;

    const info = AutoconnectEngine.getRotatedPinInfo(comp, pin, sym);
    return { x: info.worldX, y: info.worldY };
  }

  /**
   * Main rendering loop (generates SVG DOM elements)
   */
  public render(): void {
    const pageWidth = this.activePage.plotFrame.width;
    const pageHeight = this.activePage.plotFrame.height;

    this.svg.innerHTML = `
      <defs>
        <pattern id="cadGrid" width="${this.gridSize}" height="${this.gridSize}" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.75" fill="#4a5568"/>
        </pattern>
      </defs>
      <g id="viewportTransform" transform="translate(${this.panX}, ${this.panY}) scale(${this.scale})">
        <!-- Page Paper -->
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="#1a202c" stroke="#2d3748" stroke-width="2"/>
        <rect x="0" y="0" width="${pageWidth}" height="${pageHeight}" fill="url(#cadGrid)"/>
        
        <!-- EPLAN DIN A3 Normblatt Plot Frame -->
        ${this.renderPlotFrame(pageWidth, pageHeight)}

        <!-- Wires -->
        <g id="wiresLayer">
          ${this.renderWires()}
        </g>

        <!-- Components -->
        <g id="componentsLayer">
          ${this.renderComponents()}
        </g>

        <!-- Live Autoconnect Previews (EPLAN Cyan Dashed Guide Lines & Targets) -->
        <g id="autoconnectPreviewLayer">
          ${this.renderAutoconnectPreview()}
        </g>

        <!-- Interactive Temp Wire -->
        ${this.renderInteractiveWire()}

        <!-- Pin Hover Snap Highlight -->
        ${this.renderHoveredPin()}

        <!-- Ghost Symbol under Cursor (EPLAN P8 Placement Preview) -->
        ${this.renderGhostSymbol()}
      </g>
    `;
  }

  private renderPlotFrame(w: number, h: number): string {
    const margin = 20;
    const innerMargin = 30;
    const cols = 10;
    const colWidth = (w - 2 * innerMargin) / cols;

    let colHeaders = '';
    for (let i = 0; i < cols; i++) {
      const cx = innerMargin + i * colWidth + colWidth / 2;
      colHeaders += `
        <text x="${cx}" y="${innerMargin - 5}" font-size="10" font-family="monospace" fill="#a0aec0" text-anchor="middle">${i}</text>
        <text x="${cx}" y="${h - innerMargin + 12}" font-size="10" font-family="monospace" fill="#a0aec0" text-anchor="middle">${i}</text>
        <line x1="${innerMargin + i * colWidth}" y1="${innerMargin - 10}" x2="${innerMargin + i * colWidth}" y2="${innerMargin}" stroke="#4a5568" stroke-width="1"/>
      `;
    }

    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const rowHeight = (h - 2 * innerMargin - 60) / rows.length;
    let rowHeaders = '';
    for (let r = 0; r < rows.length; r++) {
      const ry = innerMargin + r * rowHeight + rowHeight / 2;
      rowHeaders += `
        <text x="${innerMargin - 8}" y="${ry + 3}" font-size="10" font-family="monospace" fill="#a0aec0" text-anchor="middle">${rows[r]}</text>
        <text x="${w - innerMargin + 8}" y="${ry + 3}" font-size="10" font-family="monospace" fill="#a0aec0" text-anchor="middle">${rows[r]}</text>
      `;
    }

    // Title Block (Schriftfeld nach DIN EN ISO 7200)
    const tbWidth = 320;
    const tbHeight = 65;
    const tbX = w - innerMargin - tbWidth;
    const tbY = h - innerMargin - tbHeight;
    const tb = this.activePage.plotFrame.titleBlock;

    const titleBlock = `
      <g id="titleBlock" transform="translate(${tbX}, ${tbY})">
        <rect x="0" y="0" width="${tbWidth}" height="${tbHeight}" fill="#171923" stroke="#e2e8f0" stroke-width="1.5"/>
        <line x1="0" y1="22" x2="${tbWidth}" y2="22" stroke="#4a5568"/>
        <line x1="0" y1="44" x2="${tbWidth}" y2="44" stroke="#4a5568"/>
        <line x1="160" y1="0" x2="160" y2="44" stroke="#4a5568"/>
        <line x1="240" y1="22" x2="240" y2="${tbHeight}" stroke="#4a5568"/>
        
        <!-- Texts in Titleblock -->
        <text x="6" y="14" font-size="11" font-weight="bold" fill="#63b3ed">${tb.company || 'EPLAN Electric Suite'}</text>
        <text x="166" y="14" font-size="9" fill="#e2e8f0">Kommission: ${tb.commission}</text>
        
        <text x="6" y="36" font-size="9" fill="#cbd5e0">Projekt: ${tb.projectTitle}</text>
        <text x="166" y="36" font-size="8" fill="#a0aec0">Datum: ${tb.date}</text>
        <text x="246" y="36" font-size="8" fill="#a0aec0">Gez.: ${tb.author}</text>
        
        <text x="6" y="56" font-size="11" font-weight="bold" fill="#f6e05e">${this.activePage.title}</text>
        <text x="246" y="58" font-size="11" font-weight="bold" fill="#ffffff">Blatt: ${this.activePage.pageNumber} / ${tb.totalSheets}</text>
      </g>
    `;

    return `
      <!-- Normblatt Outer & Inner Border -->
      <rect x="${margin}" y="${margin}" width="${w - 2 * margin}" height="${h - 2 * margin}" fill="none" stroke="#718096" stroke-width="1.5"/>
      <rect x="${innerMargin}" y="${innerMargin}" width="${w - 2 * innerMargin}" height="${h - 2 * innerMargin}" fill="none" stroke="#4a5568" stroke-width="1"/>
      ${colHeaders}
      ${rowHeaders}
      ${titleBlock}
    `;
  }

  private renderComponents(): string {
    return this.activePage.components.map(comp => {
      const sym = getSymbolById(comp.symbolId);
      if (!sym) return '';

      const isConn = sym.category === 'connections';
      const isSelected = comp.id === this.selectedComponentId;
      const strokeColor = isSelected ? '#63b3ed' : '#e2e8f0';

      const bmkPos = computeBmkPosition(comp, sym);
      const fnPos = computeFunctionTextPosition(comp, sym);
      const techPos = computeTechnicalDataPosition(comp, sym);
      const techText = comp.deviceTag
        ? (comp.deviceTag + (comp.technicalCharacteristics ? ' · ' + comp.technicalCharacteristics : ''))
        : (comp.technicalCharacteristics || '');
      const hasTech = Boolean(techPos.visible && techText);

      // Cross Reference text / Contact mirror (placed below technical data)
      let crossRefDisplay = '';
      if (comp.crossRef && !isConn) {
        const crossRefY = sym.height + (hasTech ? 38 : 24);
        crossRefDisplay = `<text x="${sym.width / 2}" y="${crossRefY}" font-size="8" font-family="monospace" fill="#f6ad55" text-anchor="middle">${comp.crossRef}</text>`;
      }

      // Pins render
      const pinsSvg = sym.pins.map(pin => {
        if (isConn) {
          return `
            <g class="pin" transform="translate(${pin.x}, ${pin.y})">
              <circle cx="0" cy="0" r="3" fill="transparent"/>
            </g>
          `;
        }
        return `
          <g class="pin" transform="translate(${pin.x}, ${pin.y})">
            <circle cx="0" cy="0" r="3.5" fill="#2d3748" stroke="#63b3ed" stroke-width="1.5"/>
            <text x="${pin.direction === 'top' ? 0 : 6}" y="${pin.direction === 'top' ? -5 : 4}" font-size="7" font-family="monospace" fill="#a0aec0" text-anchor="${pin.direction === 'top' ? 'middle' : 'start'}">${pin.name}</text>
          </g>
        `;
      }).join('');

      return `
        <g id="${comp.id}" class="component ${isSelected ? 'selected' : ''}" 
           transform="translate(${comp.x}, ${comp.y}) rotate(${comp.rotation || 0}, ${sym.width / 2}, ${sym.height / 2})"
           style="cursor: pointer;">
          
          <!-- Selection Highlight -->
          <rect class="selection-rect" x="-8" y="-8" width="${sym.width + 16}" height="${isConn ? sym.height + 16 : sym.height + 36}" fill="rgba(99, 179, 237, 0.15)" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="3,2" rx="4" style="display: ${isSelected ? 'block' : 'none'};"/>

          ${!isConn ? `
            <!-- BMK Label (z.B. -K1, -Q1) -->
            ${bmkPos.visible ? `
              <text x="${bmkPos.x}" y="${bmkPos.y}" font-size="${bmkPos.fontSize}" font-weight="bold" font-family="monospace" fill="#f6e05e" text-anchor="${bmkPos.anchor}" ${bmkPos.transform}>${comp.bmk}</text>
            ` : ''}
            
            <!-- Function text (Funktionstext) -->
            ${fnPos.visible && comp.functionText ? `
              <text x="${fnPos.x}" y="${fnPos.y}" font-size="${fnPos.fontSize}" font-family="sans-serif" fill="#e2e8f0" text-anchor="${fnPos.anchor}" ${fnPos.transform}>${comp.functionText}</text>
            ` : ''}

            <!-- Device Tag / Technical Characteristics -->
            ${techPos.visible && techText ? `
              <text x="${techPos.x}" y="${techPos.y}" font-size="${techPos.fontSize}" font-family="sans-serif" fill="#68d391" text-anchor="${techPos.anchor}" ${techPos.transform}>${techText}</text>
            ` : ''}

            <!-- Cross Reference -->
            ${crossRefDisplay}
          ` : (sym.id.startsWith('potential_arrow') ? `
            <text x="${sym.width / 2}" y="-4" font-size="9" font-weight="bold" font-family="monospace" fill="#63b3ed" text-anchor="middle">${comp.functionText || comp.bmk}</text>
          ` : '')}

          <!-- Symbol Vector Graphics -->
          <g color="${strokeColor}">
            ${sym.svgContent}
          </g>

          <!-- Terminal Pins -->
          ${pinsSvg}
        </g>
      `;
    }).join('');
  }

  private renderWires(): string {
    const coordCounts = new Map<string, number>();
    for (const wire of this.activePage.wires) {
      const p1 = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
      const p2 = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
      if (p1) {
        const k1 = `${p1.x},${p1.y}`;
        coordCounts.set(k1, (coordCounts.get(k1) || 0) + 1);
      }
      if (p2) {
        const k2 = `${p2.x},${p2.y}`;
        coordCounts.set(k2, (coordCounts.get(k2) || 0) + 1);
      }
    }

    const junctionDotsHtml: string[] = [];
    coordCounts.forEach((count, key) => {
      if (count >= 2) {
        const [x, y] = key.split(',').map(Number);
        junctionDotsHtml.push(`
          <circle cx="${x}" cy="${y}" r="3.5" fill="#e2e8f0" stroke="#1a202c" stroke-width="1" class="junction-dot"/>
        `);
      }
    });

    const wiresHtml = this.activePage.wires.map(wire => {
      const p1 = this.getPinCoordinates(wire.from.componentId, wire.from.pinId);
      const p2 = this.getPinCoordinates(wire.to.componentId, wire.to.pinId);
      if (!p1 || !p2) return '';

      const isSelected = wire.id === this.selectedWireId;
      const wireColor = this.getWireColor(wire.potential, wire.color);

      let pathData = '';
      if (p1.x === p2.x || p1.y === p2.y) {
        pathData = `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`;
      } else {
        const midY = (p1.y + p2.y) / 2;
        pathData = `M ${p1.x} ${p1.y} L ${p1.x} ${midY} L ${p2.x} ${midY} L ${p2.x} ${p2.y}`;
      }

      return `
        <g id="${wire.id}" class="wire ${isSelected ? 'selected' : ''}" style="cursor: pointer;">
          <!-- Hit area -->
          <path d="${pathData}" fill="none" stroke="transparent" stroke-width="12"/>
          <!-- Active Wire -->
          <path d="${pathData}" fill="none" stroke="${isSelected ? '#63b3ed' : wireColor}" stroke-width="${isSelected ? 2.5 : 2}"/>
        </g>
      `;
    }).join('');

    return wiresHtml + junctionDotsHtml.join('');
  }

  private renderAutoconnectPreview(): string {
    let previews: AutoconnectPreviewSegment[] = [];

    if (this.mode === 'place_symbol' && this.activeSymbolToPlace) {
      const gx = this.snap(this.currentMousePos.x);
      const gy = this.snap(this.currentMousePos.y);
      const tempComp: PlacedComponent = {
        id: '__ghost__',
        symbolId: this.activeSymbolToPlace,
        bmk: '',
        functionText: '',
        x: gx,
        y: gy,
        rotation: this.ghostRotation || 0,
        pins: {}
      };
      previews = AutoconnectEngine.getAutoconnectPreview(this.activePage.components, tempComp);
    } else if (this.isDraggingComponent && this.selectedComponentId) {
      const comp = this.activePage.components.find(c => c.id === this.selectedComponentId);
      if (comp) {
        previews = AutoconnectEngine.getAutoconnectPreview(this.activePage.components, comp);
      }
    }

    if (previews.length === 0) return '';

    return previews.map(p => `
      <g class="autoconnect-preview" pointer-events="none">
        <line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="#00f0ff" stroke-width="2" stroke-dasharray="4,3"/>
        <circle cx="${p.targetX}" cy="${p.targetY}" r="7" fill="rgba(0, 240, 255, 0.25)" stroke="#00f0ff" stroke-width="1.5"/>
        <circle cx="${p.targetX}" cy="${p.targetY}" r="3" fill="#00f0ff"/>
        <circle cx="${p.x1}" cy="${p.y1}" r="3" fill="#00f0ff"/>
      </g>
    `).join('');
  }

  private updateAutoconnectPreviewLayer(): void {
    const layer = this.svg.getElementById('autoconnectPreviewLayer');
    if (layer) {
      layer.innerHTML = this.renderAutoconnectPreview();
    }
  }

  private renderInteractiveWire(): string {
    if (!this.wireStart) return '';
    const startCoord = this.getPinCoordinates(this.wireStart.componentId, this.wireStart.pinId);
    if (!startCoord) return '';

    const midY = (startCoord.y + this.currentMousePos.y) / 2;
    const pathData = `M ${startCoord.x} ${startCoord.y} L ${startCoord.x} ${midY} L ${this.currentMousePos.x} ${midY} L ${this.currentMousePos.x} ${this.currentMousePos.y}`;

    return `
      <path d="${pathData}" fill="none" stroke="#63b3ed" stroke-width="2" stroke-dasharray="4,4"/>
      <circle cx="${startCoord.x}" cy="${startCoord.y}" r="4" fill="#63b3ed"/>
      <circle cx="${this.currentMousePos.x}" cy="${this.currentMousePos.y}" r="3" fill="#63b3ed"/>
    `;
  }

  private getWireColor(potential: string, customColor?: string): string {
    if (customColor) {
      if (customColor === 'RD') return '#fc8181';
      if (customColor === 'BU') return '#63b3ed';
      if (customColor === 'GNYE') return '#68d391';
      if (customColor === 'BK') return '#e2e8f0';
    }
    if (potential === 'PE') return '#68d391';
    if (potential === 'N') return '#63b3ed';
    if (potential === '+24V') return '#fc8181';
    if (potential === '0V') return '#4299e1';
    return '#cbd5e0';
  }

  private renderHoveredPin(): string {
    if (!this.hoveredPin) return '';
    const coord = this.getPinCoordinates(this.hoveredPin.componentId, this.hoveredPin.pinId);
    if (!coord) return '';

    return `
      <g class="pin-hover-marker" transform="translate(${coord.x}, ${coord.y})" pointer-events="none">
        <circle cx="0" cy="0" r="8" fill="none" stroke="#68d391" stroke-width="2" stroke-dasharray="3,2"/>
        <circle cx="0" cy="0" r="2.5" fill="#68d391"/>
      </g>
    `;
  }

  private renderGhostSymbol(): string {
    if (this.mode !== 'place_symbol' || !this.activeSymbolToPlace) return '';
    const sym = getSymbolById(this.activeSymbolToPlace);
    if (!sym) return '';

    const gx = this.snap(this.currentMousePos.x);
    const gy = this.snap(this.currentMousePos.y);

    const existingCount = this.activePage.components.filter(c => c.symbolId === sym.id).length;
    const prefix = sym.defaultBmkPrefix || '';
    const bmk = prefix ? `${prefix}${existingCount + 1}` : sym.name;

    return `
      <g id="ghostLayer" transform="translate(${gx}, ${gy}) rotate(${this.ghostRotation || 0}, ${sym.width / 2}, ${sym.height / 2})" opacity="0.75" pointer-events="none">
        <!-- Placement target box -->
        <rect x="-4" y="-4" width="${sym.width + 8}" height="${sym.height + 8}" fill="rgba(99, 179, 237, 0.15)" stroke="#63b3ed" stroke-width="1.5" stroke-dasharray="4,3" rx="4"/>
        
        <!-- BMK hint -->
        <text x="${sym.width / 2}" y="-8" font-size="10" font-weight="bold" font-family="monospace" fill="#f6e05e" text-anchor="middle">${bmk} (Klick: Platzieren | Tab / R: Drehen)</text>

        <!-- Symbol Graphics -->
        <g color="#63b3ed">
          ${sym.svgContent}
        </g>
      </g>
    `;
  }
}
