---
titel: Sitzungsnotizen — Regeln und Übersicht
typ: uebersicht
angelegt: 2026-09-21
tags: [sitzung, uebersicht]
---

# Sitzungsnotizen

Hier steht das Wichtigste aus einzelnen Arbeitssitzungen (Claude Code, Melih/Kemal):
**was** war das Problem, **was** wurde gefunden, **warum** so entschieden, **was** blieb offen.

> ⚠️ **Das sind keine Quellen.** Alles andere in `wissensbank/` sind heruntergeladene amtliche
> Belege (siehe [[README]]). Dieser Ordner ist die **einzige Ausnahme** und enthält eigene Arbeit.
> Keine Fatura-, Hukuk- oder Abrechnungsaussage stützt sich allein auf eine Notiz hier —
> maßgeblich sind immer Original + Abschnitt + Fassung, geführt in [[REGISTER]] und [[SPEC-RULES]].
> Wer fragt „haben wir das Dokument schon heruntergeladen?", schaut nicht hier nach, sondern in [[INDEX]] und [[REGISTER]].

## Regeln

1. **Eine Datei pro Sitzung/Ticket:** `JJJJ-MM-TT_ops-NNN_kurztitel.md` (ohne Ticket: `JJJJ-MM-TT_kurztitel.md`).
2. **Repo ist PUBLIC:** keine Namen von Beta-Kunden (nur `Beta-1`, `Beta-2`), keine Passwörter, Schlüssel, IPs, Zugangsdaten.
   Gründe: `CLAUDE.md` → „Kişi adı yazma", Gate `tools/check-namen.sh`.
3. **Ehrlich kennzeichnen:** was gemessen wurde, was nur gelesen, was ungeprüft ist. Nicht „getestet" schreiben, wenn nur Code gelesen wurde.
4. **Offenes gehört hinein**, genauso wie Erledigtes. Offene Arbeit selbst wird im Ops-Dashboard geführt, nicht hier.
5. **Tagesprotokoll ist etwas anderes:** „was ist an dem Tag passiert" steht in `fortschritte/JJJJ-MM-TT.md`
   (Regel: `fortschritte/REGELN.md`). Eine Sitzungsnotiz hier ist die **Wissensfassung** — Begründung, verworfene Alternativen, Lernpunkte.
6. **Links:** Notizen untereinander und auf `.md`-Dateien der wissensbank per Wikilink (doppelte eckige Klammern um den Dateinamen). Code, Migrationen und `.txt`-Quellen als Pfad in Code-Schreibweise
   (Obsidian öffnet `.txt` nicht als Notiz).
7. **Obsidian:** `wissensbank/` wird als eigener Vault geöffnet (Ordner → „Ordner als Vault öffnen"). Die lokale Vault-Konfiguration
   `wissensbank/.obsidian/` steht in `.gitignore` und wird nicht committet.

## Übersicht

**Offene M3-Abnahme:** [[2026-10-07_m3-offene-abnahme]] — echte Kamera, Handykamera auf HTTPS-Testbox, anschließend Abnahme dokumentieren.

| Datum | Ticket | Notiz | Stand beim Schreiben |
|---|---|---|---|
| 2026-10-22 | Ops Gesamtbestand / #34 / Billing-Auth | [[2026-10-22_ops-statusabgleich-und-billing-auth]] | 336 IDs erfasst, #34 neu abgeschlossen, 16 Teilnotizen; 53 Einzelpunkte offen · historische Haken keine neue Liveabnahme · Auth-Klassifikation lokal getestet, Liveursache offen |
| 2026-10-22 | Verordnung / Entwurf | [[2026-10-22_verordnung-entwurf]] | Unvollständig als `parsed`/Entwurf speichern, Abrechnungsfreigabe gesperrt · 4039 lokale Tests, Maskenprobe61/61, Module93/93 · Produkt `ff58303e`, Belege `7c36bdce` gepusht · Live-Speichern und Ursache `Invalid token` ungeprüft |
| 2026-10-22 | Hetzner / Push | [[2026-10-22_hetzner-eigener-server-und-push]] | Eigenbetrieb auf Hetzner (Weg C) dokumentiert, **nichts live getestet** · `ff58303e` gepusht · Migrationsnummern-Kollision 0079/0080 (Duplikate), `0081_warteliste` nicht live, geparkt |
| 2026-10-08 | KUTU M4 / Übergabe | [[2026-10-08_m4-fortschritt-und-kemal-uebergabe]] | Vollständige Codeübergabe integriert:3196Tests,49Zentraltests,Probe22/39,API14PASS;Kemal kann HatK fortführen · Remote-Abgleich: K2b.7a/7b bereits dokumentiert umgesetzt; weiter mit aktuellem Hat-K-Prompt (ORG/§5b; O-178 bereits umgesetzt) · Cold-FAIL und K3-/KI-/Produktionsgrenzen bleiben offen |
| 2026-10-08 | KUTU M4 | [[2026-10-08_m4-qa-bericht]] | Lokal umgesetzt und erneut geprüft: 3117 Tests, Probesuite, Merkez48/48, API14/14 · NO_NER · Cold36/156 Restlecks: Freitextqualität FAIL · lokale Kemal-Weiterarbeit freigegeben; aktuelle Reihenfolge nach Remote-Abgleich: `KEMAL_M4_UEBERGABE.md` · K3-/Anbieter-/Produktionsfreigabe offen |
| 2026-10-07 / 08 | KUTU M4 | [[2026-10-07_m4-analyse-und-plan]] | M4.1–M4.11 analysiert; Plan 1 bewertet, Plan 2 mit Gates ausgearbeitet · Umsetzung/Aktivierung nicht gestartet |
| 2026-10-07 | KUTU M3 | [[2026-10-07_m3-offene-abnahme]] | ✅* durch Melih lokal abgenommen; physische Kamera und HTTPS-Handytest offen · Checkliste für Punkte 1–3 |
| 2026-09-21 | Ops #302 | [[2026-09-21_ops-302_komplex-suche-78020]] | umgesetzt, getestet, committet · Migration `0039` **nicht live** (Stand 21.09.2026) |
| 2026-09-21 | Ops #303 | [[2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo]] | Board-Karten umgesetzt · Code-Kommentare committet (`3c0f04e`) und gepusht (21.09.2026, Merge `ff39026`) · SPEC-RULES-Korrektur offen |
| 2026-09-21 | Ops #300 | [[2026-09-21_ops-300_ik-suche-kassenfeld]] | Frontend (`4078c8c`) und Migration `0040` (`a2d8e68`) committet und gepusht (21.09.2026, Merge `ff39026`) · **View nicht live angewandt** — bis dahin wirkungslos · Live-Anwendung durch Melih offen |
| 2026-09-25 | Ops #304 | [[2026-09-25_ops-304_icd-dg-automatik]] | L1–L3 lokal umgesetzt und lokal getestet (1032/1032, Harness 18/20) · committet (`a7b1ff3`), **nicht gepusht, live ungetestet** · L4 + Kennzeichnung „aus ICD" offen |
| 2026-09-26 | QA | [[2026-09-26_qa-test-sieben-befunde]] | sieben Befunde aus dem QA-Test, Fixes gepusht (`2007c8e`, `c82e831`, `8bae297`) · live nur lesend geprüft: 5 bestätigt, „HEILMITTEL ohne Bereich" = Daten (42 NULL), „Patientenname öffentlich" = falscher Alarm · 390px + Speicher-Test offen |
| 2026-09-26 | Ops #304 | [[2026-09-26_ops-304_nachtrag-zwei-icd-felder]] | ein DG-Schreiber, zwei ICD-Felder, Preflight-Fix · gepusht (`632d1f0`, `0e163ba`) · live bestätigt: Aufteilen, d, d2 · UI1/UI2 + weiterer Kode belegt gültig · dritter Kode: bewusst kein Schema |
| 2026-09-27 | Ops #300/#301/#302 | [[2026-09-27_ops-300-301-302_live-anwendung-verifikation]] | `0039`/`0040`/`0041` live angewendet, alle Erwartungswerte live gemessen · #300 zusätzlich end-to-end im Browser bestätigt · committet (`fc89d5b`, `377b3a5`, `65f5f26`) und gepusht · #303 nicht selbst nachgeprüft |
| 2026-10-04 | KUTU M1 | [[2026-10-04_m1-fortsetzung-und-dta-integritaet]] | M1.11–M1.16-B3 lokal geprüft; CAS/immutable Uploads und eigene unveröffentlichte Entwurfsbereinigung · 2521 Tests grün · historische Aufbewahrung/DAS/Live-Abnahme offen, M1 nicht abgeschlossen |
| 2026-10-06 | KUTU M2 | [[2026-10-06_khs-m2-rezeptarten-bg-rechnung-branding]] | ✅* abgenommen mit E1–E5 · Migrationen 0067–0071 live · 1712/982/142 Tests grün, Proben grün · drei Live-Test-Läufe, alle Befunde behoben · offen: Teil C (Stempel, Mitarbeiter-Login), Release 0.5.0, GoBD-Praxiskopf-Snapshot |

| 2026-10-03 / 04 | VPS / Live-API | [[2026-10-03_live-api-liefert-html-statt-json]] | ✅ GELÖST 04.10. · Ursache: VPS-Platte 100 % voll durch Backup-Cron (8 × 2,5 GB) → calendar-api `unhealthy` → Traefik routete `/api/*` zu n8n · Platz frei, Backup-Skript ohne `binaryData`, 5 Tage, 85-%-Sperre |
| 2026-10-24 | Redesign | [[2026-10-24_redesign-phase0-phase1]] | Phase 0 fertig (Werkzeuge, Ausgangslage grün) · O-219 im Branch behoben · Phase 1 Schalter + `praxura-design.css` lokal getestet, ohne Schalter 0 px Abweichung · Branch `redesign/praxura-design`, nicht gepusht |
| 2026-10-26 | Katalog | [[2026-10-26_katalog-physio-ergo-logo]] | GKV_LEISTUNGSKATALOG Physio/Ergo/Logo denetimi · 9 sahte kod (Ergo 4, Logo 5), 9 yanlış fiyat, Physio X0102 etiketi yanlış · Ergo arşivi eskimiş (geçerli: Stand 01.07.2026) · kod yazılmadı |
