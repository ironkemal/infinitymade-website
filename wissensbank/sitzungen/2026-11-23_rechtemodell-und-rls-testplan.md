# Rechtemodell + RLS-Testplan (23.11.2026)

> Auftrag: Box-Browser-Test 22.11.2026, Abschnitt „Mitarbeiter und Berechtigungen“, Aufträge 1, 3 und 4.
> Nur Lesen und Planen, keine RLS-Änderung (Melih-Entscheidung 22.11.). Quellen sind Code und
> `db/SCHEMA-RLS.sql` (Stand 0129). Synthetische Daten, keine Namen.
> ⚠️ Eigene Notiz, kein amtliches Dokument (Ausnahme laut `wissensbank/README.md`).

## 1. Warum waren „Berechtigungen“ und „Standorte“ versteckt? (Auftrag 1)

| Reiter | Bedingung bis 22.11. | Ursache im Test | Stand 23.11. |
|---|---|---|---|
| Berechtigungen | `dashboard.js` `loadEmpPermissions`: nur Inhaber **und** `currentBusiness` gesetzt | Frische Box hatte keinen Standort (O-250/O-251), also abgebrochen und versteckt. Weder Paket noch Fehler | Inhaber sieht den Reiter immer, ohne Standort mit Erklärung und Knopf „Standort anlegen“ (`module/rechte-ohne-standort.js`); Box-Einrichtung legt den Standort an (`api-backend/setup/standard-standort.js`) |
| Standorte | `module/planung-bruecke.js` `mountStandortplanReiter`: nur Inhaber **und** ≥ 2 Standorte | Gewollt: Bei einem Standort gibt es nichts zu verteilen | unverändert |

## 2. Rechtemodell (Auftrag 3)

**Rollen** (`profiles.role`): `owner` (Inhaber) · `employee` (Mitarbeiter). Weitere gibt es nicht. Die Rolle eines
Kontos ändert nur der Server (`profiles_privilegierte_spalten_schuetzen`, 0053).

**Ebenen für Mitarbeiter** (je Standort, `get_my_permissions(p_business_id)`):
1. Gruppe des Mitarbeiters am Standort (`employee_business_assignments.group_id` → `group_scopes`)
2. Einzelfreigabe/-sperre (`employee_scope_overrides`) **vor** der Gruppe
3. Inhaber: alle Module `true`
4. Zusätzlich global je Fachbereich × Rolle: `module_visibility` (Sidebar-Schalter aus dem Admin-Panel, keine Praxisdaten)

Schreiben in Gruppen, Scopes und Einzelfreigaben darf nur der Inhaber (0107). Der Mitarbeiter darf seine
Einzelfreigaben lesen.

**Module** (`RBAC_MODULES` in `dashboard.js`) und Standard je Gruppe (Seed `seed_default_groups_for_business()` beim Anlegen eines Standorts):

| Modul | Anzeige | Gruppe „Mitarbeiter“ | Gruppe „Sekreter“ | Inhaber |
|---|---|---|---|---|
| dashboard | Übersicht | ✓ | ✓ | ✓ |
| calendar | Termine | ✓ | ✓ | ✓ |
| customers | Kunden/Patienten | ✓ | ✓ | ✓ |
| services | Leistungen | ✓ | ✓ | ✓ |
| hours | Arbeitszeiten | ✓ | ✓ | ✓ |
| team | Personal | ✓ | ✓ | ✓ |
| notes | Notizen | ✓ | – | ✓ |
| anamnese | Anamnese | ✓ | – | ✓ |
| prescriptions | Rezepte | ✓ | – | ✓ |
| abrechnung | Abrechnung (+ Rechnungen seit 0121) | – ¹ | – ¹ | ✓ |
| fahrtenbuch | Fahrtenbuch | – | – | ✓ |
| b2b / b2c | B2B / B2C | – / – | – / ✓ | ✓ |
| feedback | Feedback | – | – | ✓ |
| settings | Einstellungen | – | – | ✓ (nur Inhaber) |

¹ 0121 hat bestehenden Gruppen `abrechnung` = ✓ gegeben (Altbestand, Melih-Entscheid 11.11.). **Neue Standorte**
bekommen es nicht, weil der Seed es nicht enthält. Mitarbeiter neuer Standorte sehen also standardmäßig keine
Rechnungen. Das ist eine eigene Entscheidung, hier nur festgehalten.

Weitere Grenzen außerhalb der Matrix: Statistik und Praxisfinanzen nur für den Inhaber (S-67, V6.B01). Geänderte
Rechte wirken beim Mitarbeiter erst nach dem Neuladen (Testbox 22.11.).

## 3. Was schützt die Datenbank wirklich? (Auftrag 4, Ist-Stand aus `db/SCHEMA-RLS.sql`)

| Tabelle | Policy | Filter |
|---|---|---|
| `leads` (Patienten) | team view/insert/update/delete | **nur Praxis** (Inhaber oder `profiles.owner_id`) |
| `prescriptions` | prescriptions_owner_all | **nur Praxis** |
| `anamnese` | anamnese_owner_and_team_* | nur Praxis |
| `patient_dokumente` | patient_dokumente_owner_and_team_* | nur Praxis |
| `bookings` | Employees/Owners … team bookings | nur Praxis |
| `abrechnung` (§302-Läufe) | abrechnung_owner_all | **nur Praxis, kein Modulrecht** |
| `invoices`, `rechnung_zahlungen` | 0121 | Praxis **und** Modulrecht `abrechnung` am Standort der Rechnung (`abrechnungszugriff_erlaubt`) |

**Folgerung:** Das Rechte-Modul steuert bei Patienten, Verordnungen, Anamnese, Dokumenten, Terminen und
§302-Läufen **nur die Anzeige**. Ein Mitarbeiter mit gültiger Sitzung kann diese Daten der ganzen Praxis über die
REST-API lesen. Der Hinweistext im Reiter sagt das schon. Nach Behandlungsteam filtert keine Tabelle. Echten Schutz
auf Datenebene haben Rechnungen und Zahlungen. Die Mandantengrenze (fremde Praxis) halten alle genannten Tabellen.
Prüfung: `api-backend/db/tests/0081_security_boundaries.test.sql`.

## 4. RLS-Testplan (nicht ausgeführt, Konto erst nach Melihs Freigabe)

**Grundsatz:** Ein zweites Konto nur mit erfundenen Daten. „Fremde Praxis“ nur im SaaS-QA-Mandanten, denn auf der
Box gibt es nur eine Praxis. Auf der Box nur Rollen-Tests. Lesend, ohne Schreibversuche auf Bestandsdaten.

| # | Wer | Versuch (REST mit eigenem JWT) | Erwartung heute |
|---|---|---|---|
| R1 | Mitarbeiter A, Praxis 1 | `GET /rest/v1/leads?select=id` | alle Patienten von Praxis 1 (Ist, nur Praxisfilter) |
| R2 | Mitarbeiter A | `GET /rest/v1/leads?owner_id=eq.<Praxis 2>` | 0 Zeilen (Mandantengrenze) |
| R3 | Mitarbeiter A ohne Modul `prescriptions` | `GET /rest/v1/prescriptions?select=id` | Zeilen sichtbar (Ist: nur Anzeige gesperrt) |
| R4 | Mitarbeiter A ohne Modul `abrechnung` | `GET /rest/v1/invoices?select=id` | 0 Zeilen (0121) |
| R5 | Mitarbeiter A mit `abrechnung` an Standort X | invoices von Standort Y | 0 Zeilen |
| R6 | Mitarbeiter A | `GET /rest/v1/abrechnung?select=id` | Zeilen sichtbar (Ist, kein Modulrecht) |
| R7 | Mitarbeiter A | `PATCH /rest/v1/employee_scope_overrides` (sich selbst freischalten) | abgelehnt (0107) |
| R8 | Mitarbeiter A | `PATCH /rest/v1/profiles?id=eq.<A>` `role=owner` | abgelehnt (0053) |
| R9 | ausgeschiedener Mitarbeiter (is_active=false) | Login + beliebige Abfrage | Login gesperrt (Auth-Bann), keine Daten |
| R10 | Mitarbeiter A | Datei aus dem Storage-Bucket der Patientendokumente einer anderen Praxis | abgelehnt |

Ablauf: (1) Melih gibt das Testkonto frei. (2) Mitarbeiter mit erfundenem Namen im QA-Mandanten anlegen und
Einrichtungscode einlösen. (3) Abfragen mit dem JWT aus der Sitzung, als Skript mit Exit-Code. Kein Schlüssel, kein
Code und kein Link ins Repo. (4) Ergebnis an `guvenlik` (Register). (5) Testkonto entfernen.

**Entscheidungsbedarf (nicht Teil dieses Laufs):** Ob R1, R3 und R6 auf Datenebene nach Modulrecht oder Behandlungsteam
eingeschränkt werden sollen, ist eine Produkt- und Sicherheitsentscheidung (`/konsey`, `guvenlik`, `legal-de`).
Heute gilt: Wer nicht zum Behandlungsteam gehört, bekommt kein Mitarbeiterkonto (Hinweistext im Reiter).

## Ergebnis Live-Lauf 23.11.2026 (SaaS, nur QA-Mandanten, kein neues Konto)

Melih-Auftrag „offene Punkte abschließen“. Statt eines neuen Testkontos die zwei vorhandenen synthetischen
QA-Mandanten (Podologie-QA = Praxis 1, Physio-QA = Praxis 2) mit ihren Mitarbeiter-/Inhaberkonten.
Nur Zählungen und Statuscodes gelesen, keine Inhalte. Skript lag nur im Scratchpad.

| # | Ergebnis | Beleg |
|---|---|---|
| R1 | ✅ Mitarbeiter liest Patienten der eigenen Praxis | 206, n > 0 |
| R2 | ✅ Mandantengrenze dicht, **beide Richtungen**: leads, prescriptions, bookings, invoices, abrechnung, patient_dokumente, anamnese | je 0 Zeilen |
| R3 | ℹ bestätigt Befund: Verordnungen nur nach Praxis gefiltert | 30 Zeilen |
| R4 | ✅ echt geprüft: Inhaber setzt Einzelfreigabe `abrechnung=false` → Mitarbeiter sieht **0** Rechnungen (vorher 2); Freigabe danach gelöscht (204), wieder 2 | Override-Weg von `abrechnungszugriff_erlaubt` |
| R5 | – nicht getrennt geprüft (QA-Mandanten haben je einen Standort mit Rechnungen) | |
| R6 | ℹ bestätigt Befund: §302-Läufe ohne Modulrecht sichtbar | 17 Zeilen |
| R7 | ✅ Selbst-Freischaltung abgelehnt | 403 / 42501 |
| R8 | ✅ Selbst-Beförderung zum Inhaber abgelehnt, Rolle danach `employee` | 403 / 42501 |
| R9 | – nicht prüfbar: kein QA-Konto mit `is_active=false` (keins angelegt) | |
| R10 | – nicht prüfbar: im Bucket `patient-documents` liegt je Praxis nur ein Objekt, keins der beiden QA-Praxen | |

Hinweis R4: beide QA-Mitarbeiter haben `abrechnung` über ihre Gruppe (0121 Option A) — der erste Lauf mit 18
sichtbaren Rechnungen war also korrekt, kein Leck. Offene Befunde (R3/R6, Modulrechte nur für Rechnungen auf
Datenebene) bleiben Entscheidung Melih/guvenlik; keine RLS-Änderung in diesem Lauf (Melih 22.11.).
