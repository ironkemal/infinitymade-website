---
titel: Konflikte aus der #303-Sitzung — Migrationsnummern, Merge, parallele Sitzungen, fachliche Widersprüche
datum: 2026-09-21
typ: konflikt
ticket: "Ops #303 (mit Berührung zu #300, #301, #302)"
status: Git- und Migrationskonflikte gelöst (Merge ff39026) · fachliche Widersprüche teils offen
tags: [konflikt, git, merge, migrationen, parallele-sitzungen, heilm-rl, ops-303]
verwandt: ["[[conflict]]", "[[2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo]]", "[[2026-09-21_ops-302_komplex-suche-78020]]", "[[2026-09-21_ops-300_ik-suche-kassenfeld]]", "[[SITZUNGEN]]", "[[SPEC-RULES]]"]
---

# Konflikte aus der #303-Sitzung

> **Abgrenzung:** [[conflict]] (Sitzung Ops #302) beschreibt die **offenen** Punkte mit Stand vor dem Merge — dort steht noch
> `origin/main = 9a01bd2`. Diese Notiz hält fest, was ich in der #303-Sitzung **erlebt und gemessen** habe: auch die
> inzwischen **gelösten** Konflikte (damit man den Weg nachvollziehen kann) und die **fachlichen Widersprüche**, die in
> [[conflict]] nicht vorkommen. Keine Quelle im Sinne der wissensbank (siehe [[README]]), nur Arbeitsstand.
> **Stand beim Schreiben:** 21.09.2026, nach dem Merge `ff39026` (23:07). `git status -sb` zeigt `main...origin/main` ohne Abweichung.
> Kennzeichnung: **gemessen** = selbst ausgeführt/gelesen · **berichtet** = nur so in einer Commit-Nachricht oder von einem Agenten gesagt.

## Überblick

| # | Konflikt | Art | Stand |
|---|---|---|---|
| C1 | Migrationsnummer 0038 doppelt (Kemal vs. Ops #302), dazu Folgeverschiebung | Migration | **gelöst** — [C1](#c1) |
| C2 | Sieben Merge-Konflikte beim Probemerge von `origin/main` | Git | **gelöst** (durch `ff39026`) — [C2](#c2) |
| C3 | Lokaler `main` und `origin/main` divergiert (14 voraus / 10 zurück), #302 doppelt in der Historie | Git | **gelöst** — [C3](#c3) |
| C4 | Zwei Sitzungen integrieren gleichzeitig; mein Push wurde überholt und blockiert | Prozess | **erledigt, Reste aufzuräumen** — [C4](#c4) |
| C5 | Onprem-Gate lehnt Commit ab (nur Kommentarzeile in `db/SCHEMA.sql`) | Gate | **umgangen (dokumentiert), nur auf totem Branch** — [C5](#c5) |
| C6 | Fachliche Widersprüche zwischen Karten, Code, Wissensbank und HeilM-RL | Fachlich | **teils offen** — [C6](#c6) |
| C7 | Board-Hierarchie: #200 verschoben, Unterkarten nicht | Board | **offen** (Entscheidung Melih) — [C7](#c7) |
| C8 | Was ich nicht prüfen konnte | Lücke | **offen** — [C8](#c8) |

---

## C1

### Migrationsnummer 0038 doppelt

**Ausgangslage (gemessen, `git ls-tree` auf `origin/main` und lokalem `HEAD`, ca. 22:55):**

| Nr. | Datei | Wo |
|---|---|---|
| 0038 | `0038_empfaenger_zertifikate.sql` (Kemal, CMS-Verschlüsselung, Schritt 1.3 C) | `origin/main` |
| 0038 | `0038_seed_heilmittel_katalog_podo_komplex_suche.sql` (Ops #302) | lokal |
| 0039 | `0039_kostentraeger_auswahl_view.sql` (Ops #300) | lokal |
| 0040 | `0040_krankenkassen_ik_nachtrag.sql` (Ops #301) | lokal |

**Warum das hart ist (gelesen in `api-backend/db/migrate.js:79-87` und `:185-187`):** `pruefeVersionen` findet doppelte Versionsnummern und
liefert `Version … doppelt` → Status `fehler`, Art `reihenfolge`. Lücken erlaubt der Runner, doppelte Nummern nicht. Eine Kundenbox würde nicht starten.

**Lösung (gemessen: `ls-tree origin/main` nach dem Merge):** Kemals `0038` bleibt; die drei lokalen rücken nach —
`0039` Ops #302 (Komplex-Anker) · `0040` Ops #300 (View `kostentraeger_auswahl`) · `0041` Ops #301 (`krankenkassen_ik_nachtrag`).
Berichtet (Commit-Nachricht `ff39026`, Umnummerierung `fc408e1`): keine der drei ist auf Prod angewandt.

**Abweichung zu [[conflict]] K1:** Dort war empfohlen, nur die View auf `0041` zu legen und #301 bei `0040` zu lassen. Umgesetzt wurde die
chronologische Variante (View `0040`, #301 `0041`), die dort als „Alternative" steht. **K1 dort ist damit überholt** und sollte von seinem Eigentümer als erledigt markiert werden.

**Vorbeugung:** Vor jeder neuen Migration `git fetch` und `git ls-tree --name-only origin/main api-backend/db/migrations/ | tail -3`; die nächste **freie** Nummer nehmen.

**Live-Stand aller vier Migrationen:** unbekannt/„nicht angewandt" nur aus Commit-Texten (siehe [[conflict]] K3, K4 und hier [C8](#c8)).

---

## C2

### Sieben Merge-Konflikte beim Probemerge

Ich habe `origin/main` (Kemals acht Commits) in einem separaten Worktree probeweise gemerged (`git merge origin/main --no-commit --no-ff`), **nach** meiner eigenen Umnummerierung. **Gemessene Konfliktliste:**

| Datei | Art | Ursache |
|---|---|---|
| `api-backend/db/erwartete-zaehler.json` | Inhalt | beide Seiten haben `_hinweis_*`/`bis_version` geändert |
| `db/REGISTER.md` | Inhalt | beide Seiten haben Tabellen-Einträge ergänzt |
| `fortschritte/2026-09-21.md` | add/add | Datei auf beiden Seiten neu angelegt |
| `wissensbank/sitzungen/2026-09-21_ops-302_komplex-suche-78020.md` | add/add | ebenso (die #302-Fassung wurde inzwischen neu aufgesetzt auf `origin` gepusht) |
| `wissensbank/sitzungen/SITZUNGEN.md` | add/add | ebenso |
| `funktionen/INDEX.json`, `funktionen/INDEX.md` | Inhalt (erzeugt) | beide Seiten haben die Karte neu erzeugt |

`db/SCHEMA.sql` wurde automatisch zusammengeführt (kein Konflikt). Ich habe den Probemerge **abgebrochen** (`git merge --abort`), nichts davon committet oder gepusht.

**Lösung (berichtet, Commit-Nachricht `ff39026`; nicht von mir ausgeführt):** #302-Doppelanlagen → die veröffentlichte Fassung von `origin/main`; `erwartete-zaehler.json` → Hinweise
`0038`/`0039`/`0040`/`0041` nebeneinander, `bis_version` `0041`, Zähler-Werte von Kemal; `db/REGISTER.md`, `fortschritte/…`, `SITZUNGEN.md` → beide Seiten vereint; `funktionen/INDEX.*` → neu erzeugt.
Berichtet: Tests Frontend 1030, Backend 373, Tools 25 grün und alle Pre-Commit-Gates.

**Regel (gilt weiter):** Generierte Dateien (`funktionen/INDEX.*`, `db/NUTZUNG.*`) **nie von Hand mergen** — eine Seite nehmen, neu erzeugen.

---

## C3

### Lokaler `main` und `origin/main` divergiert

**Gemessen (`git status -sb`, ca. 23:03):** `main...origin/main [ahead 14, behind 10]`. `git cherry -v origin/main HEAD` markierte **alle** 14 lokalen Commits als `+` (kein Patch dort schon vorhanden).
Grund: Die #302-Arbeit war auf `origin` in **umgebauter** Fassung veröffentlicht worden (`6e30ff0`, `9a01bd2`, Migration umnummeriert) — lokal lagen noch die alten Commits `8df4143`, `ae61dcb`, `248274d`. Auf `origin` fehlten dagegen #300, #301 und #303.

**Entscheidung: Merge statt Rebase.** Die Commit-Hashes stehen in den Sitzungsnotizen (`fa86f5b`, `3c0f04e`, `fe0b44f`, …); ein Rebase hätte sie umgeschrieben und die Notizen entwertet. (Die #302-Commits wurden trotzdem neu aufgesetzt —
deshalb steht in deren Tagesprotokoll „die Hashes ändern sich".)

**Gelöst:** Merge `ff39026` (23:07) ist auf `origin/main`; **gemessen** danach: `git status -sb` → `main...origin/main` ohne Abweichung.

---

## C4

### Zwei Sitzungen integrieren gleichzeitig

**Verlauf:**
1. Ich habe die Umnummerierung in einem eigenen Worktree gebaut (Commit `eed5354`, 23/23 der betroffenen Tests grün) und den Probemerge (C2) gemacht.
2. In der Zwischenzeit hat eine andere Sitzung dasselbe getan und #302 auf `origin` veröffentlicht; später auch den Gesamtmerge `ff39026` — mit derselben Nummernvergabe (`0039`/`0040`/`0041`).
3. Ich habe daraufhin **nur meine eigenen zwei Commits** auf den damaligen `origin/main` aufgesetzt (Worktree `pub`: `9f701e5`, `dbdf993`). Der Push wurde vom Berechtigungs-Check abgelehnt („Modify Shared Resources"); ich habe ihn **nicht umgangen**.
4. Der Merge `ff39026` hat meine #303-Arbeit dann mitgenommen (gemessen auf `origin/main`: Kommentar-Fix in `module/verordnung-maske.js`, 12× „Ops #303" in `fortschritte/2026-09-21.md`, Sitzungsnotiz vorhanden). **Der Push war damit hinfällig.**

**Rest zum Aufräumen (nur lokal, nicht auf `origin`):**
- Worktree `…/scratchpad/pub` (Commits `9f701e5`, `dbdf993`) — Inhalt ist auf `origin` bereits unter anderen Hashes; kann weg: `git worktree remove --force <pfad>`.
- Branch `wip/migrationen-umnummeriert` (`eed5354`) — durch `fc408e1` überholt; kann weg: `git branch -D wip/migrationen-umnummeriert`.
- Weitere Worktrees, die anderen Arbeiten gehören und nicht angefasst wurden: `…/infinitymade-website-277` (Branch `fix/277-zuzahlung-editierbarkeit`), ein zweiter Scratchpad-Worktree (`integ-300`).

**Vorbeugung (deckt sich mit [[conflict]] K2):** Vor jedem Push `git fetch` und `git log --oneline origin/main..HEAD`; enthält es Fremdes, in einem eigenen Worktree auf `origin/main` aufsetzen. **Zusätzlich:** Vor dem Bauen einer Integration kurz `git fetch` **und** prüfen, ob eine andere Sitzung sie schon macht — sonst wird doppelt gearbeitet.

---

## C5

### Onprem-Gate lehnte den Commit ab

Beim Commit der Umnummerierung (`eed5354`) meldete `tools/check-onprem.sh`: *„şema drift — döküm değişti, çalıştırılabilir zincire dosya girmedi: db/SCHEMA.sql"*. Geändert war dort **nur eine Kommentarzeile**
(Dateiname der Migration `0041_krankenkassen_ik_nachtrag`). Umbenannte Migrationsdateien zählen für das Gate offenbar nicht als „neue Datei in der Kette".

**Umgangen** mit dem in `CLAUDE.md` vorgesehenen `SKIP_MIGRATION_GATE=1` (Zweck: „yalnızca biçimsel döküm tazelemesi"), im Commit-Text begründet. **Nicht** benutzt: `SKIP_ONPREM_GATE`. Der Commit liegt nur auf dem obigen Wegwerf-Branch, **nicht** auf `origin`.

**Offene Beobachtung (vermutet, nicht verifiziert):** Nach jedem Commit standen `db/NUTZUNG.json` und `db/NUTZUNG.md` im Worktree als geändert. Vermutlich erzeugt der Pre-commit-Hook sie neu (er ruft `tabellenkarte` auf); das würde die „fremden" uncommitteten `NUTZUNG.*` im gemeinsamen Arbeitsverzeichnis erklären ([[conflict]] K9). Nicht nachgeprüft.

---

## C6

### Fachliche Widersprüche (aus Ops #303)

Ausführlich in [[2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo]]. Hier die Widersprüche als Liste — jeweils **Behauptung → Befund → Stand**:

| # | Behauptung | Befund | Stand |
|---|---|---|---|
| F1 | Karte #303: Kommentar bei `module/verordnung-maske.js:482-490` | steht bei ca. 525-533 (**gemessen**); Zeilennummern in Tickets driften | Karte im Board korrigiert (Abschlusstext) |
| F2 | „am 14.09. beantwortet" | 14.09. = Commit-Datum des Kommentars (`5fbfd81`, `git blame`); die Antwort von `gkv-302` ist vom 18.09. (`9e66ded`) (**gemessen**) | in #202/#303 und Tagesprotokoll beide Daten |
| F3 | „Komplexbehandlung (78020)" | 78020 heißt „Podologische Behandlung (groß)" (`podologie/20250617_Podologie_Anlage_2.txt:82`); die HPNR „Komplexbehandlung" ist 78003, nicht abrechenbar (**gemessen**) | Karten und Doku korrigiert |
| F4 | „§ 12 Abs. 2 Satz 2 gilt sinngemäß für Logopädie" (Karte, zwei Code-Kommentare, `SPEC-RULES.md`) | Satz 2 ist eine **eigene Regel** (max. 3 Behandlungszeiten bzw. Einzel-/Gruppenbehandlungen), `HeilM-RL_2025-05-15_iK-2025-08-05.txt:558-560` (**gemessen**) | Kommentare und Karten korrigiert; `SPEC-RULES.md`: **offen** |
| F5 | „max. 1 ergänzendes Heilmittel gilt auch für Logopädie" (`SPEC-RULES.md:85-109`) | Katalog nennt ergänzende Heilmittel nur bei Physio (12) und Ergo (6); Logo und Podologie 0 (**nachgezählt**) | **offen** (Korrektur an `gkv-302`/`wissensbank`) |
| F6 | Quelle „KVN Ausfüllhilfe Muster 13, 10/2024, Nr. 5" | Datei liegt nicht im Archiv, nicht in INDEX/REGISTER (**gemessen**) | **offen** — archivieren oder Quelle ersetzen (`praxiswissen-heilmittel.txt:1040-1064`) |
| F7 | #202: „Plus-Mechanik `.pod-hm-row` als Vorlage" | Klasse kommt im Code nirgends vor (grep: 0 Treffer, **gemessen**) | Karte korrigiert; **kein „+"-Button in der Podologie** |
| F8 | #202: „`heilmittel_items` in beiden Tabellen, keine Migration" | `verordnungen` seit 04.09. gelöscht; `heilmittel_items` ist laut Code-Kommentar Altbestand; Physio/Ergo/Logo führen `heilmittel` als Textfeld | Karte korrigiert; Datenmodell für „mehrere Heilmittel" **fehlt** |
| F9 | #302 im Board: Fix „Suchsynonym/Alias für 78020" | widerspricht der 78010/78020-Regel; umgesetzt wurde stattdessen ein Suchanker an **78010 und 78020** (`6e30ff0`) | Board-Karte **nicht angepasst**; der Abschlusstext von #303 nennt den Alias noch als offen |
| F10 | #94 (erledigt): „a → 78020, c → 78010" | passt nicht zur Regel in `SPEC-RULES.md` („Einzelmaßnahme immer 78010"); **Code nicht geprüft** | **offen/ungeprüft** |
| F11 | `praxiswissen-heilmittel.txt:811-818`: „bis zu drei vorrangige Heilmittel" auch für Logopädie | widerspricht dem Wortlaut § 12 Abs. 2 S. 2 — **berichtet** von `gkv-302`, von mir nicht gegengelesen; bindend ist die HeilM-RL | Hinweis |

**Regel-Kern (gemessen gegen die HeilM-RL):** Aufteilung auf bis zu drei vorrangige Heilmittel nur Physio und Ergo, und nur soweit der Katalog in der Diagnosegruppe mehrere vorrangige Heilmittel vorsieht (§ 12 Abs. 2 S. 1). Die Podologie steht in keinem Satz; „beides zugleich" ist das eigene Heilmittel c) Komplexbehandlung (§ 27a Abs. 4 Nr. 3).

---

## C7

### Board-Hierarchie: #200 verschoben, Unterkarten nicht

#200 wurde von Podoloji nach **Physiotherapie** verschoben. Seine Unterkarten #209 (Podoloji, offen) und #211 (Podoloji, erledigt) blieben, wo sie waren. #209 („Bezeichnung ‚Behandlung gross' klären") gehört inhaltlich zu #302 und nicht mehr unter #200.
**Entscheidung offen (Melih):** #209 unter #302 umhängen oder lassen. Auf Anweisung wurden dazu **keine** neuen Ops-Karten angelegt.

---

## C8

### Was ich nicht prüfen konnte

- **Live-DB:** Supabase-MCP antwortet mit `Unauthorized. Please provide a valid access token …`. Ob eine der vier Migrationen (0038–0041) live ist, weiß ich nicht; „nicht angewandt" steht nur in den Commit-Nachrichten der jeweiligen Sitzungen.
- **Nur von `gkv-302` berichtet, nicht von mir gegen die Quelle gelesen:** § 13a Abs. 1 lit. g (Blanko), § 12 Abs. 5 und 7, zwei G-BA-Vorgänge (Beschluss 20.08.2026 zur Diagnoseliste/Anlage 2; Beratungsverfahren 18.06.2026 zur elektronischen Verordnung — Web-Recherche, kein Archivdokument).
- **Nicht abschließend geprüft:** § 63 SGB V Modellvorhaben als mögliche Ausnahme; Rahmenvertrag § 125a SGB V (nicht im Archiv).
- **Nicht durchsucht:** Die Meeting-Dokumente (Drive-Ordner; Stelle 02:05:03).
- **Nicht gelaufen:** Der Chrome-Prüfprompt zum Board und zur Podologie-Maske (nur geschrieben).
- **Nicht selbst gesehen:** Die Ausgabe der Pre-commit-Gates beim Merge `ff39026` (nur die Aussage in der Commit-Nachricht).

---

## Offen, mit Adressat

| Was | Wer |
|---|---|
| `SPEC-RULES.md`: Logo bei ergänzendem Heilmittel (F5), KVN-Quelle (F6), Bedingung aus Satz 1 ergänzen | `gkv-302` / `wissensbank` |
| #209 unter #302 umhängen? Board-Karten #302/#94 nachziehen? | Melih |
| K1/K2/K9 in [[conflict]] als erledigt markieren (Datum 21.09.2026, Merge `ff39026`) | Sitzung, der [[conflict]] gehört |
| Aufräumen: Worktree `pub`, Branch `wip/migrationen-umnummeriert` | wer sie angelegt hat (ich) — auf Zuruf |
| Live-Stand 0038–0041 klären (MCP-Token), Anwendungsdatum in die Migrationsköpfe | Melih / `db-ustasi` (siehe [[conflict]] K3, K4) |
