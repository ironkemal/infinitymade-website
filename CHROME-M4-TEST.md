# Chrome-Test: Praxura M4, lokal

Nutze Chrome. Teste ausschließlich synthetische Daten auf `http://localhost:8081`. Keine Produktiv-URL, keine echten Patientendaten, keine echten KI-Anbieteraufrufe und keine produktiven Schreibzugriffe.

## Kopierbarer Testprompt

```text
Teste Praxura M4 in Chrome auf http://localhost:8081/tools/browser-probe/ki-probe.html.
Lies zuerst CHROME-M4-TEST.md im Repo /Users/melihdonmez/infinitymade-website.
Verwende ausschließlich synthetische Daten. Ändere keine Betreiberfreigaben und rufe keinen echten KI-Anbieter auf.

1. Lade die lokale Probe neu. Erwartet: 22/22 PASS. Notiere tatsächliche Anzahl.
2. Öffne DevTools: Konsole ohne Fehler; Netzwerk ausschließlich localhost, keine POST/PATCH/PUT/DELETE-Anfragen. Die Probe simuliert API-Antworten im Browser; Provider- und DB-Nachweis daraus nicht ableiten.
3. Prüfe dokumentierte Fälle: serverseitiges active=false, String-Flags, unbekannter Modus, Mitarbeiter-Status, ungültiges OptIn und Taskpfad, fehlende Freitextfreigabe, vollständige Rückfrageauswahl, X, Escape, Abbrechen, generisches Verstecken, Ablauf, Quelländerung, neue Dialoginstanz und HTML-Injektion. Kein Retry nach Abbruch, Eingabeänderung oder fehlendem frischem Token.
4. Öffne http://localhost:8081/login.html und nutze ausschließlich den synthetischen Owner-Testlogin aus der lokalen Datei .local-m4-work/private/connection.json (ownerEmail/ownerPassword). Keine Zugangsdaten in Bericht, Screenshot oder Chat übernehmen. Öffne danach Dashboard → Einstellungen → KI-Unterstützung. Standard off; Technikstatus und Inhaber-Erlaubnis getrennt. Manueller Kalender, Patientenansicht und manuelles Schreiben bleiben erreichbar. Sprachaufnahme ist für M4 gesperrt. Keine echten Patientendaten oder Produktivlogin verwenden.
5. Prüfe in isoliertem Dashboard, dass KI-E-Mail-Eingaben ohne effektive technische Freigabe deaktiviert bleiben. Eine Inhaber-Erlaubnis allein darf sie nicht aktivieren. Mitarbeiter dürfen Inhaber-Erlaubnis nicht ändern.
6. Echten Providertransport, Azure-Ziel, juristische Freigabe, Abrechnung und zentrale Jeton-Ausgabe NICHT als geprüft bewerten. Fehlt isolierter Dashboard-Zugang: Dashboard-Fälle NICHT GEPRÜFT.

7. Nur in dieser isolierten Instanz: Owner-Erlaubnis einschalten, neu laden, anschließend widerrufen. PATCH /api/ai/_config jeweils 200, danach GET mit persistiertem Ownerentscheid. Gesamtstatus und Mail-Eingaben bleiben deaktiviert, weil Betreiber-/Mailfreigaben aus sind. Dashboard-Netzwerk darf diese lokalen PATCH-Anfragen enthalten; die Browserprobe aus Schritt 2 darf keine Netzwerk-Schreibzugriffe enthalten. Keine Betreiberflags verändern.

8. Freitextqualität ausdrücklich FAIL lassen: dritter synthetischer Korpus 36/156 Restlecks. Grüne Funktions-/Sperrtests sind keine Freitext- oder Produktionsfreigabe. Nach Test Owner-Erlaubnis wieder aus.

Bericht pro Testfall ausschließlich PASS, FAIL oder NICHT GEPRÜFT. Trenne synthetische Probe, echtes lokales Dashboard und externe Aktivierung. Bei FAIL: Reproduktion, tatsächliches/erwartetes Ergebnis und Konsole/Netzwerk-Beleg. Nichts als Produktionsfreigabe formulieren.
```

## Automatisierte lokale Probe

```sh
node tools/browser-probe/ki-probe.mjs
```

Voraussetzung: lokaler HTTP-Server auf Port 8081. Runner bricht fremde Origins ab und zählt tatsächliche Netzwerk-Schreibanfragen, Seitenfehler und Konsole-Fehler. 22 Probe-Fälle verwenden produktive Client-Module sowie gemeinsamen Bestätigungsdialog mit synthetischen Antworten. Vollständige Dashboard-Verdrahtung bleibt gesonderter Test.

Die isolierte lokale Dashboard-Instanz wurde aufgebaut und geprüft. Start-/Stop-Anleitung:
`.local-m4-work/README.md` (lokal, nicht veröffentlicht). Aktueller automatisierter
Nachweis: 3117/3117 Gesamttests, M4-Probe22/22 und isolierte API14/14 PASS. Die
Browserabnahme nutzte lokale Headless-Chromium-Probe und T3-Browser; ein eigener
Chrome-Durchlauf nach diesem Prompt ist separat zu protokollieren. Handy/HTTPS,
physische Box, echter Provider und CI bleiben NICHT GEPRÜFT.
