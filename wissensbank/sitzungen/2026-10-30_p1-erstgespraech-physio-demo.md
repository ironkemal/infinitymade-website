---
titel: P1 Erstgespräch Physio — Demo, Zusagen, offene Fragen
typ: sitzung
angelegt: 2026-10-30
autor: Melih + Claude Code (aus Aufzeichnung von Kemal)
tags: [sitzung, physio, p1, pilot, erstgespraech, demo, theorg, mehrstandort, sandbox, datev, itsg, raumplan, kundengespraech]
---

# P1 Erstgespräch Physio — 30.10.2026

> **Erkennungswörter:** P1-Gespräch · Physio-Pilot · THEORG-Wechsel · zweiter Standort ·
> Sandbox 3–4 Wochen · Raum auf einen Blick · DATEV-Zusage · ITSG-Zertifikat · gemeinsame Datenbank ·
> „erster Mehrstandort-Kunde" · Kundengespräch 30.10.
>
> Plan dazu: `Physio/PILOT-PLAN.md` (Aufgaben M1–M7, K1–K13, I1–I8).
> Rohtranskript (mit Namen) liegt **bewusst nicht im Repo** (public): lokal `~/praxura-meetings/2026-10-30_P1_erstgespraech_transkript.txt`.
> Dieses Dokument ist die pseudonymisierte Wissensfassung (Kunde = P1, keine Stadt, kein Name, keine Zahlen).

Status: **Aufzeichnung gelesen und ausgewertet.** Nichts davon ist gebaut oder getestet; es ist ein Gesprächsprotokoll.

## Kontext

- Praxis aus dem Physio-Bereich, **zwei Standorte** (zweiter ca. 15 km entfernt, Eröffnung **Ende Dezember / Anfang Januar spätestens**).
- Heute **THEORG**: funktional stark, aber alt; Verordnungen werden von Hand erfasst; Selbstabrechner ohne Abrechnungszentrum, THEORG nimmt keine Provision.
- Kontakt ist nicht selbst tief in der Abrechnung (ITSG-Zertifikat unbekannt).
- Geplant: erst am **neuen Standort** testen, bei Erfolg beide Standorte umstellen.
- Gesprächsführung (intern abgesprochen): Kunde im Mittelpunkt, wir stellen uns kaum vor. Kemal führt, Melih zeigt die Demo.

## Gewünscht (Mail + Gespräch)

Cloud/ohne Box, Tablet-Nutzung, E-Akte (Berichte/Patientendaten, gesichert), digitale Befundung/Dokumentation,
Therapieberichte per Fax/Mail, Controlling, Dokumente per Mail, Direktabrechnung mit Kassen,
Einwilligungen per Tablet (Honorarvereinbarung, Aufklärungsbogen mit Ausfallregel), **Raumübersicht**,
Urlaub/Abwesenheit pro Mitarbeiter, Mail an Patienten bei Sondertagen.

## Was wir gesagt / gezeigt / zugesagt haben

| Thema | Gesagt/gezeigt | Plan-Bezug |
|---|---|---|
| Cloud | „Echte" Cloud nicht; **eigener Remote-Server pro Kunde**, wir sind kein Datenverarbeiter, keine Box vor Ort. Kunde: „wie bei THEORG", passt | Kemal-Entscheid Hetzner der Praxis, I1/I5 |
| **Raum auf einen Blick** | Fehlt noch, „im Nachhinein machbar" — **Frage des Kunden, Zusage** | M1/M2 |
| Verordnung | Barcode **und Foto-Scan mit KI**, ICD/Heilmittel-Prüfung, „Verordnung prüfen", Arztunterschrift digital | ⚠️ Foto-OCR ist laut Plan **aus** (503) — siehe unten |
| Serientermine | KI-Vorschlag, Geschlechterwunsch aus Notizen | KI im Kasten (K4) |
| Team | Rechte, Urlaub, Teil-/Vollzeit, Verfügbarkeiten, Leistungen/Zertifikate mit Warnung (kein Block) | M5; K1 |
| Sondertage | Block im Kalender + automatische Mail an Patienten | M6 (Mail-Helper aus K9) |
| E-Akte / Tablet | Anamnese + Einwilligungen im Kiosk-Modus mit PIN, eigene Zeilen hinzufügbar | K6/K7 |
| Eigene Dokumente | „Eigenes Dokument hochladen, per Tablet unterschreiben lassen": **bejaht („solange rechtlich zugelassen")** | K6 (fehlt noch, siehe Analyse) |
| Mail | Gmail schnell, andere Anbieter per SMTP durch uns; **Rechnung per Mail aus der Software: bejaht**; KI-Mails per Sprache | K9, K5 |
| Fax | als Wunsch genannt, im Gespräch nicht beantwortet | K9 |
| Abrechnung | Direktabrechnung **provisionsfrei**, ITSG-Zertifikat nötig (Kunde klärt), Upload ins Portal, DAKOTA/Verschlüsselung bei uns | I8, §5 PILOT-PLAN |
| **DATEV-Export** | **„bis zum zweiten Standort fertig" zugesagt** — nicht im PILOT-PLAN | **neu** |
| Mehrstandort | „Sie sind der erste Mehrstandort-Kunde", anfangs mehr Fehler möglich; **gemeinsame Datenbank** empfohlen (Mitarbeiterwechsel) | M3/M4 |
| Preis | Keine Preisliste; Einrichtung grob und unverbindlich genannt; Monatsgebühr hängt von Mitarbeitern, Standorten, Add-ons ab | Preis: Kemal, keine Zahlen im Repo |
| Design | Zwei Oberflächen gezeigt (neu und alt), Kunde tendiert „eher zur ersten", entscheidet später | Kemal: bleibt `main` |
| Fahrtenbuch | Für Kunde irrelevant (kein Hausbesuch am neuen Standort, Leasing) | PARTNER-FRAGEN #7 teilweise beantwortet |

## Entscheidungen / nächste Schritte

1. **Sandbox mit Testdaten, 3–4 Wochen** (Abrechnung und Mitarbeiter-Funktionen nur eingeschränkt testbar).
2. Wir senden Zugangsdaten (Fake-Mail + Passwort) **bis Ende 30.10., spätestens 31.10.** (Kemal).
3. Kunde: testet, meldet sich danach für Folgetermin; klärt **ITSG-Zertifikat**; entscheidet **gemeinsame Datenbank** ja/nein.
4. Design: Kunde hat noch Zeit.

## Antworten auf `Physio/PARTNER-FRAGEN.md` (in diese Datei eintragen!)

- #1 Abrechnung: **Selbstabrechner, kein Abrechnungszentrum** → direkte DTA bleibt richtig; THEORG nimmt keine Provision.
- #7 Hausbesuch: am neuen Standort **keine**; Fahrtenbuch für P1 irrelevant.
- #2, #3, #4, #5, #6, #8: **nicht gefragt** — im Folgetermin klären.

## Auffälligkeiten (zur Klärung, nicht entschieden)

- **Foto-Rezept-OCR** wurde als Funktion gezeigt und gelobt („sehr gut"), ist aber nach Kemals Entscheid **aus** (503, Barcode läuft). Erwartung des Kunden und Produktstand weichen ab. → Kemal entscheidet, was in der Sandbox sichtbar ist.
- **DATEV** neu zugesagt: Aufwand und Reihenfolge fehlen im Plan.
- **Design:** welche Oberfläche bekommt P1 in der Sandbox? Kunde tendiert zur zuerst gezeigten (neueren); Kemal sagt `main`.
- **Zusage „erster Mehrstandort-Kunde"** + Datenfreigabe-Empfehlung → M3 (Mehrstandort im Kasten sichtbar) wird der kritische Pfad.
- Bildschirm-Freigabe war unscharf; Rollenanzeige „Gründer/CTO" im Konferenz-Namen war nicht gewollt (Vorbereitung für nächste Termine).
