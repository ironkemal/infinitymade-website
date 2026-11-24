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

## Nachtrag 24.11.2026 (später) — KI-Stufe 2, Foto-Löschung, Übergabe an Codex

**KI-Stufe 2 entschieden** (`/konsey`, [[2026-11-24-ki-stufe2-byok]] in konsey/tutanak): **Option D** — eigener
Azure-Zugang nur auf der Box, nur über `.env` (`AI_BYOK_ALLOWED=1` + `AI_MODE=direkt`), Host
`<label>.(openai|cognitiveservices).azure.com`, `AI_REGION` Pflicht + EU, nie Jeton; keine UI/DB-Schlüssel, kein
lokales Modell (Fakten 12.09.: Box ohne GPU — legal-de nahm „lokal zuerst“ zurück). Jeton-Weg (O-169) hat Vorrang.
**Gebaut, lokal committet, NICHT gepusht** (Push nur mit Melihs GO durch die Hauptsession): 11c1bcc3 (Konsey-Doku),
5381fc2a (Host-Regel, `POST /api/ai/_verbindungstest`, UI „Verbindung testen“, compose, KURULUM, O-255),
07ffb750 (Review Hauptsession: Datenklasse A erzwungen — `allowFreeText=false` bei eigenem Host; nur Box über
Box-Marker `SUPABASE_PUBLIC_URL`). Offen: `.env.template`-Zeile (für Agenten gesperrt), CLAUDE.md-Warnsatz → Melih.

**Live-Check „Mein Profil“ bestanden** (Inhaber + Mitarbeiter, 1280/390, Originalwerte wiederhergestellt).
Befund P2 Datenschutz: „Foto entfernen“ leerte nur `avatar_url`, die Datei blieb im öffentlich lesbaren Bucket unter
festem Pfad abrufbar → 55971d34 (lokal, Push durch Hauptsession): Datei per `storage.remove` löschen, dann Verweis
leeren; Knöpfe 44 px. Zwei synthetische Testfotos der QA-Konten gelöscht (öffentlich ohne Cache 400; direkt danach
lieferte das CDN noch 200 aus dem Cache).

**Uncommittet beim Abbruch** (Limit): Team-Detail „Profilbild entfernen“ löscht die Datei ebenfalls
(`avatarPfadAusUrl` in module/praxis-logo-upload.js, dashboard.js empAvatarRemoveBtn, mein-profil nimmt alte
Team-Detail-Fotos mit, Versionskette `?v=20261124pf2`, Tests). Unit-Tests + Einstellungen-Probe grün, volle Gates
im sauberen Worktree stehen aus → Übergabe an Codex (Prompt im Chat 24.11., Inhalt: Regeln, Stand, Hashes, offene
Punkte). Backup-Branch `backup/main-vor-reset-20261124` nicht löschen.

**Lehren:** (1) Konsey-Beschlüsse („nur Datenklasse A“, „nur Box“) im Code erzwingen, nicht nur dokumentieren.
(2) „Entfernen“ in öffentlichen Buckets heißt Datei löschen, nicht nur Verweis leeren. (3) Ankündigung „nur
Entscheidung“ einhalten oder Abweichung sofort melden — sonst Push-Sperre bis Melihs GO.
