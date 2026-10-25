/** Synthetischer Supabase-Ersatz für die Redesign-Werkzeuge (redesign/AUFTRAG.md, T4/T5).
 *
 * Wird nie von Produktcode importiert. `tools/redesign-harness.mjs` tauscht
 * `/vendor/supabase-js.js` an der Netzwerkgrenze gegen diese Datei aus. Damit
 * laufen Screenshots und Smoke-Tests ohne Login, ohne Zugangsdaten und ohne
 * echte Datenbank — und sind reproduzierbar, weil die Daten feststehen.
 *
 * Anders als die strengen Fixtures einzelner Proben ist dieser Ersatz
 * NACHSICHTIG: unbekannte Tabellen liefern eine leere Liste, unbekannte RPCs
 * `null`. Schreibzugriffe liefern einen Fehler (nie eine Ausnahme), damit ein
 * Smoke-Klick die Seite nicht abstürzen lässt. Alles wird in
 * `window.__rsFixture` protokolliert und vom Harness ausgewertet.
 *
 * Szenarien (window.__rsSzenario): 'voll' = gefüllte Praxis, 'leer' = neue Praxis,
 * 'gross' = große Praxis (viele Patienten, Termine, Verordnungen: Umbruch, Überlauf, Tempo),
 * 'fehler' = jede Leseabfrage scheitert (Fehlerzustände), 'langsam' = wie voll, jede Abfrage
 * antwortet erst nach 2,5 s (Ladezustände). 'voll' und 'leer' bleiben unverändert, weil die
 * Alt-Referenzbilder darauf beruhen.
 * Rolle (window.__rsRolle): 'owner' (Standard) oder 'employee'.
 * Alle Daten sind erfunden. Kein Patientendatensatz, kein Schlüssel.
 */
const TAG = window.__rsDay || '2026-10-23';
const SZENARIO = window.__rsSzenario || 'voll';
const ROLLE = window.__rsRolle || 'owner';

const OWNER = '10000000-0000-4000-8000-000000000001';
const MITARB = '10000000-0000-4000-8000-000000000002';
const BIZ = '10000000-0000-4000-8000-000000000003';
const uid = (gruppe, n) => `${gruppe}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const log = window.__rsFixture = { reads: [], writes: [], rpc: [], storage: [], functions: [], unbekannt: [], tag: TAG };
const clone = (v) => (v === undefined ? undefined : structuredClone(v));
// Berliner Versatz des jeweiligen Tages (Sommerzeit endet So 25.10.2026): mit festem +02:00
// stünden Termine nach der Umstellung eine Stunde zu früh (--uhr 2026-10-26…).
const berlinVersatz = (tag) => {
  const teil = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', timeZoneName: 'shortOffset' })
    .formatToParts(new Date(`${tag}T12:00:00Z`)).find((p) => p.type === 'timeZoneName')?.value || 'GMT+2';
  const m = teil.match(/GMT([+-]\d+)/);
  const h = m ? Number(m[1]) : 2;
  return `${h < 0 ? '-' : '+'}${String(Math.abs(h)).padStart(2, '0')}:00`;
};
const zeit = (tag, hm) => new Date(`${tag}T${hm}:00${berlinVersatz(tag)}`).toISOString();
const plusTage = (n) => {
  const d = new Date(TAG + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const ichId = ROLLE === 'employee' ? MITARB : OWNER;
const user = { id: ichId, email: ROLLE === 'employee' ? 'mitarbeiterin@example.invalid' : 'inhaberin@example.invalid',
  user_metadata: { full_name: ROLLE === 'employee' ? 'Mia Mitarbeiterin' : 'Ines Inhaberin' } };
const session = { user, access_token: 'synthetisch-nur-redesign', token_type: 'bearer', expires_at: 4102444800 }; // secret-scan: ignore — erfundener Platzhalter, kein Token

const ownerProfil = {
  id: OWNER, owner_id: null, role: 'owner', sector: 'podologie', plan: 'professional', plan_status: 'active',
  is_active: true, business_name: 'Podologie Musterpraxis', company_code: 'TEST23', booking_slug: 'musterpraxis',
  email: 'inhaberin@example.invalid', full_name: 'Ines Inhaberin', owner_first_name: 'Ines', owner_last_name: 'Inhaberin',
  first_name: 'Ines', last_name: 'Inhaberin', created_at: '2026-01-05T09:00:00Z', ik_nummer: '999999999',
  street: 'Musterweg 1', postal_code: '00000', city: 'Musterstadt', language: 'de', onboarding_completed: true,
  trial_ends_at: '2099-01-01T00:00:00Z', betriebsart: 'test', avatar_url: null,
};
const mitarbProfil = {
  ...ownerProfil, id: MITARB, owner_id: OWNER, role: 'employee', email: 'mitarbeiterin@example.invalid',
  full_name: 'Mia Mitarbeiterin', first_name: 'Mia', last_name: 'Mitarbeiterin', business_id: BIZ, business_name: null,
};

const PATIENTEN = [
  ['Erika', 'Musterfrau', 'AOK Synthetisch', '1951-03-14'], ['Hans', 'Beispiel', 'TK Synthetisch', '1948-11-02'],
  ['Petra', 'Probe', 'DAK Synthetisch', '1960-07-21'], ['Karl', 'Testmann', 'BARMER Synthetisch', '1939-01-30'],
  ['Maria', 'Muster', 'AOK Synthetisch', '1957-05-09'], ['Jonas', 'Beispielmann', 'privat', '1972-09-17'],
  ['Greta', 'Fiktiv', 'IKK Synthetisch', '1944-12-24'], ['Otto', 'Platzhalter', 'TK Synthetisch', '1955-06-06'],
];
const leads = PATIENTEN.map(([vn, nn, kk, geb], i) => ({
  id: uid('2', i + 1), user_id: OWNER, owner_id: OWNER, business_id: null, first_name: vn, last_name: nn,
  name: `${vn} ${nn}`, title: `${vn} ${nn}`, phone: '+49 000 00000' + i, email: `patient${i + 1}@example.invalid`,
  geburtsdatum: geb, birth_date: geb, krankenkasse: kk, insurance_type: kk === 'privat' ? 'privat' : 'gkv',
  versichertennummer: 'X00000000' + i, krankenkasse_ik: '99999999' + i, kostentraeger_ik: '99999999' + i,
  patientennummer: 'P-' + String(1001 + i), status: i % 3 ? 'aktiv' : 'neu', source: 'manuell', is_active: true,
  street: 'Musterweg ' + (i + 2), postal_code: '00000', city: 'Musterstadt', created_at: '2026-0' + (1 + (i % 8)) + '-10T09:00:00Z',
  notes: null, tags: [],
}));

const LEISTUNGEN = [
  ['78010', 'Podologische Komplexbehandlung', 45, 46.5, '#4F4136'], ['78020', 'Hornhautabtragung', 30, 30.2, '#A48565'],
  ['78030', 'Nagelbearbeitung', 25, 28.4, '#5B7A8C'], ['PRIV1', 'Medizinische Fußpflege (privat)', 45, 42, '#7A8F6B'],
];
const services = LEISTUNGEN.map(([code, titel, dauer, preis, farbe], i) => ({
  id: uid('3', i + 1), user_id: OWNER, owner_id: OWNER, business_id: null, title: titel, name: titel, code,
  gkv_position_nr: code.startsWith('7') ? code : null, duration_minutes: dauer, duration: dauer, price: preis,
  color: farbe, is_active: true, sort_order: i, category: code.startsWith('7') ? 'GKV' : 'Privat',
}));

const TERMINE = [ // [patient, leistung, start, ende, status, mitarbeiter?]
  [0, 0, '08:00', '08:45', 'completed'], [1, 1, '09:00', '09:30', 'completed'], [2, 2, '09:45', '10:10', 'confirmed'],
  [3, 0, '10:30', '11:15', 'confirmed'], [4, 3, '13:00', '13:45', 'confirmed'], [5, 1, '14:00', '14:30', 'cancelled'],
  [6, 0, '15:00', '15:45', 'confirmed'], [7, 2, '11:00', '11:25', 'confirmed', MITARB], [1, 0, '13:30', '14:15', 'confirmed', MITARB],
];
const bookingRow = ([p, s, von, bis, status, mitarb], i, tag = TAG) => ({
  id: uid('4', i + 1 + (tag === TAG ? 0 : 100)), user_id: OWNER, owner_id: OWNER, business_id: null,
  employee_id: mitarb || OWNER, staff_id: mitarb || OWNER, lead_id: leads[p].id, service_id: services[s].id,
  services: clone(services[s]), leads: clone(leads[p]), customer_name: leads[p].name, customer_phone: leads[p].phone,
  customer_email: leads[p].email, start_time: zeit(tag, von), end_time: zeit(tag, bis), status,
  verordnung_id: null, prescription_id: null, hausbesuch: false, notes: null, created_at: plusTage(-7) + 'T08:00:00Z',
  color: services[s].color, source: 'manual',
});
const bookings = [
  ...TERMINE.map((t, i) => bookingRow(t, i)),
  ...TERMINE.slice(0, 5).map((t, i) => bookingRow(t, i, plusTage(1))),
  ...TERMINE.slice(2, 6).map((t, i) => bookingRow(t, i + 20, plusTage(-3))),
];

const VO = [ // [patient, gueltig_bis-Offset, einheiten gesamt, erledigt, status]
  [0, -2, 6, 5, 'in_behandlung'], [1, 4, 6, 3, 'in_behandlung'], [2, 6, 3, 1, 'in_behandlung'],
  [3, 21, 6, 0, 'confirmed'], [4, 40, 6, 6, 'abgeschlossen'], [6, 12, 4, 2, 'in_behandlung'],
];
const prescriptions = VO.map(([p, off, ges, erl, status], i) => ({
  id: uid('5', i + 1), owner_id: OWNER, user_id: OWNER, patient_id: leads[p].id, lead_id: leads[p].id,
  patient_name: leads[p].name, therapie_bereich: 'podo', status, abrechnung_status: status === 'abgeschlossen' ? 'bereit' : 'offen',
  rezeptart: 'kassen', ausstellungsdatum: plusTage(off - 60), gueltig_bis: plusTage(off), behandlungsbeginn: plusTage(off - 55),
  heilmittel: 'Podologische Komplexbehandlung', heilmittel_position: '78010', heilmittel_items: [],
  anzahl_einheiten: ges, behandlungseinheiten: ges, einheiten_erledigt: erl, sessions_done: erl, frequenz: '1x alle 4 Wochen',
  diagnosegruppe: 'DF', icd10: 'E11.74', leitsymptomatik: 'a', hausbesuch: false, is_dringend: false,
  zuzahlung_befreit: false, krankenkasse: leads[p].krankenkasse, krankenkasse_ik: leads[p].krankenkasse_ik,
  kostentraeger_ik: leads[p].kostentraeger_ik, doctor_name: 'Dr. med. Erfunden', created_at: plusTage(off - 58) + 'T09:00:00Z',
  leads: clone(leads[p]), podologie_behandlungen: [], prescription_sessions: [],
}));

const invoices = [0, 1, 2, 3].map((i) => ({
  id: uid('6', i + 1), owner_id: OWNER, user_id: OWNER, lead_id: leads[i + 2].id, patient_name: leads[i + 2].name,
  invoice_number: 'RE-2026-' + String(101 + i), rechnungsnummer: 'RE-2026-' + String(101 + i),
  total: [42, 84, 28.4, 126][i], amount: [42, 84, 28.4, 126][i], status: ['bezahlt', 'offen', 'offen', 'ueberfaellig'][i],
  invoice_date: plusTage(-10 * (i + 1)), due_date: plusTage(14 - 10 * (i + 1)), created_at: plusTage(-10 * (i + 1)) + 'T10:00:00Z',
}));

const workingHours = Array.from({ length: 7 }, (_, d) => ({
  id: uid('7', d + 1), user_id: OWNER, owner_id: OWNER, employee_id: OWNER, business_id: null, day_of_week: d,
  start_time: '08:00:00', end_time: d === 5 ? '13:00:00' : '17:00:00', is_active: d >= 1 && d <= 5, is_open: d >= 1 && d <= 5,
}));

const voll = {
  profiles: [ownerProfil, mitarbProfil], businesses: [{ id: BIZ, owner_id: OWNER, name: 'Podologie Musterpraxis', business_name: 'Podologie Musterpraxis', is_default: true, is_active: true }],
  leads, services, bookings, prescriptions, invoices, working_hours: workingHours,
  employee_business_assignments: [{ id: uid('8', 1), employee_id: MITARB, business_id: BIZ, owner_id: OWNER, is_active: true }],
  aerzte: [{ id: uid('9', 1), owner_id: OWNER, name: 'Dr. med. Erfunden', lanr: '999999900', bsnr: '999999900', fachgebiet: 'Allgemeinmedizin' }],
  terapeut_zertifikat: [{ id: uid('9', 3), owner_id: OWNER, ik_nummer: '999999999', valid_until: '2099-12-31', gueltig_bis: '2099-12-31' }],
  warteliste: [{ id: uid('9', 2), owner_id: OWNER, lead_id: leads[5].id, patient_name: leads[5].name, wunsch: 'vormittags', created_at: plusTage(-2) + 'T09:00:00Z', status: 'offen' }],
};
const leer = {
  profiles: [ownerProfil, mitarbProfil], businesses: voll.businesses, working_hours: workingHours,
  employee_business_assignments: voll.employee_business_assignments,
};
// Große Praxis: dieselben Bausteine, vervielfacht und deterministisch benannt.
function grossePraxis() {
  const VN = ['Anna', 'Bernd', 'Clara', 'Dieter', 'Elke', 'Frank', 'Gisela', 'Heinz', 'Ilse', 'Jürgen', 'Karin', 'Lothar'];
  const NN = ['Albrecht', 'Brandt', 'Conrad', 'Dorn', 'Engel', 'Fuchs', 'Graf', 'Hahn', 'Ihle', 'Jansen', 'Krüger', 'Lange', 'Mertens', 'Nowak', 'Ott', 'Peters', 'Quast', 'Roth', 'Seidel', 'Thiel'];
  const viele = Array.from({ length: 240 }, (_, i) => ({ ...clone(leads[i % leads.length]), id: uid('2', 100 + i),
    first_name: VN[i % VN.length], last_name: NN[(i * 7) % NN.length], name: `${VN[i % VN.length]} ${NN[(i * 7) % NN.length]}`,
    patientennummer: 'P-' + String(2001 + i) }));
  const termine = Array.from({ length: 30 }, (_, i) => {
    const min = 7 * 60 + 30 + (i % 10) * 50, mitarb = i % 3 === 0 ? OWNER : MITARB;
    const hm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
    return { ...bookingRow([i % 8, i % 4, hm(min), hm(min + 40), i < 9 ? 'completed' : 'confirmed', mitarb], 200 + i),
      lead_id: viele[i].id, leads: clone(viele[i]), customer_name: viele[i].name };
  });
  const vos = Array.from({ length: 80 }, (_, i) => ({ ...clone(prescriptions[i % prescriptions.length]), id: uid('5', 100 + i),
    patient_id: viele[i].id, lead_id: viele[i].id, patient_name: viele[i].name, leads: clone(viele[i]),
    gueltig_bis: plusTage((i % 50) - 10), einheiten_erledigt: i % 7, anzahl_einheiten: 6 }));
  const rechnungen = Array.from({ length: 60 }, (_, i) => ({ ...clone(invoices[i % invoices.length]), id: uid('6', 100 + i),
    invoice_number: 'RE-2026-' + String(201 + i), rechnungsnummer: 'RE-2026-' + String(201 + i), patient_name: viele[i].name }));
  return { ...voll, leads: viele, bookings: [...bookings, ...termine], prescriptions: vos, invoices: rechnungen };
}
const FEHLER = SZENARIO === 'fehler';
const BOOT_TABELLEN = new Set(['profiles', 'businesses', 'employee_business_assignments', 'module_visibility', 'user_preferences', 'working_hours']);
const LANGSAM_MS = SZENARIO === 'langsam' ? 2500 : 0;
const tabellen = SZENARIO === 'leer' ? leer : SZENARIO === 'gross' ? grossePraxis() : voll;

const wertAn = (row, key) => key.split('.').reduce((o, k) => o?.[k], row);
function vergleiche(row, key, op, value) {
  const got = wertAn(row, key);
  switch (op) {
    case 'eq': return got === value || (got != null && String(got) === String(value));
    case 'neq': return got !== value;
    case 'is': return value === null ? got == null : got === value;
    case 'in': return (Array.isArray(value) ? value : String(value).replace(/^\(|\)$/g, '').split(',')).map(String).includes(String(got));
    case 'gt': return got != null && got > value;
    case 'gte': return got != null && got >= value;
    case 'lt': return got != null && got < value;
    case 'lte': return got != null && got <= value;
    case 'like': case 'ilike': {
      const re = String(value).split('%').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
      return new RegExp('^' + re + '$', op === 'ilike' ? 'i' : '').test(String(got ?? ''));
    }
    default: return true; // unbekannter Operator: nachsichtig, nicht filtern
  }
}

class Abfrage {
  constructor(tabelle) { this.tabelle = tabelle; this.filter = []; this.sort = []; this.art = 'liste'; this.schreib = null; }
  select(sp = '*', opts = {}) { this.opts = opts; return this; }
  _f(op, k, v, neg = false) { this.filter.push((r) => (neg ? !vergleiche(r, k, op, v) : vergleiche(r, k, op, v))); return this; }
  eq(k, v) { return this._f('eq', k, v); } neq(k, v) { return this._f('neq', k, v); } is(k, v) { return this._f('is', k, v); }
  in(k, v) { return this._f('in', k, v); } gt(k, v) { return this._f('gt', k, v); } gte(k, v) { return this._f('gte', k, v); }
  lt(k, v) { return this._f('lt', k, v); } lte(k, v) { return this._f('lte', k, v); }
  like(k, v) { return this._f('like', k, v); } ilike(k, v) { return this._f('ilike', k, v); }
  not(k, op, v) { return this._f(op, k, v, true); }
  // or/filter/match/contains/textSearch: nicht ausgewertet, nachsichtig
  or() { return this; } filter() { return this; } match() { return this; } contains() { return this; }
  containedBy() { return this; } overlaps() { return this; } textSearch() { return this; } abortSignal() { return this; }
  order(k, o = {}) { this.sort.push([k, o]); return this; }
  limit(n) { this.max = n; return this; } range(a, b) { this.ab = a; this.max = b - a + 1; return this; }
  single() { this.art = 'single'; return this; } maybeSingle() { this.art = 'maybeSingle'; return this; }
  csv() { return this; } returns() { return this; }
  insert(d) { this.schreib = ['insert', d]; return this; } upsert(d) { this.schreib = ['upsert', d]; return this; }
  update(d) { this.schreib = ['update', d]; return this; } delete() { this.schreib = ['delete']; return this; }
  then(ok, fail) {
    // Szenario 'langsam' bremst nur Fachdaten; Start-Tabellen antworten sofort (sonst startet die App nie).
    const bremsen = LANGSAM_MS && !this.schreib && !BOOT_TABELLEN.has(this.tabelle);
    const warten = bremsen ? new Promise((r) => setTimeout(r, LANGSAM_MS)) : Promise.resolve();
    return warten.then(() => this.lauf()).then(ok, fail);
  }
  lauf() {
    if (this.schreib) {
      log.writes.push({ tabelle: this.tabelle, art: this.schreib[0] });
      return { data: null, error: { message: 'Redesign-Fixture: nur lesend', code: 'RS_READONLY' } };
    }
    log.reads.push(this.tabelle);
    // Szenario 'fehler': Fachdaten scheitern, Start-Tabellen nicht (sonst lädt die App gar nicht).
    if (FEHLER && !BOOT_TABELLEN.has(this.tabelle)) return { data: null, error: { message: 'Redesign-Fixture: Szenario fehler', code: 'RS_FEHLER' } };
    if (!Object.hasOwn(tabellen, this.tabelle)) log.unbekannt.push(this.tabelle);
    let rows = clone(tabellen[this.tabelle] || []).filter((r) => this.filter.every((f) => f(r)));
    const anzahl = rows.length;
    for (const [k, o] of [...this.sort].reverse()) {
      rows.sort((a, b) => {
        const x = wertAn(a, k), y = wertAn(b, k);
        if (x === y) return 0;
        if (x == null) return 1; if (y == null) return -1;
        return (x < y ? -1 : 1) * (o.ascending === false ? -1 : 1);
      });
    }
    rows = rows.slice(this.ab || 0, this.max == null ? undefined : (this.ab || 0) + this.max);
    if (this.opts?.head) return { data: null, error: null, count: anzahl };
    if (this.art === 'single' && rows.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'Fixture: keine Zeile' } };
    const data = this.art === 'liste' ? rows : rows[0] || null;
    return { data, error: null, ...(this.opts?.count ? { count: anzahl } : {}) };
  }
}

const kanal = () => { const k = { on: () => k, subscribe: (cb) => { try { cb?.('SUBSCRIBED'); } catch { /* egal */ } return k; },
  unsubscribe: async () => 'ok', send: async () => 'ok', track: async () => 'ok' }; return k; };

export function createClient() {
  const auth = {
    getSession: async () => ({ data: { session: clone(session) }, error: null }),
    getUser: async () => ({ data: { user: clone(user) }, error: null }),
    onAuthStateChange: (cb) => { setTimeout(() => { try { cb?.('INITIAL_SESSION', clone(session)); } catch { /* egal */ } }, 0);
      return { data: { subscription: { unsubscribe() {} } } }; },
    refreshSession: async () => ({ data: { session: clone(session), user: clone(user) }, error: null }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ data: null, error: { message: 'Redesign-Fixture: nur lesend' } }),
    mfa: { listFactors: async () => ({ data: { all: [], totp: [] }, error: null }),
      getAuthenticatorAssuranceLevel: async () => ({ data: { currentLevel: 'aal1', nextLevel: 'aal1' }, error: null }) },
  };
  return {
    auth,
    from: (t) => new Abfrage(t),
    rpc: async (name) => {
      log.rpc.push(name);
      const start = ['get_default_business', 'get_my_permissions'].includes(name);
      if (LANGSAM_MS && !start) await new Promise((r) => setTimeout(r, LANGSAM_MS));
      // Auch im Szenario 'fehler' muss die App starten können (Rechte, Standort); sonst gibt es nichts zu prüfen.
      if (FEHLER && !start) return { data: null, error: { message: 'Redesign-Fixture: Szenario fehler' } };
      if (name === 'get_default_business') return { data: BIZ, error: null };
      // Mitarbeiter-Rechte: alles außer Abrechnung (so wie eine typische Therapeutin eingerichtet ist).
      if (name === 'get_my_permissions') {
        return { data: ['dashboard', 'calendar', 'customers', 'services', 'hours', 'team', 'notes', 'anamnese', 'prescriptions',
          'fahrtenbuch', 'b2b', 'b2c', 'feedback', 'settings', 'abrechnung']
          .map((module) => ({ module, has_access: module !== 'abrechnung' })), error: null };
      }
      return { data: null, error: null };
    },
    channel: () => kanal(), removeChannel: async () => 'ok', removeAllChannels: async () => [], getChannels: () => [],
    storage: { from: (b) => ({
      getPublicUrl: (p) => ({ data: { publicUrl: 'data:,' + encodeURIComponent(String(p)) } }),
      createSignedUrl: async () => { log.storage.push(b); return { data: null, error: { message: 'Fixture' } }; },
      download: async () => { log.storage.push(b); return { data: null, error: { message: 'Fixture' } }; },
      list: async () => ({ data: [], error: null }),
      upload: async () => { log.storage.push(b); return { data: null, error: { message: 'Redesign-Fixture: nur lesend' } }; },
      remove: async () => { log.storage.push(b); return { data: null, error: { message: 'Redesign-Fixture: nur lesend' } }; },
    }) },
    functions: { invoke: async (n) => { log.functions.push(n); return { data: null, error: { message: 'Fixture' } }; } },
  };
}
