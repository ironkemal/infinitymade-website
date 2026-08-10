# Offen — Stand 11.08.2026

> Reihenfolge einhalten. Schritt 2 vor Schritt 1 friert einen kaputten
> Zwischenstand ein. Erledigtes hier durchstreichen oder löschen.

---

## 1. 🔴 `SUPABASE-JETZT-AUSFUEHREN.sql` ausführen — dringend

Supabase-SQL-Editor, Projekt **`njvuclullotbksskpwgk`** (Produkt, **nicht** das
Ops-Projekt `farkaejociddtgqkusvm`).

Der Code ist seit dem 10.08. live, die Spalten fehlen in der DB. In Produktion
kaputt, für Beta-Kunden sichtbar:

| Fehlt | Kaputt |
|---|---|
| `belegliste.zahlart` · `prescriptions.zuzahlung_zahlart` | Kassieren schlägt fehl |
| `leads.ausfallvereinbarung_am` | Ausfallrechnung erstellen → 404/500 |
| `mahnungen.ausfallrechnung_id` | Mahnwesen-Bildschirm → 500 |

Kein Datenschaden — der Code bricht mit Fehler ab, es wird nichts Falsches
geschrieben. Nicht gebuchte Zuzahlungen lassen sich normal nachholen.

Das Skript läuft als **eine Transaktion**, ist durchgehend `IF NOT EXISTS` /
`DROP IF EXISTS`, verändert keine Bestandsdaten und ist gefahrlos wiederholbar.

**Danach:** den auskommentierten Kontrollblock am Dateiende separat laufen
lassen — alle fünf Zeilen müssen `true` zeigen.

## 2. Schema-Dump tazelen

Erst wenn Schritt 1 durch ist. In `db/SCHEMA.sql` und `db/SCHEMA-RLS.sql`:

- alle mit **⏳** markierten Stellen entmarkieren (die zwei Indizes in
  `SCHEMA-RLS.sql` sind auskommentiert → einkommentieren)
- den ⏳-Block im Kopf beider Dateien löschen
- `ERZEUGT AM` + `LETZTE MIGRATION` fortschreiben
- Abschnitt „⏳ Ausstehend" in `db/README.md` löschen

Sauberer Weg, sobald Supabase-MCP wieder verfügbar ist: Dump komplett neu
introspizieren statt von Hand nachziehen. Auslöser: **„Schema aktualisieren"**
(`db/README.md`). In der Sitzung vom 11.08. war kein MCP-Werkzeug da — deshalb
die ⏳-Markierungen als Zwischenlösung (Commit `e1c9ef8`).

## 3. `git push`

Offen sind: `8acb226` (Sammelskript) · Bericht `fortschritte/2026-08-11.md` ·
`e1c9ef8` (⏳-Markierungen im Dump) · diese Datei.

⚠️ `git push` im Vordergrund ausführen, nicht im Subagenten/Hintergrund —
sonst kein Zugriff auf den Credential Manager, der Befehl hängt still.

## 4. Im Browser gegenprüfen (nach dem Deploy)

- Kassieren mit Zahlart
- Ausfallrechnung bei **kurzfristiger** Absage — Warnung sichtbar, wenn
  `ausfallvereinbarung_am` fehlt?
- Ausfallrechnung bei **rechtzeitiger** Absage — muss jetzt gesperrt sein,
  mit Übersteuern-Knopf
- Mahnwesen-Bildschirm zeigt beide Forderungsarten (Rezept + Ausfallrechnung)

Hintergrund: nichts davon lief je gegen die echte DB oder im Browser. Getestet
sind die reinen Funktionen (`frist.js`, `stufe.js`, `resolver.js`, 243 Tests
grün), **nicht** die Routen drumherum.

---

## Rechtsfragen — vor der ersten echten §302-Abrechnung klären

Bewusst nicht geraten, es gibt hier keinen `legal-de`/`gkv-302`-Agenten.

1. **10-€-Verordnungspauschale bei rein zuzahlungsfreien Rezepten** — offene
   Fachfrage aus `PREISE-ANALYSE.md`. Druckweg und §302-Weg sagen beide „ja"
   und sind wenigstens einig; bestätigen lassen.
2. **Mahngebühr / Verzugszinsen auf ein Ausfallhonorar** — nichts gebaut.
3. **Wirksamkeit der 24-Stunden-Absagefrist** — hängt am Wortlaut der
   Ausfallvereinbarung, nicht am Code. Die 24 h sind nur eine änderbare Vorgabe.

---

## Ungeprüfte Annahmen — nicht anfassen ohne Beleg

- **`physio_positions.js` `gueltig_ab: 2026-01-01`** — übernommen, nie gegen
  Anlage 2 Physiotherapie abgeglichen. `seed_tarifs.js` schreibt es seit jeher
  so in die DB.
- **Physio-Preishöhen** unverändert — es lag nur das Podologie-Dokument vor.
- **Podologie 78210/78220/78230/78300/78400** mit `deprecated: true` und
  `gueltig_bis: '9999-12-31'` sieht falsch aus, **ist aber richtig**: Anlage 2
  nennt für sie einen 01.07.2026-Preis, weil eine Verordnung von vor dem
  01.10.2025 noch 2026 behandelt werden darf. Nicht „reparieren".

---

## Gehört ins Ops-Dashboard (Kategorie Teknik)

- **`heilmittel_katalog` hat nirgends im Repo ein `CREATE TABLE`.** Existiert
  nur in Supabase und in den Erwartungen von `sync_heilmittel_katalog.js`. Auf
  einem frischen On-Prem-Server nicht anlegbar → echte Lücke für den Umzug.
- **`PATCH /mahnwesen/:id/status`** setzt nur den Status der Mahnung, nicht den
  der Forderung. Absicht: eine bezahlte Ausfallrechnung läuft über
  `PATCH /billing/ausfall/:id/status`, nur dort entsteht der GoBD-Beleg.

> Offene Aufgaben gehören eigentlich ins Ops-Dashboard
> (https://ops.infinitymade.de → Aufgaben), nicht in Repo-Dateien. Diese Liste
> hängt bewusst neben dem Skript, das noch laufen muss — nach Schritt 1–4
> löschen und Restliches ins Dashboard übertragen.
