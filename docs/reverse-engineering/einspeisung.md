# EPLAN P8: Einspeisung, PDF-Seite 2 / Blatt 1

Untersuchungsstand vom 16.10.2026. Referenz: der bereitgestellte EPLAN-P8-PDF-Export,
Seite 2 „Einspeisung“. Importquelle bleiben ausschließlich die beiden
Repository-Dateien `Eplan Haus.zip.001` und `.002`; der PDF-Export wird weder
als Bild eingeblendet noch zur Laufzeit benötigt.

## REA und Herkunft der Befunde

Verwendet wurde [REA von morluto/rea](https://github.com/morluto/rea), CLI-Version
6.5.0, mit dem Workflow aus
[reverse-engineer-anything/SKILL.md](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md).
Die Archivteile werden unverändert in numerischer Reihenfolge zusammengesetzt:

```sh
cat 'Eplan Haus.zip.001' 'Eplan Haus.zip.002' > /tmp/haus.zip
npx -y rea-agents@6.5.0 inspect-artifact /tmp/haus.zip --format json > /tmp/rea-haus-evidence.json
```

REA-Evidence-ID:
`ev_de4dc0fb509a8c5e9b4e0f8cea75543cdb07faa07664ed13c6242903550e644b`.
SHA-256 des zusammengefügten Archivs:
`6fdf42f60f4728528b87ebfed9fef7b610122d8563f6801a1a0d6e46cd81d028`.
Provider: `rea-artifact-graph`, Version 1.

REA belegt den ZIP-Container und dessen Inventar. Die EOD-Feldinterpretation
wurde anschließend durch eigene Byte-Proben, Indexabgleich und den visuellen
PDF-Vergleich ermittelt. REA selbst behauptet ausdrücklich keine formatspezifische
EOD-Semantik und führt das Ziel nicht aus. Es wurde keine EPLAN-Installation
oder ausführbare EPLAN-Datei analysiert.

## Beobachtete Struktur

Die untersuchten Tabellen besitzen feste Slots. Objekt-ID und Typ stehen im
Slot-Kopf in Big Endian; die serialisierten Eigenschaften im Datenbereich
verwenden Little Endian. Der Index verweist mit einer 1-basierten Slotnummer.

| Tabelle | Slotgröße in Bytes |
| --- | ---: |
| Page | 1134 |
| Function | 1333 |
| IPoint | 530 |
| Instance | 215 |
| Connection | 980 |
| Potential | 513 |

`EodReader.ts` beschränkt alle Feldzugriffe auf einen Slot, dekomprimiert
passende zlib-Daten mit einer Größenbegrenzung und prüft die Identität im
Datenbereich gegen den Slot-Kopf. EOX-Suffixkandidaten werden nur bei passender
Slotnummer und Objektidentität akzeptiert, bei typisierten Indizes zusätzlich
mit passendem Typ. Das ist eine Rekonstruktion des beobachteten Layouts, kein
vollständiger allgemeiner EOX-/c-tree-Baumparser. Andere Slotgrößen werden vom
nativen Import nicht übernommen; das bisherige Verfahren bleibt verfügbar.

Wichtige Eigenschaften:

| Eigenschaft | Interpretation |
| --- | --- |
| `EBF2` | Seite: Objekttyp + Seiten-ID; `EBF1` kann stattdessen eine Gruppe als Elternobjekt benennen |
| `ED5A` | Platzierung als zwei Float64-Werte in mm, Ursprung unten links |
| `EF4E`, `EF4F` | Symbolnummer und Variante |
| `EE2C`, `EE2D`, `EE2E` | Kennbuchstabe, Zähler und Zusatzkennung |
| `EB19` / Array `80 03 B9` | Anschlussbezeichnungen |
| `EB2B`, `EB2E` | Quell-/Zielobjekt einschließlich Typ |
| `EB2C`, `EB2F` | Nullbasierter physischer Anschlussindex |
| `EC55`, `EC5F`, `EE21` | Textposition, mehrsprachiger UTF-8-Text, Schriftgröße |
| `2B10` | Bearbeitungsdatum der Seite als Unixzeit in einer Zeichenkette |

Beispiel aus den Originaldaten, unabhängig von automatisch vergebenen App-IDs:

- `Function`-Objekte `0x9A33` und `0x9A34`: zwei physische vierpolige
  Platzierungen von `-Q12`, mit Ankern `(56,248)` und `(92,248)` mm.
  Die oberen Anschlüsse liegen bei `y=252` mm.
- `-X0`: vier getrennte Klemmen bei `x=156,164,172,188`, `y=72` mm,
  mit Bezeichnungen `L1`, `L2`, `L3`, `PEN`.
- `-F0`, Objekt `0x8988`: Anschlüsse `1..6`. Die drei X0-Verbindungen
  enden an den physischen Indizes `0,2,4`, also den Anschlüssen `1,3,5`.
- Das ältere Objekt `-F02` wird nicht mehr als zusätzliche Sicherung dargestellt.
- `IPoint`-Objekt `137`: „L1NT/L2NT/L3NT/NNT“, die bisher übersehene
  Abbruchstelle des Heizungsabgangs.

## Änderung und überprüftes Ergebnis

Der native Pfad ist bewusst auf die Seite mit dem Titel „Einspeisung“ begrenzt.
Andere Seiten verwenden weiterhin den bestehenden Parser. Die bisherige
Zusammenfassung aller gleichen BMK zu einem Symbol wird auf dieser Seite durch
getrennte physische Platzierungen mit eigenen Anschlussgeometrien ersetzt.

Vorher wurden 37 Leitungen auf dieser Seite rekonstruiert. Jetzt werden 125
Platzierungsobjekte und alle 91 gefundenen Verbindungsdatensätze übernommen;
alle Quell-/Zielanschlüsse sind auflösbar. Zu diesen Datensätzen gehören auch
Bündel-/Darstellungsverbindungen. Die Zahl 91 ist daher keine Aussage über
91 unabhängige elektrische Netze.

Die Seite behält ihre expliziten Verbindungen beim Öffnen und beim JSON-Roundtrip.
Autoconnect ergänzt dort keine vermuteten Leitungen. SVG-Anzeige und PDF-Ausgabe
berücksichtigen die importierten Geometrien und Stützpunkte. Pfeilrichtungen
verwenden die Symbolvariante, Querverweistexte andere passende Abbruchstellen.
Freie Texte, Potentialdefinitionen, Strukturkästen und die vorhandene Rastergrafik
werden ebenfalls dargestellt. Das Datum stammt aus der Seite: 15.09.2026.

Das Archiv enthält im bisherigen Seitennavigator 49 Seiten, darunter vier
zusätzliche Steckerpläne. Die Referenz-PDF umfasst 45 Seiten. Die Differenz
allein belegt keinen Fehler; die zusätzlichen Seiten werden nicht entfernt.
Das Schriftfeld zeigt deshalb weiterhin den Umfang des importierten Projekts.

## Grenzen des Ergebnisses

Dies ist noch keine bestätigte fehlerfreie 1:1-Reproduktion von P8:

- Die unterstützten Symbolfamilien werden anhand der beobachteten Symbole
  gezeichnet. Die vollständigen ursprünglichen Symbolbibliothekskonturen und
  alle Property-Text-Layouts sind noch nicht dekodiert. Einzelne Konturen,
  Textpositionen und das F26-artige Schriftfeld weichen von der Referenz ab.
- Zwei Quellslots liefern nur einen lesbaren Präfix: IPoint 137 und Textobjekt
  152373 („Heizung“). Die für diese Seite benötigten Platzierungsfelder und
  der deutsche Text sind lesbar; die restlichen Daten sind nicht validiert.
  Der Import meldet diese Grenze ausdrücklich. Daraus wird keine Beschädigung
  des ursprünglichen EPLAN-Projekts abgeleitet.
- Die Routen verwenden Original-Winkel-/T-Punkte, wählen zwischen ihnen aber
  geometrisch einen orthogonalen Weg. Vollständige P8-Routingsemantik ist noch
  nicht nachgewiesen.
- Die native Grafik ist beim JSON-Speichern enthalten. Weitere Austauschformate,
  Makroexport und die Neuberechnung aller Textgrafiken nach Eigenschaftsänderungen
  sind nicht als vollständig unterstützt verifiziert. Die grünen nativen
  Querverweistexte sind im PDF noch keine interaktiven Sprunglinks.

## Reproduzieren und prüfen

```sh
npm ci --ignore-scripts
npm test
npm run build
npx tsx scripts/export-einspeisung.ts /tmp/einspeisung-import.pdf
npm run dev
```

Im Browser über **Projekt → Öffnen** beide Archivteile gemeinsam auswählen.
Die Einspeisung wird als erste Stromlaufplanseite geöffnet und eingepasst.
Geprüft wurde Chromium/Playwright: 125 SVG-Objektgruppen, 91 Leitungsgruppen,
keine JavaScript-Seitenfehler beim Import. Die Ausgabe wurde visuell mit
PDF-Seite 2 verglichen; es wurde kein Pixelgleichheitstest behauptet.

`EplanNativePage.test.ts` prüft das echte Archiv, die getrennten Q12-Platzierungen,
X0-Koordinaten, phasengenauen F0-Anschlüsse, UTF-8, Querverweistexte,
Anschlussintegrität, JSON-Roundtrip, Autoconnect-Erhalt, Begrenzung von Feldzugriffen,
explizite Fragmentdiagnostik und die PDF-Erzeugung. Die bestehenden Tests bleiben
Teil desselben Testlaufs.
