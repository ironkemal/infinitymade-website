// Zuzahlung nachtraeglich korrigieren und Guthaben verrechnen.
//
//   POST /api/billing/zuzahlung/korrektur
//   GET  /api/billing/zuzahlung/guthaben?patient_id=…
//   POST /api/billing/zuzahlung/guthaben/:id/verrechnen
//
// Warum eigene Datei: das ist ein Schreibweg auf bares Geld mit GoBD-Protokoll.
// In abrechnung.routes.js (2400 Zeilen) waere er nicht wiederzufinden, und die
// drei Regeln, die hier zaehlen, gingen zwischen Druckvorlagen unter.
//
// Die drei Regeln:
//   1. Gerechnet wird NICHT hier. Der Betrag kommt aus
//      `calcAbrechnungsfallZuzahlung()` — es gibt genau eine Zuzahlungsrechnung
//      im Backend, und ein zweiter Rechenweg waere genau der Fehler, den diese
//      Karte beheben soll.
//   2. Jede Aenderung hinterlaesst eine Zeile in `zuzahlung_korrekturen`:
//      wer, wann, alter Wert, neuer Wert, Grund. Ohne Begruendung kein Schreiben.
//   3. Eine eingereichte Verordnung wird nicht angefasst (`korrekturErlaubt`).
//
// Reihenfolge beim Schreiben ist Absicht: erst das Protokoll, dann der Betrag.
// Bricht es dazwischen ab, steht eine Korrektur im Buch, die nicht ausgefuehrt
// wurde — unangenehm, aber pruefbar. Andersherum aenderte sich stillschweigend
// Geld ohne Beleg, und das ist der Zustand, den es abzuschaffen gilt.

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { calcAbrechnungsfallZuzahlung } from '../zuzahlung/calculator.js';
import { saldoJeRezept } from '../zuzahlung/bezahlt.js';
import {
  korrekturErlaubt,
  pruefeEingabe,
  folgenDerKorrektur,
  verrechnungsBetrag,
} from '../zuzahlung/korrektur.js';
import { resolvePreis } from '../preise/resolver.js';
import { legsFuer, abrechnungscodeAusLegs, LEGS_BY_FACHBEREICH } from '../codes/legs.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const r2 = (v) => Math.round((+v + Number.EPSILON) * 100) / 100;

async function resolveAuth(req, res) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles').select('id, role, owner_id, sector').eq('id', u.user.id).maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id ? profile.owner_id : profile.id;
  return { user: u.user, profile, tenantId };
}

/** Fachbereich des Mandanten — beim Inhaber steht er, beim Angestellten nicht. */
async function sectorFuer(tenantId, eigenerSector) {
  if (eigenerSector) return eigenerSector;
  const { data } = await supabase.from('profiles').select('sector').eq('id', tenantId).maybeSingle();
  return data?.sector || 'physiotherapy';
}

/** Kassenbuch-Saldo eines Rezepts: was ist tatsaechlich gebucht? */
async function saldoFuerRezept(tenantId, rxId) {
  const { data, error } = await supabase
    .from('belegliste')
    .select('prescription_id, amount_eur')
    .eq('owner_id', tenantId)
    .eq('prescription_id', rxId);
  if (error) throw new Error('belegliste: ' + error.message);
  return saldoJeRezept(data || []).get(rxId) || 0;
}

/**
 * Betrag fuer eine gegebene Einheitenzahl — ueber den zentralen Calculator.
 * Dieselben Argumente, die auch die gedruckte Rechnung und die DTA-Datei
 * benutzen; deshalb kommt hier zwangslaeufig derselbe Betrag heraus.
 */
function betragFuerEinheiten({ rx, lead, sector, einheiten }) {
  const bereich = sector === 'podologie' ? 'podologie' : 'physiotherapie';
  const abrechnungscode = LEGS_BY_FACHBEREICH[sector]
    ? abrechnungscodeAusLegs(legsFuer(sector))
    : abrechnungscodeAusLegs(legsFuer('physiotherapy'));

  const { preis_eur, zuzahlung_eur, position_frei } = resolvePreis({
    bereich,
    code: rx.heilmittel_position || '',
    datum: rx.ausstellungsdatum || new Date().toISOString().slice(0, 10),
    abrechnungscode,
  });

  const zuzahlungsfrei = !!rx.zuzahlung_befreit || position_frei;
  const sessions = Array.from({ length: Math.max(0, einheiten) }, () => ({
    preis_eur,
    zuzahlung_eur_position: zuzahlungsfrei ? 0 : zuzahlung_eur,
    position_frei: zuzahlungsfrei,
  }));

  const totals = calcAbrechnungsfallZuzahlung({
    sessions,
    patient: { geburtsdatum: lead?.geburtsdatum, befreit_im_jahr: rx.zuzahlung_befreit },
    behandlungsende: new Date(),
    // Wie in abrechnung.routes.js: die 10-€-Pauschale haengt an der Verordnung,
    // nicht an der einzelnen Position.
    verordnung_zuzahlungsfrei: !!rx.zuzahlung_befreit,
  });

  return { betrag: r2(totals.gesZuzahlung ?? 0), preisProEinheit: preis_eur };
}

// ---------------------------------------------------------------------------
// POST /zuzahlung/korrektur
// ---------------------------------------------------------------------------
router.post('/zuzahlung/korrektur', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const {
      prescription_id,
      neue_einheiten = null,
      neuer_betrag_eur = null,
      grund,
      grund_code = 'abbruch',
      guthaben_anlegen = true,
      // Vorschau: dieselbe Rechnung, nur ohne zu schreiben. Der Dialog fragt
      // damit „was kaeme dabei heraus?" und bekommt garantiert die Zahl, die
      // beim Speichern auch entsteht — statt sie im Browser nachzubauen.
      vorschau = false,
    } = req.body || {};

    if (!prescription_id) return res.status(400).json({ error: 'prescription_id fehlt.' });

    const einheiten = neue_einheiten == null ? null : Number(neue_einheiten);
    const betragVorgabe = neuer_betrag_eur == null ? null : Number(neuer_betrag_eur);

    // Fuer die Vorschau wird die Begruendung noch nicht verlangt — sie tippt der
    // Anwender erst, wenn er den Betrag gesehen hat.
    const eingabe = vorschau
      ? pruefeEingabe({ einheiten, betrag: betragVorgabe, grund: 'vorschau', grundCode: 'sonstiges' })
      : pruefeEingabe({ einheiten, betrag: betragVorgabe, grund, grundCode: grund_code });
    if (!eingabe.ok) return res.status(400).json({ error: eingabe.fehler });

    const { data: rx, error: rxErr } = await supabase
      .from('prescriptions')
      .select('id, owner_id, patient_id, business_id, heilmittel_position, ausstellungsdatum, '
        + 'anzahl_einheiten, zuzahlung_eur, zuzahlung_befreit, abrechnung_status, belegnummer, '
        + 'leads:patient_id (geburtsdatum)')
      .eq('id', prescription_id)
      .maybeSingle();
    if (rxErr) return res.status(500).json({ error: rxErr.message });
    if (!rx) return res.status(404).json({ error: 'Rezept nicht gefunden.' });
    if (rx.owner_id !== auth.tenantId) return res.status(403).json({ error: 'Kein Zugriff.' });

    const riegel = korrekturErlaubt(rx);
    if (!riegel.erlaubt) return res.status(riegel.status).json({ error: riegel.grund });

    const sector = await sectorFuer(auth.tenantId, auth.profile.sector);

    // Faehigkeit 2 schlaegt Faehigkeit 1: hat ein Mensch einen Betrag
    // hingeschrieben, gilt der. Sonst folgt der Betrag der Einheitenzahl.
    let neuBetrag;
    let gerechnet = null;
    if (einheiten != null) {
      gerechnet = betragFuerEinheiten({ rx, lead: rx.leads, sector, einheiten });
    }
    if (betragVorgabe != null) {
      neuBetrag = r2(betragVorgabe);
    } else {
      neuBetrag = gerechnet.betrag;
    }

    const saldo = await saldoFuerRezept(auth.tenantId, rx.id);
    const folgen = folgenDerKorrektur({
      altBetrag: rx.zuzahlung_eur, neuBetrag, saldo,
    });

    if (vorschau) {
      return res.status(200).json({
        vorschau: true,
        ...folgen,
        saldo_eur: r2(saldo),
        berechnet_mit_einheiten: einheiten,
        ueberschrieben: betragVorgabe != null,
      });
    }

    if (!folgen.aenderung && einheiten == null) {
      return res.status(200).json({ unveraendert: true, ...folgen });
    }

    // 1. Guthaben zuerst — die Korrekturzeile soll darauf zeigen koennen.
    let guthabenId = null;
    if (folgen.guthaben > 0 && guthaben_anlegen) {
      const { data: gh, error: ghErr } = await supabase
        .from('zuzahlung_guthaben')
        .insert({
          owner_id: auth.tenantId,
          business_id: rx.business_id || null,
          patient_id: rx.patient_id,
          quelle_prescription_id: rx.id,
          betrag_eur: folgen.guthaben,
          rest_eur: folgen.guthaben,
          notiz: `Aus Zuzahlungskorrektur: ${String(grund).trim()}`,
          created_by: auth.user.id,
        })
        .select('id')
        .single();
      if (ghErr) return res.status(500).json({ error: 'Guthaben: ' + ghErr.message });
      guthabenId = gh.id;
    }

    // 2. Protokoll. Ohne diese Zeile wird der Betrag nicht angefasst.
    const { data: korr, error: kErr } = await supabase
      .from('zuzahlung_korrekturen')
      .insert({
        owner_id: auth.tenantId,
        business_id: rx.business_id || null,
        patient_id: rx.patient_id,
        prescription_id: rx.id,
        alt_betrag_eur: rx.zuzahlung_eur,
        neu_betrag_eur: folgen.neuBetrag,
        alt_einheiten: rx.anzahl_einheiten ?? null,
        neu_einheiten: einheiten,
        grund_code,
        grund: String(grund).trim(),
        guthaben_id: guthabenId,
        erfasst_von: auth.user.id,
      })
      .select('id, erfasst_am')
      .single();
    if (kErr) return res.status(500).json({ error: 'Protokoll: ' + kErr.message });

    // 3. Erst jetzt der geltende Betrag. Der Riegel steht ein zweites Mal in der
    //    WHERE-Bedingung: zwischen Pruefung und Schreiben kann die Verordnung in
    //    eine Abrechnung gelaufen sein.
    const { data: upd, error: uErr } = await supabase
      .from('prescriptions')
      .update({ zuzahlung_eur: folgen.neuBetrag })
      .eq('id', rx.id)
      .eq('owner_id', auth.tenantId)
      .is('belegnummer', null)
      .select('id');
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!upd || upd.length === 0) {
      return res.status(409).json({
        error: 'Die Verordnung wurde zwischenzeitlich abgerechnet. Die Korrektur wurde '
          + 'protokolliert, der Betrag aber nicht geaendert.',
      });
    }

    return res.status(201).json({
      korrektur_id: korr.id,
      erfasst_am: korr.erfasst_am,
      guthaben_id: guthabenId,
      ...folgen,
      berechnet_mit_einheiten: einheiten,
      ueberschrieben: betragVorgabe != null,
    });
  } catch (e) {
    console.error('[zuzahlung/korrektur]', e);
    return res.status(500).json({ error: 'Server-Fehler: ' + e.message });
  }
});

// ---------------------------------------------------------------------------
// GET /zuzahlung/guthaben?patient_id=…
// ---------------------------------------------------------------------------
router.get('/zuzahlung/guthaben', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    let q = supabase
      .from('zuzahlung_guthaben')
      .select('id, patient_id, quelle_prescription_id, betrag_eur, rest_eur, status, notiz, created_at')
      .eq('owner_id', auth.tenantId)
      .in('status', ['offen', 'teilweise_verrechnet'])
      .order('created_at', { ascending: true });

    if (req.query.patient_id) q = q.eq('patient_id', req.query.patient_id);

    const { data, error } = await q;
    if (error) return res.status(500).json({ error: error.message });

    const summe = r2((data || []).reduce((s, g) => s + Number(g.rest_eur || 0), 0));
    return res.json({ guthaben: data || [], summe_eur: summe });
  } catch (e) {
    console.error('[zuzahlung/guthaben]', e);
    return res.status(500).json({ error: 'Server-Fehler: ' + e.message });
  }
});

// ---------------------------------------------------------------------------
// POST /zuzahlung/guthaben/:id/verrechnen
// ---------------------------------------------------------------------------
router.post('/zuzahlung/guthaben/:id/verrechnen', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const { prescription_id } = req.body || {};
    if (!prescription_id) return res.status(400).json({ error: 'prescription_id fehlt.' });

    const { data: gh, error: ghErr } = await supabase
      .from('zuzahlung_guthaben')
      .select('id, owner_id, patient_id, betrag_eur, rest_eur, status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (ghErr) return res.status(500).json({ error: ghErr.message });
    if (!gh) return res.status(404).json({ error: 'Guthaben nicht gefunden.' });
    if (gh.owner_id !== auth.tenantId) return res.status(403).json({ error: 'Kein Zugriff.' });
    if (!(Number(gh.rest_eur) > 0)) {
      return res.status(409).json({ error: 'Dieses Guthaben ist bereits aufgebraucht.' });
    }

    const { data: ziel, error: zErr } = await supabase
      .from('prescriptions')
      .select('id, owner_id, patient_id, business_id, anzahl_einheiten, zuzahlung_eur, '
        + 'zuzahlung_befreit, abrechnung_status, belegnummer')
      .eq('id', prescription_id)
      .maybeSingle();
    if (zErr) return res.status(500).json({ error: zErr.message });
    if (!ziel) return res.status(404).json({ error: 'Zielverordnung nicht gefunden.' });
    if (ziel.owner_id !== auth.tenantId) return res.status(403).json({ error: 'Kein Zugriff.' });

    // Das Guthaben gehoert dem Patienten. Es auf einen anderen zu buchen waere
    // eine stille Umverteilung zwischen zwei Menschen.
    if (ziel.patient_id !== gh.patient_id) {
      return res.status(409).json({
        error: 'Das Guthaben gehoert zu einem anderen Patienten und kann hier nicht '
          + 'angerechnet werden.',
      });
    }

    const riegel = korrekturErlaubt(ziel);
    if (!riegel.erlaubt) return res.status(riegel.status).json({ error: riegel.grund });

    const plan = verrechnungsBetrag({ rest: gh.rest_eur, zielSoll: ziel.zuzahlung_eur });
    if (plan.betrag <= 0) {
      return res.status(409).json({
        error: 'Diese Verordnung fordert keine Zuzahlung — es gibt nichts anzurechnen.',
      });
    }

    const { data: korr, error: kErr } = await supabase
      .from('zuzahlung_korrekturen')
      .insert({
        owner_id: auth.tenantId,
        business_id: ziel.business_id || null,
        patient_id: ziel.patient_id,
        prescription_id: ziel.id,
        alt_betrag_eur: ziel.zuzahlung_eur,
        neu_betrag_eur: plan.neuesZielSoll,
        alt_einheiten: ziel.anzahl_einheiten ?? null,
        neu_einheiten: null,
        grund_code: 'guthaben_verrechnung',
        grund: `Guthaben aus frueherer Verordnung angerechnet (${plan.betrag.toFixed(2)} EUR).`,
        guthaben_id: gh.id,
        erfasst_von: auth.user.id,
      })
      .select('id')
      .single();
    if (kErr) return res.status(500).json({ error: 'Protokoll: ' + kErr.message });

    const { data: upd, error: uErr } = await supabase
      .from('prescriptions')
      .update({ zuzahlung_eur: plan.neuesZielSoll })
      .eq('id', ziel.id)
      .eq('owner_id', auth.tenantId)
      .is('belegnummer', null)
      .select('id');
    if (uErr) return res.status(500).json({ error: uErr.message });
    if (!upd || upd.length === 0) {
      return res.status(409).json({
        error: 'Die Zielverordnung wurde zwischenzeitlich abgerechnet. Es wurde nichts angerechnet.',
      });
    }

    // Zuletzt das Guthaben abschreiben. Der Trigger setzt den Status selbst.
    const { error: ghUpdErr } = await supabase
      .from('zuzahlung_guthaben')
      .update({ rest_eur: plan.neuerRest })
      .eq('id', gh.id)
      .eq('rest_eur', gh.rest_eur);   // niemand darf dazwischen dasselbe verrechnet haben
    if (ghUpdErr) return res.status(500).json({ error: 'Guthaben: ' + ghUpdErr.message });

    return res.status(200).json({
      korrektur_id: korr.id,
      verrechnet_eur: plan.betrag,
      neues_soll_eur: plan.neuesZielSoll,
      guthaben_rest_eur: plan.neuerRest,
    });
  } catch (e) {
    console.error('[zuzahlung/guthaben/verrechnen]', e);
    return res.status(500).json({ error: 'Server-Fehler: ' + e.message });
  }
});

export default router;
