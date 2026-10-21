# Chrome-Prompt: Kamera und KHS-Browserabnahme

```text
Teste Praxura systematisch in Google Chrome. Schwerpunkt: Kamera und lokale Muster-13-PDF417-Erfassung; anschließend Browserfunktionen aus KUTU_HAZIRLIK_SPRINT.md §7.

Nur synthetische Daten in isolierter Testpraxis. Nutze bereitgestellte Testsystem-URL und vorhandenen Testlogin. Fehlen diese, frage danach. Keine produktiven Konten, echten Patienten, Zahlungen, E-Mails, externen Abrechnungsübermittlungen oder Löschungen bestehender Daten. Keine Zugangsdaten im Bericht.

Vor Beginn Testmatrix erstellen. Pro Test: Umgebung/Version, Schritte, Soll, Ist, PASS/FAIL/NICHT GEPRÜFT, Screenshot und relevante Konsolen-/Netzwerkfehler. Historische Abnahmeberichte nicht als aktuellen Test ausgeben. Desktop, 390 px und Tablet prüfen. Echte Geräte getrennt von Größen-Emulation bewerten.

1. Basis: URL, Version, HTTPS ohne Zertifikatswarnung, Neuladen, Owner-Login/Logout, Mitarbeiter-Login/Rechte. Linux- und Windows/WSL-Testbox getrennt prüfen. Telefon/Tablet ohne zusätzlich installiertes Zertifikat prüfen.

2. PDF417: Wenn verfügbar localhost:8081/tools/browser-probe/rezept-barcode-probe.html öffnen, Abschluss abwarten. Bisher 39/39; aktuell messen. Probe nutzt künstliche Speicher-API, beweist keinen DB-Speichervorgang.
Im vollständigen Dashboard Fixtures aus tools/browser-probe/fixtures/m3 verwenden:
- muster13.png, muster13-rotated.png, muster13.pdf, muster13-page2.pdf: Müller, Zoë, 6 Einheiten, HPNR78010.
- large-page.pdf, duplicate-barcode.pdf: erfolgreich, identischer Barcode erzeugt kein zweites Rezept.
- unsupported.png, two-prescriptions.pdf, six-pages.pdf: verständliche Ablehnung, manueller Weg erreichbar.
Zusätzlich kein Barcode, beschädigte/ungeeignete Datei, Größenlimit 20 MB, Umlaute/Sonderzeichen, Datumsfelder, ICD, Diagnosegruppe, Einheiten und mehrdeutige Podologie-Zuordnung prüfen. Lokaler Scan darf keine Bilder/Rohbarcodes an externe Dienste senden; kein automatischer Cloud-OCR-Fallback.

3. Physische Kamera: synthetischen Ausdruck oder zweiten Bildschirm vor echte Kamera halten. Erlauben, verweigern, fehlende/belegte Kamera, erneuten Versuch, Vorschau, Aufnahme/Erkennung und Übernahme prüfen. X, Abbrechen und Escape jeweils prüfen: Stream beendet, Kameraindikator aus. Während Erkennung schließen/neu öffnen; verspätetes Ergebnis oder späte Berechtigungsfreigabe darf neue Maske nicht überschreiben. Mehrfach öffnen/schließen. Telefon-Rückkamera, Hoch-/Querformat, Unschärfe und schwaches Licht prüfen. localhost-Desktop und Box-HTTPS separat bewerten. Synthetischer Stream beweist keine physische Kamera.

4. Bestätigung/Speichern: fünf kritische Feldgruppen sowie „Papier handschriftlich geändert?“ anhand tatsächlicher UI prüfen. Ohne Papierbestätigung kein Speichern. Feldänderung entwertet Bestätigung. Handschriftliche Änderung: Papierwerte übernehmen, erneut bestätigen. Auf isoliertem System speichern, Liste öffnen, erneut öffnen, Werte vergleichen. Änderung nach Wiederöffnen braucht frische Bestätigung; bestätigt speichern, erneut vergleichen. Herkunft computed.erfassung = barcode bzw. barcode+korrigiert; prescriptions.quelle davon getrennt betrachten. Manuelle Erfassung entfernt alten Barcodezustand. Keine dauerhaft gespeicherten Rohbarcodes/Rezeptbilder; ohne DB-/Storage-Zugriff nur Browsernachweis melden. barcode_ok/fallback_manuell enthalten nur Zählwerte. Scan-Netzwerk von erlaubten Testsystem-Speicherrequests trennen.

5. §7 Browserabläufe:
- Setup/Branding überspringen und später vervollständigen; Logo, Bank, Stempel, Praxiskopf.
- Testmitarbeiter per Einrichtungscode anlegen, Rechte prüfen; ausschließlich eigenen Testmitarbeiter entfernen, danach Login verweigert.
- Patient, Anamnese, Einwilligung/Kiosk, Einzel-/Serientermin; Onlinebuchung und Termin-Anfrage mit Owner-Bearbeitung.
- GKV manuell und Bild/PDF/Kamera → Tagesbehandlung → Fußbefund → §302-Testdatei → Zuzahlung/Zuzahlungsforderung. Keine Übermittlung.
- Privat/Selbstzahler/BG → Behandlung → passende Rechnung/PDF/Praxiskopf → synthetischer Zahlungseintrag.
- Storno, Reparatur fehlerhafter Zeile, Korrektur mit vorbereiteten synthetischen Fällen.
- Fahrtenbuch: Box-Distanzberechnung verborgen; Kassenbuch; Check-in/Check-out.
- DSGVO-Export/Löschung ausschließlich eigens angelegter Wegwerf-Testperson.
- KI deaktiviert: verständliche deutsche Meldung; Barcodeweg bleibt verfügbar. Keine KI-Aktivierung oder Provideraufrufe.
- Doppelklick, Fehlerzustände, Neuladen und mobile Bedienbarkeit.

6. Separate Systemtests: Installation, Autostart, Firewall, VPN/Router, Backup/Restore, Updates, Zertifikatserneuerung, IP-Wechsel, Migrationen und 72-Stunden-Betrieb nicht aus Browsererfolg ableiten. Ohne Zugriff NICHT GEPRÜFT.

Abschluss: Ergebnismatrix, reproduzierbare Fehler, Blocker und verbleibende Hardware-/Systemtests. Keine pauschale Fertig-Aussage.
```
