# EPLAN P8: allgemeiner Bibliotheksimport

Stand: 16.10.2026. Ausgangspunkt ist PDF-Seite 2 „Einspeisung“ des
bereitgestellten EPLAN-P8-Exports. Quelle sind ausschließlich die unveränderten
Archivteile `Eplan Haus.zip.001` und `.002`. Der PDF-Export wird nicht eingeblendet.

## REA und Evidenz

Untersuchungsworkflow: [REA von morluto/rea](https://github.com/morluto/rea),
[reverse-engineer-anything/SKILL.md](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md).
Das vorhandene REA-Artefaktinventar wird weiterverwendet:

- CLI `rea-agents@6.5.0 inspect-artifact /tmp/haus.zip --format json`.
- Evidence `ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`.
- Zusammengefügtes ZIP SHA-256:
  `6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`.
- Provider `rea-artifact-graph`, Version 1.

REA belegt Container und Mitgliederinventar. Die folgenden EOD-Felder wurden
durch eigene begrenzte Byte-Proben, Identitäts-/Indexabgleich und Abgleich mit
dem Beispiel untersucht. Sie sind keine vom REA-Provider behauptete
formatspezifische Semantik. Es wurde keine EPLAN-Installation ausgeführt.

## Gemeinsamer Importweg

Der frühere, auf den Seitentitel „Einspeisung“ begrenzte Nachzeichnungsweg ist
entfernt. `EplanNativeProject` liest die Tabellen einmal pro Projekt und verwendet
denselben Import für alle aktiven Seiten, unabhängig vom Titel.

`EplanSymbolLibrary` liest die mitgelieferten `.sdb`-Stammdaten. Die Zuordnung
der Bibliotheksindizes stammt aus dem benannten Setting
`TrDMProject.EmbeddedMasterDataLibraries.SymbolLibs` in
`Settings.xdb/Setting.eod`; Bibliotheksnummern werden nicht fest einprogrammiert.
Für das Beispiel lautet diese Liste:
`SPECIAL`, `IEC_symbol`, `IEC_single_symbol`, leer, `GRAPHICS`, `PNE1ESS`,
`HYD1ESS`, `HYD2ESS`, leer.

| Daten | Eigenschaft | Bedeutung |
| --- | --- | --- |
| Platzierung | `EF4D`, `EF4E`, `EF4F` | Bibliotheksindex, öffentliche Symbolnummer, Variante |
| Symbol | `EB51`, `EB52` | Name, öffentliche Nummer (verschieden von Objekt-ID) |
| Variante | `ED95`, `ED96` | Elternsymbol-Objekt, Variantenindex |
| Anschlussblock | `ED97` | Beginn eines physischen Anschlusses |
| Anschluss | `EDBD`, `EDBE`, `EDBF` | physischer Index, lokale Position, Richtung |
| Bibliotheksgrafik | `EBF1` | Elternvariante |
| Platzierung | `ED5A`, `EBF2` | Position in mm, gezeichnete Seite |
| Beschriftungsplatzierung | `EA65`, `ED63`, `EC55` | Unterobjekt, Feldnummer, lokale Textposition |
| Verbindung | `EB2B`, `EB2C`, `EB2E`, `EB2F` | Quell-/Zielobjekt und physische Anschlussindizes |

Omittierte Standardwerte wie Anschlussindex 0 oder Koordinate (0,0) sind
zulässig. Die Pins werden nur aus dem Variantenkopf gelesen, vor den
Beschriftungs-Unterobjekten. Richtungen 1/2/4/8 entsprechen oben/rechts/unten/links.
Koordinaten werden genau einmal von mm mit Ursprung unten links ins y-abwärts
gerichtete Editor-Koordinatensystem umgerechnet.

| Tabelle | Slotgröße (Bytes) | Index |
| --- | ---: | --- |
| Page | 1134 | untypisiert |
| Function | 1333 | typisiert |
| IPoint | 530 | typisiert |
| Instance (Projekt) | 215 | typisiert |
| Potential | 513 | untypisiert |
| Connection | 980 | untypisiert |
| Symbol (.sdb) | 901 | untypisiert |
| Variant (.sdb) | 635 | untypisiert |
| Instance (.sdb) | 134 | untypisiert |

Die Symbolkonturen stammen aus den Grafikobjekten der referenzierten Variante,
nicht aus einer Tabelle handgezeichneter Ersatzsymbole. Enthalten sind Linien,
Kreise, Rechtecke, Polygone und literale Symboltexte. Property-Platzhalter werden
nicht als feste Texte in Symbole kopiert. Variable Gerätekästen erhalten eine
gemeinsame größenabhängige Definition anhand ihrer Quellausdehnung.

## Editierbares Projektmodell

- `Project.symbolLibrary` enthält gemeinsame Definitionen. Jede Platzierung
  referenziert ausschließlich eine `symbolId`, mit eigenen Eigenschaften,
  Position, Rotation und Anschlussbezeichnungen.
- Keine neuen Inline-Definitionen in `component.importedSymbol` und keine
  seitenbezogene eingefrorene Zeichnung. Ältere JSON-Projekte werden beim Laden
  in gemeinsame Stammdaten überführt.
- Freie Texte sind normale editierbare Text-Platzierungen mit Funktionstext;
  freie Grafikobjekte referenzieren ebenfalls gemeinsame Projektressourcen.
- Die mitgebrachten Symbole erscheinen in der regulären Bibliothek und können
  neu platziert werden. Makros nehmen verwendete Stammdaten mit.
- Editor: normale dunkle Fläche, Raster, Farben, Auswahl, Verschieben, Drehen,
  Eigenschaftendialog, Anschlussbezeichnungen und Verdrahtung.
- PDF: weißes Papier, Druckfarben und aktuelle bearbeitete Eigenschaften.
- JSON, eigenes Projekt-XML und eigene `.zw1`-Archive erhalten die Stammdaten.
  Das ist kein Rückexport der proprietären EPLAN-Datenbank.

Die explizit importierte Leitungsstruktur wird beim Öffnen erhalten. Autoconnect
erfindet keine zusätzlichen Kanten zwischen unveränderten Quellplatzierungen;
neue Editorplatzierungen können weiterhin automatisch verbunden werden.
Gleiches BMK allein beweist bei P8-Geräteanschlüssen keinen Kontaktspiegel.

## Befund für das Beispiel

Alle 4.206 Bibliotheksverweise der untersuchten Objektklassen lassen sich
auflösen: 2.215 Function-, 1.681 Instance-, 302 IPoint- und 8 Potential-Objekte.
Alle 3.830 Quell-/Zielanschlüsse der 1.915 Verbindungsdatensätze existieren in
der jeweiligen Bibliotheksvariante.

- 1.753 Verbindungen besitzen eine gezeichnete Seite und werden als Leitungen
  importiert; davon 91 auf „Einspeisung“.
- 162 Datensätze ohne gezeichnete Seite bleiben als `logicalConnections`
  erhalten. Sie dürfen keine zusätzlichen sichtbaren Linien erzeugen.
- Der indexierte Page-Bestand enthält 48 aktive Seiten: die 45 Seiten des
  Referenzumfangs sowie Inhaltsverzeichnis und zwei Klemmenberichte. Die vier
  zuvor durch rohe Markersuche wiedergefundenen gelöschten Steckerberichte
  werden nicht mehr übernommen.
- Q12 hat zwei separate physische Platzierungen mit derselben
  `IEC_symbol:1526:0`-Definition. Deren 28 Konturobjekte und acht physische Pins
  stammen aus `QLTR4_2` der mitgelieferten Bibliothek.

## Grenzen

Die Slot-/Indexinterpretation ist für das mitgelieferte P8-Layout rekonstruiert,
kein vollständiger allgemeiner c-tree-/EPLAN-Parser für alle Versionen.
Einige Slots liefern nur einen lesbaren Präfix. Solche Grenzen werden pro Seite
in `importDiagnostics` gemeldet, nicht als fehlerfreie Dekodierung ausgegeben.
Die vollständige Semantik dynamischer Property-Gruppen, Haupt-/Nebenfunktionen,
aller Grafiktypen und automatisch erzeugter EPLAN-Auswertungsformulare ist
weiterhin nicht bewiesen. Ein pixelidentisches Property-Layout und ein nativer
EPLAN-Rückexport werden nicht behauptet.

## Prüfen

```sh
npm test
npm run build
npx tsx scripts/export-einspeisung.ts /tmp/einspeisung-import.pdf
npm run dev
```

Die Integrationsprüfung importiert das echte geteilte Archiv, prüft alle Seiten
und Anschlüsse, gemeinsame Definitionen, mehrere andere Stromlaufplanseiten,
Editieren/Rotation/Anschlusspositionen, JSON und PDF. Weitere Prüfungen decken
Editor-/PDF-Farben, sichtbare geänderte Texte, den Eigenschaftendialog,
Bibliothekswechsel, portable Makros und verlustfreies eigenes Projekt-XML ab.
