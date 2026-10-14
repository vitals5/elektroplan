// src/ui/EplanPropertiesDialog.ts
// EPLAN Electric P8 style component properties modal ("Eigenschaften (Schaltzeichen)")

import { PlacedComponent, Project } from '../model/types';
import { getSymbolById } from '../model/symbols';
import { MANUFACTURER_PARTS } from '../model/PartCatalogue';

export interface EplanPropertiesDialogCallbacks {
  onSave: (updated: PlacedComponent) => void;
  onNavigateToPage?: (pageId: string) => void;
}

export class EplanPropertiesDialog {
  private component: PlacedComponent;
  private project: Project;
  private callbacks: EplanPropertiesDialogCallbacks;
  private activeTab: 'symbol' | 'part' | 'crossref' | 'format' = 'symbol';

  constructor(component: PlacedComponent, project: Project, callbacks: EplanPropertiesDialogCallbacks) {
    this.component = JSON.parse(JSON.stringify(component)); // deep clone for editing
    this.project = project;
    this.callbacks = callbacks;
  }

  public show(): void {
    const existing = document.getElementById('eplanPropertiesModal');
    if (existing) existing.remove();

    const sym = getSymbolById(this.component.symbolId);

    const modal = document.createElement('div');
    modal.id = 'eplanPropertiesModal';
    modal.className = 'modal-backdrop';
    modal.style.position = 'fixed';
    modal.style.inset = '0';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
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
        max-width: 620px;
        box-shadow: 0 16px 36px rgba(0,0,0,0.75);
        color: #edf2f7;
        font-family: inherit;
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <!-- Titlebar -->
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
            <span style="color: #dd6b20; font-weight: bold;">⚡</span>
            <span>Eigenschaften (Schaltzeichen): <strong>${this.component.bmk}</strong> (${sym?.name || 'Bauteil'})</span>
          </div>
          <button id="btnClosePropModal" style="background: none; border: none; color: #a0aec0; font-size: 18px; cursor: pointer;">&times;</button>
        </div>

        <!-- EPLAN Tab Navigation -->
        <div class="eplan-tab-bar" style="
          display: flex;
          background: #1c1f26;
          border-bottom: 1px solid #3e4656;
          padding: 0 8px;
        ">
          <button class="eplan-tab-btn active" data-tab="symbol">Schaltzeichen</button>
          <button class="eplan-tab-btn" data-tab="part">Artikel</button>
          <button class="eplan-tab-btn" data-tab="crossref">Querverweise / Kontakte</button>
          <button class="eplan-tab-btn" data-tab="format">Darstellung & Lage</button>
        </div>

        <!-- Tab Body Content -->
        <div id="propTabContent" style="padding: 16px; max-height: 70vh; overflow-y: auto;">
          ${this.renderActiveTabContent()}
        </div>

        <!-- Footer Action Buttons -->
        <div style="
          padding: 10px 16px;
          border-top: 1px solid #3e4656;
          background: #1c1f26;
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        ">
          <button id="btnApplyProp" class="btn" style="padding: 6px 14px; font-size: 12px;">Übernehmen</button>
          <button id="btnSaveProp" class="btn btn-primary" style="padding: 6px 16px; font-size: 12px; font-weight: 600;">OK</button>
          <button id="btnCancelProp" class="btn" style="padding: 6px 14px; font-size: 12px;">Abbrechen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    this.bindEvents(modal);
  }

  private renderActiveTabContent(): string {
    const sym = getSymbolById(this.component.symbolId);

    if (this.activeTab === 'symbol') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">Sichtbares BMK:</label>
              <input type="text" id="propBmk" class="form-input" value="${this.component.bmk}" placeholder="-K1">
            </div>
            <div>
              <label class="form-label">Vollständiges BMK:</label>
              <input type="text" class="form-input" disabled value="${this.component.higherLevelFunction || '=A1'}${this.component.mountingLocation || '+S1'}${this.component.bmk}" style="background: #181b22; color: #a0aec0;">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">Anlage (=Höhere Ebene):</label>
              <input type="text" id="propHigherLevel" class="form-input" value="${this.component.higherLevelFunction || '=A1'}">
            </div>
            <div>
              <label class="form-label">Einbauort (+Ort):</label>
              <input type="text" id="propLocation" class="form-input" value="${this.component.mountingLocation || '+S1'}">
            </div>
          </div>

          <div>
            <label class="form-label">Funktionstext:</label>
            <input type="text" id="propFunctionText" class="form-input" value="${this.component.functionText || ''}" placeholder="z.B. Hauptantrieb Förderband">
          </div>

          <div>
            <label class="form-label">Technische Kenngrößen:</label>
            <input type="text" id="propTechChar" class="form-input" value="${this.component.technicalCharacteristics || ''}" placeholder="z.B. 4kW 400V 8.5A">
          </div>

          <div>
            <label class="form-label">Anschlussbezeichnungen (Pins):</label>
            <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px;">
              ${sym?.pins.map(p => `
                <div style="display: flex; align-items: center; gap: 4px; background: #1a202c; border: 1px solid #3e4656; padding: 4px 8px; border-radius: 4px; font-size: 11px;">
                  <span style="color: #63b3ed; font-family: monospace;">Pin ${p.id}:</span>
                  <input type="text" class="prop-pin-label" data-pin-id="${p.id}" value="${this.component.pins[p.id]?.customLabel || p.name}" style="width: 45px; background: #2d3748; border: 1px solid #4a5568; color: white; padding: 2px 4px; border-radius: 2px; font-size: 11px; text-align: center;">
                </div>
              `).join('') || '<span style="font-size: 11px; color: #a0aec0;">Keine Anschlüsse</span>'}
            </div>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'part') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="background: #1c212c; border: 1px solid #3e4656; border-radius: 6px; padding: 10px 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-size: 12px; font-weight: 600; color: #63b3ed;">EPLAN Data Portal / Herstellerartikel zuweisen</div>
              <div style="font-size: 11px; color: #a0aec0;">Wählen Sie einen vorgefertigten Normartikel aus der Datenbank</div>
            </div>
            <select id="quickPartSelect" class="form-input" style="width: auto; max-width: 260px;">
              <option value="">-- Artikelkatalog wählen --</option>
              ${MANUFACTURER_PARTS.map(p => `
                <option value="${p.id}" ${this.component.articleNumber === p.articleNumber ? 'selected' : ''}>
                  ${p.manufacturer}: ${p.articleNumber} (${p.name})
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">Hersteller:</label>
              <input type="text" id="propManufacturer" class="form-input" value="${this.component.manufacturer || ''}" placeholder="z.B. Siemens / Hager / Finder">
            </div>
            <div>
              <label class="form-label">Artikelnummer / Bestell-Nr.:</label>
              <input type="text" id="propArticleNumber" class="form-input" value="${this.component.articleNumber || ''}" placeholder="z.B. 3RT2016-1BB41">
            </div>
          </div>

          <div>
            <label class="form-label">Katalog-Kurzbeschreibung:</label>
            <input type="text" id="propPartDesc" class="form-input" value="${this.component.technicalCharacteristics || ''}" placeholder="z.B. Leistungsschütz 4kW, 24V DC, 1S">
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'crossref') {
      const crossRefText = this.component.crossRef || 'Kein Querverweis vorhanden';
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="background: #181d26; border: 1px solid #3e4656; border-radius: 6px; padding: 12px;">
            <div style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: #f6ad55; margin-bottom: 6px;">
              Querverweis-Status (DIN EN 81346 / EPLAN P8):
            </div>
            <div style="font-size: 14px; font-family: monospace; color: #edf2f7; font-weight: bold; margin-bottom: 6px;">
              ${crossRefText}
            </div>
            <div style="font-size: 11px; color: #a0aec0; line-height: 1.5;">
              Querverweise werden automatisch anhand identischer BMK-Bezeichnungen (z.B. Spule <code>-K1</code> und Kontakte <code>-K1</code>) über das gesamte Projekt berechnet.
            </div>
          </div>

          <div style="border-top: 1px solid #3e4656; padding-top: 10px;">
            <div style="font-size: 12px; font-weight: 600; margin-bottom: 8px;">Gefundene Verknüpfungen im Projekt:</div>
            <ul style="font-size: 11px; color: #cbd5e0; padding-left: 18px; line-height: 1.6;">
              ${this.getRelatedComponentsHtml()}
            </ul>
          </div>
        </div>
      `;
    }

    if (this.activeTab === 'format') {
      return `
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label class="form-label">X-Position (Raster):</label>
              <input type="number" id="propPosX" class="form-input" value="${this.component.x}">
            </div>
            <div>
              <label class="form-label">Y-Position (Raster):</label>
              <input type="number" id="propPosY" class="form-input" value="${this.component.y}">
            </div>
          </div>

          <div>
            <label class="form-label">Drehwinkel:</label>
            <select id="propRotation" class="form-input">
              <option value="0" ${this.component.rotation === 0 ? 'selected' : ''}>0° (Standard)</option>
              <option value="90" ${this.component.rotation === 90 ? 'selected' : ''}>90° im Uhrzeigersinn</option>
              <option value="180" ${this.component.rotation === 180 ? 'selected' : ''}>180°</option>
              <option value="270" ${this.component.rotation === 270 ? 'selected' : ''}>270°</option>
            </select>
          </div>
        </div>
      `;
    }

    return '';
  }

  private getRelatedComponentsHtml(): string {
    const related: string[] = [];
    for (const p of this.project.pages) {
      for (const c of p.components) {
        if (c.bmk === this.component.bmk && c.id !== this.component.id) {
          const sym = getSymbolById(c.symbolId);
          related.push(`
            <li style="margin-bottom: 4px;">
              <strong>Blatt ${p.pageNumber}:</strong> ${sym?.name || 'Bauteil'} (${c.functionText || 'Ohne Funktionstext'})
              <span style="font-family: monospace; color: #f6e05e; margin-left: 6px;">[X: ${c.x}, Y: ${c.y}]</span>
            </li>
          `);
        }
      }
    }
    if (related.length === 0) {
      return '<li style="color: #a0aec0;">Keine weiteren Bauteile mit demselben BMK im Projekt.</li>';
    }
    return related.join('');
  }

  private bindEvents(modal: HTMLElement): void {
    const closeModal = () => modal.remove();

    // Close buttons
    modal.querySelector('#btnClosePropModal')?.addEventListener('click', closeModal);
    modal.querySelector('#btnCancelProp')?.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Tab buttons
    modal.querySelectorAll('.eplan-tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.collectFormData(modal);
        const target = e.currentTarget as HTMLElement;
        this.activeTab = target.dataset.tab as any;
        modal.querySelectorAll('.eplan-tab-btn').forEach(b => b.classList.remove('active'));
        target.classList.add('active');

        const content = modal.querySelector('#propTabContent');
        if (content) {
          content.innerHTML = this.renderActiveTabContent();
          this.bindTabInternalEvents(modal);
        }
      });
    });

    // Apply & Save
    modal.querySelector('#btnApplyProp')?.addEventListener('click', () => {
      this.collectFormData(modal);
      this.callbacks.onSave(this.component);
    });

    modal.querySelector('#btnSaveProp')?.addEventListener('click', () => {
      this.collectFormData(modal);
      this.callbacks.onSave(this.component);
      closeModal();
    });

    this.bindTabInternalEvents(modal);
  }

  private bindTabInternalEvents(modal: HTMLElement): void {
    const quickPart = modal.querySelector('#quickPartSelect') as HTMLSelectElement;
    quickPart?.addEventListener('change', () => {
      const partId = quickPart.value;
      const part = MANUFACTURER_PARTS.find(p => p.id === partId);
      if (part) {
        const mfrInput = modal.querySelector('#propManufacturer') as HTMLInputElement;
        const artInput = modal.querySelector('#propArticleNumber') as HTMLInputElement;
        const descInput = modal.querySelector('#propPartDesc') as HTMLInputElement;
        if (mfrInput) mfrInput.value = part.manufacturer;
        if (artInput) artInput.value = part.articleNumber;
        if (descInput) descInput.value = `${part.name} - ${part.technicalData}`;

        this.component.manufacturer = part.manufacturer;
        this.component.articleNumber = part.articleNumber;
        this.component.technicalCharacteristics = part.technicalData;
      }
    });
  }

  private collectFormData(modal: HTMLElement): void {
    const bmk = modal.querySelector('#propBmk') as HTMLInputElement;
    if (bmk) this.component.bmk = bmk.value.trim() || this.component.bmk;

    const fnText = modal.querySelector('#propFunctionText') as HTMLInputElement;
    if (fnText) this.component.functionText = fnText.value.trim();

    const techChar = modal.querySelector('#propTechChar') as HTMLInputElement;
    if (techChar) this.component.technicalCharacteristics = techChar.value.trim();

    const higherLevel = modal.querySelector('#propHigherLevel') as HTMLInputElement;
    if (higherLevel) this.component.higherLevelFunction = higherLevel.value.trim();

    const loc = modal.querySelector('#propLocation') as HTMLInputElement;
    if (loc) this.component.mountingLocation = loc.value.trim();

    const mfr = modal.querySelector('#propManufacturer') as HTMLInputElement;
    if (mfr) this.component.manufacturer = mfr.value.trim();

    const art = modal.querySelector('#propArticleNumber') as HTMLInputElement;
    if (art) this.component.articleNumber = art.value.trim();

    const rot = modal.querySelector('#propRotation') as HTMLSelectElement;
    if (rot) this.component.rotation = parseInt(rot.value, 10) as any;

    const posX = modal.querySelector('#propPosX') as HTMLInputElement;
    if (posX) this.component.x = parseInt(posX.value, 10) || this.component.x;

    const posY = modal.querySelector('#propPosY') as HTMLInputElement;
    if (posY) this.component.y = parseInt(posY.value, 10) || this.component.y;

    // Pin labels
    modal.querySelectorAll('.prop-pin-label').forEach(input => {
      const pinId = (input as HTMLElement).dataset.pinId!;
      const val = (input as HTMLInputElement).value.trim();
      if (!this.component.pins[pinId]) {
        this.component.pins[pinId] = {};
      }
      this.component.pins[pinId].customLabel = val;
    });
  }
}
