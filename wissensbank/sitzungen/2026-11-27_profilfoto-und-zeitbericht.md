# Profilfotos und Fehlermeldung im Arbeitszeitbericht

## Profilfoto – Gegenprüfung am 27.11.2026

Am Stand `b926615e` meldeten beide Ansichten bei HTTP 200 mit leerer Löschliste Erfolg. Beim Ersetzen im Team-Detail blieben frühere Zeitstempeldateien zurück. Beide Befunde wurden mit synthetischen Daten geprüft.

Die Antigravity-Sitzung meldete die Nachbesserung `cb02a883`. Der Commit liegt auf `origin/main`. Gegenprüfung auf `7b07f0f6`: Die Löschfunktion prüft bei einer erkannten verknüpften Datei die zurückgegebene Löschliste. Beide Upload-Wege nutzen den festen Profilfotopfad. Alle neun Tests in `module/mein-profil.test.js` bestanden.

**Offener Befund:** In `verwaisteTeamfotoPfade` steht vor `jpg` ein ungefiltertes Regex-Metazeichen. Im synthetischen Gegenversuch gelangte dadurch auch `123Xjpg` in den Löschauftrag. Es wurden keine echten Dateien gelöscht. Die Ordnerliste ist außerdem auf 100 Einträge begrenzt, weitere Seiten werden nicht gelesen. Eine vollständige Altbestandsbereinigung ist damit nicht belegt.

## Arbeitszeitbericht – Screenshot vom 27.11.2026

Der Text entsteht im Dashboard beim Aufruf von `GET /api/attendance/report`. `module/api-sitzung.js` zeigt die Meldung bei HTTP 503 oder Fehlercode `AUTH_UNAVAILABLE`. Ein erneuter Aufruf ohne Anmeldung lieferte auf dem öffentlichen Backend HTTP 401. Das belegt Erreichbarkeit zum Prüfzeitpunkt. HTTP-Status, Ursache und Erfolg eines angemeldeten Abrufs auf der betroffenen Installation sind offen.
