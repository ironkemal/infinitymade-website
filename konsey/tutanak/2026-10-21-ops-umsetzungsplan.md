# Ops: vollständiger lokaler Umsetzungsplan

Datum: 21.10.2026. Grundlage: Aufgaben und Unteraufgaben im angemeldeten Ops-Board,
am selben Tag in Chrome gelesen. 53 offene Einzelpunkte; Sammelkarten sind keine
zusätzlichen Einzelaufgaben. Keine Kundenidentitäten oder echten Vorgangsdaten übernommen.

## Auftrag und Grenzen

Zuerst Gesamtplan, danach lokal ausführbare Arbeiten umsetzen, recherchieren und prüfen.
Keine Veröffentlichung, produktiven Datenänderungen, Käufe, Nachrichten oder Änderung
von Betreiberkonfigurationen. Bestehende Produktentscheidungen werden nicht durch eine
Implementierung ersetzt. Die aktuellen Änderungen im gemeinsamen Checkout bleiben erhalten.

`main` lag beim Start 85 Commits hinter dem bereits vorhandenen `origin/main`.
Relevante Kandidaten zusätzlich gegen diesen Remote-Tracking-Stand lesen; kein Pull,
Reset oder automatisches Zusammenführen des fremden Arbeitsstands. `origin/main` ist
kein Nachweis des aktuellen Live-Deployments oder eines heute frisch abgefragten Remotes.

Statuswörter: **geplant**, **geschrieben**, **lokal getestet**, **extern ungeprüft**.
Ein lokaler Test schließt weder eine Ops-Karte noch eine Box-/Kundenabnahme automatisch.

## Reihenfolge und Abhängigkeiten

1. Bestandsprüfung und Wiederverwendung: Funktionskarte, Quellcode und origin/main;
   fachliche, Datenbank-, Rechts-, Sicherheits- und On-prem-Beratung.
2. Unmittelbar irreführende Blanko-Anzeige korrigieren (#291-Teil): unbekannte Grundlage
   ausdrücklich als nicht berechenbar darstellen. Keine neuen Vertragsgrenzen erfinden.
   Zusätzlich bestätigten Widerrufsfehler (#34/#44) korrigieren: eine laufende Messung
   muss nach Ablehnen enden, einschließlich zwischenzeitlich blockierter Speicherung.
3. Betriebsdiagnose vorbereiten (#334-Teil): deterministischer Diskcheck ohne Löschen,
   Installieren oder Alarmversand. Messfehler müssen als Fehler erscheinen.
4. Öffentliche Mailpfade härten (#40-Teil): kurze, begrenzte Instanzdrossel vor
   Nebenwirkungen; HTML-Ausgaben escapen. Prozesslokale Zähler sind kein verteilter
   Missbrauchsschutz. WAF-Regel und Betreiberabnahme bleiben eigener Freigabeschritt.
5. Fehlererfassung vorbereiten (#33): vorhandenen Sentry-Dienst nur mit expliziter
   Konfiguration, isoliertem Client und technischer Positivliste verwenden. Keine
   automatischen Request-/Fehlerinhalte oder neue Box-Abhängigkeit. Tests ohne Netz.
6. DTA-Datenvertrag (#290): bestehende Segmente wiederverwenden. Erfassung, validierte
   Speicherung, beide Mapper und synthetischer DTA-Test gehören zusammen. Schema und
   Originalquellen vorher bestätigen. Kein neuer Speichertopf und keine geratenen Schlüssel.
7. Vollständiges Blanko-Roundtrip-/Ampelpaket (#291): Physio und Ergo getrennt anhand
   gültiger Verträge und tatsächlich dokumentierter Leistungen. Hängt an Fachentscheidung.
8. Kauf-/Lizenzfluss und Rechnung nach Kontolöschung (#333/#336): erst Produkt- und
   Identitätsweg festlegen, dann vertikales kleines Paket. Keine offene Belegfreigabe.
9. Externe Release-/Betriebsprüfungen; danach vollständiger Launch-Smoke-Test.
10. Bewusst bedingte Erweiterungen erst nach ihren bestehenden Auslösern.

## Vollständige Zuordnung der 53 offenen Einzelpunkte

| Ops-ID | Inhalt | Lokal sinnvoller Umfang / Abnahmekriterium | Voraussetzung / Abschlussgrenze |
|---|---|---|---|
| #291 | Blankoverordnung: Eingabe und Ampel | Zuerst fehlende Basis neutral anzeigen; danach bestätigte Fachbereichsregeln und Speicher-Roundtrip testen | Volle Ampel erst mit bestätigten Physio-/Ergo-Verträgen; unbekannt niemals automatisch grün |
| #334 | Plattenalarm / Uptime Kuma | Read-only Diskcheck mit Schwellen-, Messfehler- und CLI-Tests | Alarmziel, Hostinstallation und echte Kuma-Reparatur extern |
| #40 | Mail-Drosselung / DMARC | Begrenzte Instanzdrossel vor SMTP/DB/Kalender; 429, Retry-After, Isolierung, Ablauf testen; Kontaktmail escapen | Verteilte WAF-Regel und DNS/DMARC extern; Teilkarte bleibt offen |
| #33 | Serverless-Fehlererfassung | Gemeinsamer optionaler Helper, ausschließlich feste Metadaten; Fake-Transport beweist Datenminimierung | DSN/Vertragsumfang und echter Empfang separat; kein Live-Ereignis senden |
| #290 | DTA-Kennzeichen / Genehmigung | Vertikaler Datenvertrag bis vorhandenen ZHE/SKZ-Builder; Originalschlüssel, Allowlist, Herkunft und Roundtrip prüfen | db-ustasi bestätigt Speicherung; keine automatische Ableitung aus Diagnose/Freitext; Schemaänderung separat freigeben |
| #332 | Box-Vorbereitungssprint | Bestehenden KHS als übergreifende Abnahmematrix weiterverwenden; lokale Lücken konkret belegen | K3, echte Geräte/Neuinstallation, Stable/Soak und externe Nachweise bleiben eigene Prüfungen |
| #333 | Kaufkonto / Lizenzmail | Idempotenter Kauf→Lizenz→SMTP-Entwurf nach Produktentscheidung; Wiederholung und Mailfehler testen | Kaufmodell, Produkt, Lizenzdauer, Käuferidentität und Zustellbedingungen fehlen; keine SaaS-Abos als Box-Lizenz umdeuten |
| #336 | Rechnung nach Kundenlöschung | Vorhandene Erhaltung/Abrufwege dokumentieren; verifizierten Support-/Belegweg festlegen | Datenschutz-/Identitätsentscheidung; Account-Sperre nicht umgehen; keine ungeschützten Links |
| #337 | Stripe-Schlüssel im VPS | Konfigurationsanforderung prüfen, ausschließlich Variablennamen und Fehlermodus | Tatsächlichen Schlüssel weder lesen noch setzen; Betreiberprüfung erforderlich |
| #8, #31, #150 | IK/P12, Annahmebestätigung und Kassen-Test | Synthetische DTA-Tests und reproduzierbare Abnahmeanleitung vorbereiten | Zertifikat, autorisierte Testpraxis und echte Annahme liegen außerhalb lokaler Codeprüfung |
| #17, #24 | Ziel-URL / Launch-Smoke-Test | Konfigurationsvertrag und Testmatrix: Anmeldung→Onboarding→Buchung→Abrechnung | Betreiber-Env und echte Integration erst nach vorgelagerten Freigaben prüfen; keine Testzahlungen/Sendungen automatisch |
| #19, #20 | Stripe Tax / Radar | Aktuelle Herstellerdokumentation und Konfigurationscheckliste | Steuerentscheidung und Stripe-Panel; nicht durch Code oder blindes Aktivieren ersetzen |
| #34, #44 | Cookiebanner / Umami | Bestätigten Widerrufsfehler korrigieren: laufenden Versand sperren, nach gespeichertem Widerruf neu laden, bei Speicherfehler keinen alten Opt-in reaktivieren; synthetische Gegenproben | Keine neue Trackingaktivierung; bestehende Datenschutzentscheidung respektieren; realen Tracker beim Release prüfen |
| #23 | DKIM | DNS-/Microsoft-Schritt dokumentieren und später echte Zustellung prüfen | Betreiberkonto/DNS; kein lokaler Code-Ersatz |
| #25 | Intro / Hilfe-Center | Vorhandene Hilfen inventarisieren, verifizierte Bedienabläufe als Entwurf vorbereiten | Kein erfundenes Produktversprechen; Aufnahme und Veröffentlichung separat |
| #30, #29 | Support-SLA / Mitarbeiterverpflichtung | Bestehende Textstellen und Entscheidungslücken markieren; Entwurf nach Rechtsberatung | Antwortzeiten sind betriebliche Zusage; Unterschrift/Vertrag keine Codeaufgabe |
| #12, #16, #14, #15, #11, #248 | Gesellschaft, Partnerschaft, Rechteübertragung, Versicherung, Steuerberatung, Kontrolltermin | Bestehende Beschlüsse und Zuständigkeiten zusammenführen | Gründer-/Notar-/Steuerberater-/Versicherungsentscheidung; kein Vertrag, Kauf oder Terminversand ohne Auftrag |
| #125, #242 | Adminkonto / Testkontenbereinigung | Rollen-/Offboarding-Grenzen und synthetische Prüfschritte planen | Keine Konten anlegen oder löschen; Aufbewahrung und echte Nutzung vorher prüfen |
| #338 | VKZ02-Nachforderung | Originalanspruch, unveränderliche Ursprungsposition und Doppelabrechnungsschutz zuerst spezifizieren | Nur bereits entstandene vergessene Ansprüche; keine nachträgliche Freigabe späterer Sitzungen; Fach-/Schemaentscheidung vor Code |
| #339 | „VO folgt“ | Planungsvorgang und abrechenbare Verordnung fachlich trennen; bestehende Zuordnung wiederverwenden | Behandlungsbeginn, Nachreichung und Abrechnung nicht automatisch legitimieren; Fach-/Datenmodellentscheidung |
| #184 | Zeit-Presets | Bestehenden Auslöser prüfen; danach gemeinsamen Termin-/Leistungsweg erweitern | Kundenbedarf/Schwelle noch nicht bestätigt; keine freie Änderung verbindlicher GKV-Zeitregeln |
| #202, #251 | Mehrere Heilmittel / Einheitenänderung | Physio/Ergo/Logo-Datenvertrag und Historie vor Umsetzung; mehrere Positionen und keine rückwirkende Belegänderung testen | Eigener Fachbereichsumfang; Podologie-Freigabe nicht übertragen |
| #131, #132, #48 | Logo-/Physio-Kataloge / Ergo-Blanko | Offizielle gültige Quellen deterministisch mit Katalog abgleichen; gefundene konkrete Differenzen einzeln bearbeiten | wissensbank-Eingangsprotokoll; Zahlentabellen nicht per Modell konvertieren; nach Podologie-Fokus |
| #6, #1, #2, #78, #108, #95, #214 | eGK/TI, Anbieter, Lesegerät und automatische Stammdaten | Zuerst erlaubte Schnittstelle und Gerätevertrag klären; danach Adapter mit synthetischen Kartenfixtures | Fach-/Rechts-/Herstellerzugang; keine Geräte-/TI-Daten aus Vermutung implementieren |
| #26, #335 | PWA / Praxis-SMTP | Nach Launch: Offline-/Cachegrenzen bzw. Praxis-Postfachmodell spezifizieren | Keine PHI im Service-Worker-Cache, keine SMTP-Secrets im Browser; Bedarf und Betriebsabnahme |
| #170, #35, #41, #21, #28, #63 | Bedingte Datenebene, PITR, Snapshots, Fremdwährung, ISO, Quellenmonitor | Bestehende Auslöser prüfen; passende kleine Vorbereitung statt neue Plattform bauen | Bestehende Entscheidungen gelten: Bedarf/Plan/Kundenschwelle; kein Kauf, neue Cloud oder n8n-Workflow |

Kontrollsumme: 53 eindeutige IDs. Unteraufgaben bereits erledigter Karten nicht neu geöffnet.
Boardtexte enthalten historische Widersprüche, u. a. Enterprise-Preis und Mobilstatus.
Die einzelnen gesetzten Häkchen und konkrete Codebelege haben Vorrang vor altem Sammeltext;
sie ersetzen jedoch keine aktuelle Live-/Kundenabnahme.

## Verifikation und Releasefolge

- Vor Code: betroffene Dateien und fremde Änderungen sichern/zuordnen; beratene Regeln
  und wiederzuverwendende Funktionen festhalten.
- Pro Paket: reproduzierbarer Fehler oder konkreter Vertrag, minimale Änderung,
  aussagekräftige Regression mit ausschließlich synthetischen Daten.
- Danach: passende Tests, Typecheck, Größen-/Diff-/Funktionskartenprüfung; lokale
  Browserprobe für geänderte UI, kleine und große Viewports. Keine echte SMTP-/Sentry-Sendung.
- Neue Funktionen nachträglich an fonksiyon-ustasi melden: Absicht und erster Einsatz;
  erzeugte Funktionskarte aktualisieren. Fortschritt in genau einer Tagesdatei.
- Lokale Vorbereitung und bereits früher angelegte Änderungen getrennt berichten.
- Erst nach konkretem Release-GO: saubere Integration mit fortgeschrittenem main,
  autorisierte Migration samt echtem Schemaexport, Deployment, technische Liveprüfung,
  Box-/Praxisabnahme, dann belegtes Schließen passender Ops-Teilpunkte.

## Quellen und Recherchegrenzen

- Ops-Board: https://ops.infinitymade.de/#todo (Chrome, lesend 21.10.2026).
- Projektregeln, `TODO.md` §1, `KUTU_HAZIRLIK_SPRINT.md`, Funktionskarte,
  `db/README.md`, `konsey/KARARLAR.md` und aktuelle Zielquellen.
- Offizielle Vercel-Dokumentation: https://vercel.com/docs/headers/request-headers
  und https://vercel.com/kb/guide/add-rate-limiting-vercel . Instanzspeicher ist
  kein verteilter WAF-Zähler; keine neue Datenbank nur für Drosselung vorgesehen.
- Umami-Widerruf: https://docs.umami.is/docs/tracker-configuration#data-before-send
  dokumentiert den abbrechbaren Versand-Hook ab 2.18.0. Der lokale Test prüft den
  Hook-Vertrag; die produktive Tracker-Version wurde nicht festgestellt.
- Sentry: https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/
  beschreibt isolierte Clients ohne globale Integrationen. Verwendet wird die bereits
  im Backend vorhandene SDK-Version 8.55.2, jetzt zusätzlich als exakt gebundene
  Root-Abhängigkeit für die getrennten Vercel-Funktionen; kein SDK-Upgrade des Backends.
- Stripe: https://docs.stripe.com/api/customers/delete und
  https://docs.stripe.com/customer-management/activate-no-code-customer-portal .
  Das Portal hat einen eigenen E-Mail-Loginweg; dessen Verfügbarkeit nach Beendigung
  und mit dem konkreten Kundenbestand ist hier nicht getestet. Ein abrufbarer gelöschter
  Customer ist kein Beleg für einen funktionierenden Kundenzugang zu Rechnungen.
- §302-Vorprüfung anhand archivierter Original-TXT, Anlage 1/3 TP5 V21. Ein voller
  neuer DTA-Fachumfang benötigt zusätzliche aktuelle Gültigkeitsprüfung.
- Kontextbridge lieferte bei Modellaufrufen kein strukturiertes Ergebnis. Gezielter
  Direktfallback; kein Providerwechsel, keine behauptete gemessene Tokenersparnis.

## Umsetzungsnachweis

Lokale Umsetzung der begrenzten Pakete und Tests stehen in `fortschritte/2026-10-21.md`.
Gesamtkarte #291, verteilter Schutz #40, echte Alarmierung #334 und aktivierte
Fehlererfassung #33 bleiben trotz lokalem Teilnachweis offen.

## Konsey-Entscheidung

Beraten: fonksiyon-ustasi, gkv-302, db-ustasi, legal-de, guvenlik, onprem,
muhalif und deger-mi. Zusätzlich unabhängiger Code- und Sicherheitsreview.

**Entscheidung:** begrenzte lokale Korrekturen vor neuen Fach-/Kaufprozessen. Keine
unbestätigten Blanko-Vergütungszonen; bestehende Pflichtsignale erhalten. Mailbremse
ehrlich als Instanzschutz ausweisen. Telemetrie muss das endgültig transportierte
Envelope nach Positivliste rekonstruieren. DTA-Persistenz weder in BG-Felder noch in
überschreibbare berechnete Daten verstecken. Kauf-/Lizenzmodell nicht erfinden.

**Begründung:** verhindert gegenwärtige falsche Sicherheit, ohne unbekannte Verträge
oder Betreiberentscheidungen als Code festzuschreiben. Bestehender DTA-Builder wird
wiederverwendet, sobald der vollständige Datenvertrag beschlossen ist.

**Ödün / Abwägung:** keine vollständige DTA-Erfassung, keine globale Mailbegrenzung,
keine betriebsbereite Alarmierung und keine Aktivierung neuer Telemetrie in dieser Runde.

**Übereinstimmung:** alle Berater tragen diesen begrenzten Umfang mit Bedingungen mit.
Keine ungelöste Gegenposition oder hartes Veto; zweite Konsey-Runde deshalb entfallen.
Der unabhängige Review führte zu einer zusätzlichen Transportgrenze samt Gegenprobe.

## Konkrete spätere Betreiberabnahme

- **Telemetrie:** `SENTRY_SERVERLESS_ENABLED=1` und `SENTRY_DSN_SERVERLESS` nur nach
  Prüfung des bestehenden Sentry-Vertragsumfangs setzen. Helper akzeptiert ausschließlich
  HTTPS-DSNs mit `o<Ziffern>.ingest.de.sentry.io`. Release optional als 40-stelliger
  `VERCEL_GIT_COMMIT_SHA`; keine Inhalte oder beliebige Releasezeichenketten. Vor echten
  Daten mit synthetischem Ereignis insbesondere Empfang nach behandeltem 5xx und
  Vercel-Response-Ende nachweisen. Ohne beide Einstellungen bleibt SDK/Transport aus.
- **Diskcheck:** `node tools/diskcheck.mjs --path / --warning 80 --critical 90`.
  Exit 0 OK, 1 WARNING, 2 CRITICAL, 3 UNKNOWN. Auch UNKNOWN muss alarmieren. Nur das
  gewählte Dateisystem wird gemessen; separate Docker-/Backup-Mounts getrennt prüfen.
  Unter WSL misst dies nicht verlässlich den Windows-Host. Keine Installation enthalten.
- **WAF:** nur POST auf `/api/contact` und `/api/demo-booking` gezielt erfassen.
  Verteilte Zähler im vorhandenen Vercel-WAF zunächst großzügig im Logmodus prüfen;
  normale Anfragen, gemeinsame Praxis-IP, Buchung und Verschieben gegenprüfen. Danach
  Preview/Produktionswirkung separat freigeben. Keine WAF-Regel wurde angelegt/aktiviert.
- **Cookie:** realen Umami-Tracker einschließlich automatischer und manueller Events
  bei Akzeptieren → Widerruf → Seitenwechsel testen. Bereits abgeschickte Requests
  können nicht rückwirkend zurückgerufen werden. Lokaler Nachweis benutzt keine
  produktive Analytics-Verbindung.
- **Integration:** gemeinsamer Checkout bleibt hinter `origin/main`; vor Release
  eigene Änderungen mit dortigem Stand kontrolliert zusammenführen. Kein automatischer
  Pull/Reset und keine Freigabe anhand eines veralteten lokalen Schemaexports.

## Fortsetzung: nächster ausführbarer Block nach Bestandsprüfung

Stand der Fortsetzung 21.10.2026: **Analyse und Planung abgeschlossen; Umsetzung
nicht freigegeben und nicht begonnen.** Neue Befunde ergänzen den Beschluss oben;
die fünf lokalen Teilpakete werden nicht wiederholt. Vollkarten und externe
Abnahmen bleiben offen. Fortschrittsnachweis: `fortschritte/2026-10-21.md`.

### Fragestellung und Beratung

A) #290-Datenvertrag vorbereiten, B) konkrete lokale #332-Lücke bearbeiten oder
C) zuerst versionsbezogene Überschneidungen klären? Anlass: gemeinsames dirty main
liegt inzwischen 140 statt 85 Commits hinter vorhandenem origin/main. Rückbaukosten
steigen bei neuen Abrechnungs-/Schemaänderungen vor diesem Abgleich. On-prem-Effekt
des Vorbereitungsblocks: ausschließlich lokale Dokumente und synthetische Spezifikation,
kein neuer Datentransit oder Cloud-Dienst.

Beratung in drei lesenden T3-Codex-Aufträgen, mit Rollenbeschreibungen:
1. fonksiyon-ustasi + db-ustasi;
2. gkv-302 + legal-de + guvenlik + onprem;
3. muhalif + deger-mi.
Das sind acht Rollenperspektiven in drei Reviews, keine acht unabhängigen Gutachten.
Provider/Modell: Codex / gpt-6.1-sol, reasoningEffort medium, serviceTier default.
Keine Beratung führte Änderungen, Tests oder produktive Zugriffe aus.

### Neu belegte Voraussetzungen

- **Git:** HEAD `4e107c9ab5a1183d1cb3babeceb8a0574105f57b`, Tracking-Ref
  `origin/main` `ce2bdaaa428e3bb4d78262989019ae90cd3e625b`, 0 voraus / 140 zurück.
  Kein Fetch. Tracking-Ref weder frisch abgefragtes Remote noch Live-Nachweis.
- **Migrationen:** lokale `0079_ausfall_zahlung_faelligkeit.sql` und
  `0080_request_approve_atomic.sql` entsprechen im SQL-Inhalt origin/main
  `0081_ausfall_zahlung_faelligkeit.sql` bzw. `0082_request_approve_atomic.sql`.
  Einziger Textunterschied jeweils: zusätzliche SaaS-Anwendungsnotiz vom 17.10.2026
  in origin/main. Vollständige SHA-256 daher verschieden. Lokale Nummern 0079/0080/0081
  sind upstream bereits anderweitig belegt. Nicht erneut anwenden oder blind umnummerieren;
  tatsächlicher heutiger SaaS-/Boxstand hier nicht geprüft. Lokale
  `0081_warteliste_referenzen_abrechnungsrechte.sql` fehlt unter diesem Namen upstream;
  semantische Überschneidung mit dortigen Sicherheitsmigrationen bleibt zu klären.
- **Quellüberschneidung:** origin/main verändert bereits `abrechnung.routes.js`,
  `preflight.js`, `regel-schwere.js`, Rezeptmaske, Anfrage-/Ausfallpfade und KHS.
  Beide bestehenden DTA-Mapper bleiben Wiederverwendungsbasis:
  `abrechnung.routes.js:513` und `:3613`, ZHE/SKZ in `builder.js:533–540,583–589`.
  Neue Kennzeichen dürfen nicht über parallele Builder eingeführt werden.
- **KHS-Entscheidungsdrift:** origin/main:KUTU_HAZIRLIK_SPRINT.md:28,563 hält
  Entscheidung vom 14.10. fest: 72-Stunden-Soak keine K3-Voraussetzung;
  Stable-Frage separat vor erster Kundenbox. Lokale ältere Sammeltexte nicht als
  neue Pflicht interpretieren. Keine Box-/Stableprüfung in dieser Fortsetzung.
- **Quellenfehler:** `wissensbank/SPEC-RULES.md:1314–1316` verweist für Heilmittel-SKZ
  auf Anlage 1 TXT:2876–2881; dort steht SLLA A/Hilfsmittel. Heilmittel-SKZ steht
  im selben V21-Original in SLLA B, TXT:3504–3535, Seiten 72–73. Original gezielt
  gegengeprüft; SPEC-RULES noch nicht geändert. Keine heutige externe Versionsprüfung.
- **Karten:** Funktionskarte aktuell (3597 Funktionen / 451 Dateien);
  `db/NUTZUNG.json:2–5` noch Stand 09.10.2026. Nicht ungeprüft als aktuelle
  Vollständigkeitsquelle behandeln. `tools/tabellenkarte.mjs:236` schreibt bedingungslos;
  deshalb hier auch nicht mit vermeintlich lesendem `--check` gestartet.

### Entscheidung: C vor #290-0; #332 nur bei konkret belegter Lücke

**Nächster Block C, K1: begrenzte Integrations- und Entscheidungsgrundlage.**
Ausführung zunächst als Dokumentationsarbeit; keine Git-Integration oder Codeänderung.
Datei-/Verantwortungsgrenze: betroffene API-/DB-Pfade der vorhandenen lokalen Pakete
und #290-Einstiegspunkte, vorhandener KHS und Tagesbericht. Keine neue Gesamtprüfung
aller 53 Punkte, kein zweites dauerhaftes Aufgabenboard.

- [x] ~~Arbeitskopie, HEAD und gepinnten Tracking-Stand pro betroffener Datei abgeglichen;~~
  Zuordnung **schon enthalten / lokal zusätzlich / teilweise überlappend / ungeklärt**
  mit Zeilen-/Commitbeleg festhalten. Fremde Anteile ausdrücklich kennzeichnen.
- [x] ~~Migrationen 0079–0081 lokal gegen upstream 0079–0086, Runner-Prüfregeln und
  veränderte API-Aufrufer abgeglichen.~~ Keine Nummer oder Prüfsumme ändern. Für jede
  lokale Änderung eine spätere Integrationsentscheidung und verantwortliche Rolle nennen.
- [x] ~~KHS-Entscheidungsdrift und historische „noch nicht angewandt“-Notizen mit
  versionsbezogenen Belegen gekennzeichnet.~~ Herkunftsnotiz ersetzt keine Liveprüfung.
- [x] ~~Ergebnis von fonksiyon-ustasi, db-ustasi und onprem gegengeprüft.~~

**Abnahme C:** Jede betrachtete Änderung hat Status, Herkunft, Überschneidung,
Verantwortlichen und nächsten Schritt. Offene Konflikte sind einzeln benannt;
kein pauschales Integrations-GO. Bereits vorhandener SQL-Inhalt wird nicht neu
implementiert. Noch keine Laufzeit-/Live-Abnahme. Danach Stopppunkt vor Integration.

**Folgeblock #290-0, K2: Quellen- und Datenvertrag, ebenfalls ohne Schema-/UI-Code.**

- [x] ~~Mit wissensbank/gkv-302 Quellenverweis korrigiert und Originalversionsbasis
  abgeglichen.~~ Keine Zahlentabellen per Modell konvertiert oder Dokumente heruntergeladen.
- [x] ~~Feldmatrix dokumentiert~~ für `verordnungsbesonderheiten`, `unfallkennzeichen`,
  `bvgSonstigesSer`, `genehmigung.{kennzeichen,datum,art}`: Original/Bereich/Version,
  zulässige Fälle und Werte, leer/ungültig, Herkunft, erlaubte Bearbeiter, Freeze-/Korrekturweg.
  Keine automatische Ableitung aus Diagnose/Freitext oder pauschaler SKZ-Pflicht.
- [x] ~~Mit db-ustasi Persistenzvorschlag am einzigen Verordnungspool `prescriptions`
  dokumentiert.~~ Endgültige Persistenzform ausdrücklich als B2 blockiert; BG-Spalten,
  überschreibbares `computed`, Artefaktdateien und zweite Verordnungstabelle bleiben
  ausgeschlossen. Vorschlag ist keine Schemafreigabe.
- [x] ~~Beide vorhandenen Mapper, Save-/Reopen-Pfade und spätere Original-/Korrektur-DTA
  im Vertrag verbunden; konkrete synthetische Sollfälle formuliert:~~ positiv, leer, ungültig,
  Fremdmandant, fehlendes Mitarbeiterrecht, Wiederöffnung/Neuberechnung,
  unveränderter Altfall und unveränderliches ausgestelltes Artefakt.
- [x] ~~Onprem-Upgrade-/Altversionsverträglichkeit, Fehlerverhalten und spätere
  Migrations-/Schemaexport-Abnahme als Anforderungen festgehalten.~~ Nicht getestet;
  neue Migrationsnummer erst nach tatsächlichem Basisabgleich.

**Abnahme #290-0:** Jede Feldentscheidung belegt oder ausdrücklich blockiert, beide
Mapper adressiert, Rechte-/Korrekturfragen zugeordnet, synthetische erwartete Segmente
beschrieben. In-Memory-Builderprüfung, echter Persistenz-Roundtrip und Kassenannahme
sind getrennte Nachweise. Erst danach vertikale Implementierung eigens beauftragen.

### Abwägung und Grenzen

Übereinstimmung: C als kleine Voraussetzung, danach A als vorbereitender Vertrag.
B hat bislang keine neue reproduzierbare lokale Codelücke. Kein ungelöster Widerspruch,
deshalb kein zweiter Konsey-Durchgang. Harte Bedingungen aus Recht/GKV/Sicherheit/Onprem
bleiben: keine geratenen Schlüssel, keine geschwächten Mandanten-/Belegsperren,
kein neuer zentraler PHI-Transit. Keine neue fachliche oder rechtliche Releasefreigabe.

Abwägung: neue #290-Funktion wartet; dafür keine doppelte Migration und kein Ausbau
gegen überholte Entscheidungen. #291-Vertragsampel, #333/#336, K3, Stable, reale
Betreiber-/Geräte-/Kassenabnahmen bleiben außerhalb dieses lokalen Blocks. Bestehende
geschlossene Entscheidungen werden nicht neu verhandelt.

Heute erneut geprüft: gezielte Quellen, Git-Referenzen, Funktionskarten-Frische und
Dashboardgröße. **Keine Testwiederholung:** 3757/3757 bleibt Vorlaufnachweis.
Keine Migration, Codeänderung, Konten-/Ops-Änderung, Sendung, Commit, Push oder Deployment.

## Block C — abgeschlossener Herkunfts- und Integrationsabgleich

**Nur Analyse abgenommen.** Drei neue lesende Rollenreviews: fonksiyon-ustasi,
db-ustasi, onprem mit Sicherheitsgegenprüfung. Alle akzeptieren C; kein Integrations-,
Schema- oder Release-GO. Kein neuer #332-Codeauftrag. Vergleichsbasis HEAD
`4e107c9ab5a1183d1cb3babeceb8a0574105f57b` gegen gepinntes
`37a611b97fbd97a6585d46d9436c14f5c6f9f59e` (144 Commits voraus), einschließlich
Arbeitskopie. Dieser Stand ersetzt für C den früheren Tracking-Stand ce2bdaaa.
Kein Fetch durch diesen Agenten; heutiger Livezustand unbekannt.

### Dateizuordnung und Verantwortung

- **Schon enthalten, Arbeitskopie bytegleich gepinntem upstream:**
  `billing/api/ausfall.routes.js`, `billing/api/mahnwesen.routes.js`,
  `booking/auth-guards.js`, `booking/series.js`, `booking/warteliste-zeitfenster.js`
  (jeweils unter `api-backend/`), außerdem `module/rechnung-zahlungseingang.js`
  und `module/warteliste-zeitfenster.js`. Hauptagent: nicht erneut implementieren
  oder als eigene neue Leistung ausweisen. Bytegleichheit ist keine Laufzeitabnahme.
- **Lokal zusätzlich, bisheriger HEAD und upstream gleich oder Pfad in beiden fehlend:**
  fünf bekannte Pakete einschließlich `module/blanko-hinweis.js`, `cookie-consent.js`,
  `tools/diskcheck.mjs`, `api/_lib/{mail-rate-limit,mail-html,telemetry}.js`,
  `api/contact.js`, `api/demo-booking.js`; außerdem
  `api-backend/billing/api/rechnung-zahlung.routes.js`,
  `api-backend/booking/{patienten-namensabgleich,status,html-escape,widget-guards}.js`,
  `module/anfrage-bearbeiten.js`. Hauptagent/fonksiyon-ustasi: lokale Absicht
  erhalten, nach späterer Integration gezielt regressionsprüfen. Zugehörige Wrapper-
  und Testdateien nicht durch Dateiaustausch verlieren. Keine fachliche Freigabe
  allein aus dieser Herkunftskategorie ableiten.
- **Arbeitskopie = HEAD, upstream weiterentwickelt:**
  `api-backend/billing/api/abrechnung.routes.js`, `api-backend/billing/dta/preflight.js`,
  `module/verordnung-maske.js`, `api-backend/db/migrate.js`.
  Hauptagent/fonksiyon-ustasi: beim späteren Abgleich dortige Entwicklung erhalten;
  insbesondere #290-Vertrag auf beide aktuellen Mapper ausrichten.
- **Beidseitig verändert:** `api-backend/server.js`,
  `api-backend/booking/from-request.js`, `api-backend/billing/api/warteliste.routes.js`,
  `api-backend/db/erwartete-zaehler.json`. Hunkweise Entscheidung erforderlich,
  kein pauschaler Dateiaustausch. Funktion: fonksiyon-ustasi; Daten/Zähler:
  db-ustasi + onprem. Semantische Erhaltungsregeln stehen nachfolgend.

### server.js und Anfragekette: verbindliche Erhaltungsregeln für spätere Integration

1. **Bereits gemeinsam:** authentifizierte Booking-Guards, Serienweg und atomare
   manuelle Bestätigung (upstream Herkunft u. a. `ddf27ed2`). Nicht doppelt einbauen.
2. **Lokal erhalten:** Widget-Status-/Praxisendpunkte und Drosseln, Literalnamen-
   Prüfung, mehrdeutige öffentliche Patientensuche, Datumspflicht vor Bestätigung
   sowie Mail-Escaping. Zielstellen Arbeitskopie `server.js:182,3902,4024,4055,
   4115,4162,4208,4404,4469`; Aufrufer `booking-request.js:342`,
   `widget/booking-widget.js:88,90`, `module/anfrage-bearbeiten.js:280`.
3. **Upstream zusätzlich erhalten:** HH:MM:SS-Normalisierung in `server.js:338`
   des gepinnten Commits (`bce526ef`); Leadzuordnung, Frequenzvarianten und sicherer
   Rezeptabgleich (`be9a5fcc`, `283ec7c0`, `42c75fba`). In `from-request.js`
   `leadId` und atomaren `commit` gemeinsam weiterreichen; erweiterte Patientprojektionen
   in allen drei Anfrageaufrufern erhalten. Lokale Widget-/Datumsgrenzen bleiben.
4. **Datenabhängigkeit:** upstream `0085_request_approve_lead.sql:65–75`
   prüft Mandantenzugehörigkeit und schreibt `lead_id` atomar. JavaScript allein
   reicht für diese Integration nicht. SQL-Inhalt lokaler 0080 darf später nicht
   erneut darübergespielt werden: sonst ginge die neue Leadbindung verloren.
5. **Onprem erhalten:** upstream Boxstatus vor Wartungsmodus/Accesslogger
   (`server.js:432–448`, `3e2a812b`) und begrenzter Migrations-Verbindungsretry
   (`73ed40e4`, Timeoutkorrektur `81148523`). Fehler in SQL/Checksum/Downgrade
   dürfen nicht als vorübergehende Verbindungsfehler wiederholt werden.
6. **Kein Telemetriefehler aus Stilunterschied:** lokal `!SUPABASE_PUBLIC_URL`
   und upstream `!istKutu()` sind bei upstream `lib/dagitim.js:2` verhaltensgleich.
   Zentrale Helperkonvention kann später übernommen werden; kein neuer Ops-Punkt.

### Migrationen 0079–0086: keine blinde Vereinigung

- **Lokal 0079/0080 bereits SQL-inhaltlich enthalten:** upstream 0081/0082,
  Herkunft `ddf27ed2`; nur erste SaaS-Kommentarzeile zusätzlich. Upstream 0079/0080
  haben andere Aufgaben (`42b400be`). Dateien nicht erneut anwenden oder blind
  umnummerieren. Kommentarunterschied verändert vollständige SHA-256.
- **Lokal 0081 vollständig zusätzlich:** Wartelisten-Referenzgrenzen (:3–31),
  nur Owner verändert Berechtigungen (:36–87), standortbezogene Rechnungs- und
  Zahlungsrechte (:93–136), exakte Bindung eines Zahlungsstornos (:143–164).
  Keine dieser Ergänzungen durch gepinnte upstream Migrationen 0079–0086 abgelöst.
  Lokale Wartelisten-Hydrierung `warteliste.routes.js:46–78` und JWT-Prüfung
  `rechnung-zahlung.routes.js:107–153,291` zusammen erhalten. RLS allein ersetzt
  diese Prüfungen bei service-role-Aufrufen nicht.
- **Upstream 0083** setzt ausschließlich feste search_path-Werte für vier Funktionen
  (`3c54314e`); **0084** bindet Storno in anderem Journal `belegliste`
  (`1ba74b9c`, :39–61). Beides ersetzt lokale 0081 nicht.
- **Upstream 0085** ergänzt Leadbindung und erhält statisch Ownerprüfung,
  Zeilensperre, Status-/Zeitstempelprüfung und service-role-only ACL (:24–36,97–98).
  **0086** gehört zur upstream Altsystemübernahme; keine freie neue Nummer daraus
  oder aus einer alten Planangabe ableiten.
- **Runnergrenze:** `migrate.js:68,83–91,109–119` — ganze SQL-Datei gehasht,
  doppelte Nummern abgelehnt, angewandte Checksummen geschützt. Hypothetische
  Vereinigung beider Dateimengen hat je zwei Namen unter 0079/0080/0081.
  Fehlende alte Ledger-Version wird als offen erkannt; deshalb vor echter Integration
  tatsächliches Ledger, Dateiname, Version und Checksum zuordnen. Kein Ledger patchen.
- **Zähler-/Exportgrenze:** lokale Dumps/README stehen auf 0078; gepinnte upstream
  README nennt 0080, RLS-Dump bereits 0086. Kein einzelner Header beweist heutigen
  vollständigen Livezustand. `erwartete-zaehler.json` nicht pauschal kopieren;
  spätere neue Sicherheitsmigration erst nach tatsächlicher Basis-/Ledgerklärung
  nummerieren, Zähler gemäß Projektverfahren neu belegen. Keine Messung fingieren.

### Prüfnachweise und verbleibende Ausführungsgrenze

- [x] ~~Herkunft, Überschneidungen, Verantwortliche und nächste Schritte für
  betrachtete Kandidaten dokumentiert.~~
- [x] ~~Drei Pflichtreviews und statische Gegenbelege abgeschlossen.~~ Keine
  verbleibende Gegenposition gegen Abschluss der C-Analyse. Telemetrie-Stilabweichung
  durch konkrete Helperdefinition als verhaltensgleich aufgelöst.
- [ ] **Später, nur nach Integrationsauftrag:** ausgewählte Änderungen zusammenführen;
  vorher tatsächliche Migrations-/Ledgerbasis autorisiert prüfen. Keine pauschale
  main-Übernahme, kein Pull/Reset in diesem Auftrag.
- [ ] **Danach synthetisch prüfen:** echte Zeitfunktion mit HH:MM und HH:MM:SS,
  Leadbindung in Auto/Approve/Accept-offer und atomarem RPC, Frequenzvarianten,
  Widget-/Namensgrenzen; Wartelisten-/Rechnungsrechte samt service-role-API und
  RLS; frische Installation, Upgrade, Wiederholung ohne neue Migration,
  Checksum-/Downgradeablehnung, Verbindungsretry und ownergeschützter Boxstatus.

Vorhandene Tests nur gelesen, nicht ausgeführt: `booking/from-request.test.js`,
`booking/approve-handler.test.js`, `booking/patienten-lookup-security.test.js`,
`booking/widget-guards.test.js`, `booking/status.test.js`,
`billing/api/warteliste-security.test.js`, `billing/api/rechnung-zahlung-security.test.js`;
upstream zusätzlich `booking/lead-aus-anfrage.test.js`, `db/migrate.test.js`,
`routes/status.test.js` und `lib/status.test.js`. Jeweils unter `api-backend/`.
Lokale Factorytests ersetzen Zeithelper durch Fake: kein Beleg für Produktionshelper.
Die 3757 früheren Tests belegen keine heutige Integration.

**C ist als Analyse abgeschlossen. Nächster Arbeitsblock: #290-0 Quellen-/Datenvertrag
gemäß obigem Plan, ausschließlich Vorbereitung.** Laufzeitintegration, Migrationsanwendung,
Tests gegen reale Systeme und Liveabnahme bleiben ausdrücklich unbegonnen.

## #290-0 — Vorbereitungsnachweis

Quellen-/Datenvertrag einschließlich sechs logischer Werte, beider Mapperpfade,
Zustands-/Herkunftsentwurf und neun synthetischer Sollfallgruppen dokumentiert:
[Vertrag und Blocker B1–B5](2026-10-21-ops-290-datenvertrag.md).
Drei Rollenreviews und unabhängige Dokumentationsgegenprüfung durchgeführt.
Quellenkorrektur in SPEC-RULES samt REGISTER-/INDEX-Bezug; zusätzlich durch Review
gefundene ungenaue Entlassmanagement-Zusammenfassung am Original präzisiert.
Öffentliche Veröffentlichungsindizes geprüft, keine neuen Dokumente heruntergeladen.

Vorbereitung abgeschlossen gemäß Kriterium „belegt oder ausdrücklich blockiert“.
Produktfälle, endgültige Persistenz, effektive Rechte, Freeze/Korrektur und
Migrations-/Versionsbasis bleiben B1–B5. Keine Gesamtfreigabe für #290 und keine
ausgeführten Tests, Migrationen oder Laufzeitänderungen. Nächster Schritt:
verbindliche Entscheidung dieser Grenzen vor eigener vertikaler Implementierung.

## #290 Zielumfang und #337 Konfigurationsnachweis

#290-Folgerunde: [Konsey-Zielentscheid im Vertrag §8](2026-10-21-ops-290-datenvertrag.md#8-konsey-zielentscheid-kleine-podologie-v1-umsetzung-weiter-zurückgestellt).
B1–B3 als neue/unberechnete Owner-only Podologie-v1 konkretisiert; B4 auf atomare
Quellenrevision, atomare Abrechnungsbindung und einmalige vs. wiederholte Bestätigung
reduziert. B5 bleibt tatsächliche Versions-/Ledger-/Upgradebasis. Umsetzung weiterhin
nach bestehendem Prioritätsbeschluss zurückgestellt; keine neue Bedarfsbehauptung.

- [x] ~~#337 lokaler Konfigurationsvertrag geprüft.~~ Express Recovery
  (`server.js:3184–3198`) benötigt `ADMIN_RECOVERY_SECRET` und `STRIPE_SECRET_KEY`;
  ohne Stripe-Key Antwort 500 vor Stripe-Aufruf. Offboarding mit vorhandenem Abo
  (`routes/dsgvo.js:164,212`; `dsgvo/loeschen.js:182–208`) bricht ohne Key vor
  Löschaktionen kontrolliert ab. Kein Beleg eines allgemeinen Startup-Zwangs.
- [x] ~~Zwei bestehende synthetische Fälle aktuell nachgewiesen.~~
  `routes/dsgvo.test.js:308,452`: **PASS 2/2, keine übersprungenen Fälle**;
  Dummy-Konfiguration, Mock-Supabase und Loopbackserver. Route502 und Fehlerstatus
  der Kette samt ausbleibender Auth-Kontosperre/-Löschung. Keine echten Schlüssel,
  Stripe-Aufrufe, DB-Verbindungen oder dauerhaften Konfigurationsänderungen.
- [ ] #337 tatsächliche VPS-Konfiguration durch Betreiber prüfen lassen; keine
  automatische Recovery, Kontenaktion oder Änderung. Ops-Punkt bleibt offen.

Details und exakter Testbefehl im Tagesbericht. 3757 Tests bleiben historischer
Gesamtnachweis; aktuelle 2 Tests sind gezielte Teilprüfung, keine neue Gesamtsuite.

## Erledigungsstatus je Ops-Karte (Stand 2026-10-21, lokal)

Legende: `[x]` = lokaler Umfang laut Spalte „Lokal sinnvoller Umfang" erledigt und lokal getestet;
`[~]` = Teilumfang erledigt, Rest offen. **Kein Häkchen ersetzt Live-/Betreiber-/Kassenabnahme;
die Ops-Boardkarten selbst bleiben offen** bis zur jeweiligen externen Abnahme.

- [x] #291 neutrale Blanko-Anzeige (Teil) — `[~]` Gesamtkarte: volle Ampel hängt an Fachentscheidung
- [x] #334 Diskcheck (lokal) — Hostinstallation/Alarmziel extern
- [x] #40 Instanzdrossel + Escaping (lokal) — `[~]` WAF/DMARC extern
- [x] #33 Serverless-Telemetrie (lokal) — DSN/echter Empfang extern
- [x] #34/#44 Cookie-Widerruf (lokal, Browsergegenprobe) — realer Tracker beim Release prüfen
- [x] #17 Stripe-Rücksprung-URLs (lokal, 36/36) — Vercel-Wert `NEXT_PUBLIC_URL` extern
- [x] #24 Konfigurationsvertrag + Testmatrix (lokal) — `[~]` Live-Smoke Teil: 4 PASS, 1 FAIL (QA-Daten), 3 nicht prüfbar (Owner-Zugang fehlt)
- [x] #337 Fehlermodus lokal belegt — VPS-Konfiguration extern
- [x] #19/#20/#23 Checklisten dokumentiert — Stripe-Panel/DNS extern (`[~]`)
- [x] #8/#31/#150 synthetische DTA-Tests 51/51 + Abnahmeablauf — Zertifikat/Annahme extern (`[~]`)
- [x] #30/#29/#125/#242 Entscheidungslücken dokumentiert — Vertrag/Konten außerhalb Code (`[~]`)
- [x] #131/#132 Preisabgleich (74/74 vergleichbare Positionen ohne Abweichung) — Katalog-Vollständigkeit offen (`[~]`)
- [x] #290-0 Vorbereitung — `[ ]` #290 Umsetzung (B1–B5)
- [x] #332 Lücken-Analyse (keine neue lokale Codelücke) — `[ ]` K3/Geräte/Stable extern
- [~] #338, #339 — fachlich spezifiziert (2026-10-21-ops-338-339-spezifikation.md), Umsetzung wartet auf Entscheidung
- [ ] #333, #336, #184, #202, #251, #48 — Fach-/Produkt-/Rechtsentscheidung nötig
- [ ] #6, #1, #2, #78, #108, #95, #214 (eGK/TI) · #26, #335 · #170, #35, #41, #21, #28, #63
- [ ] #12, #16, #14, #15, #11, #248 · #25
