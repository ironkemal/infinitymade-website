# Ops-Statusabgleich 22.10.2026

Suchbegriffe: Ops, abgehakt, durchgestrichen, erledigt, Teilabschluss, #34,
BILLING-AUTH-401-20261022.

## Umfang und Beweisgrenze

Auftrag: sämtliche Ops-Aufgaben prüfen und bereits Erledigtes sichtbar markieren.
Quelle: angemeldetes Board `https://ops.infinitymade.de/#todo`, einschließlich
„Archiv zeigen“, am 22.10.2026. 336 eindeutige Karten erfasst; Nummern 200, 311,
312 und 317 sind im gelesenen Bestand nicht vorhanden. Keine Löschung daraus ableiten.

Ausgang: 269 abgehakte Karten, 54 offene Einzelaufgaben, 13 offene Sammelkarten.
Die 54 offenen Einzelaufgaben wurden anhand ihrer Notizen/Abschlusskriterien gegen
Umsetzungsplan, Tagesnachweise und gezielte aktuelle Quellen abgeglichen. Alle
archivierten Titel und Abschlussvermerke wurden inventarisiert; sie wurden nicht
sämtlich erneut funktional oder live getestet. Ein bestehendes Häkchen ist kein
neuer Produktionsnachweis. Diese Prüfung baut keine offenen Funktionen nach.

## Tatsächlich in Ops geändert

- [x] ~~#34 Cookiebanner-Audit abgeschlossen und im Board abgehakt.~~
  Bestehende Entscheidung vom 29.08.2026, gemeinsamer Consent-/Widerrufsweg,
  gleiche Buttongeometrie und Fokus auf Ablehnen, statischer Scan ausgelieferter
  HTML-Seiten, offengelegter Sperrcookie und dokumentierte Chrome-Ablehnungsprobe.
  Pflichtreview legal-de: Kriterium erfüllt, kein Blocker. Keine juristische
  Gesamtfreigabe. Echter Umami-Empfang/Hash-/Salt-Nachweis bleibt #44.
- [x] ~~16 Kartennotizen um belegte Teilabschlüsse und konkrete Restgrenzen ergänzt.~~
  #17, #24, #33, #34, #40, #44, #131, #132, #290, #291, #332, #334,
  #336, #337, #338, #339. Frühere Notizen erhalten, keine Titel, Zuständigkeiten,
  Kategorien oder Abhängigkeiten absichtlich geändert.
- [x] ~~Parentregel kontrolliert.~~ #119 bleibt mit drei von sechs erledigten
  Kindern offen; #33/#44/#41 fehlen. Kein anderer offener Parent hat nur erledigte Kinder.

Stand nach dieser Änderung: **270 abgehakte Karten, 53 offene Einzelaufgaben,
13 offene Sammelkarten**. Bestehende 269 Häkchen wurden nicht neu gesetzt.
In Notizen sind Teilabschlüsse als „✅ ERLEDIGT“ gekennzeichnet; der kleine
Ops-Markdownrenderer unterstützt keine echten durchgestrichenen Teilzeilen.
Deshalb wird keine noch offene Gesamtaufgabe bloß für einen Teilabschluss abgehakt.

## Nachweisquellen

- `fortschritte/2026-10-21.md`: fünf Teilpakete, Regressionen, #17-URL-Vertrag,
  Katalog-Preisabgleich, #290-Vertrag und #338/#339-Spezifikation.
- `fortschritte/2026-10-22.md`: Merge/Release 2e5aae2d/v0.7.0, lokale Gates,
  begrenzte Liveprüfung und weiterhin offener Billing-Auth-Befund.
- `konsey/tutanak/2026-10-21-ops-umsetzungsplan.md`: vollständige bisherige Zuordnung.
- `konsey/tutanak/2026-10-21-ops-290-datenvertrag.md`: Vorbereitung, B1–B5 offen.
- `konsey/tutanak/2026-10-21-ops-338-339-spezifikation.md`: Spezifikation, keine Umsetzung.
- `konsey/tutanak/2026-10-21-ops-betreiber-checklisten.md`: Checklisten, keine Betreiberabnahme.
- `KUTU_HAZIRLIK_SPRINT.md` §7/§8: Box-Abnahme und übertragene Altkarten.
- `canli-test/2026-10-22-billing-auth-401.md`: Livefehler reproduziert;
  lokale Klassifikationskorrektur ist keine bewiesene Behebung der Liveursache.
- `ops/board.js`: Abschluss per vorhandenem Checkboxweg; Parent nur bei allen Kindern done.
- `ops/schema.sql`, `ops/schema-audit.sql`: lokale Trigger-/Auditdefinitionen,
  heutiges Live-Schema nicht per SQL verifiziert.

## Offene Einzelaufgaben: jeweiliger Restnachweis

| ID | Aufgabe / bereits erledigter Anteil | Warum kein Gesamt-Häkchen |
|---|---|---|
| #1 | eGK/Upload-Anbieter | Freigegebene Anbieter-/Datenschutz-/Kostenentscheidung fehlt; bestehender Azureweg ersetzt diesen Auftrag nicht. |
| #2 | Kartenlesermodell | Freigegebene Hardware-/TI-Auswahl mit Originalnachweis fehlt. |
| #6 | TI/VSDM-Voraussetzung | Schriftliche Fach-/Rechts-/Onprem-Freigabe dieser Kette fehlt. |
| #8 | IK/ITSG/P12 | Synthetische DTA-/Empfängertests vorhanden; reale autorisierte Zertifikatsprüfung fehlt. |
| #11 | Gründer-Kontrolltermin | Tatsächlich vereinbarter Termin nicht nachgewiesen. |
| #12 | Gesellschaftsform | Gründer-/Steuerberaterentscheidung nicht nachgewiesen. |
| #14 | Marke/Domainübertragung | Tatsächliche gesellschaftliche Zuordnung/Übertragung nicht nachgewiesen. |
| #15 | Versicherung/Steuerberatung | Vertragliche Erledigung nicht nachgewiesen. |
| #16 | Partnerschaftsvertrag | Unterzeichnung/Notartermin nicht nachgewiesen. |
| #17 | URL-Vertrag, Slashfix und 36 Tests erledigt | Production-Wert NEXT_PUBLIC_URL weiterhin ungeprüft. |
| #19 | Betreibercheckliste fertig | Steuerentscheidung und Stripe-Tax-Konfiguration nicht abgenommen. |
| #20 | Betreibercheckliste fertig | Aktive Radarregeln im Stripe-Panel nicht bestätigt. |
| #21 | Fremdwährungen | Bewusst bedingt/verschoben; keine Umsetzung behaupten. |
| #23 | DKIM-Checkliste fertig | Microsoft-365-Schalter und echte Signatur/Zustellung ungeprüft. |
| #24 | Synthetische Matrix und lesende Live-Teilprüfungen erledigt | Vollständiger Launchweg fehlt; Billingdetail/Positionen live 401. |
| #25 | Hilfe/Support vorhanden | Gefordertes Introvideo und vollständige Veröffentlichung nicht nachgewiesen. |
| #26 | PWA | Installations-/Offlineumfang nicht umgesetzt/abgenommen. |
| #28 | ISO 27001 | Bewusst an Enterprisebedarf gebunden; keine Zertifizierung/Umsetzung. |
| #29 | Personalverpflichtung | Bestehender Gründerbeleg ersetzt Verpflichtung künftiger Mitarbeiter nicht. |
| #30 | SLA-Checkliste fertig | Verbindliche, tragfähige Zusage und Aufnahme in AGB nicht entschieden. |
| #31 | Synthetische Abnahmetests vorhanden | Reale Annahmebestätigung des Rechenzentrums fehlt. |
| #33 | Isolierte Serverless-Telemetrie implementiert/getestet/ausgeliefert | Betreiberaktivierung, Vertragsumfang, echter Empfang nach Response-Ende fehlen. |
| #35 | PITR | Plan-/Betriebsentscheidung und aktivierte Wiederherstellung ungeprüft. |
| #40 | Instanzdrossel und Mail-Escaping implementiert/getestet/ausgeliefert | Verteilte WAF-Abnahme, DMARC/DNS und echte Zustellprüfung fehlen. |
| #41 | Snapshots | Bedarfs-/Kundenschwelle und tatsächliche Aktivierung nicht bestätigt. |
| #44 | Consent-/Widerrufskorrektur erledigt | Umami-Domain, Datenempfang, Netzwerkpfad und Serverrotation ungeprüft. |
| #48 | Ergo-Blanko | Separater fachlicher Regelsatz weiterhin nicht umgesetzt, siehe blankoRules.js. |
| #63 | Quellenmonitor-Erweiterung | Gesamte Download-/Register-/Diff-/Berichtskette nicht nachgewiesen. |
| #78 | eGK-Integration | Freigegebener Hardware-/TI-Weg und tatsächliche Integration fehlen. |
| #95 | Befreiungsstatus aus Karte | Hängt an fehlender eGK-Integration; kein Ersatz durch manuelle Befreiung. |
| #108 | Leser-Anbindung | Teil der weiterhin offenen TI-/Hardwarekette. |
| #125 | Adminverbesserung | Betreibercheckliste vorhanden, geforderte Kosten-/Kontenübersicht nicht abgenommen. |
| #131 | Gemeinsamer Preisabgleich durchgeführt | Vollständiger Logo-Katalog mit Original-HPNR/Preis/Dauer nicht geprüft. |
| #132 | Gemeinsamer Preisabgleich durchgeführt | Vollständiger Physio-Katalog mit Original-HPNR/Preis/Dauer nicht geprüft. |
| #150 | Synthetische DTA-Nachweise vorhanden | Autorisierte reale Übermittlung und dokumentierte Kassenantwort fehlen. |
| #170 | Datenebene | Bewusst bedingte Architekturarbeit; keine vollständige Migration der Pfade. |
| #184 | Zeit-Presets | Auslöser/Produktumfang nicht bestätigt; keine Umsetzung behaupten. |
| #202 | Mehrere Heilmittel | Fach-/Datenmodell und vollständige Erfassungs-/Abrechnungskette fehlen. |
| #214 | Kartenstammdaten | Tatsächliche Leseranbindung fehlt. |
| #242 | QA-Kontenbereinigung | Checkliste vorhanden; keine autorisierte Löschung/Rotation samt Nachweis. |
| #248 | Versicherung | Tatsächlicher Abschluss nicht nachgewiesen. |
| #251 | Physio-Einheitenänderung | Entscheidung über überzählige Sitzungen und gemeinsamer Geld-/Historienweg fehlen. |
| #290 | Quellen-/Datenvertrag fertig | B1–B5, Speicherung, atomare Festschreibung, Umsetzung und Roundtrip offen. |
| #291 | Neutrale Blanko-Anzeige korrigiert | Vollständige bestätigte Erfassung und Persistenz/Physio-/Ergo-Ampel fehlen. |
| #332 | Analyse C, Integration und Release erledigt | Box-/K3-/Upgrade-/Stable-Abnahme, tatsächlicher Ledger und zusätzliche Sicherheitsmigration offen. |
| #333 | Kaufkonto/Lizenzmail | Kauf-/Identitäts-/Lizenzmodell und SMTP-Zustellweg nicht vollständig abgenommen. |
| #334 | Diskcheck fertig | VPS-Alarm tatsächlich empfangen und Kuma-Reparatur nicht nachgewiesen. |
| #335 | Praxis-SMTP-Zielbild vorhanden | Verbindung/Testmail/Gesendet/Rückfallweg nicht implementiert und abgenommen. |
| #336 | Erhaltungs-/Belegwege analysiert | Entscheidung plus verifizierter Kundenzugang nach Bann/Löschung fehlen. |
| #337 | Fehlermodus lokal getestet | Echte VPS-Key-Präsenz bzw. zulässiger Testlöschlauf fehlt; keine Werte lesen. |
| #338 | Fachliche Spezifikation fertig | Produkt-/Datenentscheidung, Auslöser und beauftragte Umsetzung fehlen. |
| #339 | Fachliche Spezifikation fertig | Produkt-/Datenentscheidung und beauftragte Umsetzung fehlen. |
| #340 | Unbelegte Nicht-Podo-Frist identifiziert | S:01012 steht weiterhin im Nicht-Podo-Pfad; Quelle oder fachlich freigegebene Korrektur fehlt. |

## Sammelkarten

| ID | Offene Kinder, daher Parent offen |
|---|---|
| #109 | #12, #16, #14, #15, #11 |
| #115 | #8, #31 |
| #116 | #6, #1, #2, #78, #108, #95 |
| #117 | #26 |
| #119 | #33, #44, #41; #34 neu abgeschlossen |
| #120 | #30, #29 |
| #121 | #19, #20 |
| #122 | #23, #40, #25 |
| #123 | #17, #24, #125 |
| #124 | #48, #35, #21, #28, #63 |
| #127 | #132 |
| #128 | #131 |
| #168 | #170 |

## Vorhandene Archivhäkchen sind nicht alle Liefernachweise

32 Karten nennen ausdrücklich die Übertragung in den Box-Sprint; ihre Nachverfolgung
bleibt dort und in #332. Drei Karten nennen eine bewusste Schließentscheidung
(#22/#278/#279). Die übrigen Archivhäkchen werden als historischer Boardstatus
erhalten. Kein stilles Wiederöffnen geschlossener Beschlüsse und kein erneutes
Abhaken als heutige Funktionsfreigabe.

In den historischen Notizen stehen bei #133, #138, #139, #148, #191, #196,
#199, #223, #226, #256, #257 und #266 noch explizite Rest-/Liveprüfvermerke.
Diese alten Vermerke beweisen weder Fortbestand noch spätere Erledigung. Sie sind
hier als Nachweisgrenze erhalten, nicht als heute neu bestätigte offene Bugs.

## Zugriffs- und Änderungsgrenzen

SQL-Connector im Ops-Projekt: Berechtigung verweigert (MCP -32600).
Deshalb vorhandene angemeldete UI benutzt; keine Secrets/.env oder Produkttabellen.
T3-Preview zweimal Snapshot-Timeout; dokumentierter Wechsel zu Chrome.
Nach Unterbrechung meldete Chrome-DOM-Anbindung „Debugger unattached“;
native Ops-Ansicht zeigt weiterhin #34 mit Abschlussdatum 22.10. und 53 offene
Einzelpunkte. Nachgelagerte Zusatznotizen ohne erfolgreichen Speichernachweis
werden nicht als geschrieben gezählt.

Keine neue Migration, kein Commit/Push/Deploy, keine Geldaktion, Löschung,
Übermittlung oder Änderung der laufenden Produktbearbeitung.

## Vollständiges ID-Register

Die folgende Tabelle enthält jede der 336 gelesenen IDs genau einmal. Legende:
**N** neu belegbar abgeschlossen; **P** Teilnachweis, Gesamtkarte offen;
**O** offen/bedingt/Betreiber- oder Entscheidungsnachweis fehlt;
**G** offene Sammelkarte; **T** historisch in Sprint übertragen;
**D** historische Schließentscheidung; **H** vorher bereits abgehakt,
keine neue Einzelabnahme. Für P/O/G gelten die konkreten Restgrenzen oben.

| Ops-ID | Einordnung | Nachweis / Grenze |
|---|---|---|
| #1 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #2 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #3 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #4 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #5 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #6 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #7 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #8 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #9 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #10 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #11 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #12 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #13 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #14 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #15 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #16 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #17 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #18 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #19 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #20 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #21 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #22 | D | vorher abgehakt; dokumentierte historische Schließentscheidung |
| #23 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #24 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #25 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #26 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #27 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #28 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #29 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #30 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #31 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #32 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #33 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #34 | N | neu abgeschlossen; Cookieaudit/Pflichtreview, siehe oben |
| #35 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #36 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #37 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #38 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #39 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #40 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #41 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #42 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #43 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #44 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #45 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #46 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #47 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #48 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #49 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #50 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #51 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #52 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #53 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #54 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #55 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #56 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #57 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #58 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #59 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #60 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #61 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #62 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #63 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #64 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #65 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #66 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #67 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #68 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #69 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #70 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #71 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #72 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #73 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #74 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #75 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #76 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #77 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #78 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #79 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #80 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #81 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #82 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #83 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #84 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #85 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #86 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #87 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #88 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #89 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #90 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #91 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #92 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #93 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #94 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #95 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #96 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #97 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #98 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #99 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #100 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #101 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #102 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #103 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #104 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #105 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #106 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #107 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #108 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #109 | G | Parent offen wegen genannter Kinder |
| #110 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #111 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #112 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #113 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #114 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #115 | G | Parent offen wegen genannter Kinder |
| #116 | G | Parent offen wegen genannter Kinder |
| #117 | G | Parent offen wegen genannter Kinder |
| #118 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #119 | G | Parent offen wegen genannter Kinder |
| #120 | G | Parent offen wegen genannter Kinder |
| #121 | G | Parent offen wegen genannter Kinder |
| #122 | G | Parent offen wegen genannter Kinder |
| #123 | G | Parent offen wegen genannter Kinder |
| #124 | G | Parent offen wegen genannter Kinder |
| #125 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #126 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #127 | G | Parent offen wegen genannter Kinder |
| #128 | G | Parent offen wegen genannter Kinder |
| #129 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #130 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #131 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #132 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #133 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #134 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #135 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #136 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #137 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #138 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #139 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #140 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #141 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #142 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #143 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #144 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #145 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #146 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #147 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #148 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #149 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #150 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #151 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #152 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #153 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #154 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #155 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #156 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #157 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #158 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #159 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #160 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #161 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #162 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #163 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #164 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #165 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #166 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #167 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #168 | G | Parent offen wegen genannter Kinder |
| #169 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #170 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #171 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #172 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #173 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #174 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #175 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #176 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #177 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #178 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #179 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #180 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #181 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #182 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #183 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #184 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #185 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #186 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #187 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #188 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #189 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #190 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #191 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #192 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #193 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #194 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #195 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #196 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #197 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #198 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #199 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #201 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #202 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #203 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #204 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #205 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #206 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #207 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #208 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #209 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #210 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #211 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #212 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #213 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #214 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #215 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #216 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #217 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #218 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #219 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #220 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #221 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #222 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #223 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #224 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #225 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #226 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #227 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #228 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #229 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #230 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #231 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #232 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #233 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #234 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #235 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #236 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #237 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #238 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #239 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #240 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #241 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #242 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #243 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #244 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #245 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #246 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #247 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #248 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #249 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #250 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #251 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #252 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #253 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #254 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #255 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #256 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #257 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #258 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #259 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #260 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #261 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #262 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #263 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #264 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #265 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #266 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #267 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #268 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #269 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #270 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #271 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #272 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #273 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #274 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #275 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #276 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #277 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #278 | D | vorher abgehakt; dokumentierte historische Schließentscheidung |
| #279 | D | vorher abgehakt; dokumentierte historische Schließentscheidung |
| #280 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #281 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #282 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #283 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #284 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #285 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #286 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #287 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #288 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #289 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #290 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #291 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #292 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #293 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #294 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #295 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #296 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #297 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #298 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #299 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #300 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #301 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #302 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #303 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #304 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #305 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #306 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #307 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #308 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #309 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #310 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #313 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #314 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #315 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #316 | H | vorher abgehakt; historischer Abschlussvermerk, heute nicht neu funktional abgenommen |
| #318 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #319 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #320 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #321 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #322 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #323 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #324 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #325 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #326 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #327 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #328 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #329 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #330 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #331 | T | vorher abgehakt; ausdrücklich in KHS übertragen, keine neue Lieferfreigabe |
| #332 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #333 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #334 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #335 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
| #336 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #337 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #338 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #339 | P | Teilabschluss in Kartennotiz; konkreter Restnachweis siehe Tabelle |
| #340 | O | Gesamtanforderung offen; konkreter Restnachweis siehe Tabelle |
