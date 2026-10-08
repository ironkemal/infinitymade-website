# Chrome-Testprompt: M3, lokaler PDF417-Rezeptweg

Kopiere folgenden Prompt in deine Chrome-Testsession:

```text
Teste den aktuellen lokalen M3-Stand von Praxura in Chrome. Verwende ausschließlich synthetische Daten. Repo: /Users/melihdonmez/infinitymade-website. Kein Deploy, keine echten Patienten und keine produktiven Schreibzugriffe.

1. Öffne http://localhost:8081/tools/browser-probe/rezept-barcode-probe.html. Für die reine Probe reicht `node dev_server.cjs`. Die aktuell eingerichtete isolierte Dashboard-Testumgebung verwendet dagegen `/tmp/praxura-m3-isolated-291488e0/frontend-launch.cjs` sowie den dortigen Stack, Relay und Backendprozess; siehe M3-Abnahmebericht. Warte bis zum Abschluss. Erwartung: 39/39 bestanden, einschließlich PDF-Vorschautext, Pflichtbestätigung, Korrektur, Speichersperre und Dialogabbruch. Dokumentiere Ergebnis, Screenshot sowie Konsole/Netzwerk. Keine fremden Origins oder Netzwerk-Schreibzugriffe. Diese Seite nutzt echte M3-Module und eine künstliche Speicher-API; sie beweist keinen echten DB-Speichervorgang.

2. Teste den Rezeptdialog im lokalen Dashboard unter http://localhost:8081/login.html. Isolierter Testlogin und lokale Konfiguration sind eingerichtet; Zugangsdaten ausschließlich aus der privaten Datei `/tmp/praxura-m3-isolated-291488e0/connection.json` verwenden, nicht in Bericht oder Chat kopieren. Andernfalls diesen Teil als NICHT GEPRÜFT markieren und den konkreten Blocker nennen. Verwende Fixtures aus tools/browser-probe/fixtures/m3/:
- muster13.png, muster13-rotated.png, muster13.pdf und muster13-page2.pdf: Müller, Zoë, 6 Einheiten, HPNR78010. Vorschau und Sonderzeichen prüfen.
- large-page.pdf und duplicate-barcode.pdf: erfolgreich; identischer Barcode auf zwei Seiten bleibt ein Rezept.
- unsupported.png, two-prescriptions.pdf und six-pages.pdf: verständliche Ablehnung; kein automatischer Cloud-OCR-Aufruf; manuelle Eingabe weiter möglich.

3. Prüfe Papierbestätigung auch nach Wiederöffnen einer gespeicherten Barcode-Verordnung: Ohne Bestätigung kein Arzt-/Rezept-Write. Feld ändern entwertet Bestätigung. Handschriftliche Änderung braucht erneuten Papiervergleich. Speichern sperrt Eingabefelder. Warnungsdialog mit Escape, X und Abbrechen schließen: Maske danach wieder bedienbar, kein Rezept gespeichert. Manuelle Maske und Schließen entfernen alten Barcode-Zustand.

4. Prüfe echte Kamera auf localhost mit gedrucktem synthetischem Barcode oder zweitem Bildschirm: erlauben, verweigern, schließen, Escape und Neustart. Kameraindikator muss nach Abbruch ausgehen; verspätete Freigabe darf keine geschlossene/neue Maske überschreiben. Handykamera über Box-HTTPS separat prüfen, wenn Testbox verfügbar; sonst NICHT GEPRÜFT.

5. Echtes Speichern/erneutes Öffnen/PATCH nur auf ausdrücklich freigegebenem isoliertem Testsystem. Prüfe Herkunft barcode bzw. barcode_korrigiert und computed.erfassung. Keine Barcode-Rohdaten oder Rezeptbilder dauerhaft gespeichert. Ohne passende Konfiguration/Freigabe NICHT GEPRÜFT, keinesfalls produktive Konten als Ersatz nutzen.

Gib pro Fall PASS / FAIL / NICHT GEPRÜFT mit Erwartung, tatsächlichem Ergebnis und Beleg aus. Bei Fehlern Reproduktionsschritte, Screenshot, Konsole und relevante Netzwerkantwort nennen. Lokale Probe, echte Kamera und authentifiziertes DB-Speichern getrennt bewerten.
```
