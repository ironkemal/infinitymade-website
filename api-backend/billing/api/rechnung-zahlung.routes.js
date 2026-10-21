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
  { code: '1000', label: 'Kasse',                       kategorie: 'bar' },
  { code: '1100', label: 'Postbank',                    kategorie: 'ueberweisung' },
  { code: '1200', label: 'Bank',                        kategorie: 'ueberweisung' },
  { code: '1210', label: 'Bank 2',                       kategorie: 'ueberweisung' },
  { code: '1220', label: 'Kartenzahlungen (EC/Kredit)', kategorie: 'karte' },
  { code: '1250', label: 'PayPal',                      kategorie: 'paypal' },
  { code: '8700', label: 'Erlösschmälerung',            kategorie: 'sonstiges' },
  { code: '4900', label: 'Teilabsetzung',               kategorie: 'sonstiges' },
];

const AUSBUCHUNGSKONTO_STANDARD = '8700';

/**
 * Kategorie -> `belegliste.zahlart`. Muss zu
 * `module/buchungskonten.js::ZAHLART_JE_KATEGORIE` passen (Ops #271,
 * 08.09.2026). Nur `karte` weicht vom eigenen Namen ab — der historische Wert
 * dafür heißt `ec` (`api-backend/billing/belegliste/helper.js:9`).
 */
const ZAHLART_JE_KATEGORIE = {
  bar: 'bar',
  karte: 'ec',
  ueberweisung: 'ueberweisung',
  paypal: 'paypal',
  sonstiges: 'sonstiges',
};

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
    .select('id, role, owner_id, is_active')
    .eq('id', u.user.id)
    .maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id
    ? profile.owner_id
    : profile.id;

  return { user: u.user, profile, tenantId, token };
}

/** Beide Zahlungswege prüfen dieselbe Rechnung und deren verbindlichen Standort. */
async function rechnungFuer(req, res, auth) {
  if (!['owner', 'employee'].includes(auth.profile.role)
      || (auth.profile.role === 'employee'
        && (!auth.profile.owner_id || auth.profile.is_active !== true))) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  const { data: inv, error } = await supabase
    .from('invoices')
    .select('id, owner_id, business_id, total_patient, status, payment_status, invoice_number, patient_name, prescription_id, verordnung_id')
    .eq('id', req.params.id)
    .eq('owner_id', auth.tenantId)
    .maybeSingle();
  if (error) { res.status(500).json({ error: error.message }); return null; }
  if (!inv || inv.owner_id !== auth.tenantId) {
    res.status(404).json({ error: 'Rechnung nicht gefunden' });
    return null;
  }
  if (auth.profile.role === 'owner' && inv.owner_id === auth.user.id) return inv;

  if (!inv.business_id) { res.status(403).json({ error: 'Forbidden' }); return null; }
  const { data: owner, error: ownerErr } = await supabase
    .from('profiles').select('role').eq('id', inv.owner_id).maybeSingle();
  const { data: business, error: businessErr } = await supabase
    .from('businesses').select('id, owner_id')
    .eq('id', inv.business_id).eq('owner_id', inv.owner_id).maybeSingle();
  if (ownerErr || owner?.role !== 'owner' || businessErr
      || business?.id !== inv.business_id || business?.owner_id !== inv.owner_id) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  // get_my_permissions wertet auth.uid() aus und vereinigt Gruppen + Overrides.
  // Deshalb zwingend Nutzer-JWT statt Service-Role-Kontext verwenden.
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });
  const { data: permissions, error: permissionErr } = await userClient
    .rpc('get_my_permissions', { p_business_id: inv.business_id });
  if (permissionErr || !Array.isArray(permissions)
      || !permissions.some(p => p?.module === 'abrechnung' && p.has_access === true)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return inv;
}

/**
 * Der Kontenrahmen des Mandanten. Beim Angestellten hängt er am Inhaber, nicht
 * am eigenen Profil. Laden erst nach erfolgreicher Rechnungs- und Rechteprüfung.
 */
async function kontenFuer(auth) {
  const { data } = await supabase
    .from('profiles').select('buchungskonten').eq('id', auth.tenantId).maybeSingle();
  const roh = data?.buchungskonten;
  const eigene = Array.isArray(roh)
    ? roh
      .filter(k => k && typeof k === 'object')
      .map(k => ({
        code: String(k.code ?? '').replace(/\s+/g, ''),
        label: String(k.label ?? '').trim(),
        aktiv: k.aktiv !== false,
        // Unbekannt/fehlend -> 'sonstiges', gleiche Regel wie
        // module/buchungskonten.js::normalisiereKonten().
        kategorie: Object.keys(ZAHLART_JE_KATEGORIE).includes(k.kategorie) ? k.kategorie : 'sonstiges',
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
  return treffer ? { code: treffer.code, label: treffer.label, kategorie: treffer.kategorie } : null;
}

/**
 * GET /api/billing/rechnungen/:id/zahlungen
 * Was wurde auf diese Rechnung schon gebucht und was ist offen?
 */
router.get('/rechnungen/:id/zahlungen', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const inv = await rechnungFuer(req, res, auth);
    if (!inv) return;

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
      // kategorie geht mit: das Frontend trennt daran Zahlungskonten
      // (bar/karte/ueberweisung/paypal) von reinen Ausbuchungskonten
      // (sonstiges) im Gegenkonto-Dropdown (Ops #271, 08.09.2026).
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
    const inv = await rechnungFuer(req, res, auth);
    if (!inv) return;

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

    // Zahlart folgt aus dem gewählten Konto, nicht umgekehrt (Ops #271,
    // 08.09.2026) — die Funktion selbst rät nichts mehr aus dem Code.
    const zahlart = ZAHLART_JE_KATEGORIE[gegenkonto.kategorie] || 'sonstiges';

    const { data, error } = await supabase.rpc('rechnung_zahlung_buchen', {
      p_invoice_id: inv.id,
      p_owner_id: inv.owner_id,
      p_created_by: auth.user.id,
      p_betrag_eur: betrag,
      p_zahlungsdatum: zahlungsdatum || null,
      p_gegenkonto_code: gegenkonto.code,
      p_gegenkonto_label: gegenkonto.label,
      p_restbetrag_modus: restbetrag_modus,
      p_ausbuchungskonto_code: ausbuchungskonto?.code || null,
      p_ausbuchungskonto_label: ausbuchungskonto?.label || null,
      p_bemerkung: bemerkung || null,
      p_zahlart: zahlart,
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
