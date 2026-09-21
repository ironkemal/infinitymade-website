# Konsey Kararı — IK-Suche im Kassenfeld (Ops #300)

Tarih: 2026-09-21 · Oturan üyeler: `muhalif`, `deger-mi`, `fonksiyon-ustasi`, `gkv-302`, `podoloji`, `db-ustasi` (ersatzweise für die On-Prem-Sicht — Agent `onprem` ist in `.claude/agents/` nicht installiert)
Nicht gesessen: `legal-de` (Referenztabelle, keine Patientendaten — ON-PREM ETKİSİ: hayır) · `guvenlik` (keine der vier Veto-Themen) · Außenblick `agy` (nicht installiert).
Status: **von Melih freigegeben (21.09.2026, „Mache jetzt alles fertig")** · Lieferung 2 umgesetzt: Migration `0039` (`a2d8e68`) und Anschluss am Feld (`4078c8c`) committet, **nicht gepusht** · **Migration nicht live angewandt** (Melih, MCP nicht autorisiert) — bis dahin findet die IK-Suche in der App nichts. Änderungen gegenüber der Runde: siehe „Nachtrag" am Ende.

> ⚠️ **PRÄMISSE ÜBERHOLT (21.09.2026, nach der Konsey-Runde entdeckt).** Dieses Konsey ging von `db/REGISTER.md` aus („16 von 94 gefüllt, 4 davon falsche Kasse"). Live (öffentliche Route `GET /api/krankenkassen`, 21.09.2026) sind es **76 von 94 gefüllt**, und die vier früher falschen Werte sind korrigiert (DAK `105830016`, KKH `102171012`, AOK BW = NULL). Grund: Ops #301, siehe `2026-09-21-krankenkassen-ik-nachtrag.md` (andere Session, gleicher Arbeitsbaum, Migration `0038` noch nicht angewandt/committet; deren Vollprüfung „alle 75 IKs gegen `kostentraeger`" steht noch aus — ich habe nur 4 Stichproben).
> **Entscheidung Melih (21.09.2026): Lieferung 1 gestrichen.** Vorbereitete Tests dafür wurden verworfen, es gibt keine Codeänderung dazu.
> **Folge:** **Lieferung 1 (Autofill stilllegen) ist damit unbegründet und nicht mehr empfohlen** — der Autofill liefert für ~71 Kassen vermutlich die richtige IK (Ops #264). **Lieferung 2 (View + IK-Suche gegen `kostentraeger`) bleibt gültig:** der Podologe tippt die **Karten-IK** (z. B. DAK `100167999`), und die steht nur in `kostentraeger`, nicht in `krankenkassen.ik_number` (= abrechnende IK). Die Migrationsnummer wird `0039` oder höher: `0038` ist belegt (`0038_seed_heilmittel_katalog_podo_komplex_suche.sql`, andere Session, uncommitted), und #301 plant ebenfalls eine Migration — die Nummer wird erst beim Anlegen vergeben, damit sich beide nicht überschneiden. Alle Aussagen unten zu „falsche IK im DTA" und zu `krankenkassen.ik_number` sind Stand 06.09. und nicht mehr aktuell.

## Vorgeschichte (vor dem Konsey entschieden, nicht neu verhandelt)

- Ursache bestätigt: `sucheKassen()` (`module/krankenkasse-suche.js:101`) prüft nur `name`/`kurz`, nie die IK.
- User-Entscheidung 1: **nicht** gegen `krankenkassen.ik_number` suchen (16/94 gefüllt, 4/16 falsche Kasse, On-Prem überall NULL — `db/REGISTER.md:681`, `:834`).
- User-Entscheidung 2: Nach Auswahl steht in `rzPatKasseIk` die **aufgelöste abrechnende IK** `COALESCE(abrechnender_kt_ik, ik)` — wie heute (Feld → `prescriptions.kostentraeger_ik`). Erfassung der Karten-IK in `krankenkasse_ik` ist ein eigenes Ticket.

## KARAR

**Option A, in zwei getrennten Lieferungen, Reihenfolge bindend.**

**Lieferung 1 — sofort, ohne DB (eigener Commit):** Den falschen IK-Autofill an **beiden** Stellen stilllegen: `dashboard.js:15853-15854` (`rzKkList` → `rzPatKasseIk`, überschreibt unbedingt mit `''`) **und** `module/krankenkasse-suche.js:167` (`onSelect` füllt Geschwisterfeld aus `krankenkassen.ik_number`). Der Kommentar „`ik_number` = kanonische IK" im selben Modul (Z. ~117-133) wird im selben Commit gelöscht. `dashboard.js` darf dabei nicht wachsen. Danach sendet kein Pfad mehr eine falsche IK ins DTA; der Rückfall bleibt die bestehende Namensauflösung im Backend (`api-backend/lib/rezept-felder.js:55`).

**Lieferung 2 — danach:** neue Migration mit **View `kostentraeger_auswahl`** (`WITH (security_invoker = true)`, nur `authenticated`, kein Index, keinen Datenstand hartkodieren). Filter: `datensatz_status = 'echt' AND active AND (valid_to IS NULL OR valid_to >= current_date) AND (abrechnender_kt_ik IS NOT NULL OR EXISTS (SELECT 1 FROM kostentraeger_annahmestellen WHERE kostentraeger_ik = kostentraeger.ik))`. `payer_type = 'gkv'` darf zusätzlich stehen, **trägt aber nichts** (siehe Kör noktalar). Die View wird **live angewandt, bevor** das Frontend deployt wird. Die Suche läuft nur bei **reinen Ziffern, ab 4 Stellen**, als Präfixsuche **nur gegen die View**, sortiert nach IK; die Namenssuche bleibt unverändert. Ein Treffer setzt den **Namen aus der View** ins Feld und `COALESCE(abrechnender_kt_ik, ik)` nach `rzPatKasseIk`; darunter bleibt sichtbar stehen: „Karte 100167999 → rechnet ab bei 105830016" (de/en/tr). Ein bereits gefülltes Feld (z. B. per OCR) wird **nicht überschrieben, aber sichtbar gemacht**. Ohne Treffer bleibt Freitext möglich (Privat/Selbstzahler/BG/Beihilfe).

**Nicht Teil dieses Tickets:** Karten-IK in `krankenkasse_ik` erfassen · `das_ik`-Umbau · `rezept-felder.js:55` (`limit(1)` ohne `order`) · Bereinigung `krankenkassen.ik_number` (#301).

## Gerekçe

`gkv-302` (kein Veto) und `db-ustasi` bestätigen A; `podoloji` nennt B eine Falle (Rechenzentrum im Dropdown → still falsche Abrechnung, schlimmer als die leere Liste heute) und C die schlechteste Option; `muhalif` fand, dass B zusätzlich still versagt (siehe Kör noktalar). Belegt (Seed `0006_seed_kostentraeger.sql`, geprüft): Rechenzentren wie „gkv informatik" und „Rezeptprüfstelle Duderstadt" stehen mit `payer_type='gkv'`, `ist_abrechnender_kt='t'` und leerem `abrechnender_kt_ik` in der Tabelle — nur die VKG-Bedingung trennt sie. Lieferung 1 zuerst, weil `muhalif` zeigt, dass ein Autofill-Stopp an nur einer Stelle die falsche IK weiter ins DTA laufen lässt, und weil sie ohne Migration und ohne Melih auskommt.

## Ödün verilenler

- Lieferung 2 kostet laut `deger-mi` ~1–1,5 Tage plus Pflege bei jedem Quartalsseed; in der Zeit ruht der `das_ik` → `kostentraeger_annahmestellen`-Umbau (`db/REGISTER.md:710`, „Geld kommt an / nicht an").
- Abhängigkeit von Melih (SQL-Editor / `sql-melih/`): der Supabase-MCP ist nicht autorisiert, und dieser Kanal blockierte am 09.09. schon einmal drei Tage (`db/REGISTER.md:517`).
- Bis Lieferung 2 live ist, findet die IK-Suche weiterhin nichts (Beta-1 bleibt in diesem Punkt blockiert) — Namensauswahl setzt außerdem keine IK mehr vor.
- Kassenname aus der View statt aus `krankenkassen`: die Häufigkeitsliste (`ladeKassen`) kann bei abweichender Schreibweise für dieselbe Kasse zersplittern. Akzeptiert: Der angezeigte Name muss zur gewählten IK gehören (`gkv-302`).

## Uzlaşma

`gkv-302`: kein Veto · `podoloji`, `muhalif`, `db-ustasi`, `gkv-302`: A · Option B nicht als Dauerlösung · Autofill-Stilllegung gehört **ins selbe Ticket** (nicht später) · nur bei reinen Ziffern suchen, ab 4 · Freitext für Nicht-GKV bleibt · `krankenkassen.ik_number` wird nicht durchsucht · keine anon-Rechte auf die View · Karten-IK-Erfassung ist ein eigenes Ticket.

## Anlaşmazlık

- **`deger-mi` (🔧 KÜÇÜLT):** statt A jetzt nur exakte 9-Ziffern-Prüfung per `.eq('ik', …)` (3–5 h, keine View, Rechenzentrums-Frage entfällt); A erst, wenn eine zweite Stelle „IK aus Namen finden" braucht. **Chairman-Entscheidung gegen `deger-mi`:** vier Mitglieder wählen A; die exakte Prüfung bräuchte für den Rechenzentrums-Filter zwei Abfragen (`kostentraeger` + `kostentraeger_annahmestellen`) und liefert keine Zwischentreffer beim Tippen. **Fallback bleibt gültig:** falls die View nicht bald live gehen kann, ist die exakte 9-Ziffern-Prüfung ohne Migration der kleinere Weg.
- **Name im Feld:** `deger-mi`/`muhalif` → Name aus `krankenkassen` belassen, nur IK setzen; `gkv-302` → Name aus `kostentraeger`. **Entscheidung: Name aus der View** (angezeigter Name gehört zur gewählten IK); der Namensvergleich in `dashboard.js:15853` stirbt mit Lieferung 1 ohnehin.

## Kör noktalar

- **Zwei Autofill-Wege** statt einem (`muhalif`): `dashboard.js:15854` und `krankenkasse-suche.js:167` — die Karte des Tickets nannte nur einen.
- **PostgREST-Zeilenlimit** (`muhalif`): `kostentraeger` hat 1.043 echte Zeilen; ein Client-Laden ohne Limit-Handling liefert typischerweise 1.000 Zeilen ohne Fehler. Das trifft vermutlich auch das bestehende `ladeKostentraegerNamen()` (`dashboard.js:17345`, `_abState.kkMap`). **Nicht verifiziert** (Live-Einstellung nicht prüfbar).
- **`gkv-302` widersprach sich selbst:** Im ersten Bericht standen die Rechenzentren mit `payer_type='gkv'` in der Tabelle, in der Konsey-Runde sollte `payer_type='gkv'` sie ausschließen. Der Seed bestätigt den ersten Bericht (alle 1.043 Zeilen sind `gkv`). Entscheidend ist die VKG-Bedingung.
- **Nicht verifiziert:** Dass keine der ~82 Nicht-Kassen als `kostentraeger_ik` in `kostentraeger_annahmestellen` vorkommt (die View würde sie sonst durchlassen). → Vorab-SELECT durch Melih: Zeilenzahl der View (~961 erwartet) und kein Treffer für „gkv informatik", „IQVIA", „Medent", „Rezeptprüfstelle".
- **Rückwirkung im Formular** (`fonksiyon-ustasi`): `verordnung-maske.js:419` schreibt nach dem Speichern die **aufgelöste** IK ins Feld zurück; `verordnung-detail.js:532/646` zeigen „IK des Kostenträgers". Der Podologe sieht also auch später nicht die abgetippte Karten-IK — deshalb die sichtbare Auflösungszeile.
- **i18n vs. Größenkappe:** Die Regel „Text im `dashboard.js`-Wörterbuch (de/en/tr)" kollidiert mit „`dashboard.js` wächst nicht". Der Builder muss klären, wie Module ihre Texte führen.
- **Deploy-Reihenfolge** (`db-ustasi`): Wir arbeiten direkt auf `main`, jeder Zwischenstand ist live. Das Frontend muss eine fehlende View abfangen (Warnung, Namenssuche unberührt), nicht daran zerbrechen. Kopfkommentar der Migration: „SaaS: angewandt <Datum>" (Box-Migrationen 0006–0015/0036/0037 wurden nie auf SaaS angewandt, das fiel schon einmal wochenlang nicht auf).

## Uygulama — builder'a

- [ ] **Lieferung 1:** Autofill an beiden Stellen stilllegen (`dashboard.js:15853-15854`, `module/krankenkasse-suche.js:167`), „kanonische IK"-Kommentar löschen, `dashboard.js` darf nicht wachsen, Bauart-Test `krankenkasse-suche.test.js` Z. 80-85 (`!ikEl.value`) anpassen — karmaşıklık: K2
- [ ] Migration `00NN_kostentraeger_auswahl.sql` (nächste freie Nummer im Verzeichnis prüfen): View wie oben, `GRANT SELECT` nur an `authenticated`, Kopfkommentar „SaaS: angewandt" — karmaşıklık: K3
- [ ] Im selben Commit: `db/SCHEMA.sql` (VIEWS), `SCHEMA-RLS.sql`-Kopf, `db/REGISTER.md`, `api-backend/db/erwartete-zaehler.json`, `node tools/tabellenkarte.mjs`; prüfen, ob `tools/check-tabellen-register.sh` Views als „ohne Register" meldet — karmaşıklık: K1
- [ ] **Melih** führt Vorab-SELECT aus und wendet die View live an, **bevor** das Frontend deployt wird — Koordination, kein Code
- [ ] **Lieferung 2:** reine Suchfunktion (nur Ziffern, ≥ 4, Präfix, nach IK sortiert, Limit) — **Test zuerst** —, mandantenfreier Cache, der von `verwerfeKassenCache()` (`dashboard.js:9203`) **nicht** geleert wird; Auswahl setzt Name + `COALESCE(abrechnender_kt_ik, ik)`; fehlende View wird abgefangen — karmaşıklık: K3
- [ ] Sichtbare Auflösungszeile „Karte X → rechnet ab bei Y" (de/en/tr) unter dem Feld — karmaşıklık: K2
- [ ] Freitext ohne Treffer möglich lassen (Privat/Selbstzahler/BG/Beihilfe) — Test dafür — karmaşıklık: K1
- [ ] Nach dem Bau: `fonksiyon-ustasi` melden (Niyet + Ort), `node tools/funktionskarte.mjs`

## Backlog (karara dahil DEĞİL)

- Karten-IK in `prescriptions.krankenkasse_ik` erfassen (zweites Feld; `wissensbank/SPEC-RULES.md:459-470` ❌; `abrechnung.routes.js:353`, `:2123`; `dta/builder.js:106`, `:234`) + Karten-IK auf dem Begleitzettel
- `das_ik`-Rest an `abrechnung.routes.js:1999`, `:2203` → `kostentraeger_annahmestellen`
- `rezept-felder.js:55`: `.limit(1)` ohne `.order()` (AOK Niedersachsen ~50 IKs)
- Bereinigung/Entfernung `krankenkassen.ik_number` (#301)
- Prüfen, ob `ladeKostentraegerNamen()` (`dashboard.js:17345`) durch das PostgREST-Zeilenlimit Zeilen verliert
- Kassen mit ausgewähltem Namen (ohne IK-Suche) per View auf die richtige IK auflösen
- Parser liest `FKT` nicht (2 Stornierungssätze ungefiltert in `kostentraeger`)
- Veraltete Fundstellen: `db/REGISTER.md:832` (`loadKkList()` real `dashboard.js:17229`), `db/SCHEMA.sql:1992-1994` (`podNewKk`)
- Tippfehler-Schutz per IK-Prüfziffer (Quelle in der Wissensbank fehlt)

## Sert veto varsa

Keines. `gkv-302`: ✅ A, ⚠️ B (nur mit Prüfung beim Speichern), ⚠️ C (nur wenn die Suche unmittelbar folgt). `legal-de` nicht gesessen. Bedingung von `gkv-302`, hier übernommen: der View-Filter darf sich **nicht** allein auf `payer_type` stützen.

## Nachtrag (21.09.2026, nach der Runde — Entscheidungen Melih und Umsetzung)

- **Lieferung 1 gestrichen** (Prämisse durch #301 überholt, siehe Kasten oben). Lieferung 2 unverändert gültig.
- **Suche ab 3 Ziffern statt 4** (Entscheidung Melih; `gkv-302` hatte 4 empfohlen). Am Seed gemessen: größter Dreier-Präfix „108" 189 Treffer (in der View 155), größter Vierer-Präfix „1080" 86. Deshalb Limit 300 statt 100.
- **Keine Namenssuche bei IK-Eingabe; Ziffern ohne Auswahl → Freitext; gefülltes IK-Feld wird nicht überschrieben, die Abweichung wird sichtbar.**
- **Kein Cache:** Die Suche fragt die View pro Eingabe serverseitig nach Präfix ab (`like 'ziffern%'`, `order ik`, `limit 300`) statt die Tabelle zu laden. Damit entfallen mandantenfreier Cache, `verwerfeKassenCache()`-Sorge und das vermutete PostgREST-Zeilenlimit für diesen Weg.
- **Zahl korrigiert:** „~961 erwartet" war die Zahl der Annahmestellen-IKs. Der Filter gibt am Seed **893** Zeilen (82 ohne VKG, 68 abgelaufen), 0 bekannte Rechenzentren. Rund ein Dutzend der 82 trägt einen schlichten Kassennamen (AOK NORDWEST, DAK-Gesundheit ×2, Techniker Krankenkasse …) — dort gibt es keinen Treffer, aber auch keine falschen Daten. Offene Frage an `gkv-302`.
- **`db-ustasi` hat das SQL zweitgeprüft:** `service_role` fehlte im `REVOKE` (Baseline-Sichten tragen `GRANT ALL … TO service_role`) — behoben; `active IS TRUE` statt `active`; Hinweis auf still verlorene Zeilen bei verschärfter RLS im Kopf. Das SQL wurde **nirgends ausgeführt** (kein Postgres lokal).
- **Texte de/en/tr im Modul statt im `dashboard.js`-Wörterbuch** (Größenkappe; Sprache aus `<html lang>`). Damit ist der in „Kör noktalar" genannte Konflikt aufgelöst.
- **Ein Race auf dem gemeinsamen Git-Index** brachte den ersten Teil des Codes in den #301-Commit `fa86f5b`. Historie nicht umgeschrieben.
- **Prüfungen:** `npm test` 1030 / 344 / 25 grün; `npm run probe`: 90/90 Module laden im Browser, 274 ✓, 0 ✗ (Konsole: nur der erwartbare `/api/config`-500 des lokalen Dev-Servers ohne Schlüssel). **Nicht geprüft:** das Verhalten im echten Browser mit Login, die Live-DB.
- **Bleibt offen:** Migration live anwenden (Melih; vorher die Abfrage aus dem Dateikopf), danach Dump/`SCHEMA.sql` (zweiter Commit, `SKIP_MIGRATION_GATE=1`) und der Vermerk „SaaS: angewandt"; Karten-IK in `krankenkasse_ik` erfassen; `das_ik`-Rest. (Die Namensauflösung in `rezept-felder.js` ist in #301 erledigt, `fa86f5b`.)
