# Bestätigter Gestaltungsvertrag

## Overview

Bestehende bestätigte Gestaltung erhalten: kühler grauer Grund, weiße Karten, dunkle Hauptaktionen, sparsames Blau. Runde Formen und weiche Tiefe nach E12; keine neue Optik. Autorität: Designcheckout 510be24c plus dateiweise SHA256 in redesign/phase01/DESIGN-PINS.json. Quellwerte mit Zeilen: TOKEN-EVIDENCE.md. Dies ist Quellendokumentation; gerenderter Integrationskandidat steht aus.

## Colors

`praxura-design.css:85–167`: hell --bg-main #F4F6F9, --bg-card-solid #FFFFFF, --text-main/--primary #0B0F17, --text-muted #475467, --accent/--focus-ring #2563EB. Gefahr #B42318, Erfolg #067647, Warnsymbol #CC6B49 mit neutralem Warntext/-grund. Theme-spezifische Originalvariablen verwenden; dunkle Werte separat im Tokenbeleg ab Zeile 170. Status trägt zusätzlich Wortlaut/Symbol. Kalender-Leistungsfarben, Belege, PDF/Druck und Mailvorlagen behalten fachliche Farben.

## Typography

Vorhandene selbst gehostete Schriftkette erhalten; keine neue Schrift laden. Tokenhierarchie `praxura-design.css:54–65`: Titel 28/34, Abschnitt 20/26, Karte 18/24, Text 14/20, Tabelle 13/18, Meta 12/16 px. Gewicht 400 Text, 500 Titel/Zahlen, 600 aktive/sortierte Inhalte. Zahlen tabellarisch. Schriftfamilie vor Transfer an aktueller dashboard.css und Font-Ladekette verifizieren.

## Layout

4-px-Raster, Schritte 4/8/12/16/20/24/32/40/48/64 (`praxura-design.css:76–79`). Shell ab 1025 px Raster mit durchgehender Seitenleiste; bis 1024 Schublade (`design/shell.css:26–72`), eingeklappt 72 px (`:146ff`). Bestehende Gruppen, Suche und Neu-Menü verwenden. Tabellen scrollen lokal; Seite darf nicht überlaufen. Formularabschnitte bekommen vorhandene Abschnittsnavigation, ohne Eingaben umzubinden. Mobile Reihenfolge folgt Arbeitsaufgabe; bestehende Aktionen bleiben erreichbar.

## Elevation & Depth

Vorhandene --shadow-e1 für Karten, e2 für Menüs/Popover, e3 für Dialog/Seitenpanel (`praxura-design.css:156–160`). Ruhige Flächen, keine neue Dekoration. Bewegung 120/180/240 ms mit bestehender Reduced-Motion-Behandlung (`:67–73`).

## Shapes

Karte/Dialog 18, größte Hauptkarte 22, kleine Karte/Banner 14, Button/Feld 12, Status-/Filterpill 999, Checkbox/Zähler 6 px (`praxura-design.css:45–52`). Kein globales Umformen von Druckausgaben.

## Components

| Baustein | Autoritative Quelle | Transfervertrag |
|---|---|---|
| Haupt-/Neben-/Gefahrbutton | praxura-design.css:436–495 | Vorhandene Klassen; Hover/disabled erhalten; keine Handlerkopie |
| Eingaben/Fokus | praxura-design.css:690–699; design/formulare.css:1–75 | Labels, Validierung, Fehlereingabe erhalten; sichtbarer Fokus, relevante Ziele 44 px |
| Tabelle/Leerzustand | praxura-design.css:553–580 | Kopf-/Datenzeilen und lokaler Scrollwrapper; Fehler nicht als leer ausgeben |
| Navigation | design/shell.css:77–155; module/shell-neu.js | Registry und Rechte aus aktueller Basis; keine zweite Navigation |
| Start/Kennzahl | design/startseite.css:238–274; module/neu-start.js | Unknown samt Grund bewahren, heutige start-aufgaben ergänzen; keine zweite Finanzrechnung |
| Kalender | design/kalender.css; aktueller Kalenderrenderer | Tag/Woche/Monat und Kontext unverändert; Räume/Standorte aus aktuellem Stand |
| Formular | design/formulare.css; design/seiten.css | V803 und Wrapper zusammen abgleichen; IDs und Feldbindung erhalten |
| Verwaltung | design/verwaltung.css; redesign/V804-UEBERGABE.md | Spätere V804-Lieferungen berücksichtigen, alte Gesamt-offen-Aussage nicht isoliert übernehmen |

Dialoge behalten Escape, Fokusfalle, Rückkehr und vorhandene Schreibwege. Diagramme verwenden bestehende --chart-* und zugängliche Beschriftung; fehlende Werte nicht zeichnerisch erfinden.

## Do's and Don'ts

- Aktuelle fachliche Implementierungen erhalten; Gestaltung selektiv übertragen.
- Neue CSS nur unter `[data-design="neu"]` und `@media screen`; Druck separat prüfen.
- Altansicht gegen frische Basis prüfen; alte Bilder nicht als neue Regression ausgeben.
- Keine vollständigen alten dashboard-Dateien übernehmen, keine neue Rechtepolitik.
- Originweiter `px-design`-Schalter ist keine Pilotbegrenzung. Aktivierung separat entscheiden.

Offen: gerenderter Vergleich auf neuer Funktionsbasis, Mobil-/Theme-/Fokusprüfung und Melihs Bestätigung repräsentativer Ansichten. Keine neue Designentscheidung daraus ableiten.
