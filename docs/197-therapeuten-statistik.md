# #197 — Therapeuten-Statistik

Phase 1. Keine SQL-Datei und keine Migration erforderlich; kein Datenbankzugriff.

## Ursache (zwei Sätze)

Die alte Abfrage verwendet `bookings.employee_id` und `profiles.first_name/last_name`, obwohl das versionierte Schema `bookings.user_id` und `profiles.owner_first_name/owner_last_name` führt (`db/SCHEMA.sql:452`, `db/SCHEMA.sql:1805`); auch der eingebettete Join über `employee_id` ist damit ungültig (Ausgangsstand `624e61b`, `api-backend/billing/api/statistik.routes.js:147`). Der dadurch entstehende Abfragefehler wurde als leere Liste behandelt (Ausgangsstand `624e61b`, `api-backend/billing/api/statistik.routes.js:331`), sodass im Frontend „Keine Daten“ erscheint (`dashboard.js:20413`).

Das ist am Repository belegt, nicht an der laufenden Datenbank geprüft. Der frühere Datumsfehler ist im Ausgangsstand bereits korrigiert: `start_time` wird dort schon verwendet (`624e61b:api-backend/billing/api/statistik.routes.js:149`).

## Endpoint und Abfragen

`GET /api/billing/statistik?monate=6`: Router-Mount in `api-backend/server.js:384`, Aufruf des neuen Helfers in `api-backend/billing/api/statistik.routes.js:144`.

Die Terminabfrage in `api-backend/billing/statistik/therapeuten.js:7` lautet:

```js
supabase.from('bookings')
  .select('id, user_id, services(is_internal)')
  .eq('owner_id', tenantId)
  .gte('start_time', cutoffIso)
  .neq('status', 'cancelled')
  .order('id')
  .range(offset, offset + pageSize - 1)
```

Gezählt wird je `user_id`, über Seiten von 500 Zeilen; anschließend werden die fünf höchsten Werte ausgewählt (`api-backend/billing/statistik/therapeuten.js:5`, `:21`, `:26`). Die Namensabfrage in derselben Datei ab Zeile 29 lautet:

```js
supabase.from('profiles')
  .select('id, owner_first_name, owner_last_name, business_name')
  .in('id', top.map(([id]) => id))
  .or(`id.eq.${tenantId},owner_id.eq.${tenantId}`)
```

Es wird kein neuer Profil-Fremdschlüssel vorausgesetzt: der ursprüngliche `bookings.user_id`-Fremdschlüssel zeigt auf `auth.users` (`archive/kod/database_setup.sql:65`, `onprem/schema/live_schema_2026-07-06.sql:5553`). Die separate Namensabfrage begrenzt Profile auf Inhaber und dessen Mitarbeiter (`api-backend/billing/statistik/therapeuten.js:33`). Der Endpoint verwendet bereits den Service-Role-Client (`api-backend/billing/api/statistik.routes.js:11`); keine RLS-Änderung vorgenommen.

Die Services-Verknüpfung bleibt ein Left Join, damit Termine ohne Leistung nicht verschwinden: `service_id` ist nullable (`db/SCHEMA.sql:453`). Die Join-Semantik ist in der [Supabase-Dokumentation](https://supabase.com/docs/guides/database/joins-and-nesting#join-types-and-join-modifiers) beschrieben.

## Blocker

Blocker sind normale `bookings` mit einer internen Leistung. Die Codes heißen `BLOCK_PAUSE`, `BLOCK_PRIV`, `BLOCK_FORTB` (`module/kalender-blocker.js:44`); beim Anlegen der Leistung wird `is_internal: true` gesetzt (`module/kalender-blocker.js:104`). Der Kalender leert außerdem den Patientenbezug (`dashboard.js:5933`). Ein fehlender Patient allein wird nicht als Ausschlusskriterium verwendet.

Die ausschließende Zeile ist `api-backend/billing/statistik/therapeuten.js:20`:

```js
if (booking.services?.is_internal === true) continue;
```

Auch andere interne Leistungen werden damit nicht als Patiententermine gezählt. `null`-Flags und fehlende Services bleiben erhalten. Fehler beider Abfragen werden weitergereicht (`api-backend/billing/statistik/therapeuten.js:15`, `:34`) und vom Endpoint als HTTP 500 beantwortet (`api-backend/billing/api/statistik.routes.js:430`).

## Andere Fundstellen — unverändert

- In der untersuchten Backend-/Frontend-Logik keine weitere aktive Kopie des ungültigen `bookings.employee_id`-Joins gefunden. Die Terminanfragen verwenden bereits `user_id` (`api-backend/booking/from-request.js:59`); der frühere gleichartige Fehler ist dort dokumentiert (`api-backend/booking/from-request.js:5`).
- Die Kalender-Monatsübersicht zählt ebenfalls Buchungen ohne interne Leistungen zu unterscheiden (`dashboard.js:14668`, `dashboard.js:14689`). Nur benannt; nicht mitgeändert. Ob Kalenderbelegung hier Blocker bewusst mitzählen soll, ist getrennt zu entscheiden.
- Der alte Warnkommentar in `module/kalender-blocker.js:28` beschreibt weiterhin den Zustand vor diesem Fix; die Datei wurde nicht mitgeändert.

## Manuell prüfen

Voraussetzung: Backend mit diesem Commit lokal oder in einer vom Nutzer bereitgestellten Testumgebung starten. Kein Deploy durch Codex. Künstliche Termine nur in einer Testpraxis anlegen.

1. „Statistik & Auswertung“ öffnen, „Letzte 6 Monate“ wählen (`dashboard.html:1769`). Unter „Therapeuten-Auslastung“ den Ausgangswert N eines der angezeigten Therapeuten notieren (`dashboard.html:1827`). Einmal neu laden, um alte Anzeigen auszuschließen.
2. Im Kalender für denselben Therapeuten zwei normale Patiententermine innerhalb des Zeitraums anlegen, dazu je einen Blocker „Pause“, „Privat“ und „Fortbildung“, ohne zeitliche Überschneidung.
3. Statistik neu laden. Erwartet: **N + 2 Termine**, nicht N + 5. In einer leeren Testpraxis mit nur diesen Einträgen: **2 Termine**. Die Anzeige heißt „Termine“ (`dashboard.js:20409`), nicht „abgeschlossene Sitzungen“.
4. Einen weiteren Blocker ergänzen und erneut laden: weiterhin **N + 2**. Bei ausschließlich Blockern und sonst keinen Terminen: „Keine Daten“.
5. Im Browser-Netzwerk den GET-Request `/api/billing/statistik?monate=6` prüfen: HTTP 200 und in `therapeuten` der erwartete Name mit `count: 2` (leere Testpraxis). Ein Live-Ergebnis wurde von Codex nicht geprüft.

## Lokale Verifikation und Grenzen

```sh
rtk proxy node --test api-backend/billing/statistik/therapeuten.test.js module/kalender-blocker.test.js api-backend/booking/from-request.test.js
rtk proxy node --check api-backend/billing/api/statistik.routes.js
rtk git diff --check
```

Die Regressionstests nutzen den echten Supabase-Querybuilder mit lokal ersetztem HTTP-Transport, keine Datenbank. Geprüft werden u. a. Blocker, Storno, Zeitraum, Mandantengrenzen, Namen, mehr als 1.000 Termine, Top 5 und Fehlerweitergabe; der Endpoint wird ebenfalls mit lokalem HTTP-Ersatz auf Erfolg und HTTP 500 geprüft (`api-backend/billing/statistik/therapeuten.test.js:18`, `:132`).

`cancelled` bleibt ausgeschlossen (`api-backend/billing/statistik/therapeuten.js:12`). Kein neues Verhalten für „nicht erschienen“, zukünftige Termine oder Gruppen eingeführt; der bestehende Zeitraum hat weiterhin nur eine Untergrenze (`api-backend/billing/statistik/therapeuten.js:11`). Phase 2 (#192) bleibt bis zum ausdrücklichen „weiter“ offen.
