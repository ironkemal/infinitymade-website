# Physio-Launch P1 — kritischer Pfad

> Stand 19.11.2026. Ziel: P1 arbeitet vor Eröffnung des zweiten Standorts (Ende Dez / Anfang
> Jan) im Alltag mit Praxura. Depo public → kein Kundenname, keine Stadt, kein Preis.
> Detailplan und Kemal-Entscheidungen: `PILOT-PLAN.md` (nicht hier wiederholt).

## Grundsatz: Launch in zwei Stufen

| Stufe | Inhalt | Abrechnung |
|---|---|---|
| **1 — Praxisalltag** | Kalender, Räume, Standorte, Team/Urlaub, Serien, Verordnung, Sitzungsabschluss, Befund/E-Akte, Vorlagen, Privat-/Zuzahlungsrechnung | GKV-Abrechnung bleibt in THEORG (PILOT-PLAN §1, Kemal 30.10.) |
| **2 — §302 in Praxura** | Physio-DTA, Entlassmanagement-Freigabe, Tages-Zuzahlung (#22) | parallel testen, dann umstellen |

Folge: **§302 liegt NICHT auf dem kritischen Pfad.** AZE 03.11.: Freigabe hängt am IK, nicht an
der Software → P1 braucht kein neues Erprobungsverfahren, nur valide Dateien.

## Kritischer Pfad Stufe 1 (ohne diese Punkte kein Start)

| # | Was | Wer | Braucht |
|---|---|---|---|
| L1 | Box-Probeinstallation Hetzner CX33 (I1) — Abnahme = 14 Prüfungen `onprem/RELEASE-STANDARD.md` §5.4, Anleitung `onprem/KURULUM.md` Weg C | Kemal | Hetzner-Zugang |
| L2 | Backup in Storage Box + **Wiederherstellung geübt** + Schlüssel an Praxis (I2, KURULUM §5) | Kemal | L1 |
| L3 | Alarm-Mail + externer Uptime-Check (I3) | Kemal | L1 |
| L4 | Update-Kanal einmal Ende-zu-Ende (I4) | Kemal | L1 |
| L5 | Mehrstandort in installierter Box (M3, `tools/box-standort-abnahme.md`) | Melih/Kemal | GO + VM oder L1-Box |
| L6 | Zugangsübergabe: unser Schlüssel gelöscht, Praxis bestätigt (I5) — **vor** dem ersten Patientendatum | Kemal + P1 | L1–L5 |
| L7 | Vertrag inkl. KI-Anlage unterschrieben (PILOT-PLAN §1) | Kemal | Preis (offen) |

Nicht blockierend, wenn KI zum Start aus bleibt (Box-Standard `AI_MODE=aus`): K4/K5 KI in der Box.
→ **Vorschlag: mit KI aus starten, KI nachschalten.** Spart Azure-/Merkez-Deploy auf dem kritischen Pfad.

## Vor dem Start bei P1 erfragen (Kemal)

Nur diese vier beeinflussen den Start, Rest von `PARTNER-FRAGEN.md` später:

1. **#13 THEORG-Export** — ohne Datei Datenübernahme von Hand (Aufwand für P1 bei 2 Standorten)
2. **#14 eigenes IK für Standort 2** — bestimmt Abrechnungs-/Nummernkreis-Einrichtung
3. **#1 eigene DTA oder Abrechnungszentrum** — bestimmt, ob Stufe 2 DTA oder Export braucht
4. **#22 Zuzahlung Alter 18 / Befreiung** — erst danach Tages-Zuzahlung einschalten

## Abnahmen im SaaS-QA-Konto (Melih)

- Gerätetests: Passwort, Google-Kalender, Kamera, GPS
- F9/F11 Urlaub als Inhaber und als Mitarbeiter, S5/S6 Standortplanung, F2 Widget im bestätigten QA-Mandanten
- Kompakte Checkliste dafür baut der Gemini-Agent (Tab „Offene Punkte 1“)

## Wer arbeitet woran (19.11.2026, ohne Überschneidung)

| Agent | Bereich | Dateien |
|---|---|---|
| Codex „Physio-QA-Bericht prüfen“ | Raum/Sondertag/Serie-Fixes im Working Tree | module/raum-*, sondertag*, serien-*, dashboard.* |
| Gemini „Offene Punkte 1“ | Rechnungsrechte 0081, signOut lokal, Fehlertexte, Launch-Probe + Live-Checkliste | auth-/booking-request-Seiten, Probe-Tools |
| Claude „Offene Punkte 2“ | Stufe 2 vorbereiten: Physio-Testsatz für TA-Validator/AZE; diese Datei | api-backend/billing/**, Physio/*.md |
