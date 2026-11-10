# P01 Shell: isolierter Kandidat

Kein Produkt-Hook in dashboard.js/.html durch dieses Teilpaket. Probe bootet aktuelle App mit synthetischer Fixture im Altmodus, importiert danach Shelladapter mit synthetischem Kontext und injiziert ausschließlich die Shell-CSS. Bilder zeigen daher Shell mit bestehender Overviewansicht, nicht bereits die integrierte neue Startkomposition.

## Adaptervertrag

`montiereShellansicht({ uid, rolle, scope, name, suche })` aus `module/shell-ansicht.js?v=20261110p01shell`. Erste vier Werte sind Getter des nach Auth/Profil/Plan/Standortprüfung bestätigten Appkontexts; `scope()` muss vollständige Standort-/Sharingbindung liefern. UID und Rolle werden zusätzlich unabhängig gebunden. Änderung sperrt Adapter bis Reload. Aufruf innerhalb init nach aktueller Sidebar-/Teaminitialisierung; `aktualisieren()` vor/bei expliziten Kontextwechseln. DOM-Observer erfassen aktuelle Nav-Neurender, Panels und Collapse; historische Design-Signale sind nicht Voraussetzung.

Optionales `suche`: `{ ensureLeadsCache, patientMatchesQuery, displayNameWithBirth, oeffnePatient }`, jeweils aktuelle Funktionen injizieren. Beispiel Öffner: `id => openPatientDetail(id)`. Ohne vollständigen Vertrag wird kein Suchfeld aufgebaut. Aktueller gemeinsamer Picker v20260906 bleibt Suchmechanik; `patientenAuffrischen()` delegiert dessen `refresh()`. Keine Dokument-/Rechnungs-/Verordnungssuche und keine eigenen Datenabfragen. Suchproben prüfen synthetische Delegation, nicht reale Cache-/RLS-Korrektheit.

Übernommen: bestätigte Shell-CSS und reine Menü-/Flyout-/Schubladenmodule. Ergänzungen: CSS erst unter `[data-design="neu"][data-px-shell="v2"]`, übernommene Menü-/Sidebarziele mindestens44px (Bestands-Hamburger/Themebutton noch gesondert messen), Aktivitätsprüfung an Menüaktionen, Restaurierung mobiler inert-/ARIA-Originalwerte, Alt-Rückkehr der hinzugefügten Widgets und des Startlabels. Bestehende Nav-Einträge und Originalknoten bleiben erhalten; alte Designregel zum Verstecken von Überblick/Anamnese/Fußbefund/Notizen wird nicht übernommen. Kein alter Shell-/Startseiten-/Formnav-/Emoji-Autostart.

## Prüfung

`REDESIGN_PORT=18096 rtk proxy node tools/browser-probe/p01-shell.mjs`

16Kontexte:390/1024/1025/1440px × hell/dunkel × Owner/Employee. Harte Assertions: unauthentifizierter Mount abgelehnt; Alt-Mountpixelidentität; vollständige Originalnavidentität; Erhalt vorhandener früher versteckter Menüeinträge; Neu-Startlabel; keine globale Überbreite; Profil/Neu-Menü und Escape-Fokusrückkehr; mobile Schublade mit Tab/Fokus/inert/Escape; Desktop-Collapse72px/Flyout/Escape; Suchdelegation/Slash/Auswahl ab900px; Suchfeld mobil verborgen; UID-/Rollen-/Scopeabweichung failclosed; Vollreload-Altpixel exakt gegen frische Referenz. Netzwerkfences vor Seitenerstellung, Serviceworker blockiert; Fremdorigin/Schreibmethoden/WebSocket/Seitenfehler führen zum Abbruch. `sources.json` pinnt eigene Module/CSS; deren Änderung während Lauf lässt Probe scheitern.

Syntaxchecks sieben Module bestanden. CSS-Scope und Important-Prüfung ohne Befunde. Impeccable-Detektor lieferte `[]`. Screens390light,1440light und1024dark visuell geprüft. Synthetische Fixture enthält weiterhin Podologienamen/-leistungen trotz Physiosektor; keine Physio-Fachabnahme.

## Offene Pixelkante und Grenzen

Dynamisches Neu→Alt ist **nicht durchgehend pixelgleich**. Rohhashes in results.json, genaue Position/Zahl in dynamic-pixel-analysis.json. Bisher acht Desktopfälle: sieben helle bzw14 dunkle Randpixel am rechten Rand des ursprünglichen Welcomebanners, maximal eine RGB-Stufe. Ursache dieser Desktopkante nicht abschließend geklärt; nicht pauschal Altbestand und kein PASS. Vollreload ist eigener harter Rollbackvertrag. Strukturelle dynamische Rückkehr wird separat geprüft.

Früher Kontrolllauf ohne jeden Shellmount reproduzierte eine andere390px-Kante exakt (21Randpixel des ursprünglichen Kalenderbuttons; control.json). Vollprobe vergleicht zusätzlich Neu→Alt mit Original-Hamburger/Overlay bzw Original-Collapse ohne Shell. Diese Kontrolle ist keine Toleranz, Maskierung oder Ersatzfreigabe der Desktopkante.

Vorläufe: Owner-Altbaseline vor verzögertem Einrichtungsring war ungleich; explizites Warten auf tatsächliches Ring-ARIA-Label korrigiert Bereitschaft. Kontrollklick auf Overlaymitte wurde durch offene Sidebar abgefangen; sichtbaren rechten Overlayrand verwendet. Keine Forceclicks. Dokumentierte Pixelabweichungen bleiben erhalten.

Offen: unabhängiger Review der Pixelkante; echter auth-nachgelagerter Hook und dessen integrierte aktuelle Daten-/Scopebindung; kombinierte neue Start-/Kalender-/Anamneseansichten; reale Tastatur-/Touchhardware, Standortwechselablauf und rollen-/fachspezifische Gesamtabnahme. Kein Commit durch Shellworker, kein Push/Deploy/Live-/DB-Lauf.
