---
titel: Ops #300 — IK-Suche im Kassenfeld: die Karten-IK steht nur in kostentraeger
datum: 2026-09-21
typ: sitzung
ticket: "Ops #300"
bereich: podologie, abrechnung
status: Frontend am Feld angeschlossen (4078c8c) und Migration 0039 geschrieben (a2d8e68), Konsey-Tutanak committet (8f6db9b), nicht gepusht · die View ist NICHT live angewandt, bis dahin findet die IK-Suche in der App nichts · erster Teil des Codes steht durch ein Git-Race in fa86f5b (#301-Commit)
tags: [sitzung, ik-suche, kassenfeld, kostentraeger, karten-ik, muster-13, konsey, ops-board]
verwandt: ["[[SITZUNGEN]]", "[[REGISTER]]", "[[SPEC-RULES]]", "[[INDEX]]", "[[2026-09-21_ops-302_komplex-suche-78020]]", "[[2026-09-21_ops-303_heilmittel-aufteilung-nur-physio-ergo]]"]
---

# Ops #300 — IK-Suche im Kassenfeld: die Karten-IK steht nur in kostentraeger

## In einem Satz

Die Suche im Feld „Krankenkasse / Kostenträger" findet keine IK, weil `sucheKassen()` nie auf `ik` sieht — aber
der naheliegende Fix (dort `k.ik` durchsuchen) wäre falsch: Auf Muster 13 steht die **Karten-IK**, und die steht
nur in `kostentraeger`, nicht in `krankenkassen.ik_number` (dort steht die abrechnende IK).

## Was gefunden wurde

- **Ursache (gemessen):** `sucheKassen(…, "105830016")` → `[]`, `"DAK"` → Treffer. `module/krankenkasse-suche.js` filtert nur `name` und `kurz`.
- **Karten-IK ≠ abrechnende IK:** DAK-Karte `100167999` verweist per `VKG+01` auf `105830016`. Beide sind eigene Zeilen in
  `kostentraeger`; `abrechnender_kt_ik` hält den Verweis. *Von `gkv-302` berichtet (Anlage 1 TP5 V21 § 5.5.3.1,
  EDIFACT-Auszug in `wissensbank/gemeinsam/kostentraeger/EK05Q226_KE0.txt`) — den Auszug habe ich nicht selbst nachgelesen.*
- **`rzPatKasseIk` speichert `kostentraeger_ik`, nicht `krankenkasse_ik`** (selbst gelesen: `module/verordnung-maske.js:606`,
  `module/verordnung-an-backend.js:81`). Eine Karten-IK dort würde die Gruppierung der Abrechnung und die Annahmestelle verfälschen.
- **`kostentraeger` enthält keine reine Kassenliste:** Rechenzentren („gkv informatik", „Rezeptprüfstelle …") stehen mit
  `payer_type='gkv'` darin — **am Seed geprüft:** alle 1043 Zeilen sind `gkv`, der Filter trennt also nichts. Trennen kann nur die
  VKG-Bedingung (`abrechnender_kt_ik IS NOT NULL OR EXISTS annahmestellen`). *Live nicht geprüft.*
- **Das Register war überholt:** `db/REGISTER.md` sagte „16 von 94 gefüllt, 4 falsch". Live (öffentliche Route
  `GET /api/krankenkassen`, 21.09.) waren es **76 von 94**, die falschen korrigiert — durch Ops #301. Ein Teil der ersten
  Konsey-Runde stand auf dem alten Stand.
- **Trefferzahlen je Präfix (am Seed gemessen, Obergrenze):** 2 Stellen: 1020 von 1043 beginnen mit „10" · 3 Stellen: größter
  Präfix „108" = 189 · 4 Stellen: größter „1080" = 86.

## Entschieden (Melih, 21.09.2026)

- **Nicht** gegen `krankenkassen.ik_number` suchen. Nach Auswahl steht in `rzPatKasseIk` die **aufgelöste** IK,
  `COALESCE(abrechnender_kt_ik, ik)` — wie heute. Karten-IK in `krankenkasse_ik` erfassen ist ein eigenes Ticket.
- **„Lieferung 1" (Autofill aus `krankenkassen.ik_number` stilllegen) gestrichen** — die Begründung (falsche IKs) war durch #301 überholt.
- Suche **ab 3 Ziffern** (`gkv-302` empfahl 4), nur reine Ziffern, Präfix, Leerzeichen/Punkte entfernt. Bei IK-Eingabe keine
  Namenssuche. Ziffern ohne Auswahl: Freitext bleibt. Gefülltes IK-Feld: nicht überschreiben, Abweichung sichtbar machen.
- **Weg:** View `kostentraeger_auswahl` (`security_invoker`, nur `authenticated`) per Migration; die Suche fragt sie pro
  Eingabe serverseitig nach Präfix ab (kein Cache). Fallback, falls die View nicht bald live geht: exakte 9-Ziffern-Prüfung
  ohne View (`deger-mi`).

## Verworfen

- **`k.ik` in `sucheKassen` durchsuchen:** findet höchstens die abrechnende IK, nicht die abgetippte Karten-IK; in der Kundenbox
  ist die Spalte überall NULL.
- **Client lädt `kostentraeger` mit gröberem Filter (Option B):** Rechenzentren im Dropdown; `muhalif` vermutet zusätzlich, dass
  PostgREST bei 1000 Zeilen abschneidet (Tabelle: 1043) — *nicht verifiziert*.
- **Karten-IK ins Feld schreiben:** siehe oben, verfälscht `kostentraeger_ik`.

## Gebaut

- **Reine Funktionen** in `module/krankenkasse-suche.js`: `IK_MIN_ZIFFERN = 3`, `ikAusEingabe()`, `aufgeloesteIk()`,
  `sucheKostentraeger()` (Limit 300, sonst schnitte „108" 89 Kassen still ab).
- **Anschluss am Feld:** `sucheKassenfeld()` ist die Weiche (reine Ziffern ≥ 3 → View, sonst Namenssuche), `ikAnzeige()` und
  `hinweisZeile()` liefern die Trefferzeile und den Hinweis unter dem IK-Feld („Karte X → rechnet ab bei Y", de/en/tr, Sprache aus
  `<html lang>`). Ein gefülltes Feld wird nicht überschrieben, die Abweichung wird sichtbar. Fehlt die View: leere Liste + **eine**
  Warnung, die Namenssuche bleibt unberührt; `sucheKassenfeld()` wirft nie (`attachAutocomplete` fängt eine Ausnahme aus
  `fetchItems` nicht ab). `dashboard.js`: nur der Cache-Buster der Importzeile, Zeilenzahl gleich.
- **Migration** `api-backend/db/migrations/0039_kostentraeger_auswahl_view.sql` (siehe [[REGISTER]], Eintrag `kostentraeger_auswahl`):
  `security_invoker`, `REVOKE ALL` inkl. `service_role`, `GRANT SELECT` nur `authenticated`. Filter am Box-Seed **offline nachgerechnet**:
  1043 → **893** Zeilen, keine bekannten Rechenzentren drin. Rund ein Dutzend ausgeschlossener Zeilen hat einen schlichten Kassennamen
  (AOK NORDWEST, DAK ×2, TK …) — dort kein Treffer, keine falschen Daten.
- **Geprüft:** Tests zuerst (rot, aus dem richtigen Grund), dann grün: 32 in `module/krankenkasse-suche.test.js`; `npm test`
  1030 / 344 / 25; `npm run probe` 90/90 Module laden im Browser, 274 ✓. Review-Agent (3 Anmerkungen) und `db-ustasi` (SQL: 🔴
  `service_role` im `REVOKE` — von mir gegen die Baseline gegengeprüft und behoben). **Das SQL wurde nirgends ausgeführt.**

## Lernpunkte

- **Register vor dem Vertrauen live prüfen** — hier die öffentliche Route; ein ganzer Konsey-Zweig hing an einer Zahl von vor zwei Wochen.
- **Parallele Sessions teilen sich einen Git-Index.** Mein gestagter Stand wurde vom `git commit` einer anderen Session mitgenommen
  (Commit `fa86f5b`, Nachricht „Ops #301"). Historie nicht umgeschrieben. Künftig: `git commit -- <Pfade>`, und die Funktionskarte
  aus einem sauberen `HEAD`-Scratch erzeugen, damit sie nur das eigene Delta enthält.
- **Einem Agenten-Bericht nicht blind folgen:** `gkv-302` widersprach sich bei `payer_type`; der Seed entschied.
- **„Suche findet X nicht" zuerst mit der Frage beginnen, ob die Datenquelle X überhaupt enthält.**

## Offen

- **Melih wendet die Migration `0039` live an** (Supabase-MCP nicht autorisiert; der SQL-Editor geht auch) — erst dann wirkt die
  IK-Suche. **Vorher/nachher** die Abfragen aus dem Kopf der Datei. **Reihenfolge:** View live, **dann** das Frontend pushen.
- **Danach:** `db/SCHEMA.sql`, `SCHEMA-RLS.sql`-Kopf und der Vermerk „SaaS: angewandt" als **zweiter Commit** (der Dump ist ein
  Live-Abzug; `SKIP_MIGRATION_GATE=1`).
- **Von Hand im Browser prüfen** (Login nötig): Muster-13-Maske, `100167999` → DAK, IK-Feld `105830016`, Hinweiszeile; andere
  Kasse bei gefülltem Feld; Freitext für Privatpatienten; en/tr. Die Browser-Probe hat nur gezeigt, dass das Modul lädt.
- **`gkv-302`:** Können die ausgeschlossenen IKs mit schlichtem Kassennamen Karten-IKs sein?
- Konsey-Tutanak `konsey/tutanak/2026-09-21-ik-suche-kassenfeld.md` und Eintrag in `konsey/KARARLAR.md` sind committet (`8f6db9b`).
- Backlog: Karten-IK nach `prescriptions.krankenkasse_ik`; `das_ik`-Rest (siehe [[REGISTER]], Eintrag `kostentraeger`); mögliches
  Zeilenlimit bei `ladeKostentraegerNamen()` in `dashboard.js`.
- Nicht geprüft: Live-DB, das SQL selbst, Verhalten im echten Browser, Physio/Ergo/Logo.
