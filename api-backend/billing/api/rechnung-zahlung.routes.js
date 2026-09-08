/**
 * rechnung-zahlung.routes.js — Zahlungseingänge auf Privatrechnungen.
 *
 * Routen
 * ──────
 *   GET  /api/billing/rechnungen/:id/zahlungen   Ledger + offener Betrag
 *   POST /api/billing/rechnungen/:id/zahlung     Zahlung (ggf. + Ausbuchung) buchen
 *
 * Warum eine eigene Datei
 * ───────────────────────
 * `abrechnung.routes.js` ist der §302-Weg (GKV, DTA, Kassenbuch-Rohzugriff),
 * `zuzahlung.routes.js` der Rezept-Weg. Hier geht es um die Privatrechnung —
 * anderer Geschäftsvorfall, andere Tabelle, andere Fehlerfälle.
 *
 * Drei Regeln, die diese Datei einhält
 * ────────────────────────────────────
 * 1. **Gebucht wird in der Datenbank, nicht hier.** Die Route macht Auth,
 *    Mandantenauflösung, Eingabeprüfung und löst den Konto-Snapshot auf; das
 *    eigentliche Schreiben erledigt die Funktion `rechnung_zahlung_buchen()`
 *    in EINER Transaktion. Grund: eine Zahlung schreibt bis zu vier Zeilen,
 *    davon zwei in append-only Tabellen — die liessen sich bei einem
 *    Teilfehler nicht durch Löschen zurücknehmen, sondern nur durch eine
 *    Gegenbuchung. Eine Netzwerkpanne stünde dann als Geschäftsvorfall im
 *    Journal. PostgREST kennt keine Mehrfach-Statement-Transaktion, deshalb
 *    die Funktion.
 * 2. **Das Gegenkonto wird als Snapshot kopiert, nicht verlinkt.** Der
 *    Kontenrahmen steht in `profiles.buchungskonten` und ist editierbar;
 *    benennt der Owner „1200 Bank" um, muss eine Buchung von heute in zwei
 *    Jahren weiter das zeigen, was damals gebucht wurde (§ 146 Abs. 4 AO).
 * 3. **Fehler kommen als Ausnahme aus der Datenbank**, nicht als Rückgabewert.
 *    Die Zuordnung SQLSTATE → HTTP steht unten in einer Tabelle; hier gibt es
 *    keinen Kompensationscode, weil es nichts zu kompensieren gibt.
 */

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/** Standardrahmen — muss zu `module/buchungskonten.js` passen. */
const STANDARD_KONTEN = [
  { code: '1000', label: 'Kasse' },
  { code: '1100', label: 'Postbank' },
  { code: '1200', label: 'Bank' },
  { code: '1210', label: 'Bank 2' },
  { code: '8700', label: 'Erlösschmälerung' },
  { code: '4900', label: 'Teilabsetzung' },
];

const AUSBUCHUNGSKONTO_STANDARD = '8700';

/**
 * SQLSTATE → HTTP. Die Funktion wirft mit Absicht sprechende Codes, damit hier
 * kein Text geparst werden muss.
 */
const STATUS_FUER = {
  '42501': 403,           // fremder Mandant
  '23514': 409,           // check_violation — Überzahlung, storniert, alles gebucht
  'P0002': 404,           // no_data_found — Rechnung weg
};

async function resolveAuth(req, res) {
  const hdr = req.headers.authorization || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, role, owner_id, buchungskonten')
    .eq('id', u.user.id)
    .maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId };
}

/**
 * Der Kontenrahmen des Mandanten. Beim Angestellten hängt er am Inhaber, nicht
 * am eigenen Profil — deshalb wird bei Bedarf nachgeladen.
 */
async function kontenFuer(auth) {
  let roh = auth.profile.buchungskonten;
  if (auth.tenantId !== auth.profile.id) {
    const { data } = await supabase
      .from('profiles').select('buchungskonten').eq('id', auth.tenantId).maybeSingle();
    roh = data?.buchungskonten;
  }
  const eigene = Array.isArray(roh)
    ? roh
      .filter(k => k && typeof k === 'object')
      .map(k => ({
        code: String(k.code ?? '').replace(/\s+/g, ''),
        label: String(k.label ?? '').trim(),
        aktiv: k.aktiv !== false,
      }))
      .filter(k => k.code && k.label)
    : [];
  return eigene.length ? eigene : STANDARD_KONTEN.map(k => ({ ...k, aktiv: true }));
}

/** Löst einen Kontocode in den zu speichernden Snapshot auf. */
function snapshotFuer(konten, code) {
  const gesucht = String(code ?? '').replace(/\s+/g, '');
  if (!gesucht) return null;
  // Deaktivierte Konten werden mitgefunden: sie dürfen nicht mehr angeboten,
  // aber eine laufende Korrektur darf nicht daran scheitern.
  const treffer = konten.find(k => k.code === gesucht);
  return treffer ? { code: treffer.code, label: treffer.label } : null;
}

/**
 * GET /api/billing/rechnungen/:id/zahlungen
 * Was wurde auf diese Rechnung schon gebucht und was ist offen?
 */
router.get('/rechnungen/:id/zahlungen', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select('id, owner_id, total_patient, status, payment_status, invoice_number, patient_name, prescription_id, verordnung_id')
      .eq('id', req.params.id)
      .maybeSingle();
    if (invErr) return res.status(500).json({ error: invErr.message });
    if (!inv) return res.status(404).json({ error: 'Rechnung nicht gefunden' });
    if (inv.owner_id !== auth.tenantId) return res.status(403).json({ error: 'Forbidden' });

    const { data: zeilen, error: zErr } = await supabase
      .from('rechnung_zahlungen')
      .select('id, art, betrag_eur, zahlungsdatum, gegenkonto_code, gegenkonto_label, bemerkung, created_at')
      .eq('invoice_id', inv.id)
      .order('created_at', { ascending: true });
    if (zErr) return res.status(500).json({ error: 'rechnung_zahlungen: ' + zErr.message });

    const gebucht = (zeilen || []).reduce((s, z) => s + Number(z.betrag_eur || 0), 0);
    const gesamt = Number(inv.total_patient) || 0;

    return res.json({
      rechnung: {
        id: inv.id,
        invoice_number: inv.invoice_number,
        patient_name: inv.patient_name,
        total_patient: gesamt,
        status: inv.status,
        payment_status: inv.payment_status,
        hat_rezeptbezug: !!(inv.prescription_id || inv.verordnung_id),
      },
      zahlungen: zeilen || [],
      bereits_gebucht: Math.round(gebucht * 100) / 100,
      offen: Math.round((gesamt - gebucht) * 100) / 100,
      konten: (await kontenFuer(auth)).filter(k => k.aktiv),
    });
  } catch (e) {
    console.error('[rechnungen/zahlungen]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

/**
 * POST /api/billing/rechnungen/:id/zahlung
 *
 * Body: eingegangener_betrag, zahlungsdatum, gegenkonto_code,
 *       restbetrag_modus ('offen_lassen' | 'ausbuchen'),
 *       ausbuchungskonto_code (optional), bemerkung (optional)
 */
router.post('/rechnungen/:id/zahlung', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const {
      eingegangener_betrag,
      zahlungsdatum,
      gegenkonto_code,
      restbetrag_modus = 'offen_lassen',
      ausbuchungskonto_code,
      bemerkung,
    } = req.body || {};

    const betrag = Number(eingegangener_betrag);
    if (!Number.isFinite(betrag) || betrag <= 0) {
      return res.status(400).json({ error: 'Der eingegangene Betrag muss über 0 € liegen.' });
    }
    if (!['offen_lassen', 'ausbuchen'].includes(restbetrag_modus)) {
      return res.status(400).json({ error: 'Unbekannte Restbetrag-Behandlung.' });
    }
    if (zahlungsdatum && !/^\d{4}-\d{2}-\d{2}$/.test(zahlungsdatum)) {
      return res.status(400).json({ error: 'Zahlungsdatum muss im Format JJJJ-MM-TT kommen.' });
    }

    // Konto-Snapshot auflösen. Ein unbekannter Code wird abgelehnt statt still
    // durchgereicht — sonst stünde im Journal eine Kontonummer, die es im
    // Rahmen der Praxis nie gab.
    const konten = await kontenFuer(auth);
    const gegenkonto = snapshotFuer(konten, gegenkonto_code);
    if (!gegenkonto) {
      return res.status(400).json({ error: 'Unbekanntes Gegenkonto.' });
    }

    let ausbuchungskonto = null;
    if (restbetrag_modus === 'ausbuchen') {
      ausbuchungskonto = snapshotFuer(konten, ausbuchungskonto_code || AUSBUCHUNGSKONTO_STANDARD);
      if (!ausbuchungskonto) {
        return res.status(400).json({ error: 'Unbekanntes Ausbuchungskonto.' });
      }
    }

    const { data, error } = await supabase.rpc('rechnung_zahlung_buchen', {
      p_invoice_id: req.params.id,
      p_owner_id: auth.tenantId,
      p_created_by: auth.user.id,
      p_betrag_eur: betrag,
      p_zahlungsdatum: zahlungsdatum || null,
      p_gegenkonto_code: gegenkonto.code,
      p_gegenkonto_label: gegenkonto.label,
      p_restbetrag_modus: restbetrag_modus,
      p_ausbuchungskonto_code: ausbuchungskonto?.code || null,
      p_ausbuchungskonto_label: ausbuchungskonto?.label || null,
      p_bemerkung: bemerkung || null,
    });

    if (error) {
      // Die Funktion wirft sprechende SQLSTATEs; alles andere ist ein echter
      // Serverfehler und soll auch so aussehen.
      const status = STATUS_FUER[error.code] || 500;
      if (status === 500) console.error('[rechnungen/zahlung] rpc:', error);
      return res.status(status).json({ error: error.message });
    }

    return res.status(201).json(data);
  } catch (e) {
    console.error('[rechnungen/zahlung]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

export default router;
