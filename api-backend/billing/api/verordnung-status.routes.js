// Abrechnungsstatus einer Verordnung (Podologie-Topf `verordnungen`).
//
// PATCH /api/billing/verordnung/:id/abrechnungsstatus
// GET   /api/billing/verordnung/abrechnungsstatus/uebersicht
//
// Warum eigene Datei: der Status ist kein Etikett, sondern ein Tor. Frueher
// setzte die Oberflaeche `verordnungen.status` direkt per Supabase-Update —
// damit konnte jeder Wert auf jeden anderen springen: eine eingereichte
// Verordnung liess sich zurueck auf 'aktiv' setzen und ein zweites Mal
// abrechnen, eine Absetzung liess sich ohne Grund und ohne Betrag setzen.
// Der Uebergang gehoert deshalb hinter eine Regel, nicht hinter ein <select>.
//
// Zustaende (siehe Migration verordnungen_abrechnungsstatus_absetzung):
//   aktiv          in Behandlung
//   abrechenbar    bereit zur Abrechnung
//   abgerechnet    in einer DTA-Datei eingereicht  ← nur maschinell
//   teilabsetzung  Kasse hat gekuerzt gezahlt      ← braucht Betrag + Grund
//   abgesetzt      Kasse hat den Beleg abgesetzt   ← braucht Grund
//   storniert      von der Praxis zurueckgezogen
//   archiviert     abgeschlossen, aus der Arbeitsliste raus

import express from 'express';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function resolveAuth(req, res) {
  const token = req.headers.authorization?.slice(7);
  if (!token) { res.status(401).json({ error: 'Missing bearer token' }); return null; }

  const { data: u, error: uErr } = await supabase.auth.getUser(token);
  if (uErr || !u?.user) { res.status(401).json({ error: 'Invalid token' }); return null; }

  const { data: profile, error: pErr } = await supabase
    .from('profiles').select('id, role, owner_id').eq('id', u.user.id).maybeSingle();
  if (pErr || !profile) { res.status(403).json({ error: 'Profile not found' }); return null; }

  const tenantId = profile.role === 'employee' && profile.owner_id ? profile.owner_id : profile.id;
  return { user: u.user, profile, tenantId };
}

// Erlaubte Uebergaenge. Was hier nicht steht, geht nicht.
//
// 'abgerechnet' taucht als Ziel nirgends auf: diesen Zustand vergibt
// ausschliesslich /abrechnung/create-podologie beim Erzeugen der DTA-Datei.
// Von Hand gesetzt hiesse er "ich glaube, das ist eingereicht" — und die
// Verordnung faellt aus der Abrechnungsliste, ohne dass je eine Datei existiert
// hat. Das ist der stille Einnahmeverlust, den wir schon einmal hatten.
const UEBERGAENGE = {
  aktiv:         ['abrechenbar', 'storniert', 'archiviert'],
  abrechenbar:   ['aktiv', 'storniert', 'archiviert'],
  abgerechnet:   ['teilabsetzung', 'abgesetzt', 'storniert'],
  teilabsetzung: ['abgesetzt', 'storniert', 'archiviert'],
  abgesetzt:     ['aktiv', 'teilabsetzung', 'storniert', 'archiviert'],
  storniert:     ['archiviert'],
  archiviert:    [],
};

const LABEL = {
  aktiv:         'In Behandlung',
  abrechenbar:   'Bereit zur Abrechnung',
  abgerechnet:   'Abgerechnet',
  teilabsetzung: 'Teilabsetzung',
  abgesetzt:     'Absetzung',
  storniert:     'Storniert',
  archiviert:    'Archiviert',
};

// Nach der Einreichung ist Geld unterwegs. Wer hier storniert, hat eine
// Mitteilungspflicht gegenueber der Kasse (schriftlich oder telefonisch),
// wenn bereits zuviel gezahlt wurde. Die Oberflaeche muss das bestaetigen,
// sonst laeuft der Storno nicht durch.
const STORNO_NACH_EINREICHUNG = ['abgerechnet', 'teilabsetzung', 'abgesetzt'];

router.patch('/verordnung/:id/abrechnungsstatus', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;
    const { tenantId } = auth;

    const ziel = String(req.body?.status || '').trim();
    const grund = (req.body?.grund || '').trim();
    const betragRaw = req.body?.betrag;
    const meldepflichtBestaetigt = req.body?.meldepflichtBestaetigt === true;

    if (!Object.prototype.hasOwnProperty.call(UEBERGAENGE, ziel)) {
      return res.status(400).json({ error: `Unbekannter Status „${ziel}".` });
    }
    if (ziel === 'abgerechnet') {
      return res.status(422).json({
        error: '„Abgerechnet" wird nicht von Hand gesetzt. Dieser Status entsteht beim Erzeugen der §302-Datei.',
      });
    }

    const { data: v, error: vErr } = await supabase
      .from('verordnungen')
      .select('id, owner_id, status, patient_name, abrechnung_id, rezeptart')
      .eq('id', req.params.id)
      .maybeSingle();
    if (vErr) return res.status(500).json({ error: vErr.message });
    if (!v) return res.status(404).json({ error: 'Verordnung nicht gefunden' });
    if (v.owner_id !== tenantId) return res.status(403).json({ error: 'Kein Zugriff' });

    const jetzt = v.status || 'aktiv';
    if (jetzt === ziel) return res.json({ ok: true, status: ziel, unveraendert: true });

    const erlaubt = UEBERGAENGE[jetzt] || [];
    if (!erlaubt.includes(ziel)) {
      return res.status(409).json({
        error: `„${LABEL[jetzt] || jetzt}" kann nicht auf „${LABEL[ziel]}" gesetzt werden.`,
        erlaubt: erlaubt.map(s => ({ status: s, label: LABEL[s] })),
      });
    }

    const patch = { status: ziel };

    // ── bereit zur Abrechnung ────────────────────────────────────────────
    // Ohne dokumentierte Behandlung entsteht in der DTA-Datei ein Beleg ohne
    // eine einzige Position. Die Kasse setzt ihn ab, und die Absetzung kostet
    // mehr Zeit als die Sperre hier.
    if (ziel === 'abrechenbar') {
      const { count } = await supabase
        .from('podologie_behandlungen')
        .select('id', { count: 'exact', head: true })
        .eq('verordnung_id', v.id)
        .eq('owner_id', tenantId);
      if (!count) {
        return res.status(422).json({
          error: 'Noch keine Behandlung dokumentiert — ohne Behandlung gibt es nichts abzurechnen.',
        });
      }
      if (v.rezeptart && v.rezeptart !== 'kassen') {
        return res.status(422).json({
          error: `Rezeptart „${v.rezeptart}" wird nicht über §302 abgerechnet. Diese Verordnung läuft über die Privatrechnung.`,
        });
      }
    }

    // ── Absetzung / Teilabsetzung ────────────────────────────────────────
    if (ziel === 'teilabsetzung' || ziel === 'abgesetzt') {
      if (!grund) {
        return res.status(422).json({
          error: 'Absetzungsgrund fehlt. Ohne Grund ist später nicht nachvollziehbar, warum die Kasse gekürzt hat.',
        });
      }
      patch.absetzung_grund = grund.slice(0, 2000);
      patch.absetzung_am = req.body?.datum || new Date().toISOString().slice(0, 10);

      if (ziel === 'teilabsetzung') {
        const betrag = Number(betragRaw);
        if (!Number.isFinite(betrag) || betrag <= 0) {
          return res.status(422).json({
            error: 'Gekürzter Betrag fehlt. Eine Teilabsetzung ohne Betrag lässt sich der Kasse gegenüber nicht nachfordern.',
          });
        }
        patch.absetzung_betrag = +betrag.toFixed(2);
      } else if (Number.isFinite(Number(betragRaw)) && Number(betragRaw) > 0) {
        patch.absetzung_betrag = +Number(betragRaw).toFixed(2);
      }
    }

    // ── Storno ───────────────────────────────────────────────────────────
    if (ziel === 'storniert') {
      if (!grund) {
        return res.status(422).json({ error: 'Stornogrund fehlt.' });
      }
      if (STORNO_NACH_EINREICHUNG.includes(jetzt) && !meldepflichtBestaetigt) {
        return res.status(428).json({
          error: 'Diese Verordnung wurde bereits bei der Kasse eingereicht.',
          hinweis:
            'Wenn dadurch zu viel gezahlt wurde, muss die Krankenkasse informiert werden ' +
            '(schriftlich oder telefonisch). Der Storno wird erst nach Bestätigung gebucht.',
          bestaetigungErforderlich: true,
        });
      }
      patch.storno_grund = grund.slice(0, 2000);
      patch.storno_am = new Date().toISOString().slice(0, 10);
    }

    // ── Wiedereröffnen nach Absetzung ────────────────────────────────────
    // Der alte Absetzungsgrund bleibt stehen, solange er nicht bearbeitet
    // wurde — er ist die Arbeitsanweisung für die Korrektur. Erst mit der
    // erneuten Einreichung wird er hinfällig.
    if (ziel === 'aktiv' && jetzt === 'abgesetzt') {
      patch.abrechnung_id = null;
    }

    const { error: upErr } = await supabase
      .from('verordnungen').update(patch).eq('id', v.id).eq('owner_id', tenantId);
    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({ ok: true, status: ziel, label: LABEL[ziel], vorher: jetzt });
  } catch (e) {
    console.error('[verordnung/abrechnungsstatus]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Ein Zaehler je Status — die Filterleiste der Patientenliste haengt daran.
router.get('/verordnung/abrechnungsstatus/uebersicht', async (req, res) => {
  try {
    const auth = await resolveAuth(req, res);
    if (!auth) return;

    const { data, error } = await supabase
      .from('verordnungen')
      .select('status')
      .eq('owner_id', auth.tenantId);
    if (error) return res.status(500).json({ error: error.message });

    const zaehler = {};
    for (const r of (data || [])) zaehler[r.status || 'aktiv'] = (zaehler[r.status || 'aktiv'] || 0) + 1;
    return res.json({ ok: true, zaehler, labels: LABEL });
  } catch (e) {
    console.error('[verordnung/uebersicht]', e);
    return res.status(500).json({ error: e.message });
  }
});

export { UEBERGAENGE, LABEL };
export default router;
