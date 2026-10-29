import { findPosition, PREISSTAND } from '../../../api-backend/billing/codes/physio_positions.js';

// Ausschließlich erfundene lokale Vorführdaten. Kein DB-Zugriff, keine Tarifpflege.
export const DEMO_IDS = Object.freeze({
  owner: '10000000-0000-4000-8000-000000000001',
  employee: '10000000-0000-4000-8000-000000000002',
  business: '10000000-0000-4000-8000-000000000003',
});
export const PREISQUELLE = `Lokaler Physio-Katalog, Preisstand ${PREISSTAND}; keine aktuelle Tarif-/Abrechnungsfreigabe`;
const id = (gruppe, n) => `${gruppe}000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Tabellen-Overrides für redesign-fixture.js; Beziehungen bleiben JSON-serialisierbar. */
export function erstellePhysioDaten({ tag = '2026-10-30' } = {}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tag) || !Number.isFinite(Date.parse(`${tag}T12:00:00Z`)) || new Date(`${tag}T12:00:00Z`).toISOString().slice(0, 10) !== tag) {
    throw new TypeError('Ungültiger Demo-Kalendertag');
  }
  const { owner, employee, business } = DEMO_IDS;
  const datum = (offset) => {
    const d = new Date(`${tag}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const zeit = (d, stunde, minute = 0) => {
    const mittag = new Date(`${d}T12:00:00Z`);
    const lokalStunde = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', hour: '2-digit', hourCycle: 'h23' }).format(mittag));
    return new Date(Date.UTC(mittag.getUTCFullYear(), mittag.getUTCMonth(), mittag.getUTCDate(), stunde - (lokalStunde - 12), minute)).toISOString();
  };
  const profile = {
    id: owner, owner_id: null, role: 'owner', sector: 'physiotherapy', plan: 'professional', plan_status: 'active',
    is_active: true, business_name: 'Physiotherapie Demo am Park', full_name: 'Alex Demo', first_name: 'Alex', last_name: 'Demo',
    owner_first_name: 'Alex', owner_last_name: 'Demo', email: 'alex.demo@example.invalid', onboarding_completed: true,
    company_code: 'PHYSIODEMO', booking_slug: 'physio-demo-lokal', street: 'Beispielweg 1', postal_code: '00000', city: 'Demostadt',
    ik_nummer: '999999999', language: 'de', betriebsart: 'test', created_at: `${datum(-90)}T09:00:00Z`,
  };
  const profiles = [profile, { ...profile, id: employee, owner_id: owner, role: 'employee', business_id: business,
    full_name: 'Kim Test', first_name: 'Kim', last_name: 'Test', email: 'kim.test@example.invalid', business_name: null }];
  const namen = [['Anna', 'Beispiel'], ['Ben', 'Muster'], ['Clara', 'Test'], ['David', 'Fiktiv'], ['Ella', 'Probe'],
    ['Felix', 'Demopatient'], ['Greta', 'Musterfall'], ['Hannes', 'Testperson'], ['Ida', 'Beispielperson'], ['Jonas', 'Vorführung']];
  const leads = namen.map(([first_name, last_name], i) => ({
    id: id('2', i + 1), user_id: owner, owner_id: owner, business_id: null, first_name, last_name,
    name: `${first_name} ${last_name}`, title: `${first_name} ${last_name}`, email: `physio.patient${i + 1}@example.invalid`,
    phone: '+49 000 00000' + i, geburtsdatum: `${1975 + i}-04-12`, birth_date: `${1975 + i}-04-12`,
    patientennummer: `PHY-${1001 + i}`, insurance_type: i === 9 ? 'privat' : 'gkv', krankenkasse: i === 9 ? 'privat' : 'Kasse Synthetisch',
    krankenkasse_ik: '999999999', kostentraeger_ik: '999999999', versichertennummer: `X00000000${i}`,
    status: 'aktiv', source: 'manuell', is_active: true, street: `Beispielweg ${i + 2}`, postal_code: '00000', city: 'Demostadt',
    notes: 'Erfundener Vorführdatensatz. Keine echte Patientenakte.', tags: [], created_at: `${datum(-30)}T09:00:00Z`,
  }));
  const auswahl = [['X0501', 20, null], ['X1201', 20, 'MT'], ['X0507', 60, 'KGG'], ['X0205', 30, 'MLD'], ['X0106', 20, null]];
  const services = auswahl.map(([code, dauer, zertifikat], i) => {
    const p = findPosition(code, '22', tag);
    if (!p || p.ausserhalb_preisfenster) throw new RangeError(`Kein belegtes Preisfenster für ${code} am ${tag}`);
    return { id: id('3', i + 1), user_id: owner, owner_id: owner, business_id: null, title: p.label, name: p.label,
      code, gkv_position_nr: code, duration_minutes: dauer, duration: dauer, price: String(p.preis),
      price_config: { durations: { [dauer]: { active: true, price: p.preis } } },
      description: `Synthetische Demo; ${PREISQUELLE}. Termindauer ist Demo-Praxiseinstellung.`,
      color: ['#39736B', '#526D91', '#7B6597', '#39736B', '#526D91'][i], category: 'GKV', kostentraeger_typ: 'gkv',
      is_active: true, is_internal: false, is_group: code === 'X0507', group_capacity: code === 'X0507' ? 3 : 1,
      required_certificate: zertifikat, sort_order: i };
  });
  const bookings = [], prescription_sessions = [];
  const prescriptions = [0, 1, 2, 3, 4, 5].map((i) => {
    const patient = leads[i], service = services[i % services.length];
    const done = [2, 1, 0, 3, 6, 0][i], status = done === 6 ? 'completed' : done ? 'in_therapy' : 'confirmed';
    const rx = {
      id: id('5', i + 1), owner_id: owner, user_id: owner, patient_id: patient.id, lead_id: patient.id, business_id: null,
      patient_name: patient.name, therapie_bereich: 'physio', status, abrechnung_status: status === 'completed' ? 'bereit' : null,
      rezeptart: 'kassen', rezept_typ: 'standard', is_blanko: false, is_lhb_bvb: false, ausstellungsdatum: datum(-14),
      behandlungsbeginn: done ? datum(-10) : null, heilmittel: service.code === 'X0501' ? 'KG' : service.code === 'X1201' ? 'MT' : service.title,
      heilmittel_position: service.code, heilmittel_items: [], anzahl_einheiten: 6, frequenz: '1-2x wöchentlich',
      diagnosegruppe: 'EX', icd10: 'M25.56', leitsymptomatik: 'a', hausbesuch: false, is_dringend: false,
      zuzahlung_befreit: false, krankenkasse: patient.krankenkasse, kostentraeger_ik: patient.kostentraeger_ik,
      doctor_name: 'Dr. Demo Beispiel', verordnungsnummer: 100 + i, created_at: `${datum(-14)}T09:00:00Z`,
      leads: { ...patient }, podologie_behandlungen: [], prescription_sessions: [],
    };
    for (let n = 0; n < 6; n++) {
      const vergangen = n < done, geplant = n < Math.max(done, 3);
      const day = datum(vergangen ? -10 + n : n * 3), start = zeit(day, 8 + i);
      const booking = geplant ? {
        id: id('4', i * 10 + n + 1), owner_id: owner, user_id: owner, business_id: null,
        employee_id: i % 2 ? employee : owner, staff_id: i % 2 ? employee : owner,
        lead_id: patient.id, service_id: service.id, start_time: start,
        end_time: new Date(Date.parse(start) + service.duration_minutes * 60000).toISOString(),
        status: vergangen ? 'completed' : 'confirmed', customer_name: patient.name, customer_phone: patient.phone,
        customer_email: patient.email, services: { ...service }, leads: { ...patient }, verordnung_id: null,
        // Patiententermin ist immer eine Einzelbuchung: is_group:true wäre ein Gruppen-Elternslot ohne Patient (Kalender zeigt dann „Freier Gruppenslot 0/3“).
        hausbesuch: false, is_group: false, group_capacity: 1, group_parent_id: null,
        source: 'manual', notes: vergangen ? 'Synthetische Behandlungsdokumentation: Verlauf besprochen, Übungen angeleitet.' : null,
      } : null;
      if (booking) bookings.push(booking);
      const s = { id: id('8', i * 10 + n + 1), prescription_id: rx.id, booking_id: booking?.id || null,
        session_number: n + 1, status: vergangen ? 'done' : 'planned', heilmittel_index: 0,
        done_at: vergangen ? booking.end_time : null, notes: vergangen ? booking.notes : null,
        created_at: `${datum(-14)}T09:00:00Z`, bookings: booking ? { ...booking } : null };
      prescription_sessions.push(s); rx.prescription_sessions.push(structuredClone(s));
    }
    return rx;
  });
  const therapist_certificates = [owner, employee].flatMap((profile_id, i) => ['MT', 'MLD', 'KGG'].map((certificate, n) => ({
    id: id('9', 20 + i * 3 + n), owner_id: owner, profile_id, certificate,
  })));
  return {
    profiles, businesses: [{ id: business, owner_id: owner, name: profile.business_name, business_name: profile.business_name, is_default: true, is_active: true }],
    leads, services, bookings, prescriptions, prescription_sessions, therapist_certificates,
    podologie_behandlungen: [], invoices: [], rechnung_zahlungen: [], patient_notes: [], anamnese: [], patient_anamnese_physio: [],
    // Absichtlich kein erfundener gültiger Kostenträger und kein künstlicher Validierungspass.
    kostentraeger: [], krankenkassen: [], prescription_validations: [],
    employee_services: [owner, employee].flatMap((employee_id, i) => services.map((s, n) => ({
      id: id('9', 40 + i * services.length + n), employee_id, service_id: s.id, business_id: null,
    }))),
    working_hours: [owner, employee].flatMap((employee_id, i) => Array.from({ length: 7 }, (_, day_of_week) => ({
      id: id('7', i * 10 + day_of_week + 1), owner_id: owner, user_id: employee_id, employee_id, business_id: null,
      day_of_week, start_time: '08:00:00', end_time: '17:00:00', is_active: day_of_week >= 1 && day_of_week <= 5, is_open: day_of_week >= 1 && day_of_week <= 5,
    }))),
    employee_business_assignments: [{ id: id('9', 1), employee_id: employee, business_id: business, owner_id: owner, is_active: true }],
    aerzte: [{ id: id('9', 2), owner_id: owner, name: 'Dr. Demo Beispiel', arzt_name: 'Dr. Demo Beispiel', lanr: '999999900', bsnr: '999999900' }],
    warteliste: [],
  };
}
