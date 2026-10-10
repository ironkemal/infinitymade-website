/**
 * verordnung-termine.js — die Termine EINER podologischen Verordnung.
 *
 * Warum es das gibt
 * ─────────────────
 * Kemal, 31.08.2026, zum Umbau der Verordnungsseite: „rechte Seite sozusagen
 * so 20–30% von der Seite, da[mit] man die Termine sieht." Und Beta-1, gleiche
 * Sitzung, zur Vergabe:
 *
 *   „Ich glaube, wenn ich den Weg mache, kann ich halt nur eins nehmen statt
 *    beide. … Dann entscheide dich zwischen beiden, was ich auswähle."
 *
 * Also: EIN Termin wird gezielt zugeordnet, die anderen bleiben liegen.
 *
 * Die Verknüpfung ist neu (03.09.2026)
 * ────────────────────────────────────
 * Bis dahin gab es sie im Podologie-Topf überhaupt nicht: `bookings` trug kein
 * `verordnung_id`, und `podologie_behandlungen` entsteht erst bei der
 * Dokumentation der erbrachten Leistung — also nach dem Termin, nicht bei
 * seiner Vergabe. Die rechte Spalte konnte deshalb nur eine Restzahl zeigen.
 *
 * Entschieden wurde Variante (A): eine Spalte `bookings.verordnung_id`
 * (Migration `20260903074810_bookings_verordnung_id_podologie_termin_bindung`).
 * Der Weg des Physio-Topfes — `prescription_sessions.booking_id` — wurde
 * bewusst NICHT kopiert: dort gibt es ein Einheiten-Hauptbuch (eine Zeile je
 * verordneter Einheit, ab Anlage der Verordnung), hier nicht. „Welche der 6
 * Einheiten hat dieser Termin erfüllt?" ist in der Podologie keine Frage, die
 * Daten hätte — „zu welcher Verordnung gehört dieser Termin?" schon.
 * Ausführliche Begründung: `db/REGISTER.md`, Eintrag `bookings`.
 *
 * Drei Regeln, die man beim Zählen falsch machen kann
 * ───────────────────────────────────────────────────
 *   1. `verordnungen.behandlungseinheiten` ist NULLABLE, und live gibt es
 *      solche Zeilen. `null` heisst „nicht erfasst", NICHT 0 — ein stilles
 *      `|| 0` läse sich als „alles vergeben".
 *   2. Abgesagte Termine zählen nicht. `bookings.status` kennt `cancelled` und
 *      `no_show`; wer sie mitzählt, lässt eine Absage eine Einheit auffressen
 *      und die Verordnung sieht voll aus, obwohl sie es nicht ist. (Der
 *      Physio-Topf hat das Problem nicht: dort leert `sitzung-abgleich` beim
 *      Storno die Zeile.)
 *   3. KEIN Standort-Zuschnitt. `verordnungen` hat kein `business_id` — die
 *      Verordnung gehört der Praxis, nicht der Filiale —, `bookings` schon.
 *      Die Termine einer Verordnung dürfen also über Standorte streuen; sie
 *      hier zu filtern liesse fachlich zugehörige Termine verschwinden.
 */

const ABGESAGT = ['cancelled', 'no_show'];

/** Zählt dieser Termin gegen die verordnete Menge? Siehe Regel 2 oben. */
export function istVergeben(b) {
  if (!b) return false;
  if (b.no_show === true) return false;
  return !ABGESAGT.includes(b.status);
}

/**
 * Termine einer Verordnung plus die zuordenbaren Termine desselben Patienten.
 *
 * @param {object} sb
 * @param {object} opts
 * @param {string} opts.ownerId
 * @param {string} opts.vordId
 * @param {string|null} opts.leadId  Ohne Patientenakte gibt es keine
 *        Kandidaten — `bookings` hängt am Patienten, nicht am Freitextnamen.
 * @returns {Promise<{vergeben:Array, kandidaten:Array}>}
 */
export async function ladePodoTermine(sb, { ownerId, vordId, leadId } = {}) {
  if (!sb || !ownerId || !vordId) return { vergeben: [], kandidaten: [] };

  const spalten = 'id, start_time, end_time, status, no_show, customer_name, service_id, business_id';

  const [zugeordnet, offen] = await Promise.all([
    sb.from('bookings').select(spalten)
      .eq('owner_id', ownerId)
      .eq('verordnung_id', vordId)
      .neq('status', 'cancelled')
      .order('start_time', { ascending: true }),
    leadId
      ? sb.from('bookings').select(spalten)
          .eq('owner_id', ownerId)
          .eq('lead_id', leadId)
          .is('verordnung_id', null)
          .not('status', 'in', `(${ABGESAGT.map(s => `"${s}"`).join(',')})`)
          .order('start_time', { ascending: true })
          .limit(12)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (zugeordnet.error) console.error('[verordnung-termine] zugeordnet:', zugeordnet.error.message);
  if (offen.error)      console.error('[verordnung-termine] kandidaten:', offen.error.message);

  return {
    vergeben:   zugeordnet.data || [],
    kandidaten: offen.data || [],
  };
}

/**
 * Wie viele Einheiten sind noch offen?
 *
 * @param {object} vord   Zeile aus `verordnungen`
 * @param {Array}  vergeben  Termine dieser Verordnung
 * @returns {{verordnet:number|null, belegt:number, offen:number|null}}
 *          `verordnet`/`offen` sind `null`, wenn die Einheitenzahl nicht
 *          erfasst ist — dann gibt es keine Restmenge, die man behaupten kann.
 */
export function terminZaehler(vord, vergeben) {
  const belegt = (vergeben || []).filter(istVergeben).length;
  const roh = vord?.behandlungseinheiten;
  if (roh === null || roh === undefined || roh === '') {
    return { verordnet: null, belegt, offen: null };
  }
  const verordnet = Number(roh) || 0;
  return { verordnet, belegt, offen: Math.max(0, verordnet - belegt) };
}

// 78010/78020 podologische Behandlung, 78610 Nagelspangenbehandlung. Befundung
// (78030/78040/78100/78110), Kontrolle (78510), Abschluss (78520), Bericht
// (78530), Zuschlag (78620) und Hausbesuch (79933/79934) sind KEINE Einheiten.
const POD_BEHANDLUNGSPOSITIONEN = new Set(['78010', '78020', '78610']);

/**
 * Zaehlt diese Zeile gegen die verordnete Menge?
 *
 * Nicht jede Zeile in `podologie_behandlungen` ist eine Behandlungseinheit.
 * Anlage 1a i.d.F. 17.06.2024, Teil 2 Ziffer 4.1 sagt ausdruecklich:
 * "Die Eingangsbefundung ist: - keine Behandlungseinheit im Sinne der
 * Heilmittel-Richtlinie". Dasselbe gilt fuer Befundung, Kontrolle und
 * Abschluss — bezahlt werden sie, verbraucht wird durch sie nichts.
 *
 * Sichtbar wird das nur, wenn so eine Position ALLEIN auf einem Tag steht:
 * eine Erstbefundung ohne anschliessende Therapie etwa ist ausdruecklich
 * zulaessig (ZFD-FAK Podologie, Stand Juli 2024). Vorher zaehlte diese Zeile
 * als verbrauchte Einheit, die Verordnung galt eine Sitzung zu frueh als
 * ausgeschoepft — verschenkte Leistung statt Absetzung, aber ebenso Geld.
 * Im Normalfall (78040 zusammen mit 78010 am selben Tag, eine Zeile) aendert
 * sich nichts.
 *
 * Gezaehlt wird positiv: eine Zeile ist eine Einheit, wenn eine echte
 * Behandlungsposition drin steht. Zeilen ohne HPNR-Codes (Altbestand, bevor
 * die Codes gepflegt wurden) zaehlen weiterhin mit — sonst schrumpfte
 * rueckwirkend jeder alte Zaehler.
 *
 * @param {object} beh  Zeile aus `podologie_behandlungen`
 * @returns {boolean}
 */
export function istBehandlungseinheit(beh) {
  const codes = beh?.hpnr_codes;
  if (!Array.isArray(codes) || codes.length === 0) return true;
  return codes.some(c => POD_BEHANDLUNGSPOSITIONEN.has(String(c)));
}

/**
 * Belegung einer podologischen Verordnung — dieselbe Zahl in Termin-Karte, Terminauswahl und Akte.
 *
 * gkv-302, 10.10.2026 (canli-test T33: Karte „0/2", Akte „1/2"): verbraucht ist eine dokumentierte,
 * per Unterschrift bestaetigte Behandlungseinheit — nicht der Termin (Podologie-Vertrag § 5 Abs. 1 i.d.F.
 * 17.06.2025; Anlage 3 Lesefassung 16.06.2025, Feld f/o). Ausfall/No-show verbraucht nichts (`istVergeben`).
 * Fuer die Planung („noch offen") zaehlen zusaetzlich die vergebenen, noch nicht dokumentierten Termine.
 * Abgleich ueber den Kalendertag (Europe/Berlin): `podologie_behandlungen` hat keine booking_id —
 * ein Termin am Tag einer dokumentierten Einheit gilt als dokumentiert.
 *
 * @param {*}     verordnet     `prescriptions.anzahl_einheiten` (leer = unbekannt)
 * @param {Array} termine       `bookings` dieser Verordnung
 * @param {Array} behandlungen  `podologie_behandlungen` DIESER Verordnung, ohne stornierte
 * @param {(t:string)=>string} alsTag  Zeitpunkt -> YYYY-MM-DD (Berlin)
 * @returns {{verordnet:?number, erbracht:number, undokumentiert:Array, offen:?number}}
 */
export function podoBelegung(verordnet, termine, behandlungen, alsTag) {
  const einheiten = (behandlungen || []).filter(b => !b?.storniert_am && istBehandlungseinheit(b));
  const tage = new Set(einheiten.map(b => String(b.behandlungsdatum || '').slice(0, 10)));
  const undokumentiert = (termine || []).filter(istVergeben).filter(t => !tage.has(alsTag(t.start_time)));
  const roh = verordnet;
  if (roh === null || roh === undefined || roh === '') return { verordnet: null, erbracht: einheiten.length, undokumentiert, offen: null };
  const n = Number(roh) || 0;
  return { verordnet: n, erbracht: einheiten.length, undokumentiert, offen: Math.max(0, n - einheiten.length - undokumentiert.length) };
}

/** Behandlungen einer Verordnung fuer `podoBelegung` (stornierte verbrauchen nichts, Migration 0026). */
export async function ladeVerordnungsBehandlungen(sb, { ownerId, vordId } = {}) {
  if (!sb || !ownerId || !vordId) return [];
  const { data, error } = await sb.from('podologie_behandlungen')
    .select('behandlungsdatum, hpnr_codes')
    .eq('owner_id', ownerId).eq('verordnung_id', vordId).is('storniert_am', null);
  if (error) console.error('[verordnung-termine] behandlungen:', error.message);
  return data || [];
}

/**
 * Einen einzelnen Termin dieser Verordnung zuordnen.
 *
 * @returns {Promise<{ok:boolean, fehler?:string}>}
 */
export async function bindeTermin(sb, { bookingId, vordId }) {
  const { data, error } = await sb.from('bookings')
    .update({ verordnung_id: vordId })
    .eq('id', bookingId)
    .select('id');
  if (error) return { ok: false, fehler: dbFehlerText(error) };
  if (!data?.length) return { ok: false, fehler: NICHT_GESCHRIEBEN };
  return { ok: true };
}

/** Die Zuordnung wieder lösen — eine Fehlzuordnung muss ohne Umweg korrigierbar sein. */
export async function loeseTermin(sb, { bookingId }) {
  const { data, error } = await sb.from('bookings')
    .update({ verordnung_id: null })
    .eq('id', bookingId)
    .select('id');
  if (error) return { ok: false, fehler: dbFehlerText(error) };
  if (!data?.length) return { ok: false, fehler: NICHT_GESCHRIEBEN };
  return { ok: true };
}

/**
 * Ein UPDATE, das die Zeilensicherheit nicht passieren darf, wirft KEINEN
 * Fehler — PostgREST meldet Erfolg mit null betroffenen Zeilen. Ohne die
 * Rückgabe aus `.select()` stünde in der Oberfläche „zugeordnet", während in
 * der Datenbank nichts passiert wäre. Dasselbe gilt, wenn der Termin
 * inzwischen gelöscht wurde.
 */
const NICHT_GESCHRIEBEN =
  'Der Termin wurde nicht geändert — er existiert nicht mehr, oder die Berechtigung fehlt.';

/**
 * Datenbankfehler in einen Satz übersetzen, den der Anwender lesen kann.
 *
 * Der Owner-Riegel (`trg_booking_verordnung_owner`) wirft `42501` mit einem
 * fertigen deutschen Text. Ihn roh durchzureichen wäre dasselbe Muster wie
 * beim `no_overlapping_bookings`-Constraint: der Anwender sieht eine
 * Postgres-Meldung und weiss nicht, was er tun soll.
 *
 * `db`-Präfix, weil `module/abrechnung-auswahl.js` ein anderes `fehlerText`
 * hat (liest eine fetch-Antwort, keinen Supabase-Fehler) — gleicher Name
 * verwechselte die Funktionskarte.
 */
function dbFehlerText(error) {
  if (!error) return 'Unbekannter Fehler.';
  if (error.code === '42501') {
    return error.message || 'Diese Verordnung gehört zu einer anderen Praxis.';
  }
  console.error('[verordnung-termine]', error);
  return error.message || 'Der Termin konnte nicht zugeordnet werden.';
}
