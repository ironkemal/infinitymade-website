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

<!-- ID-Register wird unten deterministisch ergänzt. -->
