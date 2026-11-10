# P01-START: bestätigte Komposition mit aktuellem Lader

Lokaler Zwischenstand nach 94b6d429, 3e7059aa (Kalender-Touchziele) und d67fc050 (Inventarbindungen). Kein Phase-1-/Gesamtabschluss, keine Aktivierung, kein Push/Deploy.

## Was integriert ist

- Neue Startansicht mit bestätigter Next-/Todo-/Termine-/Verordnungen-/Freie-Zeit-Komposition. Markupfunktionen und reine Darstellungshelfer selektiv aus gepinnter Designquelle übernommen. Kein alter Startloader, kein alter Shellstart, keine zusätzliche Datenabfrage und keine zweite Finanzberechnung.
- Authgebundener dynamischer Import in init nach renderSidebar/loadTeam, vor renderOverview. Neuer Viewadapter unter module/startseite-ansicht.js; reine Quellhelfer unter module/startseite-darstellung.js. dashboard.js wächst um keine Zeile. Der vorhandene loadScheduleBookings übergibt seinen vollständigen Snapshot vor seinem bisherigen Zukunftsfilter. Employee-Darstellung filtert diesen Snapshot zusätzlich auf eigene user_id; die ursprüngliche Query-/RLS-Logik bleibt unverändert.
- Aktuelle #startAufgaben, #physioRezKpi, .gaps-section und .today-section wandern mit Rückkehrankern als identische DOM-Knoten in stabile Slots. Ausschließlich neue Karteninseln erneuern Markup. Aktuelle Aufgabenhandler, Formzustand, KPI-Klicks, freie-Zeit-Datumsnavigation und Kalenderfilter bleiben im Eigentum des Bestands. Alte Kalenderdarstellung unter „Kalenderansicht und Filter“ erreichbar. Aktivitätsbereich und Warnbanner bleiben erhalten.
- Alt/Neu-Wechsel stellt Originalknoten an ihre Anker zurück. Druckereignisse stellen vor dem Druck Originalstruktur her. Adapter lädt anfänglich ausschließlich beim Neu-Boot; ein anfänglicher Alt-Boot importiert ihn nicht. Eine spätere Aktivierungsstrategie ist separat zu lösen.
- Vorhandener KPI-Lader markiert ausschließlich seinen Zustand laden/fehler/ok. Neue Ansicht behandelt nicht erfolgreich bekannte Werte als Unknown. Bei abweichendem Benutzer-/Rollen-/Owner-/Standortscope blendet sie sich aus; keine Wiederverwendung alter Karten für neue Identität.
- Owner-Finanzkarte zeigt Unknown und öffnet aktuelle Rechnungen/Belegliste/Statistik. Es fehlen dafür geprüfte aktuelle Startdatenverträge. Dies ist eine dokumentierte Abweichung zur vollständigen bestätigten Finanzdarstellung.

## Lokale Belege

Werkzeug: tools/browser-probe/physio-demo-p01.mjs; HTTP-/WS-Fences und Serviceworkerblock vor Seitenerzeugung, nur erfundene Fixtures. Unter evidence/p01-start liegen Rohdaten und Bilder. Ursprüngliche P01-Belege wurden nicht überschrieben. Vorläufige Bilder wurden privat zum bestehenden Snapshot verschoben.

```
P01_START=1 P01_OUT=p01-start REDESIGN_PORT=18092 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
P01_INTERACTIONS=1 P01_OUT=p01-start REDESIGN_PORT=18093 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
P01_QUICK=1 P01_OUT=p01-start REDESIGN_PORT=18095 rtk proxy node tools/browser-probe/physio-demo-p01.mjs
rtk proxy node --test tools/redesign-wachen.test.js tools/redesign-kontrast.test.js
rtk proxy node tools/redesign-wachen.mjs
rtk proxy node tools/funktionskarte.mjs
rtk proxy node tools/funktionskarte.mjs --check
rtk proxy /Users/melihdonmez/.agents/skills/impeccable/scripts/impeccable detect --json module/startseite-ansicht.js module/startseite-darstellung.js design/startseite.css
```

- Startprobe: Owner/Employee × hell/dunkel × 390/1440. Aufgaben- und Inputknoten identisch nach KPI-Fehlerredraw, Alt/Neu-Rückkehr und Panelwechseln; Entwurf bleibt erhalten. Echter Aufgaben-Submit erreicht exakt einen ausschließlich lokalen praxis_aufgaben.insert, dessen definierter Fehler den Entwurf erhält. Kalender- und Überblicklinks schalten aktuelle Panels; Owner-Patientenakte öffnet und schließt den aktuellen Dialog; Rechnungslink öffnet aktuelles Panel. Employee-Fixture besitzt hier keine eigenen Termine: keine fremde Patientenverknüpfung gerendert, eigener Leerezustand bestätigt. Zusätzlich leer/fehler/langsam mit echten vorhandenen Ladern geprüft. Langsam belegt keinen vollständigen Ladezustandsvertrag aller Karten.
- Quickmatrix: 8 Rollen-/Theme-/Breitenkontexte mit je 3 aktuellen Panels, keine globale horizontale Überbreite. 12 Alt-Pixelvergleiche identisch. Zusätzlich 4 Szenarien erreichbar. Keine Fremdhosts, Netzwerk-Schreibversuche, WebSockets oder Seitenfehler.
- Anamneseprobe verschärft: Patientoptionen zwingend, Save mit Patient zwingend aktiv, exakt ein Fixture-anamnese.insert und exakter erhaltener Text; beide erwarteten Kopfaktions-IDs zwingend, jeweils ≥44 px. Vorhandener lokaler Fehlernachweis bestanden.
- 24 Scope-/Kontrasttests bestanden; Impeccable einmal für neue Startdateien: 0 Befunde. Scope-/Cache-/Auslieferungswache bestanden. Map nach Produktänderungen regulär erzeugt; concurrent Shellquellen können gemäß Integratorprotokoll in der erzeugten Gesamtkarte enthalten sein, ohne dass deren UI hier eingebunden/abgenommen wird.
- Bilder owner-{hell,dunkel}-{390,1440}-start.png und entsprechende Employee-/Aufgabenbilder. Tatsächlich gesichtet: Owner 1440 hell einschließlich Finanzunknown; repräsentative schmale/dunkle Bilder vor Handoff noch einmal gesichtet. Unabhängiger Review bleibt erforderlich.

## Transparente Grenzen und nächste Schritte

Kein echter Login, keine Live-/DB-/Druckdialog-/RLS-Abnahme. Fixture-Fachbereich ist physiotherapy, Leistungs-/Verordnungsdaten sind weiterhin generische Podologie-Beispiele; kein fachlicher Physio-Domainnachweis. Snapshot übernimmt nur Felder des aktuellen Laders; z. B. services.is_internal wird dort nicht geliefert, somit wird daraus keine vollständige Blocker-/Zählsemantik abgeleitet. Employee-Abnahme mit tatsächlich eigenen Terminfixtures steht zusätzlich aus.

Bestätigte Shellintegration und Anamnese-Abschnittsnavigation werden separat vorbereitet; nicht Bestandteil dieses Startcommits. Finanzzahlen/Wochenverfügbarkeit fehlen als geprüfter Datenvertrag. Verordnungskarte bewahrt aktuelle KPI-Knoten statt die querygebundene alte Handlungsbedarfskarte zu importieren. Bestehende Kalenderdetails bleiben zugänglich, vollständige Filter-/Raum-/Standort-/Wochenansichtsabnahme bleibt separat. Kontextwechsel blendet den Adapter aus; vollständiger Auth-/Identity-Neustart gehört zur späteren Aktivierung.

Ein Zusatzprobe-Vorlauf erwartete irrtümlich eine Patientenakte im leeren Employee-Scope und lief in einen Timeout. Erwartung korrigiert: Owner-Link zwingend prüfen, im Employee-Leerfall zwingend keinen fremden Aktenlink rendern. Keine Produktlogik dafür aufgeweicht. Frühere Zwischenläufe und fehlgeschlagene Mapchecks wegen gleichzeitig neu entstehender Shellquellen gelten nicht als finale Prüfergebnisse. Kein externer Provideraufruf oder gemessener Netto-Tokenspareffekt dieses Pakets.

Elternbeleg für Touchziele: evidence/calendar-targets/README.md. Quellenbindungen: INVENTAR-BINDUNGEN.md plus TRANSFER.md/.json. Alle anderen Agentenedits bleiben erhalten; selektives Staging eigener Dateien.
