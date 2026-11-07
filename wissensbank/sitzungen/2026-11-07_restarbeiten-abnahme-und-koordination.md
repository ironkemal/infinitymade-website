---
titel: Restarbeiten — Abnahmereihenfolge und Koordination
datum: 2026-11-07
typ: sitzung
tags: [abnahme, qa, koordination]
---

# Restarbeiten belastbar abschließen

Diese Sitzungsnotiz erklärt Arbeitsweise und Erkenntnisse. Verbindlicher Belegindex bleibt `fortschritte/2026-11-06.md`, Tagesverlauf `fortschritte/2026-11-07.md`, konkrete Release-/QA-Freigabe `fortschritte/2026-11-06_RELEASE_HANDOFF.md`. Offene Ops-Karten behalten ihre Identität; keine zweite Aufgabenliste.

## Reihenfolge und Entscheidung

1. Vor jedem Paket HEAD, Arbeitsbaum, Remote, laufende Bearbeiter und Datei-/Browserzuständigkeit abgleichen. Nur eigene Dateien stagen. Bei Drift betroffene Arbeit stoppen und neu zuordnen.
2. Vorhandene Originalbelege gegen Zielversion prüfen. Ein historischer Fehler oder inzwischen überholter Matrixeintrag wird nicht ungeprüft erneut gebaut/getestet.
3. Fehlende Planungsnachweise zuerst im autorisierten synthetischen QA-Mandanten ergänzen: Ausstattung und Raumkapazität; bestehende Termine am Sondertag und Anrufliste; vollständiger Widget-Anfrageweg. Ein Browserbesitzer, keine parallelen QA-Schreibläufe außer konkret freigegebener Kapazitätskonkurrenz.
4. Nur reproduzierte Fehler ändern: enger Dateiauftrag, Pflichtberater, kleinste Korrektur, Positiv-/Negativ-/Regressionstest, unabhängiger Review bei folgenreichen Änderungen. Erst dann Nachweis und eigener Commit; Veröffentlichung nur im gültigen Umfang.
5. Rechte- und KI-Abnahme folgen erfüllten Zugangsvoraussetzungen; externe Fachabnahme bleibt bei Kemal/Praxis. Fehlt Voraussetzung, Blocker mit Verantwortlichem und nächstem Schritt in führender Matrix sichern und unabhängiges Paket fortsetzen.

## Erkenntnisse dieser Fortsetzung

- Neue lokale Kette 0000–0110 ist stärker als bisherige Teil-Fixture: 111 Ledger-Prüfsummen stimmen mit aktuellen Originaldateien überein, zwei gespeicherte Rechecks ohne Zählerabweichungen. Das ersetzt weder installierte Box noch echten SMTP-Empfang.
- Livefilter und gespeicherte Buchung sind inzwischen belegt. Frühere Matrixformulierung „tatsächliche Buchung fehlt“ war überholt; aktuelle Matrix korrigiert.
- Fremdes Erinnerungsdokument fordert SaaS0110. Führender Abnahmevertrag bleibt Box-only, keine Live-Migrationsfreigabe. Dokumentationsvorschlag und ausgeführte Migration strikt trennen.
- Browseraktionen sind asynchron: sofort leere Fehlermeldung ist kein Beleg eines stummen Fehlers. Auf Abschluss/Toast warten und gespeicherten Zustand erneut öffnen.

## Schutz und Wiederaufnahme

Fortsetzung: Sondertag-Bestand/Anrufliste und unveränderter Beginn bei Raumänderung live bestätigt. Nach zusätzlichem Nutzer-GO synthetische Ausstattung und eigene Testleistung angelegt; automatische Raumzuordnung gespeichert/wieder geöffnet, belegter geeigneter Raum bei zweitem Behandler abgewiesen. Das ersetzt kein gleichzeitiges Kapazitätsrennen. Details/IDs und Vorherwerte im Tagesprotokoll. Widget ausdrücklich zurückgestellt; dessen Create-Route kann Inhaber-Mail senden. Manuelle Überbelegung ist bestehender Vertrag und wird nicht als Fehler umgebaut. Schemaunterlagen aktuell 0111 gezielt auf 0109 fortgeschrieben, kein vollständiger Export.

Kein Versand, keine Löschung, keine Live-Migration, keine Nutzung ausgeschlossener Konten, keine realen Patientendaten in Berichten. Box/Hetzner und Live-Fußzeilen-/Logospeicherung bleiben zurückgestellt. Echte KI erst nach separatem GO und nachgewiesener Begrenzung. Kein neuer Provider.

Nach jedem Paket kompakte Übergabe mit Freigaben, Ownership, Zielversion, Originalbelegen und nächstem Schritt. Native Kontextkompaktierung verwenden; steuerbare Füllschwelle und automatische Quota-Reset-Erkennung sind nicht nachgewiesen und werden nicht als aktiv ausgegeben.
