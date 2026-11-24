# Hauptsession 22.–24.11.2026: Testbox-Abnahme, Review-Kette und Übergabe an Codex

**Rolle:** Die Claude-Hauptsession leitet Melih durch die Box-Tests (immer ein Test zur Zeit) und prüft die Arbeit des Reparatur-Agenten („box-testbefunde-pflicht-fixes“) und anderer Sessions. Sie pusht nach Melihs GO. Ab 24.11. übernimmt Codex, weil das Kontingent knapp ist.

## Ergebnis Testbox (Hetzner, Kanal beta)
Dienste und Timer ✅ · Backup ✅ · Restore ✅ · Update mit Versionssprung ✅ · Mitarbeiter und Rechte ✅ · Firewall ✅ (muss am Server *angewendet* sein, KURULUM ergänzt) · Leerlauf ohne Außenverbindungen ✅ · Neustart ✅ · Handy ✅.
Migration 0130 auf der Box angewandt. Übrig ist 1 inaktiver Ex-Mitarbeiter ohne Zuordnung, das ist so gewollt.

## Gepusht und live geprüft (Auswahl)
- O-250 Standort-Button auf frischer Box · Handy-Leiste bei „Bewegung reduzieren“ (`translate` statt `transform`)
- 0130 Mitarbeiter-Zuordnung beim ersten Standort (SaaS + Box, Zählung danach 0)
- Phase 1–7b des Reparatur-Agenten:
  - Kalender in Woche, Entwurfs-Hinweis, Scanner-PDF 300 dpi, KI-Fehlertexte, Systemstatus
  - Check-in nur an zugeordneten Standorten (fail closed), „verspätet“ nach Regelarbeitszeit
  - Einstellungen in 5 Obergruppen / 16 Bereichen (`module/einstellungen-nav.js` = Datei des Redesign-Branchs), Mitarbeiter nur „Mein Konto“, Suche über Feldbeschriftungen
  - KI-Stufe 1 (Anbieter/Region, „Freischaltung“, Aufgaben an/aus), „Mein Profil“
- Rezept-Scan: Ein Bild ohne Barcode zeigt jetzt „kein Muster-13-Barcode gefunden …“ statt eines Sammeltexts (`3882a501`, `43c89774`). Ursache war ein Musterbild aus dem Internet ohne Barcode. Der Leser selbst war in Ordnung.

## Offen bei Übergabe
1. `55971d34` „Foto entfernen“ löscht die Datei im öffentlichen Bucket. Cherry-Pick auf origin/main vorbereitet (Konflikt nur `?v` → `20261124pf1`), Gates nicht gelaufen, nicht gepusht.
2. Option D (KI-Stufe 2, eigener Azure-Zugang nur Box über `.env`): `11c1bcc3`, `5381fc2a`, `07ffb750`. Reviewt; Freitext bei eigenem Host hart aus, an den Box-Marker gekoppelt. **Push nur mit Melihs GO.**
3. `.env.template` `AI_BYOK_ALLOWED=0` fehlt (für den Agenten gesperrt, nicht umgehen) · `AI_BYOK_ALLOWED` in die CLAUDE.md-Liste „nie auf SaaS setzen“ (Melih-GO).
4. Team-Detail `empAvatarRemoveBtn`: gleiches Foto-Lösch-Muster wie in 1.
5. OCR für Bilder ohne Barcode: Entscheidung bei Melih, zuerst ein echter Arztdruck-Test, sonst /konsey.
6. Migrationsentwürfe 0131/0132 (Option B): nicht in der Kette, nicht live.
7. Box-Tests nach `update.sh --jetzt` einzeln wiederholen. Testmail, 24-h-Außenverkehr, L2-Speicher (Kemal). Hetzner-Testserver danach löschen.
8. Melih hat sein Passwort in den Chat gepostet: Er soll es ändern.

## Gelernt
- **Gemeinsamer Ordner mehrerer Sessions:** nie dort committen; Worktree + Cherry-Pick, nur geprüfte Commits pushen. Einmal wäre fremde, unfertige Arbeit mitgerutscht; das wurde vor dem Push zurückgenommen.
- **Funktionskarte** nur im sauberen Worktree erzeugen. Zweimal enthielt ein Commit Funktionen aus fremden, uncommitteten Dateien.
- **Browser-Probe:** Exit-Code prüfen, nicht nur die PASS-Zeilen. Die Soll-Anzahl der Fälle war fest 42.
- **Frische Worktrees** hatten teils einen 0-Byte-Index. Lösung: Index löschen, dann `read-tree` und `checkout-index`.
- **GO eines Agenten** ist nicht Melihs GO. Rechtesperren anderer Agenten werden nicht stellvertretend umgangen.

Übergabe-Prompt für Codex: am 24.11. im Chat an Melih übergeben (Rolle, rote Linien, Worktree-Ablauf, offene Punkte 1–8, Box-Testreihenfolge).
