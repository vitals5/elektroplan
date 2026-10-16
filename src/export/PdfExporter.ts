// src/export/PdfExporter.ts
// Smart Vector PDF Export:
// - Multi-page vector PDF (DIN A3 / DIN A4 Landscape)
// - Interactive cross-reference hyperlinks (jump between coil and contacts)
// - PDF document outline / bookmarks based on DIN EN 81346 (=Anlage+Ort/Blatt)
// - DIN EN ISO 7200 plot frame and title block
// - Appended report pages: Klemmenplan and Stückliste (BOM)

import { jsPDF } from 'jspdf';
import { Project, Page, PlacedComponent, Wire } from '../model/types';
import { getSymbolById } from '../model/symbols';
import { TerminalDiagramGenerator } from '../reports/TerminalDiagram';
import { PartsListGenerator } from '../reports/PartsList';

export interface PdfExportOptions {
  paperFormat: 'a3' | 'a4';
  colorMode: 'color' | 'monochrome';
  pageRange: 'all' | 'current';
  currentPageId?: string;
  interactiveCrossReferences: boolean;
  includeBookmarks: boolean;
  includeTerminalDiagram: boolean;
  includePartsList: boolean;
  plotFrame: boolean;
}

export class PdfExporter {
  public static async exportToPdf(project: Project, options: PdfExportOptions): Promise<Blob> {
    const isA3 = options.paperFormat === 'a3';
    const pageWidthMm = isA3 ? 420 : 297;
    const pageHeightMm = isA3 ? 297 : 210;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: isA3 ? 'a3' : 'a4',
      compress: true
    });

    // Set Document Properties
    doc.setProperties({
      title: `${project.name} - Stromlaufplan`,
      subject: `Kommission: ${project.pages[0]?.plotFrame.titleBlock.commission || 'KOM-2026'}`,
      author: project.author || 'Elektroplan Engineer',
      creator: 'Elektroplan CAE Suite',
      keywords: 'Elektroplan, DIN EN 81346, IEC 60617, Schaltplan, CAD, ECAD'
    });

    // Filter pages to export
    let pagesToExport: Page[] = [];
    if (options.pageRange === 'current' && options.currentPageId) {
      const page = project.pages.find(p => p.id === options.currentPageId);
      pagesToExport = page ? [page] : [project.pages[0]];
    } else {
      pagesToExport = [...project.pages];
    }

    // Mapping from page.pageNumber to 1-based PDF page index
    const pageNumberToPdfPageIndex = new Map<string, number>();
    pagesToExport.forEach((page, index) => {
      pageNumberToPdfPageIndex.set(page.pageNumber, index + 1);
    });

    // Total sheet count update
    const extraSheets = (options.includeTerminalDiagram ? 1 : 0) + (options.includePartsList ? 1 : 0);
    const totalSheetsCount = pagesToExport.length + extraSheets;

    // Render schematic pages
    for (let i = 0; i < pagesToExport.length; i++) {
      if (i > 0) {
        doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      }

      const page = pagesToExport[i];
      const pdfPageNum = i + 1;

      // Add Bookmarks / Outline if enabled
      if (options.includeBookmarks && doc.outline) {
        const bookmarkTitle = `Blatt ${page.pageNumber}: ${page.title} (${page.higherLevel}${page.location})`;
        try {
          doc.outline.add(null, bookmarkTitle, { pageNumber: pdfPageNum });
        } catch {
          // ignore outline errors
        }
      }

      // Render Plot Frame (Normblatt)
      if (options.plotFrame) {
        this.renderPlotFrame(doc, page, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount);
      }

      // Render Embedded Images
      this.renderImages(doc, page, pageWidthMm, pageHeightMm);

      // Render Structure Boxes (Ortskästen / Schaltschrankumrahmungen)
      this.renderBoxes(doc, page, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Wires
      this.renderWires(doc, page, pageWidthMm, pageHeightMm, options.colorMode);

      // Render Components & Interactive Cross-Reference Links
      this.renderComponents(doc, page, project, pageWidthMm, pageHeightMm, options, pageNumberToPdfPageIndex);

      // Render Free Texts & Annotations
      this.renderTexts(doc, page, pageWidthMm, pageHeightMm, options.colorMode);
    }

    // Render Optional Klemmenplan Page
    if (options.includeTerminalDiagram) {
      doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      const pdfPageNum = doc.getNumberOfPages();
      if (options.includeBookmarks && doc.outline) {
        try {
          doc.outline.add(null, `Auswertung: Klemmenplan (-X1)`, { pageNumber: pdfPageNum });
        } catch {}
      }
      this.renderTerminalDiagramPage(doc, project, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount);
    }

    // Render Optional Stückliste Page
    if (options.includePartsList) {
      doc.addPage(isA3 ? 'a3' : 'a4', 'landscape');
      const pdfPageNum = doc.getNumberOfPages();
      if (options.includeBookmarks && doc.outline) {
        try {
          doc.outline.add(null, `Auswertung: Stückliste (BOM)`, { pageNumber: pdfPageNum });
        } catch {}
      }
      this.renderPartsListPage(doc, project, pageWidthMm, pageHeightMm, options.colorMode, totalSheetsCount);
    }

    return doc.output('blob');
  }

  /**
   * Transforms CAD coordinates (1000 x 700) to PDF mm
   */
  private static scaleX(x: number, maxMm: number): number {
    return (x / 1000) * maxMm;
  }

  private static scaleY(y: number, maxMm: number): number {
    return (y / 700) * maxMm;
  }

  /**
   * Renders the DIN A3 / A4 Normblatt (Plot Frame) with column paths 0..9 and title block
   */
  private static renderPlotFrame(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number
  ): void {
    const margin = 8;
    const innerMargin = 14;

    doc.setLineWidth(0.4);
    doc.setDrawColor(0, 0, 0);

    // Outer & inner boundary rectangles
    doc.rect(margin, margin, wMm - 2 * margin, hMm - 2 * margin);
    doc.setLineWidth(0.2);
    doc.rect(innerMargin, innerMargin, wMm - 2 * innerMargin, hMm - 2 * innerMargin);

    // Columns 0..9 headers
    const cols = 10;
    const colWidth = (wMm - 2 * innerMargin) / cols;
    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);

    for (let i = 0; i < cols; i++) {
      const cx = innerMargin + i * colWidth + colWidth / 2;
      doc.text(i.toString(), cx, innerMargin - 2, { align: 'center' });
      doc.text(i.toString(), cx, hMm - innerMargin + 4, { align: 'center' });
      doc.line(innerMargin + i * colWidth, innerMargin - 4, innerMargin + i * colWidth, innerMargin);
    }

    // Rows A..F markers
    const rows = ['A', 'B', 'C', 'D', 'E', 'F'];
    const rowHeight = (hMm - 2 * innerMargin - 25) / rows.length;
    for (let r = 0; r < rows.length; r++) {
      const ry = innerMargin + r * rowHeight + rowHeight / 2;
      doc.text(rows[r], innerMargin - 3, ry, { align: 'center' });
      doc.text(rows[r], wMm - innerMargin + 3, ry, { align: 'center' });
    }

    // DIN EN ISO 7200 Title Block (Bottom Right)
    const tbW = 120;
    const tbH = 26;
    const tbX = wMm - innerMargin - tbW;
    const tbY = hMm - innerMargin - tbH;
    const tb = page.plotFrame.titleBlock;

    doc.setLineWidth(0.3);
    doc.setDrawColor(0, 0, 0);
    doc.setFillColor(255, 255, 255);
    doc.rect(tbX, tbY, tbW, tbH, 'FD');

    // Horizontal divider lines
    doc.line(tbX, tbY + 9, tbX + tbW, tbY + 9);
    doc.line(tbX, tbY + 18, tbX + tbW, tbY + 18);

    // Vertical dividers
    doc.line(tbX + 60, tbY, tbX + 60, tbY + 18);
    doc.line(tbX + 90, tbY + 9, tbX + 90, tbY + tbH);

    // Texts inside Titleblock
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colorMode === 'color' ? 30 : 0, colorMode === 'color' ? 70 : 0, colorMode === 'color' ? 140 : 0);
    doc.text(tb.company || 'Elektroplan CAE Suite', tbX + 2, tbY + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(50, 50, 50);
    doc.text(`Komm.: ${tb.commission || 'KOM-2026'}`, tbX + 62, tbY + 6);

    doc.setFontSize(7.5);
    doc.text(`Projekt: ${tb.projectTitle}`, tbX + 2, tbY + 15);
    doc.text(`Datum: ${tb.date}`, tbX + 62, tbY + 15);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(page.title, tbX + 2, tbY + 23);

    doc.text(`Blatt: ${page.pageNumber} / ${totalSheets}`, tbX + 92, tbY + 23);
  }

  /**
   * Renders free texts, cable definitions, and section titles
   */
  private static renderTexts(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    if (!page.texts || page.texts.length === 0) return;
    const scaleX = wMm / page.plotFrame.width;
    const scaleY = hMm / page.plotFrame.height;

    for (const t of page.texts) {
      const xMm = t.x * scaleX;
      const yMm = t.y * scaleY;
      const isHeader = Boolean(t.fontSize && t.fontSize >= 11);
      const isMonochrome = colorMode === 'monochrome';

      doc.setFont('helvetica', (t.fontWeight === 'bold' || isHeader) ? 'bold' : 'normal');
      doc.setFontSize(Math.max(6, (t.fontSize || 9) * 0.75));

      if (isMonochrome) {
        doc.setTextColor(0, 0, 0);
      } else if (isHeader) {
        doc.setTextColor(43, 108, 176);
      } else {
        doc.setTextColor(74, 85, 104);
      }

      doc.text(t.text, xMm, yMm);
    }
  }

  /**
   * Renders embedded raster images and diagrams
   */
  private static renderImages(doc: jsPDF, page: Page, wMm: number, hMm: number): void {
    if (!page.images || page.images.length === 0) return;
    const scaleX = wMm / page.plotFrame.width;
    const scaleY = hMm / page.plotFrame.height;

    for (const img of page.images) {
      const ix = img.x * scaleX;
      const iy = img.y * scaleY;
      const iw = img.width * scaleX;
      const ih = img.height * scaleY;
      try {
        const format = img.dataUrl.includes('image/jpeg') ? 'JPEG' : 'PNG';
        doc.addImage(img.dataUrl, format, ix, iy, iw, ih);
      } catch (err) {
        console.warn('Failed to embed image into PDF:', err);
      }
    }
  }

  /**
   * Renders structure boxes (Ortskästen / Schaltschrankumrahmungen)
   */
  private static renderBoxes(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    if (!page.boxes || page.boxes.length === 0) return;
    const scaleX = wMm / page.plotFrame.width;
    const scaleY = hMm / page.plotFrame.height;

    for (const box of page.boxes) {
      const bx = box.x * scaleX;
      const by = box.y * scaleY;
      const bw = box.width * scaleX;
      const bh = box.height * scaleY;

      doc.setDrawColor(colorMode === 'color' ? 0 : 80, colorMode === 'color' ? 140 : 80, colorMode === 'color' ? 220 : 80);
      doc.setLineWidth(0.35);
      doc.setLineDashPattern([3, 2], 0);
      doc.rect(bx, by, bw, bh);
      doc.setLineDashPattern([], 0);

      if (box.label) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(colorMode === 'color' ? 0 : 0, colorMode === 'color' ? 100 : 0, colorMode === 'color' ? 180 : 0);
        doc.text(box.label, bx + 2, by + 4);
      }
      if (box.description) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(60, 60, 60);
        doc.text(box.description, bx + 2, by + 7.5);
      }
      if (box.subLabel) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(60, 60, 60);
        doc.text(box.subLabel, bx + 2, by + 10.5);
      }
    }
  }

  /**
   * Renders all electrical wires with potential colors and orthogonal paths
   */
  private static renderWires(
    doc: jsPDF,
    page: Page,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome'
  ): void {
    doc.setLineWidth(0.35);

    for (const wire of page.wires) {
      const p1 = this.getPinCoords(page, wire.from.componentId, wire.from.pinId);
      const p2 = this.getPinCoords(page, wire.to.componentId, wire.to.pinId);
      if (!p1 || !p2) continue;

      const x1 = this.scaleX(p1.x, wMm);
      const y1 = this.scaleY(p1.y, hMm);
      const x2 = this.scaleX(p2.x, wMm);
      const y2 = this.scaleY(p2.y, hMm);

      // Color coding
      if (colorMode === 'color') {
        const rgb = this.getPotentialRgb(wire.potential, wire.color);
        doc.setDrawColor(rgb.r, rgb.g, rgb.b);
        doc.setFillColor(rgb.r, rgb.g, rgb.b);
      } else {
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(0, 0, 0);
      }

      const comp1 = page.components.find(c => c.id === wire.from.componentId);
      const isBusbar = comp1?.symbolId === 'potential_rail_source';

      if (Math.abs(x1 - x2) < 0.5) {
        doc.line(x1, y1, x1, y2);
      } else if (Math.abs(y1 - y2) < 0.5) {
        doc.line(x1, y1, x2, y1);
      } else if (isBusbar) {
        doc.line(x1, y1, x2, y1);
        doc.line(x2, y1, x2, y2);
      } else {
        const midY = (y1 + y2) / 2;
        doc.line(x1, y1, x1, midY);
        doc.line(x1, midY, x2, midY);
        doc.line(x2, midY, x2, y2);
      }
    }
  }

  /**
   * Renders components, symbols, labels, and smart cross-reference hyperlinks
   */
  private static renderComponents(
    doc: jsPDF,
    page: Page,
    project: Project,
    wMm: number,
    hMm: number,
    options: PdfExportOptions,
    pageMapping: Map<string, number>
  ): void {
    for (const comp of page.components) {
      const sym = getSymbolById(comp.symbolId);
      if (!sym) continue;

      const compX = this.scaleX(comp.x, wMm);
      const compY = this.scaleY(comp.y, hMm);
      const compW = this.scaleX(sym.width, wMm);
      const compH = this.scaleY(sym.height, hMm);

      // Draw Symbol Vector Outline
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.35);
      this.drawVectorSymbol(doc, sym.id, compX, compY, compW, compH);

      const isConnection = sym.category === 'connections' || sym.id.startsWith('potential_arrow') || sym.id === 'potential_rail_source';
      const isTerminal = sym.id === 'terminal_single';

      // Draw Pins only for standard multi-pin components (not connection arrows or terminals)
      if (!isConnection && !isTerminal) {
        for (const pin of sym.pins) {
          const px = compX + this.scaleX(pin.x, wMm);
          const py = compY + this.scaleY(pin.y, hMm);
          doc.setFillColor(255, 255, 255);
          doc.circle(px, py, 0.4, 'FD');

          doc.setFont('courier', 'normal');
          doc.setFontSize(4.5);
          doc.setTextColor(80, 80, 80);
          const ty = pin.direction === 'top' ? py - 1.0 : py + 2.0;
          doc.text(pin.name, px, ty, { align: 'center' });
        }
      }

      // Draw Labels according to component type
      if (isConnection) {
        // Interruption point / Potential arrow: render target name beside arrow
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(options.colorMode === 'color' ? 180 : 0, 0, 0);
        if (sym.id === 'potential_arrow_right') {
          doc.text(comp.functionText || comp.bmk, compX + compW + 1.5, compY + compH * 0.5 + 1.2, { align: 'left' });
        } else if (sym.id === 'potential_arrow_left') {
          doc.text(comp.functionText || comp.bmk, compX - 1.5, compY + compH * 0.5 + 1.2, { align: 'right' });
        } else if (sym.id === 'potential_arrow_down') {
          doc.text(comp.functionText || comp.bmk, compX + compW * 0.5, compY + compH + 3.0, { align: 'center' });
        } else if (sym.id === 'potential_arrow_up') {
          doc.text(comp.functionText || comp.bmk, compX + compW * 0.5, compY - 1.5, { align: 'center' });
        } else if (sym.id === 'potential_rail_source') {
          doc.text(comp.functionText || comp.bmk, compX - 1.5, compY + compH * 0.5 + 1.2, { align: 'right' });
        }
      } else if (isTerminal) {
        // Terminal: draw terminal designation beside circle and BMK above
        const termNum = comp.deviceTag || comp.technicalCharacteristics || comp.functionText || '1';
        doc.setFont('courier', 'bold');
        doc.setFontSize(5.5);
        doc.setTextColor(50, 50, 50);
        doc.text(termNum, compX + compW + 1.2, compY + compH * 0.5 + 1.0);

        if (comp.bmk && !comp.bmk.startsWith('comp_')) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(6.5);
          doc.setTextColor(options.colorMode === 'color' ? 180 : 0, options.colorMode === 'color' ? 120 : 0, 0);
          doc.text(comp.bmk, compX + compW * 0.5, compY - 1.5, { align: 'center' });
        }
      } else {
        // Standard Electrical Component
        // Draw BMK (Betriebsmittelkennzeichen)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(options.colorMode === 'color' ? 180 : 0, options.colorMode === 'color' ? 120 : 0, 0);
        doc.text(comp.bmk, compX + compW / 2, compY - 2, { align: 'center' });

        // Draw Function Text
        if (comp.functionText && comp.functionText !== comp.bmk) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
          doc.text(comp.functionText, compX + compW / 2, compY + compH + 3.2, { align: 'center' });
        }

        // Draw Technical Characteristics
        if (comp.technicalCharacteristics && comp.technicalCharacteristics !== comp.functionText) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5);
          doc.setTextColor(80, 80, 80);
          doc.text(comp.technicalCharacteristics, compX + compW / 2, compY + compH + 6.0, { align: 'center' });
        }
      }

      // SMART PDF: Interactive Cross-References (Kontaktspiegel & Querverweise)
      if (comp.crossRef) {
        const crY = compY + compH + 9;
        doc.setFont('courier', 'bold');
        doc.setFontSize(6);
        doc.setTextColor(options.colorMode === 'color' ? 200 : 50, 50, 0);
        doc.text(comp.crossRef, compX + compW / 2, crY, { align: 'center' });

        // Add PDF Hyperlink if interactive cross-references are enabled
        if (options.interactiveCrossReferences) {
          const match = comp.crossRef.match(/\/(\d+)\./);
          if (match) {
            const targetPageStr = match[1];
            const targetPdfPage = pageMapping.get(targetPageStr);
            if (targetPdfPage) {
              const linkW = 20;
              const linkH = 4;
              const linkX = compX + compW / 2 - linkW / 2;
              const linkY = crY - 3;
              doc.link(linkX, linkY, linkW, linkH, { pageNumber: targetPdfPage });
              if (options.colorMode === 'color') {
                doc.setDrawColor(66, 153, 225);
                doc.setLineWidth(0.15);
                doc.rect(linkX, linkY, linkW, linkH);
              }
            }
          }
        }
      }
    }
  }

  /**
   * Vector drawing commands for DIN EN 60617 symbols in PDF
   */
  private static drawVectorSymbol(doc: jsPDF, symId: string, x: number, y: number, w: number, h: number): void {
    switch (symId) {
      case 'contactor_coil': {
        doc.rect(x + w * 0.2, y + h * 0.25, w * 0.6, h * 0.5);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.25);
        doc.line(x + w * 0.5, y + h * 0.75, x + w * 0.5, y + h);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('K', x + w * 0.5, y + h * 0.55, { align: 'center' });
        break;
      }
      case 'contact_no':
      case 'pushbutton_no':
      case 'switch_single': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.5, y + h * 0.35, x + w * 0.85, y + h * 0.65);
        doc.line(x + w * 0.5, y + h * 0.68, x + w * 0.5, y + h);
        doc.circle(x + w * 0.5, y + h * 0.35, 0.4, 'F');
        doc.circle(x + w * 0.5, y + h * 0.68, 0.4, 'F');
        break;
      }
      case 'contact_nc':
      case 'pushbutton_emergency_stop': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.5, y + h * 0.35, x + w * 0.15, y + h * 0.65);
        doc.line(x + w * 0.15, y + h * 0.65, x + w * 0.5, y + h * 0.65);
        doc.line(x + w * 0.5, y + h * 0.68, x + w * 0.5, y + h);
        break;
      }
      case 'circuit_breaker_1p': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.28);
        doc.line(x + w * 0.5, y + h * 0.28, x + w * 0.8, y + h * 0.58);
        doc.line(x + w * 0.5, y + h * 0.62, x + w * 0.5, y + h);
        // Thermal bimetal
        doc.rect(x + w * 0.35, y + h * 0.68, w * 0.3, h * 0.18);
        // Magnetic trip
        doc.line(x + w * 0.65, y + h * 0.42, x + w * 0.8, y + h * 0.34);
        doc.line(x + w * 0.8, y + h * 0.34, x + w * 0.8, y + h * 0.5);
        break;
      }
      case 'circuit_breaker_3p': {
        const poleOffsets = [12, 31, 51];
        for (let p = 0; p < 3; p++) {
          const px = x + w * (poleOffsets[p] / 72);
          doc.line(px, y, px, y + h * 0.28);
          doc.line(px, y + h * 0.28, px + w * 0.1, y + h * 0.58);
          doc.line(px, y + h * 0.62, px, y + h);
          doc.rect(px - 1.2, y + h * 0.68, 2.4, 2.0);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 72), y + h * 0.44, x + w * (51 / 72), y + h * 0.44);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'fuse_switch_3p': {
        const poleOffsets = [12, 31, 51];
        for (let p = 0; p < 3; p++) {
          const px = x + w * (poleOffsets[p] / 72);
          doc.line(px, y, px, y + h * 0.15);
          doc.rect(px - 1.5, y + h * 0.15, 3.0, h * 0.3);
          doc.line(px, y + h * 0.15, px, y + h * 0.45);
          doc.line(px, y + h * 0.45, px + w * 0.1, y + h * 0.72);
          doc.line(px, y + h * 0.75, px, y + h);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 72), y + h * 0.6, x + w * (51 / 72), y + h * 0.6);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'main_switch_4p':
      case 'changeover_switch_4p': {
        const poleOffsets = [12, 31, 51, 70];
        for (let p = 0; p < 4; p++) {
          const px = x + w * (poleOffsets[p] / 96);
          doc.line(px, y, px, y + h * 0.3);
          doc.line(px, y + h * 0.3, px + w * 0.08, y + h * 0.65);
          doc.line(px, y + h * 0.68, px, y + h);
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * (12 / 96), y + h * 0.48, x + w * (70 / 96), y + h * 0.48);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'energy_meter_3p': {
        doc.rect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.7, 'S');
        doc.line(x + w * 0.05, y + h * 0.45, x + w * 0.95, y + h * 0.45);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.text('kWh', x + w * 0.5, y + h * 0.35, { align: 'center' });
        const poleOffsets = [12, 31, 51, 70];
        for (let p = 0; p < 4; p++) {
          const px = x + w * (poleOffsets[p] / 84);
          doc.line(px, y, px, y + h * 0.15);
          doc.line(px, y + h * 0.85, px, y + h);
        }
        break;
      }
      case 'contactor_power_3p':
      case 'motor_protective_switch': {
        for (let p = 0; p < 3; p++) {
          const px = x + w * (0.16 + p * 0.33);
          doc.line(px, y, px, y + h * 0.3);
          doc.line(px, y + h * 0.3, px + w * 0.12, y + h * 0.6);
          doc.line(px, y + h * 0.65, px, y + h);
          if (symId === 'motor_protective_switch') {
            doc.rect(px - 1.5, y + h * 0.72, 3, 2.5);
          }
        }
        doc.setLineDashPattern([1, 1], 0);
        doc.line(x + w * 0.2, y + h * 0.45, x + w * 0.8, y + h * 0.45);
        doc.setLineDashPattern([], 0);
        break;
      }
      case 'motor_3phase':
      case 'motor_1phase': {
        const radius = Math.min(w, h) * 0.38;
        const cx = x + w * 0.5;
        const cy = y + h * 0.55;
        doc.circle(cx, cy, radius);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('M', cx, cy - 0.5, { align: 'center' });
        doc.setFontSize(6);
        doc.text(symId === 'motor_3phase' ? '3 ~' : '1 ~', cx, cy + 3.5, { align: 'center' });
        if (symId === 'motor_3phase') {
          doc.line(cx - radius * 0.5, y, cx - radius * 0.5, cy - radius);
          doc.line(cx, y, cx, cy - radius);
          doc.line(cx + radius * 0.5, y, cx + radius * 0.5, cy - radius);
        } else {
          doc.line(cx - radius * 0.4, y, cx - radius * 0.4, cy - radius);
          doc.line(cx + radius * 0.4, y, cx + radius * 0.4, cy - radius);
        }
        break;
      }
      case 'socket_schuko': {
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.35);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.35);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.35);
        doc.ellipse(x + w * 0.5, y + h * 0.35, w * 0.35, h * 0.45, 'S');
        doc.circle(x + w * 0.4, y + h * 0.55, 0.5, 'F');
        doc.circle(x + w * 0.6, y + h * 0.55, 0.5, 'F');
        break;
      }
      case 'light_bulb': {
        const radius = Math.min(w, h) * 0.38;
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        doc.circle(cx, cy, radius);
        doc.line(cx - radius * 0.707, cy - radius * 0.707, cx + radius * 0.707, cy + radius * 0.707);
        doc.line(cx + radius * 0.707, cy - radius * 0.707, cx - radius * 0.707, cy + radius * 0.707);
        doc.line(cx, y, cx, cy - radius);
        doc.line(cx, cy + radius, cx, y + h);
        break;
      }
      case 'rj45_port': {
        doc.rect(x + w * 0.15, y + h * 0.25, w * 0.7, h * 0.6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(5);
        doc.text('ETH', x + w * 0.5, y + h * 0.6, { align: 'center' });
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.25);
        break;
      }
      case 'valve_actuator': {
        doc.triangle(x + w * 0.2, y + h * 0.2, x + w * 0.8, y + h * 0.8, x + w * 0.2, y + h * 0.8, 'S');
        doc.triangle(x + w * 0.8, y + h * 0.2, x + w * 0.8, y + h * 0.8, x + w * 0.2, y + h * 0.2, 'S');
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.3);
        doc.line(x + w * 0.5, y + h * 0.7, x + w * 0.5, y + h);
        break;
      }
      case 'thermostat_box': {
        doc.rect(x + w * 0.08, y + h * 0.2, w * 0.84, h * 0.6, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('°C', x + w * 0.5, y + h * 0.55, { align: 'center' });
        break;
      }
      case 'inverter_solar': {
        doc.setLineDashPattern([1.5, 1], 0);
        doc.rect(x + w * 0.03, y + h * 0.1, w * 0.94, h * 0.8, 'S');
        doc.setLineDashPattern([], 0);
        doc.line(x + w * 0.03, y + h * 0.1, x + w * 0.97, y + h * 0.9);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('DC', x + w * 0.25, y + h * 0.65);
        doc.text('AC ~', x + w * 0.7, y + h * 0.35);
        break;
      }
      case 'electronic_relay_4ch': {
        doc.rect(x + w * 0.04, y + h * 0.12, w * 0.92, h * 0.76, 'S');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text('ESR12Z-4DX-UC', x + w * 0.5, y + h * 0.42, { align: 'center' });
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.text('4-Kanal Multifunktion', x + w * 0.5, y + h * 0.62, { align: 'center' });
        break;
      }
      case 'potential_arrow_right': {
        doc.setFillColor(220, 38, 38);
        doc.line(x, y + h * 0.5, x + w * 0.4, y + h * 0.5);
        doc.triangle(x + w * 0.4, y + h * 0.2, x + w, y + h * 0.5, x + w * 0.4, y + h * 0.8, 'FD');
        break;
      }
      case 'potential_arrow_left': {
        doc.setFillColor(220, 38, 38);
        doc.line(x + w, y + h * 0.5, x + w * 0.6, y + h * 0.5);
        doc.triangle(x + w * 0.6, y + h * 0.2, x, y + h * 0.5, x + w * 0.6, y + h * 0.8, 'FD');
        break;
      }
      case 'potential_arrow_down': {
        doc.setFillColor(220, 38, 38);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.4);
        doc.triangle(x + w * 0.2, y + h * 0.4, x + w * 0.5, y + h, x + w * 0.8, y + h * 0.4, 'FD');
        break;
      }
      case 'potential_arrow_up': {
        doc.setFillColor(220, 38, 38);
        doc.line(x + w * 0.5, y + h, x + w * 0.5, y + h * 0.6);
        doc.triangle(x + w * 0.2, y + h * 0.6, x + w * 0.5, y, x + w * 0.8, y + h * 0.6, 'FD');
        break;
      }
      case 'potential_rail_source': {
        doc.circle(x + w * 0.5, y + h * 0.5, 0.9, 'S');
        doc.line(x + w * 0.5 + 0.9, y + h * 0.5, x + w, y + h * 0.5);
        break;
      }
      case 'fuse_1p': {
        doc.rect(x + w * 0.25, y + h * 0.25, w * 0.5, h * 0.5);
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h);
        break;
      }
      case 'pilot_lamp': {
        const radius = Math.min(w, h) * 0.35;
        const cx = x + w * 0.5;
        const cy = y + h * 0.5;
        doc.circle(cx, cy, radius);
        doc.line(cx - radius * 0.7, cy - radius * 0.7, cx + radius * 0.7, cy + radius * 0.7);
        doc.line(cx + radius * 0.7, cy - radius * 0.7, cx - radius * 0.7, cy + radius * 0.7);
        doc.line(cx, y, cx, cy - radius);
        doc.line(cx, cy + radius, cx, y + h);
        break;
      }
      case 'terminal_single': {
        doc.line(x + w * 0.5, y, x + w * 0.5, y + h * 0.38);
        doc.circle(x + w * 0.5, y + h * 0.5, 1.0, 'S');
        doc.line(x + w * 0.5, y + h * 0.62, x + w * 0.5, y + h);
        break;
      }
      case 'rcd_4p':
      case 'rcd_2p':
      case 'rcbo_1p_n': {
        const poles = symId === 'rcd_4p' ? 4 : 2;
        for (let p = 0; p < poles; p++) {
          const px = x + w * ((p + 0.5) / poles);
          doc.line(px, y, px, y + h * 0.28);
          doc.line(px, y + h * 0.28, px + w * 0.08, y + h * 0.58);
          doc.line(px, y + h * 0.62, px, y + h);
        }
        doc.ellipse(x + w * 0.5, y + h * 0.8, w * 0.42, h * 0.12);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6);
        doc.text('T', x + w * 0.9, y + h * 0.8);
        break;
      }
      case 'impulse_relay_1no':
      case 'impulse_relay_2no': {
        doc.rect(x + w * 0.08, y + h * 0.25, w * 0.35, h * 0.48);
        doc.line(x + w * 0.25, y, x + w * 0.25, y + h * 0.25);
        doc.line(x + w * 0.25, y + h * 0.73, x + w * 0.25, y + h);
        doc.line(x + w * 0.12, y + h * 0.55, x + w * 0.2, y + h * 0.55);
        doc.line(x + w * 0.2, y + h * 0.55, x + w * 0.2, y + h * 0.4);
        doc.line(x + w * 0.2, y + h * 0.4, x + w * 0.35, y + h * 0.4);
        const contacts = symId === 'impulse_relay_2no' ? 2 : 1;
        for (let c = 0; c < contacts; c++) {
          const cx = x + w * (0.55 + c * 0.3);
          doc.line(cx, y, cx, y + h * 0.35);
          doc.line(cx, y + h * 0.35, cx + w * 0.15, y + h * 0.65);
          doc.line(cx, y + h * 0.65, cx, y + h);
        }
        break;
      }
      case 'timer_relay_multifunction': {
        doc.rect(x + w * 0.1, y + h * 0.25, w * 0.35, h * 0.45);
        doc.line(x + w * 0.1, y + h * 0.25, x + w * 0.45, y + h * 0.7);
        doc.line(x + w * 0.27, y, x + w * 0.27, y + h * 0.25);
        doc.line(x + w * 0.27, y + h * 0.7, x + w * 0.27, y + h);
        doc.line(x + w * 0.75, y, x + w * 0.75, y + h * 0.3);
        doc.line(x + w * 0.75, y + h * 0.3, x + w * 0.6, y + h * 0.6);
        doc.line(x + w * 0.6, y + h * 0.65, x + w * 0.6, y + h);
        doc.line(x + w * 0.85, y + h * 0.65, x + w * 0.85, y + h);
        break;
      }
      case 'surge_arrester_spd': {
        for (let s = 0; s < 4; s++) {
          const sx = x + w * (0.15 + s * 0.22);
          doc.rect(sx - 1.5, y + h * 0.3, 3, 5);
          doc.line(sx - 2, y + h * 0.6, sx + 2, y + h * 0.3);
          doc.line(sx, y, sx, y + h * 0.3);
          doc.line(sx, y + h * 0.65, sx, y + h * 0.8);
        }
        doc.line(x + w * 0.15, y + h * 0.8, x + w * 0.81, y + h * 0.8);
        doc.line(x + w * 0.48, y + h * 0.8, x + w * 0.48, y + h);
        break;
      }
      default: {
        doc.rect(x, y, w, h);
        break;
      }
    }
  }

  /**
   * Generates formatted DIN A3 Klemmenplan (terminal matrix) page in PDF
   */
  private static renderTerminalDiagramPage(
    doc: jsPDF,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number
  ): void {
    const dummyPage: Page = {
      id: 'rep_term',
      pageNumber: 'KP',
      pageType: 'terminal_diagram',
      title: 'Auswertung: Klemmenplan',
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
          projectTitle: project.name,
          commission: 'KOM-2026',
          company: project.company,
          author: project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: 'KP',
          totalSheets: totalSheets.toString()
        }
      }
    };

    this.renderPlotFrame(doc, dummyPage, wMm, hMm, colorMode, totalSheets);

    const strips = TerminalDiagramGenerator.generateTerminalReport(project);
    let curY = 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('KLEMMENPLAN (DIN EN 81346 / IEC 60617)', 20, curY);
    curY += 10;

    for (const [stripName, entries] of strips.entries()) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(colorMode === 'color' ? 200 : 0, colorMode === 'color' ? 100 : 0, 0);
      doc.text(`Klemmenleiste: ${stripName} (Schaltschrank +S1)`, 20, curY);
      curY += 5;

      // Table Header
      const tableX = 20;
      const colWidths = [30, 45, 45, 60, 30];
      const headers = ['Klemme', 'Internes Ziel', 'Externes Ziel', 'Funktionstext', 'Querschnitt'];

      doc.setFillColor(240, 240, 240);
      doc.rect(tableX, curY, 210, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(0, 0, 0);

      let tx = tableX;
      for (let h = 0; h < headers.length; h++) {
        doc.text(headers[h], tx + 2, curY + 5);
        tx += colWidths[h];
      }
      curY += 7;

      // Table Rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      for (const entry of entries) {
        doc.setDrawColor(220, 220, 220);
        doc.line(tableX, curY + 6, tableX + 210, curY + 6);

        tx = tableX;
        doc.setFont('courier', 'bold');
        doc.text(entry.terminalNumber, tx + 2, curY + 4.5);
        tx += colWidths[0];

        doc.setFont('courier', 'normal');
        doc.text(entry.internalTarget, tx + 2, curY + 4.5);
        tx += colWidths[1];

        doc.text(entry.externalTarget, tx + 2, curY + 4.5);
        tx += colWidths[2];

        doc.setFont('helvetica', 'normal');
        doc.text(entry.functionText, tx + 2, curY + 4.5);
        tx += colWidths[3];

        doc.text(entry.crossSection || '2.5mm²', tx + 2, curY + 4.5);

        curY += 6;
      }

      curY += 10;
    }
  }

  /**
   * Generates formatted DIN A3 Stückliste (BOM) page in PDF
   */
  private static renderPartsListPage(
    doc: jsPDF,
    project: Project,
    wMm: number,
    hMm: number,
    colorMode: 'color' | 'monochrome',
    totalSheets: number
  ): void {
    const dummyPage: Page = {
      id: 'rep_bom',
      pageNumber: 'ST',
      pageType: 'parts_list',
      title: 'Auswertung: Stückliste',
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
          projectTitle: project.name,
          commission: 'KOM-2026',
          company: project.company,
          author: project.author,
          date: new Date().toISOString().split('T')[0],
          revision: '1.0',
          sheetNumber: 'ST',
          totalSheets: totalSheets.toString()
        }
      }
    };

    this.renderPlotFrame(doc, dummyPage, wMm, hMm, colorMode, totalSheets);

    const parts = PartsListGenerator.generatePartsList(project);
    let curY = 30;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('ARTIKELSTÜCKLISTE (BILL OF MATERIALS)', 20, curY);
    curY += 10;

    const tableX = 20;
    const colWidths = [18, 45, 65, 40, 50];
    const headers = ['Menge', 'Artikelnummer', 'Beschreibung / Typ', 'Hersteller', 'BMK-Liste'];

    doc.setFillColor(240, 240, 240);
    doc.rect(tableX, curY, 218, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);

    let tx = tableX;
    for (let h = 0; h < headers.length; h++) {
      doc.text(headers[h], tx + 2, curY + 5);
      tx += colWidths[h];
    }
    curY += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    for (const part of parts) {
      doc.setDrawColor(220, 220, 220);
      doc.line(tableX, curY + 6, tableX + 218, curY + 6);

      tx = tableX;
      doc.setFont('helvetica', 'bold');
      doc.text(`${part.quantity}x`, tx + 2, curY + 4.5);
      tx += colWidths[0];

      doc.setFont('courier', 'bold');
      doc.text(part.articleNumber, tx + 2, curY + 4.5);
      tx += colWidths[1];

      doc.setFont('helvetica', 'normal');
      doc.text(part.description, tx + 2, curY + 4.5);
      tx += colWidths[2];

      doc.text(part.manufacturer, tx + 2, curY + 4.5);
      tx += colWidths[3];

      doc.setFont('courier', 'normal');
      doc.text(part.bmkList.join(', '), tx + 2, curY + 4.5);

      curY += 6;
    }
  }

  private static getPinCoords(page: Page, compId: string, pinId: string): { x: number; y: number } | null {
    const comp = page.components.find(c => c.id === compId);
    if (!comp) return null;
    const sym = getSymbolById(comp.symbolId);
    if (!sym) return null;
    const pin = sym.pins.find(p => p.id === pinId);
    if (!pin) return null;
    return { x: comp.x + pin.x, y: comp.y + pin.y };
  }

  private static getPotentialRgb(potential: string, color?: string): { r: number; g: number; b: number } {
    const pot = (potential || '').toUpperCase();
    const col = (color || '').toUpperCase();
    if (col === 'BU' || pot === 'N' || pot.startsWith('N')) return { r: 37, g: 99, b: 235 };
    if (col === 'GNYE' || pot === 'PE' || pot === 'PEN' || pot.startsWith('PE')) return { r: 22, g: 163, b: 74 };
    if (col === 'RD' || pot.startsWith('L') || pot === '+24V' || col === 'BK') return { r: 220, g: 38, b: 38 };
    if (col === 'DBU' || pot === '0V') return { r: 30, g: 64, b: 175 };
    return { r: 220, g: 38, b: 38 };
  }
}
