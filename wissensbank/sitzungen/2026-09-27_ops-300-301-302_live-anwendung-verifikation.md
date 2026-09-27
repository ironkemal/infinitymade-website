---
titel: Ops #300/#301/#302 — Migrationen live angewendet und verifiziert
datum: 2026-09-27
typ: sitzung
ticket: "Ops #300, #301, #302"
bereich: podologie
status: alle drei Migrationen live und verifiziert · Doku aktualisiert und committet (`fc89d5b`, `377b3a5`)
tags: [sitzung, podologie, migration, kostentraeger, krankenkassen, heilmittelkatalog, deployment]
verwandt: ["[[SITZUNGEN]]", "[[REGISTER]]", "[[2026-09-21_ops-300_ik-suche-kassenfeld]]", "[[2026-09-21_ops-302_komplex-suche-78020]]"]
---

# Ops #300/#301/#302 — Migrationen live angewendet und verifiziert

## In einem Satz

Die drei am 21.09.2026 geschriebenen, aber nicht angewandten Migrationen (`0039` Heilmittel-Komplex-Anker,
`0040` Kostenträger-Auswahlsicht, `0041` Krankenkassen-IK-Nachtrag) sind jetzt live; alle Erwartungswerte aus
den Migrationsköpfen wurden gegen die echte Prod-DB nachgemessen, nicht nur gelesen.

## Ausgangslage

Browser-Check von Ops #300 auf `app.praxura.de` (Claude in Chrome) fand: Frontend-Code korrekt, aber Kassenfeld-
IK-Suche liefert leere Liste. Netzwerk-Log: `GET .../kostentraeger_auswahl` → **404**. Damit bestätigt: Code
sauber deployt, nur die View fehlte auf Prod — genau der in `0040` beschriebene, noch nicht angewandte Zustand.

## Was gemessen wurde (nicht nur gelesen)

**Vor der Anwendung (Vorab-Checks aus den Migrationsköpfen):**
- `heilmittel_katalog`: 94 Zeilen, `kategorie` bei 78010/78020 (beide Preisfenster) = `NULL` → 0039 bestätigt noch nicht angewandt.
- `kostentraeger` inaktive Zeilen: 0.
- Erwartete Sicht-Zeilenzahl (offline nachgerechnet im Migrationskopf): 893 — per SQL gegen Prod vorab nachgerechnet: **893**, exakte Übereinstimmung.

**Nach Anwendung `0039` + `0040` (MCP `apply_migration`, Freigabe Melih):**
- `kostentraeger_auswahl`: **893 Zeilen** (Live-Zählung, nicht Vorhersage).
- Rechenzentren-Treffer (`gkv informatik`, IQVIA, Medent, Rezeptprüfstelle, AZE Emmendingen, BITMARCK): **0**.
- Stichprobe `ik='100167999'` → `DAK-Gesundheit`, `abrechnender_kt_ik='105830016'` — exakt der im Migrationskopf vorhergesagte Wert.
- `78010`/`78020` in beiden Preisfenstern: `kategorie='Podologische Komplexbehandlung'`, `kuerzel` weiterhin `NULL`.
- `search_heilmittel('Komplex','podologie')` liefert live genau 78010 + 78020 mit amtlichem Label.

**`0041` (#301) — bereits von einer parallelen Sitzung angewendet, unabhängig nachgeprüft statt der Notiz vertraut:**
- `krankenkassen`: **74 gefüllt / 20 NULL / 94 gesamt**.
- Kein gefüllter `ik_number`-Wert ohne passenden `kostentraeger`-Eintrag (`datensatz_status='echt'`) — 0 Treffer.
- Keine der 9 alten Mock-IKs (`108310401`, `107436001`, `101000026`, `107708612`, `101317994`, `107636345`, `109006429`, `101000016`, `107300000`) steht noch in `krankenkassen` — 0 Treffer.
- `BKK Salzgitter`: `ik_number = '101922757'` (Haupt-Kostenträger). Die Ost-IK `101921814` ist unangetastet — 0041 fasst Mehr-IK-Kassen bewusst nicht an; ob dort trotzdem ein Wert gesetzt werden soll, ist offener Produktentscheid, keine Auswirkung dieser Migration.

## Reihenfolge- und Berechtigungs-Hürden (Lernpunkt)

1. **Auto-Mode-Klassifikator blockierte den ersten `apply_migration`-Versuch** mit „Production Deploy" — trotz vorheriger allgemeiner Freigabe im Gespräch. Erst eine **erneute, explizite** Bestätigung („ja, Migration jetzt live anwenden") hat den Call durchgelassen. Eine allgemeine „du darfst Supabase benutzen"-Aussage genügt dem Klassifikator offenbar nicht für jeden einzelnen schreibenden Call — im Zweifel neu bestätigen lassen statt anzunehmen, dass eine frühere Freigabe für den nächsten Call reicht.
2. **`tools/check-onprem.sh` (Migrations-Gate) blockierte den Commit**, weil `db/SCHEMA.sql`/`SCHEMA-RLS.sql` sich änderten, ohne dass in **diesem** Commit eine neue Datei in die ausführbare Kette kam. Tatsächlich lagen `0039`/`0040` schon vorher in der Kette (Commit vom 21.09.2026) — dieser Commit hat sie nur live markiert und den Dump nachgezogen. `SKIP_MIGRATION_GATE=1` ist für genau diesen Fall vorgesehen („reine Döküm-Tazelemesi") und wurde entsprechend benutzt, nicht um eine echte neue, undokumentierte Schemaänderung zu umgehen.
3. **Mehrere Sitzungen arbeiten parallel am selben Repo** (vom Nutzer bestätigt). `0041` war bereits von einer anderen Sitzung angewendet UND in `CLAUDE.md` (lokal, uncommitted) sowie größtenteils in `db/REGISTER.md` dokumentiert, bevor ich das erste Mal draufgeschaut habe. Statt die Notiz für bare Münze zu nehmen, wurde live gegengemessen (Zahlen oben) — sie stimmten exakt. Eine Stelle in `db/REGISTER.md` (Zeile 693, Box-Seed-Absatz) war trotzdem noch nicht nachgezogen worden — auch bei „scheint schon erledigt" lohnt der volle Grep über alle Erwähnungen, nicht nur die offensichtliche Status-Zeile.

## Committet

| Commit | Inhalt |
|---|---|
| `fc89d5b` | `0039`/`0040` als live markiert (Migrationsdateien), `db/SCHEMA.sql` + `SCHEMA-RLS.sql` (View-Definition + Rechte-Block ergänzt, Kopf-Notizen korrigiert), `db/REGISTER.md` (`kostentraeger_auswahl`-Status, `heilmittel_katalog`-Komplex-Anker-Vermerk), `wissensbank/REGISTER.md` (Kette Z-13: „SaaS'a HENÜZ UYGULANMADI" → „✅ uygulandı") |
| `377b3a5` | `db/REGISTER.md` Zeile 693 nachgezogen (letzte verbliebene „⏳ vorbereitet"-Stelle zu `0041`) |

Beide gepusht (`origin/main`). **Bewusst nicht committet:** die OFFEN-Sektion in `CLAUDE.md` — sie sagt selbst, dass sie
(Personal-Merkzettel, Repo public) nicht mitcommittet werden soll; lokal aktualisiert, bleibt aber uncommitted liegen.

## Offen

- **#303** (Board-Pflege, kein Code) — laut `fortschritte/2026-09-21.md` bereits erledigt, in dieser Sitzung nicht selbst nachgeprüft.
- 👤 Kemal Bescheid geben (Migrationsnummern 0039–0041, seine `0038` bleibt eigenständig).
- 👤 Git-Notiz an `fa86f5b` ist nur lokal, bei Bedarf `git push origin refs/notes/commits`.
- Mehr-IK-Frage BKK Salzgitter (Ost-IK `101921814`) — Produktentscheid, nicht Teil dieser Sitzung.
