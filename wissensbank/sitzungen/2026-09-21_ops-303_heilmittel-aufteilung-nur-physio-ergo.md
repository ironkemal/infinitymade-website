---
titel: Ops #303 — „mehrere Heilmittel je Verordnung" gilt nur für Physio/Ergo (+Logo-Sonderregel)
datum: 2026-09-21
typ: sitzung
ticket: "Ops #303"
bereich: physiotherapie, ergotherapie, logopaedie, podologie (Abgrenzung)
status: Board-Karten #200/#202/#303 umgesetzt und gegengelesen · Code-Kommentare committet (3c0f04e), nicht gepusht · SPEC-RULES-Korrektur offen
tags: [sitzung, heilm-rl, muster-13, aufteilung, vorrangige-heilmittel, ergaenzendes-heilmittel, podologie, logopaedie, ops-board]
verwandt: ["[[SITZUNGEN]]", "[[SPEC-RULES]]", "[[REGISTER]]", "[[INDEX]]", "[[2026-09-21_ops-302_komplex-suche-78020]]"]
---

# Ops #303 — „mehrere Heilmittel je Verordnung" gilt nur für Physio/Ergo (+Logo-Sonderregel)

## In einem Satz

Die Aufteilung einer Verordnung auf bis zu drei vorrangige Heilmittel ist nach HeilM-RL § 12 Abs. 2 Satz 1 **nur Physiotherapie und Ergotherapie** erlaubt;
die Logopädie hat mit Satz 2 eine **eigene, andere** Regel; die Podologie steht in keinem der Sätze. Die Board-Karten #200 und #202 sagten das nicht —
sie luden dazu ein, in der Podologie einen „+"-Button für weitere Heilmittel zu bauen.

## Ausgangslage

- Aufgabe war **kein Code-Fix**, sondern Board-Pflege und Regelklärung: #200 und #202 standen offen auf „hoch", #200 unter Podoloji.
- Im Meeting vom 18.09.2026 kam wieder: „mit dem Plus-Zeichen ein anderes Heilmittel hinzufügen … kann man immer noch nicht" (02:05:03).
- In #202 stand noch „gkv-302 fragen, wie viele Heilmittel Muster 13 trägt" — beantwortet, aber nicht als beantwortet markiert.
- Die Karte #303 selbst behauptete: Kommentar in `module/verordnung-maske.js:482-490`, „am 14.09. beantwortet", „Komplexbehandlung (78020)". **Alle drei Angaben waren ungenau** (siehe unten).

## Die Regel — gegen die Originale gelesen (21.09.2026)

| Aussage | Ergebnis | Quelle |
|---|---|---|
| Satz 1: Aufteilung auf max. 3 unterschiedliche vorrangige Heilmittel nur Physio und Ergo, **und nur soweit der Katalog in der Diagnosegruppe mehrere vorrangige Heilmittel vorsieht** | bestätigt | `gemeinsam/heilmittel-richtlinie/HeilM-RL_2025-05-15_iK-2025-08-05.txt:555-558` |
| Satz 2 (Logopädie) gilt „sinngemäß" wie Satz 1 | **falsch** — Satz 2 ist ein eigener Tatbestand: max. drei verschiedene **Behandlungszeiten oder Einzel-/Gruppenbehandlungen** | `…:558-560` |
| Podologie hat kein Aufteilungsrecht | bestätigt — steht in keinem der Sätze | `…:555-561` |
| „Beides zugleich" ist in der Podologie ein eigenes Heilmittel | bestätigt: Komplexbehandlung, § 27a Abs. 4 Nr. 3; Katalog DF/NF/QF „Vorrangige Heilmittel a) b) c)" | `…:1140-1142`, `…:3378-3381` |
| Kein ergänzendes Heilmittel in der Podologie | bestätigt: Anlage 3 Feld g2 „Entfällt" | `podologie/20250617_Podologie_Anlage_3_Lesefassung.txt:465-473` |
| Max. 1 ergänzendes Heilmittel (§ 12 Abs. 3), auch für Logo | **falsch für Logo**: der Katalog nennt ergänzende Heilmittel nur bei Physio (12 Stellen) und Ergo (6); Podologie und Logo haben 0 | von mir nachgezählt in `…:2434-3349`, `:3350-3578`, `:3579-4419`, `:4420-5117` |
| KVN-Ausfüllhilfe Muster 13 (10/2024, Nr. 5) als Quelle | **nicht belegbar** — Datei liegt nicht im Archiv, weder in [[INDEX]] noch [[REGISTER]] | Ersatz: `gemeinsam/heilmittel-richtlinie/praxiswissen-heilmittel.txt:1040-1064` |

**Wichtige Präzisierung:** Das Argument „Podologie hat nur ein Heilmittel im Katalog" wäre falsch — der Katalog nennt in DF/NF/QF **drei** vorrangige Heilmittel.
Die Bedingung aus Satz 1 wäre also erfüllt; es scheitert allein daran, dass § 12 Abs. 2 Satz 1 nur Physio und Ergo nennt. So muss eine Karte oder ein Kommentar begründen.

## Zwei Ebenen, wieder verwechselt: Heilmittel c) vs. Position 78020

Dasselbe Muster wie in [[2026-09-21_ops-302_komplex-suche-78020]]: „Komplexbehandlung" ist der Name des **verordneten Heilmittels c)**, nicht einer Abrechnungsposition.
78020 heißt in Anlage 2 „Podologische Behandlung (groß)" (`podologie/20250617_Podologie_Anlage_2.txt:82`). Die HPNR, die im Verzeichnis „Podologische Komplexbehandlung" heißt, ist
**78003** und hat keinen Preis (nicht abrechenbar; Regel in [[SPEC-RULES]]). Abgerechnet wird 78010, bei Therapiezeit über 20 Minuten 78020.
**„Komplexbehandlung (78020)" gehört deshalb in keine Karte.**

## Datum: 14.09. und 18.09. sind zwei verschiedene Ereignisse

- **14.09.2026** = Commit-Datum des Code-Kommentars (`5fbfd81`, per `git blame` auf `module/verordnung-maske.js`). Es belegt, *wann der Kommentar geschrieben wurde*, nicht, dass eine dokumentierte Quellenprüfung stattfand; in [[SPEC-RULES]], [[REGISTER]] und [[INDEX]] gibt es keinen 14.09.-Eintrag.
- **18.09.2026** = Antwort von `gkv-302` in #202 und Eintrag in [[SPEC-RULES]] (Commit `9e66ded`).
- Für „beantwortet" schreiben wir daher beide: Codeprüfung 14.09., Antwort gkv-302 18.09.
- Der Kommentar steht heute in `module/verordnung-maske.js` um Zeile 525-533, nicht mehr bei 482-490. **Zeilennummern in Tickets driften** — lieber Funktion, Commit oder Kommentartext nennen.

## Was im Code tatsächlich steht (nur gelesen, nichts ausgeführt außer `node --check`)

- **Es gibt keinen „+"-Button für weitere Heilmittel in der Podologie.** Die in #202 als Vorlage genannte Klasse `.pod-hm-row` kommt im aktuellen Code nirgends mehr vor (grep über js/html/css: 0 Treffer). Es wurde also kein regelwidriges Feature gebaut.
- `heilmittel_items` ist laut Kommentar in `module/verordnung-maske.js` (um Zeile 517-523) **Altbestand**: seit 06.09.2026 schreibt es kein Weg mehr, die Abrechnung liest es nicht. Gelesen wird es noch an einigen Stellen (`module/rechnung-verordnung.js`, `module/verordnung-pruefung.js`, `module/podologie-abrechnung.js`).
- Physio/Ergo/Logo führen `heilmittel` als **einzelnes Textfeld** (`api-backend/billing/api/statistik.routes.js:357-362`). Für „mehrere Heilmittel" gibt es dort also **kein fertiges Datenmodell**; „keine Migration nötig" (so stand es in #202) stimmt nicht. Vor einer Umsetzung `db-ustasi` fragen.
- Die Tabelle `verordnungen` wurde am 04.09.2026 gelöscht (nur noch `prescriptions`); #202 sprach noch von „beiden Verordnungstabellen".

## Was geändert wurde

**Ops-Board** (Tabelle `ops_todos`, eigenes Supabase-Projekt — nicht das Produkt-Projekt):

| Karte | Änderung |
|---|---|
| #200 | Kategorie Podoloji → **Physiotherapie**; Titel enthält „nur Physio/Ergo (+Logo)"; Notiz mit Regel und Quellen; „fachlich blockiert" → „zurückgestellt wegen Vertikal-Reihenfolge" |
| #202 | Titel enthält „nur Physio/Ergo (+Logo)"; alte Frage an gkv-302 als **BEANTWORTET (14.09./18.09.)** markiert; veraltete Technik-Angaben korrigiert (`heilmittel_items` in beiden Tabellen, `.pod-hm-row` als Vorlage) |
| #303 | auf erledigt gesetzt, Abschlusstext mit den Korrekturen und den offenen Punkten oben in der Notiz |

Alte Notizen stehen jeweils **unverändert am Ende** der Karte. Kontrolle nach dem Schreiben: Titel/Notiz/Kategorie gelesen; Priorität, Zuständiger, Elternkarte und `done` gegen ein vorher gezogenes Backup verglichen (unverändert).

**Repo:** Commit `3c0f04e` korrigiert zwei Code-Kommentare (`module/verordnung-maske.js`, `module/verordnung-podo.js`), die Satz 2 als „sinngemäß" bezeichneten. Nur Kommentare, gleiche Zeilenzahl, kein Verhalten geändert; nicht gepusht.

## Warum so und nicht anders (verworfen)

- **Titel nur „nur Physio/Ergo (+Logo)" ohne Erklärung** — wäre für Logo missverständlich (Satz 2 ist eine andere Regel, und dort gibt es kein ergänzendes Heilmittel). Die Kurzform bleibt im Titel (Vorgabe für „Fertig wenn"), die Notiz erklärt die Logo-Sonderregel.
- **#209 unter #302 umhängen** — nicht getan, war nicht Teil von #303.
- **`SPEC-RULES.md` gleich mitkorrigieren** — nicht getan: die Datei wurde zur selben Zeit in einer anderen Sitzung bearbeitet (Ops #302); ein Eingriff hätte sich mit deren Änderungen vermischt.
- **Neue Ops-Karten für die offenen Punkte** — auf Anweisung nicht angelegt; sie stehen hier und im Abschlusstext von #303.

## Offen / ungeprüft

- **`SPEC-RULES.md` Abschnitt „Muster 13 … Heilmittel-Limit"** (Ops #202, 18.09.): führt Logopädie beim ergänzenden Heilmittel im Geltungsbereich und beruft sich auf die KVN-Ausfüllhilfe, die nicht im Archiv liegt. Korrektur gehört an `gkv-302`/`wissensbank`; die Sitzung zu #302 hat ihre Änderungen an der Datei inzwischen mit `8df4143` committet, sie ist also frei.
- **#302:** Die Karte im Board trägt noch den Fix-Text „Alias für 78020", der der 78010/78020-Regel widerspricht. Umgesetzt wurde es inzwischen anders: Suchanker auf 78010 **und** 78020 (Commit `8df4143`, siehe [[2026-09-21_ops-302_komplex-suche-78020]]). Ob die Karte im Board nachgezogen wird, ist nicht entschieden; ich habe sie nicht angefasst.
- **#94 (erledigt):** Die Zuordnung „a → 78020, c → 78010" in der Karte passt nicht zur Regel. **Code dazu nicht geprüft.**
- **Nur von `gkv-302` berichtet, von mir nicht gegen die Quelle gelesen:** § 13a Abs. 1 lit. g (Blanko, Heilmittel entfällt), § 12 Abs. 5 und 7 (Kombinationen, getrennte Vordrucke), ein Widerspruch innerhalb von `praxiswissen-heilmittel.txt:811-818` (dort steht „bis zu drei vorrangige Heilmittel" auch für Logo — vermutlich die Herkunft von „sinngemäß"), sowie zwei G-BA-Vorgänge (Beschluss 20.08.2026 zur Diagnoseliste, Anlage 2; Beratungsverfahren 18.06.2026 zur elektronischen Verordnung). Letzteres war eine Web-Recherche, kein Archivdokument.
- **Nicht abschließend geprüft:** § 63 SGB V Modellvorhaben als mögliche Ausnahme; Rahmenvertrag § 125a SGB V liegt nicht im Archiv.
- Die Meeting-Dokumente (Drive-Ordner, Stelle 02:05:03) wurden nicht durchsucht.

## Lernpunkte

1. **Den Agenten-Bericht nachlesen.** `gkv-302` fand drei Fehler in der scheinbar sicheren Formulierung („sinngemäß", „78020", „3+1 auch für Logo"). Die Zitate wurden danach einzeln gegen die `.txt`-Quellen gelesen.
2. **„Geprüft am …" im Kommentar ist ein Commit-Datum**, keine Quelle. Bei Datumsfragen `git blame` + Wissensbank-Eintrag trennen.
3. **Board schreiben ohne Datenverlust:** neuen Text vor die alte Notiz setzen (`neu || notes`) und per `WHERE … AND notes NOT LIKE '<Marker>%'` idempotent halten; vorher Backup ziehen. Das Repo-Skript `ops/tools/ingest.mjs` kann nur anlegen, nicht ändern; Änderungen gehen per SQL gegen das Ops-Projekt (Management-API, Token aus der Shell-Umgebung, Datei `ops/.env.ops` fehlt auf diesem Rechner).
4. **Karten und Kommentare nennen Ebene und Wort getrennt:** verordnetes Heilmittel c) (Maßnahme) ≠ Position 78010/78020 (Leistung) ≠ HPNR 78003 (gleicher Name, nicht abrechenbar).
