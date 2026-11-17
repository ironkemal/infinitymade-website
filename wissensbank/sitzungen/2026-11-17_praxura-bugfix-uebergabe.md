---
titel: Praxura Bugfix — Wissensstand und Claude-Übergabe
typ: sitzung
datum: 2026-11-17
tags: [praxura, bugfix, review, uebergabe]
---

# Praxura Bugfix — Wissensstand und Claude-Übergabe

## Stand und entscheidende Lernpunkte

Code bis `057765c0` lokal auf main committed, nicht gepusht. Punktweise Nachweise: `fortschritte/2026-11-17.md`. Ursprünglicher Auftrag liegt lokal in Downloads. Keine Live-Abnahme, Migration oder finanzielle Aktion. Paralleler Redesign-Worktree und fremde ungetrackte Dateien erhalten.

- IK hat zwei gültige Quellen. Allein Zertifikat zu prüfen war falsch; allein Profil zu prüfen ebenfalls. Reviewkorrektur `8b9d132c` berücksichtigt beide, inklusive Bannerzustand nach Speichern. Backend bleibt führend für tatsächliche Abrechnungsfähigkeit.
- Ein Bugfix darf funktionierende Rechnungserstellung nicht nebenbei sperren. `81bca4eb` ersetzt neue Straßen-Sperre durch Hinweis; fehlender Empfänger/Festschreibung behalten vorhandene Schutzregeln.
- Für Mitarbeiter ist Profil-ID nicht Praxis-Owner-ID. `057765c0` verwendet vorhandenes getOwnerId beim Anfragenladen.
- Standortloser Anwesenheitseintrag darf nicht still verschwinden und darf keinem Standort als zugeordnet ausgegeben werden. NULL-Einträge bleiben tenantbegrenzt, ausdrücklich gekennzeichnet.
- Altbeleg ohne Belegart/Rezept nicht nachträglich als Privatbeleg umklassifizieren. Sichtbare Preise und Warnung beheben Darstellung, gespeicherte Summen bleiben erhalten.
- Versteckte SPA-Seiten bedeuten nicht doppelte IDs. Begrenzte Browserprobe ohne DOM-Wachstum beweist keine langfristige Heap-Leak-Freiheit.

## Gemessene Nachweise und Grenzen

Letzter Code-Abschlusslauf: 5690 bestanden, 0 fehlgeschlagen, 4 übersprungen, 3 bestehende TODOs; Typecheck, Syntax, Dashboard-Größe und Hooks grün. Synthetische Browserprüfungen: 390/1440 px, hell/dunkel, keine Seitenfehler/ID-Duplikate/Seitenüberläufe; keine Schreibzugriffe oder externen Netzaufrufe. Detailrückkehr öffnet Rechnungsliste, Journal setzt laufenden Monat, Mailstatus bleibt im Ursprungsbereich und wird beim Wiederöffnen entfernt. Patientendialog bei 390 px visuell ohne Überlappung. Temporäre Nachweise unter `/tmp/praxura-bug-browser/`, kein dauerhafter Archivnachweis. Neu ausführen statt Verfügbarkeit vorauszusetzen.

Offen: unabhängige Claude-Gegenprüfung, spätere gesondert freigegebene Live-Abnahme; echte Passwort-/OAuth-/Kamera-/GPS-Prüfung. Weitere Fachentscheidungen im folgenden Prompt. Interne Sitzungsnotiz, keine amtliche/rechtliche Quelle; deshalb kein Eintrag in REGISTER/INDEX.

## Prompt für Claude Code

```text
Du übernimmst Praxura nach Codex. Arbeite in ~/infinitymade-website auf main, kein Feature-Branch. Lies zuerst AGENTS.md, CLAUDE.md und die dort referenzierten Pflichtregeln.

ZUERST UNABHÄNGIG KONTROLLIEREN, DANACH WEITERARBEITEN:
1. git status -sb, git log --oneline origin/main..HEAD und aktuellen HEAD prüfen. Übernommener Code-HEAD: 057765c0; danach folgt Dokumentationscommit dieser Übergabe. Zum Übergabezeitpunkt 33 lokale Commits vor origin/main, davon 12 übernommen und 21 neu inklusive Abschlussdokumentation. Zahlen können inzwischen abweichen. Fremde ungetrackte „Claude outputs/“-Dateien erhalten. Kein reset/clean/stash über fremde Arbeit.
2. Lies ~/Downloads/Praxura_Bug_Prompt_VOLLSTAENDIG.md und fortschritte/2026-11-17.md. Wissensfassung: wissensbank/sitzungen/2026-11-17_praxura-bugfix-uebergabe.md. Bericht ist Prüfauftrag, kein unabhängiger Beweis. Jeden Punkt P1 → P2 → P3 gegen aktuellen Code und passende Tests prüfen. Schon korrekte Punkte nicht erneut ändern; „Funktioniert“ schützen. Nicht vorsorglich refactoren.
3. Besonders drei Reviewkorrekturen unabhängig prüfen:
   - 8b9d132c: IK-Banner darf nur warnen, wenn profiles.ik_number UND terapeut_zertifikat.ik_nummer fehlen. Backend verwendet Zertifikat zuerst, Profil als Fallback (api-backend/billing/api/abrechnung.routes.js um 990–1011). Sofortige Banneraktualisierung in beiden Speicherwegen ebenfalls prüfen, inklusive Zertifikat-only-IK und Leeren der Profil-IK. Kein Zertifikat erzeugen oder DB schreiben zum Testen.
   - 81bca4eb: module/rechnung-snapshot.js meldet fehlende Straße nur; Rechnungserstellung bleibt möglich. Vorherige zusätzliche Sperre aus 646d27d6 wurde bewusst entfernt. Bestehende Schutzlogik bei fehlendem Empfänger und Festschreibung erhalten. Bestehende Rechnungen, Summen und Snapshots nicht korrigierend umschreiben.
   - 057765c0: loadAnfragen verwendet getOwnerId(), damit Mitarbeiter mit Praxis-Owner laden. Drei Tabs, fehlende Sitzung, einmaliger 401-Refresh, dauerhafter 401 und Netzfehler prüfen. Express hinter Traefik, kein n8n-Workflow ändern.
4. Weitere besondere Grenzen prüfen: Anwesenheit mit business_id NULL nur innerhalb desselben Owners, Kennzeichnung „Ohne Standortzuordnung“; Standortparameter validiert, Datum inklusive. Rechnungs-Altbeleg ohne invoice_type/Rezept: gespeicherte Werte anzeigen und Unklarheit melden, keine Umklassifizierung. Zuzahlung braucht tatsächliches GKV-Rezept; vorhandene Positionssteuern erhalten. DMRZ nur mit tatsächlich vom Exporter unterstütztem Rezept. Statistikreihe zeigt Zuzahlungen/Ausfallhonorare, nicht gesamten Barumsatz.
5. P3-4 und P3-5c sind geprüft, nicht blind als offen behandeln: nav-registry.js und deutsche Übersetzung heißen Warteliste; dashboard.html Überschrift ebenfalls. Statische sowie vier synthetische Browserkontexte ohne doppelte IDs. Zehn zusätzliche Bereichswechsel nach Aufwärmen ohne DOM-Zunahme; letzter Nachlauf 5075 → 5075 Knoten. Das beweist keine langfristige Heap-Leak-Freiheit. Bei Bedarf gezielt weiterprüfen, keine SPA-Neuarchitektur bauen.
6. Vollständige Prüfungen selbst wiederholen: npm test; npm run typecheck; sh tools/check-syntax.sh; sh tools/check-dashboard-size.sh. Letzter Code-Abschlusslauf: 5690 bestanden, 0 fehlgeschlagen, 4 übersprungen, 3 bestehende TODOs (Frontend 3001, Backend 2225 bestanden, Tools 355, Merkez 109). TODOs/Skips nicht als erfolgreich ausgeführte Tests ausgeben.
7. Browser mit synthetischen Daten bevorzugen: tools/redesign-harness.mjs, eigener freier Port; keine .env lesen. Temporäre Nachweise/Skripte unter /tmp/praxura-bug-browser* können fehlen. Bisher 390/1440 px, hell/dunkel: keine Seitenfehler, doppelten IDs oder horizontalen Seitenüberläufe; Rechnungsliste beim erneuten Öffnen, Monatszeitraum im Journal, Mail-Rückmeldungsreset bestätigt. Patientendialog bei 390 px nach Animation ohne Überlappung visuell geprüft. Keine echte Anfrage oder Mail abgesendet. Keine Live-Abnahme dieser lokalen Fixes.

DANACH FORTSETZEN:
- Bei bestätigtem Fehler Ursache reproduzieren, kleinstmöglich beheben, gezielt und benachbart testen; ein Punkt = ein lokaler Commit. Vor jedem Commit vorgeschriebene Gesamttests und Gates, Hooks nicht umgehen. dashboard.js darf nicht wachsen; neue Logik in vorhandene passende Module, Cacheversionen anpassen. Vor neuen Funktionen Pflichtberater fonksiyon-ustasi, bei Schemafragen db-ustasi; anschließend Funktionsabsicht melden und Karte aktualisieren. Fach-/Rechtsberater bei entsprechenden Änderungen gemäß Projektregeln nutzen.
- Wenn keine Fehler verbleiben: nicht neue Features erfinden. Prüfbericht mit pro Punkt Datei/Zeile, Ursache, Änderung oder „schon erledigt/kein aktueller Fehler“, Nachweis und Restgrenze aktualisieren. Wissensfassung/Tagesprotokoll pflegen.
- Offene Entscheidungen zunächst prüfen/planen, nicht still neue Fachregeln festlegen: Statuswörter zentral „Entwurf/In Behandlung“ gegen lokale „Erfasst/In Therapie“ (dashboard.js um 6966, module/anamnese.js); Fristenbündelung in computeRxDeadlineAlerts; Testmandanten-Mailsperre braucht Flag/Schemaänderung; rechtliche Prüfung der Standortadresse auf öffentlicher Buchungsseite.
- Melih erlaubt selbstständige lokale Entscheidungen und notwendige Bugfixes. Bei der Straßenwarnung ist Hinweis ohne neue Sperre bereits entschieden. Kein erneuter Freigabestopp für reversible lokale Arbeit.

HARTE GRENZEN:
Kein Push, Deploy, Env-Änderung, Migration oder Live-DB-Schreiben ohne gesondertes ausdrückliches GO. Keine Mail/Anfrage absenden, nichts kassieren oder löschen. Keine Secrets/.env, SETUP_TOKEN, Zugangsdaten, Patienten-/Kundendaten ausgeben oder ins Repo schreiben. PODOLOGIE_ORCHESTRATOR_PROMPT.md nicht anfassen. Redesign-Agent arbeitet parallel in ~/.t3/worktrees/infinitymade-website/redesign-delta-20261112: dort nichts ändern und nichts ungeprüft übernehmen. Vor jedem Schritt aktuellen Gitstand beachten.

ECHTE GERÄTE-/KONTOABNAHME bleibt separat:
Passwort ändern; Google-Kalender-OAuth; Kamera-Scan; GPS-Check-in. Nicht als erledigt behaupten, wenn kein echter Zugriff/Nachweis vorliegt. Ursprünglich explizit menschliche Aufgaben. Live-Lesen ist keine Live-Abnahme. Am Ende kurz auf Deutsch: bestätigte Befunde, lokale Commits, Tests, offen/ungeprüft. Kein Push.
```

## Kontrolle Claude (17.11.2026, nach Übergabe)

- Gesamtlauf wiederholt: 5690 bestanden, 0 fehlgeschlagen, 4 übersprungen, 3 TODO; alle Gates grün.
- Bestätigt: P1-1 (getOwnerId, 401-Pfade), P1-3 (Profil- ODER Zertifikat-IK), P1-6 (Owner-Grenze, Standort-UUID), P2-1a (nur Hinweis), P3-4 (kein „Verteiler" im Code).
- Rest-Fehler behoben: `754b5455` — Banner kennt die beim Speichern unter Abrechnung ins Zertifikat geschriebene IK (`banner.dataset.zertifikatIk`).
- Ungeprüft/offen: Live-Abnahme (nichts gepusht), Gerätetests (Passwort, Google-OAuth, Kamera, GPS), vier offene Entscheidungen.
