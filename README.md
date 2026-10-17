# ⚡ Elektroplan CAE Suite

Eine moderne, professionelle **Elektroplan- & Stromlaufplan-Software für Windows und Web** mit Unterstützung für Projekt-Archive (`.zw1`, `.edz`, `.xml`) und normgerechter Schaltungsplanung nach **DIN EN 81346-2**, **IEC 60617** und **DIN EN ISO 7200**.

---

## 🚀 Highlights & Features

### 📦 Projekt- & Archiv-Verwaltung
* **Projekt-Backups (`.zw1`)**: Öffnen, Entpacken, Bearbeiten und erneuter Export von kompletten Projektarchiven inklusive Steuerdatei und Projektdatenbank-Verzeichnis.
* **Artikel- & Makropakete (`.edz`)**: Import und Inspektion von Artikel- und Makropaketen mit 2D/3D-Stammdaten und XML-Artikelspezifikationen.
* **Projekt-XML**: Standardisiertes XML-Austauschformat für Schaltpläne, Symbole und Verbindungen.
* **EPLAN-P8-Bibliotheksimport**: Mitgelieferte Symbolbibliotheken liefern Konturen, Varianten und physische Anschlüsse für alle aktiven Seiten. Platzierungen bleiben regulär editierbar; Stammdaten bleiben beim Speichern erhalten. Editor und PDF verwenden ihre jeweilige Farbgebung. Formatbefunde und Grenzen: [REA-Untersuchung](docs/reverse-engineering/einspeisung.md).

### 📐 Normgerechte Schaltungsplanung (DIN EN 81346 / IEC 60617)
* **Kennzeichnungsstruktur**: Vollständige Unterstützung von `=Anlage` (z.B. `=A1`), `+Ort` (z.B. `+S1`) und `-BMK` (Betriebsmittelkennzeichen wie `-K1`, `-Q1`, `-M1`).
* **CAD Normblatt (DIN A3 Landscape)**:
  * Pfad-Spalten `0` bis `9` für präzise Querverweise.
  * Zeilenraster `A` bis `F`.
  * Genormtes Schriftfeld nach **DIN EN ISO 7200** (Projektname, Zeichnungsnummer, Datum, Ersteller, Blattnummer).
* **Rückgängig und Wiederholen im Editor**: Änderungen über die Pfeile in der Werkzeugleiste, im Menü „Bearbeiten“ oder mit `Strg+Z` zurücknehmen; `Strg+Y` / `Strg+Umschalt+Z` wiederholt sie. Das gilt für Platzieren, Verschieben, Drehen, Löschen, Leitungen, Makros, Eigenschaften und neue Seiten. Ein Verschieben ist ein Schritt. Der Sitzungsverlauf hält bis zu 100 Schritte mit einem Speicherbudget; Öffnen oder Anlegen eines Projekts startet einen neuen Verlauf. In Textfeldern bleibt die normale Text-Rückgängig-Funktion aktiv.
* **Mehrfachauswahl und gemeinsames Verschieben**: Im Auswahlwerkzeug mit der Maus auf einer freien Fläche einen Rahmen aufziehen. Vollständig eingeschlossene Symbolkörper und Kabeldefinitionen werden ausgewählt. `Strg`-/`Umschalt`-Klick fügt einzelne Elemente hinzu oder entfernt sie; mit gedrückter Taste ergänzt ein weiterer Rahmen die Auswahl. `Strg+A` wählt alle Elemente der aktiven Seite. An einem ausgewählten Element ziehen, um die gesamte Auswahl um denselben Rasterschritt zu verschieben. Interne Leitungsstützpunkte folgen mit; Leitungsstützpunkte zu nicht ausgewählten Geräten bleiben an ihrem Platz. `Esc` bricht das laufende Verschieben ab.
* **Gemeinsame Eigenschaften**: Bei mehreren ausgewählten Elementen zeigt die rechte Eigenschaftenleiste gemeinsame Werte und kennzeichnet unterschiedliche Werte. `F2`, Doppelklick oder das Kontextmenü öffnet diesen Bereich. Schriftgrößen für BMK, Funktionstexte, technische Daten, Verweise und Anschluss-/Aderbezeichnungen lassen sich in Millimetern gemeinsam ändern. „Änderungen übernehmen“ schreibt nur bearbeitete Felder; individuelle Textpositionen, Winkel und Sichtbarkeit bleiben erhalten. Gemeinsames Verschieben, Löschen und Übernehmen von Eigenschaften sind jeweils ein Rückgängig-Schritt.
* **Anklickbare Querverweise im Editor**: Verweise im Plan, in der Seitenleiste und im Eigenschaftendialog springen zum Gegenstück. Das Zielelement wird ausgewählt und zentriert; mehrere Kontaktverweise lassen sich einzeln anklicken. Geteilte Seitennummern wie `/21-3.5` werden vollständig aufgelöst. Ist nur die Seite/Spalte auflösbar, markiert der Editor diese Zielstelle.
* **Automatischer Querverweis- & Kontaktspiegel-Engine**:
  * Schützspulen berechnen und zeichnen automatisch den **Kontaktspiegel** aller zugehörigen Kontakte mit Blatt- und Pfadangabe (`/1.2`, `/2.1`).
  * Hilfskontakte zeigen automatisch die Blatt- und Pfadreferenz ihrer übergeordneten Spule an.
* **Autoconnecting & Leitungsverbindungen**:
  * Automatisches Verbinden von Anschlusspunkten in Fluchtlinie.
  * Automatische T-Stücke und Knotenpunkte bei abzweigenden Leitungen.
* **DIN EN 60617 Symbolbibliothek & Hersteller-Komponenten**:
  * **Fehlerstrom-Schutzeinrichtungen (RCD / FI)**:
    * 4-polig: z.B. **Hager CDS440D** / **Siemens 5SV3344-6** (40A / 30mA Typ A mit Summenstromwandler & Prüftaste `T`).
    * 2-polig: z.B. **ABB FH202** / **Hager CDA225D** (25A / 30mA).
    * Kombischalter (RCBO): **Siemens 5SV1316-6KK16** (1P+N B16A / 30mA in nur 1 TE!).
  * **Stromstoßrelais / Stromstoßschalter (Schrittschalter)**:
    * 1 Schließer (1NO): **Finder 20.21.8.230.4000** / **Hager EPN510** (230V AC 16A mit Rastungs-/Schrittsymbol).
    * 2 Schließer (2NO): **Finder 20.22.8.230.4000** (Serienschaltung für getrennte Leuchtengruppen).
  * **Multifunktions-Zeitrelais**: **Eaton ETR4-69-A** / **Finder 80.01** (24-240V AC/DC mit Wechslerkontakt & Steuerkontakt B1).
  * **Überspannungsschutz (SPD Typ 2)**: **Dehn DEHNguard M TNS 275** (4-polig mit Varistoren und PE-Sammelschiene).
  * **Schütze & Motorschutz**: Siemens SIRIUS 3RT2016 (4kW 24VDC), Siemens 3RV2011 Motorschutzschalter (2.8 - 4.0A).
  * **Befehls- & Meldegeräte**: NOT-HALT Pilztaster mit Rastung, EIN/AUS-Taster, Meldeleuchten.
  * **Antriebe**: Drehstrom-Asynchronmotoren (M 3~ mit U1, V1, W1, PE).
  * **Klemmen & Versorgung**: Reihenklemmen `-X1`, PE-Schutzklemmen, 24V DC Schaltnetzteile.
* **Integrierter Artikelkatalog**: Direkte Suche nach Herstellern (Hager, Finder, Siemens, ABB, Eaton, Dehn) und 1-Klick-Zuweisung aller Bestelldaten zu platzierten Geräten.

### 📊 Automatische Auswertungen & Reports
* **Klemmenplan (Terminal Diagram)**: Vollständige Klemmenleisten-Matrix (`-X1`) mit automatischer Zuordnung interner Schaltschrankziele und externer Feldkomponenten.
* **Stückliste (Bill of Materials / BOM)**: Aggregierte Artikelliste mit Hersteller, Bestellnummer, technischer Beschreibung, Mengenzählung und BMK-Referenzliste.

### 📑 Smart PDF-Export (Interaktive Vektor-PDFs)
* **Klickbare Querverweis-Hyperlinks**: Beim Anklicken eines Querverweises im PDF (z.B. `/1.4` an einem Hilfskontakt oder `/2.1` im Kontaktspiegel einer Schützspule) springt der PDF-Reader direkt auf das Zielblatt zum Gegenstück!
* **Strukturierter Lesezeichenbaum (Bookmarks)**: Dokumentengliederung nach DIN EN 81346 (`=Anlage` ➔ `+Ort` ➔ `Blatt-Nr: Titel`).
* **Vektor-Normblatt**: Druck des DIN A3 / DIN A4 Normblatts mit Spalten `0..9`, Zeilen `A..F` und Schriftfeld nach DIN EN ISO 7200.
* **Integrierte Auswertungsseiten**: Optionales automatisches Anhängen des Klemmenplans und der Stückliste als vollformatierte PDF-Seiten.
* **Farb- & Monochrom-Modus**: Ausgabe in Standard-Farbgebung oder optimiert für Schwarz/Weiß-Großformatplotter.

---

## 💻 Windows Anwendung (Desktop)

Die Anwendung ist als eigenständige **Windows Desktop-Anwendung** konzipiert (Electron + TypeScript).

### Windows Executable (.exe) bauen
Um die Windows `.exe` (Installer & Portable Version) lokal zu erstellen:
```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Windows-Installer und Portable .exe erstellen
npm run dist:win
```
Die erzeugten Windows-Dateien (`.exe`) befinden sich anschließend im Ordner `release/`.

### Automatische Windows Builds via GitHub Actions
Im Repository ist ein GitHub Actions Workflow (`.github/workflows/build-windows.yml`) eingerichtet. Bei jedem Push oder Release wird automatisch ein frischer Windows-Installer (`.exe`) gebaut und als Download-Artefakt bereitgestellt.

---

## 🛠️ Entwicklung & Web-Vorschau

```bash
# Entwicklungsserver starten
npm run dev

# Im Browser öffnen: http://localhost:5173
```

## 📱 Smartphone & Tablet Unterstützung

Elektroplan unterstützt mobile Endgeräte (iOS Safari, Android Chrome) mit nativer Touch-Bedienung und responsivem Drawer-Layout:

* **Touch-Gesten**:
  * **2-Finger Pinch-to-Zoom**: Stufenloses Vergrößern und Verkleinern des Schaltplans.
  * **1-Finger Pan**: Intuitives Verschieben des DIN A3 Normblatts durch Wischen.
  * **Touch-Platzierung**: Symbol im Menü auswählen und mit Fingertipp auf dem Plan positionieren.
  * **Verschieben von Bauteilen**: Bauteile antippen und an die gewünschte Rasterposition ziehen.
* **Mobiles UI-Design**:
  * Einklappbare Off-Canvas Drawers (Menü `☰` für Seiten, Symbole & Artikelkatalog; Info `⚙️` für Eigenschaften & Archiv-Inspektor).
  * **Floating Quick Bar**: Schnellzugriff auf Zoom-Fit (`🔍 Fit`), Verdrahten (`🔌`), Drehen (`🔄`), Löschen (`🗑️`) und PDF-Export.
* **Progressive Web App (PWA)**:
  * Im mobilen Browser kann Elektroplan über *"Zum Home-Bildschirm hinzufügen"* als eigenständige Vollbild-App ohne Browser-Leiste installiert werden.
* **Live Smartphone-Testmöglichkeiten**:
  1. **Über GitHub Pages (Weltweit über Internet)**: [https://vitals5.github.io/elektroplan/](https://vitals5.github.io/elektroplan/)
  2. **Im lokalen WLAN**: Mit `npm run dev` starten und am Smartphone `http://<PC-IP>:5173` aufrufen (oder den QR-Code über den Button `📱 Mobil testen` in der App scannen).

---

## 📄 Lizenz
MIT License.

## EPLAN-P8-Import mit Projektbibliotheken

„Eplan Haus.zip.001“ und „.002“ werden über einen gemeinsamen, seitenunabhängigen
Import mit den eingebetteten Symbolbibliotheken gelesen. **Einspeisung**
(PDF-Seite 2 / Blatt 1) dient als Referenzseite. Beide Archivteile gemeinsam öffnen.
Befunde, REA-Herkunft, Tests und verbleibende
Abweichungen stehen in [der Reverse-Engineering-Dokumentation](docs/reverse-engineering/einspeisung.md).
Eine Prüf-PDF lässt sich mit `npx tsx scripts/export-einspeisung.ts` erzeugen.
