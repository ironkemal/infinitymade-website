import { alsBerlinDatum } from './berlin-datum.js';
import { istBehandlungseinheit } from './verordnung-termine.js?v=20261010zc';
import { rxGeschlossen } from './termin-verordnung.js?v=20261021s';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BEREICHE = Object.freeze({ podo: 'podologie', physio: 'physiotherapie', ergo: 'ergotherapie', stimme: 'logopaedie' });
const ABRECHNUNG = new Set(['', 'bereit', 'in_abrechnung', 'gesendet', 'accepted', 'paid', 'rejected', 'teilabsetzung', 'storniert', 'archiviert']);
const RX_FELDER = 'id,owner_id,patient_id,status,abrechnung_status,rezeptart,rezept_typ,is_blanko,is_lhb_bvb,therapie_bereich,ausstellungsdatum,is_dringend,behandlungsbeginn,anzahl_einheiten';
const BEHANDLUNG_FELDER = 'id,owner_id,verordnung_id,behandlungsdatum,hpnr_codes,storniert_am';
const SESSION_FELDER = 'id,prescription_id,booking_id,status,done_at,heilmittel_index,prescriptions!inner(id,owner_id)';
const BOOKING_FELDER = 'id,owner_id,verordnung_id,start_time,status,no_show';
const quelle = () => ({ status: 'ok', vollstaendig: true, daten: [], gruende: [] });
const tag = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && alsBerlinDatum(v) === v;
const instantTag = v => typeof v === 'string' && /[Tt ]/.test(v) ? alsBerlinDatum(v) : '';
const uuid = v => typeof v === 'string' && UUID.test(v);

function unvollstaendig(q, code) {
  q.status = 'fehler'; q.vollstaendig = false;
  if (!q.gruende.includes(code)) q.gruende.push(code);
}

function pruefeScope(s) {
  if (!s || s.rolle !== 'owner' || !uuid(s.uid) || s.uid !== s.ownerId || s.vollstaendig !== true) return null;
  if (s.umfang === 'mandant') return { ownerId: s.ownerId, patientIds: null };
  if (s.umfang !== 'patienten' || !Array.isArray(s.patientIds) || !s.patientIds.every(uuid)) return null;
  return { ownerId: s.ownerId, patientIds: [...new Set(s.patientIds)] };
}

function aktuell(signal, istAktuell) {
  if (signal?.aborted) return false;
  try { return istAktuell() === true; } catch { return false; }
}

/** Bounded owner-keyset reads; errors retain only previously checked pages. */
async function seiten({ supabase, scope, tabelle, felder, filter, pruefe, signal, istAktuell }) {
  const rows = []; let cursor = null;
  try {
    while (aktuell(signal, istAktuell)) {
      let q = supabase.from(tabelle).select(felder)
        .eq(tabelle === 'prescription_sessions' ? 'prescriptions.owner_id' : 'owner_id', scope.ownerId);
      for (const [feld, werte] of filter) q = q.in(feld, werte);
      q = q.order('id', { ascending: true }).limit(200);
      if (cursor !== null) q = q.gt('id', cursor);
      if (signal) q = q.abortSignal(signal);
      const r = await q;
      if (!aktuell(signal, istAktuell)) return { rows: [], ok: false, code: 'ABFRAGE_UEBERHOLT' };
      if (r?.error || !Array.isArray(r?.data)) return { rows, ok: false, code: 'QUELLE_FEHLER' };
      if (r.data.length === 0) return { rows, ok: true };
      if (r.data.length > 200) return { rows, ok: false, code: 'SEITE_UNGUELTIG' };
      let last = cursor;
      for (const row of r.data) {
        if (!row || !uuid(row.id) || (last !== null && row.id <= last) || !pruefe(row)) return { rows, ok: false, code: 'QUELLE_ZUORDNUNG_UNGUELTIG' };
        last = row.id;
      }
      rows.push(...r.data); cursor = last;
    }
    return { rows: [], ok: false, code: 'ABFRAGE_UEBERHOLT' };
  } catch {
    return { rows, ok: false, code: 'QUELLE_FEHLER' };
  }
}

function normalisiereBehandlung(row, heute, q) {
  const datum = tag(row.behandlungsdatum) ? row.behandlungsdatum : '';
  const storno = row.storniert_am;
  if (!datum || datum > heute || !(storno === null || instantTag(storno)) ||
      !(row.hpnr_codes === null || (Array.isArray(row.hpnr_codes) && row.hpnr_codes.every(v => typeof v === 'string' && /^\d{5}$/.test(v))))) {
    unvollstaendig(q, 'BEHANDLUNG_UNGUELTIG'); return null;
  }
  const b = { behandlungsdatum: datum, storniert_am: storno };
  q.daten.push(b); return row;
}

function normalisiereTermin(row, q) {
  if (['cancelled', 'no_show'].includes(row.status) || row.no_show === true) return;
  if (row.status === 'completed') return; // Durchführung stammt ausschließlich aus dokumentierter Historie.
  const datum = instantTag(row.start_time);
  if (row.status !== 'confirmed' || row.no_show !== false || !datum) {
    unvollstaendig(q, 'TERMIN_UNGEKLAERT'); return;
  }
  q.daten.push({ tag: datum, status: 'geplant' });
}

/**
 * Lädt ausschließlich den v1-Eingang für berechneHandlungsbedarf; keine DOM-,
 * Fristen-, Frequenz-, Preis-, Schreib- oder eigenständige Berechtigungslogik.
 *
 * scope kommt aus bereits geprüftem Auth-/Dashboard-Kontext:
 * {rolle:'owner',uid:UUID,ownerId:UUID,umfang:'mandant',vollstaendig:true} oder
 * {…umfang:'patienten',patientIds:UUID[],vollstaendig:true}. Patienten-IDs müssen
 * die vollständige erlaubte Standortmenge einschließlich bestehender NULL-
 * Altbestandsregel repräsentieren. Hier wird kein Standort aus VO.business_id
 * abgeleitet. 'mandant' nur liefern, wenn dieser Umfang tatsächlich erlaubt ist.
 * Scope ist ein injizierter Vertrag, kein Ersatz für Auth/RLS. Mitarbeiter ohne
 * belegte eigene-Patienten-Regel bleiben Unknown mit 0 Fachreads; auch eine
 * injizierte Patientenliste schaltet diese Rolle nicht frei.
 *
 * heute ist ein gültiger Berliner Kalendertag. Mehrere Reads sind kein
 * Transaktionssnapshot. Jede Quelle/200er-ID-Gruppe liest per stabilem ID-Keyset
 * bis leer; Teilfehler behalten geprüfte Teilmengen mit vollstaendig:false.
 * Unbekannte Formen/Status/Bereiche verhindern globale Entwarnung. Nur eindeutig
 * geeignete aktive Standard-GKV-VO werden normalisiert. Restbedarf für
 * Physio/Ergo/Logo ist konservativ null (Kombi-/Mengenvertrag nicht belegt).
 * Podo nutzt dokumentierte Einheiten, keine undokumentierten Plantermine.
 *
 * signal wird an jeden Transport weitergereicht. istAktuell() prüft vor/nach
 * jedem await den aufrufenden Rollen-/Tenant-/Standort-/Requeststand. Bei Wechsel
 * muss der Integrator abbrechen bzw. false liefern und alte Antworten verwerfen.
 * Ohne Callback liegt diese Prüfung beim Aufrufer; keine globale Cachehaltung.
 * Ausgabe enthält nur v1-Felder und feste Quellen-Grundcodes, keine Rohfehler.
 *
 * @param {{supabase:object,heute:string,scope:object,signal?:AbortSignal,istAktuell?:function}} optionen
 * @returns {Promise<{version:1,heute:string,verordnungen:object}>} Rechner-Eingang, keine UI-/Live-Abnahme
 */
export async function ladeHandlungsbedarfInput({ supabase, heute, scope: originalScope, signal, istAktuell = () => true } = {}) {
  if (!tag(heute)) throw new TypeError('HANDLUNGSBEDARF_TAG_UNGUELTIG');
  const result = { version: 1, heute, verordnungen: quelle() };
  const unknown = code => { result.verordnungen.daten = []; unvollstaendig(result.verordnungen, code); return result; };
  const scope = pruefeScope(originalScope);
  if (!scope) return unknown('SCOPE_UNGEKLAERT');
  if (typeof istAktuell !== 'function' || !aktuell(signal, istAktuell)) return unknown('ABFRAGE_UEBERHOLT');
  if (!supabase || typeof supabase.from !== 'function') return unknown('CLIENT_UNGUELTIG');
  const lesen = args => seiten({ supabase, scope, signal, istAktuell, ...args });
  const patientChunks = scope.patientIds === null ? [null] : Array.from({ length: Math.ceil(scope.patientIds.length / 200) }, (_, i) => scope.patientIds.slice(i * 200, i * 200 + 200));
  const roh = [];
  for (const patients of patientChunks) {
    const allowed = patients && new Set(patients);
    const r = await lesen({ tabelle: 'prescriptions', felder: RX_FELDER, filter: patients ? [['patient_id', patients]] : [],
      pruefe: row => row.owner_id === scope.ownerId && (!allowed || allowed.has(row.patient_id)) });
    roh.push(...r.rows);
    if (!r.ok) unvollstaendig(result.verordnungen, r.code);
  }
  if (!aktuell(signal, istAktuell)) return unknown('ABFRAGE_UEBERHOLT');
  const vo = new Map();
  for (const r of roh) {
    if (vo.has(r.id)) { unvollstaendig(result.verordnungen, 'VERORDNUNG_MEHRDEUTIG'); continue; }
    if (['privat', 'selbstzahler', 'bg'].includes(r.rezeptart) || r.therapie_bereich === 'ernaehrung') continue;
    if (!['parsed', 'confirmed', 'in_therapy', 'completed', 'billed', 'cancelled'].includes(r.status)) {
      unvollstaendig(result.verordnungen, 'VERORDNUNG_EIGNUNG_UNGEKLAERT'); continue;
    }
    if (rxGeschlossen(r)) continue;
    if (!['confirmed', 'in_therapy'].includes(r.status) ||
        !(r.rezeptart === null || r.rezeptart === 'kassen') ||
        !(r.abrechnung_status === null || ABRECHNUNG.has(r.abrechnung_status)) ||
        !Object.hasOwn(BEREICHE, r.therapie_bereich) || r.rezept_typ !== 'standard' || r.is_blanko !== false || r.is_lhb_bvb !== false) {
      unvollstaendig(result.verordnungen, 'VERORDNUNG_EIGNUNG_UNGEKLAERT'); continue;
    }
    const v = { id: r.id, bereich: BEREICHE[r.therapie_bereich], ausstellungsdatum: r.ausstellungsdatum,
      dringend: r.is_dringend, behandlungsbeginn: r.behandlungsbeginn, restbedarf: null,
      behandlungen: quelle(), termine: quelle() };
    vo.set(r.id, { raw: r, v, einheiten: [] });
  }
  const verarbeite = async (ids, args, nutze, quelleName) => {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200), allowed = new Set(chunk);
      const r = await lesen({ ...args, filter: [[args.fk, chunk]], pruefe: row => args.check(row, allowed) });
      for (const row of r.rows) nutze(row);
      if (!r.ok) for (const refId of chunk) unvollstaendig(vo.get(refId).v[quelleName], r.code);
    }
  };
  const podo = [...vo.keys()].filter(k => vo.get(k).v.bereich === 'podologie');
  const andere = [...vo.keys()].filter(k => vo.get(k).v.bereich !== 'podologie');
  await verarbeite(podo, { tabelle: 'podologie_behandlungen', felder: BEHANDLUNG_FELDER, fk: 'verordnung_id',
    check: (r, ids) => r.owner_id === scope.ownerId && ids.has(r.verordnung_id) }, r => {
    const record = vo.get(r.verordnung_id);
    const b = normalisiereBehandlung(r, heute, record.v.behandlungen);
    if (b) record.einheiten.push(b);
  }, 'behandlungen');
  await verarbeite(podo, { tabelle: 'bookings', felder: BOOKING_FELDER, fk: 'verordnung_id',
    check: (r, ids) => r.owner_id === scope.ownerId && ids.has(r.verordnung_id) }, r => normalisiereTermin(r, vo.get(r.verordnung_id).v.termine), 'termine');
  const bookingZuVo = new Map();
  await verarbeite(andere, { tabelle: 'prescription_sessions', felder: SESSION_FELDER, fk: 'prescription_id',
    check: (r, ids) => ids.has(r.prescription_id) && r.prescriptions?.id === r.prescription_id && r.prescriptions?.owner_id === scope.ownerId }, r => {
    const { v } = vo.get(r.prescription_id);
    if (!['planned', 'done', 'cancelled', 'no_show'].includes(r.status) ||
        (r.status !== 'done' && r.done_at !== null) || !Number.isInteger(r.heilmittel_index) || r.heilmittel_index < 0) {
      unvollstaendig(v.behandlungen, 'SITZUNG_UNGEKLAERT'); unvollstaendig(v.termine, 'SITZUNG_UNGEKLAERT'); return;
    }
    if (r.status === 'done') {
      const datum = instantTag(r.done_at);
      if (!datum || datum > heute) unvollstaendig(v.behandlungen, 'SITZUNG_DATUM_UNGUELTIG');
      else v.behandlungen.daten.push({ behandlungsdatum: datum, storniert_am: null });
    }
    if (r.status !== 'planned') return;
    if (r.booking_id === null) return;
    if (!uuid(r.booking_id)) { unvollstaendig(v.termine, 'SITZUNG_TERMIN_UNGUELTIG'); return; }
    if (!bookingZuVo.has(r.booking_id)) bookingZuVo.set(r.booking_id, new Set());
    bookingZuVo.get(r.booking_id).add(r.prescription_id);
  }, 'behandlungen');
  // A missing session page also prevents proving that no future linked booking exists.
  for (const refId of andere) if (!vo.get(refId).v.behandlungen.vollstaendig) unvollstaendig(vo.get(refId).v.termine, 'SITZUNGEN_UNVOLLSTAENDIG');
  const bookingIds = [...bookingZuVo.keys()];
  for (let i = 0; i < bookingIds.length; i += 200) {
    const chunk = bookingIds.slice(i, i + 200), allowed = new Set(chunk);
    const r = await lesen({ tabelle: 'bookings', felder: BOOKING_FELDER, filter: [['id', chunk]],
      pruefe: b => b.owner_id === scope.ownerId && allowed.has(b.id) && b.verordnung_id === null });
    const gefunden = new Set(r.rows.map(b => b.id));
    for (const b of r.rows) for (const refId of bookingZuVo.get(b.id)) normalisiereTermin(b, vo.get(refId).v.termine);
    for (const bid of chunk) if (!r.ok || !gefunden.has(bid)) for (const refId of bookingZuVo.get(bid)) unvollstaendig(vo.get(refId).v.termine, r.code || 'TERMIN_FEHLT');
  }
  if (!aktuell(signal, istAktuell)) return unknown('ABFRAGE_UEBERHOLT');
  for (const { raw, v, einheiten } of vo.values()) {
    if (v.bereich === 'podologie' && v.behandlungen.vollstaendig && Number.isSafeInteger(raw.anzahl_einheiten) && raw.anzahl_einheiten > 0) {
      const erbracht = einheiten.filter(b => !b.storniert_am && istBehandlungseinheit(b)).length;
      v.restbedarf = erbracht < raw.anzahl_einheiten;
    }
    result.verordnungen.daten.push(v);
  }
  return result;
}
