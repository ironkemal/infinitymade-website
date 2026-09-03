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
- **Achtung — `verordnung_id` (seit 03.09.2026):** die Spalte bindet einen Termin an eine **podologische** Verordnung (`verordnungen`). Sie ist der Podologie-Ersatz für etwas, das es dort nicht gibt: ein Einheiten-Hauptbuch.
  - ⚠️ **Hier gehört NIE eine `prescriptions.id` hinein.** Der Physio/Ergo/Logo-Topf verknüpft über `prescription_sessions.booking_id`, und das ist kein Umweg, sondern die einzige Stelle, an der die Information hinpasst: `prescription_sessions` hält je verordneter Einheit eine Zeile (auch ohne Termin, siehe `module/sitzung-abgleich.js`). Die Frage lautet dort „welche der 18 Einheiten hat dieser Termin erfüllt?" — das lässt sich an `bookings` gar nicht ausdrücken. In der Podologie lautet die Frage „zu welcher Verordnung gehört dieser Termin?", und die gehört an den Termin. Wer hier eine zweite Spalte `prescription_id` danebenhängt, erzeugt einen zweiten Weg für den Physio-Topf — genau die Sorte Parallelwahrheit, die uns `heilmittel_catalog` ↔ `heilmittel_katalog` gekostet hat.
  - Warum die Spalte **nicht** `podologie_behandlungen.booking_id` + Platzhalterzeilen geworden ist (Variante B der Vorlage vom 03.09.): `podologie_behandlungen` ist ein **Leistungsnachweis**, die Zeile *ist* die erbrachte Behandlung. Vorab angelegte Zeilen hätten vier laufende Regeln gebrochen — den Einheiten-Zähler nach `abrechenbar` (`module/podologie-abrechnung.js:1343-1349`), die §302-Sperre „noch keine Behandlung dokumentiert" (`api-backend/billing/api/verordnung-status.routes.js:126-136`), die 78040-Eingangsbefundungsregel (`module/eingangsbefundung-regel.js`, jede Zeile mit `behandlungsdatum` gilt als erbracht) und den offenen Rechnungsentwurf (`module/rechnung-bruecke.js:63-75`). Kein Abrechnungs-, Belegliste- oder GoBD-Pfad liest dagegen `bookings` — deshalb ist diese Spalte an der Geldseite risikofrei.
  - **`ON DELETE SET NULL` ist Pflicht, nicht Geschmack:** `api/dsgvo.js` löscht `verordnungen` **vor** `bookings`. Mit RESTRICT/NO ACTION bräche die DSGVO-Löschkette an dieser Stelle. In `USER_TABLES`/`DELETE_TABLES` war keine Ergänzung nötig — `bookings` steht dort längst.
  - **Owner-Riegel:** `trg_booking_verordnung_owner` (BEFORE INSERT/UPDATE OF `verordnung_id`, `owner_id`) prüft `verordnungen.owner_id = bookings.owner_id`. Ein Fremdschlüssel prüft **keine RLS** — ohne den Riegel könnte ein Mitarbeiter die Id einer fremden Verordnung in einen eigenen Termin schreiben. Die Triggerfunktion ist `SECURITY DEFINER`, und das ist der Punkt: ein SELECT im Rumpf unterläge sonst der RLS des Aufrufers, die fremde Zeile wäre unsichtbar, `NOT FOUND` griffe — der Riegel fiele genau im Angriffsfall offen auf.
  - ⚠️ **Sichtbarkeits-Asymmetrie, betrifft die Oberfläche:** `bookings` hat Team-Zugriff, `verordnungen` und `podologie_behandlungen` haben ihn nicht (`owner_id = auth.uid()`). Ein angestellter Therapeut sieht den Termin samt `verordnung_id`, kann die Verordnung aber nicht lesen. Das ist die bekannte offene Produktfrage der fünf Tabellen ohne Team-Zugriff (`db/README.md`), kein Fehler dieser Spalte.
  - **Wer schreibt:** die Seite „Verordnungen" (`module/verordnung-detail.js`, untere Hälfte, rechte Spalte) beim gezielten Vergeben eines einzelnen Termins. „Unvergeben" ist dort **keine Zeile**, sondern gerechnet: `verordnungen.behandlungseinheiten` minus Zahl der Termine mit dieser `verordnung_id`. Anlass: Beta-1, 31.08.2026.

### `services`
- **Warum:** Was die Praxis anbietet, mit Dauer und Preis. Grundlage für Slot-Berechnung und Abrechnung.
- **Seit:** spätestens 06.05.2026 · `extend_profiles_for_multi_tenant`
- **Status:** aktiv
- **Wer:** Onboarding (`autoSeedGkvServices`), Kalender-Einstellungen, Buchungsseite, Backend.
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

## 4. Verordnung — Physio · Ergo · Logopädie

> Zweiter Verordnungstopf (Podologie) siehe Abschnitt 5. Die Trennung ist **gewollt**.

### `prescriptions`
- **Warum:** Die Verordnung (Muster 13) für Physio/Ergo/Logopädie: Diagnose, Heilmittel, Frequenz, Genehmigung — die Grundlage jeder GKV-Abrechnung.
- **Seit:** 16.05.2026 · `v10_prescriptions`
- **Status:** aktiv
- **Wer:** 15 Dateien, 8 schreibende Funktionen — Rezept-Scan, Verordnungsliste und -detail, Abrechnung, Rechnung, Mahnwesen, Statistik.
- **Achtung:** Zwei getrennte ICD-Spalten (`icd10`, `icd10_2`) — bei `verordnungen` ist es dagegen ein `text[]`. Wer Code zwischen den Töpfen kopiert, produziert hier einen stillen Typfehler.

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

### `verordnungen`
- **Warum:** Die podologische Verordnung. Eigener Topf, weil Podologie andere Pflichtfelder hat (Wagner-Armstrong-Grad, Fußstatus-Bezug) und die Abrechnung über HPNR 78xxx läuft.
- **Seit:** 13.06.2026 · `create_verordnungen` (GoBD-Riegel nachgezogen: 03.09.2026 · `verordnungen_gobd_festschreibung`)
- **Status:** aktiv
- **Wer:** `module/podologie-abrechnung.js`, `verordnung-uebersicht.js`, `abrechnungsstatus.js`, Backend-Abrechnung und Verordnungsstatus.
- **Achtung:** `icd10` ist ein `text[]` (bei `prescriptions` zwei Einzelspalten). Team darf seit 03.09.2026 LESEN (Policy `Employees can view team verordnungen`), Schreiben bleibt beim Inhaber — `status` haengt an der serverseitigen Uebergangspruefung in `verordnung-status.routes.js`, ein direkter Team-Schreibzugriff wuerde daran vorbei gehen.
- **Achtung — GoBD-Riegel seit 03.09.2026:** Trigger `trg_verordnungen_festschreibung` →
  `verordnung_festschreibung()`. Sobald `belegnummer` gesetzt ist (einmalig bei der
  DTA-Erzeugung, `/abrechnung/create-podologie`), sperrt er per `UPDATE` genau die Spalten,
  die in `mapVerordnungToDtaShape()` tatsächlich in die DTA-Datei eingehen:
  `ausstellungsdatum, diagnosegruppe, icd10, leitsymptomatik, pat_leitsymptomatik, dringend,
  hausbesuch, therapiefrequenz, rezeptart, zuzahlung_befreit, kostentraeger_ik,
  versichertennummer, lead_id, arzt_id, belegnummer` selbst. Vergleicht `NEW` gegen `OLD`
  (`IS DISTINCT FROM`) — ein unveränderter Re-Save (der Podologie-Bearbeiten-Dialog schreibt
  beim Speichern pauschal alle Formularfelder) geht durch, nur eine echte Änderung wirft
  `check_violation` mit Verweis auf das Korrekturverfahren.
  Bewusst **nicht** gesperrt, weil nicht Teil der DTA bzw. weiter gebraucht:
  `status, absetzung_betrag, absetzung_grund, absetzung_am, storno_grund, storno_am,
  abrechnung_id` (das ist der Korrekturweg selbst — `PATCH /verordnung/:id/abrechnungsstatus`,
  ZAA-Import), `patient_name` (DTA nimmt den Namen immer aus `leads`), `behandlungseinheiten`
  (kommt in keiner Zeile der Backend-Abrechnungskette vor — nur Arbeitslisten-Anzeige,
  siehe `module/verordnung-einheiten.js`), `heilmittel_items` (speist nur
  `statistik.routes.js`), `wagner_grad, behandlungsanlass, notizen, behandlungsstart,
  beginn_spaetestens, therapiebericht`. Gegenstück zu `invoice_festschreibung()` bei
  `invoices`, andere Spaltenliste. Löschung (`DELETE`, `api/dsgvo.js`) ist von diesem Trigger
  nicht betroffen — er hängt nur an `BEFORE UPDATE`.

### `podologie_behandlungen`
- **Warum:** Die Behandlung zur podologischen Verordnung — das Gegenstück zu `prescription_sessions` im anderen Topf.
- **Seit:** 13.06.2026 · `create_podologie_behandlungen` (Team-SELECT nachgezogen: 03.09.2026 · `verordnungen_podologie_behandlungen_team_select`)
- **Status:** aktiv
- **Wer:** `loadPodologieBilling()`, Patientenkarte, Rechnungsbrücke, Backend-Abrechnung.
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
und müssen vorher weg, sonst scheitert der letzte Schritt: `verordnungen`,
`podologie_behandlungen`, `fußstatus`, `messreihen`, `booking_requests`. Bis zum 28.08.2026
standen sie in keiner Löschliste — die Löschung ist deshalb für jede echte Praxis am
Profil gescheitert, und der Endpunkt meldete trotzdem Erfolg.

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
