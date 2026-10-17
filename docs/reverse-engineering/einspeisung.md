# EPLAN P8: allgemeiner Bibliotheksimport

Stand: 17.10.2026. Ausgangspunkt ist PDF-Seite 2 „Einspeisung“ des
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

## Anschlüsse, Kreuzungen und T-Verbindungen

Der Abgleich mit den PDF-Vektoren verwendet weiterhin dieselbe REA-Artefaktidentität.
Die gerichteten Varianten `SPECIAL 64/66/67/69/72` bestehen aus originalen
Bibliothekslinien mit diagonalen Abzweigen; `70` enthält Eckvarianten. Im Beispiel
wird keine automatische Routing-Platzierung mit Punktvariante 8 verwendet.
Eine Kreuzung ohne Quell-Verbindungssymbol erhält keinen aus Koordinaten
erfundenen Verbindungspunkt. Die elektrische Kantenliste bleibt unverändert.

- `Layer.eod/eox`: indexierte Slots mit 284 Bytes; `EFF2` ist die Ebenennummer,
  `EFF5` die Strichstärke in mm, `EE21` die nominale Textgröße. Ebene 311 enthält
  0,25 mm, Ebene 317 1 mm. Bei `SPECIAL 77:1` bleiben deshalb die dicken
  Sammelschienen und der dünne Abzweig verschieden. `EFFB=8` ist kein belegtes
  Ausblendungsbit und wird nicht so verwendet.
- Die Leitungstinte wird innerhalb der tatsächlichen, gedrehten Konturgrenzen
  eines Verbindungssymbols ausgespart. Das Bibliothekssymbol zeichnet dort die
  Geometrie. Die vollständige Leitung bleibt auswählbar; Modell, Anschlussindizes
  und gespeicherte Wegpunkte werden durch diese Darstellung nicht verändert.
  Editor, Verschiebevorschau und PDF verwenden dieselben Linienzüge.
- Der Quell-Funktionstyp 1400 bezeichnet Verteiler. Liegt ein explizites
  Routing-Symbol mit gleicher Anschlussrichtung und gleichem Anker über einem
  solchen Funktionsobjekt, liefert das Routing-Symbol die sichtbare Kontur.
  Beispiel: Funktion 38842 und Routing-Objekt 153626 auf Quellseite 13. Der
  Verteiler bleibt im Modell. Verteiler ohne eine solche Überlagerung behalten
  ihren echten Bibliothekspunkt, etwa Funktion 38837.
- Einige indexierte automatische Routing-Objekte liegen auf keiner gezeichneten
  Quellverbindung und haben kein Gegenstück im PDF. Sie bleiben mit
  `source.routingUsed=false` als editierbare Hilfsobjekte erhalten. Ihre Kontur
  wird bei Auswahl gezeigt, aber nicht gedruckt. Dies ist eine am Beispiel
  geprüfte Nutzungsprüfung, keine vollständige Dekodierung der Sichtbarkeitsflags.
- Gleiche Y-Koordinaten zweier nach oben zeigender Anschlüsse erlauben keine
  direkte Leitung durch das Gerät. Die Quellroute berücksichtigt beide
  Anschlussrichtungen; Q12 läuft über die originalen oberen Ecken.
- Physische Anschlusskoordinaten sind keine zusätzlichen Kreisgrafiken. Im
  Verdrahtungsmodus gibt es temporäre Anschlussgriffe; im PDF erscheinen nur die
  tatsächlichen Kreise der Bibliothek. Gefüllte Quellpunkte verwenden die am PDF
  beobachtete 0,02-mm-Kontur statt einer vergrößernden normalen Umrandung.
- Anschlussbezeichnungen stammen aus vollständig strukturiert gelesenen
  Property-Unterobjekten: `ED63=20028`, `ED64` = Anschlussindex plus 1,
  `EC55` relativ zum physischen Pin, `EE19=2` horizontale Anordnung, `EC57`
  Ausrichtung. Die nominale P8-Textgröße wird für SVG/PDF mit dem am Export
  geprüften Faktor 1,242 zur Schriftgröße umgerechnet. Instanztexte bleiben
  veränderbar. Routing-Symbole bekommen keine künstlichen Pin-Nummern.

Regressionen prüfen die echten Varianten 64:0, 66:0/1, 69:0 und 72:0, Q12s
obere Route, die 0,25-/1-mm-Sammelschiene sowie Auswahl, Verschieben,
Anschlussbezeichnungen und PDF-Ausgabe. Visuelle Stichproben verwenden die
T-Verbindungen auf PDF-Seite 2 und die Kreuzung auf PDF-Seite 24.

## Gemeinsames Raster und Bibliotheksmaßstab

Das Projekt speichert `drawingUnitsPerMm`, die Seite ihr Raster mit Abstand
und Ursprung, und jede Bibliotheksdefinition ihren Maßstab `unitsPerMm` und
logischen `insertionPoint`. Beim P8-Import bleibt der Maßstab `1000/420`
Zeichnungseinheiten pro mm erhalten. Das Editor-Grundraster beträgt 4 mm,
Halbraster 2 mm und Feinraster 1 mm, mit dem Quellursprung unten links.
Rasterdarstellung und Fang verwenden dieselben Werte, einschließlich des
y-abwärts gerichteten Seitenursprungs. Die 4 mm sind die Editor-Voreinstellung;
abweichende proprietäre Projekteinstellungen sind damit nicht vollständig dekodiert.

Einrasten, Vorschau, Maus- und Touch-Verschieben verwenden den logischen
Einfügepunkt statt der normalisierten Kontur-Ecke. Beim Drehen bleibt dieser
Punkt stehen. Der Eigenschaftendialog zeigt und bearbeitet denselben Punkt.
„Raster aus“ lässt freie Koordinaten zu. Neu erzeugte Leitungsknicke und
Ausweichstücke nach dem Verschieben richten sich nach dem Seitenraster.

Die P8-Stammdaten bleiben maßhaltig. Im Beispiel besitzen auch tatsächlich
verbundene Kontakte konturbedingte Viertelmillimeter-Abstände, etwa 0,75 mm
bis zum Rand eines runden Anschlusses. Deren physische Koordinaten werden
beibehalten. Der Rasterfang führt Einfügepunkte und Leitungsachsen; ein
unabhängiges Runden aller Kontaktkonturen würde die Originalgeometrie verändern.

Die Standardbibliothek hat explizite Einfügepunkte und einen Maßstab von zwei
Zeichnungseinheiten pro mm. Beim Verwenden in einem P8-Projekt werden ihre
Konturen, physischen Pins und Maße zusammen in den Projektmaßstab umgerechnet.
LS-Schalter 3P, NH-Trenner 3P, Umschalter 4P und Drehstromzähler haben jetzt
einheitliche 12-mm-Polabstände. Einzelne ungerade Pin-Koordinaten wurden auf
das 1-mm-Feinraster gebracht; fehlende Anschlussstummel an Thermostat,
Wechselrichter und Mehrkanalrelais sowie am oberen T-Abzweig wurden ergänzt.
SVG- und PDF-Polpositionen wurden gemeinsam korrigiert.

Autoconnect verwendet bei Seiten mit physischem Raster eine numerische
Achstoleranz von `1e-6` Zeichnungseinheiten. Ein räumlich benachbarter Pin
erzeugt dadurch keine Verbindung in die nächste Rasterspalte. Die importierte
Kantenliste bleibt erhalten. Makros speichern ihren Maßstab und Einfügegriff;
relative Komponentenpositionen und Leitungswegpunkte werden gemeinsam
normalisiert und beim Einfügen in einen anderen Maßstab umgerechnet.

Prüfungen verwenden das ganze Originalarchiv, die Quellenkoordinaten von Q12,
alle physischen Pins der importierten Bibliotheken, alle Standardbibliotheks-Pins,
vier Drehstellungen, genaue Autoconnect-Achsen und Makro-Wegpunkte. Der
Browser-Test prüft Import, Drehen und Verschieben von Q12, neue P8- und
Standardplatzierungen, eine neue Leitung, Rasterwechsel und erneutes JSON-Laden.

## Verbleibende Grenzen

Die Slot-/Indexinterpretation ist für das mitgelieferte P8-Layout rekonstruiert,
kein vollständiger allgemeiner c-tree-/EPLAN-Parser für alle Versionen.
Einige Slots liefern nur einen lesbaren Präfix. Solche Grenzen werden pro Seite
in `importDiagnostics` gemeldet, nicht als fehlerfreie Dekodierung ausgegeben.
Die vollständige Semantik dynamischer Property-Gruppen, Haupt-/Nebenfunktionen,
aller Grafiktypen und automatisch erzeugter EPLAN-Auswertungsformulare ist
weiterhin nicht bewiesen. Ein pixelidentisches Property-Layout und ein nativer
EPLAN-Rückexport werden nicht behauptet.
Neun Anschluss-Textplatzierungen in verwendeten Varianten referenzieren Ebene
809, die im indexierten Ebenenbestand fehlt. Ohne belegte Textgröße erzeugt der
Importer eine Diagnose statt einer geratenen Beschriftung. Browser-Schriften
und die Helvetica-Näherung des PDF-Exports sind kein pixelidentischer Ersatz
für die Originalschrift Tahoma.

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
