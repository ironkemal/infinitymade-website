// Gemeinsame Testdaten fuer die Terminerinnerung (synthetisch, keine echten Personen).
import { MITTEILUNG_OPTION_TEXT } from './sondertag-mitteilung.js';

export const T = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';   // Inhaber, Schalter AN
export const T2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';  // Inhaber, Schalter AUS
export const MA = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';  // Mitarbeiter-Zeile mit gesetztem Schalter (darf nicht zaehlen)
export const JA = `Kopf\n[X] ${MITTEILUNG_OPTION_TEXT}: JA`;
export const jetzt = new Date('2026-12-10T17:00:00Z');     // 18:00 MEZ, morgen = 11.12.2026
export const ENV = { SMTP_HOST: 'smtp.example.invalid' };

/** PostgREST-Fake mit Schreiben, UNIQUE (booking_id, anlass, termin_beginn) und Zaehlabfrage (head). */
export function fakeDb(tabellen, { fehlerBei = null } = {}) {
  let n = 0;
  const aufrufe = [];
  const stand = { maxIn: 0 };
  return {
    tabellen, aufrufe, stand,
    from(name) {
      aufrufe.push(name);
      const f = []; let op = 'select'; let wert = null; let head = false;
      const rows = () => (tabellen[name] ||= []);
      const treffer = () => rows().filter(r => f.every(x => x(r)));
      const b = {
        select(_c, opt) { if (opt?.head) head = true; return b; },
        eq(k, v) { f.push(r => r[k] === v); b.eqs = { ...b.eqs, [k]: v }; return b; },
        neq(k, v) { f.push(r => r[k] !== v); return b; },
        in(k, v) { stand.maxIn = Math.max(stand.maxIn, v.length); f.push(r => v.includes(r[k])); return b; },
        gte(k, v) { f.push(r => String(r[k]) >= v); return b; },
        lt(k, v) { f.push(r => String(r[k]) < v); return b; },
        lte(k, v) { f.push(r => String(r[k]) <= v); return b; },
        insert(w) { op = 'insert'; wert = w; return b; },
        update(w) { op = 'update'; wert = w; return b; },
        maybeSingle() { return b.ausfuehren(true); },
        then(ok, fehl) { return b.ausfuehren(false).then(ok, fehl); },
        async ausfuehren(einzeln) {
          await Promise.resolve(); // Verschachtelung paralleler Laeufe sichtbar machen
          if (fehlerBei?.(name, b.eqs || {}, op)) return { data: null, error: { code: 'DB_TEST_FEHLER' } };
          if (op === 'insert') {
            const dup = rows().some(r => r.booking_id === wert.booking_id && r.anlass === wert.anlass
              && new Date(r.termin_beginn).getTime() === new Date(wert.termin_beginn).getTime());
            if (dup) return { data: null, error: { code: '23505' } };
            const z = { id: `m${++n}`, created_at: jetzt.toISOString(), ...wert };
            rows().push(z);
            return { data: { id: z.id }, error: null };
          }
          if (op === 'update') {
            const t = treffer(); t.forEach(r => Object.assign(r, wert));
            return { data: einzeln ? (t[0] ? { id: t[0].id } : null) : t, error: null };
          }
          if (head) return { count: treffer().length, error: null };
          const d = treffer();
          return { data: einzeln ? d[0] || null : d, error: null };
        },
      };
      return b;
    },
  };
}

export const basis = () => ({
  profiles: [
    { id: T, role: 'owner', terminerinnerung_aktiv: true, business_name: 'Physio Test', phone: '0221 123' },
    { id: T2, role: 'owner', terminerinnerung_aktiv: false, business_name: 'Aus', phone: '1' },
    { id: MA, role: 'employee', terminerinnerung_aktiv: true, business_name: 'Mitarbeiter', phone: '2' },
  ],
  businesses: [{ id: 'biz1', owner_id: T, business_name: 'Physio Test', street: 'Weg', house_number: '1', zip: '50667', city: 'Köln' }],
  bookings: [
    { id: 'b1', owner_id: T, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'l1', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b2', owner_id: T, start_time: '2026-12-11T10:00:00Z', status: 'confirmed', lead_id: 'l2', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b3', owner_id: T, start_time: '2026-12-11T11:00:00Z', status: 'confirmed', lead_id: 'l3', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b4', owner_id: T, start_time: '2026-12-11T12:00:00Z', status: 'confirmed', lead_id: null, business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'b5', owner_id: T, start_time: '2026-12-11T13:00:00Z', status: 'cancelled', lead_id: 'l1', business_id: 'biz1', created_at: '2026-12-01T08:00:00Z' },
    { id: 'bx', owner_id: T2, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'lx', created_at: '2026-12-01T08:00:00Z' },
    { id: 'bm', owner_id: MA, start_time: '2026-12-11T09:00:00Z', status: 'confirmed', lead_id: 'lm', created_at: '2026-12-01T08:00:00Z' },
  ],
  leads: [
    { id: 'l1', owner_id: T, email: 'patient-eins@example.invalid' },
    { id: 'l2', owner_id: T, email: 'patient-zwei@example.invalid' },
    { id: 'l3', owner_id: T, email: 'keine adresse, a@b.de' },
    { id: 'lx', owner_id: T2, email: 'fremd@example.invalid' },
    { id: 'lm', owner_id: MA, email: 'ma@example.invalid' },
  ],
  patient_consents: [
    { patient_id: 'l1', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'l2', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v5-2026-10-30', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'l3', owner_id: T, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'lx', owner_id: T2, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
    { patient_id: 'lm', owner_id: MA, consent_type: 'datenschutz', text_version: 'datenschutz-v6-2026-11-05', text_snapshot: JA, consented_at: '2026-11-06', revoked_at: null },
  ],
  termin_mitteilungen: [],
});

