# Tabellen-Register — warum es diese Tabelle gibt

> **Diese Datei beantwortet eine einzige Frage: WARUM.**
> Was eine Tabelle enthält → `db/SCHEMA.sql`.
> Wer sie liest und schreibt → `db/NUTZUNG.md` (erzeugt, nicht von Hand).
> Warum sie überhaupt existiert und ob sie noch gebraucht wird → **hier**.

Gepflegt vom Agenten `db-ustasi`. **Von Hand geschrieben, absichtlich** — das „Warum"
steht in keinem Schema und lässt sich aus keinem Code herauslesen. Wenn es nicht
aufgeschrieben wird, ist es in sechs Monaten weg, und dann steht jemand vor einer
Tabelle und fragt „brauchen wir die noch?" — ohne Antwort.

**Stand:** 2026-09-03 · 82/82 Tabellen erfasst · Projekt `njvuclullotbksskpwgk`
(das Ops-Dashboard liegt in einem **anderen** Projekt, `farkaejociddtgqkusvm`, und ist
hier **nicht** erfasst).

---

## Wie dieses Register gelesen wird

Jeder Eintrag hat vier Pflichtfelder. Der Generator (`tools/tabellenkarte.mjs`) liest
sie mit, deshalb bleibt das Format streng:

| Feld | Bedeutung |
|---|---|
| **Warum** | Welches Problem wurde damit gelöst. Kein Spaltenreferat. |
| **Seit** | Datum + Migration. `spätestens` heißt: das `CREATE TABLE` steht in keiner Migration, das Datum ist die erste Erwähnung — also eine **Obergrenze**, kein Geburtsdatum. |
| **Status** | `aktiv` · `Referenz` (Stammdaten, wird gelesen nicht gepflegt) · `System` · `veraltet` (abgelöst, liegt noch da) · `verdächtig` (Löschkandidat, Entscheidung offen) · `fremd` (gehört nicht zu Praxura) |
| **Wer** | Der Einstiegspunkt in Worten. Die vollständige Liste steht in `db/NUTZUNG.md`. |

Zusätzlich, wo es zählt: **Achtung** (Falle) und **Quelle** (Beschluss, Rechtsgrundlage).

**Regel:** Neue Tabelle → Eintrag im selben Commit. `node tools/tabellenkarte.mjs --check`
bricht ab, solange ein Eintrag fehlt.

### Warnung zu „Status: verdächtig"

`verdächtig` ist **keine** Löschfreigabe. Es heißt: im Code ruft sie niemand mehr auf,
und niemand konnte sagen, wofür sie noch da ist. Vor dem Löschen gilt jedes Mal:
Trigger, RPC, View und Backend-Roh-SQL prüfen, dann den Nutzer fragen. Eine Tabelle
löschen kostet fünf Sekunden; die Daten darin sind weg.

Und ein Punkt, der leicht übersehen wird: `db/SCHEMA-RLS.sql` enthält **kein einziges
`CREATE TRIGGER`** und nur 5 von 43 Funktionskörpern. Eine Tabelle, die per Trigger
gefüllt wird, hinterlässt dort also **keine Spur** — `nummernkreise` ist der Beweis.
Das „Warum" in diesem Register ist an dieser Stelle die einzige Quelle, die es gibt.

---

## 1. Kern: Mandanten, Rollen, Zugang

### `profiles`
- **Warum:** Der Dreh- und Angelpunkt der Mandantentrennung. Jeder Account — Inhaber wie Angestellter — hat genau eine Zeile; `role` und `owner_id` entscheiden, wer wessen Daten sieht. Weil Einzelstandort-Inhaber gar keinen `businesses`-Datensatz haben, liegen **Inhaber-Einstellungen hier**, nicht in `businesses`.
- **Seit:** spätestens 06.05.2026 · `extend_profiles_for_multi_tenant` (die Tabelle ist älter als die Migrationshistorie; `create_core_tables_safe` vom 18.06. ist nur ein `IF NOT EXISTS`-Netz)
- **Status:** aktiv
- **Wer:** praktisch alles. 33 Fremdschlüssel zeigen hierher; 17 Dateien greifen zu — Onboarding, Stripe-Webhook, Backend-Auth, Dashboard-Einstellungen.
- **Achtung:** Tote Spalten aus abgeschalteten Strängen liegen noch drin (`whatsapp_*`, `system_prompt`, `faq`, `message_templates`, `has_dta_pro`, `dta_pro_subscription_item_id`) — nicht als Vorlage nehmen. `sector` erlaubt noch `barber`/`beauty`/… aus der KMU-Zeit.

### `businesses`
- **Warum:** Zweiter Standort und aufwärts. Ohne Standortbegriff ließen sich Öffnungszeiten, Team und Leistungen nicht trennen, sobald eine Praxis mehr als eine Adresse hat.
- **Seit:** 22.05.2026 · `v24_multi_business_foundation`
- **Status:** aktiv
- **Wer:** Standort-Verwaltung im Dashboard, Buchungsseite, Attendance, Stripe-Webhook.
- **Achtung:** Einzelstandort-Inhaber haben hier **keine Zeile**. Eine Einstellung, die nur hier landet, ist für sie unsichtbar — siehe `profiles`.

### `employee_business_assignments`
- **Warum:** Ein Angestellter kann an mehreren Standorten arbeiten. Die Zuordnung passt weder in `profiles` (1:n) noch in `businesses`.
- **Seit:** spätestens 22.05.2026 · `v25_rbac_employee_groups`
- **Status:** aktiv
- **Wer:** Team-Verwaltung (`renderEmpStandortList`, `saveEmpPermissions`), Buchungsseite, `confirm.html`.

### `employee_groups`
- **Warum:** Rollen oberhalb von „Inhaber/Angestellter" — Rezeption, Therapeut, Leitung. Wird beim Anlegen eines Standorts automatisch vorbefüllt.
- **Seit:** 22.05.2026 · `v25_rbac_employee_groups`
- **Status:** aktiv
- **Wer:** Team-Verwaltung; gelesen, aus dem Frontend nicht geschrieben (Seed per Trigger `v25c_auto_seed_groups_on_business_insert`).

### `group_scopes`
- **Warum:** Was eine Gruppe darf. Trennt die Rechtematrix von der Gruppendefinition, damit Rechte änderbar sind ohne Gruppen anzufassen.
- **Seit:** spätestens 22.05.2026 · `v25_rbac_employee_groups`
- **Status:** aktiv
- **Wer:** Dashboard liest beim Laden der Berechtigungen.

### `employee_scope_overrides`
- **Warum:** Ausnahme für eine einzelne Person, ohne dafür eine neue Gruppe zu erfinden („die eine Rezeptionskraft darf zusätzlich Rechnungen sehen").
- **Seit:** spätestens 22.05.2026 · `v25_rbac_employee_groups`
- **Status:** aktiv
- **Wer:** `saveEmpPermissions()` in `dashboard.js`.

### `admin_users`
- **Warum:** Trennt das interne Admin-Panel (`admin.praxura.de`) von den Kundenrollen. Ein Kunde soll nie durch Setzen eines Feldes in `profiles` Admin werden können.
- **Seit:** 17.05.2026 · `create_admin_users_table`
- **Status:** aktiv
- **Wer:** `admin-login.js`, `admin.js`, `api/_lib/auth.js` — und `login.js`/`dashboard.js` prüfen dagegen.

### `pending_signups`
- **Warum:** Zwischen „Formular ausgefüllt" und „bezahlt" existiert der Account noch nicht. Die Anmeldedaten müssen solange irgendwo liegen — inklusive Passwort, und das darf nicht im Klartext stehen.
- **Seit:** 12.05.2026 · `create_pending_signups`
- **Status:** aktiv
- **Wer:** `api/onboarding/pending.js`, Stripe-Checkout und -Webhook.
- **Achtung:** `password_secret_id` zeigt in den Supabase **Vault**. Das ist heute die **einzige** Vault-Nutzung im Projekt; Zugriff ausschließlich über `pending_signup_store/consume/delete`.

### `pending_employee_registrations`
- **Warum:** Dasselbe für Angestellte: der Inhaber gibt einen 6-stelligen `company_code` heraus, der Angestellte registriert sich, der Inhaber bestätigt. Zwischen Registrierung und Bestätigung liegt der Datensatz hier.
- **Seit:** 08.06.2026 · `create_pending_employee_registrations`
- **Status:** aktiv
- **Wer:** `employee-signup.js`, `confirm.html`.

### `user_preferences`
- **Warum:** Pro Nutzer merkbare Oberflächen-Zustände (gewählter Standort, Kalenderansicht, Mitarbeiterfilter) gehören nicht in `profiles` — das ist die fachliche Stammdatentabelle.
- **Seit:** spätestens 22.05.2026 · `v24_multi_business_foundation`
- **Status:** aktiv
- **Wer:** `saveUserPref()`, `switchBusiness()`; Backend liest den Standort mit.

### `module_visibility`
- **Warum:** Nicht jede Praxis braucht jedes Sidebar-Modul. Der Schalter je Inhaber und Modul liegt hier; die Modulliste selbst steht im Code (`nav-registry.js`).
- **Seit:** 14.07.2026 · `module_visibility_matrix`
- **Status:** aktiv
- **Wer:** `loadVisibility()`, `saveVisToggle()`; das Admin-Panel schaltet zentral.

### `visibility_reports`
- **Warum:** Telemetrie zur Modulmatrix: welcher Kunde sieht tatsächlich welche Module. Ohne diese Rückmeldung wäre die Matrix eine Behauptung.
- **Seit:** 14.07.2026 · `module_visibility_matrix`
- **Status:** aktiv
- **Wer:** `reportSidebarVisibility()` schreibt beim Laden des Dashboards, `admin.js` liest.

### `data_sharing_settings`
- **Warum:** Ein Inhaber mit mehreren Standorten muss je Datenkategorie entscheiden: gemeinsam oder getrennt. Fehlende Zeile = alles getrennt (bewusst als sichere Vorgabe).
- **Seit:** 01.06.2026 · `data_sharing_settings`
- **Status:** aktiv
- **Wer:** `saveDataSharing()`; ausgewertet über den `bizScope`-Helfer.
- **Achtung:** Termine sind bewusst **nicht** teilbar.

### `kiosk_pins`
- **Warum:** Der Kiosk-Modus (Tablet im Wartezimmer) braucht eine Anmeldung, die kein Passwort ist. Die PIN liegt als scrypt-Hash, geprüft wird ausschließlich im Backend.
- **Seit:** 14.08.2026 · `kiosk_pin_hardening`
- **Status:** aktiv
- **Wer:** nur `api-backend/server.js` → `POST /api/kiosk/pin/verify`.
- **Achtung:** **Keine RLS-Policy — mit Absicht.** Kein Zugriff für `anon`/`authenticated`. Wer hier eine Policy „nachträgt", öffnet die PIN-Tabelle.

---

## 2. Termin, Kalender, Buchung

### `booking_leistungen`
- **Warum:** Ein Termin trägt in der Podologie fast immer mehr als eine Leistung — „Podologische Behandlung + Eingangsbefundung" ist der Normalfall, nicht die Ausnahme (Beta-1, 31.08.2026: „wenn man es nicht vollstopfen will, kann man auch einfach nur [ein] Pluszeichen drücken … und die Anzahl"). `bookings.service_id` konnte genau eine halten; der Kalenderblock war deshalb systematisch zu kurz und die zweite Leistung fiel aus der Abrechnung.
- **Seit:** 03.09.2026 · `20260903170448_booking_leistungen` · Ops-Karte 235
- **Status:** aktiv
- **Wer:** Termin-Fenster (die „+"-Zeilen, `module/termin-leistungen.js`) schreibt; die Abrechnungsmaske liest, um die HPNR-Kästchen vorzubelegen.
- **Warum kein JSONB auf `bookings`:** drei Gründe, alle geprüft. `bookings` liegt in der Realtime-Publication — jede Schreibung ginge als volle Zeile an jeden offenen Kalender. Ein JSON-Feld trägt keinen Fremdschlüssel, eine gelöschte Leistung ließe eine tote uuid zurück. Und es wäre die **vierte** Darstellung desselben Gedankens neben `hpnr_codes`, `heilmittel_items` und `prescription_sessions` — dieselbe Falle wie `heilmittel_catalog` ↔ `heilmittel_katalog`.
- **Achtung — `bookings.service_id` ist ab jetzt ABGELEITET:** `trg_booking_hauptleistung` setzt sie auf die Zeile mit `sort_order = 0`. **Nicht von Hand schreiben**, sonst gibt es zwei Wahrheiten. Sie bleibt, weil sieben Leser daran hängen: Kalenderfarbe (`module/kalender-farben.js`), `ausfallSuggestedAmount()` — fällt ohne sie **still** auf den Pauschalbetrag zurück (`module/termin-laden.js`) —, `warteliste.routes.js`, `booking/from-request.js`, `rechnung-editor.js`, `abrechnung.routes.js`, `idx_bookings_service`. Backfill am 03.09.2026: 287 Termine, eine Zeile je Termin, keine Abweichung.
- **Achtung — kein zweiter Schreibweg in die Abrechnung.** Die Leistungen werden über `services.gkv_position_nr` (= HPNR, deckungsgleich mit den Kästchen in `module/podologie-abrechnung.js`) nur **vorangekreuzt**. Der einzige INSERT in `podologie_behandlungen` bleibt der dortige — nur so laufen alle Sperren mit: 78040+78030 am selben Tag, 78100 je Kalenderjahr, UI1/UI2→L60.0, 78020-Komplexbehandlung, 78610/78620 nur UI2. Der Podologe darf das Kästchen außerdem ändern: geplante und tatsächlich erbrachte Leistung sind nicht dasselbe.
- **Achtung — Gruppentermine:** die Kind-Synchronisierung in `dashboard.js` läuft über `.eq('group_parent_id', id)` und kopiert diese Zeilen **nicht** mit. Wer hier schreibt, muss die Kinder mitnehmen, sonst trägt der Elterntermin „78010+78030" und die Kinder nur „78010". Kinder sind zudem vom `no_overlapping_bookings`-EXCLUDE ausgenommen — längere Blöcke kollidieren dort ungebremst.
- **DSGVO:** in `USER_TABLES` mit `filter: 'owner_id'`; in `DELETE_TABLES` **vor** `bookings` und vor `services`. Für sich genommen stehen dort nur Fremdschlüssel und eine Menge — über die Verknüpfung aber „dieser Patient bekam an diesem Tag diese Behandlung", also Gesundheitsdatum. CASCADE räumt ohnehin ab; der Eintrag steht, damit die Auskunft nach Art. 15 vollständig ist.

### `bookings`
- **Warum:** Der Termin selbst. Alles andere im Kalender hängt daran.
- **Seit:** spätestens 10.05.2026 · `phone_normalization_and_merge`
- **Status:** aktiv
- **Wer:** 15 Dateien, 9 schreibende Funktionen — Dashboard-Kalender, öffentliche Buchungsseite, Backend-Booking-Routen, Fußbefund, Rechnungsmodule.
- **Achtung:** Doppelbuchung verhindert die **Datenbank**, nicht der Code: `EXCLUDE USING gist` auf `(user_id, tstzrange(start_time, end_time))` bei `status='confirmed' AND group_parent_id IS NULL`. Den Constraint-Fehler abfangen und übersetzen — nicht in der Anwendung nachbauen. `bookings` ist außerdem in der Realtime-Publication (seit `enable_realtime_bookings`).
- **Achtung — `verordnung_id` (seit 03.09.2026):** die Spalte bindet einen Termin an eine **podologische** Verordnung. Zeigt seit 04.09.2026 auf `prescriptions` (`therapie_bereich='podo'`) — vorher eine eigene Tabelle `verordnungen`, am selben Tag gedroppt, ids der migrierten Zeilen unverändert. Sie ist der Podologie-Ersatz für etwas, das es dort nicht gibt: ein Einheiten-Hauptbuch.
  - ⚠️ **Hier gehört NIE eine `prescriptions.id` hinein.** Der Physio/Ergo/Logo-Topf verknüpft über `prescription_sessions.booking_id`, und das ist kein Umweg, sondern die einzige Stelle, an der die Information hinpasst: `prescription_sessions` hält je verordneter Einheit eine Zeile (auch ohne Termin, siehe `module/sitzung-abgleich.js`). Die Frage lautet dort „welche der 18 Einheiten hat dieser Termin erfüllt?" — das lässt sich an `bookings` gar nicht ausdrücken. In der Podologie lautet die Frage „zu welcher Verordnung gehört dieser Termin?", und die gehört an den Termin. Wer hier eine zweite Spalte `prescription_id` danebenhängt, erzeugt einen zweiten Weg für den Physio-Topf — genau die Sorte Parallelwahrheit, die uns `heilmittel_catalog` ↔ `heilmittel_katalog` gekostet hat.
  - Warum die Spalte **nicht** `podologie_behandlungen.booking_id` + Platzhalterzeilen geworden ist (Variante B der Vorlage vom 03.09.): `podologie_behandlungen` ist ein **Leistungsnachweis**, die Zeile *ist* die erbrachte Behandlung. Vorab angelegte Zeilen hätten vier laufende Regeln gebrochen — den Einheiten-Zähler nach `abrechenbar` (`module/podologie-abrechnung.js:1343-1349`), die §302-Sperre „noch keine Behandlung dokumentiert" (`api-backend/billing/api/verordnung-status.routes.js:126-136`), die 78040-Eingangsbefundungsregel (`module/eingangsbefundung-regel.js`, jede Zeile mit `behandlungsdatum` gilt als erbracht) und den offenen Rechnungsentwurf (`module/rechnung-bruecke.js:63-75`). Kein Abrechnungs-, Belegliste- oder GoBD-Pfad liest dagegen `bookings` — deshalb ist diese Spalte an der Geldseite risikofrei.
  - **`ON DELETE SET NULL` ist Pflicht, nicht Geschmack:** `api/dsgvo.js` löscht `prescriptions` **vor** `bookings`. Mit RESTRICT/NO ACTION bräche die DSGVO-Löschkette an dieser Stelle. In `USER_TABLES`/`DELETE_TABLES` war keine Ergänzung nötig — `bookings` steht dort längst. (Bis 04.09.2026 war es `verordnungen` statt `prescriptions`, gleiches Prinzip.)
  - **Owner-Riegel:** `trg_booking_verordnung_owner` (BEFORE INSERT/UPDATE OF `verordnung_id`, `owner_id`) prüft seit 04.09.2026 `prescriptions.owner_id = bookings.owner_id` (vorher `verordnungen.owner_id`). Ein Fremdschlüssel prüft **keine RLS** — ohne den Riegel könnte ein Mitarbeiter die Id einer fremden Verordnung in einen eigenen Termin schreiben. Die Triggerfunktion ist `SECURITY DEFINER`, und das ist der Punkt: ein SELECT im Rumpf unterläge sonst der RLS des Aufrufers, die fremde Zeile wäre unsichtbar, `NOT FOUND` griffe — der Riegel fiele genau im Angriffsfall offen auf.
  - ⚠️ **Sichtbarkeits-Asymmetrie AUFGELÖST (04.09.2026, Nutzerentscheidung):** bis dahin hatte `bookings` Team-Zugriff, `verordnungen` und `podologie_behandlungen` nicht (`owner_id = auth.uid()`) — ein angestellter Therapeut sah den Termin samt `verordnung_id`, konnte die Verordnung aber nicht lesen. Seit der Zusammenlegung gilt für podologische Zeilen dieselbe Policy wie für Physio/Ergo/Logo (`prescriptions_owner_all`) — Team darf jetzt lesen UND schreiben. `podologie_behandlungen` bleibt bei Team-SELECT-only (eigene Tabelle, unverändert).
  - **Wer schreibt:** die Seite „Verordnungen" (`module/verordnung-detail.js`, untere Hälfte, rechte Spalte) beim gezielten Vergeben eines einzelnen Termins. „Unvergeben" ist dort **keine Zeile**, sondern gerechnet: `prescriptions.anzahl_einheiten` (vorher `verordnungen.behandlungseinheiten`) minus Zahl der Termine mit dieser `verordnung_id`. Anlass: Beta-1, 31.08.2026.
- **Achtung — `dauer_quelle` (seit 03.09.2026):** die Spalte sagt, **woher die Dauer eines Termins stammt**, nicht wie lang er war. Vier Werte: `NULL` = nicht erfasst · `'vorschlag'` = der vorgeschlagene Wert wurde unverändert übernommen · `'manuell'` = jemand hat im Dauer-Feld getippt · `'serie'` = aus einem Batch-Lauf.
  - **Warum sie existieren muss:** `module/termin-dauer.js` (`gelernteDauer()`) soll aus der Historie lernen, wie lange eine Leistung wirklich dauert. Die naheliegende Quelle — `end_time - start_time` — ist dafür **wertlos**: Termine werden in Praxura nie von Hand geschlossen, es gibt kein Check-out. `end_time` ist immer exakt `start_time` + der Wert, der beim Anlegen im Dauer-Feld stand. Der Median dieser Differenz misst also nur, was die Software selbst vorgeschlagen hat. Ein einmal falscher Vorschlag hätte sich über die eigene Historie bestätigt — eine sich selbst erfüllende Voreinstellung. Einwand kam von der Praxisseite, 03.09.2026; er ist richtig und die Spalte ist die Antwort darauf.
  - **Warum `text` + CHECK und nicht `boolean dauer_manuell`:** in `bookings` schreiben **sechs** Wege — Terminmaske (`dashboard.js`), Gruppentermin-Kinder, Serientermine (`/booking/batch-create`), Termin-Anfrage (`api-backend/booking/from-request.js`), Warteliste-Nachrücker (`module/warteliste-nachruecker.js`), öffentliche Buchung. Nur der erste kennt die Spalte. Ein `NOT NULL DEFAULT false` hätte „Vorschlag akzeptiert“ und „dieser Weg erfasst das gar nicht“ in denselben Wert gepresst; in sechs Monaten wäre nicht mehr entscheidbar, was ein `false` bedeutet. `NULL` sagt die Wahrheit. Nebeneffekt, der die Entscheidung trägt: `'vorschlag'` gegen `'manuell'` gezählt ergibt die **Annahmequote des Vorschlags** — die einzige Zahl, an der sich später ablesen lässt, ob die Schätzung taugt. Mit einem Boolean wäre sie nicht messbar.
  - ⚠️ **Kein Backfill.** Von 288 Altterminen weichen nur **11** von der Standarddauer ihrer Leistung ab — zu dünn für einen Median und in der Sache Ausnahmen, keine Regel. Die Lernfunktion beginnt bewusst kalt und fällt bis dahin auf `price_config` / `duration_minutes` zurück.
  - ⚠️ **Auswahlverzerrung, bekannt und in Kauf genommen:** wer nur aus korrigierten Werten lernt, lernt aus **Ausnahmen**. Tippt jemand 45 nur beim komplizierten Patienten, wandert der Vorschlag für alle auf 45. Gegenmittel liegt in der Oberfläche, nicht im Schema: erst ab mehreren übereinstimmenden Handeingaben übernehmen und die Stichprobengröße am Feld anzeigen.
  - **Kombi-Termine** (mehr als eine Zeile in `booking_leistungen`) speisen die Lernfunktion **nicht** — dort ist die Dauer eine Summe und sagt über die einzelne Leistung nichts. Bewusst außerhalb des Umfangs.
  - **RLS/DSGVO:** nichts zu tun. Die Rechte auf `bookings` sind tabellenweit vergeben (keine Spaltenrechte), die acht Policies gelten unverändert; `anon` hat zwar GRANT, aber **keine** passende Policy — von der öffentlichen Buchungsseite lässt sich hier nichts hineinschreiben, der Vergiftungsweg auf die gelernte Voreinstellung ist damit von vornherein zu. `bookings` steht in `api/dsgvo.js` bereits in `USER_TABLES` und `DELETE_TABLES`. **Kein Index** — 289 Zeilen, 408 kB; `idx_bookings_service` reicht. Wieder anschauen, wenn die Tabelle fünfstellig wird.

### `services`
- **Warum:** Was die Praxis anbietet, mit Dauer und Preis. Grundlage für Slot-Berechnung und Abrechnung.
- **Seit:** spätestens 06.05.2026 · `extend_profiles_for_multi_tenant`
- **Status:** aktiv
- **Wer:** Onboarding (`autoSeedGkvServices`), Kalender-Einstellungen, Buchungsseite, Backend.
- **⏳ Ausstehend:** Spalte `kostentraeger_typ text` — Migration `supabase/migrations/20260902090000_services_kostentraeger_typ.sql` liegt fertig, ist am 03.09.2026 **noch nicht gelaufen**. Bis dahin wird die Abrechnungsart implizit aus `gkv_position_nr` hergeleitet, und **Selbstzahler/BG sind gar nicht abbildbar**. Warum `text` + CHECK statt ENUM und warum NULL erlaubt bleibt: im Kopf der Migrationsdatei.
- **Achtung:** Öffentlich lesbar (Buchungsseite). Die frühere Spiegeltabelle `business_services` wurde am 28.08.2026 gedroppt (`20260828202843_business_services_droppen_spiegeltabelle`) — nicht wiederbeleben. Ihr Inhalt liegt vor dem DROP gesichert außerhalb des Repos: `Ops-Drive/infra/db-sicherung/2026-08-28_business_services_vor_drop.json`. Warum sie weg musste: ihre Policies verglichen `auth.uid()` mit `business_id`, in der Spalte stand aber eine `businesses.id` — keine ihrer Zeilen war je für die zugehörige Praxis sichtbar, und `onboarding.js` konnte gar nicht hineinschreiben (Spalte `code` existierte dort nicht, und der FK zeigte auf `businesses`). Beschluss: `konsey/tutanak/2026-08-28-business-services.md`.

### `employee_services`
- **Warum:** Nicht jeder Therapeut macht jede Leistung. Ohne diese Zuordnung bietet die Buchungsseite Termine bei Leuten an, die sie nicht durchführen dürfen.
- **Seit:** spätestens 13.05.2026 · `add_performance_indexes`
- **Status:** aktiv
- **Wer:** Team- und Leistungsverwaltung, Buchungsseite, Slot-Berechnung im Backend.
- **Achtung:** **Bekannte Schwachstelle:** Schreibrecht hängt an `auth.role() = 'authenticated'`, also mandantenübergreifend. Dokumentiert, nicht stillschweigend gepatcht (`db/README.md`).

### `working_hours`
- **Warum:** Regelarbeitszeit je Mitarbeiter und Standort — die Grundlage jeder Slot-Berechnung.
- **Seit:** spätestens 06.05.2026 · `extend_profiles_for_multi_tenant`
- **Status:** aktiv
- **Wer:** 8 Dateien: Onboarding, Kalender-Einstellungen, Buchungsseite, Backend-Slots.
- **Achtung:** Öffentlich lesbar (Buchungsseite braucht es). Der offene Plan „Arbeitszeiten pro Standort" (`ARBEITSZEITEN_PRO_STANDORT.md`) betrifft genau diese Tabelle.

### `breaks`
- **Warum:** Pausen sind keine Arbeitszeit und keine Abwesenheit — sie wiederholen sich täglich und müssen Slots blockieren.
- **Seit:** 12.05.2026 · `add_breaks_table`
- **Status:** aktiv
- **Wer:** Arbeitszeit-Raster im Dashboard, Slot-Berechnung im Backend.

### `custom_days`
- **Warum:** Der Einzelfall, der vom Wochenraster abweicht — verkürzter Freitag, Sondertermin am Samstag.
- **Seit:** 12.05.2026 · `create_custom_days_table`
- **Status:** aktiv
- **Wer:** `saveSpecialDays()`, Buchungsseite, Backend-Slots.

### `time_offs`
- **Warum:** Urlaub, Krankheit, Fortbildung. Anders als `custom_days` personenbezogen und mehrtägig.
- **Seit:** spätestens 13.05.2026 · `add_performance_indexes`
- **Status:** aktiv
- **Wer:** Team-Verwaltung, Kalender, Backend-Slots.
- **Achtung:** Wie `employee_services` — Schreibrecht mandantenübergreifend offen. Bekannt und dokumentiert.

### `calendar_integrations`
- **Warum:** Google-Kalender-Anbindung je Nutzer: Tokens, Kalender-ID, Synchronisationszustand.
- **Seit:** spätestens 22.05.2026 · `v24_multi_business_foundation`
- **Status:** aktiv
- **Wer:** `kalender.js` (Verbinden/Trennen), Backend-OAuth-Callback.
- **Achtung:** Die OAuth-Race ist gelöst (`newOAuthClient()`-Factory) — nicht neu aufmachen.

### `booking_requests`
- **Warum:** Termin-**Anfrage** statt Sofortbuchung: der Patient bittet um einen Termin, der Inhaber bestätigt oder lehnt ab. Ein bestätigter Antrag wird zu einem `bookings`-Eintrag.
- **Seit:** 28.06.2026 · `booking_request_system`
- **Status:** aktiv
- **Wer:** ausschließlich `api-backend/server.js` (`/booking-request/create|approve|decline|cancel|list`) und `booking-request.html`.

### `patients`
- **Warum:** Der Anfragende ist noch kein Patient der Praxis. Er darf nicht in die echte Akte (`leads`) geschrieben werden, bevor jemand die Anfrage angenommen hat.
- **Seit:** 28.06.2026 · `booking_request_system`
- **Status:** aktiv
- **Wer:** nur der Termin-Anfrage-Fluss im Backend.
- **Achtung:** ⚠️ **Der Name lügt.** Die Patiententabelle ist `leads`. `patients` gehört allein diesem Fluss. Beide Töpfe bestehen absichtlich nebeneinander — **nicht zusammenlegen.**

### `warteliste`
- **Warum:** Wenn nichts frei ist, soll der Wunsch nicht verlorengehen. Wird beim Freiwerden eines Slots gegen die Wunschzeiten gematcht.
- **Seit:** spätestens 08.06.2026 · `security_hardening_handles_bookings_search_path`
- **Status:** aktiv
- **Wer:** `initWlModal()` im Dashboard, `api-backend/billing/api/warteliste.routes.js`.
- **Achtung:** Eine von fünf Tabellen **ohne Team-Zugriff** — nur der Inhaber sieht sie. Ob angestellte Therapeuten das sehen sollen, ist eine offene Produktfrage, kein Bug.

### `attendance`
- **Warum:** Kommen/Gehen der Mitarbeiter (Arbeitszeiterfassung), getrennt von der Sollarbeitszeit in `working_hours`.
- **Seit:** 19.06.2026 · `create_attendance_table`
- **Status:** aktiv
- **Wer:** `attendance.js` und die Backend-Routen `/attendance/check-in|check-out|today|report`.

### `demo_bookings`
- **Warum:** Demo-Termine von der Marketing-Seite. Die dürfen die echte Terminverwaltung nicht anfassen.
- **Seit:** 09.06.2026 · `create_demo_bookings_table`
- **Status:** aktiv
- **Wer:** ausschließlich `api/demo-booking.js`.
- **Achtung:** Läuft **nicht** über `supabase.from()`, sondern über direkte PostgREST-Aufrufe (`adminFetch('/demo_bookings?…')`). Wer nur nach `.from('demo_bookings')` sucht, hält die Tabelle für tot.

---

## 3. Patientenakte

### `leads`
- **Warum:** **Das ist die Patientenakte.** Der Name stammt aus der Akquise-Zeit (daher `title`, `google_url`, `reviews_count`) und ist geblieben, weil ein Umbenennen jede Abfrage im Projekt anfasst.
- **Seit:** spätestens 10.05.2026 · `phone_normalization_and_merge`
- **Status:** aktiv
- **Wer:** 10 Dateien, 29 lesende Funktionen — Patientenliste, Schnellerfassung, Rezept, Fußbefund, Rechnung, Einwilligung. 19 Fremdschlüssel zeigen hierher.
- **Achtung:** Erste Falle des Projekts. Wer `patients` sucht, findet die falsche Tabelle. Seit `patient_consents` (14.08.) ist eine Zeile mit unterschriebener Einwilligung **10 Jahre lang nicht löschbar** — DSGVO Art. 17 wird über Anonymisierung erfüllt, nicht über `DELETE`.
- **Quelle:** `db/README.md` Falle 1 und 7

### `anamnese`
- **Warum:** Erstaufnahme und Vorgeschichte. Eigene Tabelle, weil sie versioniert entsteht und nicht bei jedem Termin neu geschrieben wird.
- **Seit:** 13.05.2026 · `create_anamnese_table`
- **Status:** aktiv
- **Wer:** `saveAnamnese()` im Dashboard, Backend liest mit.

### `patient_notes`
- **Warum:** Freitext-Notizen zum Patienten, die weder Anamnese noch Behandlungsdokumentation sind.
- **Seit:** spätestens 13.05.2026 · `add_performance_indexes`
- **Status:** aktiv
- **Wer:** Notizen-Modul im Dashboard.
- **Achtung:** Ohne Team-Zugriff — nur der Inhaber sieht sie (offene Produktfrage, siehe `warteliste`).

### `patient_consents`
- **Warum:** Digitale Einwilligung des Patienten mit einfacher elektronischer Signatur. Vorher gab es dafür nur Papier, und der Nachweis fehlte bei Praxisübergabe.
- **Seit:** 14.08.2026 · `patient_consents`
- **Status:** aktiv
- **Wer:** `module/patienten-einwilligung.js` (`speichereEinwilligung`, `widerrufen`).
- **Achtung:** ⚠️ Diese Tabelle **blockiert Löschungen**. `patient_id → leads` und `owner_id → profiles` sind beide `ON DELETE RESTRICT`, ein Trigger verbietet `DELETE` für 10 Jahre ab `consented_at` und lässt beim `UPDATE` nur `revoked_at`/`revoke_reason` durch. Wer einen Offboarding- oder Testdaten-Aufräumfluss baut, läuft ohne Vorwarnung in einen FK-Fehler. Richtig ist Anonymisieren, nicht das RESTRICT lockern. Bewusst **ohne** `ip_address`. **Nicht** mit `consent_log` verwechseln — das ist die B2B-Seite.
- **Quelle:** `konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md` · `compliance/LEGAL_DECISIONS.md` · § 630f Abs. 3 BGB

### `ueberweisungen`
- **Warum:** Überweisung an einen anderen Behandler, dokumentiert an der Akte.
- **Seit:** 13.05.2026 · `ueberweisungen_table`
- **Status:** aktiv
- **Wer:** Dashboard, lesend; geschrieben wird über das Patientendetail.

### `prescription_documents`
- **Warum:** Nachweise und Anhänge zu einer Verordnung — Befreiungsausweis, LHB-Genehmigung, korrigierte Verordnung, Therapiebericht. Als Spalten in `prescriptions` wären es beliebig viele.
- **Seit:** 25.07.2026 · `create_prescription_documents`
- **Status:** aktiv
- **Wer:** `uploadRxNachweise()` im Dashboard; die Datei selbst liegt im Storage-Bucket.

---

## 4. Verordnung — ALLE Fachbereiche (seit 04.09.2026 EIN Topf)

> Bis 04.09.2026 gab es hier zwei getrennte Töpfe (Physio/Ergo/Logo hier,
> Podologie in Abschnitt 5, eigene Tabelle `verordnungen`). Grund der Trennung
> damals: zwei Formulare, die unabhängig voneinander wuchsen. Grund der
> Zusammenlegung heute (Kemal, 04.09.2026): dieselbe Trennung erzeugte zwei
> §302-Ketten, zwei Statistik-Abfragen, zwei RLS-Modelle — jede Korrektur
> musste zweimal gemacht werden, und die Podologie-Verordnungen aus dem
> Rezept-Scan/Muster-13 (dem hier, `prescriptions`) waren für die podologische
> §302-Kette (die las nur `verordnungen`) unsichtbar: 13 Verordnungen konnten
> nie abgerechnet werden, bevor das auffiel. Details, Gründe für die Richtung
> (statt umgekehrt) und die Spaltenübersetzung: `module/verordnung-topf.js`.
> Migrationen: `verordnungstopf_faz1_prescriptions_spalten` (Spalten),
> `_faz2_vier_zeilen_kopieren` (die 4 Zeilen aus `verordnungen`, ids
> unverändert), `_faz3_fk_auf_prescriptions_umhaengen` (5 Fremdschlüssel),
> `_faz5b_verordnungen_droppen` + `_faz5c_naechste_verordnungsnummer_fix`
> (`verordnungen` gedroppt, auf Nutzerwunsch vorgezogen aus der ursprünglich
> geplanten 90-Tage-Frist — Details im Eintrag `verordnungen` unten).
> **Offener Rest, überlebt Faz 5:** kein GoBD-Festschreibungs-Trigger auf
> `prescriptions` — siehe Warnung in `db/SCHEMA-RLS.sql` bei
> `verordnung_festschreibung()`.

### `prescriptions`
- **Warum:** Die Verordnung (Muster 13) für ALLE vier Fachbereiche — Physio, Ergo, Logopädie UND (seit 04.09.2026) Podologie. `therapie_bereich` unterscheidet; Podologie-Zeilen tragen zusätzlich neun aus `verordnungen` übernommene Spalten (`patient_name`, `wagner_grad`, `versichertennummer`, `behandlungsanlass`, `absetzung_*`, `storno_*`, `rezeptart`).
- **Seit:** 16.05.2026 · `v10_prescriptions` (Podologie-Zusammenlegung: 04.09.2026, siehe Kasten oben)
- **Status:** aktiv
- **Wer:** 15+ Dateien — Rezept-Scan, Verordnungsliste und -detail, Abrechnung, Rechnung, Mahnwesen, Statistik, **plus seit 04.09.2026** `module/podologie-abrechnung.js`, `verordnung-uebersicht.js`, `abrechnungsstatus.js`, `verordnung-status.routes.js`, `/abrechnung/create-podologie` (Podologie-Zweig).
- **Achtung:** Zwei getrennte ICD-Spalten (`icd10`, `icd10_2`) — der frühere Podologie-Topf führte `text[]`. `status` ist die BEARBEITUNGSachse (parsed→confirmed→…), NICHT die Abrechnungsachse — die heisst `abrechnung_status` und ist das Gegenstück zum alten `verordnungen.status` (Wertetabelle in `module/verordnung-topf.js`). `rezeptart` ≠ `rezept_typ` (Zahler- vs. Formachse, bewusst nicht gefaltet).
- **Achtung — `nagel` (seit 04.09.2026, Ops-Aufgabe 245):** der behandelte Zehennagel einer Nagelspangen-Verordnung, zehn Werte per CHECK (`U1 links` … `U5 rechts`). Die Schreibweise ist nicht erfunden, sie steht in § 3b Satz 5 der Änderungsvereinbarung vom 16.06.2025. Warum die Spalte HIER sitzt und nicht an `podologie_behandlungen`: § 3b Satz 3-4 sagt, dass ein Zehennagel ein eigener Verordnungsfall ist und eine Verordnung sich auf **einen** Nagel bezieht — an der Behandlung stünde derselbe Wert auf jeder Zeile und könnte auseinanderlaufen. Gebraucht wird er für die Erstbefundungs-Sperre (78110/78100), die **je Serie und je Nagel über mehrere Verordnungen hinweg** gilt: `module/eingangsbefundung-regel.js` → `darfErstbefundungNagel()`. Ausserhalb UI1/UI2 immer NULL. **Kein NOT NULL und kein bedingter CHECK:** eine Verordnung entsteht zuerst aus dem OCR-Lauf (`/rezept/save`) und wird danach ergänzt — ein harter CHECK würde den Scan-Weg beim INSERT abweisen. Die Pflicht sitzt deshalb im Verordnungsformular (`module/podologie-abrechnung.js`); für OCR-Verordnungen ohne Nagel läuft die Serien-Sperre bewusst ins Leere (`grund: 'nagel_unbekannt'`) statt zu raten. Offen: dieselbe Pflicht bei der Freigabe zur Abrechnung.

### `prescription_sessions`
- **Warum:** Die einzelne Behandlungseinheit auf der Verordnung. Ohne sie ließe sich nicht sagen, wie viele der verordneten Einheiten schon geleistet sind.
- **Seit:** spätestens 16.05.2026 · `v10_prescriptions`
- **Status:** aktiv
- **Wer:** Sitzungsfortschritt, Terminaktionen, Frequenzprüfung, Rechnungseditor, Backend-Statistik.
- **Achtung:** Seit `prescription_sessions_booking_unique` (17.08.2026) darf ein Termin nur noch **einmal** auf eine Sitzung zeigen — der Abgleich `module/sitzung-abgleich.js` hängt daran.

### `prescription_validations`
- **Warum:** Prüfergebnis der Rezeptvalidierung samt Übersteuerung. Getrennt von `prescriptions`, weil es ein Protokoll ist: wer hat wann welche Warnung überstimmt.
- **Seit:** spätestens 16.05.2026 · `v10_prescriptions`, Übersteuerungs-Audit seit 15.06.2026 · `prescription_validations_override_audit`
- **Status:** aktiv
- **Wer:** Backend — `api-backend/server.js` und `billing/api/abrechnung.routes.js`. Aus dem Frontend nicht direkt.

### `messreihen`
- **Warum:** Messwerte im Verlauf (Blankoverordnung: der Therapeut muss den Behandlungserfolg belegen).
- **Seit:** 19.06.2026 · `v31_messreihen_blanko`
- **Status:** aktiv
- **Wer:** `saveMessung()`, `refreshMessreihen()` im Dashboard.

---

## 5. Podologie

### `verordnungen` — ★★★ GEDROPPT 04.09.2026. NICHT WIEDER ANLEGEN. ★★★
- **Warum es sie gab:** Die podologische Verordnung, als eigener Topf getrennt von `prescriptions` — Podologie hatte andere Pflichtfelder (Wagner-Armstrong-Grad, Fußstatus-Bezug) und rechnet über HPNR 78xxx ab.
- **Seit:** 13.06.2026 · `create_verordnungen` (GoBD-Riegel nachgezogen: 03.09.2026 · `verordnungen_gobd_festschreibung`)
- **Warum sie weg ist:** Kemal, 04.09.2026: *"2 tablo olduğu için her tarafta arızalar çıkıyor, biri oraya biri buraya çıkıyor, tek tablo olması şart bu iş için."* Zwei Verordnungstöpfe hiessen zwei Wahrheiten — ein gescanntes podologisches Rezept landete in `prescriptions`, die §302-Kette las aber nur `verordnungen`: live standen 9 Verordnungen im falschen Topf und waren nie abrechenbar. Zusammenlegung in `prescriptions` (Details, Kolonübersetzung, Gerechtfertigung der Zieltabelle: `module/verordnung-topf.js`). Erst 3 Tage lang read-only stillgelegt (ids unverändert übernommen), dann auf ausdrücklichen Nutzerwunsch sofort gedroppt — statt der ursprünglich vorgesehenen 90-Tage-Frist.
- **Die 4 Zeilen:** vollständig und mit unveränderten ids in `prescriptions` erhalten. Keine Datei im Repo enthält sie (DSGVO) — eine lokale Sicherung liegt ausserhalb der DB und ausserhalb des Repos.
- **`api/dsgvo.js`** ist bereinigt: die Tabelle steht in keiner Auskunfts- oder Löschliste mehr.
- **Aufräumarbeiten beim Drop:** `naechste_verordnungsnummer()` zählte per `UNION ALL` über beide Töpfe — musste VOR dem `DROP TABLE` auf ein einzelnes `SELECT` gegen `prescriptions` umgebaut werden, sonst wäre jede neue Verordnungsnummer-Vergabe (jeder `saveRezept()`-Aufruf mit `patient_id`) mit `relation verordnungen does not exist` gescheitert. `vergebe_verordnungsnummer_vo()` ist mit der Tabelle verwaist und separat gedroppt. Trigger (`trg_verordnungen_verordnungsnummer`, `trg_verordnungen_festschreibung`) und RLS-Policies (`owner_verordnungen`, `Employees can view team verordnungen`) sind als Kind-Objekte automatisch mit der Tabelle verschwunden.
- **⚠️ Offene Lücke, überlebt den Drop:** `prescriptions` hat weiterhin KEINEN GoBD-Festschreibungs-Trigger — weder für Physio/Ergo/Logo (hatte nie einen) noch für die drei Tage lang geschützten Podologie-Zeilen. Die Spaltenliste, die `trg_verordnungen_festschreibung` sperrte, bevor er verschwand (für den Wiederaufbau als Vorlage): `ausstellungsdatum, diagnosegruppe, icd10, leitsymptomatik, pat_leitsymptomatik, dringend, hausbesuch, therapiefrequenz, rezeptart, zuzahlung_befreit, kostentraeger_ik, versichertennummer, lead_id, arzt_id, belegnummer`. Bewusst NICHT gesperrt: `status, absetzung_*, storno_*, abrechnung_id` (Korrekturweg selbst), `patient_name`, `behandlungseinheiten`, `heilmittel_items`, `wagner_grad, behandlungsanlass, notizen, behandlungsstart, beginn_spaetestens, therapiebericht`. Nachbau auf `prescriptions` (Spaltenliste um physiospezifische Felder erweitert) ist bewusst NICHT Teil dieser Migration — braucht `gkv-302` UND `legal-de` vorher, echtes Geld/GoBD-Pflicht.
- **★ FÜR DIE ZUKUNFT — an db-ustasi und jede künftige Sitzung:** Für Podologie, Verordnungen, Muster 13, Rezepte gibt es genau EINE Tabelle: `prescriptions` (`therapie_bereich` unterscheidet die Fachbereiche). Vor jeder neuen Tabelle mit "Verordnung"/"Rezept" im Namen — für Podologie oder sonst einen Fachbereich — erst diesen Eintrag lesen und die Frage stellen, ob eine neue Spalte auf `prescriptions` nicht reicht. Die Kosten eines zweiten Topfes sind hier oben dokumentiert: neun Monate lang unbemerkt unbezahlbare Verordnungen.

### `podologie_behandlungen`
- **Warum:** Die Behandlung zur podologischen Verordnung — das Gegenstück zu `prescription_sessions`. `verordnung_id` zeigt seit 04.09.2026 auf `prescriptions` (Zusammenlegung der Verordnungstöpfe, ids unverändert) — vorher auf die eigene Tabelle `verordnungen`.
- **Seit:** 13.06.2026 · `create_podologie_behandlungen` (Team-SELECT nachgezogen: 03.09.2026 · `verordnungen_podologie_behandlungen_team_select`)
- **Status:** aktiv
- **Wer:** `loadPodologieBilling()`, Patientenkarte, Rechnungsbrücke, Backend-Abrechnung.
- **Achtung — `lokalisation` ist seit 04.09.2026 nicht mehr die Quelle:** der behandelte Nagel steht jetzt an der Verordnung (`prescriptions.nagel`, siehe dort). Die Spalte wird weiter mitgeschrieben, weil `module/verordnung-detail.js` und `module/rechnung-bruecke.js` sie anzeigen — sie bekommt den Wert der Verordnung. Das Freitextfeld im Formular existiert nur noch für Verordnungen von vor diesem Datum, die keinen Nagel tragen. Ein DROP ist erst nach Umstellung dieser beiden Anzeigen sinnvoll und ist eine eigene Entscheidung.
- **Achtung:** Team darf seit 03.09.2026 LESEN (Policy `Employees can view team podologie_behandlungen`), Schreiben bleibt beim Inhaber — die Tabelle hat keine Spalte fuer den behandelnden Mitarbeiter, teamweites Schreiben waere die falsche Granularitaet fuer eine Dokumentation nach § 630f BGB. Kein UI dafuer: `podologie-billing` ist in `nav-registry.js` `roles: ['owner']`.

### `pat_fussbefund`
- **Warum:** Der podologische Fußbefund samt Fußkarte. Ersetzt fachlich `fußstatus`. Seit 30.08.2026 hält die Tabelle nicht mehr nur den *aktuellen* Befund, sondern seinen **Verlauf**.
- **Seit:** 22.07.2026 · `pat_fussbefund` (Patientenbezug nachgezogen: `pat_fussbefund_lead_fk`, 24.07.) · Versionierung + Serienfarbe: 30.08.2026 · `pat_fussbefund_versionierung_und_serie`
- **Status:** aktiv
- **Wer:** `module/fussbefund.js` (einziger Schreibweg), `fussbefund-archiv.js` (nur lesen), `patientenkarte.js` (nur lesen), `api/dsgvo.js`.
- **Achtung — zwei Achsen, die nie zusammenfallen dürfen:**
  - `eintrag_id` = **Korrektur**. Derselbe Befund wurde nochmal gespeichert: neue Zeile, `version` + 1, alte Zeile `ist_aktuell = false`. Vorher lief hier ein UPDATE und der Stand von letzter Woche war weg — § 630f BGB verlangt, dass der ursprüngliche Inhalt erkennbar bleibt.
  - `serie_id` = **Farbgruppe** über Termine hinweg, das was der Podologe als „ein Fußbefund und seine Fortschreibungen" sieht. Wird bei der Übernahme geerbt; ohne Übernahme beginnt eine neue Serie. `serie_farbe` liegt als **Kopie** in der Zeile.
  - Ein Schlüssel für beides ginge nicht: eine spätere Sitzung setzte sonst die Dokumentation des vergangenen Termins auf `ist_aktuell = false`.
- **Achtung — Leseregel:** jede lesende Abfragestelle braucht `.eq('ist_aktuell', true)`, sonst erscheint jede Korrektur als eigener Befund. Betrifft Archiv, Patientenkarte und den Termin-Knopf (dort lief vorher `.maybeSingle()`, das mit Versionen gebrochen wäre).
- **Achtung — Schreibregel:** `version` und `ist_aktuell` vergibt `pat_fussbefund_versionieren_trg`, nicht der Client. Gelöscht wird nur ein Eintrag **als Ganzes** (`.eq('eintrag_id', …)`); eine einzelne Version zu entfernen verwischt eine Korrektur, die letzte zu entfernen macht still eine ältere Fassung wieder gültig.
- **Achtung:** Es gab zwei unabhängige Schreibwege auf diese Tabelle (`saveFussbefund` ↔ `fbpSave`) — das war der Musterfall der Kopie-Jagd. Seit 27.08.2026 gibt es genau einen. Vor jeder neuen Schreibstelle `fonksiyon-ustasi` fragen: eine zweite Schreibstelle ohne `eintrag_id`-Logik zerreißt den Verlauf still.

### `fußstatus`
- **Warum:** Der **alte** Fußbefund aus dem ersten Podologie-Wurf.
- **Seit:** 13.06.2026 · `create_fussestatus`
- **Status:** veraltet
- **Wer:** niemand mehr im Code. Steht nur noch in der DSGVO-Löschreihenfolge (`api/dsgvo.js`), damit Altbestände mit verschwinden.
- **Achtung:** In SQL **immer quoten**: `"fußstatus"`. Vor dem Löschen prüfen, ob Altdaten drinstehen — dann erst migrieren.

---

## 6. Abrechnung §302 SGB V · Rechnung · GoBD

### `abrechnung`
- **Warum:** Der Abrechnungslauf als Ganzes: eine Sammelrechnung an einen Kostenträger, mit DTA-Datei, Signaturzustand, Upload- und Zahlungsdatum. Ohne diesen Kopfsatz gäbe es keinen Bezugspunkt für Absetzungen.
- **Seit:** spätestens 18.05.2026 · `v11_billing_a2_tables` (Storage-Pfade `v15`/`v17`)
- **Status:** aktiv
- **Wer:** `api-backend/billing/api/abrechnung.routes.js`, Statistik, Dashboard-Abrechnungsansicht.
- **Achtung:** Steht **bewusst nicht** in der DSGVO-Löschliste — § 302/§ 304 SGB V Aufbewahrung geht vor.

### `belegliste`
- **Warum:** GoBD-Belegjournal: jeder Geldvorgang lückenlos und unveränderlich.
- **Seit:** spätestens 08.06.2026 · `security_hardening_handles_bookings_search_path`
- **Status:** aktiv
- **Wer:** alle Backend-Abrechnungsrouten schreiben Belege; `dashboard.js` und `module/beleg-druck.js` lesen.
- **Achtung:** ⚠️ **Unveränderlich.** `UPDATE` und `DELETE` sind per Trigger blockiert, es gibt keine passende RLS-Policy. Korrektur läuft **nur** über einen neuen Beleg mit `type = 'storno'`. `beleg_nr` vergibt ein Trigger — im Code niemals selbst hochzählen. Nicht in der DSGVO-Löschliste (§ 147 AO).

### `nummernkreise`
- **Warum:** Lückenlose, race-freie Nummernvergabe je Inhaber und Jahr (`rechnung_nr`, `beleg_nr`, `mahnung_nr`). Vorher zählte das Frontend mit `MAX+1` hoch — bei zwei gleichzeitigen Nutzern gibt das dieselbe Nummer zweimal.
- **Seit:** 16.08.2026 · `invoices_ust_nummernkreis_gobd`
- **Status:** aktiv
- **Wer:** **niemand im Anwendungscode — mit Absicht.** Nur die SQL-Funktion `naechste_nummer(owner, kreis, jahr)` (`INSERT … ON CONFLICT DO UPDATE … RETURNING`), aufgerufen aus Triggern wie `set_invoice_nummer()`.
- **Achtung:** Sieht in `db/NUTZUNG.md` „ungenutzt" aus. Ist sie nicht. Wer hier eine Nummer im Code vergibt, hebt die Sperre auf.

### `invoices`
- **Warum:** Die Rechnung an Privatzahler und Selbstzahler (GKV läuft über `abrechnung`).
- **Seit:** 13.05.2026 · `create_invoices_table`
- **Status:** aktiv
- **Wer:** `saveInvoice()`, `markiereRechnungBezahlt()`, `module/rechnung-zahlung.js`, Rechnungseditor.
- **Achtung:** Seit 16.08.2026 GoBD-festgeschrieben. `rechnung_nr` und `invoice_number` kommen vom Trigger `set_invoice_nummer()` — **beim Speichern keines von beiden selbst setzen.** Ab `status <> 'draft'` sperrt `invoice_festschreibung()` die inhaltlichen Felder; offen bleiben nur `status`, `payment_*`, `paid_at`, `notes`. Korrektur = Storno + Neuausstellung. In der DSGVO-Kette wird sie **anonymisiert statt gelöscht**.

### `mahnungen`
- **Warum:** Mahnstufen zu offenen Rechnungen, mit eigenem Nummernkreis.
- **Seit:** 25.05.2026 · `v28_mahnwesen`
- **Status:** aktiv
- **Wer:** `api-backend/billing/api/mahnwesen.routes.js`, Statistik.

### `ausfallrechnungen`
- **Warum:** Ausfallhonorar bei No-Show oder kurzfristiger Absage. Rechtlich **Schadensersatz**, damit umsatzsteuerfrei und keine GKV-Leistung — deshalb keine Zeile in `invoices`.
- **Seit:** 12.07.2026 · `ausfallgebuehr`
- **Status:** aktiv
- **Wer:** `api-backend/billing/api/ausfall.routes.js`; ausgelöst aus `handleDirectAusfallrechnung()`.
- **Achtung:** Die maßgeblichen Einstellungen (`ausfall_*`) liegen in **`profiles`**, nicht in `businesses` — obwohl die Spalten in beiden existieren.

### `zuzahlung_befreiung`
- **Warum:** Befreiungsausweise. Ob ein Patient zuzahlungsfrei ist, entscheidet über den abrechenbaren Betrag und darf nicht als Häkchen an der Verordnung hängen — es gilt zeitraumbezogen.
- **Seit:** spätestens 18.05.2026 · `v11_billing_a2_tables` (Auto-Flag: `v19_befreiung_auto_flag`)
- **Status:** aktiv
- **Wer:** `module/zuzahlung-befreiung.js`, `uploadRxNachweise()`.

### `zuzahlung_korrekturen`
- **Warum:** Der geforderte Zuzahlungsbetrag darf sich ändern (Patient bricht nach 3 von 6 Einheiten ab), aber nicht stillschweigend — es ist Geld und es ist GoBD. Diese Tabelle hält je Änderung fest: wer, wann, alter Wert, neuer Wert, Grund. Eine Spalte an `prescriptions` hätte bei der zweiten Korrektur die erste Begründung überschrieben, also genau das, was hier verhindert werden soll.
- **Seit:** 01.09.2026 · `20260831120000_zuzahlung_korrektur`
- **Status:** aktiv
- **Wer:** `api-backend/billing/api/zuzahlung.routes.js` schreibt (nur dort), `module/zuzahlung-korrektur.js` löst aus.
- **Achtung:** Append-only — Trigger `prevent_zuzahlung_korrekturen_mod()` blockt UPDATE/DELETE, gleiches Muster wie `belegliste`. Eine falsche Korrektur wird durch eine NEUE richtiggestellt. Der **gültige** Betrag steht weiterhin in `prescriptions.zuzahlung_eur`; diese Tabelle ist das Gedächtnis, nicht die Wahrheit. `verordnung_id` ist für die Podologie vorgesehen, aber noch ungenutzt (dort gibt es bis heute keinen gespeicherten Zuzahlungsbetrag).

### `zuzahlung_guthaben`
- **Warum:** Hat der Patient im Voraus für 6 Einheiten gezahlt und bricht nach 3 ab, liegt Geld zuviel in der Praxis. Statt es auszuzahlen, soll es auf die nächste Verordnung angerechnet werden. Das Guthaben gehört dem Patienten, nicht der Verordnung — deshalb eigene Tabelle mit `patient_id` und nicht eine Spalte am Rezept.
- **Seit:** 01.09.2026 · `20260831120000_zuzahlung_korrektur`
- **Status:** aktiv
- **Wer:** `api-backend/billing/api/zuzahlung.routes.js` (anlegen + verrechnen), `module/zuzahlung-korrektur.js` zeigt an.
- **Achtung:** Bewusst NICHT in `belegliste` gelöst: das Kassenbuch bildet Zahlungsvorgänge ab und ist unveränderlich, ein Guthaben dagegen ist ein Zustand, der sich ändert (offen → teilweise verrechnet → verrechnet). `status` setzt der Trigger `fn_zuzahlung_guthaben_status()` aus `rest_eur` — nicht von Hand schreiben. Fliesst echtes Bargeld zurück, wird weiter ganz normal ein `belegliste`-Beleg mit `type='storno'` gebucht.

### `zaa_fehler`
- **Warum:** Absetzungen und Fehlermeldungen der Kasse aus der ZAA-Rückmeldung, samt Übersetzung und Lösungshinweis. Roh sind die Codes für einen Therapeuten unlesbar.
- **Seit:** spätestens 18.05.2026 · `v11_billing_a2_tables`
- **Status:** aktiv
- **Wer:** ZAA-Parser im Backend schreibt, Dashboard zeigt an.

### `terapeut_zertifikat`
- **Warum:** Das **Signaturzertifikat** für die §302-Einreichung (PKCS#7). Ohne gültiges Zertifikat lässt sich keine DTA-Datei signieren.
- **Seit:** spätestens 18.05.2026 · `v11_billing_a2_tables`
- **Status:** aktiv
- **Wer:** `billing/api/abrechnung.routes.js`, Einstellungen im Dashboard, `module/verordnung-podo.js`.
- **Achtung:** ⚠️ Türkische Schreibweise, und **nicht** dasselbe wie `therapist_certificates`. Verwechslung führt zu „Zertifikat fehlt" bei vorhandenem Zertifikat.

### `therapist_certificates`
- **Warum:** Fachliche Qualifikationen des Therapeuten (MT, MLD, KGG). Bestimmte Leistungen darf nur abrechnen, wer die Qualifikation nachweist.
- **Seit:** spätestens 08.06.2026 · `cleanup_test_users_keep_fizyo6`
- **Status:** aktiv
- **Wer:** `loadEmpCertificates()` in der Teamverwaltung, Prüfung in der Abrechnung.

### `document_vorlagen`
- **Warum:** Druckvorlagen je Inhaber (Rechnung, Mahnung, Bericht) als JSON. Sonst müsste jede Layoutänderung deployt werden.
- **Seit:** 11.06.2026 · `v29_dashboard_features_kat0`
- **Status:** aktiv
- **Wer:** Vorlagen-Modul im Dashboard; Backend rendert damit.

### `kostentraeger`
- **Warum:** Die §302-Seite der Kassen: IK-Nummern, Annahmestellen, Datenannahme-Wege. Das ist etwas anderes als die Kassenliste in der Oberfläche.
- **Seit:** 18.05.2026 · `v11_billing_a2_tables` (Seed: `v14_kostentraeger_mock_seed`)
- **Status:** aktiv, aber **Mock-Daten**
- **Wer:** Abrechnungsroute im Backend, Dashboard-Anzeige.
- **Achtung:** Enthält bis heute Platzhalter, weil der ITSG-Zugang zur echten Kostenträgerdatei fehlt. Im Mock stecken doppelte IKs. **Nicht** mit `krankenkassen` verwechseln.

---

## 7. Kataloge und Referenzdaten

### `heilmittel_katalog`
- **Warum:** Der **aktive**, vereinheitlichte und zeitversionierte Heilmittelkatalog aller vier Fachbereiche. Löste die beiden Vorgänger ab, weil abgelöste Positionen sonst als unbegrenzt gültig erschienen.
- **Seit:** 26.07.2026 · `heilmittel_katalog_unified`
- **Status:** aktiv (Referenz)
- **Wer:** gelesen ausschließlich über die RPC `search_heilmittel()`; befüllt von `api-backend/sync_heilmittel_katalog.js`.
- **Achtung:** **Nicht von Hand bearbeiten.** Quelle sind die Codedateien unter `api-backend/billing/codes/*.js`; die Tabelle wird daraus erzeugt. Ein `K` unterscheidet sie von `heilmittel_catalog`.

### `heilmittel_catalog`
- **Warum:** Erster Podologie-Katalog (nur HPNR 78xxx), aus der Zeit vor der Vereinheitlichung.
- **Seit:** 13.06.2026 · `create_heilmittel_catalog`
- **Status:** veraltet
- **Wer:** niemand.
- **Achtung:** Enthält abgelöste Ross-Fraser-Positionen als unbegrenzt gültig — wer sie liest, rechnet falsch ab. Löschkandidat, aber erst nach Abgleich, ob alle Positionen in `heilmittel_katalog` angekommen sind.

### `heilmittel_position`
- **Warum:** §302-Abrechnungspositionen mit Preisen und Zuzahlung, Physio-Seed aus der A2-Phase.
- **Seit:** 18.05.2026 · `v13_physio_positions_seed`
- **Status:** veraltet
- **Wer:** niemand.
- **Achtung:** ⚠️ Falsche Fährte: `heilmittel_position` ist auch eine **Spalte** in `prescriptions` und taucht deshalb in `abrechnung.routes.js` auf. Das ist die Spalte, nicht die Tabelle. Ein reines `grep` hält sie für aktiv.

### `heilmittel_tarif`
- **Warum:** Preise je Kostenträger und Stichtag — die Tarifseite zum Katalog. 928 Zeilen.
- **Seit:** spätestens 18.05.2026 · `v11_billing_a2_tables`
- **Status:** aktiv (Referenz)
- **Wer:** `api-backend/seed_tarifs.js` befüllt, `billing/api/abrechnung.routes.js` liest.

### `dta_schluessel`
- **Warum:** Schlüsselverzeichnisse aus Anlage 3 TP5 (Kennzeichen, Gruppen, Codes) als Datenbestand.
- **Seit:** 18.05.2026 · `v12_billing_codes_anlage3_v22`
- **Status:** Referenz, im Code ungenutzt
- **Wer:** niemand — die DTA-Erzeugung liest die Schlüssel heute aus `api-backend/billing/codes/*.js`.
- **Achtung:** Vor dem Löschen prüfen, ob die Codedateien wirklich alles abdecken; die Tabelle ist die einzige DB-seitige Kopie. Der Migrationsname sagt `v22`, gültig ist aber **V21** (V22 gilt erst ab 01.02.2027).

### `diagnosegruppen`
- **Warum:** Diagnosegruppen der Heilmittel-Richtlinie samt ICD-Regeln — die Brücke zwischen Diagnose und zulässigem Heilmittel.
- **Seit:** 13.06.2026 · `create_diagnosegruppen` (ICD-Regeln: `v33`, Präfix-Bereinigung: `v36`)
- **Status:** aktiv (Referenz)
- **Wer:** über die RPC `search_diagnosen()`; `module/diagnosegruppen-regeln.js`, `module/verordnung-podo.js`.

### `icd10_titles`
- **Warum:** ICD-10-GM 2026, 16.905 Kodes. Der Anwender soll suchen können, ohne den Code zu kennen.
- **Seit:** 01.07.2026 · `icd10_titles_ddl`
- **Status:** aktiv (Referenz)
- **Wer:** **kein direkter `.from()`-Aufruf** — gelesen nur über die RPC `search_diagnosen()`, aufgerufen aus `katalog-suche.js`.
- **Achtung:** Größte Tabelle des Projekts (5 MB). Suche ist bewusst LIKE + Trigram, kein `tsvector`.

### `icd_sector_ranges`
- **Warum:** Welcher ICD-Bereich zu welchem Fachbereich gehört. Grundlage des `strict`-Filters, der fachfremde Diagnosen ganz aus der Auswahl nimmt.
- **Seit:** 25.07.2026 · `icd_diagnose_search_schema`
- **Status:** aktiv (Referenz)
- **Wer:** nur die RPC `search_diagnosen()` (Feld `in_sector`).
- **Achtung:** Für **alle vier** Fachbereiche gefüllt. `strict: true` ist heute nur in der Podologie eingeschaltet — datenseitig ist für die anderen nichts mehr zu tun, es fehlt allein der Schalter im Frontend.

### `krankenkassen`
- **Warum:** Die Kassenliste für das Auswahlfeld in der Oberfläche. 93 GKV-Kassen, gesetzt am 02.06.2026.
- **Seit:** **in keiner Migration** — direkt im SQL-Editor angelegt. Das ist der einzige Fall im Projekt, in dem sich das Entstehungsdatum aus der Datenbank nicht rekonstruieren lässt.
- **Status:** aktiv (Referenz)
- **Wer:** `module/krankenkasse-suche.js`, Dashboard, Buchungsanfrage, Backend `/krankenkassen`.
- **Achtung:** **Nicht** `kostentraeger`. Diese hier ist die Oberfläche, jene die §302-Seite.

### `aerzte`
- **Warum:** Arztregister je Inhaber. Wird beim Erfassen einer Verordnung automatisch befüllt: LANR-Treffer reichert den vorhandenen Datensatz an, sonst wird neu angelegt. Grundlage der Auswertung „welcher Arzt überweist wie viel".
- **Seit:** 13.05.2026 · `add_aerzte_and_physio_fields` (Register-Ausbau: `v32_aerzte_register`, 10.08.2026)
- **Status:** aktiv
- **Wer:** `api-backend/lib/arzt-registry.js`, `module/arzt-register.js` (`wireArztFeld` = Picker + Schnellanlage), `arzt-suche.js`.
- **Achtung:** Zwei Unique-Indizes greifen abhängig davon, ob eine LANR vorliegt — beim Anlegen also nicht blind `upsert` auf den Namen.

---

## 8. Fahrtenbuch

### `fahrten`
- **Warum:** Fahrtenbuch für Hausbesuche, finanzamtstauglich (Zweck, Start-/Zielort, Kilometer).
- **Seit:** 22.05.2026 · `v21_fahrtenbuch` (Finanzamtsfelder: 10.06.2026)
- **Status:** aktiv
- **Wer:** `saveFahrtStartHandler()`, `saveFahrtEndHandler()` im Dashboard.
- **Achtung:** `booking_id` ist `ON DELETE CASCADE` — ein gelöschter Termin nimmt die Fahrt mit.

### `vehicles`
- **Warum:** Fahrzeugstamm zum Fahrtenbuch; Kilometerstände und Kennzeichen gehören nicht an die einzelne Fahrt.
- **Seit:** 22.05.2026 · `v21_fahrtenbuch`
- **Status:** aktiv
- **Wer:** Fahrtenbuch-Modul im Dashboard.

---

## 9. Protokolle und Compliance

### `consent_log`
- **Warum:** Nachweis der Einwilligung des **Praxisinhabers** (AVV, AGB, Datenschutz, Cookies) — DSGVO/TTDSG. Ohne Protokoll ist die Zustimmung nicht belegbar.
- **Seit:** 23.05.2026 · `v25_avv_consent_log`
- **Status:** aktiv
- **Wer:** `api/onboarding/pending.js` (direkter PostgREST-Aufruf, kein `.from()`).
- **Achtung:** ⚠️ **Nicht** `patient_consents`. Andere betroffene Person, andere Frist, andere Rechtsgrundlage.

### `data_access_log`
- **Warum:** Zugriffsprotokoll nach DSGVO Art. 32 — wer hat wann welche Patientendaten gesehen. Aufbewahrung 12 Monate.
- **Seit:** 22.05.2026 · `v26_data_access_log`
- **Status:** aktiv
- **Wer:** `api-backend/_lib/access-log.js` → `logAccess()`. Nur schreibend; gelesen wird über die DSGVO-Auskunft.

### `ai_audit_log`
- **Warum:** Protokoll jedes KI-Aufrufs (Rezept-OCR, Entwürfe): Modell, Kosten, Ergebnis. Nachweis gegenüber dem EU AI Act und Kostenkontrolle.
- **Seit:** 16.05.2026 · `v9_ai_audit_log`
- **Status:** aktiv
- **Wer:** `api-backend/ai/audit.js` schreibt, `api/admin/data.js` liest.
- **Achtung:** PII wird vorher maskiert (`api-backend/ai/pii-mask.js`) — beim Erweitern nicht daran vorbeischreiben.

### `email_logs`
- **Warum:** Welche Mail ging wann an wen raus. Bei Terminbestätigungen ist „ist die Mail angekommen?" die häufigste Rückfrage.
- **Seit:** 10.05.2026 · `email_logs_table`
- **Status:** aktiv
- **Wer:** Dashboard (Patientendetail → Mails), Admin-Panel.

### `feedbacks`
- **Warum:** Rückmeldung aus dem Produkt heraus. Ein Trigger schickt jeden neuen Eintrag per Telegram — sonst liest sie niemand rechtzeitig.
- **Seit:** 12.05.2026 · `create_feedbacks_table` (Telegram-Trigger: 17.06.2026)
- **Status:** aktiv
- **Wer:** Feedback-Modul im Dashboard, `api/admin/feedbacks.js`.

---

## 10. Altlasten, Fremdkörper, Löschkandidaten

> Diese Tabellen tun heute nichts. Sie stehen hier, damit die Frage „was ist das und
> können wir das weg?" nicht jedes halbe Jahr neu gestellt wird.

### `b2b_contacts`
- **Warum:** B2B-Akquise: Ärzte und Partner anschreiben, um Zuweisungen zu bekommen. Aus der Zeit, als Praxura noch selbst Kunden für die Praxis gewinnen wollte.
- **Seit:** 10.05.2026 · `create_b2b_contacts_and_fix_services`
- **Status:** aktiv (Randmodul)
- **Wer:** B2B-Modul im Dashboard, Backend-Mailversand.

### `scraper_data`
- **Warum:** Ergebnisse der Apify-Suche (Google-Maps-Praxen) als Akquiseliste — die Zulieferung für `b2b_contacts`.
- **Seit:** 11.05.2026 · `create_scraper_data_table`
- **Status:** aktiv (Randmodul)
- **Wer:** Dashboard liest; befüllt über `api/apify/search.js`.

### `chatbot_usage`
- **Warum:** Token- und Kostenprotokoll des Website-Chatbots.
- **Seit:** 18.05.2026 · `chatbot_usage_log`
- **Status:** verdächtig
- **Wer:** nur noch `api/admin/data.js` (Anzeige). Geschrieben wird nichts mehr — der Chatbot-Strang gehört zum eingestellten WhatsApp-/Bot-Bereich.
- **Achtung:** Steht in der DSGVO-Löschreihenfolge. Vor dem Entfernen dort mit austragen.

### `referral_drafts`
- **Warum:** Erster Rezept-Fluss: Foto einer Verordnung → KI-Auszug (`raw_ai_data`, `seans_sayisi`, `tedavi_turu`) → Bestätigung → Terminserie (`booking_series_id`). Der Vorläufer von `prescriptions` + `/booking/ai-suggest-series`.
- **Seit:** spätestens 22.05.2026 · `v24_multi_business_foundation`
- **Status:** verdächtig
- **Wer:** niemand im Code. Nur in der DSGVO-Auskunft und -Löschung geführt.
- **Achtung:** Türkische Spaltennamen (`seans_sayisi` = Sitzungsanzahl, `tedavi_turu` = Behandlungsart). Bevor sie fällt: prüfen, ob bei Beta-Kunden Altdaten drinliegen.

> **Die folgenden fünf gehören nicht zu Praxura.** Es sind Reste älterer Projekte im
> selben Supabase-Projekt, die bei der Übernahme mitgeschleppt wurden. Kein Praxura-Code
> hat sie je benutzt; `api/dsgvo.js` notiert sie ausdrücklich als „Tabellen aus einem
> anderen Projekt, alle leer". Sauberste Löschkandidaten des Bestands — vor dem Drop
> einmal auf Zeileninhalt prüfen und aus `api/dsgvo.js` austragen, wo sie geführt werden.

### `accommodations`
- **Warum:** Fremdprojekt (Unterkünfte). Nie Teil von Praxura.
- **Seit:** älter als die auffindbare Historie · erste Erwähnung `create_core_tables_safe` (18.06.2026)
- **Status:** fremd
- **Wer:** niemand. Steht nicht einmal in der DSGVO-Auskunft — richtig so, keine Praxisdaten.

### `applications`
- **Warum:** Fremdprojekt (Bewerbungen). Nie Teil von Praxura.
- **Seit:** älter als die auffindbare Historie · erste Erwähnung `cleanup_test_users_keep_fizyo6` (08.06.2026)
- **Status:** fremd
- **Wer:** niemand; nicht in der DSGVO-Auskunft.

### `trip_plans`
- **Warum:** Fremdprojekt (Reiseplanung). Nicht mit dem Fahrtenbuch (`fahrten`) verwechseln — das ist unseres.
- **Seit:** älter als die auffindbare Historie · erste Erwähnung `create_core_tables_safe` (18.06.2026)
- **Status:** fremd
- **Wer:** niemand im Code; steht in der DSGVO-Auskunft und muss beim Drop dort mit raus.

### `trip_history`
- **Warum:** Fremdprojekt, Gegenstück zu `trip_plans`.
- **Seit:** 18.06.2026 · `add_trip_history`
- **Status:** fremd
- **Wer:** niemand im Code; in der DSGVO-Auskunft geführt.

### `user_credits`
- **Warum:** Fremdprojekt (Guthabenmodell). Praxura rechnet über Stripe ab, nicht über Credits.
- **Seit:** älter als die auffindbare Historie · erste Erwähnung `cleanup_test_users_keep_fizyo6` (08.06.2026)
- **Status:** fremd
- **Wer:** niemand im Code; in der DSGVO-Auskunft geführt.

### `spatial_ref_sys`
- **Warum:** Systemtabelle der PostGIS-Erweiterung (Koordinatensysteme). Kam mit `enable_postgis` für die Geocodierung im Fahrtenbuch.
- **Seit:** 18.06.2026 · `enable_postgis`
- **Status:** System
- **Wer:** PostGIS selbst.
- **Achtung:** **Die einzige Tabelle ohne RLS** — das ist korrekt und unkritisch. Nicht „reparieren": ein RLS auf einer Erweiterungstabelle bricht PostGIS.

---

## Wer eine Praxis löschen will, stößt hier an

Aufgenommen am 29.08.2026. Die **Constraints selbst** stehen in `db/SCHEMA.sql` und werden
hier absichtlich nicht abgeschrieben — was hier steht, ist ihre *Folge*: an welcher Stelle
eine Löschung hängenbleibt und ob das Absicht ist. Genau das sieht man dem Schema nämlich
nicht an.

Belegt, indem die vollständige DSGVO-Löschkette (`api/dsgvo.js`) gegen echte Konten in einer
Transaktion mit anschließendem ROLLBACK ausgeführt und danach nachgezählt wurde — kein
Datensatz wurde dabei verändert.

**Die Reihenfolge ist keine Kosmetik.** Diese Tabellen zeigen ohne CASCADE auf `profiles`
und müssen vorher weg, sonst scheitert der letzte Schritt: `podologie_behandlungen`,
`fußstatus`, `messreihen`, `booking_requests` (bis 04.09.2026 stand hier zusätzlich
`verordnungen` — gedroppt, siehe Abschnitt 4/5 oben, kein Auftauchen mehr nötig). Bis zum
28.08.2026 standen sie in keiner Löschliste — die Löschung ist deshalb für jede echte Praxis
am Profil gescheitert, und der Endpunkt meldete trotzdem Erfolg.

**Zwei Sperren sind vermutlich Absicht und dürfen nicht „weggeräumt" werden:**

| Sperre | Was passiert | Warum das vermutlich so gewollt ist |
|---|---|---|
| `belegliste.owner_id` (RESTRICT) | Profil lässt sich nicht löschen, solange eine Belegliste existiert | GoBD / § 147 AO — die Belegliste ist Buchführungsnachweis |
| `patient_consents` (RESTRICT auf `profiles` **und** auf `leads`) | Weder Profil noch Patientenakte löschbar, solange Einwilligungen stehen | Die Einwilligung ist der Nachweis ihrer selbst; sie zu löschen vernichtet den Beleg dafür, dass sie vorlag |

Ob beide bewusst als RESTRICT gebaut wurden, ist **nicht belegt** — es liest sich so, steht
aber nirgends geschrieben. Wer es weiß, trage es hier nach.

**Die unangenehmste Kette** — sie erklärt, warum eine Löschung in der Praxis fast immer
unvollständig blieb: der Trigger `invoice_festschreibung()` weist das Anonymisieren von
`invoices` ab, sobald eine Rechnung festgeschrieben ist (SQLSTATE 23514). Dadurch bleibt
`invoices.patient_id` stehen, und weil dieser Fremdschlüssel nicht CASCADE ist, lässt sich
anschließend `leads` — die Patiententabelle — gar nicht mehr löschen (23503). Eine einzige
festgeschriebene Rechnung genügt. Die Auflösung ist eine Abwägung (Art. 17 Abs. 3 lit. b
gegen § 147 AO / § 14b UStG) und gehört `legal-de`, nicht dem Endpunkt.

**Angestellte sperren den Inhaber.** `profiles.owner_id` zeigt auf `profiles` selbst, ohne
CASCADE. Solange Mitarbeiterzeilen am Inhaber hängen, ist dessen Profil nicht löschbar. Was
mit deren Konten geschehen soll, wenn die Praxis geht, ist eine offene Produktfrage.

**Fünf Einträge der Löschliste greifen ins Leere:** `prescription_sessions`,
`prescription_validations`, `employee_services`, `employee_groups`,
`employee_business_assignments` haben weder `owner_id` noch `user_id`. Die Löschschleife
probiert genau diese beiden Spalten, bekam 400 und übersprang sie bis zum 28.08.2026
wortlos. Drei davon räumt ihr CASCADE-Elternteil ohnehin ab; sie bleiben als Absicherung
stehen, scheitern aber jetzt hörbar.

**Zwei Leichen mit Vault-Zugriff:** `business_lookup_for_inbound` und
`business_lookup_for_twilio` nennen die gedroppte `business_services` noch im Rumpf. Sie
sind ohnehin defekt (lesen `profiles.cal_api_key_secret_id` und `profiles.cal_username`,
beide Spalten gibt es nicht mehr), haben keinen Aufrufer im Repo und `EXECUTE` nur für
`service_role`. CLAUDE.md sagt, die Twilio-RPC nicht anzufassen — deshalb stehengelassen,
aber hier vermerkt, damit sie niemand für lebendig hält.

---

## Was hier bewusst NICHT steht

- **Daten.** Kein Patientenname, kein Zeileninhalt, keine Zeilenzahl mit Aussagekraft. Das Repo ist öffentlich.
- **Struktur.** Spalten und Constraints stehen in `db/SCHEMA.sql`, Policies in `db/SCHEMA-RLS.sql`. Doppelte Wahrheit veraltet doppelt.
- **Die Nutzungsliste.** Wer genau schreibt, steht in `db/NUTZUNG.md` und wird erzeugt. Hier stehen nur die Einstiegspunkte in Worten.
- **Das Ops-Dashboard.** Anderes Supabase-Projekt (`farkaejociddtgqkusvm`), eigener Bestand, hier nicht erfasst.
