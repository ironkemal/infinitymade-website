# PLAN v2: Praxura-Dashboard modern neu (Stand 25.10.2026)

> **Status: wartet auf Melihs OK.** Erst nach dem OK wird gebaut. Danach läuft die Schleife
> ununterbrochen, bis Phase V9 abgeschlossen ist (V10 Umschalten nur nach erneutem OK).
>
> Dieser Plan **ersetzt** die Phasen 2–8 aus `AUFTRAG.md` Abschnitt 5. Alles andere aus
> `AUFTRAG.md` (Schleife 3.3, Teststufen, Reparatur-Regeln, Stopp-Punkte, Pflichten) gilt weiter,
> mit den Abweichungen in Abschnitt 2 unten. Grundlage: acht Analyseberichte vom 25.10.2026 in
> `.redesign-shots/plan-v2/` (gitignored, lokal): Designsystem, Startseite, Podologie-Fachsicht,
> Architektur, Daten, API, Funktionsinventar, Umsetzung/Tests. Entwürfe: `bausteine.html`,
> `startseite.html` (+ `archetyp-liste-detail.html`).

## 1. Ziel in einem Satz

Ein deutlich modernerer, kantigerer Praxura-Arbeitsplatz im Stil der Quicken-Referenz (angelehnt,
nicht kopiert): ruhige Leiste, klare weiße Karten, **eine Startseite „Heute“**, die einer
Podologin zwischen zwei Patienten in 3 Sekunden sagt, wer kommt, was offen ist und was zu
kassieren ist. Farben (E11, 25.10.): übliche Dashboard-Farben statt Beige/Braun: Schwarz/Weiß für Kontrast, Blau als Akzent, Hellblau für Auswahl.

## 2. Melihs Entscheidungen (25.10.2026, verbindlich)

| # | Entscheidung |
|---|---|
| E1 | v2 nur mit `?design=neu`. Ohne Schalter bleibt alles wie heute (Ausnahmen: E7, E10). **Nach jeder fertigen Phase Merge nach `main`** (F-01 damit beantwortet). |
| E2 | Navigation: Team entscheidet → siehe 3.2. |
| E3 | Backend darf erweitert werden (Express-Router, ggf. RPC/View). **Migration live nur nach Melihs OK** (Stopp-Punkt). |
| E4 | Geld-Kennzahlen nur Inhaber, serverseitig. R-06 wird geschlossen. |
| E5 | Verordnungs-Status ruhiger, Rot/Orange nur für echte Probleme. Kemal wird von Melih informiert (Kemals Regel 05.09.2026 entfällt). |
| E6 | Formsprache kantiger, mehr Kontrast (Karten 12 px, Knöpfe/Felder 8, Tags 6; dunklere Linien und Schrift). |
| E7 | Neue Abläufe **mit rein**: Schnellzugriff oben (Suche + „+ Neu“), Navigation neu gruppieren (gilt auch alt), Fußbefund/Anamnese/Notizen in die Akte, Abschlussdialog nach Behandlung. |
| E8 | Dashboard + Überblick = **eine Startseite „Heute“** (Feed und Geburtstagsliste entfallen). |
| E9 | Angestellte sehen den Zuzahlungs-**Einzelbetrag** ihres Patienten als Aufgabe, keine Summen. |
| E10 | Geld-Zahl Inhaber: „Bereit zur Abrechnung n VO ≈ €“ + „Kassiert diesen Monat“. Das Wort „Umsatz“ wird nicht verwendet. |
| E11 | **Farben neu (25.10., ersetzt die Espresso/Bronze/Creme-Palette):** keine Beige-/Brauntöne mehr, sondern übliche Dashboard-Farben: Schwarz/Weiß-Kontraste (Hauptknopf schwarz, im Dunkelmodus weiß), Blau als Akzent (Links, Fokus, Fortschritt, Diagramm), Hellblau für Auswahl und getönte Köpfe. Nur Farbwerte ändern sich; Struktur, Formsprache und Abläufe bleiben. Vorschau: `.redesign-shots/plan-v2/blau-*.png`, Werte (Rollennamen der Entwürfe, maßgeblich für V1.03): `redesign/palette-v2.css`. Logo-Datei bleibt unverändert. |

## 3. Das neue Design

### 3.1 Designsystem v2 (Designer A, Vorschau `bausteine.html`)
- **Schrift:** Plus Jakarta Sans bleibt (lädt schon lokal). Feste px-Stufen: Display 40/32/24, H1 28, H2 20, Kartentitel 18, Text 14, Tabelle 13, Meta 12. Titel Gewicht 500, nicht fett. `tabular-nums` überall, wo Zahlen untereinander stehen.
- **Abstand:** Basis 4 px; Karten-Innenabstand 24, Kartenlücke 20, Seitenrand 32 (Desktop) / 24 / 16.
- **Raster:** 12 Spalten ≥ 1280 px, 6 Spalten 768–1023, 1 Spalte < 768. Inhalt max. 1480 px.
- **Form:** Radius Karte 12, Knopf/Feld 8, Status-Tag 6, Checkbox 4. Linien statt Schatten; Schatten nur für Schwebendes (Menü, Dialog, Seitenpanel, Toast). Keine runden Pillen mehr.
- **Farben (E11, alle Paare rechnerisch geprüft):** Grund `#F4F6F9`, Karte `#FFFFFF`, Haupttext fast schwarz `#0B0F17` (17,7:1), gedämpft `#475467` (7,7:1), Linie `#DDE2E8`, Feldrand `#8A93A0` (3,1:1). Hauptknopf schwarz `#0B0F17` mit weißer Schrift (19:1). Akzent Blau `#2563EB` (5,2:1 auf Weiß) für Links, Fokus, Fortschritt. Auswahl/aktive Navigation/getönter Kopf Hellblau `#E7F0FE` (Text darauf 16,7:1). Dunkel: Grund `#0B0D12`, Karte `#14171D`, Text `#F1F3F6`, Hauptknopf weiß mit schwarzer Schrift, Akzent `#60A5FA`, Tönung `#16233A`.
- **Akzent sparsam:** Schwarz = Hauptknopf (einer je Ansicht), aktive Filter; Blau = Links, Fokus, Fortschrittsbalken, Hauptreihe im Diagramm; Hellblau = Auswahl, aktive Navigation, getönter Kopf der wichtigsten Karte. Diagramm-Palette: Blau `#2563EB`, Petrol `#0D9488`, Violett `#8B5CF6`, Schiefer `#64748B` (+ Spur `#E2E8F0`), dunkel `#60A5FA`/`#2DD4BF`/`#A78BFA`/`#94A3B8`.
- **Status (6 Töne + Symbol + Text, Farben nach E11):** bad Rot `#B42318` (Absetzung, Frist verpasst) · warn Bernstein `#8A4B08` (Teilabsetzung, Beginn ≤ 7 Tage) · info Violett `#5B21B6` (Bereit zur Abrechnung) · brand Blau `#1D4ED8` (In Behandlung = Normalfall) · ok Grün `#166534` (Abgerechnet) · neutral/ghost Grau (Bestätigt, Entwurf gestrichelt, Storniert, Archiviert, Abgelehnt). `DATEI_STATUS` (§302-Bildschirm) bleibt, bis `gkv-302` zustimmt.
- **Dunkelmodus:** eigene Werte, hellere Fläche + Linie statt Schatten. Jede Farbe hell und dunkel geprüft.

### 3.2 Navigation und App-Shell (Konsens Podologie + Designer A + Architektur)
- **Standard: beschriftete Leiste** 260 px (Kalender-Geometrie bleibt), weiß, 1 px Linie. Aktiv = Hellblau-Fläche + schwarze Schrift, blaues Symbol, kein Seitenstrich. Einträge 40–44 px hoch.
- **Eingeklappt: 64–72 px Icon-Leiste** mit Gruppen-Symbol + Kurzlabel, Klick öffnet **Gruppen-Flyout** (Tastatur, Escape, Touch ohne Hover). Zustand pro Nutzer (`sidebar_collapsed`). Statt heute „Breite 0“.
- **Neue Gruppen (E7, Podologie):** HEUTE (Start, Behandlungen) · TERMINE (Kalender, Anfragen, Warteliste) · PATIENTEN (Patienten, Verordnungen) · ABRECHNUNG (§302, Rechnungen, Zahlungsjournal, Mahnwesen, Auswertungen) · PRAXIS (Team, Verfügbarkeit, Fahrtenbuch, Zuweiser/Ärzte, Leistungen, Patientenpost) · EINSTELLUNGEN (Einstellungen, Vorlagen, Demo, Hilfe). Tägliche Gruppen immer offen. Anamnese, Notizen, Fußbefund, Überblick: Menüzeile ausgeblendet (Registry-Zeile bleibt, `nav-registry.js:7-11`), Zugang über Akte/Behandlung.
- **Topbar 60 px:** Praxisname · **Suche** (Patient, Verordnung, Rechnung; Taste „/“) · **„+ Neu“** (Termin, Patient, Verordnung erfassen/scannen; „Rezept scannen“ wandert hier hinein) · „Einrichtung 31 %“ beschriftet (bei 100 % weg) · Uhr · Thema · Profil.
- **Mobil < 1025 px:** Schublade (R-01 im Neu-Modus mit `translate` gelöst, `inert` auf Inhalt). Telefon optional später: Unterleiste mit 4 Einträgen.

### 3.3 Startseite „Heute“ (Podologie-Rangfolge, Entwurf `startseite.html`)
| Rang | Karte | Inhaber | Angestellte |
|---|---|---|---|
| 1 | **Als Nächstes** (Hellblau-Kopf): Zeit, Name, Leistung, Diagnose, Risiko-Abzeichen, VO „noch 2 von 6“ mit Balken, Zuzahlung; Knopf [Termin starten] bzw. [Fahrt starten]; „danach …“ | ✓ | ✓ (eigene) |
| 2 | **Zu erledigen**: Doku offen · Zuzahlung offen · Online-Anfragen · Abgesetzt (nur > 0) | ✓ mit Summen | Doku + Zuzahlung je Patient (Einzelbetrag, E9) |
| 3 | **Termine heute** (hohe linke Karte): Liste je Behandlerin, Zustand rechts (fertig · Doku offen · jetzt · € offen · letzte Einheit · Erstbefund · Hausbesuch), Filter-Chips, Umschalter Liste/Raster | ✓ | ✓ (eigene) |
| 4 | **Verordnungen – Handlungsbedarf** (2×2): Beginn verpasst · Beginn ≤ 7 Tage ohne Termin · 12-Wochen-Pause droht · ohne Folgetermin; „Alle anzeigen“ → gefilterte Verordnungsliste | ✓ | nur eigene Patienten im Text der Zeile |
| 5 | **Freie Zeit heute**: nur Lücken ≥ kürzeste aktive Leistung (35 Min), Abwesenheit/Pause beachtet, [+ Termin] vorbelegt, Warteliste-Zahl | ✓ | wenn Praxis-Einstellung erlaubt |
| 6 | **Abrechnung** (E10): „Bereit zur Abrechnung n VO ≈ €“, „Kassiert diesen Monat“, Zuzahlungen offen, Privatrechnungen offen, Link §302 | ✓ | – |
| 7 | **Diese Woche**: „41 von 65 Std gebucht“ (Balken, kein Ring) | ✓ | – |
| – | Banner (Zertifikat, IK fehlt …) oben, nur bei Bedarf | ✓ | ✓ |

- **Neue Praxis ohne Daten:** drei Einrichtungsschritte statt Nullen.
- **Jede Karte vier Zustände:** laden (Skeleton) · leer (Satz + nächster Schritt) · Fehler („Erneut versuchen“, nur diese Karte) · Daten. `Promise.allSettled`, eine Karte blockiert nie die anderen.
- **Fachlich korrigiert** (Podologie Befund 1–3): kein „überfällig“ mehr ohne Beginnprüfung, kein „in Therapie“ (in Podologie immer 0), neu „Doku offen“. Eine Rechenstelle für Startseite und Verordnungsliste. Bestehende Regelmodule wiederverwenden (`heilmittel-fristen.js`, `podo-behandlungstag-regel.js`, `zuzahlung-rechnen.js`, `terminHinweise`).
- Bestehende Funktionen bleiben bedienbar: Tagesraster mit Mitarbeiterspalten (als „Raster“-Ansicht der Terminkarte), freie Zeiten, Rezept-Kacheln-Filter (wandern in Karte 4).

### 3.4 Seiten-Archetypen für die übrigen Bereiche (Architektur 2.2)
| Archetyp | Bereiche |
|---|---|
| Dashboard | overview (DOM-Umbau per Modul), ueberblick (geht in Startseite auf), statistik |
| Liste (+ Detail-Seitenpanel) | kunden, verordnungen, rechnungen, belegliste, mahnwesen, warteliste, b2b, b2c, doctors, fahrtenbuch, anfragen, feedback, notizen, vorlagen, team |
| Formular (+ Abschnittsnavigation) | settings (erzeugte Abschnittsnavigation), anamnese, services, hours |
| Kalender | calendar (Kemals Aufbau, nur Optik, Geometrie bleibt) |
| Modul-Gehäuse | podologie-billing, fussstatus |
| Sonder | abrechnung (Assistent), beispielmodus |

Zuordnung als Map `PANEL_ARCHETYP` in einem Modul mit Vollständigkeitstest gegen die 27 Panel-IDs. Rechnungs-Dokumentansicht, Druck, PDF, Belege, E-Mail-Vorlagen, Leistungsfarben der Terminblöcke werden **nicht** umgefärbt.

## 4. Technik (Architektur + Backend)

- **Overlay statt Umbau:** Alt-Code bleibt. Ein Boot-Modul `module/neu-start.js` kehrt im Alt-Modus sofort zurück und lädt Neu-Teile per `import()` nur bei `data-design="neu"`.
- **`dashboard.js`:** höchstens 6 Ein-Zeilen-Eingriffe ohne Zeilenzuwachs (Import; `emit('nav:gerendert')`; `emit('panel:changed')`; `emit('ov:termine')`; `emit('ov:fristen')`; `emit('app:bereit', ctx)`). Größen-Wache bleibt grün. Ausnahme E7 (Navigation, Abschlussdialog): Änderung in `nav-registry.js` bzw. Modul, `dashboard.js` nur zeilenneutral.
- **CSS:** `praxura-design.css` bleibt Token-/Bausteinschicht. Neue Schichten im Ordner `design/` (`shell.css`, `seiten.css`, `startseite.css`, `bereiche.css`), je eigene `<link>` + `?v=`. **Je eine Zeile** in `onprem/frontend.Dockerfile` (`COPY design ./design`) und `.github/workflows/publish-frontend.yml` (`design/**`). Neuer Test `tools/redesign-auslieferung.test.js`: jede lokale Datei aus `<link>/<script>` in `dashboard.html` steht in Dockerfile und Workflow (O-219 darf nicht wiederkommen).
- **Module (Frontend):** `module/startseite-rechnen.js` (reine Funktionen + Tests), `startseite-daten.js` (Hooks + Backend, `allSettled`), `startseite-karten.js` (HTML-Strings je Zustand + Tests), `startseite-neu.js` (Boot), `shell-neu.js` (Leiste, Flyout, Suche, „+ Neu“), `seiten-neu.js` (Archetypen-Map). Vorher jeweils `fonksiyon-ustasi`; danach „niye + nerede“ melden, `node tools/funktionskarte.mjs`.
- **Backend (Hybrid):** Client mit RLS für Termine, Verordnungen, Anfragen, Warteliste. Neuer Router `api-backend/routes/startseite.js`: `GET /api/startseite/zusammenfassung` mit Blöcken `geld`, `mahnungen`, `abrechnung` (nur Inhaber; für Mitarbeiter **nicht berechnet, nicht serialisiert**; explizit angefordert → 403 `NUR_INHABER`), Zeitgrenzen Europe/Berlin (`lib/berlin-tag.js` + `berlinMonatsgrenzen`). Regel „offene Forderungen“ aus `statistik.routes.js` in ein geteiltes Modul ziehen (keine dritte Kopie). **R-06:** Owner-Gate an `GET /api/billing/statistik`. Freie Zeit/Auslastung serverseitig aus derselben Arbeitsfenster-Logik wie `getAvailableSlots`, damit „frei“ = online buchbar. **Keine Migration für v1.**
- **Tests Backend:** Muster `routes/status.test.js`, `billing-auth-contract.test.js`: 401 ohne Token, Mitarbeiter ohne Geld-Feld, fremder Mandant, DB-Fehler 503, Zeitzone/Monatsende/Sommerzeit (25.10.).

## 5. Phasen und Pakete

Jedes Paket = ein Durchlauf der Schleife (`AUFTRAG.md` 3.3) = ein Produkt-Commit, 30–90 Min, Wirkbereich vorher festgelegt. CSS, Backend und Werkzeug nie im selben Paket. **Nach jeder Phase:** `main` einmergen (Kemal), T1–T5 auf dem Merge-Ergebnis, Push `main` im Vordergrund, T6 `canli-test` mit `?design=neu`.

| Phase | Inhalt | Pakete (ca.) | Fertig, wenn … |
|---|---|---|---|
| **V0 Werkzeuge** | Shots: stabile Bildnamen, kein stilles Überschreiben, „neu in B“ melden · Referenz aus `origin/main` · Text-Hash + API-Log je Panel · Smoke mit Rolle, Theme, Klick-Navigation, numerischem Überlauf · Zustände-Werkzeug (laden/leer/fehler, Flyout, Drawer, 1024 px) · Fixture: Startseiten-Tabellen + API + Szenarien `fehler/langsam/gross` · Geometrie-Probe mit Neu-CSS · statische Wachen (Scope, `!important`-Kommentar, Cache-Nummer, Auslieferung, Datei-Schrumpf) · Flake-Register (`tools/redesign-flakes.json`) · neue `STATUS.md`-Struktur + `tools/redesign-status-check.mjs` | 10 | alle Werkzeuge laufen auf `0a63ce0f`, Alt-Referenz aus `main` 0 ✗ |
| **V1 Grundlagen** | Tokens v2 (Abstand, Radius, Schrift, Linien, Schatten, Bewegung + `prefers-reduced-motion`), Kontrast-Test erweitert (Diagrammpalette ≥ 3:1) | 4 | Kontrast grün hell/dunkel, Alt 0 ✗ |
| **V2 App-Shell** | Grid-Hülle · Leiste v2 · Icon-Leiste + Flyout · Navigation neu gruppiert (`nav-registry.js`, **wirkt auch alt**, Alt-Referenz danach bewusst neu aufnehmen und dokumentieren) · Topbar v2 · Suche (`module/gehe-zu.js`) · „+ Neu“ · Schublade mobil + R-01 (nur neu) · Tablet 1024/1025 · Tastaturlauf | 12 | alle Bereiche per Klick erreichbar (Inhaber + Angestellte), Tastatur-Smoke grün, Kalender-Geometrie geprüft |
| **V3 Bausteine** | Karten, Knöpfe, Felder, Tabelle/Liste, Status-Tag (6 Töne), Modal, Seitenpanel, Tabs/Segment, Banner, Leer, Toast, Fokus auf v2-Werte; neu: Skeleton, Fehlerkarte, Kennzahl-Kachel, Listenzeile, Mini-Karte 2×2, „Alle anzeigen“-Leiste, SVG-Balken/-Ring. Katalogseite (dev, nicht ausgeliefert) | 12 | Katalog hell/dunkel abgenommen, Bausteine-Probe bestätigt berechnete Stile, Alt 0 ✗ · danach **Neu-Referenz einfrieren** |
| **V4 Archetypen** | Map + Test, je Archetyp ein Pilot (kunden, settings mit Abschnittsnavigation, statistik, verordnungen mit Seitenpanel, warteliste) | 7 | Pilot-Bereiche abgenommen (Bild, Smoke, 390 px, `mobil-ui`) |
| **V5 Kalender** | Toolbar, Raster, Blöcke (Leistungsfarben unangetastet), Kontextmenü, Heute-Linie, Mitarbeiterspalten, Monat; Probes in Neu-Fassung, Drag & Drop im Harness | 6 | Prüfliste `AUFTRAG.md` §5 Phase 5 komplett, Geometrie unverändert |
| **V6 Startseite „Heute“** | **Spur B** (ab V1 parallel): R-06 · Forderungs-Modul · Monatsgrenzen · Router + Tests · Freie-Zeit-Server · `guvenlik` + `onprem` vor Merge. **Spur F:** Rechenfunktionen + Tests → Daten → Karten (7) → Raster → Rollen → Zustände → Überblick in Startseite aufgehen lassen (nur neu) | 18 | jede Karte in 4 Zuständen im Bild, Angestellte ohne Geld (auch in Netzwerkantwort), alte Funktionen gleich bedienbar, `podoloji` abgenommen |
| **V7 Arbeitsabläufe (E7)** | Akte: Anamnese/Notizen/Fußbefund-Reiter vollständig bedienbar, Menüzeilen ausblenden, Einstiege aus Termin/Behandlung · Prüfung „Doku hängt am Abrechnungsrecht“ (Podologie Befund 4) mit `guvenlik` · **Abschlussdialog** nach Behandlung (Zuzahlung kassiert + Folgetermin, erweitert den bestehenden „Folgetermin?“-Dialog) | 6 | Abläufe im Harness durchgespielt, Klickzahlen gezählt, `podoloji` abgenommen |
| **V8 Bereiche** | übrige ~20 Bereiche: Archetyp anwenden, feste Farben dieses Bereichs (`var(--…, alt)`), Status-Pillen Verordnungen/Abrechnung (mit `gkv-302`), 390 px, Rollen. Große Bereiche in 2–3 Pakete | 40 | jede Bereichszeile in STATUS ✓ |
| **V9 Abnahme** | kompletter Durchlauf T1–T6 über alle Bereiche, Funde → Pakete, wiederholen bis 0 Funde; Abschlussbericht | 6–10 | ein Durchlauf ohne Funde |
| **V10 Umschalten** | Standard = neu, `?design=alt` eine Woche als Notausgang, danach aufräumen | 3 | **nur nach Melihs OK** |

**Summe ≈ 125–135 Pakete**, etwa 10 Merges nach `main`. Reihenfolge-Option: Wenn Melih die Startseite früher sehen will, kann V6-F vor V5 laufen.

## 6. Wer wann hilft (Pflicht)

| Wann | Agent / Skill |
|---|---|
| vor jeder neuen Funktion/Datei, danach melden | `fonksiyon-ustasi` |
| vor Abfrage, Router, RPC; Kutu-Auslieferung | `db-ustasi`, `onprem` |
| Geld, Rollen, Rechte, Patientendaten auf neuen Flächen | `guvenlik` (Veto in 4 Themen), bei Bedarf `legal-de` (Diskretmodus Tablet) |
| Startseite, Abläufe, Podologie-Bereiche, Wortlaut der Kennzahlen | `podoloji` |
| Fristenregel, „≈ €“ Kassenanteil, Status in Abrechnung/Verordnungen, `DATEI_STATUS` | `gkv-302` |
| jeder fertige Bereich (390 px) | `mobil-ui` |
| nach jedem Merge | `canli-test` |
| echte A-oder-B-Frage | `/konsey` |
| Gestaltung/Kritik/Polish | Skills `impeccable`, `design:design-critique`, `design:accessibility-review`, `design:ux-copy` |
| eigener Diff vor Merge, Fehlersuche | `engineering:code-review`, `engineering:debug` |

## 7. Stopp-Punkte (nur hier anhalten, sonst weiter)

1. Migration auf die Live-Datenbank (auch: Migrationsdatei nicht vor dem OK nach `main`).
2. Löschen (Datei, ID, Funktion, Tabelle, Daten außerhalb QA).
3. Verhaltensänderung **außerhalb** von E7/E8/E9/R-06.
4. Konflikt mit Kemal, der nicht eindeutig lösbar ist (v. a. Kalender, Status-Farben).
5. Veto von `guvenlik`, `legal-de`, `gkv-302`, `onprem`.
6. Mehr als 2 Pakete einer Phase oder ein globales Paket (V1–V3) blockiert.
7. V10 Umschalten.

Bei einem Stopp: Frage in `STATUS.md` („wartet auf Melih“), betroffene Pakete parken, **unabhängige Pakete weiterbauen**.

## 8. Nicht Teil dieses Umbaus (als Ops-Karte melden)

- Sicherheits-Beifunde aus der Analyse (Rollen- und Zugriffsgrenzen außerhalb der Startseite): gehen über `guvenlik` in dessen Register (gitignored), nicht in dieses öffentliche Repo. Eigene Entscheidung, ggf. Migration.
- Vorbestehende Fehler: Rohstatus `in_behandlung` in der Verordnungsliste, R-01 im Alt-Design, R-07 (doppelte freie Zeiten), Statistik-Monatsgrenzen UTC und fehlende Podologie bei No-Shows/Leistungen, QA-Seed inkonsistent, Anfragen-Badge verschwindet, Überblick-Knopf sammelt Listener.

## 9. Dauerlauf-Regeln (Kurzfassung, Details Entwickler-B-Bericht §4)

- `STATUS.md` bekommt oben einen **Kurzzustand** (≤ 12 Zeilen: HEAD, aktuelles Paket + Schritt, Cache-Nummern, gültige Referenzen, wartet auf …, nächstes Paket) und eine **Paketliste** als einzige Fortschrittsquelle. `tools/redesign-status-check.mjs` prüft sie in T1.
- Neustart nach Kompaktierung/Limit: `git status`, Kurzzustand lesen, eigene halbe Arbeit testen oder verwerfen, Referenzen prüfen, dann nächstes Paket. Der T3-Auftrag „Automatische Fortsetzung“ (alle 2 h) bleibt.
- Gemeinsame Dateien nur mit Edit ändern, nie per `sed -i`/Skript-Überschreiben (Vorfall 24.10.: `dashboard.html` kurz geleert). Nach jeder Änderung `git diff --numstat`.
- T1 erst nach `git add` (Kapılar lesen den Index).
- Jedes ✗ mit ganzer Kombination wiederholen; Flake nur, wenn es verschwindet; bekannte Flakes im Register mit Ort und Obergrenze. Nie Referenz anpassen, nie Schwelle erhöhen.
- Pro Fehler höchstens 3 Versuche, dann zurücknehmen, Fehlerbuch, nächstes Paket.
- Subagenten pushen nie. Push nur Hauptkontext, Vordergrund.
