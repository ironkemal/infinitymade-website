# Datenbank — Praxura

> **Vor jedem SQL zuerst hier lesen.** Diese Datenbank hat Fallen, die man
> nicht errät. Wer sie nicht kennt, schreibt Code gegen Tabellen, die es so
> nicht gibt — oder gegen die falsche von zwei fast gleich heißenden.

| Datei | Inhalt |
|---|---|
| `SCHEMA.sql` | 80 Tabellen, alle Spalten, Constraints, Views |
| `SCHEMA-RLS.sql` | 152 RLS-Policies, 60 Funktionen, 57 Trigger, 286 Indizes |
| `README.md` | dieses Dokument — Orientierung + Auffrischungsregel |

**Stand:** 2026-08-28 · letzte Migration `business_services_droppen_spiegeltabelle`
(davor `prescription_sessions_booking_unique`,
`leads_geschlecht_kodierung_dokumentieren`, `invoice_nummer_backfill_altbestand`)
(davor `invoices_ust_nummernkreis_gobd`, `invoices_verordnung_id` — Rechnungskette Faz 3;
davor `20260815233848_verordnungsnummer_belegnummer`)
(davor `20260815085338_leads_patientennummer`, `20260814200147_leads_handy_getrennt`,
`20260814101707_patient_consents`, `20260814101624_kiosk_pin_hardening`,
`20260814083941_fussbefund_termin_legende`.
Am 11.08. lief zusätzlich `sql-melih/SUPABASE-JETZT-AUSFUEHREN.sql` über den SQL-Editor —
steht in keiner Migrationszeile, ist in der DB aber drin und im Dump enthalten)
**Projekt:** Supabase `njvuclullotbksskpwgk` (Produkt).
Das Ops-Dashboard liegt in einem **anderen** Projekt (`farkaejociddtgqkusvm`) — nicht verwechseln.

---

## ⚠️ Das hier ist eine Momentaufnahme

Diese Dateien sind aus der Live-DB introspiziert, also **strukturell korrekt** —
aber sie sind ein Foto, keine Leitung. Nach jeder Migration werden sie falsch,
ohne dass jemand etwas merkt. Ein veraltetes Schema ist schlimmer als gar
keines, weil man ihm glaubt.

**Regel: jede Schemaänderung → Dateien neu erzeugen, im selben Commit.**

Ablauf (Claude Code hat den MCP-Zugang, also einfach sagen):

> „Schema aktualisieren"

Dann werden `SCHEMA.sql` und `SCHEMA-RLS.sql` neu aus der DB gezogen und
Datum + letzte Migration im Kopf beider Dateien fortgeschrieben.

Wer die Datei liest: **zuerst das Datum oben prüfen.** Liegt es weit zurück und
sind seither Migrationen gelaufen, dem Inhalt nicht blind trauen.

Was hier **nicht** drinsteht: Daten. Kein einziger Patientendatensatz, keine
Zeile aus einer Tabelle — nur Struktur. Das ist Absicht: das Repo ist öffentlich,
und Gesundheitsdaten haben in keinem Repo etwas verloren.

---

## Die sieben Fallen

### 1. `leads` ist die Patiententabelle — nicht `patients`

Der Name täuscht. `leads` entstand als Akquise-Tabelle (daher `title`,
`google_url`, `reviews_count`) und ist heute die **reale Patientenakte**.
Daran hängen: `anamnese`, `prescriptions`, `invoices`, `messreihen`,
`pat_fussbefund`, `verordnungen`, `fahrten`, `ausfallrechnungen`,
`zuzahlung_befreiung`, `ueberweisungen`, `patient_notes`, `warteliste`.

`patients` existiert parallel und wird **nur vom Termin-Anfrage-Flow** benutzt
(`booking_requests.patient_id` → `patients.id`).

Beide Töpfe bestehen bewusst nebeneinander. **Nicht zusammenlegen** — das bricht
laufende Abläufe.

### 2. Zwei Verordnungstöpfe, nach Fachbereich getrennt

| Fachbereich | Verordnung | Behandlung |
|---|---|---|
| Physio · Ergo · Logopädie | `prescriptions` | `prescription_sessions` |
| **Podologie** | `verordnungen` | `podologie_behandlungen` |

Auch hier: bewusst getrennt, nicht vereinheitlichen. Achtung beim Umschreiben von
Code — `verordnungen.icd10` ist `text[]`, `prescriptions` hat dagegen zwei
Einzelspalten (`icd10`, `icd10_2`).

### 3. Drei Heilmittel-Tabellen

| Tabelle | Rolle |
|---|---|
| `heilmittel_katalog` | ★ **aktiv** — vereinheitlicht, zeitversioniert, von `search_heilmittel()` gelesen |
| `heilmittel_catalog` | alt, nur Podologie-HPNR (78xxx) |
| `heilmittel_position` | §302-Abrechnungspositionen (Preise, Zuzahlung) |

`katalog` mit K ist das Aktive. Ein Buchstabe Unterschied.

Ebenso doppelt: `krankenkassen` (UI-Dropdown, 93 Kassen) vs. `kostentraeger`
(§302-Seite, aktuell Mock-Daten bis der ITSG-Zugang steht).

### 4. Owner-Einstellungen gehören nach `profiles`, nicht nach `businesses`

Einzelstandort-Inhaber haben **keinen** `businesses`-Datensatz. Eine Einstellung,
die dort landet, ist für sie unsichtbar und wird nicht gespeichert. Deshalb liegen
z. B. die `ausfall_*`-Felder in **beiden** Tabellen — maßgeblich ist `profiles`.

### 5. Doppelbuchung wird von der DB verhindert, nicht vom Code

```sql
EXCLUDE USING gist (user_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
  WHERE (status = 'confirmed' AND group_parent_id IS NULL)
```

Nicht in der Anwendung nachbauen. Wer einen überlappenden Termin einfügt,
bekommt einen Constraint-Fehler — den abfangen und übersetzen, nicht umgehen.

### 6. `belegliste` ist unveränderlich (GoBD)

`UPDATE` und `DELETE` sind per Trigger blockiert und es gibt keine passende
RLS-Policy. Korrektur läuft **ausschließlich** über einen neuen Beleg mit
`type = 'storno'`. Gleiches Prinzip bei den Nummernkreisen
(`beleg_nr`, `mahnung_nr`, `rechnung_nr`): lückenlos je Inhaber, per Trigger vergeben,
nie im Code selbst hochzählen.

Seit 16.08.2026 gilt das auch für **`invoices`** — die einzige Rechnungstabelle, die
bis dahin daran vorbeilief und im Frontend mit `MAX+1` hochzählte. Neu:

- `invoices.rechnung_nr` + `invoice_number` kommen vom Trigger `set_invoice_nummer()`,
  gezählt über die Tabelle **`nummernkreise`** (`naechste_nummer(owner, kreis, jahr)`,
  `INSERT .. ON CONFLICT DO UPDATE .. RETURNING` — echte Sperre, keine Race).
- Einmal vergeben ändert sich die Nummer nie wieder, auch nicht beim `UPDATE`.
- `invoice_festschreibung()` sperrt ab `status <> 'draft'` die inhaltlichen Felder.
  Offen bleiben `status`, `payment_*`, `paid_at`, `notes` — daran hängt das Kassieren.
  Korrektur einer festgeschriebenen Rechnung = **Storno + Neuausstellung**.

Wer eine Rechnung speichert, setzt also **weder** `invoice_number` **noch**
`rechnung_nr` selbst.

### 7. `patient_consents` blockiert das Löschen von Patient und Inhaber

Seit 2026-08-14. `patient_id -> leads(id)` und `owner_id -> profiles(id)` sind beide
`ON DELETE RESTRICT`, dazu blockt `trg_patient_consents_immutable` jedes `DELETE`
innerhalb von **10 Jahren** ab `consented_at` (§ 630f Abs. 3 BGB) und lässt beim
`UPDATE` nur `revoked_at` / `revoke_reason` durch.

Praktisch heißt das: **sobald ein Patient einmal unterschrieben hat, ist er nicht
mehr löschbar — und der Praxisinhaber auch nicht.** Wer einen Lösch- oder
Offboarding-Flow baut (DSGVO Art. 17, Kontoschließung, Testdaten aufräumen), läuft
sonst in einen nackten FK-Fehler.

Richtig ist **nicht**, das RESTRICT zu lockern — die Aufbewahrungspflicht schlägt
das Löschverlangen. Richtig ist Anonymisierung: personenbezogene Felder in `leads`
leeren, die Einwilligungszeile stehen lassen (sie ist der Nachweis, nicht die
Patientenakte). Und: `patient_consents` ist **nicht** `consent_log` — letzteres
gehört dem Praxisinhaber (B2B, AVV/AGB), andere betroffene Person, andere Frist.

Hintergrund: `konsey/tutanak/2026-08-14-patienten-uebergabe-einwilligung.md`,
`compliance/LEGAL_DECISIONS.md` (2026-08-14).

---

## Mandantentrennung

```
profiles.role      → 'owner' | 'employee'
profiles.owner_id  → Mitarbeiter zeigt auf seinen Inhaber (bei Inhabern NULL)
```

Das Standardmuster jeder Policy:

```sql
auth.uid() = owner_id
OR auth.uid() IN (SELECT id FROM profiles WHERE owner_id = <tabelle>.owner_id)
```

Es gibt drei Schreibweisen derselben Absicht (historisch gewachsen, siehe
`SCHEMA-RLS.sql` §1). Beim Anlegen neuer Policies eine davon übernehmen,
nichts Neues erfinden.

**RLS ist auf allen Tabellen aktiv** außer `spatial_ref_sys` (PostGIS-System, unkritisch).

Bewusst öffentlich lesbar (Buchungsseite): `services`, `working_hours`,
`time_offs`, `employee_services`, `custom_days`, sowie `profiles`/`businesses`
nur bei gesetztem `booking_slug` und `auth.uid() IS NULL`.

Bekannte Schwachstellen, dokumentiert statt stillschweigend gepatcht:
- `employee_services` und `time_offs`: jeder eingeloggte Nutzer darf schreiben (`auth.role() = 'authenticated'`), mandantenübergreifend.
- Fünf Tabellen ohne Team-Zugriff (nur Inhaber sieht sie): `verordnungen`, `podologie_behandlungen`, `fußstatus`, `patient_notes`, `warteliste`. Ob angestellte Therapeuten das sehen sollen, ist eine offene **Produktfrage** — nicht nebenbei „korrigieren".

---

## Namensfallen

| Sieht aus wie | Ist aber |
|---|---|
| `leads` | Patienten |
| `patients` | nur Termin-Anfragen |
| `heilmittel_katalog` / `heilmittel_catalog` | K = aktiv, c = alt |
| `terapeut_zertifikat` | §302-Signaturzertifikat (türkische Schreibweise) |
| `therapist_certificates` | MT/MLD/KGG-Qualifikationen |
| `fußstatus` | alter Fußbefund — in SQL **immer quoten**: `"fußstatus"` |
| `pat_fussbefund` | aktueller Podologie-Fußbefund |
| `referral_drafts.seans_sayisi` / `tedavi_turu` | Sitzungsanzahl / Behandlungsart (türkisch) |

---

## Tote Spalten und Tabellen

Vorhanden, aber ohne Funktion — nicht als Vorlage nehmen, nicht bespielen:

- `profiles.whatsapp_*`, `system_prompt`, `faq`, `message_templates` — WhatsApp-Strang 2026-05-20 eingestellt
- `business_lookup_for_twilio()`, `business_lookup_for_inbound()` — dito, zugehörige Tabellen gedroppt
- `profiles.has_dta_pro`, `dta_pro_subscription_item_id` — Add-on 2026-06-08 abgeschafft, §302 steckt in Professional
- `profiles.sector` erlaubt noch `barber`, `beauty`, `nails`, `tattoo`, `spa`, `gym`, `massage` — Reste der alten KMU-Ausrichtung, im Onboarding nicht mehr wählbar
- `accommodations`, `trip_plans`, `trip_history`, `applications`, `user_credits` — Fremdkörper aus älteren Projekten im selben Supabase-Projekt

Der Supabase **Vault** hat heute genau eine Aufgabe: das temporäre
Onboarding-Passwort (`pending_signups.password_secret_id`, Zugriff nur über
`pending_signup_store/consume/delete`).

---

## Suchfunktionen (die das Frontend aufruft)

**`search_diagnosen(p_q, p_bereich, p_kind, p_limit)`**
Liefert Diagnosegruppen (`kind = 'dg'`) und ICD-Codes (`kind = 'icd'`) in einer
Liste. `in_sector` kommt aus `icd_sector_ranges` und ist die Grundlage des
`strict`-Filters im Picker. Leere Eingabe → nur Diagnosegruppen (das
„Leerklick zeigt Diagnosegruppen"-Verhalten).

**`search_heilmittel(p_q, p_bereich, p_diagnosegruppe, p_datum, p_limit)`**
Liest `heilmittel_katalog`, filtert auf Stichtag und schließt `deprecated`
sowie abgelöste Positionen aus.

Beide sind bewusst LIKE + Trigram-Index, kein `tsvector`.

`icd_sector_ranges` ist für **alle vier** Fachbereiche gefüllt. Der strict-Modus
ist heute nur in der Podologie eingeschaltet — für die anderen Bereiche ist
datenseitig nichts mehr zu tun, es fehlt nur der Schalter im Frontend.

---

## Migrationen

Im Repo liegen unter `supabase/migrations/` nur **10** Dateien; die Datenbank
kennt **195**. Der Rest wurde direkt über MCP oder den SQL-Editor angewendet.
`supabase/migrations/` ist deshalb **keine** verlässliche Quelle für den
Schemastand — diese Dateien hier sind es.
