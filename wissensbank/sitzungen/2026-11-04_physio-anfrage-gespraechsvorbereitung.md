---
titel: Physio-Anfrage — Gesprächsvorbereitung und Ops-Grenzen
typ: sitzung
datum: 2026-11-04
tags: [sitzung, physio, pilot, gespraech]
---

# Physio-Anfrage: Gesprächsvorbereitung

## Umfang und zeitliche Einordnung

Diese Notiz sichert die Arbeit dieses Gesprächs vom 22.10. bis 04.11.2026. Sie ist eine historische Zusammenfassung, keine aktuelle Produktabnahme. Spätere Physio-Arbeit wird separat geführt, insbesondere in [[2026-10-30_p1-erstgespraech-physio-demo]] und [[2026-10-31_physio-planung-umsetzung]]. Leadname, Kontaktdaten und konkrete Preisvorschläge gehören nicht in dieses öffentliche Repository.

## Erarbeitet

- Anfrage einer größeren Physiotherapiepraxis mit perspektivisch zwei Standorten und 15–30 Therapeuten analysiert; gewünschter Testzeitraum: acht Wochen.
- Anforderungsbereiche erfasst: standortübergreifende Nutzung, Patientenakte/Dokumente, Befundung und Therapie, E-Mail/Fax, Rezepteingangscontrolling, Patientenkommunikation, Tablet-Unterschriften, Rezeptscan und Prüfung, Terminzuordnung, Selbstabrechnung nach §302, Privatabrechnung, Zuzahlungen, Verkäufe und DATEV.
- Historischen Funktionsabgleich anhand gezielter Codelektüre erstellt. Dabei weder Kundenbox noch vollständige Abrechnungskette praktisch abgenommen. Damalige Aussagen zu fehlenden Funktionen sind vor Verwendung gegen heutigen Code zu prüfen.
- Öffentliche Presse- und Registerinformationen als Gesprächsvorbereitung recherchiert. Standorte, Gesellschaftsstruktur, Fachbereiche und Eröffnungstermin waren Gesprächsfragen; keine durch die Praxis bestätigten Tatsachen.
- Gesprächsleitfaden erstellt: ehrlicher Beta-Status, Muss-/Kann-Anforderungen, Starttermin, aktuelle Software, Migration, Teamgröße, zwei Gesellschaften oder eine, Physio-/Ergo-Umfang, Support, Pilotabnahme und Ausstieg.
- Betriebsoption eigener Praxisserver bzw. Hetzner im Praxiskonto erläutert. Mehrstandortzugriff, Rechte, Last und Backup/Restore benötigen gesonderte Nachweise. Architekturvorschlag ist keine rechtliche Freigabe.
- Preisstruktur diskutiert: einmalige Einrichtung, Datenübernahme und Schulung; monatliche Lizenz/Updates/Support; Infrastrukturkosten getrennt berücksichtigen. Chatbeträge waren ungeprüfte Schätzungen, kein Angebot oder beschlossener Tarif. Keine Zahlen hier übernommen.
- Zeitplan als unverbindliche Planung diskutiert. Verbindlicher Termin erst nach Scope, Kapazitätsprüfung und Abnahmekriterien; acht Wochen Wunschtest sind keine Entwicklungszusage.
- Strukturierte HTML-Gesprächsmappe außerhalb des Repositories erstellt: 15 Abschnitte, darunter Anforderungsmatrix, Vorgehen, Technik, Optionen, Zeitplan, Kostenstruktur, Gesprächsleitfaden, interne Fragen, Risiken, Checkliste und Quellen; Hell-/Dunkelmodus und lokale Notizen.

## Artefakt und Prüfung

Die private HTML-Datei liegt auf dem Desktop; ihr Dateiname enthält den Leadnamen und wird deshalb hier nicht wiederholt. Ursprüngliche Prüfung: HTML-Parser meldete null Fehler und keine offenen Tags. Keine visuelle Abnahme dokumentiert. Die Datei enthält interne Informationen und wird nicht veröffentlicht.

Formulierung „wir setzen um“ in der Mappe beschreibt die gewünschte Gesprächsrichtung. Daraus folgen weder fertige Funktionen noch verbindliche Leistungs-, Preis- oder Terminzusagen; interne Abstimmung blieb ausdrücklich offen.

## Ops-Prüfversuch vom 03.11.2026

- Im ausgelesenen Verlauf keine dokumentierte Erstellung oder Änderung von Ops-Karten gefunden.
- Live-Abfrage scheiterte: lokale Datei `ops/.env.ops` fehlte. Browserzugriff meldete nicht verfügbaren Browser-Host.
- Keine Karten gelesen oder geändert; keine Aufgabe abgehakt. Insbesondere keine Produktfunktion aufgrund dieser Vorbereitung als umgesetzt markieren.
- Passende Karten und deren Abnahmekriterien müssen vor Statusänderung eindeutig identifiziert werden. Erledigt sind Recherche, Analyse, Leitfaden und Mappe; Produktumsetzung ist dadurch nicht belegt.

## Sicherung vom 04.11.2026

Nutzer autorisierte Dokumentation, Commit und Push. Checkout zunächst vier lokale und drei entfernte Commits auseinander; Fetch erfolgreich. Anschließend erschien parallel ein fremder Merge mit Konflikten in `dashboard.html` und `canli-test/REGISTER.md`. Eigener Pull wurde wegen bereits unaufgelöster Dateien abgewiesen. Fremde Konflikte und gestagte Produktänderungen werden nicht übernommen. Der parallele Merge wurde anschließend durch die andere Sitzung abgeschlossen; erneute Prüfung zeigte keine Konflikte. Dokumentation wird separat committet und mit dem vorhandenen main-Verlauf gepusht.

## Lernpunkte

- Recherche, geschriebenes Artefakt, lokale Tests und Live-Abnahme getrennt führen.
- Konkrete Karten-ID plus Erledigungsnachweis vor jedem Ops-Haken.
- Historische Lückenliste nicht als heutigen Produktstatus weitergeben.
- Interne Gesprächsunterlagen außerhalb des öffentlichen Repos halten.


## Abschluss der offenen Prüfungen am 04.11.2026

### Ops jetzt erreichbar, Bestand abgeglichen

Die angemeldete Ops-Oberfläche war im Preview-Browser erreichbar. Archiv eingeschaltet und 366 gerenderte Karten einschließlich Unteraufgaben nach Titeln geprüft. Keine eigene Karte für Gesprächsvorbereitung, Recherche, Anforderungsabgleich oder private HTML-Mappe gefunden. Deshalb keine erfundene Zuordnung und kein neuer Erledigungshaken. Die verwandten Umsetzungskarten #342 (Raumplan) und #343 (Raumübersicht) waren bereits erledigt; Hauptkarte #341 bleibt offen. Keine anderen Produktaufgaben durch die Gesprächsvorbereitung abgeschlossen. Archivansicht zurückgesetzt, Prüftab geschlossen. Der vorherige Zugangsblocker ist damit für diesen Leseabgleich aufgehoben.

### Private HTML-Mappe visuell geprüft und korrigiert

- Ursprünglichen seitlichen Überlauf in der schmalen Dunkelansicht reproduziert. Ursache: intrinsische Mindestbreiten der Raster und des Hauptbereichs.
- Private Desktop-Datei korrigiert: schrumpfbare Raster, schmalere Abstände, lokal horizontal scrollbar lesbare Tabellen, stabiler dunkler Kopfbereich, sichtbarer Tastaturfokus und reduzierte Scrollbewegung bei entsprechender Systemeinstellung. Sicherung der vorherigen HTML-Datei liegt daneben, ebenfalls privat.
- Renderkontrolle: 390px dunkel, 1280px hell sowie geöffnete FAQ im Dunkelmodus. Browsermessung: scrollWidth entspricht jeweils viewportWidth (390/390, 1280/1280), keine überstehenden geprüften Hauptbereiche, 15 Abschnitte, null defekte Sprunglinks. Checkbox-Speicherung in isoliertem Preview-Kontext erfolgreich geprüft und ursprünglichen Testzustand wiederhergestellt.
- Für den höhenautomatischen HTML-Preview wurde ausschließlich in der Prüffassung die 100vh-Seitenleistenhöhe durch max-height:800px ersetzt; private Quelldatei behält ihre viewportabhängige Seitenleiste. Bereichsansichten zur Sichtprüfung blendeten andere Abschnitte nur in der Prüffassung aus.
- Impeccable-Detektor ausgeführt: Stilhinweise zu bestehender Gestaltung und statische Kontrastwarnungen, die Hell-/Dunkelwerte mischen. Kein pauschales WCAG-Zertifikat; keine vollständige Barrierefreiheitsabnahme oder physische Touchprüfung behauptet.
- Diese Arbeit aktualisiert das Layout. Fachliche Inhalte, Markt-/Rechtsangaben und Produktlücken bleiben historischer Stand 22.10.2026 und wurden nicht erneut fachlich verifiziert.

Ergebnis: beide offenen Folgepunkte bearbeitet. Ops ohne passende unerledigte Vorbereitungskarte unverändert; visuelle Prüfung und begrenzte Layoutkorrekturen abgeschlossen. Private Datei bleibt außerhalb Git und Veröffentlichung.
