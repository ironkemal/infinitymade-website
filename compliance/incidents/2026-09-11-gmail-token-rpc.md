# Incident 2026-09-11 — Gmail-Token-RPCs ohne Rechteprüfung (anon-EXECUTE)

## Grunddaten
- **Entdeckt:** 29.08.2026, durch `guvenlik`-Agenten (`mcp__supabase__get_advisors` +
  unabhängige Prüfung: `anon_security_definer_function_executable`) — dokumentiert in
  `fortschritte/2026-08-29.md:176–247`.
- **Eingetreten (geschätzt):** ab 11.06.2026 — Migration `clear_plaintext_gmail_tokens`
  verschob die Gmail-Refresh-Tokens aus dem Klartext in `vault.decrypted_secrets` und
  legte dabei `get_gmail_token`/`set_gmail_token`/`clear_gmail_token` als
  `SECURITY DEFINER` an, ohne `REVOKE EXECUTE … FROM PUBLIC` — Postgres-Default
  `EXECUTE` für `PUBLIC` (also `anon`+`authenticated`) blieb stehen.
- **Geschlossen:** 11.09.2026, 10:5x UTC+2 — Migration
  `api-backend/db/migrations/0001_gmail_token_rpc_revoke.sql` (Commit `16c6f1b`),
  per MCP in der Cloud angewandt und gegen die lokale On-Prem-Testbox gefahren.

## Beschreibung
`public.get_gmail_token(p_user_id uuid)` (und `set_`/`clear_`) waren `SECURITY DEFINER`,
lasen/schrieben `vault.decrypted_secrets` und enthielten **keine** `auth.uid()`-Prüfung
im Funktionskörper. Supabase veröffentlicht `public`-Funktionen unter
`/rest/v1/rpc/<name>`; `EXECUTE` war für `anon` **und** `authenticated` gesetzt. Ein
Aufrufer mit einer Owner-UUID (nicht geheim: `profiles` ist bei gesetztem
`booking_slug` anonym lesbar) hätte das Gmail-Refresh-Token einer fremden Praxis
abfragen bzw. löschen/überschreiben können.

Entdeckt beim Aufbau des `guvenlik`-Sicherheitsregisters (29.08.2026), damals als
S-01/S-02 dokumentiert. Die dort selbst verlangte `legal-de`-Bewertung ("falls
Zugriff stattgefunden hat, greift Art. 33 DSGVO") wurde nicht sofort eingeholt —
das ist der Verfahrensfehler dieses Falls (siehe Lessons Learned), nicht der Fund
selbst. Nachgeholt am 11.09.2026, technische Behebung am selben Tag.

**Wichtigste Tatsache für diesen Fall (Kemal, 12.09.2026 ausdrücklich bestätigt):**
Praxura hat zu keinem Zeitpunkt bis heute einen realen zahlenden/produktiven Kunden
gehabt. Alle 5 betroffenen `vault`-Einträge sind interne Test-/Entwicklungskonten.
Es gibt keinen realen Betroffenen — die DSGVO-Prüfung unten wird trotzdem in voller
Tiefe dokumentiert, weil dieselbe Funktionsklasse (`SECURITY DEFINER` ohne
`auth.uid()`-Check) beim ersten realen Kunden erneut auftreten kann und dann sofort
relevant wird.

## Betroffene Systeme
- [x] Supabase (Datenbank / Auth)
- [ ] Hetzner VPS (calendar-api, n8n)
- [ ] Vercel (Frontend / Serverless)
- [ ] Stripe
- [x] Google / OAuth (Gmail-Refresh-Token, Scope `gmail.send`)
- [ ] Sentry

## Betroffene Personen
- **Anzahl:** 0 reale Personen. `vault.secrets` enthält 5 Einträge mit
  Namensmuster `gmail_token:*`, Stand 11.09.2026 — **Kemal am 12.09.2026
  ausdrücklich bestätigt: kein einziger davon gehört zu einem echten Kunden.**
  `profiles.plan_status='active'` zeigt zwar 4 Zeilen (DB-Check 11.09.2026),
  das sind interne/Test-Accounts (manuell gesetzter Plan-Status zu Testzwecken —
  kein Zahlungs-/Nutzungsbeleg eines echten Praxisbetriebs). Praxura ist zum
  Zeitpunkt dieses Funds noch **vor
  dem ersten realen Kunden**; die gesamte Datenbasis ist Test-/Entwicklungsdaten,
  die ohnehin in Kürze geleert werden (Kemal, mündlich).
- **Gruppen:** [ ] Patienten  [ ] Praxisinhaber (real)  [ ] Mitarbeiter — **keine
  reale Personengruppe betroffen, nur interne Testkonten**

## Datenkategorien
- [ ] Kontaktdaten (Name, E-Mail, Telefon)
- [ ] Gesundheitsdaten (KVNR, Diagnose, Verordnung)
- [ ] Zahlungsdaten
- [x] Credentials / Tokens (Google-OAuth-Refresh-Token, Scope `gmail.send`)

## Risikobewertung
- **Wahrscheinlichkeit Schaden:** [x] keine — **kein Betroffener existiert.** Praxura
  hatte zum Zeitpunkt des Funds (und hat bis heute) keinen einzigen realen Kunden;
  alle 5 `vault`-Einträge sind Test-/Entwicklungskonten (von Kemal am 12.09.2026
  bestätigt). Ohne realen Data Subject ist die DSGVO-Frage bereits auf dieser
  Stufe erledigt — die folgende Begründung (technische Nicht-Verwertbarkeit) wird
  nur nachrichtlich mitgeführt, weil sie **zusätzlich** greifen würde, sobald der
  erste echte Kunde da ist und dieselbe Funktionsklasse erneut offen wäre:
  Refresh-Token allein ist für einen confidential OAuth-Client ohne
  `GOOGLE_CLIENT_SECRET` nicht einlösbar; dieses Secret war zu keinem Zeitpunkt im
  Repository — der Leak vom 05.08.2026 betraf Fal-AI-Key, n8n-Key und ein
  Testpasswort, nicht Google. Scope ist ausschließlich `gmail.send`, kein
  Postfachzugriff möglich, selbst mit gültigem Access-Token.
  ⚠️ **Offene technische Verifikation** (jetzt ohne Zeitdruck, da kein Kunde
  betroffen): ob Google bei diesem Client-Typ den Secret-Check beim Refresh-Grant
  tatsächlich erzwingt, wurde noch nicht mit einem echten Aufruf bestätigt.)
- **Meldepflicht Art. 33:** [x] Nein — Begründung: keine nachweisbare „Verletzung" i. S. d.
  Art. 4 Nr. 12 DSGVO (Zugänglichkeit ohne belegten Zugriff, Darlegungslast Art. 5 Abs. 2;
  EDSA-Leitlinien 9/2022 v2.0 vom 28.03.2023 verlangen für die Kenntnis „hinreichenden
  Grad an Gewissheit" einer Kompromittierung). Zusätzlich greift die Ausnahme Art. 33
  Abs. 1 Hs. 2 („voraussichtlich kein Risiko"), gestützt auf die technische
  Nicht-Verwertbarkeit des Tokens ohne Client-Secret.
- **Informationspflicht Art. 34:** [x] Nein — selbe Begründung; kein Auslöser erreicht.

## Ergriffene Maßnahmen
- [x] `api-backend/db/migrations/0001_gmail_token_rpc_revoke.sql` — `REVOKE EXECUTE
  … FROM PUBLIC, anon, authenticated` für alle drei Funktionen, 11.09.2026, Cloud + Box.
- [x] `db/SCHEMA-RLS.sql` nachgezogen, `guvenlik/REGISTER.md` S-01/S-02/S-19 →
  Behoben (gitignored, lokale Akte).
- [ ] **Offen, ohne Zeitdruck:** technische Bestätigung, dass ein Refresh-Grant ohne
  `GOOGLE_CLIENT_SECRET` mit `401 invalid_client` scheitert — reines technisches
  Interesse für die nächste Instanz dieser Funktionsklasse, keine Kunden-Relevanz
  mehr (alle 5 Tokens sind Testkonten).
- [x] Supabase Edge-Logs (11.09.2026, letzte 24h, einziges verfügbares Fenster)
  auf `gmail_token` durchsucht — **keine Treffer.** Schwacher Beleg: die
  Log-Retention deckt das eigentliche Vorfallsfenster (11.06.–29.08.2026) nicht
  ab, sagt also nichts über einen historischen Zugriff aus. Bestätigt nur, dass
  seit Behebung (11.09.2026) kein Aufruf mehr ankommt.
- [x] **Entfällt:** Token-Widerruf + Kundeninformation — es gibt keinen Kunden zu
  informieren. Alle 5 Testkonten werden ohnehin in Kürze mit der gesamten
  Test-/Entwicklungsdatenbasis geleert (Kemal, 12.09.2026). Der vorbereitete
  Kundenbrief bleibt für den Tag relevant, an dem diese Funktionsklasse erneut
  betroffen ist UND ein realer Kunde existiert — nicht für heute.
- [x] `compliance/LEGAL_DECISIONS.md`-Eintrag geschrieben (11.09.2026).

## Meldungen
- **Behörde:** [ ] LDI NRW — nicht ausgelöst
- **Auftraggeber (Praxen):** [ ] entfällt — kein realer Kunde vorhanden
- **Betroffene Personen:** [ ] entfällt — kein realer Betroffener vorhanden

## Lessons Learned
**Ursache:** `CREATE FUNCTION` vergibt in Postgres per Default `EXECUTE` an `PUBLIC`.
Bei `SECURITY DEFINER`-Funktionen, die aus `vault` lesen oder schreiben, muss das
`REVOKE` **im selben Statement/derselben Migration** stehen wie das `CREATE` — nicht
als Nachtrag. Die Klasse ist real: derselbe Fund trat am selben Tag ein zweites Mal
auf (`naechste_nummer`/`naechste_verordnungsnummer`, S-24, Migration `0002`).

**Verfahrensfehler:** zwischen Fund (29.08.2026) und `legal-de`-Bewertung (11.09.2026)
lagen 13 Tage, obwohl der Fund selbst genau diese Bewertung verlangte. Ohne Folgen,
weil das Ergebnis „keine Meldepflicht" war — bei einem Fund mit tatsächlicher
Meldepflicht hätte dieselbe Verzögerung die 72-Stunden-Frist gerissen und würde als
erschwerender Umstand nach Art. 83 Abs. 2 lit. c/h zählen.

**Änderung:** Neue Arbeitsregel — sobald `guvenlik` einen Fund mit Credential- oder
PHI-Bezug meldet, wird `legal-de` innerhalb von 72 Stunden konsultiert, mit Datum
im Register vermerkt. Kein neues Dokument, keine neue Prüfliste — eine Regel.
