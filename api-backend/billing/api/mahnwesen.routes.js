// Mahnwesen (dunning) HTTP routes.
//
// GET  /api/billing/mahnwesen/offene        — prescriptions eligible for dunning
// POST /api/billing/mahnwesen/create        — create + render a Mahnung letter (HTML)
// PATCH /api/billing/mahnwesen/:id/status   — mark mahnung bezahlt / abgeschrieben

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { renderMahnung } from '../pdf/mahnung.template.js';
import { istZuzahlungBezahlt, saldoJeRezept } from '../zuzahlung/bezahlt.js';
import { pruefeStufe, LEVEL_DAYS } from '../mahnwesen/stufe.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- shared auth helper ----------

async function resolveAuth(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role, owner_id, business_name, phone, city, zip, street, house_number, ik_number, email, bank_name, iban, bic')
    .eq('id', u.user.id)
    .maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

// ---------- neue_faelligkeit helper ----------

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Zahlungsziel der Ausfallrechnung — identisch zu ausfall.routes.js.
const AUSFALL_ZAHLUNGSZIEL_TAGE = 14;

// ============================================================================
// GET /api/billing/mahnwesen/offene
// Rezepte mit offener Zuzahlung UND offene Ausfallrechnungen, deren Fälligkeit
// überschritten ist. Beide Forderungsarten in einer Liste, unterschieden durch
// das Feld `art`.
// ============================================================================
router.get('/mahnwesen/offene', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    // 1. Fetch prescriptions with unpaid Zuzahlung that have been billed
    const { data: rxRows, error: rxErr } = await supabase
      .from('prescriptions')
      .select(`
        id, owner_id, patient_id, zuzahlung_eur, zuzahlung_befreit,
        abrechnung_id, ausstellungsdatum, zuzahlung_kassiert_am,
        leads:patient_id (first_name, last_name, versichertennummer, street, plz, city)
      `)
      .eq('owner_id', tenantId)
      .gt('zuzahlung_eur', 0)
      .eq('zuzahlung_befreit', false)
      .not('abrechnung_id', 'is', null);

    if (rxErr) return res.status(500).json({ error: rxErr.message });

    // Kein frueher Ausstieg mehr, wenn es keine offenen Rezepte gibt — sonst
    // blieben die Ausfallrechnungen weiter unsichtbar.
    const rxIds = (rxRows || []).map(r => r.id);

    // 2. Bezahlt-Status je Rezept. Die Regel steht in zuzahlung/bezahlt.js,
    //    damit Mahnwesen und Statistik nicht auseinanderlaufen — genau das war
    //    vorher der Fall.
    //    Ein Fehler bei dieser Abfrage darf NICHT durchrutschen: ohne Belege
    //    saehe jedes Rezept unbezahlt aus und alle Patienten bekaemen eine
    //    Mahnung.
    let paidEntries = [];
    if (rxIds.length > 0) {
      const { data, error: belegErr } = await supabase
        .from('belegliste')
        .select('prescription_id, amount_eur')
        .eq('owner_id', tenantId)
        .in('type', ['zuzahlung', 'storno'])
        .in('prescription_id', rxIds);
      if (belegErr) return res.status(500).json({ error: 'belegliste: ' + belegErr.message });
      paidEntries = data || [];
    }

    const saldoByRx = saldoJeRezept(paidEntries);
    const paidRxIds = new Set(
      (rxRows || [])
        .filter(rx => istZuzahlungBezahlt({
          zuzahlungEur: rx.zuzahlung_eur,
          kassiertAm: rx.zuzahlung_kassiert_am,
          saldo: saldoByRx.get(rx.id) || 0,
        }))
        .map(rx => rx.id)
    );

    // 3. Offene Ausfallrechnungen, deren Zahlungsziel überschritten ist.
    //    Ausfallhonorar ist eine Privatforderung — sie darf genauso gemahnt
    //    werden wie eine offene Zuzahlung, hatte aber bisher keinen Weg dorthin.
    const { data: afRows, error: afErr } = await supabase
      .from('ausfallrechnungen')
      .select(`
        id, rechnung_nr, amount_eur, status, created_at, leistung_datum, service_name,
        leads:patient_id (first_name, last_name, street, plz, city)
      `)
      .eq('owner_id', tenantId)
      .eq('status', 'offen');
    if (afErr) return res.status(500).json({ error: 'ausfallrechnungen: ' + afErr.message });

    const jetzt = Date.now();
    const afFaellig = (afRows || []).filter(af => {
      if (!af.created_at) return false;
      const faellig = addDays(new Date(af.created_at), AUSFALL_ZAHLUNGSZIEL_TAGE);
      return faellig.getTime() <= jetzt;
    });

    // 4. Bisherige Mahnungen zu beiden Forderungsarten
    const afIds = afFaellig.map(a => a.id);
    let mahnungen = [];
    if (rxIds.length > 0 || afIds.length > 0) {
      const filter = [
        rxIds.length ? `prescription_id.in.(${rxIds.join(',')})` : null,
        afIds.length ? `ausfallrechnung_id.in.(${afIds.join(',')})` : null,
      ].filter(Boolean).join(',');
      const { data } = await supabase
        .from('mahnungen')
        // id muss mit: das Frontend hängt daran die Knöpfe "Bezahlt" und
        // "Abschreiben" (data-mw). Ohne id war das undefined und beide
        // Knöpfe liefen ins Leere.
        .select('id, prescription_id, ausfallrechnung_id, level, status, sent_at')
        .eq('owner_id', tenantId)
        .or(filter)
        // sent_at, nicht created_at: die Tabelle mahnungen hat kein created_at
        // (database_v28_mahnwesen.sql). Die Sortierung lief bisher ins Leere und
        // die Mahnstufe wurde deshalb nie angezeigt.
        .order('sent_at', { ascending: false });
      mahnungen = data || [];
    }

    // Build a map: Quellen-ID → letzte Mahnung
    const latestMahnung = new Map();
    for (const m of mahnungen) {
      const key = m.prescription_id || m.ausfallrechnung_id;
      if (key && !latestMahnung.has(key)) {
        latestMahnung.set(key, {
          id: m.id,
          level: m.level,
          status: m.status,
          sent_at: m.sent_at,
        });
      }
    }

    // 5. Build response — exclude paid prescriptions
    const result = (rxRows || [])
      .filter(rx => !paidRxIds.has(rx.id))
      .map(rx => ({
        art: 'zuzahlung',
        id: rx.id,
        patient: {
          first_name: rx.leads?.first_name || '',
          last_name:  rx.leads?.last_name  || '',
        },
        // Nur der Restbetrag wird gemahnt. Seit die Bezahlt-Pruefung den vollen
        // Betrag verlangt, tauchen Teilzahler wieder in dieser Liste auf — mit
        // rx.zuzahlung_eur wuerde die Mahnung Geld fordern, das schon da ist.
        zuzahlung_eur:    Math.round((rx.zuzahlung_eur - (saldoByRx.get(rx.id) || 0)) * 100) / 100,
        zuzahlung_gesamt: rx.zuzahlung_eur,
        bereits_gezahlt:  Math.round((saldoByRx.get(rx.id) || 0) * 100) / 100,
        abrechnung_id:    rx.abrechnung_id,
        ausstellungsdatum: rx.ausstellungsdatum,
        latest_mahnung:   latestMahnung.get(rx.id) || null,
      }));

    for (const af of afFaellig) {
      result.push({
        art: 'ausfall',
        id: af.id,
        patient: {
          first_name: af.leads?.first_name || '',
          last_name:  af.leads?.last_name  || '',
        },
        // Auf eine Ausfallrechnung gibt es keine Teilzahlungen im Kassenbuch —
        // sie ist offen oder bezahlt. Deshalb ist der offene Betrag der volle.
        zuzahlung_eur:    Number(af.amount_eur),
        zuzahlung_gesamt: Number(af.amount_eur),
        bereits_gezahlt:  0,
        rechnung_nr:      `AF-${String(af.rechnung_nr).padStart(4, '0')}`,
        leistung_datum:   af.leistung_datum,
        service_name:     af.service_name,
        ausstellungsdatum: af.created_at,
        latest_mahnung:   latestMahnung.get(af.id) || null,
      });
    }

    return res.json(result);
  } catch (e) {
    console.error('[mahnwesen/offene]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// POST /api/billing/mahnwesen/create
// Body: { prescriptionId, level } ODER { ausfallrechnungId, level }
// Genau eine der beiden Quellen. Returns text/html Mahnung letter.
// ============================================================================
router.post('/mahnwesen/create', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { user, profile, tenantId } = auth;

    const { prescriptionId, ausfallrechnungId, level } = req.body || {};
    if (!prescriptionId && !ausfallrechnungId) {
      return res.status(400).json({ error: 'prescriptionId oder ausfallrechnungId erforderlich' });
    }
    if (prescriptionId && ausfallrechnungId) {
      return res.status(400).json({ error: 'Nur eine Forderung je Mahnung: entweder Rezept oder Ausfallrechnung.' });
    }
    const istAusfall = !!ausfallrechnungId;

    // 1. Forderung laden und prüfen
    let rx = null, af = null, patientRow = null, quelleId = null;

    if (istAusfall) {
      const { data, error } = await supabase
        .from('ausfallrechnungen')
        .select(`
          id, owner_id, patient_id, amount_eur, status, created_at, rechnung_nr,
          leads:patient_id (first_name, last_name, street, plz, city)
        `)
        .eq('id', ausfallrechnungId)
        .maybeSingle();
      if (error || !data) return res.status(404).json({ error: 'Ausfallrechnung nicht gefunden' });
      if (data.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
      if (data.status !== 'offen') {
        return res.status(400).json({ error: 'Diese Ausfallrechnung ist nicht mehr offen.' });
      }
      af = data; patientRow = data.leads; quelleId = data.id;
    } else {
      const { data, error: rxErr } = await supabase
        .from('prescriptions')
        .select(`
          id, owner_id, patient_id, zuzahlung_eur, zuzahlung_befreit,
          abrechnung_id, ausstellungsdatum,
          leads:patient_id (first_name, last_name, street, plz, city, versichertennummer)
        `)
        .eq('id', prescriptionId)
        .maybeSingle();

      if (rxErr || !data) return res.status(404).json({ error: 'Prescription not found' });
      if (data.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
      if (!data.abrechnung_id) return res.status(400).json({ error: 'Prescription not yet billed' });
      if (data.zuzahlung_befreit || !(data.zuzahlung_eur > 0)) {
        return res.status(400).json({ error: 'No unpaid Zuzahlung on this prescription' });
      }
      rx = data; patientRow = data.leads; quelleId = data.id;
    }

    // 1b. Mahnstufe gegen die Historie prüfen. Vorher bestimmte der Aufrufer sie
    //     frei — Stufe 3 ("letzte Mahnung", kündigt das Inkassobüro an) liess
    //     sich als allererste Mahnung verschicken.
    const { data: bisherige } = await supabase
      .from('mahnungen')
      .select('level')
      .eq('owner_id', tenantId)
      .eq(istAusfall ? 'ausfallrechnung_id' : 'prescription_id', quelleId);

    const stufenPruefung = pruefeStufe(level, bisherige || []);
    if (!stufenPruefung.ok) return res.status(400).json({ error: stufenPruefung.fehler });
    const lvl = stufenPruefung.stufe;

    // 2. Fetch owner profile for praxis details (may differ from logged-in employee)
    let praxisProfile = profile;
    if (profile.role === 'employee' && profile.owner_id) {
      const { data: ownerProf } = await supabase
        .from('profiles')
        .select('id, business_name, phone, city, zip, street, house_number, ik_number, email, bank_name, iban, bic')
        .eq('id', profile.owner_id)
        .maybeSingle();
      if (ownerProf) praxisProfile = ownerProf;
    }

    // 3. Compute neue_faelligkeit
    const now = new Date();
    const daysToAdd = LEVEL_DAYS[lvl] ?? 14;
    const neue_faelligkeit = addDays(now, daysToAdd);

    // Ursprüngliche Fälligkeit und Rechnungsnummer je Forderungsart.
    // Zuzahlung: Ausstellungsdatum + 14 Tage, Nummer wie in der
    // Zuzahlungsrechnung. Ausfall: Rechnungsdatum + 14 Tage, Nummer AF-xxxx
    // wie in ausfall.routes.js.
    const original_faelligkeit = istAusfall
      ? addDays(new Date(af.created_at), AUSFALL_ZAHLUNGSZIEL_TAGE)
      : (rx.ausstellungsdatum ? addDays(new Date(rx.ausstellungsdatum), 14) : now);

    const original_rechnung_nr = istAusfall
      ? `AF-${String(af.rechnung_nr).padStart(4, '0')}`
      : `ZU-${rx.id.slice(0, 8).toUpperCase()}`;

    const betrag = istAusfall ? Number(af.amount_eur) : rx.zuzahlung_eur;

    // 4. Insert into mahnungen (mahnung_nr auto-assigned via DB trigger → insert null/0)
    const { data: mahnungRow, error: insErr } = await supabase
      .from('mahnungen')
      .insert({
        owner_id:           tenantId,
        prescription_id:    istAusfall ? null : rx.id,
        ausfallrechnung_id: istAusfall ? af.id : null,
        patient_id:         istAusfall ? af.patient_id : rx.patient_id,
        level:              lvl,
        amount_eur:         betrag,
        original_faelligkeit: original_faelligkeit.toISOString(),
        neue_faelligkeit:   neue_faelligkeit.toISOString(),
        sent_at:            now.toISOString(),
        status:             'offen',
      })
      .select('id, mahnung_nr')
      .single();

    if (insErr) return res.status(500).json({ error: 'mahnungen insert failed: ' + insErr.message });

    // 5. Render HTML letter
    const strasse = [praxisProfile.street, praxisProfile.house_number].filter(Boolean).join(' ');
    const plz_ort = [praxisProfile.zip, praxisProfile.city].filter(Boolean).join(' ').trim();

    const bankverbindung = [
      praxisProfile.bank_name,
      praxisProfile.iban ? ('IBAN: ' + praxisProfile.iban) : null,
      praxisProfile.bic ? ('BIC: ' + praxisProfile.bic) : null
    ].filter(Boolean).join(' · ');

    const html = renderMahnung({
      praxis: {
        name:     praxisProfile.business_name || 'Praxis für Physiotherapie',
        strasse,
        plz_ort,
        telefon:  praxisProfile.phone || '',
        email:    praxisProfile.email || user.email || '',
        ik:       praxisProfile.ik_number || '',
      },
      patient: {
        vorname:  patientRow?.first_name || '',
        nachname: patientRow?.last_name  || '',
        strasse:  patientRow?.street     || '',
        plz:      patientRow?.plz        || '',
        ort:      patientRow?.city       || '',
      },
      forderungsart:          istAusfall ? 'ausfall' : 'zuzahlung',
      level:                  lvl,
      mahnung_nr:             mahnungRow.mahnung_nr ?? 0,
      amount_eur:             betrag,
      original_rechnung_nr,
      original_faelligkeit,
      neue_faelligkeit,
      bankverbindung:         bankverbindung || '',
      datum:                  now,
    });

    res.set('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  } catch (e) {
    console.error('[mahnwesen/create]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// ============================================================================
// PATCH /api/billing/mahnwesen/:id/status
// Body: { status } — 'bezahlt' | 'abgeschrieben'
//
// Setzt bewusst NUR den Status der Mahnung, nicht den der zugrunde liegenden
// Forderung. Eine bezahlte Ausfallrechnung wird über
// PATCH /billing/ausfall/:id/status gebucht — nur dort entsteht der
// GoBD-Beleglisteneintrag. Würde hier mitgezogen, fehlte der Beleg.
// ============================================================================
router.patch('/mahnwesen/:id/status', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const { status } = req.body || {};
    if (!['bezahlt', 'abgeschrieben'].includes(status)) {
      return res.status(400).json({ error: "status must be 'bezahlt' or 'abgeschrieben'" });
    }

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('mahnungen')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .maybeSingle();

    if (fetchErr || !existing) return res.status(404).json({ error: 'Mahnung not found' });
    if (existing.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    const { error: upErr } = await supabase
      .from('mahnungen')
      .update({ status })
      .eq('id', req.params.id);

    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({ ok: true });
  } catch (e) {
    console.error('[mahnwesen/status]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
