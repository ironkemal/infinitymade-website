# Einstellungen Phase 7b, KI-Aufgaben einzeln, „Mein Profil“ (23./24.11.2026)

Box-Fix-Agent, Melih: „alles frei, fehlerfrei“, danach „baue was offen ist“. Konzept:
[[2026-11-23_einstellungen-informationsarchitektur]]. Push jeweils durch die Hauptsession (Melih-Entscheidung).

## Ergebnis
- **Neue Ordnung der Einstellungen** (47009e59 + Fixes): 16 Bereiche unter 5 Obergruppen (Persönlich · Praxis ·
  Abrechnung · Kommunikation · System & Datenschutz), Bereichstitel + Kurzbeschreibung, „Auch hier einstellen ↗“
  statt Umhängen (Öffnungszeiten & Räume, Termin-Anfragen, Leistungen, Vorlagen, Team, Patientenpost-Absender),
  Gefahrenzone für „Konto & Daten löschen“, alte Links (#settings/allgemein …) weitergeleitet, Suche über Titel +
  Feldbeschriftungen. Mitarbeiter: Einstellungen erreichbar, nur „Mein Konto“ + Datenquellen. **Live geprüft** (canli-test).
- **Fehler aus der Bestandsaufnahme**: IK konnte über „Rechnungsdaten“ geleert werden, KIM/Telematik von drei
  Knöpfen gespeichert, Fax im SaaS sichtbar, Systemstatus-Fehler im SaaS, Sprünge in ausgeblendete Bereiche
  (eigene Regression) — alle behoben, Sprünge live geprüft.
- **QA-Fund kritisch**: Box ohne Löschknopf → MutationObserver-Endlosschleife (`zone.hidden = true` erzeugt bei
  jedem Lauf eine Mutation) → Seite fror ein. Behoben (toggleAttribute), Probe simuliert den Box-Fall.
  Lehre: Proben auch im **Box-Zustand** fahren, nicht nur im SaaS-Szenario des Harness.
- **KI-Stufe 1 komplett**: Anbieter + Region nur lesend (ohne Host), „Freischaltung durch den Praxisinhaber“ statt
  „Einwilligung“ (legal-de), **Aufgaben einzeln an/aus** (03645a79): Datei `<tenant>.aufgaben.json` neben der
  Freischaltung (keine Migration), Gateway prüft an allen 6 Freischaltungs-Prüfstellen, fail closed, kein logCall,
  Rate-Limit für PATCH /_config + /_aufgaben. guvenlik ✅, onprem ✅. Restrisiko: Rollback auf altes Image
  ignoriert die Datei (Freischaltung gilt weiter).
- **„Mein Profil“** (8b2867b3): Name + Foto selbst pflegen; Inhaber Vor-/Nachname (business_name = Praxisname!),
  Mitarbeiter Anzeigename; kein neues Recht nötig (profiles_update_own, avatars/<uid>/).

## Entscheidungen Melih
Struktur frei · verlinken statt umhängen · Ärzteverzeichnis bleibt in den Einstellungen · kein Protokoll von
Rechteänderungen · „Praxis geschlossen“ gestrichen · **neue Felder warten** (Terminraster/Takt, Recall,
Serien-Vorgaben, Fahrtpuffer, Nummernkreise) bis Partnerfragen #24/#25 — aktiv erinnern.

## Offen
- **KI-Stufe 2** (eigener Anbieter/Schlüssel): nur Box, nur Datenklasse A, feste Anbieterliste, encryptPHI in eigener
  Tabelle; Richtungsstreit legal-de (lokales Modell zuerst) vs. onprem (Azure-EU-BYOK zuerst) → `/konsey`.
- `ki-einwilligung.js` auf `lib/gehaerteter-json-store.js` umstellen (Kandidat, sicherheitskritisch, eigener Schritt).
- Nicht live prüfbar: Bereich System, KI aus (Box), Fußgrafik-Legende (kein Podologie-Inhaberkonto).

## Arbeitsweise-Lehren
- Gemeinsamer Arbeitsordner mehrerer Sitzungen: nur eigene Pfade stagen; Funktionskarte und Gates im **sauberen
  Worktree** mit nur eigenen Dateien erzeugen/fahren, sonst landen fremde Funktionen in der Karte.
- Testszenario (redesign-fixture) ist nur lesend → Erfolgsweg im echten DOM mit Attrappe prüfen.
