---
titel: Feiertagshinweise — Berlin-Grenzen und ehrliche Abnahme
datum: 2026-11-10
typ: sitzung
tags: [feiertage, zeitzone, qa, koordination]
---

# Feiertagshinweise belastbar prüfen

Führender Belegindex bleibt `fortschritte/2026-11-06.md`; Verlauf und Testbefehl stehen in `fortschritte/2026-11-10.md`. Diese Notiz enthält Begründungen, keine zweite Restliste oder amtliche Feiertagsquelle.

## Warum korrigiert

Ein Termin am 24.12. um 23:30 UTC liegt in Berlin bereits am 25.12. Ein UTC-Stringpräfix und zeitzonenlose Querygrenzen zählen ihn falsch. `module/feiertage-knopf.js` verwendet deshalb bestehende Helfer aus `module/berlin-datum.js`: Berliner Tagesbeginn und exklusiver Beginn des Folgetags, anschließend Berliner Datum je Termin. Auch das aktuelle Jahr folgt Berlin.

Ein fehlgeschlagener Terminread beweist keine leere Liste. Erfolgreiches Schreiben und fehlgeschlagene Nachprüfung werden getrennt gemeldet. Schreib-Transportfehler verlangen Kontrolle vor Wiederholung; fehlschlagender Refresh wird nicht als gescheitertes Speichern ausgegeben. Knopf wird immer entsperrt.

`ignoreDuplicates:true` erhält bestehende Sondertage einschließlich Sonderöffnungen. Die Anzahl angefragter Zeilen beweist darum keine Anzahl neuer Einträge. Rückmeldung nennt Verarbeitung und unveränderte vorhandene Tage. Der bestehende Terminread hat keine Pagination: positive Trefferzahl ist eine Mindestzahl; Kalenderprüfung bleibt auch ohne Treffer verlangt.

## Beleggrenzen und Wiederaufnahme

Vier Tests vor Änderung rot, anschließend 33 gezielte Tests grün, null Skips. Getestet mit lokalen DOM-/DB-Doubles; kein RLS-/Browser-/Livebeleg. Unabhängiger Reviewer führte ersten 30er-Lauf selbst aus; drei ergänzte Randfälle anschließend durch Integrator geprüft. Originale Tests: `module/feiertage-knopf.test.js`, bestehende Feiertags-, Sondertag-, Importversions- und Berlin-Tests. Funktionsberatung vor/nach Änderung erfolgt.

Abgebrochener früherer Live-Test wegen Providerlimit gilt weiterhin nicht als Prüfung. Eigenes Preview steht am Login; keine andere Sitzung oder ausgeschlossene Identität übernehmen. Öffentlicher Modulabruf zeigt alte Importversion, nicht den lokalen Fix. Erst veröffentlichte Zielversion und bestätigte synthetische QA-Identität erlauben Liveabnahme.

Vor erneuter Integration HEAD, Remote, laufende Bearbeiter und Dateibesitz prüfen. Lokale Migration 0119 und Mail-Cooldown gehören zu neuen fremden Änderungen vor `origin/main`; ursprünglicher Releasevertrag schließt diese Erweiterung aus. Keine fremden Commits über Reset/Rebase umgehen und keine Migration ausführen. Neue Freigabe muss vollständigen Releaseumfang benennen. Zurückgestellte Widget-/Box-/Fußzeilenarbeiten bleiben zurückgestellt.

## Schemaorientierung ohne fingierten Export

DB-Beratung und Originaldiff 0119 zeigen: +1 Funktion/+1 Trigger nur im RLS-Kopf fortgeschrieben, Hauptschema-Kopf blieb zurück. Zwei Kommentarwerte auf 151/180 angeglichen, README von historischem 0111 auf Dateiköpfe 0119 berichtigt. SQL-Definitionen bleiben identisch; vorhandener Exportzeitpunkt wird nicht als neuer Export ausgegeben. Fehlende unabhängige Liveprüfung bleibt ausdrücklich offen. Die formale Kopfkorrektur verwendet ausschließlich dokumentierte Migrationsgate-Ausnahme; keine zusätzliche Migration oder abgeschwächte Prüfung.
