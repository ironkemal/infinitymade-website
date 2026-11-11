---
titel: Physio-Testbox, SMTP-Abnahme und Einrichtungscode
typ: sitzung
angelegt: 2026-11-11
tags: [sitzung, physio, onprem, smtp, einrichtung]
---

# Physio-Testbox, SMTP-Abnahme und Einrichtungscode

Zusammenfassung des Chatverlaufs vom07.–11.11.2026, gespeichert am11.11. Kein neuer Live-Test am Speichertag. Historische Zugriffs- und Schemastaende muessen vor Fortsetzung erneut geprueft werden. Keine amtliche Quelle.

## Ziel und Entscheidungen

- Nutzer moechte Physiotherapie testen; bestehende Podologie-Installation und Daten sollen erhalten bleiben.
- Vorschlag: getrennte Physio-Testinstallation auf gleichem Hetzner-Server mit eigener Adresse/Konfiguration/Datenhaltung. Noch NICHT angelegt; Ressourcen, Routing, Port-/Compose-Namenskonflikte und Unterstuetzung mehrerer Instanzen vor Umsetzung pruefen. Kein einfacher Fachbereichsumschalter behauptet.
- Vollstaendige Serverloeschung wurde erwogen, dann ausdruecklich verworfen. Keine Loeschung, Neuinitialisierung oder --neu ausfuehren. Alte Synotix/n8n-Dienste unberuehrt.
- Nutzer bestaetigte Zugang zum vorhandenen Dashboard. Keine unabhaengige Browser-/Physio-Funktionsabnahme daraus ableiten.

## Fachbereich und Einrichtung: im Quellcode gelesen

- Gemeinsames Dashboard und Softwarepaket fuer Podologie, Physiotherapie, Ergotherapie, Logopaedie; keine separate Physio-Codebasis.
- `setup.html` bietet diese vier Fachbereiche. `dashboard.js` getSector liest Inhaberprofil/ownerProfile; Fachbereich in Einstellungen ist Anzeige, kein Wechsel-Select.
- `setup.js` sperrt abgeschlossene Ersteinrichtung: ein neues Login oder eine neue E-Mail oeffnet sie nicht wieder. Neue Installation und Fachbereichsumstellung eines vorhandenen Testprofils sind verschiedene Aufgaben; noch nichts umgestellt.
- Bestehende URL laesst sich gezielt ueber SITE_URL in der Serverkonfiguration ermitteln; niemals komplette .env ausgeben. Dashboardpfad /dashboard.html, Anmeldung /login.html.

## Einrichtungscode und SSH: tatsaechliches Ergebnis im Verlauf

- `merkez/admin.js` mit `node admin.js kod-neu` erzeugt Code in der aktiven zentralen Datenbank; einmalig,14Tage gueltig, Klartext einmal sichtbar, gespeichert als Hash/Adminlog. Lokaler Zufallscode oder Code in isolierter lokaler Merkez-DB funktioniert nicht beim zentralen Dienst.
- Einrichtungscode ist NICHT SSH-Fingerabdruck und NICHT Setup-Jeton. Screenshot enthielt oeffentlichen ED25519-Fingerabdruck der bestehenden Testbox; ueber bereits vertrauten SSH-Zugang identisch bestaetigt.
- SSH-Testbox erreichbar, Dockerliste zeigte Praxura und alte Synotix-Dienste, keinen Merkez-Container. Dieser Server wurde nicht veraendert.
- Anderer bereits bekannter SSH-Host antwortete nicht. Zentraler Merkez-Host scheiterte an fehlendem bestaetigten Hostschluessel; keine Pruefung abgeschaltet und kein unbekannter Schluessel ungeprueft akzeptiert.
- Nutzer hat keinen Hetzner-Kontozugang zum zentralen Server; Administrator kann dort entweder Code erzeugen oder vertrauenswuerdigen Fingerabdruck und berechtigten SSH-Zugang bereitstellen. Nur Befehlshinweise gegeben, keine Nachricht versendet.
- **Kein Einrichtungscode erzeugt, keine neue Physio-Installation gestartet.** Keine IPs, Hostfingerabdruecke, Codes, Zugangsdaten oder privaten Schluessel in dieser Notiz.

## Terminerinnerung Phase A: historische Nachweise und Grenzen

- Lokaler Nachweis07.11: Originalkette0000–0110 auf leerer isolierter Supabase-PostgreSQL17.6.1.136-DB mit Storage1.74.0:111 Migrationen, Wiederholung0,111 SHA256 identisch.14 Vergleiche gruen nach Extension-Sollkorrektur9→8; Compose entfernt pg_net. DB-/Onprem-Berater bestaetigten.50 Erinnerung/UI/SMTP/PG-Tests und3 Zaehler-Tests gruen. Keine komplette Box-/Signup-/GoTrue-Serviceabnahme.
- Korrekturcommit964185d7; Push bisb8f3f489 im Verlauf bestaetigt. GitHub Actions42359445726: Backendtests, Image-Smokechecks und Publish erfolgreich. Laufende VPS-Version nicht bestaetigt. spaeterer Dokucommit93c51d1 gespeichert; dessen Push in diesem Verlauf nicht nachgewiesen.
- `onprem/TERMINERINNERUNG-ABNAHME.md` enthaelt Ablauf. Lokal vorbereitetes0110-Paket und Rohbelege liegen unter Claude outputs/2026-11-04-dashboard-analyse-physio/ (nicht Git).
- Supabase-Kataloglesung im damaligen Versuch verweigert: You do not have permission to perform this action. Keine0110-Liveanwendung durch diese Sitzung. Spaetere Schemastaende anderer Sitzungen NICHT aus dieser alten Sperre ableiten.
- Vor Apply: aktuellen Ledger/Katalog lesen, vollstaendigen Vorherexport und Renderer technisch nachweisen. Dann nur exakte freigegebene Migration, sofort Nachkatalog und vollstaendiger Export; kein Box-Zaehler als SaaS-Sollwert. Aktuellen Stand vor Wiederholung neu bestimmen.

## SMTP-Abnahme noch offen

1. Exakte freigegebene Testinstallation, Version und Datenstatus bestimmen; ausschliesslich synthetische Daten.
2. Vollstaendige Absenderadresse und Mailanbieter klaeren. Die genannte Zeichenfolge ohne @ ist keine bestaetigte E-Mail-Adresse. SMTP-Host/Port/TLS/Benutzername erforderlich; Passwort nur privat. Noch keine SMTP-Konfiguration durch diese Sitzung.
3. Testempfaenger bestaetigen; Praxis-SMTP/Einwilligung ab Datenschutzv6/Owner-Schalter pruefen. Keine echten Patienten anschreiben.
4. Versand-GO fuer konkreten Empfaenger einholen; synthetischen Termin fuer Folgetag im Fenster18–22 Europe/Berlin pruefen. Eingang, Absender/Inhalt, Protokollstatus und Schutz vor Wiederholung getrennt nachweisen. Schalter vorher aus.
5. Noch kein echter Versand, kein Postfachempfang und kein SMTP-Abendlauf durch diese Sitzung bestaetigt.

## Phase B: Plan, nicht umgesetzt

- Absagelink nur fuer erreichbare Box, Schalter standardmaessig aus; kein zentraler Relay. Zufallstoken nur als Hash, Ablauf/Bindung an Terminbeginn und Ungueltigkeit nach Verschiebung; Parallelitaet/Replay/Mandantentrennung pruefen.
- GET darf nur Bestaetigungsseite zeigen; Absage ausdruecklich per POST (Mail-Linkscanner). Sicherheitsreview vor Freigabe.
- Hinweis im Dashboard oeffnet vorhandenen Nachrueckerdialog; Matching nach bereits erfolgter Absage erst pruefen. Kein automatisches Anschreiben. Alte HMAC-Links getrennt kompatibel halten.

## Wiederaufnahme

Zuerst gueltigen zentral registrierten Einrichtungscode oder verifizierten Merkez-Zugang beschaffen. Danach separate Physio-Installation technisch planen, Podologie erhalten. Alternativ bestehendes Testprofil nur nach ausdruecklicher neuer Entscheidung umstellen. Zugangssperre nicht durch lokalen Code/zweiten Merkez-Dienst umgehen. SMTP-Abnahme folgt erst auf bestimmter Testinstallation.
