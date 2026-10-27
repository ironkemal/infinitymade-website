# V6.F06 — gezielter unabhängiger Frontend-Prüfauftrag

Prüfstand: `c7fcf75ef56a72712f762e23c60ca08b15439975` (F06), direkt auf Backend-Integration `d86fe7c576f231540eaea3a426f71e0c7d0abb9b`. Spätere Pakete `499dbf5d` und `cffbe0ee` gehören nicht zu diesem Prüfstand.

## Auftrag und Grenzen

Prüfe ausschließlich die Darstellung und Frontend-Anbindung der B08-Tagesverfügbarkeit und Owner-Wochenbelegung. Nur lesen und isolierte synthetische Proben; keine Produktänderung, keine zusätzliche Delegation, kein Server-Bootstrapimport, keine echten Daten/Zugangsdaten/DB-/Google-/externen Netzaufrufe, kein Push/Deploy. Bisherige exklusiven Dateigrenzen bleiben bestehen. Befunde als konkrete Repros mit Schweregrad und `file:line`; Quell-/Test-/Rendernachweis getrennt ausweisen. Ein fehlgeschlagener delegierter Review ist kein Urteil.

## Kleine Quellmenge

- `module/startseite-verfuegbarkeit.js` und `.test.js`: reine DTO-Renderer, Rollen-/Pfadprüfung, Fetch und Abbruch.
- F06-Diff von `module/startseite-neu.js`: Scope, getrennte Kartenstände, Refresh, Fehler/Altstand, Fokus und offene Details.
- F06-Diff von `dashboard.js`: `neuKontext`-Namen ausschließlich aus vorhandenen Caches; kein zusätzlicher Datenlader.
- `design/startseite.css`, Cache-Kette `dashboard.html` → `dashboard.js` → `neu-start.js` → `shell-neu.js` → `startseite-neu.js`; `tools/redesign-harness.mjs` nur als synthetische Testquelle.
- Backend-B08 nur als feststehender DTO-Vertrag; dieser Auftrag behauptet keine zusätzliche Buchungs-/Engine-/Echtkalenderabnahme.

## Pflichtfälle

1. Tageskarte zeigt belegte `freiMin`/Intervalle und tatsächliche Startzeugen je Behandler. Keine Rechnung `Slotanzahl × Dauer`, kein Puffer als Behandlungszeit, keine Buchbarkeitsgarantie. Gruppenreststart bei `freiMin:0` bleibt getrennt; Anzahl möglicher Starts ist keine Sitzplatzanzahl.
2. Owner bekommt Tag und Woche; Employee nur eigenen Tag, keine Wochenkarte und kein Wochenabruf. Employee-Wochenversuch vor Session-/Netzzugriff abweisen. Fremde Employee-DTOs sowie alte Owner-/User-Ergebnisse nach Scopewechsel dürfen nicht erscheinen; verspätete Antworten gezielt prüfen.
3. Woche nutzt ausschließlich `gebuchtMin`, `arbeitsMin`, `quote` des Servers; Montag–Sonntag/alle Standorte und externe Belegung korrekt bezeichnet. Bekannte `0/0` mit `quote:null` bedeutet keine Arbeitszeit; Unknown/DST/fehlende Basis wird niemals `0 %`.
4. Laden, bekannt leer, Quellen-Unknown, HTTP-/Transportfehler und ungültiges DTO unterscheiden. Nach Transportfehler alten Stand sichtbar kennzeichnen; neue Quellen-Unknown-Antwort ersetzt vorherige gültige Zahlen. Langsame/hängende Woche blockiert fertigen Tag nicht; 30s-Abbruch und begrenzter Refresh ohne Requestflut.
5. Labels escaped, keine Rohfehler/PII aus Antwort anzeigen, keine erfundenen Namen. Datenbank- oder zweite Slotlogik im Client ausschließen. Auth bleibt serverseitig maßgeblich.
6. Tastatur: Startdetails mit Enter öffnen, Summary mindestens 44px; Fokus und offene Details nach Refresh erhalten. Owner/Employee, hell/dunkel, 390/1440px; 360/768/1024px gezielt für Überlauf. Original-Gaps bleiben an alter DOM-Stelle. Alt-Ansicht und Kalender-Einstieg erhalten.

## Vorhandene Evidenz, unabhängig zu bewerten

- Parent: `node --test module/startseite-verfuegbarkeit.test.js` → 7/7; Fullsuite → 4.689 pass / 1 bestehender Skip / 0 fail.
- Parent: 14 synthetische Browserfälle, Overview-Klick-Smoke beider Rollen 1440/390 ohne Funde; 27 Alt-Ansichten hell1440 pixelgleich, übrige81 Referenzfälle nicht in diesem Teillauf.
- Lokale Hilfen (nur sofern noch vorhanden): `/tmp/praxura-verf-ui.mjs`, `/tmp/praxura-verf-ui.log`, `/tmp/praxura-verf-ui/`, `/tmp/praxura-f06-npm.log`. Vor Nutzung gegen gepinnten Stand prüfen; fehlende temporäre Artefakte sind kein Prüfnachweis.
- Bereits vorhandene begrenzte Fach-/Security-/Onprem-Quellberatung und Sichtung von sechs PNGs ersetzen diese unabhängige Frontendprüfung nicht. Browsernachweis bei Bedarf ausschließlich mit synthetischem Harness, eigenem freien Loopback-Port und gesperrten Fremdhosts; keine vorhandenen Ansichtsports übernehmen.

Ergebnis: konkrete Restblocker oder begrenztes ACK mit tatsächlich ausgeführten Fällen und ausdrücklich ungeprüften Grenzen. Kein Live-, Kundeninstallations- oder Releaseurteil.
