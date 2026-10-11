# Datenbank — Praxura

> **Vor jedem SQL zuerst hier lesen.** Diese Datenbank hat Fallen, die man
> nicht errät. Wer sie nicht kennt, schreibt Code gegen Tabellen, die es so
> nicht gibt — oder gegen die falsche von zwei fast gleich heißenden.

| Datei | Inhalt | Beantwortet |
|---|---|---|
| `SCHEMA.sql` | alle Tabellen, Spalten, Constraints, Views (Zahlen: Kopf der Datei) | **was** |
| `SCHEMA-RLS.sql` | RLS-Policies, eigene Funktionen, Trigger, Indizes (Zahlen: Kopf der Datei) | **wer darf** |
| `REGISTER.md` | warum jede Tabelle angelegt wurde, seit wann, ob noch gebraucht | **warum** |
| `NUTZUNG.json` / `.md` | wer liest und schreibt (erzeugt: `node tools/tabellenkarte.mjs`) | **wer nutzt** |
| `README.md` | dieses Dokument — Orientierung + Auffrischungsregel | |

> **Neue Tabelle → Eintrag in `REGISTER.md`, im selben Commit.** Der pre-commit-Hook
> (`tools/check-tabellen-register.sh`) bricht sonst ab. Gepflegt vom Agenten `db-ustasi`.

**Stand:** 2026-10-10 · letzte SaaS-Migration `20261010005316 0078_zuzahlungsbeleg_invoices` (Datei `0078`). Die Kette selbst: `api-backend/db/migrations/`; Warum je Tabelle: `REGISTER.md`. Vollständiger Metadatenexport mit `tools/schema-export-katalog.sql` und `tools/schema-dokumente.mjs`.
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
`pat_fussbefund`, `fahrten`, `ausfallrechnungen`,
`zuzahlung_befreiung`, `ueberweisungen`, `patient_notes`, `warteliste`.

`patients` existiert parallel und wird **nur vom Termin-Anfrage-Flow** benutzt
(`booking_requests.patient_id` → `patients.id`).

Beide Töpfe bestehen bewusst nebeneinander. **Nicht zusammenlegen** — das bricht
laufende Abläufe.

### 2. Ein Verordnungstopf: `prescriptions`

Seit 04.09.2026 liegen die Verordnungen **aller** Fachbereiche in `prescriptions`
(`therapie_bereich` unterscheidet). Die frühere Podologie-Tabelle `verordnungen`
wurde gedroppt. Behandlungen laufen weiter getrennt:

| Fachbereich | Verordnung | Behandlung |
|---|---|---|
| Physio · Ergo · Logopädie | `prescriptions` | `prescription_sessions` |
| **Podologie** | `prescriptions` (`therapie_bereich = 'podo'`) | `podologie_behandlungen` + `bookings.verordnung_id` |

Die Übersetzung zwischen den beiden Wortschätzen (podologische Feldnamen ↔
Spalten von `prescriptions`) macht `module/verordnung-topf.js`. Eine zweite
Verordnungstabelle wird **nicht** mehr angelegt — Begründung im Eintrag
`verordnungen` in `REGISTER.md`.

### 3. Drei Heilmittel-Tabellen

| Tabelle | Rolle |
|---|---|
| `heilmittel_katalog` | ★ **aktiv** — vereinheitlicht, zeitversioniert, von `search_heilmittel()` gelesen |
| `heilmittel_catalog` | alt, nur Podologie-HPNR (78xxx) |
| `heilmittel_position` | §302-Abrechnungspositionen (Preise, Zuzahlung) |

`katalog` mit K ist das Aktive. Ein Buchstabe Unterschied.

Ebenso doppelt: `krankenkassen` (UI-Dropdown) vs. `kostentraeger`
(§302-Seite, echte Kostenträgerdatei, quartalsweise geladen; Ladestand und Reste: `REGISTER.md`, Eintrag `kostentraeger`).

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
`employee_services`, `custom_days`, sowie `profiles`/`businesses`
nur bei gesetztem `booking_slug` und `auth.uid() IS NULL`.

Bekannte Schwachstellen, dokumentiert statt stillschweigend gepatcht:
- ~~`employee_services` und `time_offs`: jeder eingeloggte Nutzer darf schreiben, mandantenübergreifend.~~ **Geschlossen 02.10.2026** (`0054`, S-07): beide nur noch innerhalb des eigenen Mandanten; `time_offs` ist seitdem auch **nicht mehr öffentlich lesbar**. Details: `db/REGISTER.md`.
- Team-Zugriff je Tabelle: massgeblich ist der jeweilige Eintrag in `db/REGISTER.md`
  (`patient_notes`/`warteliste`: Teamzugriff seit 17.09.2026, Migration `0022`). Ob
  angestellte Therapeuten eine Tabelle sehen sollen, ist eine offene **Produktfrage** —
  nicht nebenbei „korrigieren".
- Weitere bekannte Lücken: `guvenlik/REGISTER.md` (nicht öffentlich) und `db/REGISTER.md`.

---

## Namensfallen

| Sieht aus wie | Ist aber |
|---|---|
| `leads` | Patienten |
| `patients` | nur Termin-Anfragen |
| `heilmittel_katalog` / `heilmittel_catalog` | K = aktiv, c = alt |
| `terapeut_zertifikat` | §302-Signaturzertifikat (türkische Schreibweise) |
| `therapist_certificates` | MT/MLD/KGG-Qualifikationen |
| `fußstatus` | **gedroppt 02.10.2026** (`0056`). Das Panel heisst weiter `fussstatus` und liest `pat_fussbefund` — ein Treffer auf „fussstatus“ ist kein Hinweis auf eine Tabelle |
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

Die ausführbare Kette liegt in `api-backend/db/migrations/` (`0000_baseline` bis
heute; Regeln: `api-backend/db/migrations/README.md`). Reihenfolge bei jeder
Schemaänderung: **erst Datei, dann Dump, dann live** — wer nur per MCP anwendet,
erreicht die Kundenboxen nie; der Hook `tools/check-onprem.sh` bricht ab, wenn
der Dump ohne neue Kettendatei aktualisiert wird.

`supabase/migrations/` gibt es nicht mehr (archiviert 04.09.2026 nach
`archive/supabase-migrations-vor-baseline/`). Für den Schemastand maßgeblich sind
diese Dateien hier.
