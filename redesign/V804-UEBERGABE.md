# V8.04 — Verwaltungsansichten

Stand: Gruppe 1 lokal geprüft und selektiv zur Integration übergeben. V8.04 insgesamt offen.

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

## Weitere Gruppen

Noch nicht gebaut: Statistik, Notizen, Überblick, B2B/B2C, Feedback, Beispielmodus,
Podologie-Behandlungen und Abrechnung. Bereits gelöste Neu-Bausteine nur durch
belegte Deltas ergänzen. Fachflächen nach gezielter gkv-302-/podoloji-Beratung;
DATEI_STATUS und vorhandene Statusetiketten nicht pauschal übersteuern.

## Integration

Nur Gruppe-1-Commit selektiv übernehmen; bestehende Integratoränderungen nicht kopieren.
CSS-Link/Cache, Dashboard, Auslieferung/Docker, STATUS/PLAN/INDEX und Referenzbilder
bleiben ausschließlich beim Integrator. Diese Datei meldet keinen V8-/V9-/Live-/RLS-
oder Releaseabschluss.
