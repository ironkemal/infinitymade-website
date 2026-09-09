-- ===========================================================================
-- VORBEREITET, NICHT ANGEWENDET.
-- Migrationsname: abrechnung_zeile_und_zahlung
-- Erzeugt: 09.09.2026 · Entwurf db-ustasi vom 08.09.2026 (ABRECHNUNG_BILDSCHIRM_PLAN.md
-- Anhang A), hier gegen db/SCHEMA.sql + SCHEMA-RLS.sql nachgezogen.
-- Anwendung erst nach ausdrücklicher Freigabe (Kemal).
-- ===========================================================================
--
-- Zweck (Kurzfassung; die lange Begründung steht im Plan, Abschnitt 4):
--
--   abrechnung_zeile    Was in EINER Datei tatsächlich an die Kasse ging —
--                       eingefroren. Bisher wurde die Zeilenliste aus
--                       `prescriptions.abrechnung_id` abgeleitet; sobald ein
--                       abgesetztes Rezept korrigiert und neu eingereicht wird,
--                       wandert die id mit und die Zeile verschwindet aus der
--                       alten Datei. Der Anwender sähe in „10 eingereicht" neun
--                       Zeilen, ohne Hinweis.
--
--   abrechnung_zahlung  Geldeingang je Sammelabrechnung, tranchenweise.
--                       `abrechnung.paid_at` und `status='paid'` hat bis heute
--                       NIEMAND geschrieben — Zahlungsverfolgung existierte
--                       faktisch nicht. Zwei Spalten reichen nicht: die Kasse
--                       zahlt in Raten, eine Datei trägt seit 07.09.2026 mehrere
--                       Gesamtrechnungen, und ein UPDATE auf einen Summenwert
--                       löscht den vorherigen Stand (§ 146 Abs. 4 AO).
--
-- ── Abweichungen vom Entwurf im Plan (Anhang A), mit Begründung ────────────
--
--  1. CHECK `abrechnung_zeile_absetzung_betrag` lässt `herkunft='rekonstruiert'`
--     ausdrücklich zu. Rekonstruierte Zeilen tragen `netto_eur = 0` (der
--     eingefrorene Betrag existiert nicht, siehe Abschnitt 6 unten) —
--     `absetzung_eur <= netto_eur` hätte dort jede Absetzungserfassung gesperrt.
--
--  2. Der Rückstand (Abschnitt 6) ist eingebaut, nicht als eigene Migration
--     nachgereicht. Grundlage: Entscheidung Kemal 08.09.2026 Nr. 3 — 12 Zeilen
--     in `abrechnung`, alle bereits eingereicht, zusammen 27 Verordnungen,
--     Zeitraum 05.01.2026–03.06.2026. Klein genug, um risikolos mitzulaufen.
--
--  3. Policies laufen `TO authenticated`. Der Hausbrauch (belegliste,
--     zuzahlung_korrekturen) lässt die Rolle offen; `kostentraeger_annahmestellen`
--     (06.09.2026) schränkt bereits ein. Eine Zeile dieser Tabellen ist
--     Patientendatum — `anon` hat hier nichts verloren.
--
--  4. Die beiden Trigger-Funktionen tragen `security invoker` und
--     `set search_path = public`. Der Hausbrauch lässt beides weg; der
--     Supabase-Advisor meldet genau das als „function_search_path_mutable".
--
-- ── ⚠️ Bekannter Widerspruch, hier NICHT gelöst ────────────────────────────
--
--  `abrechnung.owner_id -> auth.users(id) ON DELETE CASCADE` (db/SCHEMA.sql:155)
--  gegen `db/REGISTER.md`, das `abrechnung` bewusst nicht in die Löschliste
--  stellt (§302/§304 SGB V). Diese Migration setzt `abrechnung_zeile.abrechnung_id
--  ON DELETE RESTRICT` — damit wird der Widerspruch SICHTBAR statt still:
--  `api/dsgvo.js:373` löscht am Ende den Auth-Benutzer, und die Kaskade würde
--  die §302-Historie mitnehmen. Ab jetzt scheitert sie stattdessen mit einer
--  Fremdschlüsselverletzung. Dasselbe gilt heute schon über
--  `belegliste.owner_id -> profiles(id) ON DELETE RESTRICT`.
--  Das ist Nebenbefund 4 im Plan (Abschnitt 7) und gehört `legal-de` + `guvenlik`
--  vorgelegt, nicht hier entschieden.

begin;

-- ─────────────────────────────────────────────────────────────────────────
-- 1) Eingereichte Zeilen — Schnappschuss, kein Zeiger auf lebende Daten.
--
--    NICHT `abrechnung_position` nennen: „Position" heisst in diesem Code die
--    Positionsnummer/HPNR (`heilmittel_position`, `services.gkv_position_nr`,
--    `GET /positions`). Der Name hat schon einmal eine Suche in die Irre geführt.
-- ─────────────────────────────────────────────────────────────────────────
create table public.abrechnung_zeile (
  id                     uuid primary key default gen_random_uuid(),
  abrechnung_id          uuid not null references public.abrechnung(id)    on delete restrict,
  owner_id               uuid not null references public.profiles(id)      on delete restrict,
  business_id            uuid          references public.businesses(id)    on delete set null,
  prescription_id        uuid          references public.prescriptions(id) on delete set null,

  -- Gesamtrechnungs-Gruppe innerhalb der Datei (dta/builder.js -> gruppen[]).
  -- Sie entsteht seit 07.09.2026 im DTA, wird in den Begleitzettel gedruckt und
  -- lag bisher nur als HTML im Storage — also nicht abfragbar.
  kostentraeger_ik       text not null,
  karten_ik              text,
  einzel_rechnungsnummer text not null,
  sort_order             smallint not null default 0,

  -- eingefrorener Urbeleg
  belegnummer            text,
  patient_name           text,
  versichertennummer     text,
  verordnungsdatum       date,
  therapie_bereich       text,
  heilmittel_position    text,
  anzahl_einheiten       integer,
  -- [{datum, positionsnummer, anzahl, einzelbetrag}] — VKZ 04 arbeitet auf
  -- Positionsebene („nicht zuvor vergütete Positionen", Anlage 1 TP5 V21 §7.4.3).
  -- Gleiches Muster wie invoices.line_items.
  leistungen             jsonb not null default '[]'::jsonb,
  brutto_eur             numeric(10,2) not null default 0,
  zuzahlung_eur          numeric(10,2) not null default 0,
  netto_eur              numeric(10,2) not null default 0,     -- = Soll gegen die Kasse

  -- Rückmeldeachse: bleibt offen
  status                 text not null default 'eingereicht',
  absetzung_eur          numeric(10,2) not null default 0,
  absetzung_grund        text,
  absetzung_am           date,

  herkunft               text not null default 'einreichung',
  created_at             timestamptz not null default timezone('utc', now()),
  updated_at             timestamptz not null default timezone('utc', now()),

  constraint abrechnung_zeile_status_check
    check (status in ('eingereicht','akzeptiert','abgesetzt','teilabgesetzt','nachgereicht')),
  constraint abrechnung_zeile_herkunft_check
    check (herkunft in ('einreichung','rekonstruiert')),
  -- Siehe Abweichung 1 im Kopf.
  constraint abrechnung_zeile_absetzung_betrag
    check (absetzung_eur >= 0 and (herkunft = 'rekonstruiert' or absetzung_eur <= netto_eur)),
  constraint abrechnung_zeile_absetzung_grund
    check (absetzung_eur = 0 or btrim(coalesce(absetzung_grund,'')) <> '')
);

create unique index abrechnung_zeile_uniq
  on public.abrechnung_zeile (abrechnung_id, prescription_id) where prescription_id is not null;
create index idx_abrechnung_zeile_datei
  on public.abrechnung_zeile (abrechnung_id, einzel_rechnungsnummer, sort_order);
create index idx_abrechnung_zeile_rx
  on public.abrechnung_zeile (prescription_id) where prescription_id is not null;
create index idx_abrechnung_zeile_beleg
  on public.abrechnung_zeile (owner_id, belegnummer);

-- ─────────────────────────────────────────────────────────────────────────
-- 2) Zahlungseingänge — append-only, wie belegliste / zuzahlung_korrekturen.
--
--    ⛔ KEIN Beleg in `belegliste`. Kassengeld ist eine Bankbewegung, kein
--    Kassenbuchvorgang: `belegliste.type` ist patientenseitig, und
--    statistik.routes.js:188-205 summiert die Belegliste UNGEFILTERT in die
--    Umsatzreihe, während der GKV-Umsatz dort bereits aus `abrechnung.total_eur`
--    kommt — ein Beleg hier zählte den Umsatz doppelt.
-- ─────────────────────────────────────────────────────────────────────────
create table public.abrechnung_zahlung (
  id                     uuid primary key default gen_random_uuid(),
  abrechnung_id          uuid not null references public.abrechnung(id) on delete restrict,
  owner_id               uuid not null references public.profiles(id)   on delete restrict,
  business_id            uuid          references public.businesses(id) on delete set null,
  einzel_rechnungsnummer text,                       -- NULL = Zahlung für die ganze Datei
  art                    text not null default 'zahlung',
  betrag_eur             numeric(10,2) not null,     -- negativ erlaubt (Rücklastschrift/Korrektur)
  datum                  date not null,              -- Wertstellung laut Kontoauszug
  zahlungsavis           text,
  notiz                  text,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default timezone('utc', now()),

  constraint abrechnung_zahlung_art_check
    check (art in ('zahlung','ruecklastschrift','abschreibung','korrektur')),
  constraint abrechnung_zahlung_betrag_check check (betrag_eur <> 0),
  -- „Abschliessen" ist kein Status-Flip, sondern eine Zeile mit Pflichtbegründung.
  -- So bleibt der Grund für fehlendes Geld erhalten.
  constraint abrechnung_zahlung_grund_check
    check (art = 'zahlung' or length(btrim(coalesce(notiz,''))) >= 3)
);

create index idx_abrechnung_zahlung_datei on public.abrechnung_zahlung (abrechnung_id, datum);
create index idx_abrechnung_zahlung_owner on public.abrechnung_zahlung (owner_id, datum desc);

-- ─────────────────────────────────────────────────────────────────────────
-- 3) GoBD-Sperren. Eigene Funktionen je Tabelle, damit die Fehlermeldung den
--    richtigen Korrekturweg nennt (Muster: prevent_belegliste_mod()).
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.fn_abrechnung_zeile_festschreibung()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Eine eingereichte Abrechnungszeile kann nicht geloescht werden (GoBD, §302 SGB V). Korrektur: neue Einreichung (VKZ 04).';
  end if;

  if new.abrechnung_id          is distinct from old.abrechnung_id
  or new.prescription_id        is distinct from old.prescription_id
  or new.kostentraeger_ik       is distinct from old.kostentraeger_ik
  or new.karten_ik              is distinct from old.karten_ik
  or new.einzel_rechnungsnummer is distinct from old.einzel_rechnungsnummer
  or new.belegnummer            is distinct from old.belegnummer
  or new.verordnungsdatum       is distinct from old.verordnungsdatum
  or new.heilmittel_position    is distinct from old.heilmittel_position
  or new.anzahl_einheiten       is distinct from old.anzahl_einheiten
  or new.leistungen             is distinct from old.leistungen
  or new.brutto_eur             is distinct from old.brutto_eur
  or new.zuzahlung_eur          is distinct from old.zuzahlung_eur
  or new.netto_eur              is distinct from old.netto_eur
  or new.herkunft               is distinct from old.herkunft
  then
    raise exception 'Eingereichte Abrechnungszeile ist festgeschrieben (GoBD). Offen bleiben nur status, absetzung_* und die Anonymisierung.';
  end if;

  -- DSGVO Art. 17: Klarname darf GENULLT, aber nie geaendert werden.
  -- Bewusst anders als invoice_festschreibung(), das die Anonymisierung
  -- blockiert und damit die ganze Loeschkette anhaelt (api/dsgvo.js Kopf).
  if new.patient_name is not null and new.patient_name is distinct from old.patient_name then
    raise exception 'patient_name darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;
  if new.versichertennummer is not null and new.versichertennummer is distinct from old.versichertennummer then
    raise exception 'versichertennummer darf nur auf NULL gesetzt werden (Anonymisierung).';
  end if;

  new.updated_at := timezone('utc', now());
  return new;
end $$;

create trigger trg_abrechnung_zeile_festschreibung
  before update or delete on public.abrechnung_zeile
  for each row execute function public.fn_abrechnung_zeile_festschreibung();

create or replace function public.prevent_abrechnung_zahlung_mod()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  raise exception 'Zahlungseingaenge sind unveraenderlich (GoBD). Korrektur: neue Zeile mit art=''korrektur'' und negativem Betrag.';
end $$;

create trigger trg_prevent_abrechnung_zahlung_mod
  before update or delete on public.abrechnung_zahlung
  for each row execute function public.prevent_abrechnung_zahlung_mod();

-- ─────────────────────────────────────────────────────────────────────────
-- 4) „bezahlt" hat EINE Definition. Toleranz 0,005 stammt wörtlich aus
--    billing/zuzahlung/bezahlt.js -> istZuzahlungBezahlt().
--
--    Absetzungen werden vom Soll ABGEZOGEN, um „bezahlt" zu bestimmen — aber
--    im Bildschirm bleiben sie sichtbar (Eingereicht · Abgesetzt · Bezahlt ·
--    Offen), weil genau das der Betrag ist, den VKZ 04 zurückholt.
-- ─────────────────────────────────────────────────────────────────────────
create or replace function public.fn_abrechnung_zahlung_status()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_soll numeric; v_abg numeric; v_bez numeric;
begin
  select coalesce(sum(netto_eur),0), coalesce(sum(absetzung_eur),0)
    into v_soll, v_abg from public.abrechnung_zeile where abrechnung_id = new.abrechnung_id;
  -- Kein Zeilenbetrag da (rekonstruierte Altdatei, siehe 6) -> Kopfsumme.
  if v_soll = 0 then
    select coalesce(total_eur,0) - coalesce(zuzahlung_total,0)
      into v_soll from public.abrechnung where id = new.abrechnung_id;
    v_abg := 0;
  end if;
  select coalesce(sum(betrag_eur),0)
    into v_bez from public.abrechnung_zahlung where abrechnung_id = new.abrechnung_id;

  if v_bez >= (v_soll - v_abg) - 0.005 then
    update public.abrechnung
       set status = 'paid', paid_at = new.datum::timestamptz
     where id = new.abrechnung_id and status <> 'paid';
  end if;
  return new;
end $$;

create trigger trg_abrechnung_zahlung_status
  after insert on public.abrechnung_zahlung
  for each row execute function public.fn_abrechnung_zahlung_status();

-- ─────────────────────────────────────────────────────────────────────────
-- 5) RLS — belegliste-Muster: SELECT + INSERT, KEIN UPDATE/DELETE.
--    Zwei Riegel, weil ein Policy-Fehler sonst still das Protokoll öffnet;
--    der service_role-Schlüssel im Backend wird ohnehin nur vom Trigger gebremst.
-- ─────────────────────────────────────────────────────────────────────────
alter table public.abrechnung_zeile   enable row level security;
alter table public.abrechnung_zahlung enable row level security;

drop policy if exists "Abrechnungszeile select scoping" on public.abrechnung_zeile;
create policy "Abrechnungszeile select scoping" on public.abrechnung_zeile
  for select to authenticated
  using (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zeile.owner_id));

drop policy if exists "Abrechnungszeile insert scoping" on public.abrechnung_zeile;
create policy "Abrechnungszeile insert scoping" on public.abrechnung_zeile
  for insert to authenticated
  with check (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zeile.owner_id));

drop policy if exists "Abrechnungszahlung select scoping" on public.abrechnung_zahlung;
create policy "Abrechnungszahlung select scoping" on public.abrechnung_zahlung
  for select to authenticated
  using (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zahlung.owner_id));

drop policy if exists "Abrechnungszahlung insert scoping" on public.abrechnung_zahlung;
create policy "Abrechnungszahlung insert scoping" on public.abrechnung_zahlung
  for insert to authenticated
  with check (auth.uid() = owner_id
      or auth.uid() in (select id from public.profiles where owner_id = abrechnung_zahlung.owner_id));

-- Kein `abrechnung_saldo`-View in v1. In Postgres läuft ein View standardmässig
-- mit den Rechten des Erstellers; wird `with (security_invoker = true)` vergessen,
-- ist die Mandantengrenze offen — und im Repo benutzt heute KEIN View
-- `security_invoker`. Die Liste ist auf 50 Dateien begrenzt: die Summe in der
-- Route oder im Browser zu rechnen ist billiger und sicherer.

-- ─────────────────────────────────────────────────────────────────────────
-- 6) Rückstand: Zeilen für die 12 bestehenden Dateien rekonstruieren.
--
--    ⚠️ Das ist NICHT das eingefrorene Original. Rekonstruiert wird aus der
--    LEBENDEN Verordnung (`prescriptions.abrechnung_id`) — genau die Quelle,
--    deren Unzuverlässigkeit der Anlass für diese Tabelle ist. Deshalb:
--      · `herkunft = 'rekonstruiert'` — im Bildschirm sichtbar zu machen,
--      · `brutto/zuzahlung/netto = 0` statt heutiger Preise. Ein heutiger Preis
--        unter dem Datum von gestern wäre die teurere Lüge; die Dateisumme steht
--        weiterhin richtig im Kopf (`abrechnung.total_eur`), und
--        fn_abrechnung_zahlung_status() fällt genau dafür auf den Kopf zurück.
--      · `einzel_rechnungsnummer = '0'` — bis 07.09.2026 hat jede Datei genau
--        eine Gesamtrechnung mit dieser Nummer geführt (abrechnung.routes.js:692
--        und :2508 übergeben '0'). Für die Altdateien (05.01.–03.06.2026) ist
--        das die Wahrheit, keine Annahme.
--      · `karten_ik = NULL` — die Gruppierung nach Karten-IK gibt es erst seit
--        07.09.2026; für die Altdateien existiert sie schlicht nicht.
--      · `status = 'eingereicht'` — welche EINZELNE Zeile abgesetzt wurde, steht
--        für die Altdateien nirgends; nur der Dateistatus ist bekannt.
--
--    Vorher zur Kontrolle:
--      select count(*) from abrechnung;                       -- erwartet 12
--      select count(*) from prescriptions where abrechnung_id is not null;  -- erwartet 27
-- ─────────────────────────────────────────────────────────────────────────
insert into public.abrechnung_zeile (
  abrechnung_id, owner_id, business_id, prescription_id,
  kostentraeger_ik, karten_ik, einzel_rechnungsnummer, sort_order,
  belegnummer, patient_name, versichertennummer, verordnungsdatum,
  therapie_bereich, heilmittel_position, anzahl_einheiten,
  leistungen, brutto_eur, zuzahlung_eur, netto_eur,
  status, herkunft, created_at
)
select
  a.id,
  a.owner_id,
  a.business_id,
  p.id,
  a.kostentraeger_ik,
  null,
  '0',
  (row_number() over (partition by a.id order by p.ausstellungsdatum nulls last, p.id))::smallint - 1,
  p.belegnummer,
  nullif(btrim(concat_ws(' ', l.first_name, l.last_name)), ''),
  l.versichertennummer,
  p.ausstellungsdatum,
  p.therapie_bereich,
  p.heilmittel_position,
  p.anzahl_einheiten,
  '[]'::jsonb,
  0, 0, 0,
  'eingereicht',
  'rekonstruiert',
  a.created_at
from public.abrechnung a
join public.prescriptions p on p.abrechnung_id = a.id
left join public.leads l    on l.id = p.patient_id
-- `owner_id` muss ein Profil sein (FK auf profiles). Alles andere wäre eine
-- Waise und würde die Migration mitten im Lauf abbrechen.
where exists (select 1 from public.profiles pr where pr.id = a.owner_id);

commit;

-- ===========================================================================
-- NACH DEM ANWENDEN, im selben Commit (CLAUDE.md, Schema-Dump-Protokoll):
--   1. db/SCHEMA.sql + db/SCHEMA-RLS.sql neu erzeugen (Datum + letzte Migration
--      im Kopf mitziehen)
--   2. db/REGISTER.md: die beiden vorbereiteten Einträge eintragen
--      (ABRECHNUNG_BILDSCHIRM_PLAN.md Anhang B, TT.MM.2026 -> 09.09.2026)
--   3. node tools/tabellenkarte.mjs
--   4. api/dsgvo.js: beide Tabellen in USER_TABLES (owner_id);
--      abrechnung_zeile zusätzlich in ANONYMIZE_TABLES (patient_name,
--      versichertennummer nullen). NICHT in DELETE_TABLES (§302/§304 SGB V).
-- ===========================================================================
