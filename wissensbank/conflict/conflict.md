---
titel: Offene Konflikte und Klärungen
typ: konflikt
angelegt: 2026-09-21
stand: 2026-09-21 (git fetch: origin/main = 9a01bd2, lokaler main = 06fb6d7)
status: offen
tags: [konflikt, git, migrationen, ops-302, ops-300, ops-301]
verwandt: ["[[SITZUNGEN]]", "[[2026-09-21_ops-302_komplex-suche-78020]]", "[[2026-09-21_ops-300_ik-suche-kassenfeld]]", "[[SPEC-RULES]]", "[[REGISTER]]"]
---

# Offene Konflikte und Klärungen

> **Zweck:** Alles, was nach Ops #302 noch entschieden oder zusammengeführt werden muss — mit Ausgangslage,
> Grund, konkretem Lösungsweg und Prüfung. **Momentaufnahme:** Nach dem Lösen einen Punkt hier als erledigt
> markieren (Datum) statt zu löschen. Keine Quelle im Sinne der wissensbank (siehe [[README]]), nur Arbeitsstand.
> Messbefehle stehen dabei, damit sich jede Zahl neu prüfen lässt.

## Überblick

| # | Konflikt / Klärung | Wer klärt | Blockiert | Lösung |
|---|---|---|---|---|
| K1 | Migrationsnummern 0038–0041 sind doppelt belegt | #300-/#301-Sitzung, Kemal informieren | Push von #300/#301 | [K1](#k1) |
| K2 | Lokaler `main` weicht von `origin/main` ab (11 lokal, 10 auf origin) | Melih, mit allen Sitzungen | jeden weiteren Push | [K2](#k2) |
| K3 | Migration `0039` (Komplex-Anker) ist nicht live | Melih (Zugriff) | die Wirkung von #302 | [K3](#k3) |
| K4 | Welche der vier Migrationen sind live? Unbekannt | `db-ustasi`, Kemal | saubere Reihenfolge | [K4](#k4) |
| K5 | Falle: `katalog:sync` im Schreibmodus | alle | — (bis K3) | [K5](#k5) |
| K6 | Vier Folgekarten A–D: ja oder nein? | Melih | — | [K6](#k6) |
| K7 | Kleine Drift-Befunde aufräumen | `fonksiyon-ustasi`, Melih | — | [K7](#k7) |
| K8 | Was ich nie selbst geprüft habe | wer es gebrauchen will | — | [K8](#k8) |
| K9 | Fremde uncommittete Änderungen im gemeinsamen Arbeitsverzeichnis | die jeweilige Sitzung | K2 | [K9](#k9) |

---

## K1

### Migrationsnummern doppelt belegt

**Ausgangslage** (Stand oben; `git ls-tree --name-only origin/main api-backend/db/migrations/ | tail -3`, dazu `ls api-backend/db/migrations | tail -5`):

| Nr. | Datei | Wo | Live? |
|---|---|---|---|
| 0038 | `0038_empfaenger_zertifikate.sql` (Kemal, ITSG/CMS-Verschlüsselung) | `origin/main` | **unbekannt** (Kopf und Commit sagen nichts) |
| 0038 | `0038_seed_heilmittel_katalog_podo_komplex_suche.sql` | nur lokaler `main` (alter Commit `8df4143`) | nein — **Duplikat** von 0039 auf origin |
| 0039 | `0039_seed_heilmittel_katalog_podo_komplex_suche.sql` (Ops #302) | `origin/main` | **nein** (K3) |
| 0039 | `0039_kostentraeger_auswahl_view.sql` (Ops #300, Commit `a2d8e68`) | nur lokal | **nein** (Notiz: „nicht angewandt", MCP-Token fehlt) |
| 0040 | `0040_krankenkassen_ik_nachtrag.sql` (Ops #301, Commit `fe0b44f`) | nur lokal | **unbekannt** |

**Warum das ein Problem ist:** Die Kette wird über die vierstellige Nummer geführt (`api-backend/db/migrations/README.md`, Kural 1). Zwei Dateien mit gleicher Nummer sind
nicht eindeutig; der Zähler-Kapı O-90 verlangt zusätzlich `bis_version` == höchste Migrationsnummer. Eine schon veröffentlichte Nummer darf nicht mehr wandern, sobald eine Box sie ausgeführt hat
(Kural 2). Aktuell gibt es **keine** Kundenbox und das SaaS führt keinen Ledger (README, „SaaS'a hangi migration'lar uygulandı") — Umnummerieren ist also **jetzt** noch billig und danach nicht mehr.

**Empfehlung (kleinster Eingriff):**

| Datei | Neue Nummer | Begründung |
|---|---|---|
| `0038_empfaenger_zertifikate` (Kemal) | bleibt 0038 | veröffentlicht |
| `0039_seed_heilmittel_katalog_podo_komplex_suche` (#302) | bleibt 0039 | veröffentlicht |
| `0040_krankenkassen_ik_nachtrag` (#301) | bleibt 0040 | Live-Werte im Kopf referenziert, Live-Stand unklar → nicht anfassen |
| `0039_kostentraeger_auswahl_view` (#300) | **0041** | nicht angewandt, nicht veröffentlicht, einzige Datei mit freier Wahl |
| `0038_seed_…` (alt, nur lokal) | **entfällt** | Duplikat |

*Alternative:* View → 0040 und #301 → 0041 (chronologisch). Nur sinnvoll, wenn `0040` (#301) sicher noch nirgends live ist und nirgends referenziert wird — mehr Dateien betroffen.

**Schritte (in der Sitzung, der die Dateien gehören — #300):**

1. `git mv api-backend/db/migrations/0039_kostentraeger_auswahl_view.sql api-backend/db/migrations/0041_kostentraeger_auswahl_view.sql`
2. Verweise nachziehen. Erst zählen: `git grep -n "0039" -- . ':!wissensbank/gemeinsam' ':!module/plz-orte.json' ':!api-backend/billing/codes/plz-bundesland.json' ':!funktionen'`
   und **jeden Treffer einzeln beurteilen** — „0039" heißt seit dem Push auch die #302-Migration. Betroffen laut Messung: `module/krankenkasse-suche.js`, `api-backend/billing/kostentraeger/parser.test.js`,
   `db/REGISTER.md`, `fortschritte/2026-09-21.md`, `konsey/KARARLAR.md`, `konsey/tutanak/2026-09-21-ik-suche-kassenfeld.md`, `konsey/tutanak/2026-09-21-krankenkassen-ik-nachtrag.md`,
   `wissensbank/sitzungen/2026-09-21_ops-300_ik-suche-kassenfeld.md`, `wissensbank/sitzungen/SITZUNGEN.md`, `api-backend/db/erwartete-zaehler.json` (und der lokal geänderte Abschnitt in `CLAUDE.md`, falls er die View nennt).
3. `api-backend/db/erwartete-zaehler.json`: **alle** `_hinweis_*` behalten (`0038` Kemal, `0039` #302, `0040` #301), den View-Hinweis von `_hinweis_0039` in `_hinweis_0041` umbenennen, `bis_version` auf `"0041"`.
4. Kopf der View-Migration: „SaaS: NICHT angewandt" bleibt, bis sie es ist.
5. **Prüfung:** keine doppelte Nummer mehr:
   `ls api-backend/db/migrations/*.sql | sed 's#.*/\([0-9]\{4\}\)_.*#\1#' | sort | uniq -d` → **leer**. Beim Commit prüft der Hook zusätzlich O-90 (`bis_version` == höchste Nummer).

**Wer:** Die Sitzung, der die View gehört (#300). Kemal sollte wissen, dass 0039 jetzt vergeben ist.

---

## K2

### Lokaler `main` weicht von `origin/main` ab

**Ausgangslage:** (`git log --format='%h %s' origin/main..main` und `git log --format='%h %an %s' main..origin/main`)

- **Nur lokal (11):** `3c0f04e` #303 Kommentare · `1c56773` #303 Doku · `fa86f5b` #301 **Billing-Fix** (`rezept-felder.js`, `krankenkasse-suche.js`) · `2c820b1` Karte · `0ef3fd8`, `fd103ca` #300 Doku ·
  `a2d8e68` #300 View-Migration · `4078c8c` #300 Kassenfeld angeschlossen · `8f6db9b`, `06fb6d7` Konsey-Einträge · `fe0b44f` #301 Migration 0040.
  Dazu **meine drei alten #302-Commits** `8df4143`, `ae61dcb`, `248274d` — sie liegen als umgebaute Fassung (`6e30ff0`, `9a01bd2`, Migration umnummeriert) bereits auf origin.
- **Nur auf origin (10):** meine zwei (`6e30ff0`, `9a01bd2`) und acht von Kemal (ITSG-Trust-Anchor, CMS-Verschlüsselung, Migration `0038_empfaenger_zertifikate`).

**Warum das ein Problem ist:** Ein `git push` von `main` wird abgelehnt (nicht Fast-Forward). Ein einfaches Zusammenführen erzeugt Konflikte in Dateien, die beide Seiten neu angelegt haben, und
bringt die alte `0038_seed_…` neben Kemals `0038_…` in den Baum. Außerdem würde ein Push von `main` den Billing-Fix `fa86f5b` und die #300-Anbindung live schalten (Backend-Neubau, Frontend) — das ist eine eigene Entscheidung, nicht Beifang.

**Empfehlung: Merge statt Rebase.** Der Merge erhält die Commit-Hashes, die in den Sitzungsnotizen zitiert werden (`fa86f5b`, `3c0f04e`, …), und entspricht dem Projektstil (mehrere Merge-Commits in der Historie).
Ein Rebase würde elf fremde Hashes umschreiben und alle Notizen dazu veralten lassen.

**Vorbereitung:** Erst K9 lösen (Arbeitsverzeichnis sauber), K1 entscheiden (die View-Nummer), dann:

```
git status                                   # muss sauber sein (K9)
git fetch origin
git branch backup/main-vor-merge-2026-09-21 main     # Rückweg: git reset --hard backup/main-vor-merge-2026-09-21
git merge origin/main                        # Konflikte erwartet
```

**Erwartete Konflikte und wie man sie löst** (beim Merge von `origin/main` in `main` bedeutet `--theirs` = die origin-Fassung, `--ours` = lokal):

| Datei | Art | Lösung |
|---|---|---|
| `api-backend/db/migrations/0038_seed_heilmittel_katalog_podo_komplex_suche.sql` | Duplikat, kein Konflikt | `git rm` (die Datei existiert auf origin als 0039) |
| `api-backend/db/migrations/0039_kostentraeger_auswahl_view.sql` | Nummer | nach K1 auf 0041 umbenennen |
| `api-backend/db/erwartete-zaehler.json` | Inhalt | alle `_hinweis_*` beider Seiten behalten, `_hinweis_0039` = #302 (origin), View → `_hinweis_0041`, `bis_version` = höchste Nummer (0041) |
| `fortschritte/2026-09-21.md` | add/add | **lokale** Fassung nehmen (`--ours`; sie trägt #303/#300/#301) und den #302-Abschnitt aus `git show origin/main:fortschritte/2026-09-21.md` übernehmen (Nummer 0039, „Commits"-Abschnitt ohne Hashes, Bullets „Migrationsnummer" und „Live-Anwendung blockiert") |
| `wissensbank/sitzungen/SITZUNGEN.md` | add/add | lokal nehmen, die #302-Zeile aus origin übernehmen (Migration `0039`, ohne Hashes); Zeilen #303/#300 behalten |
| `wissensbank/sitzungen/2026-09-21_ops-302_komplex-suche-78020.md` | add/add | **origin** nehmen (`--theirs`) — sie ist die aktuellere Fassung |
| `module/heilmittel-suche-komplex.test.js` | add/add | **origin** nehmen (`--theirs`), Kommentar nennt 0039 |
| `wissensbank/SPEC-RULES.md`, `wissensbank/REGISTER.md` | Inhalt | beide Hunks behalten; im #302-Text überall „0039" statt „0038" |
| `funktionen/INDEX.json`, `funktionen/INDEX.md` | erzeugt | **nie von Hand mergen:** eine Seite nehmen, dann `node tools/funktionskarte.mjs`, danach `node tools/funktionskarte.mjs --check` (muss „taze" melden) und committen |
| `podologie_positions.js`, `sync_heilmittel_katalog.js`, `.gitignore`, `wissensbank/README.md` | identisch | sauber |

**Nach dem Merge, vor dem Commit:** `npm test` (in `api-backend/` ggf. `npm ci`, sonst fehlen Kemals neue Abhängigkeiten wie `asn1js` — **kein** Codefehler), Migrations-Duplikatprüfung aus K1, dann Commit mit `git commit` (Hook läuft, nicht überspringen).

**Alternative Rebase** (nur wenn eine lineare Historie wichtiger ist als stabile Hashes und alle Sitzungen pausieren):
`GIT_SEQUENCE_EDITOR="sed -i '' -e '/8df4143/d' -e '/ae61dcb/d' -e '/248274d/d'" git rebase -i origin/main` — wirft meine drei alten Commits weg, spielt die elf anderen neu auf. Erwartet trotzdem Konflikte in `fortschritte`, `SITZUNGEN`, `erwartete-zaehler`, `funktionen`.

**Vorbeugung (gilt für alle Sitzungen):**
1. Vor jeder **neuen Migration** `git fetch` und `git ls-tree --name-only origin/main api-backend/db/migrations/ | tail -3`; die **nächste freie** Nummer nehmen.
2. Vor **jedem Push** `git log --oneline origin/main..HEAD` ansehen. Enthält es Commits anderer Sitzungen, die nicht mit raus sollen: in einem eigenen `git worktree add --detach <pfad> origin/main` aufsetzen (so wurde #302 gepusht).
3. Auch der Worktree `…/infinitymade-website-277` (Branch `fix/277-zuzahlung-editierbarkeit`) gehört zu einer anderen Arbeit — vor dem Merge kurz auf Migrationen prüfen (nicht untersucht).

**Prüfung, dass K2 gelöst ist:** `git log --oneline origin/main..main` zeigt nur noch die gewollten lokalen Commits (Merge-Commit + die Sitzungs-Commits, die noch nicht raus dürfen), und `git merge-base --is-ancestor origin/main main && echo ja` gibt `ja`.

---

## K3

### Migration `0039` (Komplex-Anker) live anwenden

**Ausgangslage:** Der Code ist gepusht (`9a01bd2`). Die Live-DB hat `kategorie = NULL` bei allen Podologie-Zeilen; `search_heilmittel('Komplex','podologie')` liefert **0 Treffer**. Das Supabase-MCP hat in dieser Sitzung keinen gültigen Token (`Unauthorized`).
Gegenprobe von `db-ustasi` (lesend, öffentlicher Katalog): 94 Zeilen live, **Drift 0** in 1880 Zellen außer den vier Zielzellen, kein Trigger/View/FK auf `heilmittel_katalog`, einziger Leser ist `search_heilmittel()`, Abrechnung liest die Tabelle nicht.

**Lösungswege (einer genügt):**
- **(a) MCP neu autorisieren** (`/mcp` in einer interaktiven Sitzung bzw. gültigen `SUPABASE_ACCESS_TOKEN`) — dann wendet die Sitzung sie an.
- **(b) Supabase-SQL-Editor** (Melih): die Schritte unten ausführen.

```sql
-- 1) VORHER (Erwartung: 94 | 0)
SELECT count(*) AS zeilen,
       count(*) FILTER (WHERE bereich='podologie' AND code IN ('78010','78020')
                          AND kategorie='Podologische Komplexbehandlung') AS anker
  FROM public.heilmittel_katalog;

-- 2) Den Inhalt von api-backend/db/migrations/0039_seed_heilmittel_katalog_podo_komplex_suche.sql
--    unverändert ausführen (INSERT … ON CONFLICT + DO $$-Wächter, bricht bei < 94 Zeilen oder ≠ 4 Ankern ab).

-- 3) NACHHER (Erwartung: 94 | 4), dann Funktionsprobe (Erwartung: 78010 und 78020, rank 40)
SELECT count(*) AS zeilen,
       count(*) FILTER (WHERE bereich='podologie' AND code IN ('78010','78020')
                          AND kategorie='Podologische Komplexbehandlung') AS anker
  FROM public.heilmittel_katalog;
SELECT code, label, kategorie, rank FROM search_heilmittel('Komplex','podologie');
```

**Rollback** (genau vier Zellen zurück):

```sql
UPDATE public.heilmittel_katalog SET kategorie = NULL
 WHERE bereich='podologie' AND code IN ('78010','78020')
   AND gueltig_ab IN (DATE '2025-07-01', DATE '2026-07-01')
RETURNING code, gueltig_ab, kategorie;   -- muss genau 4 Zeilen liefern
```

**Danach:**
1. Anwendungsdatum in den Kopf von `0039_seed_…` schreiben („SaaS: angewandt TT.MM.JJJJ, …") — zulässig, **solange keine Box die Datei ausgeführt hat** (Präzedenz `0015`); danach wäre es ein Verstoß gegen Kural 2.
2. `node api-backend/sync_heilmittel_katalog.js --check` (braucht Datenbankzugang) → muss **grün** werden. **Nie selbst gelaufen** (K8).
3. Den Chrome-Prüfprompt erneut laufen lassen — Erwartung „Zustand B" (2 Zeilen, kategorie „Podologische Komplexbehandlung", rank 40).
4. Sitzungsnotiz [[2026-09-21_ops-302_komplex-suche-78020]] und Tagesprotokoll auf „live" nachziehen.

---

## K4

### Welche Migrationen sind live? — unbekannt

Das SaaS führt **keinen** Migrations-Ledger (`migrate.js` läuft dort nicht; `praxura_migrations` schreibt nur `migrate.js`). Was per MCP angewandt wurde, hinterlässt sonst **keine Spur**, außer der Kopfzeile in der Datei.

| Migration | Was live erwartet wäre | Bekannt |
|---|---|---|
| 0038 (Kemal) | Tabelle `empfaenger_zertifikate` | unbekannt |
| 0039 (#302) | `kategorie` gefüllt | **nein** |
| 0039 → 0041 (#300) | View `kostentraeger_auswahl` | **nein** (Notiz) |
| 0040 (#301) | `krankenkassen.ik_number` bereinigt | unbekannt |

**Lösung:** Mit funktionierendem MCP (K3a) durch `db-ustasi` einmal lesend prüfen:

```sql
SELECT to_regclass('public.empfaenger_zertifikate')  AS t_0038,
       to_regclass('public.kostentraeger_auswahl')   AS v_0039_view,
       (SELECT count(*) FROM public.krankenkassen WHERE ik_number IS NOT NULL) AS ik_gesetzt,
       (SELECT count(*) FROM public.krankenkassen)                             AS kassen,
       (SELECT count(*) FROM public.heilmittel_katalog WHERE kategorie ILIKE '%komplex%') AS komplex_anker;
```

Ergebnis in den Kopf jeder Migration eintragen (`-- SaaS: angewandt TT.MM.JJJJ, MCP`). Kemal beantwortet 0038, die #301-Sitzung 0040 (Vergleichswert aus den Notizen: `ik_number` 76 von 94).

---

## K5

### Falle: `katalog:sync` im Schreibmodus

`node api-backend/sync_heilmittel_katalog.js` (ohne `--check`/`--sql`) **schreibt** und **löscht** alle Zeilen, die nicht in den Codedateien stehen. Aus einem Stand **vor** `6e30ff0` setzt es `kategorie` wieder auf NULL.
`preise-check.yml` ruft nur `--sql` (ohne DB) auf; `DATABASE_URL` ist im SaaS bewusst nicht gesetzt — kein Automatismus, nur ein Handlungsrisiko.

**Regel:** Schreibmodus nur von Hand, nur aus dem aktuellen `origin/main`-Stand, und erst nachdem K3 durch ist. Die Migration `0039` selbst ist harmloser (reiner UPSERT, kein DELETE).

---

## K6

### Vier Folgekarten — Entscheidung Melih

Ops-Dashboard (eigenes Supabase-Projekt, Schreibkanal `ops/tools/ingest.mjs`; Supabase-MCP zeigt auf das **Produkt**projekt, nicht darauf). Ein Kartenentwurf lässt sich mit dem Agenten `todo-maker` erzeugen.

| Karte | Inhalt | Empfehlung |
|---|---|---|
| **B** — >20-Min-Regel bei c) fehlt in der Abrechnung | `module/podologie-abrechnung.js:907-913` sperrt 78020 nur bei a)/b). Therapiezeit ist nirgends als Wert erfasst. ~15,4 € (2025) / ~15,8 € (2026) je Sitzung, bis ~92 € je Verordnung, Rückforderung in Prüfstufe 4 | **zuerst.** Klein: Bestätigungsbox „Therapiezeit über 20 Min?"; sauber: Spalte `therapiezeit_min` (→ `db-ustasi`, Migration) |
| **A** — Suchlücken | „Hornhautabtragung"/„Nagelbearbeitung" (immer 78010, kein Wort im Katalog); „gross" ↔ „groß" (kein `unaccent`) | **eine** Karte: Spalte `suchbegriffe` + ß/ss-Faltung; neue Erweiterung → `onprem` fragen; auch `search_diagnosen` betroffen |
| **C** — `pruefeHpnrWahl()` | warnt nur bei a)/b), nicht bei 78020 ohne Leitsymptomatik (`module/verordnung-podo.js:403`) | klein, danach entscheiden |
| **D** — Sackgasse ohne Diagnosegruppe | c)-Zeile fehlt ohne DG; Text von Hand → Kästchen c) bleibt leer, keine Prüfung schlägt an | erst Beta-1 fragen: „In wie vielen Muster 13 ist die Diagnosegruppe leer oder unleserlich?" |

---

## K7

### Kleine Drift-Befunde (nichts davon geändert)

- Label weicht vom amtlichen Wortlaut ab: `78510`, `78520`, `79933` (`api-backend/billing/codes/podologie_positions.js`) — `79933` nur aus der CSV abgeleitet, nicht voll geprüft.
- Zweite Label-Kopie `GKV_LEISTUNGSKATALOG.podologie` in `dashboard.js` (~Zeile 9403) mit „(Nagelspange)"-Zusatz bei 78100/78110.
- `module/rechnung-verordnung.test.js:47`: Titel „Podologische Komplexbehandlung" für 78020 weicht vom Katalog ab (Test blind für Label-Änderungen).
- `POD_ANLASS_DEFAULT` doppelt definiert (`module/verordnung-podo.js` und `module/podologie-abrechnung.js`).
- `wissensbank/SPEC-RULES.md`, Abschnitt „Einzelmaßnahme immer 78010": sagt „Maßnahme-bezogene Beschränkung nicht umgesetzt" — für a)/b) veraltet (`podologie-abrechnung.js:911-913`).
- `wissensbank/podologie/20240725_Anlage_1a_…txt` Z.136 verweist noch auf „§ 28 HeilM-RL" (alt); der Code-Verweis auf § 27a Abs. 4 ist richtig — nicht „korrigieren".

**Lösung:** `fonksiyon-ustasi` fragen (Projektregel), dann als eine Aufräumkarte fassen; die Karten-Ergebnisse nicht stillschweigend zusammenlegen.

---

## K8

### Was ich nie selbst geprüft habe

- `sync_heilmittel_katalog.js --check` gegen die Live-DB (braucht Zugangsdaten). Der Agent meldete ihn als „rot bis 0039 live" — nicht gemessen.
- Die Ausgabe der Onprem-Kapıs (O-79 Seed, O-90 Zähler): der Hook hat beide Commits angenommen, die Gate-Ausgabe habe ich nicht separat gesehen.
- `search_diagnosen` auf ß/ss, Physio/Ergo/Logo (Podologie zuerst).
- Live-`pg_proc`/`pg_views`: `db-ustasi` konnte sie ohne `service_role` nicht lesen; der Blast-Radius stützt sich auf `0000_baseline.sql` (Dump vom 10.09.2026) und die Migrationen bis 0037.
- Die Annahme von `podoloji`, Ärzte ließen die Diagnosegruppe oft leer (K6-D) — Vermutung, nicht Beobachtung.
- Der Chrome-Test ist geschrieben, aber noch nicht gelaufen.

---

## K9

### Fremde uncommittete Änderungen im gemeinsamen Arbeitsverzeichnis

Mehrere Sitzungen arbeiten im **selben** Arbeitsverzeichnis. Uncommittet und nicht von #302 (Stand oben): `CLAUDE.md` (+72 Zeilen, Abschnitt „⏳ OFFEN — Melih, Ops #301 `krankenkassen.ik_number`"), `db/NUTZUNG.json`, `db/NUTZUNG.md`;
untracked und schon länger da: `.codex/`, `AGENTS.md`, `Claude outputs/`.

**Lösung:** Die Sitzung, der es gehört, committet oder verwirft es **selbst**, bevor K2 durchgeführt wird — ein Merge bricht sonst bei betroffenen Dateien ab oder vermischt Änderungen. Wer nicht weiß, wem etwas gehört, schaut nach `git log -1 -- <datei>` und den Sitzungsnotizen in `wissensbank/sitzungen/`.

---

## Empfohlene Reihenfolge

1. **K9** — jede Sitzung committet oder legt ihre Änderungen weg.
2. **K1** — #300 nummeriert die View auf 0041 um (Kemal wird informiert).
3. **K2** — Merge von `origin/main` in `main`, Konflikte nach Tabelle, Tests, Commit. **Noch kein Push.**
4. **K3 + K4** — MCP-Token oder SQL-Editor: `0039` anwenden, Live-Stand der übrigen Migrationen klären und in die Köpfe eintragen.
5. **Push** nach Sichtung von `git log origin/main..main` (K2, Vorbeugung 2).
6. **K6** — Karten entscheiden (B zuerst), **K7** als Aufräumkarte.
