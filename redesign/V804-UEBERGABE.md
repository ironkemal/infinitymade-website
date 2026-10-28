# V8.04 — Verwaltungsansichten

Stand: Gruppe 1 zentral integriert; Gruppe 2 lokal geprüft. V8.04 insgesamt offen.

- Basis: `3c010868075ad9144f3835eacc0a4966dc69f07b`.
- Worktree: `/private/tmp/praxura-v804-verwaltung`.
- Branch: `redesign/praxura-verwaltung`.
- Ausschließliche Schreibdateien: `design/verwaltung.css`, diese Übergabe.
- Selektiver Gruppe-1-Commit auf diesem Branch (Hash in Liefermeldung/git log).
- Kein Push, Deploy, Live-DB oder Standardwechsel.

## Gruppe 1: Team, Ärzte, Fahrtenbuch

Problem: gemeinsame Neu-Knöpfe erlauben 36 px Höhe; Teamkarten behalten die alte
Hover-Anhebung. Reiter und Fahrzeugkopf brauchen umbrechende Anordnung.

Änderung: 44 px Bedienelemente, vorhandene Tabellen mit 44/60 px Kopf-/Datenzeilen,
ruhige Teamkarten mit vorhandenen Tokens und mobilen Abwesenheitsfeldern. Zusätzliche
Messung belegte 28,6 px hohe Buchungslinks und 31–36 px schmale Ärztesuchfelder bei
390 px; in einer Reparaturrunde auf 44 px hohe Links bzw. ganze Eingabezeilen
korrigiert. GPS-Checkbox bleibt 20 px groß, der native klickbare Labelbereich ist
mindestens 44 px hoch/breit. Bestehende
Inhalte, Renderer, Statusetiketten, Sichtbarkeit und Funktionen unverändert.

Geltung ausschließlich `@media screen`, `[data-design="neu"]` und Nachfahren von
`#panel-team`, `#panel-doctors`, `#panel-fahrtenbuch`. Kein globaler Selektor,
keine Modals, Dokumente, Druck-/PDF-Ansichten oder Startseite.

Vorberatung: `fonksiyon-ustasi` am 28.10.2026, INDEX vom 28.10.2026. Vorhandene
Karten/Knöpfe/Tabellen/Fokus aus `praxura-design.css` und Etiketten aus
`design/seiten.css` wiederverwenden; keine neue Funktion nötig. Erste Nutzung
der neuen CSS-Datei ist CSS-Injektion in der synthetischen Probe, keine Produktverlinkung.

Ausgeführt: sechs statische Scope-/Strukturchecks grün (Neu-/Screen-Grenze,
zugeteilte Panels, keine Root-/Startseitenregel, keine Imports/feste Positionierung,
ausgeglichene Klammern). Vorhandene Scope-/Important-Wachen direkt auf neuer CSS-Datei
grün; `node --test tools/redesign-wachen.test.js` 9/9, keine Skips.
Impeccable `detect --json design/verwaltung.css` ergab `[]` (keine Voll-A11y-Abnahme).

Ausgeführt: `/private/tmp/v804-gruppe1.mjs`, anschließend nach lokaler Reparatur
`/private/tmp/v804-gruppe1-final.mjs`. Nutzt unveränderten bestehenden Harness samt
identisch geprüftem Fixture, liefert ausschließlich diesen Worktree aus und injiziert
CSS nur im Browser. WebSocket-Fence vor Seitenerzeugung, Serviceworker gesperrt,
HTTP-Fence plus Nicht-GET-Sperre auf Kontext- und Seitenhandlern (Seitenrouten haben
in Playwright Vorrang); Fixture-Writes bleiben RS_READONLY. Syntaxprüfung des
temporären Testwerkzeugs mit `node --check` grün.
Sechs Kombinationen: Owner hell1440/dunkel390/hell1024, Employee
dunkel1440/hell390/dunkel1024. Je drei Panels = 18/18 aktive Aufrufe. Text vor/nach
CSS unverändert; kein Dokumentüberlauf; sichtbare geprüfte Buttons, Links, Felder
und Selects mindestens 44×44 px (Checkbox-Ziel = zugehöriges natives Label).
Ein echter Tab-Schritt je Panel mit sichtbarem Fokus; Fahrtenbuchreiter wechseln
ohne Versand/Export/Mutation. Alt-Team hell1440/dunkel390 mit zusätzlichem CSS
pixelidentisch, keine Aussage zu übrigen Alt-Panels.

Gezielte Zusatzprobe `/private/tmp/v804-details.mjs`: 14 Zustände grün
(Owner dunkel390/hell1440 × Teamliste/Abwesenheit/Detail/Detail-Abwesenheit,
Ärztesuche, Fahrzeuge, Berichte). Keine kleinen Zielbereiche oder außerhalb des
Viewports liegenden Kontrollen, kein Dokumentüberlauf. Keine Speicherung ausgelöst.
Sowohl Haupt- als auch Zusatzprobe: 0 Fixture-Schreibversuche, 0 Seitenfehler,
0 Fremdhosts. Keine Fullsuite und keine neue Gesamtbildmatrix.

Portkoordination autorisierte `18084` ausdrücklich statt weiterem Integrator-ACK.
Vor jedem Start `lsof` ohne Listener; jeder eigene Server im finally beendet;
abschließendes `lsof -nP -iTCP:18084 -sTCP:LISTEN` leer, Port freigegeben.
`18081` unberührt. Reproduktion nach erneuter Portkoordination:
`rtk proxy env REDESIGN_PORT=18084 node /private/tmp/v804-gruppe1-final.mjs`.

Nachweise: `/private/tmp/praxura-v804-gruppe1-final/bericht.json` und neun PNGs;
`/private/tmp/praxura-v804-details-final/bericht.json` und zwei Reports-PNGs.
Final gezielt gesichtet: `employee-hell-390-team.png`,
`owner-dunkel-390-fahrtenbuch.png`; vier Vorgängerbilder ergänzend gesichtet.
Keine Referenzbilder im Integrationsworktree verändert.

Unabhängiger nativer Sol-Mobil-/Diffreview (`v804_group1_review`) vor kleiner
Nachkorrektur: kein belegter Produktblocker; Quellscope bestätigt, fehlende Breiten-,
Unteransichts- und Tastaturvollprüfung ausdrücklich markiert. Parent ergänzte
Breiten-/Unteransichtsmessung und kleine CSS-Korrekturen selbst, danach obige
Finalproben grün. Kein zweiter unabhängiger Review des Folgediffs behauptet.

Grenzen: keine vollständige Tastaturreihenfolge/Screenreader-/Kontrastabnahme,
keine echten Rollen/RLS oder Speicher-/Export-/GPS-Aktionen. Fixture kennt
`fahrten`, `vehicles`, `fahrten_monthly_summary` nicht; Fahrtenbuchdaten sind leer,
gefüllte Tabellen/Langdaten nicht abgenommen. Team-Abwesenheiten ebenfalls nur
vorhandene synthetische Zustände. Hover-Aufhebung quellengeprüft, kein separater
Hover-Bildvergleich. Kein Nachweis der späteren Produktverlinkung/Cacheauslieferung.

## Gruppe 2: Notizen, Feedback, Beispielmodus

Schriftlich konkretisierter Folgeauftrag: ausschließlich Nachfahren von
`#panel-notizen`, `#panel-feedback`, `#panel-beispielmodus`, weiterhin nur
`@media screen` und `[data-design="neu"]`. Vorbereitete B2B/B2C-Deltas vollständig
entfernt; übrige sechs Panels bleiben ausgenommen.

Tatsächliche Basis dieses Folgecommits:
`a808a1104e86427bffa4ee6dade5a508e75b4ebd`. Bereits vor der jüngsten Koordination
war der zuvor saubere eigene Branch darauf aktualisiert worden; Git erkannte
`abb3c38a` als bereits upstream integriert. Kein Reset, keine Übernahme fremder
uncommitteter Dateien. Gruppe-1-CSS bleibt bytegleich.

Problem und Delta: 44-px-Bedienelemente und Patientenauswahlzeilen, umbrechende
Notizaktionen/Feedback-Köpfe, neutrale Feedback-/Adminantwortflächen statt altem
Akzentbalken. Vorhandene Tokens, Status-Badges, Fokusregeln und monochromes
Demo-SVG wiederverwendet. Keine neue Produktfunktion oder fachliche Semantik;
bestehende Funktionsberatung gilt weiter.

Temporäre Probe `/private/tmp/v804-gruppe2.mjs`: bestehender hashgleich geprüfter
Harness und synthetische Fixture. HTTP-/WS-Fences vor Page, Serviceworker gesperrt,
Nicht-GET-Sperre auch vor Seitenhandlern, Fixture-Writes weiter RS_READONLY.
Kein Feedbackversand, Notizspeichern, AI-Aufruf oder externer Demo-Link ausgelöst.
Port 18084 nun ausdrücklich für diese Gruppe bestätigt; vor Start erneut frei.

Ausgeführt: Syntaxprüfung des temporären Werkzeugs, bestehende Scope-/Important-/
Auslieferungswachen 9/9 ohne Skips, Impeccable-Regexprüfung `[]`, `git diff --check`.
Zusatzprüfung bestätigt Gruppe-1-CSS nach Entfernung des neuen Blocks bytegleich
zu HEAD; neuer Block ausschließlich drei zugeteilte Panels, keine neuen Important-Regeln.

Finale Browserprobe: 28/28 Zustände, vier identische Alt-Pixelproben.
Sechs Kombinationen: Owner hell1440/dunkel390/hell1024 sowie Employee
dunkel1440/hell390/dunkel1024. Je drei Panels plus per Tastatur ausgewähltes
Notizformular = 24 Zustände. Zusatz: offener Patientenauswahlliste und langes
synthetisches Feedback-Markup jeweils Owner hell1440/dunkel390 = vier Zustände.
Feedback-Markup verwendet vorhandene Rendererklassen ausschließlich zur
Geometrieprüfung; es stammt nicht aus DB-Antworten. Bekannte `feedbacks`- und
`patient_notes`-Fixture-Lücken bleiben bestehen, kein Datenvertrag daraus abgeleitet.

Gemessen: Notiz-Suche zuvor 41 px, Feedback-Senden 36 px, Demo-Link rund 36 px,
Patientenauswahl mit zu kleinen Zeilen. Nachher alle geprüften sichtbaren
Bedienelemente und Auswahlzeilen mindestens 44×44 px; kein Dokumentüberlauf oder
horizontal außerhalb liegende geprüfte Kontrolle. Paneltext vor/nach CSS gleich.
Vorhandene Statuslabels bleiben unverändert. Feedback-/Adminantwortfläche gemessen
weiß in Hell, Tokenfläche rgb(20,23,29) in Dunkel.

Tastatur: vorhandene Patientenauswahl über ArrowDown/Enter öffnet lesend Formular;
danach Tab-Schritte durch sichtbare aktivierte Formularkontrollen, Fokus jeweils im
Panel mit vorhandenem Outline. Keine aktivierende Taste auf Speicher-/Versandknöpfen.
Keine vollständige Screenreader-/Fokusfallen-/A11y-/Kontrastabnahme. Rollen synthetisch,
keine RLS-/Liveaussage. Alt-Kontrolle ausschließlich Notizen/Feedback je Hell1440 und
Dunkel390; keine vollständige Alt-Regression. Demo-Link nicht geöffnet.

Alle geprüften Kontexte: keine Fixture-Writes, Seitenfehler oder Fremdhosts.
Bericht `/private/tmp/praxura-v804-gruppe2/bericht.json`, sechs PNGs im selben Ordner.
Gezielt gesichtet: `fixture-beispielmodus.png`, `selected-notizen.png`,
`picker-notizen.png`, `synthetic-long-markup-feedback.png` (Dunkel390).
Keine Referenzbilder verändert. 0 Reparaturrunden wegen Produktfehlern erforderlich;
kleine unbelegte Demo-Umbruchregel vor Finalprobe entfernt.

Jeder Server im finally beendet; abschließendes
`lsof -nP -iTCP:18084 -sTCP:LISTEN` leer. Port18084 hiermit freigegeben,
18081 unberührt. Erneute Reproduktion nur nach neuer Portkoordination:
`rtk proxy env REDESIGN_PORT=18084 node /private/tmp/v804-gruppe2.mjs`.

Unabhängiger nativer Sol-Review durch vorhandenen Mobil-/Diffreviewer:
kein belegter Produktblocker, Scope und Tokenwiederverwendung bestätigt.
Bericht und Picker-/Feedback-PNG bei 390 px gegengeprüft. Nachweisgrenzen:
keine paarweisen Kollisionsmessungen; keine gesonderte Trefferzahl oder vollständige
Rechteckliste der Pickerzeilen im JSON. Sichtbare Treffer im PNG; Messprüfung
berücksichtigt vorhandene sichtbare li[data-id], erzwingt deren Anzahl jedoch nicht.
Kein zweiter Review oder Gruppe-1-Neutest ausgeführt. Selektiver Gruppe-2-Commit
auf eigenem Branch; Hash in Liefermeldung/git log.

## Weitere Gruppen

Noch nicht gebaut: Statistik, Überblick, B2B/B2C,
Podologie-Behandlungen und Abrechnung. Bereits gelöste Neu-Bausteine nur durch
belegte Deltas ergänzen. Fachflächen nach gezielter gkv-302-/podoloji-Beratung;
DATEI_STATUS und vorhandene Statusetiketten nicht pauschal übersteuern.

## Integration

Gruppe 1 bereits zentral integriert. Nur neuen Gruppe-2-Commit selektiv übernehmen;
bestehende Integratoränderungen nicht kopieren.
CSS-Link/Cache, Dashboard, Auslieferung/Docker, STATUS/PLAN/INDEX und Referenzbilder
bleiben ausschließlich beim Integrator. Diese Datei meldet keinen V8-/V9-/Live-/RLS-
oder Releaseabschluss.
