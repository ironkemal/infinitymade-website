# M4: lokale Besitzerentscheidung

Datum: 08.10.2026. Umfang: lokale Umsetzung, keine Anbieter- oder Produktionsfreigabe.

## Frage und Entscheidung

Wie wird die freiwillige KI-Nutzung pro Praxis erfasst, solange keine passende persistierte Einstellung vorhanden ist? A: kleine lokale Metadatendatei im bestehenden persistenten Box-Verzeichnis. B: neue DB-Migration.

**Entscheidung A, mit korrigiertem Speicherort.** Vorprüfung durch Funktions- und Datenschutzagent; getrennte Gemini-CLI-Bewertungen aus rechtlicher, kritischer und Aufwandsperspektive stimmen A unter den folgenden Bedingungen zu. Zielprüfung zeigte anschließend: `kimlik` ist bewusst read-only. Technische Onprem-Nachprüfung stimmt einem getrennten kleinen `ki_freigaben`-Volume zu; Identität bleibt read-only. Diese Bewertungen ersetzen keine anwaltliche Freigabe. K-20 und bestehender Nachtrag 4 in `compliance/LEGAL_DECISIONS.md` bleiben maßgeblich.

## Bedingungen

- Standard aus. Besitzerentscheidung an authentifizierten Besitzer, Praxis, Box und Textversion binden. Keine Patienten- oder Promptdaten speichern.
- Datei außerhalb Webroot im privaten persistenten Metadatenvolume `ki_freigaben`; Verzeichnis 0700, Datei 0600, atomare Ersetzung mit zufälliger temporärer Datei. Keine Schreibrechte am Identitätsvolume.
- Fehlende, beschädigte, fremde oder unbekannte Version bedeutet aus. Beide PM2-Prozesse lesen vor jedem Aufruf frisch; keine dauerhafte Zustandskopie im Worker.
- Betreiberfreigaben für allgemeine Aktivierung und Mail bleiben unabhängig. Browser kann sie nicht setzen. Widerruf sperrt Folgeaufrufe; bereits gesendete Anbieteranfrage lässt sich dadurch nicht zurückholen.
- Jeton: ausschließlich A-Struktur, kein Freitext, kein Bild/PDF/OCR. Leere, im Image gebundene Azure-Hostliste verhindert externe Aktivierung, bis konkrete Ressource geprüft wurde.
- Client lehnt Jetonlaufzeit über einer Stunde ab. Dies beweist keine Begrenzung durch den externen Aussteller. `store:false` beweist keine ZDR-Zusage.

## Abwägung und Abnahme

A spart Schemaänderung, braucht ein kleines zusätzliches Volume. Risiko: verlorenes Volume oder parallele Prozesse; daher Bindung, atomare Speicherung und frische Prüfung. Kein Backup der boxgebundenen KI-Freigabe; Wiederherstellung auf neuer Box verlangt erneute Entscheidung. B bleibt später möglich, wenn zentraler Praxisbetrieb oder Migration dies erfordert.

Rückfragen über zwei PM2-Prozesse benötigen gemeinsamen, im RAM aus bestehender Boxidentität abgeleiteten Schlüssel sowie atomare Verbrauchsmarker mit Ablaufzeit. Marker enthalten nur HMAC/Expiry, keine Prompts oder Zuordnungslisten. Begrenzte Bereinigung erfolgt beim Aufruf. Implementierung und Prozessprüfung bleiben Abnahmebedingungen.

Umsetzung und Testergebnis werden im M4-Abnahmebericht nachgewiesen. Keine DB-Migration, produktive Änderung oder externe Rechtsbedingung wird mit diesem Beschluss als erledigt markiert.
