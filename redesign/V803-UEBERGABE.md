# V8.03 / R-23 — Reparaturvorlage unter Baustopp

Stand: 28.10.2026. **Nur Untersuchung und Dokumentation. Keine CSS-Lieferung oder Integrationsfreigabe.**

## Auftrag und Besitz

- Problem: abgeschnittene Anamneseoptionen und Leistungsüberlauf bei 390px; Formularbreiten, Abschnittsnavigation, Fokus und Touchziele der fünf reservierten Bereiche einordnen.
- Einzige Schreibdatei dieses Pakets: `redesign/V803-UEBERGABE.md`.
- Wiederverwendung: V704c-Smoke, vorhandene Formular-Vorher-/Nachher-Probe und abgeschlossene Podologie-Beratung; keine erneute Fullsuite/Bildmatrix.
- Voraussetzung für Bau: ausdrückliche Wiederaufnahme durch Melih. Baustopp bleibt bestehen; dieser Bericht ist keine Reparaturfreigabe.
- Gemeinsame Dateien, Link-/Cache-Kette, STATUS, PLAN, INDEX und Referenzbilder bleiben beim Integrator.
- Nachweis: vorhandene R23-Evidenz wiederverwendet, anschließend begrenzte synthetische Geometrie-/Fokusprobe; keine vollständige Interaktions-/Rollenabnahme.

## Basis und unveränderte Fremdarbeit

| Gegenstand | Festgestellt |
|---|---|
| Hauptcheckout | `/Users/melihdonmez/infinitymade-website`, `main`, `9b1737729631b1ec37a235087238d81f50c1b9c8`; fremde Dirty-Dateien vorhanden, nicht verändert |
| Bestehender Formular-Worktree, ausschließlich gelesen | `/private/tmp/praxura-v803-formulare`, Branch `redesign/praxura-formulare`; Produktbasis `c7fcf75ef56a72712f762e23c60ca08b15439975`, aktueller HEAD `ede70f5a506fcb6e77e4e2b4b77c3d5a8bffd413` (vorheriger Berichtcommit) |
| Eigener Diagnose-Worktree | `/private/tmp/praxura-v803-diagnose`, Branch `redesign/praxura-v803-diagnose`, Dokumentbasis `ede70f5a506fcb6e77e4e2b4b77c3d5a8bffd413`; ausschließlich diese Datei zugeteilt |
| Integration bei Einstieg | `/Users/melihdonmez/.t3/worktrees/infinitymade-website/redesign-praxura-design`, `redesign/praxura-design`, `3c010868075ad9144f3835eacc0a4966dc69f07b`; V2.09b aktiv, keine zweite Implementierung |
| Aktuelle Reservierung | Schriftliche Koordination: ausschließlich `redesign/V803-UEBERGABE.md`; CSS-Bau gestoppt, alter CSS-Entwurf nur lesen |
| Bestehendes CSS | untracked `design/formulare.css`, SHA-256 `b937896777e684bee3647b8eadc3516a8a788422a63c50a5951045f8cd069fa4`; weder editiert, übernommen, gestaged noch verworfen |
| Vorherige Übergabe | Historisch vor `ede70f5a` existierte diese Datei nicht; Vorarbeit aus Thread `08572257-cf76-4f8a-bd43-6c5abb541ebb`, Positionen419–533 und lokalen Artefakten rekonstruiert. Berichtcommit `ede70f5a` ist Ausgangspunkt dieses Nachtrags. |

Quellzeilen unten beziehen sich auf Formular-Basis `c7fcf75e`, sofern nicht anders bezeichnet. `dashboard.css`, `module/leistungen-liste.js` und `module/einstellungen-nav.js` haben gegenüber gelesenem Integrationsstand keinen Diff. `module/anamnese.js` und `module/fussbefund.js` erhielten danach Rollen-/Scopeänderungen; alte Owner-/Employee-Erreichbarkeit deshalb nicht auf neue Pfade übertragen.

## Frische synthetische Probe — maßgeblicher Befundstand

Die folgenden Messungen ersetzen die zuvor offenen Ursachen-/Rect-/Fokusangaben. Alte R23-Werte bleiben Vergleichsevidenz; keine neuen separaten R23-Tickets aus denselben Symptomen.

### Umfang, Sicherheit und Grenzen

- Server bediente ausschließlich den bestehenden Formular-Worktree, Produktbasis `c7fcf75e`; untracked CSS wurde weder eingebunden noch injiziert. Eigene Server jeweils beendet, Port18485 anschließend ohne TCP-LISTEN-Listener. Port18081 unangetastet.
- Bestehendes `tools/redesign-harness.mjs` verwendet. HTTP-Fence und `routeWebSocket('**/*', …close())` jeweils auf Context **vor Page-Erstellung** installiert. Fremde HTTP-Ziele und echte Nicht-GET-Requests gesperrt; Harness liefert synthetisches Supabase/config/API-Verhalten. Kein Live-Connector.
- Hauptprobe: sieben Contexts,31 Panelversuche,29 aktive Panels. Neu Owner/Employee × hell/dunkel bei390px jeweils alle fünf Bereiche; Employee-Fußstatus zweimal verweigert. Alt Owner/hell und Employee/dunkel bei390px jeweils Anamnese/Leistungen/Arbeitszeiten; Neu Owner/hell bei1440px alle fünf. Keine vollständige Altmatrix wiederholt: übrige Alt-Rollen/Themes aus V704c wiederverwendet.
- Hauptprobe:0 Page-Errors,0 fremde HTTP-Hosts,0 API-Writes. **57 synthetische Fixture-Writeversuche abgefangen**: fünf Neu-Contexts mit je einem Services- und zehn Vorlagen-Seedversuchen, zwei Alt-Contexts mit je einem Services-Versuch. `RS_READONLY` bedeutet verweigert, keine erfolgreiche Speicherung und keine Null-Write-Attempt-Behauptung.
- Ein zusätzlicher Context, Neu Owner/hell390 ausschließlich Leistungen, isolierte absolute Nachfahren. Gleiche Fences vor Page; Server danach beendet. Acht Contexts insgesamt. Fehler-/Write-Zählung oben gilt ausdrücklich für Hauptprobe.
- Nachweisablage: frische Inline-Node-Probe lieferte JSON über Tool-stdout, ohne zusätzliche Artefaktdatei; die relevanten Rect-/Scroll-/Fokuswerte sind unten dauerhaft in dieser einzigen autorisierten Datei transkribiert. Kein existierender JSON-Pfad für die frische Probe behauptet. Harness: `/private/tmp/praxura-v803-formulare/tools/redesign-harness.mjs` (`starteServer`, `starteBrowser`, `oeffneDashboard`, `wechsle`, `fixtureLog`); Geometrie aus `getBoundingClientRect`, `clientWidth/scrollWidth`, Text-Range, Fokus aus `activeElement`/`:focus-visible` und verstecktem Vorfahren. Alte Vergleichsartefakte: zentrale `.redesign-shots/smoke-v704c-{alt,neu}-{owner,employee}.json`, `/tmp/praxura-v704c-anamnese.log`.
- Keine CSS-Reparatur oder Laufzeit-CSS-Mutation getestet, kein echter Save, keine Fullsuite/Bildmatrix, keine vollständige Tastatur-/Screenreader-/Druckabnahme. Gemessener Fokus per programmatischem `focus()` bzw. tatsächlichem Editor-Öffnen/Schließen; keine vollständige Tabstrecke behauptet.

### R-23a — Anamneseoptionen abgeschnitten, bestehender Befund präzisiert

**Auslöser/Ort:** Anamnese390px; `#panel-anamnese .anam-grid.anf-optionen`, `#anf_weitere_medikamente`, `#anf_allergien`. `dashboard.css:5758` drei `1fr`-Spalten, `:5764` Flexlabels, `:8217` Mindesthöhe36px; Markup `module/anamnese.js:76–80`, Felddefinitionen `module/anamnese-formulare.js:122–131`.

| Neu390, alle vier Rollen-/Themefälle | Labelbreite × Höhe | Linke/rechte Kante | Text-Range rechts |
|---|---:|---:|---:|
| Chemotherapie |130,75×36px|290,52 /421,27px|415,27px|
| Desinfektionsmittel |153,72×36px|301,14 /454,86px|448,86px|
| Metall/Nickel |153,72×48,28px|301,14 /454,86px|413,63px|

mainArea Neu `clientWidth390 / scrollWidth455` (65px); Alt in beiden neu gemessenen Fällen390/459 (69px), Labels gleiche Breiten, rechte Kanten jeweils4px weiter rechts. Neu Desktop1440: mainArea1180/1180. Dokumentüberbreite0 ist kein Entlastungsnachweis: `dashboard.css:925–928` versteckt horizontalen Überstand. Optionen und Text rechts gekappt.

**Kleinste ungetestete CSS-Vorlage:** nur Neu/Screen mobil Optionsgrid `grid-template-columns:minmax(0,1fr)`; Labels `min-width:0;max-width:100%;white-space:normal;overflow-wrap:anywhere`, klickbares Label44px und sichtbares `:focus-within`. Keine globale Formregel. Inline-Arztgrid `module/anamnese.js:92` separat behandeln, normale Regel überschreibt Inline-Spalten nicht.

**Regression:**390px beide Rollen/Themes, Label- und Text-Rects vollständig innerhalb Karte/mainArea, Überbreite≤1px; Tab/Space und Labelklick ändern zugehörigen Wert, Fokus sichtbar. Gezielte360/414px und Desktopprobe, lange/bedingte Felder; Akte/Kiosk vorhandene Pfade mitprüfen. Alt69px separat, kein Alt-Fix behauptet.

### R-23b — Leistungen: lokale Tabellen passen, absoluter SR-Text ragt in mainArea

**Auslöser/Ort:** Leistungen390px. Hosts `#gkvCatalogSection` (`dashboard.html:432`), `#servicesGrid` (`:478`); `.srv-gruppe > .srv-tabelle` aus `module/leistungen-liste.js:148–154`, `:287–288`. Lokales `overflow-x:auto` bereits `dashboard.css:7978`, Tabellenminimum640px `:7982–7985`.

**Gemessen Neu390, alle vier Rollen-/Themefälle:** mainArea390/690 (300px Überbreite). Beide Hosts und Gruppen **358px breit**, links16/rechts374; Gruppen scrollen bereits lokal. GKV-Tabelle772,97px, private Tabelle682,08px. Nach lokalem Endscroll GKV `scrollLeft415`, erster Aktionsbutton rechts363,97px,89,81×27px; privat `scrollLeft324`, erster Button rechts364,08px,32×32px. Letzte dargestellte Spalten damit geometrisch im lokalen Ausschnitt; vollständige Tastaturbedienbarkeit nicht bewiesen. Alt in beiden Stichproben gleiche GKV-Geometrie, private Tabelle684,06px/Scroll326. Desktop Neu Container/Tabelle1132px, mainArea1180/1180.

**Ursache eingegrenzt, Fix nicht erprobt:** `.srv-sr` (`dashboard.css:8040–8046`) ist absolut,1×1px, `clip:rect(0,0,0,0)`. GKV-Header-Span links689,16/rechts690,16px; `offsetParent=mainArea`. TH und `.srv-gruppe` sind statisch. Private SR-Spanne rechts657,08px, ebenfalls mainArea als Offsetparent. Die außerhalb liegende GKV-Spanne erklärt den690px-Scrollumfang; visuelles Clipping entfernt ihren Beitrag zur Scrollgeometrie nicht. Wrapperbreite ist **nicht** die belegte Ursache. Sichtbare Tabelle selbst darf intern scrollen; rechts außerhalb des Ausschnitts liegende Spalten allein sind kein Fehler.

**Kleinster ungetesteter CSS-Kandidat:** Neu/Screen `#panel-services .srv-gruppe {position:relative}` als lokaler Containing Block für SR-Span. Nach Bau zuerst Messung bestätigen. Kein blindes `min-width:0/max-width:100%` an bereits passenden Hosts, kein globales Overflow-Verstecken, keine Spalten oder SR-Texte entfernen. Aktionsbuttons gezielt44px effektive Trefferfläche geben, anschließend lokale Scrollbarkeit prüfen.

**Regression:** mainArea-Überbreite≤1px, Gruppen weiter358px innerhalb Panel, Tabellen lokal bis letzte Aktion scrollbar; SR-Header weiter zugänglich. Aktionsbuttons per echter Tabstrecke sichtbar erreichbar, mindestens44px Projektziel; keine echte Lösch-/Saveaktion. GKV/privat, lange Namen und offene Formulare,390px beide Rollen/Themes plus gezielte360/414px-/Desktopprobe. Alt300px separat dokumentieren.

### V8.03-H — Arbeitszeiten: Endfeld gekappt, Schalterfokus unsichtbar

**Auslöser/Ort:** Arbeitszeiten390px. `dashboard.css:5010–5013` mobile Spalten100px44px1fr; `.hours-times` zwei110px-Spalten plus12px Gap (`:3387–3409`). Owner-Markup `dashboard.js:9054–9066`, Employee `:10298–10310`: Schalter im ersten Kind, zweites Kind leer. `.toggle-switch` `dashboard.css:3123`; unsichtbarer0×0-Input `:3132–3136`.

**Gemessen Neu390, alle vier Fälle:** mainArea390/390 trotz Clipping. `.hours-row`436px breit, links17/rechts453; `.hours-times`232px, links201/rechts433. `#wh-start-0/1`110×40px, rechts311; `#wh-end-0/1`110×40px, rechts433. Schalter38×22px, Pausenbutton66,19×36px. Fokussierter Schalterinput: `:focus-visible=true`,0×0px; Slider `outline-style:none`, kein Boxshadow. Kein sichtbarer Slider-Fokus belegt. Alt Stichproben gleiche horizontalen Maße, Zeitfelder36px hoch, Pausenbutton66,61×25px, Zeile61px statt Neu65px. Desktop Zeile1130px passt; Schalter bleibt38×22px.

**Wirkung:** Endzeit rechts außerhalb Karte und abgeschnitten; Dokument/mainArea-Overflow allein übersieht Fehler. Schalter klein, Fokus auf verborgenem Input.

**Kleinste ungetestete CSS-Vorlage:** nur Neu mobil Tageszeile einspaltig, leeres zweites Kind gezielt aus Layout; Zeiten `repeat(2,minmax(0,1fr))`, Inputs `width:100%;min-width:0;max-width:100%`. Nur bei nachgewiesenem Bedarf Pauseneinrückung ändern. Zeitfelder/effektives Schalterlabel44px; sichtbarer Ring auf `.toggle-switch input:focus-visible + .toggle-slider`.

**Regression:** Zeile/Start/Ende/Pausen vollständig in Karte, beide Rollen erlaubte Pfade, beide Themes390px; echter Tab/Space-Fokus sichtbar, Pause öffnen/schließen, Uhrzeit ändern unter Write-Sperre. Standort-/Mitarbeiter-/Sondertage und Kalenderlegende erhalten; gezielte360/414px-/Desktopprobe. Kein Alt-Pass aus Neu-CSS.

### V8.03-F — Fußbefund passt horizontal; einzelne Checkboxen13×13px

**Auslöser/Ort:** Owner Neu390 hell/dunkel, Fußstatus. `.fbp-paper`358px, links16/rechts374; innerer Abschnitt332px, links29/rechts361; mainArea390/390. `#fbpPatientSearch`332×39px, `#fbpTermin`332×41px, `#fbpDatum`160×41px. Kein gemessener Breitenfix nötig. Desktop Papier752px/Abschnitt710px, ebenfalls kein Überlauf.

**Touchbefund:** z.B. `#fbp_def_senkfuss_l` und `_r`13×13px, links246/311px, rechts259/324px; Desktop ebenfalls13px. Bare Inputs in TD ohne umschließendes Label (`module/fussbefund.js:1230–1233`), andere Felder besitzen Label (`:1236–1238`). Zellhöhe44px vergrößert tatsächlichen Input nicht. Kein vollständiger Accessible-Name-Audit erfolgt.

**Kleinste ungetestete Vorlage:** ausschließlich belegte gepaarte Checkboxen44×44px effektive Trefferfläche, Spalten derzeit65px; danach Tabellenbreite/Links-Rechts prüfen. Gemessene Such-/Termin-/Datumfelder auf44px Höhe. Fehlende zugängliche Namen brauchen Markup beim Besitzer, CSS kann sie nicht erzeugen; vor Umsetzung vorhandene Labelmechanik prüfen. Keine klinischen Werte ändern.

**Regression:** tatsächliche Hitbox und zugängliche Namen je Seite, Space/Tab mit sichtbarem Fokus; keine Überlappung/Überbreite390px, Diagramm/Marker deckungsgleich, Links/Rechts erhalten. Aktepfad separat anhand zentraler V7-Evidenz. Employee-Standalone-Fußstatus wurde in beiden Neu-Themes verweigert: keine CSS-Reparatur und kein Rollen-Pass daraus. Keine neue Alt-Fußbefundprobe; vorhandene V704-Evidenz bleibt getrennt.

### V8.03-V — Vorlagen passen; Editor lässt Fokus außerhalb/zurück im versteckten Dialog

**Auslöser/Ort:** Neu390, vier Rollen-/Themefälle: Grid358px, mainArea390/390. `#vorlagenSettingsBtn`157,16×36px und `#vorlagenPanelNewBtn`131×36px. Kartenaktionen nicht messbar, weil synthetisches Auto-Seeding verweigert wurde.

**Editorstichprobe ausschließlich Owner/hell390:** `#vorlagenModal .modal`390px breit, links0/rechts390; Close44×44px. Nach Öffnen bleibt aktives Element `vorlagenPanelNewBtn` außerhalb Dialog. Nach tatsächlichem Close-Klick bleibt Fokus auf BUTTON ohne ID **innerhalb verstecktem Dialog** (`insideHidden=true`). Öffnen `dashboard.js:11728–11734` setzt hidden=false ohne Fokuswechsel; Dialog/Close `dashboard.html:5835–5839`, Inline-Close setzt hidden=true ohne Fokusrückkehr. Kein Editor-Breitenfix belegt.

**Kleinste Vorlage:** nur beide gemessenen36px-Knöpfe auf44px effektive Zielhöhe. Fokusproblem braucht vorhandene Modal-/Fokuslogik beim JS-Besitzer: Launcher merken, beim Öffnen passenden Dialoginhalt fokussieren, beim Schließen Launcher wieder fokussieren. **Keine CSS-Lösung**, keine neue Funktion ohne vorherigen Funktionsmeister-Abgleich. Hier ausschließlich Reparaturvertrag, kein Produktedit.

**Regression:** echte Tabfolge in Dialog, Close/Escape und Fokusrückkehr, nie Fokus in hidden-Inhalt; beide Themes und erlaubte Rollen, lange Formularinhalte390px. Kein Save/Delete/Print ausgelöst, keine Druckabnahme. Keine frische Alt-Vorlagenprobe; nicht als Altfehler verallgemeinern.

### Abschnittsnavigation und Altverhalten

In allen fünf untersuchten Panels `.px-abschnitte`-Anzahl0. Vorhandener Builder betrifft nur Settings (`module/einstellungen-nav.js:49–76`). Fehlende Navigation ist bekannte Archetyp-Umsetzungslücke, kein neuer klinischer Befund; CSS erzeugt keine Links/Fokusführung. Keine globale Umgestaltung. Normales Scrollen bleibt verfügbar.

Alt-Neu-Unterschiede oben explizit: Anamnese69/65px, Leistungen beide300px trotz lokalem Tabellen-Scroll, Arbeitszeiten gleiche horizontale Beschneidung bei abweichenden Höhen. Neue Fußbefund-/Vorlagenbefunde nur für gemessene Neu-Pfade. Zentraler V704c-Nachweis deckt Alt/Neu × Owner/Employee × hell/dunkel für bekannte R23-Überläufe ab; zentrale V7-Akte-/Rollenprüfung wiederverwenden.

## Wiederverwendete Beratungen und Nachweisgrenzen

- Impeccable tatsächlich gelesen, `context --target design/formulare.css` lief erfolgreich; audit-Referenz gelesen. Bestehende Oberfläche/Operate, enger Audit. Kein init-/Design-Dateischreiben unter Baustopp.
- `design:accessibility-review`, `engineering:debug` und `engineering:code-review` gelesen. 44×44px bleibt Projektstandard; WCAG2.1 2.5.5 ist **AAA**, nicht automatisch AA-Verstoß. Keine vollständige WCAG-/Screenreader-/Kontrastabnahme aus diesem Bericht ableiten.
- Frische native Sol6.1-`mobil-ui`-Gegenprüfung: Dokumentbreite reicht nicht, lokale Tabellenbreite von mainArea trennen, Alt separat. Prüfer hatte zunächst V704c-Smoke nicht vorliegen; Behauptung „300px ungemessen“ wurde durch oben konkret ausgewertete JSONs eingegrenzt/korrigiert. Kein CSS von Prüfer geändert.
- Unabhängiger Abschlussreview der geschriebenen Übergabe durch dieselbe native mobil-ui-Rolle: kein blockierender Dokumentationsbefund; Selektoren, Messwertgrenzen, Alt/Neu-Trennung und offene Regressionen bestätigt. Dies ist Review des Berichts, keine unabhängige Browser- oder CSS-Abnahme.
- Nachreview des frischen Probenachtrags durch dieselbe mobil-ui-Rolle: kein Blocker; Trennung von Messung und ungetestetem Containing-Block-Kandidaten bestätigt. Hinweise zu historischer Übergabe und nicht dateibasierter stdout-Evidenz hier eingearbeitet; keine zusätzlichen Browserläufe.
- Belastbare Podologie-Beratung aus `/root/formular_fachsicht`, Thread `thread:provider:codex:native-thread:01a17d3b-839c-71f1-b36b-d93ef3fcf330`, Position16, wiederverwendet: keine pauschale Farbregel über Fußmarker/Werkzeuge; Bild und Layer gemeinsam skalieren; Links/Rechts/Ansichten nicht vertauschen; Patient/Datum/VO/Prüfstatus getrennt; Standort-/Mitarbeiter-/Sondertage und Legende erhalten; GKV/private Leistungen und Kalenderfarben getrennt; Dokument-/Druckflächen ausschließen; verschobene Akte-/Kioskpanels und hidden-Zustände erhalten. Keine klinische Inhaltsänderung, keine neue Fachentscheidung nötig. Frühere mobil-ui-Usage-Limit-Ausführung bleibt **ohne Urteil**.
- `/tmp/praxura-formular-nachher/bericht.json`: begrenzte Geometrie mit **temporär injiziertem** unfreigegebenem CSS, nur Owner Neu bei1440hell/390hell/1440dunkel. Kein Nachweis aktueller Integration, Rolle Employee oder390dunkel. Vorher/Nachher jeweils Dokumentbreite allein unzureichend.
- `/tmp/praxura-v803-interaktion.json` enthält `[]`. Skript enthält Assertions und Alt-/Printvergleiche, deren erfolgreiche Ausführung dadurch nicht belegt ist. Kein Fokus-/Editor-/Druckpass übernommen.
- Vor der ergänzenden Probe ausgeführt: gezielte Git-/Quell-/Hashprüfung; maschinelle Auswertung vorhandener vier V704c-Smoke-JSONs; Sichtung Arbeitszeiten-Vorherbild; unabhängige native mobil-ui-Quellenprüfung. Die danach ausdrücklich reservierte begrenzte Probe ist oben dokumentiert; frühere fehlende Portbestätigung damit überholt.
- Lokale `agy-context --local-only` lieferte keine passende Fundstelle; gezielt direkt weitergelesen. Provideraufrufe0; keine gemessene Netto-Tokeneinsparung behauptet. Native Sol-Beratung separat, kein Gemini/agent-router.

## Übergabe und Wiederaufnahme

1. Nur diesen Dokumentcommit selektiv übernehmen. Untracked CSS ausdrücklich **nicht** übernehmen oder verwerfen.
2. R-23a zuerst klein bauen: einspaltiges Optionsgrid/Labelbegrenzung samt gezielter Regression. R-23b lokalen Containing-Block-Kandidaten gegen gemessene SR-Spanne prüfen; Arbeitszeiten anhand der jetzt erfassten Rects begrenzen. Keine neue Fullsuite je Einzelkorrektur.
3. Nach ausdrücklich aufgehobenem Baustopp höchstens drei Reparaturrunden, enger unabhängiger Review, selektiver CSS-Commit. Neue gemeinsame Navigation, Links/Cache und Gesamtgates bleiben Integrator.
4. Fußbefund-Touch und Vorlagen-Fokus erhalten oben konkrete Reparaturverträge samt offenen Regressionen, keine fiktiven Abnahmen. Zentrale V8.05/Phase9 erledigt Rollen-/Theme-/Breitenintegration sowie Fullsuite/Bildmatrix einmal pro Integrationspaket.
5. Kein main-Push, Deploy, V10-Standardwechsel, Live-DB oder Release-/RLS-/Kundeninstallationsnachweis aus diesem Paket.

Commit dieser Übergabe wird im zentralen Queue-Abschluss genannt; Produktbasis bleibt `c7fcf75e`, Dokumentbasis `ede70f5a`. Ausschließlich Bericht im Diagnose-Worktree geändert; Produktdateien und untracked CSS unverändert. Port18485 freigegeben.
