---
titel: Ops-Fortsetzung — falsche Ablaufregel, Billing-503 und Box-Dokumentation
datum: 2026-10-22
typ: sitzung
ticket: "Ops #340 / #24 / #332 / #26 / #25"
tags: [sitzung, ops, preflight, billing, auth, onprem, fortsetzung]
---

# Ops-Fortsetzung

Arbeitsnotiz, keine amtliche Quelle. **Fortgeschrieben am 23.10.:
#340, #332-Dokumentation, #26-Lokalnachweis und Ops-Formular lokal abgenommen;
#24 nach Reviewkorrektur ebenfalls lokal abgenommen. Keine Live-/Lieferfreigabe.**

## Ausgang und begrenzter Auftrag

Alle 336 Ops-Karten anhand vollständigen Statusabgleichs eingeordnet. Frische
Chrome-DOM-Zählung am 22.10.: 270 erledigt, 53 offene Einzelpunkte, 13 offene
Sammelkarten. Historische Häkchen sind keine erneute Liveabnahme.
Plan: `konsey/tutanak/2026-10-22-ops-fortsetzung.md`, vollständige A–E-Matrix
und konkrete externe Blocker. Lokal autorisiert, keine Veröffentlichung/DB-/Geld-/Versandaktion.

## #340: warum die pauschale Ablaufregel falsch war

`api-backend/billing/dta/preflight.js` sperrte Nicht-Podologie-Leistungen ab Tag 85
nach Ausstellung mit `S:01012`, ohne Verordnungsart zu unterscheiden. gkv-302/
wissensbank bestätigten anhand Original HeilM-RL iK 05.08.2025, §§7 Abs.6/7 und
13a Abs.2: Mengenbemessung und konkrete Gültigkeitsregeln tragen diese pauschale
Sperre nicht. G-BA-Veröffentlichungsindex am 22.10. nennt unverändert diese Fassung.
Originalbezüge stehen in `api-backend/billing/dta/REGELN.md`.

Sieben neue Regressionen vor Fix fehlgeschlagen (95 bestanden/7 fehlgeschlagen).
Nur pauschaler Block und aktiver Klassifikationseintrag entfernt; keine Ersatzfrist,
keine neue Abrechnungsfreigabe. Unverändert: übrige Datums-, Unterbrechungs- und
Podologieprüfungen. Letzter vorhandener ICD-Test lag hinter `process.exit`; Abschluss
an echtes Dateiende versetzt, damit auch dieser Test ausgeführt wird.
Danach 102 interne Preflightfälle, fünf Schweregates und 37 interne DTA-Smokes grün.
Node zählt die beiden alten dateiinternen Runner jeweils als einen Test; Zahlen
nicht zu einer irreführenden Node-Gesamtzahl addieren. Unabhängiger Review r2:
APPROVE, keine Findings; eigene Läufe und 16 zusätzliche synthetische Gegenproben.
Beide regulären DTA-Wege nutzen den bestehenden gemeinsamen Preflight.

## Billing-503 und Box-Dokumentation

Frontendloader reichen Katalogfehler als technische Ladefehler weiter; bestehender
Map-/Array-Vertrag bleibt. Review r1 fand zwei nicht abgedeckte Fälle: Frontendpreis
blieb trotz 503 kassierbar; Detail zeigte Null-/Teilsummen als Gesamtbetrag. Neue
Regressionen zuerst 7 rot/21 grün; danach 28/28 und zusätzlicher Belegfall 29/29 grün.
Technischer Fehler aktiviert vorhandene Sperre; unbekannte Beträge erscheinen als
„—“, verifizierte 200-Zeilen und gespeicherte Preise bleiben erhalten. Zweite
unabhängige Gegenprüfung APPROVE, keine offenen Findings; selbst 29 Tests und
26 zusätzliche Szenarien geprüft. Hauptagent: 4×133 Chromiumchecks bei 390/1280 px,
hell/dunkel; keine Writes, externen Requests oder Überläufe.
Kein Refresh-/Retry-/Auth-Bypass; lokale Fehlklassifikation erklärt Live-401 nicht.

Onprem-Dokuworker schrieb nur Release-Standard, Playbook und O-213/O-214 im Register:
Beta-Installer stoppt unter 15 GB, warnt zwischen 15 und 39 GB. 40 GB sind
Planungsempfehlung, keine belegte Kundenkapazität. Updater unverändert 8 Prozent.
Vorhandener Hinweis für unsicheren Android-Kontext als geschrieben berichtigt.
Quellvergleich und Diffprüfung durch Worker und Hauptagent bestanden; echte
Kapazitäts-, Geräte-/Updateprüfung bleibt offen.

## Weitere lokale Teilabschlüsse

- #26: bestehende Installationshilfe, QR-/Manifestwege vorhanden. 12 Nodefälle und
  zehn Chromium-Szenarien mit synthetischer Plattform bei 390/1280 px grün. Kein
  Service Worker, kein Offlineversprechen, keine tatsächliche OS-/Geräteinstallation.
- #25: `konsey/tutanak/2026-10-23-ops-25-intro-storyboard.md`, zehn Szenen, Ziel 330
  Sekunden, 641 Sprecherwörter, 59 geprüfte Referenzen. Keine Mediendatei. Isolierter
  Aufnahmebuild/Testbestand, Geräteweg, tatsächlicher Ablauf und Box-FAQ offen.
- `OPS-NOTIZ-BLOCKER-20261023`: Notizänderung entfernte erledigte Voraussetzungen,
  weil Auswahloptionen fehlten. Bestehendes `todoForm→readForm→editTodo` erhält nun
  gewählte erledigte Aufgaben; Selbst-/Kindgrenzen und bewusstes Abwählen bleiben.
  Vier Tests, DOM/Edit 390/1280 sowie unabhängiger Review APPROVE. Bestehendes
  UUID-Array, keine Schemaänderung, keine echte DB-Persistenz behauptet.

## Wiederaufnahme und Grenzen

Stündlicher T3-Trigger war an denselben Thread gebunden; vor jedem Lauf Git und aktive taskIds geprüft.
Zwei Kindaufträge endeten am Nutzungslimit mit Resetmeldung 23.10. 01:28 AM.
Am 23.10. 02:09 Berlin Wiederanlauf, kein Providerwechsel und keine Limitumgehung.
HEAD weiterhin 9b173772; gecachtes origin/main 6fd0cce3 liegt drei Commits voraus.
Kein Pull/Reset oder Übernahme fremder Änderungen. Fortschritt nach Datum:
`fortschritte/2026-10-22.md` und `fortschritte/2026-10-23.md`.

Board am 23.10. erneut nur lesend gezählt: weiterhin 336 Karten, 270 erledigt,
53 offene Einzelkarten, 13 offene Sammelkarten. Keine Status-/Notizänderung gespeichert.

Kein Live-Speichern, keine Kassenannahme, keine echte Boxinstallation oder
Geräte-/Offlineabnahme. Tests und letzte offene Schritte: Tagesdatei und Plan.

## Abschluss am 23.10., 02:35 Berlin

Alle ausführbaren lokalen Pakete abgenommen. Vier Gesamtsuiten: Frontend2181,
Backend1625, Tools288, Merkez107 — 4201 registrierte Nodefälle bestanden, keine
Skips; Typecheck, alle 14 Browserrunner, Karte und neun Projekt-Gates grün. Eigene
Prüfwerkzeugfehler (PDF-/Font-Allowlist und Leerzeichen im Preloadpfad) getrennt
dokumentiert und repariert. Keine Schutzprüfung abgeschwächt.

Aktuelle Matrix A1/B0/C20/D20/E13; C-/D-Reste brauchen konkrete externe Schritte,
E-Auslöser fehlen. Teilnotizen für fünf Karten im Plan vorbereitet, Liveboard
unverändert. Scheduler bestätigt deaktiviert (`enabled=false`, `nextRunAt=null`),
eigener Loopback-Testserver gestoppt, keine aktiven Kindaufträge. Kein Commit,
Push, Deploy oder Produktionsschritt. Upstreamintegration der drei vorliegenden
Trackingcommits bleibt vor Veröffentlichung gesondert nötig.

## Folgeauftrag am 23.10. ab 08:11 Berlin

Nutzer beauftragt erneute praktische Code-/Dashboardprüfung und ausdrücklich
Ops-Abhaken vollständig erledigter Karten sowie Wissensspeicherung. Neue Freigabe
betrifft Statuspflege; kein Push/Deploy, keine echten Praxis-/Patientenschreibtests
oder Konten-/Geld-/Versandaktionen. Gitstand und uncommittete Quellstände unverändert.

Erneuerte gezielte Codeprüfung: 102 interne Preflightfälle, 84 Billing-Auth-Vertragstests
und 29 Billing-UI-Regressionen grün; unveränderte Gesamtsuiten nicht wiederholt.
Neuer isolierter Test für echtes `dashboard.html` samt Boot und normalen Klickwegen
ist in Arbeit. Synthetische SDK-Modulroute ist Testadapter, keine Produkt-Authumgehung
und kein Nachweis echter DB-Persistenz oder Liveauth.

#25: neuer interner `konsey/tutanak/2026-10-23-ops-25-box-faq-entwurf.md`, zehn Fragen,
83 geprüfte Referenzen. Bei Quellvergleich Dokumentdrift gefunden: Box zeigt
„Support kontaktieren“ per Mailprogramm, statische SaaS-Ticketansicht wird ersetzt.
Storyboard-Szene10 entsprechend repariert; nach Zählprüfung weiter330 geplante
Sekunden, nun643 Sprecherwörter/62 Referenzen. Video und Zielbuild-/Geräteabnahme offen.

#340: tatsächliche Ops-Karte verlangt quellenbasierte oder entfernte/weiche Regel
plus grüne Preflighttests, keine Auslieferung als eigenes Kriterium. Frühere
pauschale Releaseabhängigkeit im lokalen Plan war strenger. Parent im nur gelesenen
Formular leer; geplantes Abhaken am tatsächlichen Codekriterium messen. Noch kein
Häkchen oder Notiz gespeichert.

Ops-Feldschutz bleibt relevant: Liveformular kann erledigte Voraussetzungen verlieren.
Connector hat kein Ops-Projekt, direkte Tabellenoberfläche verlangt Anmeldung;
keine Credentials gelesen. Ohne unabhängigen vollständigen Blockerbestand keine
Karten-Notizänderung. Wissensbankoberfläche verfügbar; Eintrag für diesen Folgeauftrag
noch nicht vorhanden und noch nicht angelegt. Vorgesehen: Ergebnisse dort gesammelt
mit klaren lokalen/live Grenzen speichern, neue Teilstände nicht als Gesamtabschluss.

Bestehender stündlicher Scheduler reaktiviert, nächster gemeldeter Lauf09:15:21Berlin,
gleicher Thread und Duplikatschutz. Aktive taskIds und Dateibesitz im Plan.

Fortschreibung: #340 jetzt am tatsächlichen Codekriterium auf Ops abgehakt. Nach Reload/Archiv vollständig geprüft: 336 Karten/271 erledigt/52 offene Einzelkarten/13 offene Gruppen; ausschließlich #340-Doneflag geändert, kein Parent. Karten-Notizen unverändert, keine Auslieferung oder Livewirkung behauptet. Matrix A2/B0/C19/D20/E13. Frühere strengere Release-Abhängigkeit gilt nicht als zusätzliches Kartenkriterium.

Dashboard-Testgerüst fertig: 13/13 echte lokale Boot-/Klickfälle, 257 Assertions und 27 Adaptergrenzprüfungen; 80 referenzierte Screenshots. Bewusste 503→200-Wiederöffnung, ohne AutoRetry im 500-ms-Beobachtungsfenster. Quellen mit SHA-256 dokumentiert; reine synthetische SDK-/HTTP-Grenze, keine Produktdateiänderung dieses Folgeauftrags. Hauptagent sah 503-Mobilgeld und 200-Desktopdetail. Anfangsfehler im Fixture korrigiert und als solche dokumentiert; kein neuer Produktfehler belegt. Unabhängige Gegenprüfung läuft. fonksiyon-ustasi quittiert Absicht/ersten Verbraucher; Funktionskarte unverändert 3803/476. Bericht: Claude outputs/2026-10-23-ops-dashboard/REPORT.md.

Offener Reviewrest OPS-DASHBOARD-WS-20261023: HTTP-Zaun protokolliert WebSocketversuche nicht. Kein natürlicher Versuch in13Dashboardfällen; Reviewer-Gegenprobe separat vor Transport isoliert. Testwerkzeug wird um explizite WebSocket-Sperre mit rein lokalem Loopback-Nachweis ergänzt, danach vollständiger Nachlauf und neue unabhängige Abnahme. Keine Produktdateiänderung. BOM-Abweichung im Reviewer-Textvergleich war ausschließlich UTF-8-Dekodierung, Inhalt identisch.

Reviewr1 abgeschlossen: REQUEST CHANGES wegenWebSocket-P2 am Testnetzguard. Eigene63 Klickchecks,27 Adapterprüfungen,6 Fixture-Gegenchecks,3 HTTP-Sperrproben und2 Überdeckungskontrollen grün. Kein neuer Produktfehler. Reparaturauftrag aktiv, endgültige Abnahme erst nach neuer Reviewrunde.

## Wiederaufnahme13:16Berlin und WS-Reparatur

Gemeldeter Reset13:11 abgewartet; fehlgeschlagener Worker hat keine aktiven Kinder mehr. HEAD9b173772, Tracking6fd0cce3, echter Index leer, Arbeitsbaum/Worktrees erhalten. Hauptagent übernahm gesicherten Teilstand, ohne zweite Implementierung oder Providerwechsel. Vorherige eigene Server-/Testprozesse waren beendet; sichererServer neu gestartet.

OPS-DASHBOARD-WS-20261023 lokal geschlossen: Testhelper vor Seitenerstellung für beide Kontexte, ohne connect_to_server. Loopback-Kontrolle1Transport/Handshake, geschützt0/0 und Policyclose1008; Versuch protokolliert. Rot28/31 mit drei neuen Fehlern, Grün31/31. Absichtlicher unerwarteter lokaler WS macht normalen Klickfall rot. Erster Syncclose hing; vorhandene async/greenlet-Brücke löst Callback-Schließung, keine Installation. Nur neuer Testworkerpfad geändert, keine Produktdatei.

Hauptagent nach Reset erneut13/13 echte lokale Boot-/Klickfälle mit257Checks und31Boundaryprüfungen grün;226 geladene Quellen und Testquellen SHA-gleich. NeunProjektgates Exit0 am31-Pfade-Prüfindex, Baselinesgleich/echterIndexleer. Unabhängige Reviewrunde r2 läuft unter neuem tatsächlichem Präfix0b5a6b43-ee37-482c-a7b1-214b4ed4ac98; genaueID im Plan. Noch keine endgültige Werkzeugabnahme oder neuer gespeicherter Ops-Wissenseintrag. Alter Livebrowser-Tab war nicht angebunden; frischer eigener Ops-Tab nutzt vorhandene Anmeldung. Duplikatprüfung0/1, alter Wissenseintrag gesichert, eigener Entwurf vorbereitet.

## Schlussreview13:23Berlin — lokal abgeschlossen

Neue unabhängige Reviewrunde r2 terminal APPROVE, R1-P2 geschlossen und keine neuen Findings. Eigenständig83 Klickassertions,31 Boundarychecks, korrekt roter normaler Fall mit unerwartetem lokalem WebSocket (0Transport/Policyclose1008) und24 parallele WS-Sperrproben bestanden.228 Quellhashes stabil, ursprüngliche27Assertions bytegleich. Intentmeldung quittiert. Hauptlauf13/13 mit257Checks,31Boundary, neunProjektgates grün. Alle autorisierten lokalen Implementierungs-/Prüfpakete fertig; Wissensbank-Speicherung und operative Abschlussdoku noch ausstehend. Keine neue Produktänderung oder Live-/DB-/Auth-/OS-/Boxfreigabe.

## Endgültiger Abschluss nach Folgeauftrag — 23.10.2026

- [x] ~~Alle autorisierten lokalen Pakete implementiert, synthetisch geprüft und unabhängig abgenommen.~~ Vollständiger Dashboard-Nachlauf 13/13, 257 Klickchecks und 31 Boundarychecks grün; Review r2 APPROVE mit 83 eigenen Klickassertions, korrektem roten WS-Negativfall und 24 parallelen Sperrproben. Produktstand der zuvor bestandenen 4201 Nodefälle/Typecheck/14 Browserrunner unverändert. Kein tatsächlicher Praxis-/DB-/Authserver-/OS-/Box-/Liveabschluss behauptet.
- [x] ~~Zulässige Ops-Pflege und Wissensspeicherung erledigt.~~ #340 nach tatsächlichem Codekriterium geschlossen; frisch erneut 336 Karten/271 erledigt/52 offene Einzelkarten/13 offene Gruppen, Parent unberührt. Ergebnistext auf Ops-Wissensbank unter ID 3fddecc5-b572-48bd-9bd3-09148953071c gespeichert, nach Reload Titel/Markdown exakt verglichen. Vorhandener Eintrag f7ecbd5a-1e23-4f10-b450-26741517e6a7 in Titel/Inhalt unverändert. Andere Kartennotizen wegen unvollständigem Blockerbestand nicht überschrieben. Aktuelle Einzelmatrix A2/B0/C19/D20/E13.
- [x] ~~Vollständigen Dokument-Belegsatz lokal gesichert.~~ Neun ausgewählte Dokumente/Manifest/Screenshot plus Hashmanifest im ZIP Claude outputs/2026-10-23-ops-fortsetzung/ops-wissen-belege-2026-10-23.zip, 444868 Bytes, SHA-256 8285a4cb0715fe65ef835319872811f7511f40602845831293a4e864f88e9630; CRC-Prüfung bestanden. Momentaufnahme vor operativen Schlussnachträgen, keine amtliche Quelle. Gespeicherte Wissenskarte als Screenshot ops-wissen-gespeichert.jpg; erster falsch skalierter Ausschnitt separat als ausschnittversuch erhalten, kein Abnahmenachweis.
- [ ] Cloudanhänge bleiben konkret extern blockiert: Chrome-Dateizugriff für Erweiterung deaktiviert; nativer Dialog liefert cgWindowNotFound. Keine Erweiterungsberechtigung geändert oder Schutzkontrolle umgangen. Ergebnistext trotzdem zentral gespeichert; Originaldokumente und Belege vollständig lokal vorhanden. Späterer ZIP-Upload benötigt funktionierenden autorisierten Dateidialog.
- [x] ~~Unbeaufsichtigten Scheduler ordnungsgemäß deaktiviert.~~ Toolbestätigung am 23.10.2026 um11:30:50UTC/13:30:50Berlin: enabled=false, nextRunAt=null; kein nächster Lauf. ID und Historie bleiben im Plan. Eigenen sicheren Server in Terminal55965 per Ctrl-C beendet. Reviewr2 terminal completed ohne aktive Kinder; kein weiterer lokaler Auftrag offen.
- [ ] Übrige Grenzen: Veröffentlichung/Liveursache, echte Geräte-/Upgrade-/Kapazitäts-/K3-/Stable-Abnahme, Zertifikate/Kassenannahme/Versand sowie Betreiber-/Vertrags-/Produkt-/Schemaentscheidungen oder ausdrücklich fehlende Bedarfsauslöser laut Matrix. Vor späterer Veröffentlichung drei Tracking-Upstreamcommits gezielt integrieren und erneut prüfen. Kein Push/Deploy, kein Pull/Reset/Rebase/Stash, keine produktive Migration, Löschung, Geld-/Versand-/Kontenaktion oder echte Daten.

Git bleibt main/HEAD9b173772/Tracking6fd0cce3. Eigene 31 Prüfpfade explizit benannt, echter Index leer; fremde Änderungen und Worktrees erhalten. Vollständige ausführbare Arbeit abgeschlossen; nächste Aktion erst nach konkret fehlendem Zugriff/GO/Abnahme oder neuem Auftrag.

## Erneuter Folgeauftrag 23.10., 21:36 Berlin — O-218 lokal abgeschlossen

Drei bereits vorhandene Trackingcommits `5bb3ecfb`, `4ad90750`, `6fd0cce3` gezielt im Arbeitsbaum abgeglichen. HEAD 9b173772 und Tracking 6fd0cce3 unverändert, echter Index leer; keine Übernahme in Git-Historie, kein Fetch/Pull/Merge/Commit/Push/Deploy. Pflichtberatung onprem/fonksiyon-ustasi/Sicherheit vor Umsetzung abgeschlossen, vorhandenen Updaterweg wiederverwendet. Neue Funktionen, Dienste, GB-Schwellen oder Migrationen nicht erforderlich.

Baseline lehnte bytegleichen Hotfix ab und kopierte bei echtem Konflikt alte Kundenfassung. Tracking korrigierte beides, unterdrückte aber Kopierfehler und entfernte Zusammenführungsvorlagen vor Compose/Health. Reparatur: neue Bundlefassung vollständig per mktemp/cp/GNU-mv atomar sichern; Fehler sichtbar, vorherige gute Vorlage erhalten. Cleanup ausschließlich im bestehenden `sonuc=ok`-Zweig nach erfolgreicher Anwendung, nicht bei Rollback oder `schema_fehler`.

Zusatzbefund **ONPREM-O218-CLEANUP-STATUS-20261023**: fehlgeschlagenes rm verschluckte nach erfolgreicher Anwendung die Statusschreibung. Echte Quellblock-Gegenprobe 19 grün/1 rot; nach Warnung statt Abbruch dieselbe Probe 20/20 grün. Vorlage bleibt erhalten, weitere Manifestpfade werden bearbeitet, korrekter ok-Status erreicht. Nichtleere Restverzeichnisse werden nicht rekursiv gelöscht.

Finale identische 21er-Suite: drei Textprüfungen und 18 ausführende Shellfälle; HEAD 6 grün/15 rot, Tracking 9 grün/12 rot, Fix 21/21 grün, keine Skips. Tools-Gesamtsuite 309/309 grün; Bash-Syntax, Diffcheck und neun Projektgates bestanden. Manifest regulär generiert, nur Updaterhash geändert, Version 0.7.1 unverändert. Funktionskarte 3803/476 frisch: nur sechs Positionswerte dreier bestehender Shellfunktionen verschoben. Dashboardquellen unverändert zur abgenommenen 13er-Klickmatrix.

Unabhängiger Review: begrenztes **APPROVE**, keine Findings. Reviewer führte 21er-Matrix selbst und 17 weitere Gegenproben aus, darunter Symlink-/Verzeichnisziele, Mehrdateikonflikte, tatsächliche Health-/Rollback-Verzweigungen sowie Basisledger. fonksiyon-ustasi-Intent quittiert. Nur extrahierte Produktionsblöcke und synthetische Temporärdateien, frische Befehls-/Env-Whitelist; kein voller Updater, keine echten Dienste, Daten, Box-/DB-/Authserver-/Linux-Upgradeabnahme. Frühe JS-Fixturesyntax, Werkzeugpfad/GNU-BSD-Unterschied und Reviewer-Zeilenendeproblem waren getrennte Fixture-/Umgebungsfehler, keine weiteren Produktbefunde.

Historische Register-/Tageslogergänzungen separat zusammengeführt. Vorheriger Registerbestand einschließlich O-213/O-214 und Tageslog-Prefix hashgenau erhalten; `upstream-final-doc-preservation.json`. Quellen, reproduzierbare Befehle und Prüfgrenzen in `Claude outputs/2026-10-23-ops-fortsetzung/upstream-final-report.md`; unabhängiger Review daneben. Historische 19er-Workerübergabe bleibt erhalten, nach Hauptgegenprobe gelten aktuelle 21er-Belege.

Ops lesend frisch: „Alle 52“, #340 weiterhin erledigt, #332 offen. Karte verlangt echte Box/K3/Neuinstallation/Upgrade/Stable; keine neuen Haken oder Kartennotizschreibvorgänge. Eigener Wissenseintrag `3fddecc5-b572-48bd-9bd3-09148953071c` um Nachtrag ergänzt und nach Reload Markdown exakt verglichen; Titel/Tags und anderer Eintrag unverändert. Cloudanhänge unverändert extern blockiert, keine Erweiterungsberechtigung geändert. Übrige Matrix hat ausschließlich externe Entscheidungen/Abnahmen oder unbelegte Auslöser. Bestehender stündlicher Scheduler war für neuen Nachlauf reaktiviert; operativen Schlusszustand nach Wissenspflege gesondert bestätigen.


## Operativer Abschluss des Updater-Nachlaufs — 23.10.2026, 21:58 Berlin

- [x] ~~Lokales #332/O-218-Paket vollständig umgesetzt und abgenommen.~~ 21 Prüffälle (3 Text/18 Shell), Tools 309/309, unabhängiger Review APPROVE mit 17 zusätzlichen Gegenproben, Bash-Syntax/Manifest/Funktionskarte/neun Gates grün. Keine offenen lokalen Findings. Absichtsmeldung an fonksiyon-ustasi quittiert.
- [x] ~~Wissenspflege lokal und zentral gesichert.~~ Eigener Ops-Wissenseintrag ergänzt und nach Reload Markdown exakt verglichen; Titel/Tags sowie vorhandener anderer Eintrag erhalten. Vollständige lokale Berichte und originale Rot-/Grünbelege bleiben verlinkt. #332 wegen tatsächlicher Gesamtprüfung offen; #340 weiter erledigt. Keine weiteren Checkbox- oder Kartennotizänderungen.
- [x] ~~Bestehenden Scheduler nach Wissensabschluss deaktiviert.~~ Toolbestätigung 23.10.2026 19:58:36 UTC/21:58:36 Berlin: enabled=false, nextRunAt=null. Kein nächster Lauf; bestehende ID und Historie erhalten, nicht gelöscht. Alle drei neuen Kindaufträge terminal completed ohne ausstehende Kinder. Keine eigenen Dienste gestartet.
- [ ] Externe Grenzen bleiben: echte Box-/Upgrade-/Kapazitäts-/K3-/Stable-Abnahme, Veröffentlichung/Liveursache, übrige Produkt-/Rechts-/Schema-/Betreiberentscheidungen oder ausdrücklich fehlende Auslöser gemäß Matrix. Cloudanhänge benötigen funktionierenden autorisierten Dateidialog. Kein Push/Deploy oder produktiver Eingriff freigegeben.

Aktueller ausführbarer Plan erfüllt. Matrix unverändert A2/B0/C19/D20/E13; sämtliche verbleibenden C-/D-/E-Reste konkret extern blockiert oder bewusst bedingt. Git-Historie unverändert auf main/HEAD 9b173772, Tracking 6fd0cce3 drei Commits voraus; deren Dateiinhalte gezielt im Arbeitsbaum abgeglichen und korrigiert, keine Übernahme der Commits in Historie. Vor späterer Veröffentlichung endgültigen Git-/Auslieferungsstand koordinieren und bei Änderungen passende Prüfungen wiederholen. Fremde Änderungen und Worktrees erhalten, echter Index leer.

## Neuer lokaler Folgeauftrag — #25, FAQ 3/4/10

Benutzer beauftragt nächste ausführbare Karte. Abgeschlossene Pakete nicht wiederholt. Enger neuer Plan: reale Dashboardnavigation mit synthetischer SDK-Grenze für Patientenauswahl ohne Speichern, Akteneinstieg aus Termin und Patientenliste sowie Box-/SaaS-Supportvergleich. Keine echte Auth-, Persistenz-, Zielbox-, Geräte- oder Videoabnahme. Pflichtberatung fonksiyon-ustasi/legal-de abgeschlossen; kein neuer Produktweg nötig. QR-Sprechertext führt korrekt zuerst zur Installationshilfe, anschließend Anmeldung. Zeitplanung unverändert 330 Sekunden, nun 644 Wörter; keine Mediendatei. Neue Testimplementierung und unabhängige Abnahme noch offen, aktuelle taskId und Besitz im Fortsetzungsplan. Bestehender stündlicher Scheduler während Arbeit wieder aktiviert; nach Abschluss externer Restgrenzen erneut deaktivieren.

## #25 — neuer Cachefehler und Prüflücke am 24.10.2026

**OPS-25-AKTE-TERMINE-CACHE-20261024:** Der reguläre Termin-Akteneingang besaß den Lead bereits; der Terminwrapper suchte stattdessen den allgemeinen, noch leeren Cache. Acht originale FAQ-Klickfälle waren rot mit `displayName(undefined)`, der Listenweg funktionierte. Nach Pflichtberatung wird exakt der vorhandene Lead weitergegeben; Cache-Suche entfernt und Dashboardcacheversion erneuert. Keine neue Abfrage, Cachemutation oder Namensersatzsuche. Produktdatei eine Zeile kleiner; Projektgate senkte Baseline automatisch von 18415 auf 18414. Engere Grenze bleibt erhalten. Funktionskarte 3803/476 frisch; drei spätere Zeilenbelege je FAQ/Storyboard nach Quellinhaltsvergleich um eins verschoben.

Gleiche Probe nach Produktfix: 8/8 und 308 Assertions grün. Frontend 2181/2181, fünf Terminmodul-Grenztests und Typecheck grün; bisherige Billingmatrix 13/13 mit 257 Checks und 31 Boundarychecks. Frühere einzelne Navigationstimeoutursache ungeklärt, im Nachlauf nicht wiederholt. Sieben neue exakt begrenzte Fixture-Leseverträge plus 35 Negativguards; keine generischen Unknown-Ausnahmen. Keine DB-/Authserver-/OS-/Box-/Persistenzbeweise.

R1 bestätigte Produktfix mit 388 eigenen Assertions, 32 sichtbaren Terminansichten samt Reopen, 83 Cache-/Vertragsproben und 31 Boundarychecks; REQUEST CHANGES betraf ursprüngliche Prüfprobe. **OPS-25-PROBE-LEERE-TERMINE-20261024:** Fehlende History wurde trotz null Zeilen akzeptiert. Root ergänzte normale Termine-Aufklappung und tatsächliche sichtbare completed Zeile mit Datum, Uhrzeit, Leistung, Code und Dauer sowie korrektem Owner-/Patientenfilter und Trefferzahl. Identische leere Fixture wird korrekt an vier Inhalts-/Filterchecks rot; sonstige Guards grün. Finale Probe und unabhängiger R2 sind gesondert protokolliert. Kein zusätzlicher Produktfehler aus dieser Testlücke.

Tagesdatei `fortschritte/2026-10-24.md` enthält tatsächlichen Reset um 02:31 Uhr, Bestandsaufnahme um 02:33 Uhr und gestoppte historische automatische Kindwiederholungen. Neue fremde Designänderungen und separater Worktree erhalten. QR-Sprechertext führt korrekt zuerst zur Installationshilfe: 644 Wörter, 330 geplante Sekunden, kein Video. Ops #25 frisch lesend: mindestens fünf Minuten Intro plus FAQ, Parent #122; kein neuer Haken oder Kartennotizeditorschreibvorgang. Zentrale Wissenspflege erfolgt nach R2; Scheduler bleibt bis zum lokalen Abschluss aktiv.

## Lokaler #25-Teilabschluss — 24.10.2026

- [x] ~~Produktfix und endgültige Testhärtung unabhängig abgenommen.~~ R3 APPROVE: beide Probe-Findings geschlossen. Acht eigene Positivfälle mit 340 bestehenden plus 16 zusätzlichen Sichtbarkeitschecks, 31 Boundarychecks grün. Acht Negativfälle korrekt rot, darunter leere Historie, 130 Minuten, falsche Uhrzeit und falscher Query-Scope. Filter und Fences erhalten; sieben Kernquellen sowie 226 geladene Quellen unverändert. Separate Intent-Quittierung erfolgt; kein Livebeweis. Endgültige Rootmatrix `faq25-exact-final-01`: 8/8, 340 Checks; 130-Minuten-Kontrolle `faq25-exact-negative130-01` korrekt rot. R1-/R2-Berichte gelten historischen Probeversionen, deren Findings jetzt geschlossen sind. Produktstand seit Cachefix unverändert.
- [x] ~~Ausführbare FAQ3/4/10-Teilprüfung und QR-Präzisierung lokal abgeschlossen.~~ Geprüfte UI-Schritte ohne Speichern oder Versand; neue Fehler repariert, Nachbarn bestanden, konkrete Grenzen dokumentiert.
- [ ] Gesamtkarte #25 und Parent #122 bleiben offen: fehlende echte Aufnahme A1–A10, Zielbox-/Auth-/Persistenz-/Geräteabnahme, Video mit gemessenen mindestens 300 Sekunden und abgenommene Box-FAQ. Keine neue Produktentscheidung, Veröffentlichung oder reale Datenprüfung freigegeben.

## Operativer Abschluss des #25-Nachlaufs — 24.10.2026, 02:56:16 Berlin

- [x] ~~Alle aktuell autorisierten lokalen Pakete dieser Fortsetzung vollständig geprüft und unabhängig abgenommen.~~ Cachefehler repariert; zwei belegte Prüflücken geschlossen; R3 APPROVE. Endgültige Rootprobe acht Fälle/340 Checks, Reviewer zusätzlich 16 Sichtbarkeitschecks und acht korrekt rote Negativfälle. Billingnachbarn, Frontendsuite, Typecheck und Funktionskarte bestanden. Keine weiteren lokalen Findings offen.
- [x] ~~Wissenspflege lokal und zentral gespeichert und Speicherung geprüft.~~ Bestehenden eigenen Ops-Wissenseintrag `3fddecc5-b572-48bd-9bd3-09148953071c` datiert ergänzt. Nach Reload Markdown mit 14855 Zeichen exakt verglichen; Titel/Tags und vorhandener anderer Eintrag unverändert. Tatsächlich gespeicherter Zusatz mit 3348 Zeichen zusätzlich als `faq25-central-gespeichert.md` gesichert. Screenshot `faq25-wissen-gespeichert.jpg`, SHA256 `1d4b916448165751005e6f4f0347cf7b9beb1f56a0f42c35020fd4bd3b6cdf27`. Keine erneute Anhang-/Berechtigungsaktion.
- [x] ~~Ops-Gesamtkriterien frisch abgeglichen.~~ Board „Alle 52“, #25 weiterhin offen; Parent #122 bleibt 2/5 und offen, #340 weiterhin erledigt. Kein neuer Gesamthaken oder Kartennotizvollformular überschrieben. Lokale Teilabschlüsse sichtbar dokumentiert; tatsächlicher Video-/FAQ-Rest bleibt.
- [x] ~~Bestehenden Ops-Scheduler und eigenen Testserver beendet.~~ Tool bestätigt `enabled=false`, `nextRunAt=null`; kein nächster Lauf. Anderen Redesign-Scheduler unverändert gelassen. Eigenen sicheren Server in Terminal 66347 per Ctrl-C beendet; Port 8081 ohne Listener. R1/R2/R3 terminal completed, keine aktiven Kinder oder offenen Fragen. Historische limit-resume-Kinder ebenfalls ohne ausstehende Läufe.
- [ ] Konkrete externe Reste: vorbereitete echte Zielbox mit zulässigem synthetischen Auth-/Persistenzworkflow, Aufnahme A1–A10, reale Geräteprüfung und Video mit gemessenen mindestens 300 Sekunden plus vollständige Box-FAQ. Veröffentlichung und sonstige Produkt-/Betriebsentscheidungen bleiben getrennt; Cloudanhänge benötigen funktionierenden autorisierten Dateidialog. Kein Push/Deploy oder produktiver Eingriff freigegeben.

Git bleibt main / HEAD 9b173772, Tracking 6fd0cce3, echter Index leer. Eigene Produktdateien und Prüfgrenzen eindeutig dokumentiert; fremde Designänderungen und Worktrees erhalten. Vollständiger Bericht `Claude outputs/2026-10-23-ops-fortsetzung/faq25-final-report.md`, unabhängige R1/R2/R3-Berichte daneben. Nur lokale synthetische Abnahme, kein Live-/DB-/Box-/OS-/Videoabschluss.

- [x] ~~Letzte Abnahmegates nach vollständiger Dokumentpflege bestanden.~~ `faq25-abnahme-owned-gates-results.json`: alle neun Gates Exit 0 am expliziten 38-Pfade-Prüfindex; beide Baselines unverändert, echter Index leer. `faq25-final-source-check.json` bestätigt fünf freigegebene Kernquellen SHA-identisch zur R3-Abnahme, Dashboard und Baseline beide 18414 Zeilen. Keine weiteren Änderungen oder Prüfungen erforderlich.


## Erneuter Nutzernachtest und nächste Karte — 24.10.2026

- [x] ~~#25 auf erneuten Prüfauftrag unverändert nachgetestet.~~ Fünf Terminmodultests grün; vollständige FAQ-Matrix bei 390/1280 px, hell/dunkel, Box/SaaS: 8/8 Fälle, 340/340 Prüfungen und 31/31 Boundarychecks. Null unerwartete HTTP-/WS-Versuche, Writes, unbekannte Reads oder PageErrors. Alle fünf freigegebenen Kernquellen SHA-identisch zur R3-Abnahme. Kein neuer Produktfehler, kein weiterer Produktfix erforderlich. Ergebnisordner: `Claude outputs/2026-10-23-ops-fortsetzung/faq25-retest-20261024-01/`; Wiederholung nicht zu historischen Gesamtsummen addieren.
- [x] ~~Parallele Design-Sitzung geschützt.~~ Port8081 gehört PID50661 im separaten Design-Worktree. Weder Prozess noch Dateien verändert. Bestehenden sicheren Static-Handler auf eigenem kurzlebigem IPv4-Loopback-Port verwendet; ausschließlich Laufzeit-Origin umgestellt. Originalprobe, Produktquellen und sämtliche Schutzprüfungen unverändert. Wrapper `faq25-retest-20261024.py` im vorhandenen eigenen Ausgabeordner; eigener Server im finally-Block nachweislich beendet.
- [x] ~~Grünen Stand lokal und zentral gespeichert.~~ Bestehenden eigenen Ops-Wissenseintrag datiert ergänzt, nach Reload exakten Markdownbestand mit 16194 Zeichen verglichen; Titel und Tags unverändert. T3-Vorschau scheiterte zweimal mit `Preview automation snapshot timed out after 15000ms.`; autorisierten Chrome-Bedienweg genutzt. Keine Kartennotizvollformulare oder Done-/Parentwerte geändert. Status: lokal getestet und Wissen gespeichert, kein Live-/DB-/Gerätebeweis.
- [x] ~~Nächste bestehende Aufgabe #26 geprüft.~~ Lokaler Installationspfad bereits abgenommen. Ausführbarer Rest benötigt echte Android-/iOS-Geräte, Wiederöffnung sowie Zielbox/Boxupdate. Diese Testumgebungen fehlen. Keine erneute synthetische Geräteabnahme behauptet.
- [ ] Weitere Reste unverändert konkret blockiert: #24 durch fehlenden freigegebenen Liveprüfzugang und ungeklärte Live-401-Ursache; #332 durch echte Box-/Upgrade-/Kapazitäts-/K3-/Stable-Abnahme; #25 durch authentifizierten Zielbuild, A1–A10-Aufnahme und gemessenes Video mindestens 300 Sekunden. Übrige Karten gemäß Einzelmatrix durch Entscheidungen, Zugriffe oder nicht belegte Auslöser. Kein neues lokales B-Paket gefunden; Ops-Scheduler bleibt deaktiviert.

Git weiterhin main/HEAD9b173772, Tracking6fd0cce3; echter Index leer. Kein Commit, Push, Deploy oder produktiver Eingriff. Frühere unabhängige R3-Abnahme gilt unverändertem Produkt-/Teststand; neue Testartefakte ergänzen Nachweise.

- [x] ~~Tatsächliche #26-Zurückstellung frisch auf Ops gelesen.~~ Karte „PWA ve mobil installer“ nennt Manifest plus Service Worker; Detailnotiz weiterhin „Sonraya bırakıldı“ (bewusst verschoben). `KUTU_HAZIRLIK_SPRINT.md:576` führt #117/#26 nach Box-Test/Launch; T34 (`:387`) verlangt echte Linux-Box, Android und iPhone. `module/app-installieren.js:5` schließt Service Worker wegen Cache-Risiko bei Boxupdates bewusst aus. Deshalb nicht nur Geräteblocker, sondern weiterhin zurückgestellter vollständiger PWA-/Offlineumfang. Parent #117 bleibt 4/5, Karte offen. Board frisch „Alle 52“, #340 weiter erledigt; keine Checkbox oder Kartennotiz geändert. Präzisierung im eigenen zentralen Wissenseintrag gespeichert und nach Reload exakt geprüft: nun 16782 Zeichen, Titel/Tags unverändert.
- [x] ~~Bildbeleg des gespeicherten Nachtests lokal gesichert.~~ `faq25-retest-20261024-01/wissen-gespeichert.jpg`, 22611 Bytes, SHA-256 `0e4205a4d7bd474cd3969f41b745097bb35d56305b32033e3ddac498c4c538cc`. Browser gab Original-JPEG trotz PNG-Metadaten zurück; erste reine Formatassertion war deshalb rot. Korrekte JPEG-Signatur geprüft, Bytes unverändert gespeichert; kein Bild-/Produktfix oder gelockerter Test.
