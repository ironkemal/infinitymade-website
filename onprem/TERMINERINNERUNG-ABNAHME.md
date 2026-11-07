# Terminerinnerung Phase A: Auslieferung und Abnahme

Stand07.11.2026. Produkt-O-206 bleibt bedingt abgenommen. Kein SMTP-Liveversand und keine SaaS-Migration ausgefuehrt.

## 1. Auslieferung bestaetigen

Push b8f3f489; GitHub Actions42359445726: Tests, Image-Smokechecks und Image-Publish erfolgreich. Das beweist keine Aktualisierung eines laufenden Containers. Naechster Nachweis: laufendes calendar-api-Image und OCI-Revision, /health im Container, /health/ready pruefen. SSH auf root@n8n.infinitymade.de derzeit blockiert: Host key verification failed. Vertrauenswuerdigen Hostschluessel zuerst ueber vorhandenen Administrationskanal bestaetigen; keine Hostkey-Pruefung abschalten. /api/health ist keine oeffentliche Healthroute (404); interne Route lautet /health.

## 2. SaaS-Migration0110 mit vollstaendigem Schemaexport

Supabase-Skill verwendet; db-ustasi bestaetigt folgende Reihenfolge. Produktprojekt njvuclullotbksskpwgk. Aktuell schon Kataloglesung verweigert: You do not have permission to perform this action. MCP-Verbindung muss neu autorisiert werden.

1. Nach Wiederherstellung zuerst nur Katalog, ACL und Migrationsledger lesen. Stand0111 neu bestaetigen; Tabellen, CHECK, UNIQUE-Schluessel, Trigger und Funktion pruefen. Neue Spalte fehlt oder entspricht exakt boolean NOT NULL DEFAULT false.
2. VOR Anwendung vollstaendigen Katalogexport mit tools/schema-export-katalog.sql sichern und tools/schema-dokumente.mjs im temporaeren Verzeichnis erfolgreich ausfuehren. Ungekuerzte JSON-Uebertragung nachweisen. Nicht anwenden, solange sofortiger Nachherexport technisch ungesichert ist.
3. Original0110 unveraendert atomar ueber apply_migration ausfuehren. Keine Baseline, kein Backfill, keine Wiederholung0111. Vorbereitungspaket und SHA256: Claude outputs/2026-11-04-dashboard-analyse-physio/0110-live-paket/.
4. Sofort nachpruefen: beide CHECK-Anlaesse, Spalte, genau ein Trigger, UNIQUE unveraendert, Funktionskoerper wie0110, SECURITY INVOKER/search_path pg_catalog, EXECUTE fuer service_role und kein PUBLIC/anon/authenticated. Keine Daten-/Versandprobe auf Produktivpatienten.
5. Vollstaendigen Nachherexport rendern. Metadaten aus echtem Ledger lesen: neueste Ledgerzeit kann0110 heissen, obwohl0111 bereits vorhanden ist. Soll: eine Spalte mehr; Tabellen/Policies/Funktionen/Trigger/Indizes unveraendert. Box-Zaehler nicht als SaaS-Zaehler verwenden.
6. db/SCHEMA.sql, db/SCHEMA-RLS.sql, db/README.md und Nachweis gemeinsam aktualisieren; Renderer-Tests und check-select-spalten; eigener Commit. Keine punktuelle Fortschreibung als Vollabzug ausgeben.

## 3. SMTP-Abnahme auf freigegebener Testbox

Testbox muss ausdruecklich benannt sein. Nur synthetischer Termin, freigegebenes Testpostfach und Praxis-SMTP; keine echten Patientendaten. Versand ist eigene reale Aktion und verlangt ausdrueckliches Versand-GO. Zugangsdaten ausschliesslich ueber privaten Secret-Kanal.

- Vorher: ausgelieferte Revision/Schema0110, gesundes Backend, Praxis-SMTP, Ownerrolle und Einwilligung ab Datenschutzv6 bestaetigen. Schalter zunaechst aus.
- Funktional: Inhaber schaltet ein, Reload zeigt Zustand; Mitarbeiter hat keinen Schalter. Fuer synthetischen Termin am Folgetag im Fenster18–22 Europe/Berlin echten Zeitjob beobachten.
- Belege: genau eine Mail, korrekter Absender/Datum/Uhrzeit/Praxis/Standort; kein Patientenname/Behandlungsgrund/Absagelink. Empfang und Darstellung im Postfach sowie Mitteilungsstatus gesendet bestaetigen. Kein Postfachinhalt in oeffentliches Repo.
- Wiederholung/Neustart darf keine zweite Mail erzeugen. Fehlende Einwilligung und ausgeschalteter Schalter duerfen keine Mail erzeugen. Abschliessend Testschalter aus; nur eigene synthetische Testdaten gemaess freigegebenem Testverfahren behandeln.
- Getrennt dokumentieren: Code, lokale Tests, Image-Publish, tatsaechliche Version, echter Versand, Postfachempfang. Erst danach Praxisfreigabe bewerten.

## 4. Phase B erst nach Phase-A-Abnahme

Vor Code: fonksiyon-ustasi, db-ustasi, onprem und Sicherheitsberater. Kleinster Schnitt: oeffentlich erreichbare Box per standardmaessig ausgeschaltetem Schalter; zufaelliges Token, nur Hash in DB, an Terminbeginn gebunden und nach Verschiebung ungueltig. GET zeigt Bestaetigung, keine Absage durch Mail-Linkscanner; Absage erst durch ausdrueckliche POST-Aktion. Parallel-/Wiederholungsfaelle atomar behandeln, Rate-Limit, keine Patientendaten im Token/Log.

Dashboard zeigt Absage und oeffnet vorhandenen Nachrueckerdialog auf ausdruecklichen Klick. Erst pruefen, ob Matching bereits abgesagte Termine unterstuetzt. Niemanden automatisch anschreiben. LAN-Box bleibt ohne Link; kein zentraler Relay. Alt-HMAC-Links separat kompatibel halten. Abnahme: Ablauf/Verschiebung/falscher Mandant/Parallelitaet/Scanner/Replay plus Wartelistenablauf; unabhaengiges Sicherheitsreview vor Freigabe.
