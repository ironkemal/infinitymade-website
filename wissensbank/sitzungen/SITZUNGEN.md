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

| Datum | Ticket | Notiz | Stand beim Schreiben |
|---|---|---|---|
| 2026-09-21 | Ops #302 | [[2026-09-21_ops-302_komplex-suche-78020]] | umgesetzt, getestet, committet (`8df4143`, `ae61dcb`) · **nicht gepusht** · Migration `0039` **nicht live** |
| 2026-09-21 | Ops #303 | [[2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo]] | Board-Karten umgesetzt · Code-Kommentare committet (`3c0f04e`), nicht gepusht · SPEC-RULES-Korrektur offen |
| 2026-09-21 | Ops #300 | [[2026-09-21_ops-300_ik-suche-kassenfeld]] | Frontend (`4078c8c`) und Migration `0040` (`a2d8e68`) committet, nicht gepusht · **View nicht live angewandt** — bis dahin wirkungslos · Live-Anwendung durch Melih offen |
