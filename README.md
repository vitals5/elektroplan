# ⚡ Elektroplan CAE Suite (EPLAN Electric P8 Edition)

Eine moderne, professionelle **Elektroplan- & Stromlaufplan-Software für Windows** mit voller nativer Kompatibilität für **EPLAN Electric P8**-Dateien (`.zw1`, `.edz`, `.xml`) und normgerechter Schaltungsplanung nach **DIN EN 81346-2** und **IEC 60617**.

---

## 🚀 Highlights & Features

### 📦 EPLAN Electric P8 Kompatibilität
* **Projekt-Backups (`.zw1`)**: Öffnen, Entpacken, Bearbeiten und erneuter Export von kompletten EPLAN `.zw1` Projektarchiven inklusive `.elk` Steuerdatei und `*.edb` Projektdatenbank-Verzeichnis.
* **EPLAN Data Portal Makros (`.edz`)**: Import und Inspektion von Artikel- und Makropaketen mit 2D/3D-Stammdaten (`.ema`/`.ems`) und XML-Artikelspezifikationen.
* **EPLAN-XML**: Standardisiertes XML-Austauschformat für Schaltpläne, Symbole und Verbindungen.
* **Reverse-Engineering via REA**: Integrierte Container- und Artefakt-Analyse für Binärarchive und Datenstrukturen.

### 📐 Normgerechte Schaltungsplanung (DIN EN 81346 / IEC 60617)
* **Kennzeichnungsstruktur**: Vollständige Unterstützung von `=Anlage` (z.B. `=A1`), `+Ort` (z.B. `+S1`) und `-BMK` (Betriebsmittelkennzeichen wie `-K1`, `-Q1`, `-M1`).
* **EPLAN Normblatt (DIN A3 Landscape)**:
  * Pfad-Spalten `0` bis `9` für präzise Querverweise.
  * Zeilenraster `A` bis `F`.
  * Genormtes Schriftfeld nach **DIN EN ISO 7200** (Projektname, Zeichnungsnummer, Datum, Ersteller, Blattnummer).
* **Automatischer Querverweis- & Kontaktspiegel-Engine**:
  * Schützspulen berechnen und zeichnen automatisch den **Kontaktspiegel** aller zugehörigen Kontakte mit Blatt- und Pfadangabe (`/1.2`, `/2.1`).
  * Hilfskontakte zeigen automatisch die Blatt- und Pfadreferenz ihrer übergeordneten Spule an.
* **DIN EN 60617 Symbolbibliothek**:
  * **Schütze & Relais**: Schützspulen (A1-A2), 3-polige Hauptschaltglieder, Hilfsschließer (13-14), Hilfsöffner (21-22).
  * **Schutzeinrichtungen**: 3-polige Motorschutzschalter (thermisch & magnetisch), Schmelzsicherungen.
  * **Befehls- & Meldegeräte**: Drucktaster EIN, Taster AUS, NOT-HALT Pilztaster mit Rastung, Meldeleuchten.
  * **Antriebe**: Drehstrom-Asynchronmotoren (M 3~ mit U1, V1, W1, PE).
  * **Klemmen & Versorgung**: Reihenklemmen `-X1`, PE-Schutzklemmen, 24V DC Schaltnetzteile, Potenzial-Abbruchstellen.

### 📊 Automatische Auswertungen & Reports
* **Klemmenplan (Terminal Diagram)**: Vollständige Klemmenleisten-Matrix (`-X1`) mit automatischer Zuordnung interner Schaltschrankziele und externer Feldkomponenten.
* **Stückliste (Bill of Materials / BOM)**: Aggregierte Artikelliste mit Hersteller, Bestellnummer, technischer Beschreibung, Mengenzählung und BMK-Referenzliste.

### 📑 EPLAN Smart PDF-Export (Interaktive Vektor-PDFs)
* **Klickbare Querverweis-Hyperlinks**: Beim Anklicken eines Querverweises im PDF (z.B. `/1.4` an einem Hilfskontakt oder `/2.1` im Kontaktspiegel einer Schützspule) springt der PDF-Reader direkt auf das Zielblatt zum Gegenstück!
* **Strukturierter Lesezeichenbaum (Bookmarks)**: Dokumentengliederung nach DIN EN 81346 (`=Anlage` ➔ `+Ort` ➔ `Blatt-Nr: Titel`).
* **Vektor-Normblatt**: Druck des EPLAN DIN A3 / DIN A4 Normblatts mit Spalten `0..9`, Zeilen `A..F` und Schriftfeld nach DIN EN ISO 7200.
* **Integrierte Auswertungsseiten**: Optionales automatisches Anhängen des Klemmenplans und der Stückliste als vollformatierte PDF-Seiten.
* **Farb- & Monochrom-Modus**: Ausgabe in EPLAN-Farbgebung oder optimiert für Schwarz/Weiß-Großformatplotter.

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

---

## 📄 Lizenz
MIT License.
