# Konsey Kararı — M1-Artefaktarchiv und Dateilebenszyklus

Datum: 2026-10-05 · Beratung: 2026-10-04 · Beteiligte: muhalif, deger-mi, fonksiyon-ustasi, legal-de, gkv-302, db-ustasi

## Entscheidung

Eine kleine gemeinsame Tabelle `abrechnung_artefakt_version` registriert unveränderliche unsigned/signed/encrypted Dateipfade vor jedem Upload. Header und Registrierung werden unter derselben vollständigen Versionsprüfung atomar veröffentlicht. Bestehende Rechnungs- und Headerverträge bleiben maßgeblich. Die Registry ersetzt keine Abrechnungszustandsmaschine.

## Begründung

Nur aktuelle Headerpfade erfassen historische Signaturen und laufende Uploads nicht. Separate Schutzlisten für signierte und unsignierte Dateien würden zwei konkurrierende Löschmechanismen schaffen. Gemeinsame Owner-Sperre, eindeutige Pfade und dauerhafte Löschaufträge schließen diese Lücke.

## Grenzen und Aufbewahrung

- Lebenszyklus: `reserved`, `published`, `retire_pending`, `retired`; Uploadabschluss separat `pending`, `uploaded`, `upload_failed`.
- Ein laufender Upload bleibt geschützt. Reservierungen dürfen nicht allein wegen Zeitablaufs gelöscht werden.
- Unsigned-DTA wird erst nach Storage-Readback und kryptografischer Prüfung einer veröffentlichten Signatur aus dem Header gelöst; Löschung benötigt einen versionsgebundenen, wiederholbaren Auftrag.
- Auftrag und Begleitzettel erhalten eigene Rollen; sie sind keine DTA-Originale.
- Signierte Dateien folgen der bestehenden Entscheidung in `compliance/LEGAL_DECISIONS.md`. Ohne dokumentierte Einreichung beginnt keine erfundene Achtjahresfrist. Nach sieben Tagen folgt Owner-Prüfung; kein automatischer Purge.
- Verschlüsselte Dateien bleiben erhalten. DAS-Kanal ist unbestimmt; M1.16(b) bleibt ausdrücklich offen.
- Unbekannte historische Storageobjekte bleiben geschützt. Neue Registry beweist keine vollständige historische Inventur.
- DSGVO friert Owner vor Bereinigung unter gemeinsamem DB-Lock ein. Schutzabfragefehler stoppt Bereinigung.
- On-prem: gleiche lokale DB-/Storageverträge, keine neue Cloudabhängigkeit.

## Übereinstimmung und korrigierte Blindstellen

Nach Abgleich der Alternativen bestand Einigkeit über eine minimale gemeinsame Registry. Zunächst bevorzugte separate Signed-Aufbewahrung wurde wegen ungeschützter Upload-/Löschrennen verworfen. Zusätzlich erkannt: Später Uploadabschluss kann ein bereits gelöschtes Objekt neu erzeugen. Deshalb schützt der Uploadstatus offene Reservierungen.

## Umsetzung — builder

- [ ] K4: additive Migration, Owner-RLS, serverseitige RPCs, Schemaexport und Tabellenregister.
- [ ] K4: Uploadreservierung, atomare Veröffentlichung, CMS-Readback, exakte wiederholbare Löschaufträge.
- [ ] K4: DSGVO-Auskunft, frühzeitige Owner-Sperre und Schutz historischer Dateien; begrenzte Integration mit Hat K.
- [ ] K4: ZAA kontrolliert validieren; keine Annahme aus leerer Fehlerliste ableiten.
- [ ] K2/K4: geschützte Historie und versionsgebundene Downloads; synthetische Live-Abnahme.

## Abnahmegrenze

Dieser Beschluss dokumentiert den freigegebenen Entwurf, keine fertige Umsetzung oder Live-Freigabe. Unabhängiger kalter Gemini-Review, Root-Diffprüfung und konkrete Tests bleiben erforderlich.
