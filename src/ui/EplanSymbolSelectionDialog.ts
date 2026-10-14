// src/ui/EplanSymbolSelectionDialog.ts
// EPLAN Electric P8 style Symbol Selection modal ("Symbolauswahl")

import { SymbolDefinition } from '../model/types';
import { SYMBOL_DEFINITIONS } from '../model/symbols';

export interface EplanSymbolSelectionCallbacks {
  onSelect: (symbol: SymbolDefinition) => void;
}

export class EplanSymbolSelectionDialog {
  private callbacks: EplanSymbolSelectionCallbacks;
  private selectedCategory: string = 'all';
  private searchQuery: string = '';
  private selectedSymbolId: string = SYMBOL_DEFINITIONS[0].id;

  constructor(callbacks: EplanSymbolSelectionCallbacks) {
    this.callbacks = callbacks;
  }

  public show(): void {
    const existing = document.getElementById('eplanSymbolSelectionModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'eplanSymbolSelectionModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.75)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '2100';
    modal.style.padding = '12px';

    modal.innerHTML = `
      <div class="modal-card eplan-window" style="
        background: #232731;
        border: 1px solid #4a5568;
        border-radius: 6px;
        width: 100%;
        max-width: 900px;
        height: 85vh;
        max-height: 700px;
        box-shadow: 0 16px 40px rgba(0,0,0,0.8);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Window Titlebar -->
        <div class="eplan-window-header" style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 14px;
          background: #2d323e;
          border-bottom: 1px solid #3e4656;
          user-select: none;
        ">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 600; font-size: 13px;">
            <span style="color: #63b3ed;">📐</span>
            <span>Symbolauswahl (DIN EN 60617 / IEC 81346)</span>
          </div>
          <button id="btnCloseSymModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- Filter Bar -->
        <div style="
          padding: 8px 14px;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          display: flex;
          align-items: center;
          gap: 12px;
        ">
          <div style="flex: 1; display: flex; align-items: center; gap: 6px; background: #232731; border: 1px solid #3e4656; border-radius: 4px; padding: 4px 8px;">
            <span style="color: #a0aec0; font-size: 12px;">🔍</span>
            <input type="text" id="symSearchInput" placeholder="Symbol suchen (z.B. Schütz, FI, Stromstoß, Taster, Motor)..." style="
              background: none;
              border: none;
              color: white;
              font-size: 12px;
              width: 100%;
              outline: none;
            " value="${this.searchQuery}">
          </div>
          <span style="font-size: 11px; color: #a0aec0;" id="symCountBadge">
            ${SYMBOL_DEFINITIONS.length} Symbole verfügbar
          </span>
        </div>

        <!-- Main Body: 3-Column EPLAN Layout (Tree | Grid | Details) -->
        <div style="flex: 1; display: flex; overflow: hidden;">
          <!-- Left Column: Category Tree -->
          <div style="
            width: 210px;
            background: #181b22;
            border-right: 1px solid #3e4656;
            padding: 10px;
            overflow-y: auto;
          ">
            <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 6px;">Bibliotheken</div>
            
            <div class="sym-tree-node active" data-cat="all" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>📁</span> Alle Symbole
            </div>
            <div class="sym-tree-node" data-cat="relays" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>⚡</span> Schütze & Relais
            </div>
            <div class="sym-tree-node" data-cat="protection" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>🛡️</span> Schutzeinrichtungen
            </div>
            <div class="sym-tree-node" data-cat="controls" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>🔘</span> Befehls- & Meldegeräte
            </div>
            <div class="sym-tree-node" data-cat="motors" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>🔄</span> Motoren & Antriebe
            </div>
            <div class="sym-tree-node" data-cat="terminals" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>🔌</span> Klemmen & Verbinder
            </div>
            <div class="sym-tree-node" data-cat="supply" style="padding: 5px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; display: flex; align-items: center; gap: 6px;">
              <span>🔋</span> Spannungsversorgung
            </div>
          </div>

          <!-- Middle Column: Symbol Cards Grid -->
          <div id="symGridContainer" style="
            flex: 1;
            padding: 12px;
            overflow-y: auto;
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
            gap: 10px;
            align-content: flex-start;
          ">
            ${this.renderSymbolsGrid()}
          </div>

          <!-- Right Column: Detail & Pin Inspector -->
          <div id="symDetailsContainer" style="
            width: 250px;
            background: #181b22;
            border-left: 1px solid #3e4656;
            padding: 14px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            gap: 12px;
          ">
            ${this.renderSymbolDetails()}
          </div>
        </div>

        <!-- Footer Bar with OK / Cancel -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: space-between;
          align-items: center;
        ">
          <div style="font-size: 11px; color: #a0aec0;">
            Tipp: Mit <strong>Tab</strong> können Sie das Bauteil beim Platzieren drehen.
          </div>
          <div style="display: flex; gap: 8px;">
            <button id="btnInsertSym" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 600;">Einfügen (Enter)</button>
            <button id="btnCancelSym" class="btn" style="padding: 6px 14px; font-size: 12px;">Abbrechen (Esc)</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.bindEvents(modal);
  }

  private getFilteredSymbols(): SymbolDefinition[] {
    return SYMBOL_DEFINITIONS.filter(s => {
      const matchCat = this.selectedCategory === 'all' || s.category === this.selectedCategory;
      const matchQuery = !this.searchQuery ||
        s.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        s.defaultBmkPrefix.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        s.description.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        (s.manufacturer && s.manufacturer.toLowerCase().includes(this.searchQuery.toLowerCase())) ||
        (s.articleNumber && s.articleNumber.toLowerCase().includes(this.searchQuery.toLowerCase()));
      return matchCat && matchQuery;
    });
  }

  private renderSymbolsGrid(): string {
    const list = this.getFilteredSymbols();
    if (list.length === 0) {
      return `
        <div style="grid-column: 1 / -1; padding: 40px 20px; text-align: center; color: #a0aec0;">
          Keine Symbole für diesen Suchbegriff gefunden.
        </div>
      `;
    }

    return list.map(sym => {
      const isSelected = sym.id === this.selectedSymbolId;
      return `
        <div class="sym-dialog-card ${isSelected ? 'selected' : ''}" data-sym-id="${sym.id}" style="
          background: #232731;
          border: 1px solid ${isSelected ? '#63b3ed' : '#3e4656'};
          border-radius: 4px;
          padding: 8px;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          transition: all 0.12s ease;
          position: relative;
        ">
          <div style="
            width: 50px;
            height: 50px;
            display: flex;
            align-items: center;
            justify-content: center;
            margin-bottom: 6px;
          ">
            <svg width="44" height="44" viewBox="0 0 ${sym.width} ${sym.height}">
              <g color="#e2e8f0">${sym.svgContent}</g>
            </svg>
          </div>
          <div style="font-size: 11px; font-weight: 500; color: #edf2f7; line-height: 1.2;">${sym.name}</div>
          <div style="font-size: 9px; font-family: monospace; color: #f6e05e; margin-top: 4px;">BMK: ${sym.defaultBmkPrefix}</div>
        </div>
      `;
    }).join('');
  }

  private renderSymbolDetails(): string {
    const sym = SYMBOL_DEFINITIONS.find(s => s.id === this.selectedSymbolId) || SYMBOL_DEFINITIONS[0];

    return `
      <div>
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Vorschau</div>
        <div style="
          background: #1c212c;
          border: 1px solid #3e4656;
          border-radius: 4px;
          padding: 12px;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 80px;
        ">
          <svg width="60" height="60" viewBox="0 0 ${sym.width} ${sym.height}">
            <g color="#63b3ed">${sym.svgContent}</g>
          </svg>
        </div>
      </div>

      <div>
        <div style="font-size: 12px; font-weight: 600; color: #edf2f7;">${sym.name}</div>
        <div style="font-size: 11px; color: #a0aec0; margin-top: 2px;">${sym.description}</div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Kenndaten</div>
        <div style="font-size: 11px; line-height: 1.6;">
          <div><strong style="color: #cbd5e0;">Norm:</strong> ${sym.standard}</div>
          <div><strong style="color: #cbd5e0;">Präfix:</strong> <code>${sym.defaultBmkPrefix}</code></div>
          <div><strong style="color: #cbd5e0;">Rastermaß:</strong> ${sym.width}x${sym.height}</div>
          <div><strong style="color: #cbd5e0;">Standardtext:</strong> ${sym.defaultFunctionText}</div>
        </div>
      </div>

      <div style="border-top: 1px solid #2d3748; padding-top: 8px;">
        <div style="font-size: 10px; font-weight: bold; color: #a0aec0; text-transform: uppercase; margin-bottom: 4px;">Anschlüsse (${sym.pins.length})</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${sym.pins.map(p => `
            <div style="display: flex; justify-content: space-between; font-size: 10px; font-family: monospace; background: #232731; padding: 2px 6px; border-radius: 3px;">
              <span style="color: #63b3ed;">Pin ${p.name}</span>
              <span style="color: #a0aec0;">[${p.x}, ${p.y}] ${p.direction}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private bindEvents(modal: HTMLElement): void {
    const closeModal = () => modal.remove();

    // Close buttons
    modal.querySelector('#btnCloseSymModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelSym')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Search input
    const searchInput = modal.querySelector('#symSearchInput') as HTMLInputElement;
    searchInput?.addEventListener('input', () => {
      this.searchQuery = searchInput.value.trim();
      this.updateGrid(modal);
    });

    // Category tree nodes
    modal.querySelectorAll('.sym-tree-node').forEach(node => {
      node.addEventListener('click', (e) => {
        modal.querySelectorAll('.sym-tree-node').forEach(n => n.classList.remove('active'));
        const target = e.currentTarget as HTMLElement;
        target.classList.add('active');
        this.selectedCategory = target.dataset.cat || 'all';
        this.updateGrid(modal);
      });
    });

    // Insert on click or enter
    const insertSelected = () => {
      const sym = SYMBOL_DEFINITIONS.find(s => s.id === this.selectedSymbolId);
      if (sym) {
        this.callbacks.onSelect(sym);
        closeModal();
      }
    };

    modal.querySelector('#btnInsertSym')?.addEventListener('click', insertSelected);

    // Keyboard navigation
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeModal();
        window.removeEventListener('keydown', keyHandler);
      } else if (e.key === 'Enter') {
        insertSelected();
        window.removeEventListener('keydown', keyHandler);
      }
    };
    window.addEventListener('keydown', keyHandler);

    this.bindCardClicks(modal, insertSelected);
  }

  private updateGrid(modal: HTMLElement): void {
    const grid = modal.querySelector('#symGridContainer');
    if (grid) {
      grid.innerHTML = this.renderSymbolsGrid();
      this.bindCardClicks(modal, () => {
        const sym = SYMBOL_DEFINITIONS.find(s => s.id === this.selectedSymbolId);
        if (sym) {
          this.callbacks.onSelect(sym);
          modal.remove();
        }
      });
    }

    const count = this.getFilteredSymbols().length;
    const badge = modal.querySelector('#symCountBadge');
    if (badge) badge.textContent = `${count} Symbole gefunden`;
  }

  private bindCardClicks(modal: HTMLElement, onDoubleSelect: () => void): void {
    modal.querySelectorAll('.sym-dialog-card').forEach(card => {
      card.addEventListener('click', (e) => {
        modal.querySelectorAll('.sym-dialog-card').forEach(c => (c as HTMLElement).style.borderColor = '#3e4656');
        const target = e.currentTarget as HTMLElement;
        target.style.borderColor = '#63b3ed';
        this.selectedSymbolId = target.dataset.symId!;
        const details = modal.querySelector('#symDetailsContainer');
        if (details) details.innerHTML = this.renderSymbolDetails();
      });

      card.addEventListener('dblclick', (e) => {
        this.selectedSymbolId = (e.currentTarget as HTMLElement).dataset.symId!;
        onDoubleSelect();
      });
    });
  }
}
