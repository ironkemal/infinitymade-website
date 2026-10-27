import { createSlotNachweis } from '../slot-nachweis.js';

const uuid = x => typeof x === 'string' && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(x);
// JS Date truncates microseconds too: inspect the original fractional digits.
const minutenGenau = x => typeof x === 'string' && Number.isFinite(Date.parse(x))
  && new Date(x).getUTCSeconds() === 0 && new Date(x).getUTCMilliseconds() === 0
  && !/[1-9]/.test(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(x)?.[1] || '');
const uhrGenau = x => typeof x === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d(?::00(?:\.0+)?)?$|^24:00(?::00(?:\.0+)?)?$/.test(x);

// The ordered pages ARE the engine's input, not a second control query.
async function listeVollstaendig(query) {
  const rows = [], seen = new Set();
  let total = null, previous = null;
  query = query.order('id', { ascending: true });
  while (true) {
    const result = await query.range(rows.length, rows.length + 999);
    if (result?.error || !Array.isArray(result?.data) || !Number.isSafeInteger(result.count)
      || result.count < 0 || result.count > 100000 || (total !== null && total !== result.count)) {
      throw new Error('QUELLE_UNVOLLSTAENDIG');
    }
    total = result.count;
    if (!result.data.length && rows.length !== total) throw new Error('QUELLE_UNVOLLSTAENDIG');
    for (const row of result.data) {
      if (!uuid(row?.id) || seen.has(row.id) || (previous !== null && row.id <= previous)) {
        throw new Error('QUELLE_UNVOLLSTAENDIG');
      }
      previous = row.id; seen.add(row.id); rows.push(row);
    }
    if (rows.length > total) throw new Error('QUELLE_UNVOLLSTAENDIG');
    if (rows.length === total) return { data: rows, error: null, count: total };
  }
}

/** Request-local observation. Raw intervals never enter logs or public DTOs. */
function engineNachweis(input, nurBasis) {
  const core = createSlotNachweis();
  const zeugen = [], parents = new Set();
  let basis = null, externStatus = 'nicht_konfiguriert';
  const scope = { version: 1, tenantId: input.tenantId, userId: input.userId,
    tag: input.tag, businessId: input.businessId };
  const unklar = () => core.unbekannt('SCOPE_UNGUELTIG');
  const pruefe = (quelle, data) => {
    if (data == null) return;
    const rows = Array.isArray(data) ? data : [data];
    for (const row of rows) {
      switch (quelle) {
        case 'PROFIL':
          if (row.id !== input.userId || (row.owner_id ?? row.id) !== input.tenantId
            || row.role !== (input.userId === input.tenantId ? 'owner' : 'employee') || row.is_active === false) unklar();
          break;
        case 'LEISTUNG':
          if (row.id !== input.serviceId || (row.owner_id ?? row.user_id) !== input.tenantId
            || (row.owner_id != null && row.user_id != null && row.owner_id !== row.user_id)
            || row.duration_minutes !== input.dauerMin || row.is_internal === true
            || (row.business_id != null && row.business_id !== input.businessId)) unklar();
          break;
        case 'LEISTUNGSZUORDNUNG':
          if (row.employee_id !== input.userId || row.service_id !== input.serviceId
            || (row.business_id != null && row.business_id !== input.businessId)) unklar();
          break;
        case 'ZERTIFIKATE':
          if (row.owner_id !== input.tenantId || row.profile_id !== input.userId) unklar();
          break;
        case 'STANDORT': case 'STANDARDSTANDORT':
          if (row.owner_id !== input.tenantId || (quelle === 'STANDORT' && row.id !== input.businessId)) unklar();
          break;
        case 'ZUORDNUNGEN':
          if (row.employee_id !== input.userId || row.businesses?.owner_id !== input.tenantId) unklar();
          break;
        case 'SONDERTAG':
          if (row.owner_id !== input.tenantId) unklar();
          if ((row.start_time != null && !uhrGenau(row.start_time)) || (row.end_time != null && !uhrGenau(row.end_time))) core.unbekannt('ZEITBASIS_UNKLAR');
          break;
        case 'ARBEITSZEIT': case 'OWNER_ARBEITSZEIT':
          if (row.user_id !== (quelle === 'ARBEITSZEIT' ? input.userId : input.tenantId)) unklar();
          if (row.is_active && (!uhrGenau(row.start_time) || !uhrGenau(row.end_time))) core.unbekannt('ZEITBASIS_UNKLAR');
          break;
        case 'BUCHUNGEN':
          if (row.owner_id !== input.tenantId || row.user_id !== input.userId
            || (row.business_id != null && row.businesses?.owner_id !== input.tenantId)) unklar();
          parents.add(row.id);
          if (!minutenGenau(row.start_time) || !minutenGenau(row.end_time)) core.unbekannt('ZEITBASIS_UNKLAR');
          break;
        case 'TEILNEHMER':
          if (row.owner_id !== input.tenantId || row.user_id !== input.userId || !parents.has(row.group_parent_id)) unklar();
          break;
        case 'PAUSEN':
          if (row.user_id !== input.userId) unklar();
          if (!uhrGenau(row.start_time) || !uhrGenau(row.end_time)) core.unbekannt('ZEITBASIS_UNKLAR');
          break;
        case 'ABWESENHEITEN':
          if (row.employee_id !== input.userId) unklar();
          if (!minutenGenau(row.start_date) || !minutenGenau(row.end_date)) core.unbekannt('ZEITBASIS_UNKLAR');
          break;
        case 'GOOGLE_VERBINDUNG':
          if (row.user_id !== input.userId || row.provider !== 'google'
            || (row.business_id != null && row.business_id !== input.businessId)) unklar();
          if (!row.access_token) core.unbekannt('EXTERNE_BELEGUNG_UNBEKANNT');
          if (row.calendar_id != null && row.calendar_id !== 'primary') core.unbekannt('EXTERNE_BELEGUNG_UNBEKANNT');
          break;
      }
    }
  };
  const observer = {
    ...core, basisErforderlich: true, nurBasis, jetzt: input.jetzt,
    async lese(quelle, query, opts = {}) {
      try {
        const result = opts.liste ? await listeVollstaendig(query) : await query;
        pruefe(quelle, result?.data);
        return core.lese(quelle, Promise.resolve(result), opts);
      } catch (err) { core.unbekannt('QUELLEN_UNVOLLSTAENDIG'); throw err; }
    },
    googleAntwort(response) {
      core.googleAntwort(response); externStatus = 'verbunden';
      if (response?.data?.calendars?.primary?.busy?.some(b => !minutenGenau(b.start) || !minutenGenau(b.end))) core.unbekannt('ZEITBASIS_UNKLAR');
    },
    slot(start, gruppenRestplatz) { zeugen.push({ start, gruppenRestplatz }); },
    rohbasis(raw) {
      // The actual resolver must agree with the requested/authorized site.
      if ((raw.businessId ?? null) !== input.businessId) unklar();
      basis = { ...scope, quellen: { arbeitszeit: 'vollstaendig', sperren: 'vollstaendig',
        buchungen: 'vollstaendig', extern: externStatus === 'verbunden' ? 'vollstaendig' : 'nicht_erforderlich' },
        externStatus, arbeitsintervalle: raw.arbeitsintervalle, sperren: raw.sperren,
        buchungen: raw.buchungen, externeBelegung: raw.externeBelegung, rasterUrsprung: raw.rasterUrsprung };
    },
    ausgabe(antwort) {
      if (!basis) core.unbekannt('WOCHENBASIS_FEHLT');
      if (!antwort || !Array.isArray(antwort.slots) || antwort.slots.length !== zeugen.length
        || antwort.slots.some((s, i) => zeugen[i]?.start !== s)) core.unbekannt('SLOT_UNGUELTIG');
      const nachweis = core.ergebnis();
      return { ...nachweis, slots: nachweis.vollstaendig ? zeugen : [],
        basis: { ...scope, ...basis, ...nachweis } };
    }
  };
  return observer;
}

/** Engine injected from server.js. No server import, no alternative slot generator. */
export function createSlotAdapter({ engine } = {}) {
  if (typeof engine !== 'function') throw new TypeError('Engine erforderlich');
  async function run(input, nurBasis) {
    if (!input || !uuid(input.tenantId) || !uuid(input.userId)
      || !(input.businessId === null || uuid(input.businessId))
      || !/^\d{4}-\d{2}-\d{2}$/.test(input.tag) || !Number.isFinite(Date.parse(input.jetzt))
      || (!nurBasis && (!uuid(input.serviceId) || !Number.isInteger(input.dauerMin) || input.dauerMin <= 0
        || !Number.isInteger(input.pufferMin) || input.pufferMin < 0
        || !Number.isInteger(input.rasterMin) || input.rasterMin <= 0))) {
      throw new Error('SCOPE_UNGUELTIG');
    }
    const proof = engineNachweis(input, nurBasis);
    let result;
    try {
      // Duration zero is unused in raw-only mode; no invented treatment default.
      result = await engine(input.userId, input.tag, nurBasis ? 0 : input.dauerMin,
        input.businessId, nurBasis ? 0 : input.pufferMin, nurBasis ? 15 : input.rasterMin,
        nurBasis ? null : input.serviceId, proof);
    } catch { proof.unbekannt('QUELLE_NICHT_VERFUEGBAR'); }
    return proof.ausgabe(result);
  }
  return { slotAdapter: input => run(input, false), ladeBasis: async input => (await run(input, true)).basis };
}
