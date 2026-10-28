# V8.03 / R-23 — Reparaturvorlage unter Baustopp

Stand: 28.10.2026. **Nur Untersuchung und Dokumentation. Keine CSS-Lieferung oder Integrationsfreigabe.**

## Auftrag und Besitz

- Problem: abgeschnittene Anamneseoptionen und Leistungsüberlauf bei 390px; Formularbreiten, Abschnittsnavigation, Fokus und Touchziele der fünf reservierten Bereiche einordnen.
- Einzige Schreibdatei dieses Pakets: `redesign/V803-UEBERGABE.md`.
- Wiederverwendung: V704c-Smoke, vorhandene Formular-Vorher-/Nachher-Probe und abgeschlossene Podologie-Beratung; keine erneute Fullsuite/Bildmatrix.
- Voraussetzung für Bau: ausdrückliche Wiederaufnahme durch zentrale Integration. Baustopp bleibt bestehen.
- Gemeinsame Dateien, Link-/Cache-Kette, STATUS, PLAN, INDEX und Referenzbilder bleiben beim Integrator.
- Nachweisgrenze: vorhandene Browsermessungen frisch ausgewertet und Quellen gezielt gegengeprüft; keine neue vollständige Interaktions-/Rollenabnahme.

## Basis und unveränderte Fremdarbeit

| Gegenstand | Festgestellt |
|---|---|
| Hauptcheckout | `/Users/melihdonmez/infinitymade-website`, `main`, `9b1737729631b1ec37a235087238d81f50c1b9c8`; fremde Dirty-Dateien vorhanden, nicht verändert |
| Eigener bestehender Formular-Worktree | `/private/tmp/praxura-v803-formulare`, Branch `redesign/praxura-formulare`, Basis/HEAD `c7fcf75ef56a72712f762e23c60ca08b15439975` |
| Integration bei Einstieg | `/Users/melihdonmez/.t3/worktrees/infinitymade-website/redesign-praxura-design`, `redesign/praxura-design`, `3c010868075ad9144f3835eacc0a4966dc69f07b`; V2.09b aktiv, keine zweite Implementierung |
| Reservierung | Zentrale PLAN-V2:113 und STATUS:53/151: nur `design/formulare.css` + diese Übergabe; CSS-Bau ausdrücklich gestoppt |
| Bestehendes CSS | untracked `design/formulare.css`, SHA-256 `b937896777e684bee3647b8eadc3516a8a788422a63c50a5951045f8cd069fa4`; weder editiert, übernommen, gestaged noch verworfen |
| Vorherige Übergabe | Diese Datei existierte noch nicht. Vorarbeit aus Thread `08572257-cf76-4f8a-bd43-6c5abb541ebb`, Positionen 419–533 und lokalen Artefakten rekonstruiert |

Quellzeilen unten beziehen sich auf Formular-Basis `c7fcf75e`, sofern nicht anders bezeichnet. `dashboard.css`, `module/leistungen-liste.js` und `module/einstellungen-nav.js` haben gegenüber gelesenem Integrationsstand keinen Diff. `module/anamnese.js` und `module/fussbefund.js` erhielten danach Rollen-/Scopeänderungen; alte Owner-/Employee-Erreichbarkeit deshalb nicht auf neue Pfade übertragen.

## Belastbare Befunde und kleinster Reparaturvertrag

### R-23a — Anamneseoptionen rechts abgeschnitten, bereits bekannt

**Auslöser:** synthetische volle Podologiepraxis, Anamnese öffnen, 390px. Beide Rollen und Themes betroffen. Befund bleibt eine bestehende R-23-Teilursache, kein neuer V7-Fehler.

**Ort:** `dashboard.css:5758` (`.anam-grid`, drei `1fr`-Spalten), `:5764` (Flexlabels), `:8217` (36px Mindesthöhe). Optionsmarkup `module/anamnese.js:76–80`, insbesondere `#anf_weitere_medikamente` und `#anf_allergien` unter `#panel-anamnese .anam-grid.anf-optionen`; Felddefinitionen `module/anamnese-formulare.js:122–131`.

**Gemessen, vorhandener V704c-Browsernachweis:**

| 390px, jeweils Owner/Employee × hell/dunkel | Dokumentüberbreite | mainArea.scrollWidth − clientWidth |
|---|---:|---:|
| Alt | 0px | 69px |
| Neu | 0px | 65px |

Zusätzliche Owner-Geometrieprobe in beiden Themes: `mainArea.scrollWidth=455`, Chemotherapie-Label rechts bei `421.265625px`, Desinfektionsmittel und Metall/Nickel bei `454.859375px`. Quelle `/tmp/praxura-v704c-anamnese.log`, zentral `redesign/V704-PHASENGATES.md:237–242`; Bild `.redesign-shots/v704cneu/owner-voll/neu-dunkel-390/14-anamnese.png`. Labelbreiten selbst wurden dort nicht gespeichert; rechte Kante ist ausdrücklich kein Breitenwert.

**Sichtbare Folge:** Medikament-/Allergieoptionen verlassen sichtbaren rechten Rand. `.main-area { overflow-x:hidden }` (`dashboard.css:925–928`) verdeckt Überstand; Dokumentbreite allein zeigt Fehler nicht.

**Kleinste CSS-Vorlage nach Wiederaufnahme:** ausschließlich Neu/Screen, vorhandenes Optionsgrid mobil auf `grid-template-columns:minmax(0,1fr)` stellen; Labels auf `min-width:0; max-width:100%; white-space:normal; overflow-wrap:anywhere` begrenzen. `min-height:44px` am klickbaren Label, `:focus-within` am Label erhalten/ergänzen. Vorhandener Entwurf enthält Teile bereits (`formulare.css:31–47`, `:138–140`); keine pauschale Übernahme seines restlichen Redesigns. Inline-Arztgrid ist eigener Fall (`anamnese.js:92`); die dortige Inline-Deklaration wird durch normale `.form-row`-Regel nicht überschrieben.

**Regression:** Neu, beide Rollen/Themes bei 390px: Dokument und mainArea maximal 1px Überbreite; alle drei genannten Optionen samt Text-Range innerhalb Label/Karte/mainArea; Label vollständig klickbar, Tab/Space verändert genau zugehörigen Wert, Fokus bleibt sichtbar. Bei 360/414/768/1024 und 1440px gezielt gegenprüfen, einschließlich langen Arztfeldern und bedingten Unterfeldern. Zusätzlich Anamnese in Akte/Kiosk; keine `.main-area`-Abhängigkeit, keine `[hidden]`-Übersteuerung. Alt69px separat dokumentieren, nicht durch Neu-CSS verdeckt als repariert melden.

### R-23b — Leistungen: 300px mainArea-Überbreite, Ursache noch nicht isoliert

**Auslöser:** Leistungen in voller synthetischer Praxis bei 390px öffnen. **Messwert bestätigt, Root Cause offen.**

**Ort:** `module/leistungen-liste.js:148–154` und `:287–288` erzeugen `.srv-gruppe > .srv-tabelle`; `dashboard.css:7978–7985` definiert bereits lokalen Scrollcontainer und `min-width:640px` für Tabelle. Hosts `#gkvCatalogSection` (`dashboard.html:432`) und `#servicesGrid` (`:478`).

**Gemessen:** V704c Alt/Neu × Owner/Employee × hell/dunkel, jeweils 390px: Dokument0px, mainArea300px Überbreite. Quelle vier `.redesign-shots/smoke-v704c-{alt,neu}-{owner,employee}.json`; Messformel `tools/redesign-smoke.mjs:75–78`. **640px ist deklarierte Tabellenmindestbreite, keine gemessene Containerbreite.** Vorhandene Formular-JSONs nennen nur Dokument390px und überstehende Tabellen-Selektoren; sie isolieren verursachenden Host nicht.

**Sichtbare Folge:** rechte Tabellenspalten außerhalb sichtbaren Ausschnitts. Interner Tabellen-Scroll ist vorgesehen; 300px mainArea-Überbreite bleibt davon getrennt. Noch unbelegt: ob Container selbst zu breit ist, anderer Nachfahre übersteht oder letzte Aktion trotz Scroll erreichbar bleibt. Nicht allein aus Tabellenminimum auf Ursache schließen.

**Kleinste bedingte CSS-Vorlage:** Zuerst Rect/clientWidth/scrollWidth von `#panel-services`, beiden Hosts, `.srv-gruppe` und `.srv-tabelle` in derselben geöffneten Ansicht messen. Nur falls `.srv-gruppe`/Host die mainArea überschreitet: den belegten Knoten Neu/Screen mit `min-width:0; max-width:100%` begrenzen, vorhandenes `overflow-x:auto` am Tabellenkasten erhalten. `formulare.css:142–143` wiederholt lediglich bestehendes Scroll-/640px-Verhalten und schließt R-23 nicht nachweislich. Weder global `overflow:hidden` noch Tabelle blind auf 100% quetschen; keine fachlichen Spalten entfernen.

**Regression:** mainArea maximal1px Überbreite; lokaler Tabellenkasten innerhalb Panel. Lokal horizontal bis Ende scrollen; letzte Einrichten-/Bearbeiten-/Löschaktion sichtbar, per Tab erreichbar und ohne echten Write bedienbar. GKV und private Gruppen samt langer Namen, geöffneten Formularen und Zuordnungen prüfen. Beide Rollen/Themes; 390px plus 360/414/768/1024/1440. Alt bleibt Vergleichsfall, interne Scrollbarkeit kein automatischer Fehler. Solange Ursachenmessung fehlt, keine geschlossene R-23b-Reparatur behaupten.

### V8.03-H — Arbeitszeiten: Endzeit rechts abgeschnitten, bestehende Vorarbeit

**Auslöser:** Neu/Owner/hell bei390px, Öffnungszeiten anzeigen. Vorherbild `/tmp/praxura-formular-vorher/hours-390-hell.png` heute gesichtet: Endzeitfeld rechts gekappt. Vorher-JSON listet `.hours-row`, `.hours-times`, `#wh-end-0/1` und `.hours-breaks-wrap` als überstehend, Dokument bleibt390px. **Exakte Rectbreiten wurden damals nicht protokolliert.** Keine erfundenen Pixelwerte.

**Ort/Ursache im Quelltext:** `dashboard.css:5010–5013` mobil drei Rasterspalten `100px 44px 1fr`, dazu `.hours-times` mit zwei110px-Spalten und12px Gap (`:3387–3409`). `dashboard.js:9054–9066` hat Schalter bereits im ersten Kind plus leeres zweites Kind; Employee-Renderer gleiches Muster `:10298–10310`. `.toggle-switch`38×22px (`dashboard.css:3123`), Zeitfelder110×36px sind **CSS-Sollwerte, keine frischen Browsermessungen**.

**Kleinste CSS-Vorlage:** mobil Neu nur Tageszeile einspaltig; leeres zweites Kind gezielt aus Layout nehmen; Zeitraster `repeat(2,minmax(0,1fr))`, Zeitfelder `width:100%;min-width:0;max-width:100%`. Erst bei gemessener Notwendigkeit Pauseneinrückung begrenzen. Zeitfelder und Schalterlabel auf44px Zielhöhe; sichtbaren Ring für `.toggle-switch input:focus-visible + .toggle-slider` verwenden, da Input selbst0×0px/transparent (`dashboard.css:3132–3136`). Entwurf `formulare.css:58–85`, `:133–137` enthält größere Änderungen als notwendiger Cut und ist nicht abgenommen.

**Regression:** Vorher Rects von Zeile, Start/Ende und Pausen erfassen; nachher alle innerhalb Karte/mainArea. Owner-Tage und tatsächlich erlaubten Mitarbeiterzeiten-Pfad separat prüfen, keine Sichtbarkeit per CSS erzwingen. Per Tab/Space Schalter bedienen, sichtbarer Ring auf Slider; Pause öffnen/schließen und Uhrzeit bearbeiten, nur synthetische Write-Sperre. Standort-/Mitarbeiter-/Sondertage und Kalenderlegende erhalten. 390px hell/dunkel sowie360/414/768/1024 und Desktop1280/1440.

## Fußbefund und Vorlagen: gezielte Prüfung, keine neuen belegten Layoutfehler

| Bereich | Vorhandene Messung / Quellenprüfung | Kleinste Vorlage / offene Regression |
|---|---|---|
| Fußbefund-Breite | Owner Neu hell390 und hell/dunkel1440: früheres Vorher-JSON meldet Dokumentbreite gleich Viewport, keine überstehenden Selektoren; keine Form-/Label-/Touch-Rects. Bestehende Containerregeln `dashboard.css:8362–8425` stapeln Fußdiagramme und Zehenraster bereits. | Kein Breitenfix ohne gemessenen Auslöser. Containerbreite in Panel **und Akte** prüfen; Bild/Markerlayer deckungsgleich, Links/Rechts und Ansichtstitel sichtbar erhalten. |
| Fußbefund-Fokus/Touch | `.fbp-grid-table` enthält einzelne Checkboxen ohne klickbares Label (`module/fussbefund.js:1230–1233`); daneben umschließende Labels `:1236–1238`. Zehenbuttons mobil44×44 laut CSS `dashboard.css:8410`. Keine aktuelle Hitbox-/Tastaturmessung. | Zellhöhe44px allein vergrößert **nicht** Checkbox-Hitbox. Erst effektive Trefferfläche messen. Kleiner CSS-Kandidat nur für belegte kleine Treffer: begrenztes Checkbox-Control44×44 bzw. vorhandenes Label44px, nicht pauschal alle Tabellenzellen. Fehlende accessible names einzelner Checkboxen wären Markup-Aufgabe beim Besitzer, nicht CSS-scheinlösen. Werkzeug-/Farbbuttons, Radios und Eingaben per Tastatur/Hit-Test prüfen. |
| Vorlagen-Breite | Vorher-JSON Neu/Owner hell390: Dokument390, keine überstehenden Selektoren; Basis hell/dunkel1440 ebenfalls unauffällig. `#vorlagenModal`-Editorlauf nicht nachgewiesen. | Kein neuer Breitenbug behauptet. Grid und geöffneten Editor getrennt messen; nur belegten Host begrenzen. Kein Eingriff in iframe, Papier, Dokumentfarben oder Druck. Lange Titel: `overflow-wrap` allein hebt `white-space:nowrap`/Ellipsis (`dashboard.css:7329–7338`) nicht auf; vollständiger Titel braucht eigenen Nachweis. |
| Vorlagen-Fokus/Touch | `.vorlage-card-actions` wrappt bereits (`dashboard.css:7351`); `.btn-sm` kleine Padding-/Fontwerte `:7356`. Keine gespeicherten effektiven Zielmaße. | Erst gerenderte Aktionen und Editor-Close messen, gegebenenfalls nur diese Knöpfe44px. Editor öffnen/Tabfolge/Schließen/Fokusrückkehr prüfen, keine Speicher-/Löschaktion auslösen. |

**Abschnittsnavigation:** Tatsächlich vorhandene `.px-abschnitte` wird nur für `#panel-settings` gebaut (`module/einstellungen-nav.js:49–76`); sie setzt nach Navigation Fokus auf Abschnitt. In den fünf Formularbereichen existiert damit keine wiederverwendbare fertige Abschnittsnavigation. Dies ist Umsetzungslücke gegen Formular-Archetyp, kein vermessener Navigationsfehler. CSS kann fehlende Links/Fokusführung nicht erzeugen. Unter Baustopp keine neue Navigation bauen; nach Wiederaufnahme vorhandenen Besitzer/Funktionsmeister für eng begrenzte Wiederverwendung hinzuziehen. Anamnese-/Fußbefundabschnitte bleiben erreichbar durch normales Scrollen. Keine globale Umgestaltung und kein erfundener Fokus-Pass.

**Rollen:** V704c-Smoke verweigert Employee den eigenständigen Fußbefundbereich in Alt/Neu/hell/dunkel bei390/1440. Das ist nicht fehlendes Formular-CSS. Berechtigte Akte-/Terminpfade getrennt behandeln; zentrale V7.04h-Einstiegsprüfung wiederverwenden, nicht komplett wiederholen. Vorlagen können synthetisches Auto-Seeding versuchen; `RS_READONLY` ist abgefangener Write, keine erfolgreiche Speicherung.

## Wiederverwendete Beratungen und Nachweisgrenzen

- Impeccable tatsächlich gelesen, `context --target design/formulare.css` lief erfolgreich; audit-Referenz gelesen. Bestehende Oberfläche/Operate, enger Audit. Kein init-/Design-Dateischreiben unter Baustopp.
- `design:accessibility-review`, `engineering:debug` und `engineering:code-review` gelesen. 44×44px bleibt Projektstandard; WCAG2.1 2.5.5 ist **AAA**, nicht automatisch AA-Verstoß. Keine vollständige WCAG-/Screenreader-/Kontrastabnahme aus diesem Bericht ableiten.
- Frische native Sol6.1-`mobil-ui`-Gegenprüfung: Dokumentbreite reicht nicht, lokale Tabellenbreite von mainArea trennen, Alt separat. Prüfer hatte zunächst V704c-Smoke nicht vorliegen; Behauptung „300px ungemessen“ wurde durch oben konkret ausgewertete JSONs eingegrenzt/korrigiert. Kein CSS von Prüfer geändert.
- Unabhängiger Abschlussreview der geschriebenen Übergabe durch dieselbe native mobil-ui-Rolle: kein blockierender Dokumentationsbefund; Selektoren, Messwertgrenzen, Alt/Neu-Trennung und offene Regressionen bestätigt. Dies ist Review des Berichts, keine unabhängige Browser- oder CSS-Abnahme.
- Belastbare Podologie-Beratung aus `/root/formular_fachsicht`, Thread `thread:provider:codex:native-thread:01a17d3b-839c-71f1-b36b-d93ef3fcf330`, Position16, wiederverwendet: keine pauschale Farbregel über Fußmarker/Werkzeuge; Bild und Layer gemeinsam skalieren; Links/Rechts/Ansichten nicht vertauschen; Patient/Datum/VO/Prüfstatus getrennt; Standort-/Mitarbeiter-/Sondertage und Legende erhalten; GKV/private Leistungen und Kalenderfarben getrennt; Dokument-/Druckflächen ausschließen; verschobene Akte-/Kioskpanels und hidden-Zustände erhalten. Keine klinische Inhaltsänderung, keine neue Fachentscheidung nötig. Frühere mobil-ui-Usage-Limit-Ausführung bleibt **ohne Urteil**.
- `/tmp/praxura-formular-nachher/bericht.json`: begrenzte Geometrie mit **temporär injiziertem** unfreigegebenem CSS, nur Owner Neu bei1440hell/390hell/1440dunkel. Kein Nachweis aktueller Integration, Rolle Employee oder390dunkel. Vorher/Nachher jeweils Dokumentbreite allein unzureichend.
- `/tmp/praxura-v803-interaktion.json` enthält `[]`. Skript enthält Assertions und Alt-/Printvergleiche, deren erfolgreiche Ausführung dadurch nicht belegt ist. Kein Fokus-/Editor-/Druckpass übernommen.
- Ausgeführt in dieser Untersuchung: gezielte Git-/Quell-/Hashprüfung; maschinelle Auswertung vorhandener vier V704c-Smoke-JSONs; Sichtung Arbeitszeiten-Vorherbild; unabhängige native mobil-ui-Quellenprüfung. **Keine neue Browserprobe, Fullsuite oder große Bildmatrix.** Shared Preview meldete `available:false`. Probeport18485 zentral per Queue vorgeschlagen; bis Dokumenterstellung kein ACK gelesen, deshalb kein Listener gestartet;18081 unverändert.
- Lokale `agy-context --local-only` lieferte keine passende Fundstelle; gezielt direkt weitergelesen. Provideraufrufe0; keine gemessene Netto-Tokeneinsparung behauptet. Native Sol-Beratung separat, kein Gemini/agent-router.

## Übergabe und Wiederaufnahme

1. Nur diesen Dokumentcommit selektiv übernehmen. Untracked CSS ausdrücklich **nicht** übernehmen oder verwerfen.
2. R-23a zuerst klein bauen: einspaltiges Optionsgrid/Labelbegrenzung samt gezielter Regression. R-23b erst verursachenden Host isolieren; Arbeitszeiten zunächst fehlende Rects erfassen. Keine neue Fullsuite je Einzelkorrektur.
3. Nach ausdrücklich aufgehobenem Baustopp höchstens drei Reparaturrunden, enger unabhängiger Review, selektiver CSS-Commit. Neue gemeinsame Navigation, Links/Cache und Gesamtgates bleiben Integrator.
4. Fußbefund/Vorlagen erhalten konkrete offene Prüfaufträge, keine fiktiven Nullbefunde/Abnahmen. Zentrale V8.05/Phase9 erledigt Rollen-/Theme-/Breitenintegration sowie Fullsuite/Bildmatrix einmal pro Integrationspaket.
5. Kein main-Push, Deploy, V10-Standardwechsel, Live-DB oder Release-/RLS-/Kundeninstallationsnachweis aus diesem Paket.

Commit dieser Übergabe wird im zentralen Queue-Abschluss genannt; Basis bleibt `c7fcf75e`. Produktdateien unverändert.
