# Praxura Release-Übergabe — 06.11.2026

Status: vorbereitet, nicht veröffentlicht. Zentraler Integrator: Planungschat 015ef4bb-99c9-40fa-84c8-bf7bbaacb4bc. Führende Nachweismatrix: Tagesübergabe 2026-11-06.md; keine zweite Restliste.

## Konkreter Releaseumfang

Produktziel `4370dcb4`; Dokumentationsnachträge `28dd142d` und `1478c475` sowie dieser Übergabecommit. Remote-Basis `bcecbda35338571dd1f7cd8c91ce808e8cda3d53`. Vor Push exakten HEAD und Differenz erneut prüfen; neue fremde Produktänderungen sind nicht durch dieses Paket gedeckt.

- Slotparameter: ungültige Dauer/Schrittweite/Puffer vor Slotberechnung abweisen.
- Mailentwurf: lokale Nachweise zu Bearbeitung und Kopie inklusive Fußzeile.
- Erinnerung Phase A: Job, SMTP-/Einwilligungs-/Claim-Schutz und Inhaber-Einstellung. Standard aus; SaaS ohne 0110 zeigt keinen Schalter und startet keinen Erinnerungsversand.
- Migration 0110 nur im Box-Paket. Keine SaaS-Migration, kein Einschalten, keine installierte Boxabnahme.
- Karten-/Register-/Fortschrittsnachträge und README-Berichtigung auf vorhandenen Exportstand 0109.

Ziele eines später freigegebenen Pushs: origin/main, damit Vercel-Frontend sowie GitHub-Actions-Builds für Backend- und Frontend-Images. Backend-Watchtower kann neues Image automatisch übernehmen. Kein stabiler Boxkanal wird manuell hochgestuft. Allgemeine Auslieferung ist keine Nutzung von Yannicks Konto.

## Prüfstand und Grenzen

- 69 lokale Mail-/Erinnerungsregressionen, 14 isolierte PostgreSQL-Prüfungen, 4 Erinnerungseinstellungstests bestanden, jeweils null Skips.
- Funktionskarte: 4393 Funktionen / 542 Dateien, frisch.
- Unabhängiger Review mail_release_review auf bcecbda3..4370dcb4: kein neuer statischer Blocker. Keine pauschale Doppelversandgarantie für ältere Sondertag-Timeouts.
- Slotbeleg canli-test/2026-11-05-slot-parameter.md: 60 gezielte Tests und unabhängiger Review; Slotdateien seither nicht verändert. Kein neuer Livebeleg.
- Remote-Backend-Build bcecbda3: https://github.com/ironkemal/infinitymade-website/actions/runs/42007410539 (success). Letzter gelisteter Frontend-Image-Build f0119ea: https://github.com/ironkemal/infinitymade-website/actions/runs/41927033058 (success). Beide belegen keine CI des lokalen Zielstands.
- Frische vollständige Kette 0000–0110 und Zählermessung offen. Baseline benötigt Supabase-Init, Auth-/Storage-Schema und supabase_admin; generischer postgres-Teiltest reicht nicht. DB-Beratung wegen Nutzungslimit fehlgeschlagen, nicht als Signoff zählen.
- Vor Aktivierung durch Kemal zu bestätigen: zwölf Stunden Mindestbuchungsalter zum Joblauf. Boxinstallation, Zustellung und fachlicher Praxisdurchlauf bleiben offen.

## Release-Notizen zur Übernahme in tatsächlichen Auslieferungskanal

Noch nicht veröffentlicht; `gh release list` lieferte keine vorhandenen Releases. Die Build-Workflows veröffentlichen Images und Tags, keinen hier nachgewiesenen Release-Notiztext. Diese Übergabe ist deshalb ein freigabefähiger Entwurf, kein Auslieferungsnachweis.

**O-242 / Zeitfenster (0109):** „Nach Rückfall auf eine ältere Version gelten Zeitfenster als ganzer Tag. Vor dem Rückfall Standortplan prüfen, danach nicht in der alten Version speichern.“

**Erinnerung (0110, Box):** Terminerinnerung am Vortag ausschließlich über Praxis-SMTP, standardmäßig aus und nur mit gültiger Mail-Einwilligung. Aktivierung erst nach fachlicher und technischer Abnahme. Kein Absagelink. Kein SaaS-Schemaeingriff. Schema-Downgrade nicht durch Image-Rückwechsel versuchen; vorhandenen Runner-/Backupvertrag beachten.

## Nach Freigabe auszuführende Schritte

1. Ownership bestätigen; aktive Threads, HEAD, Remote und Arbeitsbaum erneut prüfen. Fremde Änderungen erhalten.
2. Exakt bestätigten Stand pushen. CI-Ausgänge für denselben SHA prüfen; Frontend- und Backend-Auslieferung getrennt über öffentliche Version/Dateihashes und Funktion erfassen.
3. Bei fehlgeschlagener CI oder falscher ausgelieferter Version keine Liveabnahme behaupten. Rollback nur innerhalb gesondert autorisierter Veröffentlichung; niemals Migration rückwärts ausführen.
4. Funktionale QA erst mit separater bestätigter QA-Inhabersitzung. Yannick/Janik niemals öffnen, anmelden oder verändern. Kein Mailkonto verbinden, keine Senden-Schaltfläche betätigen.

## Separates QA-Schreibpaket

Autorisierungsziel: ausschließlich bestehende separate Praxis „TEST-Physio QA“, nach aktueller Rollen-/Mandantenprüfung. Historischer Slug allein ist kein Identitätsnachweis. Keine neue Kontoanlage.

Erlaubnisumfang zur Bestätigung: synthetischen Testtherapeuten und zwei vorhandene Teststandorte verwenden; Wochenregel, Einzeltagausnahme und Stichtagsversion bearbeiten; synthetische Termine/Raumzuordnungen erstellen und verschieben; synthetischen Sondertag setzen; Widgetanfrage von freigegebener fremder HTTPS-Seite erzeugen und Eingang prüfen. Zwei gleichzeitige Requests ausschließlich zur letzten Raumkapazität. Keine echten Benachrichtigungen. Vorherwerte und erzeugte synthetische Vorgänge datensparsam notieren. Ohne Löschfreigabe Testdaten nicht löschen; Änderungen nur bei ausdrücklich gedeckter Wiederherstellung zurücksetzen.

F11 benötigt zusätzlich echte autorisierte Mitarbeitersitzung. Owner-Sitzung bleibt bestehen. Persönliche UI, eigene Anstellung und Mandantentrennung getrennt prüfen; Team-Abwesenheitsrechte unverändert.

KI separat: maximal drei Aufrufe / insgesamt 1 EUR, synthetische Inhalte, bestehender Provider; nur bei nachgewiesener Kostenbegrenzung und konkretem GO. Kein Versand und keine Live-Fußzeilenspeicherung.

## Externe Voraussetzungen

- Melih: konkretes Release-/QA-Paket bestätigen, sichere QA-Mitarbeitersitzung bereitstellen, offengelegte QA-Zugangsdaten sicher wechseln bzw. Wechsel bestätigen.
- Kemal: Mindestbuchungsalter fachlich bewerten, invoices/0081 und Sondertag-/Zeitfensterabnahme.
- Praxis: eigener Wochenplan. Box/Hetzner bleibt zurückgestellt.

Keine Freigabe wird aus Zeitablauf, Limit-Reset oder allgemeiner Wiederaufnahme abgeleitet.
