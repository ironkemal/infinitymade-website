# P01-REP: aktueller CSS-Zwischenkandidat

Basis b0874f85, bestehender Integrationsworktree. Lokal geschrieben und synthetisch browsergeprüft. Phase 1/Gesamtziel bleiben offen. Kein Push/Deploy, keine Aktivierung.

## Produktdiff und Quellen

- praxura-design.css exakt aus bestätigter Designquelle übernommen (nur 49 Zeilen Diff gegen aktuellen Integrationsbestand). Zusätzlich privat unter SOURCE-MANIFEST.token_css_supplement gesichert.
- design/kalender.css exakt übernommen; bestehende Tag-/Woche-/Monat-Renderer, Filter, Abwesenheiten und Handler bleiben erhalten.
- design/formulare.css selektiv auf Anamnese begrenzt: bestehende Felder/Labels/Fokus und44 px-Aktionsziele, einspaltiger kleiner Bildschirm. Keine anderen Formularpanels übertragen.
- dashboard.html ausschließlich Cacheversion und 2 Stylesheetlinks. Auslieferungsvertrag Docker/Workflow ergänzt. dashboard.js sowie sämtliche Produktmodule unverändert.
- Alle 12 Designpins frisch gegen Originalquelle geprüft: identisch. Originale/18086 unberührt.

## Browserbelege

Werkzeug tools/browser-probe/physio-demo-p01.mjs verwendet vorhandenen statischen Server und synthetische Supabase-Fixture, ersetzt nur den Fachbereich durch physiotherapy. Wichtige Grenze: Leistungs-/VO-Beispieldaten stammen noch aus generischer Podologie-Fixture; keine fachliche Physio-Datenabnahme behauptet. Alle Daten erfunden. HTTP/WS-Routen und Serviceworkerblock stehen vor page creation. Schreibender HTTP-Aufruf würde503 bekommen, Fremdorigin/WS wird abgebrochen. Fixture-Insert bleibt lokal und liefert einen definierten Fehler.

- evidence/p01/results.json:20 Kontexte (Owner/Employee × hell/dunkel ×390/768/1024/1025/1440), je 3 aktuelle Panels; alle aktiv, keine globale horizontale Überbreite, keine Seitenfehler. Zusätzlich4 Szenarien leer/fehler/langsam/gross: alle 3 Panels erreichbar. Diese Szenarien belegen Erreichbarkeit, keinen vollständigen Zustandsvertrag für jede Warnquelle.
- 12 Alt-Screens (3 Panels ×2 Breiten ×2 Themes) mit/ohne neuen CSS-Payload SHA256-pixelgleich.
- evidence/p01/interactions.json:390/1440; echte Tag/Woche/Monat-Klicks; aktuelles #startAufgaben verbunden und sichtbar; Speichern ohne Patient deaktiviert, mit Patient aktiv. Synthetischer anamnese.insert scheitert ausschließlich in Fixture und Eingabe bleibt erhalten. Escape behält Feldfokus. Anamnese-Kopfaktionen≥44 px.
- Screens owner-{hell,dunkel}-{390,1440}-{overview,calendar,anamnese}.png sowie interaction-{390,1440}-{day,week,month}.png. Tatsächlich gesichtet: Kalender390hell, Anamnese1440hell und390dunkel, Start1440hell. Elternreview aller repräsentativen Bilder ausstehend.
- evidence/p01/print.json: Neu im Druckmedium bei 1440 px mit/ohne CSS-Payload pixelgleich. Dies prüft den App-Viewport, keinen erzeugten Formular-PDF-/Druckdialog.
- HTTP/WS-Fenceprotokolle: keine Fremdhosts, Netzwerk-Schreibversuche oder WebSockets. Keine echten Zugangsdaten, kein Login.

## Ausgeführte Befehle

Arbeitsort ist dieser Integrationsworktree; Shell via rtk proxy. Lokales node_modules ist ein ungetrackter Symlink auf bereits vorhandene Original-Abhängigkeiten (keine Installation/Änderung dort).

```
REDESIGN_PORT=18092 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
P01_INTERACTIONS=1 REDESIGN_PORT=18092 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
P01_PRINT=1 REDESIGN_PORT=18092 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
rtk proxy node tools/redesign-wachen.mjs
rtk proxy node --test tools/redesign-wachen.test.js tools/redesign-kontrast.test.js
rtk proxy /Users/melihdonmez/.agents/skills/impeccable/scripts/impeccable detect --json praxura-design.css design/kalender.css design/formulare.css
```

Scope/Cache/Auslieferung/Schrumpf bestanden;24 Tests bestanden. Impeccable einmal: Exit2, eine Warnung (bestätigte klinische Statuskante .rez-kpi-tile border-left-width3px). Beibehalten, da bestätigte Quellgestaltung und klinischer Status, kein neuer Designvorschlag. Rohbefund impeccable.json. Keine Provider-Aufrufe dieses Schritts, keine Netto-Tokenersparnis behauptet.

Vorläufe transparent: fehlendes Playwright-Paket im frischen Worktree durch vorhandenen Dependency-Symlink behoben. Ein Vorlauf mit falschem Sektorwert physiotherapie abgebrochen und durch physiotherapy ersetzt. Testdatei zunächst irrtümlich mit.mjs gesucht, korrekt mit.js ausgeführt. Interaktionsprobe zunächst auf korrekt deaktivierten Savebutton gelaufen und in Timeout geendet; danach vorhandenen Disabledvertrag gemessen statt per Forceclick umgangen. Keine Produktänderung daraus abgeleitet.

## Konkreter nächster Umsetzungsschritt (bereits im Gesamtplan autorisiert)

Kein Endzustand von Phase 1: bestätigte Shell und exakte Startkomposition fehlen. startseite.css vollständig würde aktuelle Aufgaben verstecken, daher nicht importiert. Funktionsberater bestätigt: startseite-neu ersetzt root.innerHTML und kennt die aktuelle Aufgabenfunktion nicht. Minimaler kompatibler Viewadapter: bestätigten Renderer in stabile Layoutslots aufteilen; vorhandenes #startAufgaben als identischen DOM-Knoten einmal in Aufgaben-Slot verschieben (kein Clone, kein erneuter Mount, kein innerHTML über aktuelle Aufgaben); bestehende KPI-/Warnquellen und aktuelle Handler unverändert einbinden; Teardown/Rückkehr und Alt-Modus separat absichern. Keine zweite Finanzlogik. Parent übernimmt Folgeschritt und unabhängigen Review.

Auch offen: Anamnese-Abschnittsnavigation benötigt den vorhandenen Wrappingvertrag aus bestätigtem Formularadapter; dessen CSS ohne erzeugte DOMslots wäre wirkungslos und wurde nicht als erfüllt übertragen. Kalenderquelle enthält36 px-Toolbarziele;44 px-Touchziel-Abnahme noch offen. Lange/leer/fehler/Unknown-Warnungen, Standort/Raumdaten, Employee-Rechte, Klinikfarben und vollständige Interaktion sind nicht durch reine CSS-Existenz oder Erreichbarkeit abgenommen. Originalrenderer bleiben unverändert, das ersetzt keinen vollständigen Funktionstest.

Elternbelege: Downloads/Praxura-Redesign-Inventarbindungen-2026-11-10.md löst fünf Modulzuordnungen auf; Downloads/Praxura-Redesign-Aktivierungsvertrag-2026-11-10.md und -Boot-Befund-2026-11-10.json bleiben getrennte Elternvorarbeit. Aktivierung wird in diesem Paket nicht implementiert.
