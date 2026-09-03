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
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: NICHT_GESCHRIEBEN };
  return { ok: true };
}

/** Die Zuordnung wieder lösen — eine Fehlzuordnung muss ohne Umweg korrigierbar sein. */
export async function loeseTermin(sb, { bookingId }) {
  const { data, error } = await sb.from('bookings')
    .update({ verordnung_id: null })
    .eq('id', bookingId)
    .select('id');
  if (error) return { ok: false, fehler: fehlerText(error) };
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
 */
function fehlerText(error) {
  if (!error) return 'Unbekannter Fehler.';
  if (error.code === '42501') {
    return error.message || 'Diese Verordnung gehört zu einer anderen Praxis.';
  }
  console.error('[verordnung-termine]', error);
  return error.message || 'Der Termin konnte nicht zugeordnet werden.';
}
