import fs from 'node:fs';
import JSZip from 'jszip';
import { EdbProjectParser } from '../src/packages/EdbProjectParser';
import { PdfExporter } from '../src/export/PdfExporter';

const archive = Buffer.concat(['Eplan Haus.zip.001', 'Eplan Haus.zip.002'].map(f => fs.readFileSync(f)));
const { project, messages } = await EdbProjectParser.parseEdbProject(await JSZip.loadAsync(archive));
const page = project.pages.find(p => p.title === 'Einspeisung');
if (!page || !project.symbolLibrary?.length) throw new Error('Einspeisung wurde nicht mit Projektbibliotheken importiert.');
const output = process.argv[2] || '/tmp/einspeisung-import.pdf';
const pdf = await PdfExporter.exportToPdf(project, {
  paperFormat: 'a3', colorMode: 'color', pageRange: 'current', currentPageId: page.id,
  interactiveCrossReferences: false, includeBookmarks: false, includeTerminalDiagram: false,
  includePartsList: false, plotFrame: true
});
fs.writeFileSync(output, new Uint8Array(await pdf.arrayBuffer()));
console.log(messages.join('\n'));
console.log(`PDF: ${output}`);
