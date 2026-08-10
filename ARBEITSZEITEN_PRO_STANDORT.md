# Arbeitszeiten pro Standort — Plan, noch nicht umgesetzt

> Stand 10.08.2026 · Punkt 10 der Loop-Liste `Podoloji/loop-tasks-termin.md`
> **Es wurde bewusst kein Code geändert.** Entscheidung Melih: erst planen, dann entscheiden.

## Worum es geht

Eine Praxis mit zwei Standorten hat dort unterschiedliche Öffnungszeiten. Heute hängen die
Arbeitszeiten nur an der Person, nicht am Standort — wer montags in Siegburg bis 18 Uhr und
in Bonn nur bis 14 Uhr arbeitet, kann das nicht abbilden.

## Der Befund ist besser als gedacht

Die Liste sagte „vermutlich größerer Umbau mit Schema-Änderung". Beim Nachsehen im
Live-Schema (`onprem/schema/live_schema_2026-07-06.sql`):

```sql
CREATE TABLE public.working_hours (
    id uuid …, user_id uuid NOT NULL, day_of_week integer NOT NULL,
    start_time time, end_time time, is_active boolean,
    owner_id uuid,
    business_id uuid          -- ← existiert bereits
);
CREATE INDEX idx_working_hours_business ON public.working_hours (business_id);
```

**Die Spalte ist schon da, samt Index — sie wird von keiner einzigen Codestelle gelesen
oder geschrieben.** Dasselbe gilt für `custom_days.business_id` (Feiertage/Sondertage).

Der eigentliche Blocker ist ein anderer:

```sql
ALTER TABLE working_hours
  ADD CONSTRAINT working_hours_user_id_day_of_week_key UNIQUE (user_id, day_of_week);
```

**Eine Zeile pro Person und Wochentag.** Ein zweiter Standort passt physisch nicht hinein.
Genau darauf setzen auch die beiden Speicher-Stellen auf:
`kalender.js:604` und `dashboard.js:10925` machen `upsert(..., { onConflict: 'user_id, day_of_week' })`.

## Vorgeschlagenes Vorgehen

### 1. Schritt — Datenbank (klein)

```sql
ALTER TABLE public.working_hours
  DROP CONSTRAINT working_hours_user_id_day_of_week_key;

-- NULLS NOT DISTINCT (PG 15+; wir sind auf 17) sorgt dafür, dass die bestehende
-- Zeile ohne Standort weiterhin eindeutig bleibt statt beliebig oft zu existieren.
ALTER TABLE public.working_hours
  ADD CONSTRAINT working_hours_user_day_business_key
  UNIQUE NULLS NOT DISTINCT (user_id, day_of_week, business_id);
```

Kein Backfill. Bestehende Zeilen behalten `business_id = NULL` und gelten damit weiter
für **alle** Standorte — das ist die Regel, auf der alles Weitere aufbaut:

> **`business_id IS NULL` = gilt überall.** Eine Zeile mit Standort schlägt die
> allgemeine Zeile für genau diesen Standort.

Damit bleibt jede heute laufende Praxis unverändert, solange niemand einen zweiten
Standort pflegt. Das ist der Grund, diese Reihenfolge zu wählen.

### 2. Schritt — Lesen (das Risiko)

Die Arbeitszeiten hängen an der Slot-Berechnung, am Kalender und am öffentlichen
Buchungsweg. Diese Stellen müssen den Standort berücksichtigen:

| Datei | Stelle | Was passiert dort |
|---|---|---|
| `api-backend/server.js` | ~593 und ~603 | `getAvailableSlots` — Zeiten des Mitarbeiters, sonst die des Inhabers. **Wichtigste Stelle:** hier entstehen alle buchbaren Slots. `businessId` liegt der Funktion schon als Parameter vor. |
| `api-backend/server.js` | ~1481 | Team-Wochenübersicht (`.in('user_id', allowedIds)`) — lädt alle Zeiten auf einmal, muss nach Standort gruppieren |
| `api-backend/server.js` | ~1484 | `custom_days` wird nur nach `owner_id` geladen — Feiertage eines einzelnen Standorts fehlen analog |
| `dashboard.js` | 1344, 1430, 2244/2248, 6084, 10842, 10937 | Anzeige und Bearbeitung im Dashboard |
| `kalender.js` | 575 | Owner-Ansicht |
| `booking.js` | 400, 411 | Öffentlicher Buchungsweg |
| `onboarding.js`, `employee-signup.js`, `confirm.html` | mehrfach | Anlegen beim ersten Einrichten — dort reicht weiter `business_id = NULL` |

Empfohlenes Muster an jeder Lesestelle, damit die Regel nur **einmal** existiert:
eine gemeinsame Hilfsfunktion `ladeArbeitszeiten(userId, dayOfWeek, businessId)`, die erst
die Standort-Zeile sucht und sonst auf die NULL-Zeile zurückfällt. Nicht an jeder der
zwölf Stellen einzeln ausprogrammieren — genau so entstehen Abweichungen.

### 3. Schritt — Bearbeiten

Im Arbeitszeiten-Bildschirm eine Standort-Auswahl über den Wochentagen:
„Gilt für alle Standorte" (= NULL) oder ein konkreter Standort. Die Standorte stehen in
`businesses`, die Zuordnung der Mitarbeiter in `employee_business_assignments` — beides
existiert und wird schon benutzt (z. B. `api-backend/server.js:552`).

## Warum das nicht nebenbei gemacht wird

- Ein Fehler in `getAvailableSlots` heißt: **Patienten sehen falsche oder keine Termine.**
  Das fällt sofort im Betrieb auf, und zwar bei allen Praxen gleichzeitig, nicht nur bei
  denen mit zwei Standorten.
- Es gibt **keine Testinfrastruktur** für diesen Pfad. Vor dem Umbau gehören Tests für
  `getAvailableSlots` her — die Funktion ist die teuerste Stelle im ganzen System.
- Die Umstellung braucht Testdaten mit zwei Standorten. Ohne die ist nicht prüfbar,
  ob die Fallback-Regel wirklich greift.

## Aufwand, grob

| Teil | Einschätzung |
|---|---|
| Migration (Constraint tauschen) | klein, rückbaubar |
| Tests für `getAvailableSlots` vorziehen | mittel — lohnt sich unabhängig davon |
| Lesestellen umstellen + gemeinsame Hilfsfunktion | mittel |
| Bildschirm zum Bearbeiten | mittel |

## Empfehlung

Nicht jetzt. Es gibt heute keine Praxis mit zwei Standorten in Betrieb, also hat der Umbau
kein Publikum — aber jedes Risiko trifft sofort alle. Sinnvolle Reihenfolge, wenn es
soweit ist: **erst Tests für `getAvailableSlots`, dann die Migration, dann die Lesestellen,
zuletzt der Bildschirm.**

Vorziehen lohnt nur, wenn eine konkrete Praxis mit zweitem Standort ansteht.
