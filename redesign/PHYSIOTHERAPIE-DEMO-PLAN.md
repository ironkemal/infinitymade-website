# PHY-ADR-01: Physiotherapie-Dashboard und Kundendemo

Datum: 29.10.2026. Präsentation: 30.10.2026 laut Auftrag „morgen“.
Status: Architektur festgelegt; Baupakete geplant, nicht gebaut oder abgenommen.
Entscheidung: Integrator im Auftrag Melihs. Grundlage: HEAD `7fcc1b37` plus vorhandener, uncommitteter Integrationsstand; dieser ist ausdrücklich kein freigegebener Release-Pin.

## Ziel und Grenze

Eine bedienbare Physiotherapie-Testpraxis im bestehenden neuen Praxura-Design. Melih bestätigt am 29.10.2026 ausdrücklich diese fünf Abläufe als verbindlichen Vorführumfang: Patient anlegen → Physio-Verordnung → Terminserie → Behandlungsdoku → Abrechnungsübersicht. Zielgruppe: Inhaber einer Physiotherapiepraxis; Mitarbeiteransicht ergänzend mit bestehenden Berechtigungen. Anlage-/Dokumentationswege müssen Speicherung, erneutes Öffnen und korrekte Verknüpfungen nachweisen; die Übersicht muss daraus nachvollziehbare Daten beziehungsweise ausdrücklich unbekannte Werte zeigen. Vorbefüllte Beispiele sind nur gekennzeichneter Rückfall und erfüllen nicht allein die Abnahme dieser fünf Abläufe.

Nur erfundene Daten und lokale Speicherung. Vorführbarkeit ist keine Produktions-, RLS-, fachliche Abrechnungs- oder Kundeninstallationsfreigabe. Keine neue Tarif-/Fristenlogik, keine Migration, kein Livezugriff, Versand, Zahlung, OAuth oder echter KI-Aufruf. Nicht verfügbare Wege zeigen eine klare Grenze statt Erfolg. Allgemeiner Redesign-Dauerlauf und Scheduler bleiben pausiert; dieser Folgeauftrag startet sie nicht.

## Architekturentscheidung

**Nutzerpriorität Leistungen:** Melih betont ausdrücklich „Wichtig sind die leistungen“. Physio-Leistungskatalog und Leistungsauswahl werden vor den fünf Abläufen geprüft: vorhandene Leistungen korrekt anzeigen, auswählen und mit Verordnung, Terminserie und Behandlungsdokumentation verknüpfen. Dauer, Positionen und Preise ausschließlich aus bestehenden belegten Daten übernehmen; fehlende Angaben offen zeigen. Keine neue Tariflogik oder ungeprüfte Katalogänderung. Diese Priorität ergänzt die fünf bestätigten Abläufe.

**Ein gemeinsames Dashboard; Fachbereich über vorhandene Konfiguration.** Neue Dateien enthalten ausschließlich Demo-Konfiguration, synthetische Seeds, lokale Werkzeuge und Prüfungen. Tatsächliche Physiofehler werden nach Reproduktion eng in bestehenden Modulen behoben.

| Variante | Aufwand bis morgen | Pflege / Wachstum | Vertrautheit | Entscheidung |
|---|---|---|---|---|
| Neue eigenständige Physio-App | Hoch; Auth, Shell und Abläufe erneut verbinden | Zwei Produkte, doppelte Fehlerkorrekturen | Neue Struktur | Verwerfen |
| dashboard.html/js in Physioordner kopieren | Anfangs niedrig, Integration und Tests doppelt | Divergierende Rollen-, Daten- und Sicherheitslogik | Kopierter Code, unklare Zuständigkeit | Verwerfen |
| Bestehende App gezielt konfigurieren und erweitern | Niedrigster Integrationsaufwand; vorhandene Abläufe prüfen | Gemeinsamer Kern, Fachbereichsvarianten | Entspricht Projektarchitektur | Gewählt |

Quellen: `nav-registry.js:58` enthält Physio-Navigation; `dashboard.js:530` leitet Fachbereich aus Owner-/Mitarbeiterprofil ab; `dashboard.js:550` prüft Plan für §302; `funktionen/README.md:48` beschreibt gemeinsame Basis und gemeinsamen Verordnungstopf. Profilwert `physiotherapy` nicht mit Dokumentationswert `physio` verwechseln (`module/anamnese.js:211`).

Konsequenz: Ein Fehler im gemeinsamen Kern kann weitere Fachbereiche betreffen. Deshalb kleine Diffs, gezielte Podologie-Gegenprobe und getrennte Daten; keine pauschale Überarbeitung gemeinsamer Dateien.

Lesende Ablaufprüfung bestätigt konkrete Grenzen: `module/verordnung-maske.js:805` verwendet POST `/rezept/confirm` beziehungsweise PATCH `/rezept/:id`; `dashboard.js:5251` verwendet POST `/booking/batch-create`; `module/abrechnung-auswahl.js:1361` verwendet POST `/billing/abrechnung/create`. Der bestehende lokale CRUD-Adapter deckt diese Wege nicht ab. Physio verknüpft Sitzungen über `prescription_sessions.booking_id` (`dashboard.js:6510`), Anamnese wird versioniert in `anamnese` gespeichert (`module/anamnese.js:498`). Daher ist bloßes Umbenennen des Profils ausdrücklich unzureichend.

## Dateien und Arbeitsbasis

Geplante neue Werkzeugdateien unter bestehendem, nicht veröffentlichtem `tools/browser-probe/physio-demo/`:

- `profil.mjs`: Owner-/Mitarbeiter- und bestehende Plan-/Sichtbarkeitskonfiguration.
- `daten.mjs`: deterministische synthetische Daten und Beziehungen; bestehende Feld-/Katalogverträge verwenden.
- `server.mjs`: lokaler Launcher, vorhandenen temporären Demo-Adapter als Ausgangspunkt prüfen; keine zweite Buchungsengine.
- `README.md`: Start, Speichergrenze, Reset/Export, unterstützte Aktionen und Vorführskript.
- Gezielte Vertrags-/Integrationsprüfungen daneben; reale Formulare im geschlossenen synthetischen Harness prüfen.

Vor Anlegen Auslieferungsausschluss in `.vercelignore`, Docker und Publishworkflow prüfen. Keine Testdaten in Runtime-/Kundenpakete aufnehmen. Fachmodule bleiben in `module/`, Design in vorhandenen `design/`-Dateien; kein `physio/dashboard.html`.

Vor Schreibdelegation: aktuellen Dirty-Diff sichern und Dateibesitz erfassen. Root-WIP nicht ungeprüft committen, kopieren oder mit altem HEAD als vollständig bezeichnen. Gemeinsamen überprüfbaren Basispin erst nach gezielten Integrationsgates herstellen. Isolierte Checkouts bei Bedarf über Orchestrator, keine eigenmächtigen Shell-Worktrees. Exakte Dateiliste vor jedem Bau-ACK; Abweichungen zurück an Integrator.

## Pakete, Tags und Besitz

Alle Pakete derzeit **geplant**, außer der lesenden Architekturklärung. IDs auch in Commit-/Testberichten verwenden; keine neuen Hintergrundaufgaben.

| Tag | Verantwortlicher | Exklusive Aufgabe / Dateien | Voraussetzung |
|---|---|---|---|
| PHY-00 | Root | Basis, Scope, vorhandenen WIP sichern; gemeinsame STATUS-/INDEX-/Cachepflege | Plan |
| PHY-01 | Agent A, erst nach Bauzuweisung | Nur `profil.mjs`, `daten.mjs` und deren gezielte Prüfungen | PHY-00; Funktionsberater, DB-Beratung zu konkreten Feldern |
| PHY-02 | Agent B, erst nach Bauzuweisung | Nur `server.mjs`, Adapterprüfungen, Demo-README | PHY-00; Seedvertrag mit A festgelegt |
| PHY-03 | Root | Bestehende UI verbinden; nur reproduzierte Physiofehler, explizite gemeinsame Dateiliste | PHY-01/02 |
| PHY-04 | Prüfagent, nach Integration | Unabhängige lesende Prüfung des gepinnten Diffs und der kritischen Vorführwege; keine Produktedits | PHY-03 |
| PHY-05 | Root | Gebündelte Gates, Start-/Reloadprobe, Präsentationsstand und Rückfall | PHY-04 |

A und B können nach gemeinsamem Datenvertrag parallel bauen. Root bleibt alleiniger Schreiber von dashboard.*, gemeinsamen Modulen, Links/Cache, STATUS/PLAN/INDEX. Agenten erhalten Projektregeln, Daten-/Netzgrenzen und Hinweis auf fremde Änderungen. Funktionsberater vor neuen Funktionen und danach Zweck/Ersteinsatz; DB-/Onprem-Beratung vor neuen Datenzugriffen, GKV-Beratung bei klinischen/Abrechnungsregeln, Sicherheitsberatung bei Rollenänderungen. Keine Regeländerung nur für Demo.

## Testpraxis

- Eigene lokale Origin und versionierter Store `praxura-physio-demo-v1`; vorhandene Pododemo auf 18083 erhalten. Neuen Port vor Start prüfen und reservieren.
- Vorschlag: 10–12 Patienten, 2–3 Therapeuten, unterschiedliche Versicherungsarten, konsistente Physioleistungen, aktive/teilweise behandelte/abgeschlossene Verordnungen und ein ausdrücklich unbekannter Fall.
- Patienten → prescriptions → prescription_sessions → bookings mit echten vorhandenen FK-Verträgen. Status und Abrechnungsstatus getrennt. Owner-/Standort-/Therapeutenzuordnung konsistent; keine umetikettierten Podorezepte.
- Terminbasis am Vorführdatum in Europe/Berlin, Vergangenheit und Zukunft. Fallzahlen klein genug, um alle vorgeführten Daten prüfen zu können.
- Preise/Diagnosen/Positionen nur aus vorhandenen belegten Quellen; keine erfundenen Tarifwerte. Beispielbeträge sichtbar kennzeichnen. Unbekannte Daten bleiben unbekannt.
- Bestehender temporärer Adapter kann direkte lokale CRUD-Wege bedienen, ersetzt aber keine Backend-Terminserien-/Slotengine. Diese Grenze ist vor Bau durch Vertragsproben zu klären: echter isolierter Enginepfad oder offen eingeschränkter Vorführumfang. Kein Dummy-Erfolg.
- Speicherung im Browser, Verlustgrenzen deutlich. Reset betrifft ausschließlich eigenen Demo-Store, verlangt bewusste Nutzeraktion; Export nur synthetischer Daten. Reset darf Pododemo und andere localStorage-Schlüssel nicht verändern.

## Abnahme vor Vorführung

| Bereich | Nachweis / Musskriterium |
|---|---|
| Start und Isolation | Neues Browserprofil startet direkt in Physio; Owner/Employee konsistent; vorhandene Pododemo unverändert. Fremdhosts/WS und reale Nicht-GET-Wege gesperrt. |
| Patient | Über echte UI anlegen, bearbeiten, erneut öffnen und nach Reload erhalten; korrekte Zuordnung und Validierung. |
| Verordnung | Physioformular, dokumentierte Felder, gespeicherte Verordnung erneut öffnen; keine Podobehandlung oder vermischten Statusachsen. |
| Termine | Zugeordneter Therapeut, Zeitraum, Dauer, Verordnung/Sitzung; unterstützten Buchungsweg bis Reload prüfen. Nicht unterstützte Serie deutlich abgrenzen. |
| Dokumentation | Eingabe → synthetisch gespeicherte Daten → erneutes Öffnen; verzögerte Antwort bei Patienten-/Rollenwechsel verworfen. |
| Finanzen | Erklärbare Beispieldaten/Unknown; Mitarbeiter bekommen über Demo keine erweiterten Finanzrechte. Keine Behauptung echter Einreichung oder Zahlung. |
| Bedienung | Desktop 1440 und 390px, hell/dunkel gezielt; Fokus, Dialogrückkehr, lange Namen, Fehler/leer/laden, keine abgeschnittenen Hauptaktionen. |
| Abschluss | Gezielte Tests je Paket, danach ein gebündelter relevanter Gesamtlauf; keine Wiederholung alter grüner Vollmatrizen. Enger unabhängiger Review; keine offenen P1/P2 auf Vorführwegen. |

Jeder Bericht nennt Pin, ausgeführten Weg, Ergebnis und Grenze. Synthetische Rollenprobe ist kein Live-RLS-Nachweis. Sichtbare Zahlen oder erfolgreicher Klick allein beweisen keinen gespeicherten Gesamtablauf.

## Deadline, Freeze und Rückfall

Reihenfolge: Datenvertrag → parallel Seeds/Launcher → Integration → fünf Vorführwege → gezielte Reparatur → unabhängige Gegenprüfung → gebündelte Gates → Freeze. Falls Terminserien-/Abrechnungsintegration den Termin gefährdet, Umfang offen begrenzen statt neue Engine oder Regeln unter Zeitdruck bauen.

Nach Gates einen sauberen überprüften Commit mit lokalem Tag `demo/physiotherapie-2026-10-30-rc1` markieren; Tag erst auf tatsächlich geprüftem Stand, keine Veröffentlichung. Versionierte Seeds und Startanleitung dazu. Persönliche/sonstige Dirtyfiles bleiben erhalten. Keine Push-/Deploy-/Standardumschaltung aus diesem Plan.

Vor Termin Kaltstart und Reload proben; 10-Minuten-Skript: Tagesübersicht → Patient → Verordnung → Termin/Dokumentation → klar markierte Finanzübersicht. Fallback ist derselbe gepinnte Appstand mit vorbereitetem synthetischem Datensatz und bebildertem Ablauf, keine zweite Produktkopie. Funktionierende Demo nach Freeze nur bei belegtem Präsentationsblocker ändern und betroffenen Weg erneut prüfen.

## Offene Entscheidungen / nächster Schritt

1. Nutzer-Schwerpunkt bestätigt: alle fünf Abläufe einschließlich Terminserie. Keine offene Umfangsfrage; Backend-Gate für Verordnung/Serie priorisieren.
2. Ablaufprüfung ist als Quellnachweis abgeschlossen; vollständige Verordnungs-/Serienanlage bleibt Backend-Gate. Vorbefüllte Beispiele sind Rückfall, kein Ersatz für späteren vollständig bedienbaren Physio-Auftrag.
3. PHY-00 abschließen, dann A/B ausdrücklich mit konfliktfreier Dateiliste beauftragen. Diese Planung enthält noch keine Bauzuweisung und keinen Fortschrittsnachweis der Pakete PHY-01–05.
