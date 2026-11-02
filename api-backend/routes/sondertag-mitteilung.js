// Terminabsage per E-Mail bei geschlossenem Sondertag (Physio-Pilot M6b/S8, 02.11.2026).
//
// NIE automatisch: POST /sondertag/mitteilung/vorschau liefert, wer per Mail informiert werden KANN und wer auf
// die Anrufliste gehoert; erst POST /sondertag/mitteilung/senden mit ausdruecklich freigegebenen bookingIds
// versendet. Inhaber UND Mitarbeiter duerfen freigeben (guvenlik 02.11.: kein neuer Datenzugriff, sie sehen alle
// Teamtermine ohnehin); wer freigab, steht im Protokoll termin_mitteilungen (0101).
//
// guvenlik-Bedingungen (Abnahme S8): Mandant nur aus dem JWT; beim Senden ALLES frisch aus der DB (Termin gehoert
// zum Mandanten, liegt an einem wirklich eingetragenen geschlossenen Sondertag, Zukunft, nicht abgesagt,
// Einwilligung v6 des Patienten derselben Buchung, Adresse nur aus der DB); nur UUIDs, hoechstens 200; Protokollzeile
// VOR dem Versand (Dedup, auch bei gleichzeitigen Laeufen); Tagesdeckel in der DB; Logs nur Codes und Anzahlen.
// Versandweg wie Dokumente (O-233): Box -> Praxis-SMTP, SaaS -> Gmail der Praxis, nie Praxura-SMTP.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../ai/auth.js';
import { istKutu } from '../lib/dagitim.js';
import { createSMTPTransport, getMailFrom } from '../lib/mail.js';
import { sendeUeberGmail } from '../lib/gmail-senden.js';
import { versandWeg } from './dokument-mail.js';
import {
  istUuid, tageVonBis, betroffene, einteilen, mitteilungsText, GRUND_TEXT, MAX_IDS, TAGESDECKEL, protokollZustand, IN_ARBEIT,
} from '../lib/sondertag-mitteilung.js';

const ANLASS = 'sondertag_geschlossen';
const SMTP_ABBRUCH = new Set(['ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS', 'EAUTH', 'ECONNREFUSED']);

/** Alles, was Vorschau und Senden brauchen — immer frisch aus der DB, Mandant aus dem JWT. */
export async function ladeLage(supabase, tenantId, von, bis, { env = process.env, kutu = istKutu(), jetzt = new Date() } = {}) {
  const tage = tageVonBis(von, bis);
  if (!tage) return { fehler: 'Ungültiger Zeitraum (höchstens 31 Tage).', status: 400 };
  const { data: sondertage, error: e1 } = await supabase.from('custom_days')
    .select('id,date,type,start_time,end_time,business_id').eq('owner_id', tenantId).in('date', tage);
  if (e1) throw e1;
  const vonIso = new Date(`${tage[0]}T00:00:00Z`);
  vonIso.setUTCHours(vonIso.getUTCHours() - 3); // Berliner Mitternacht liegt vor 00:00 UTC
  const bisIso = new Date(`${tage[tage.length - 1]}T23:59:59Z`);
  const { data: termine, error: e2 } = await supabase.from('bookings')
    .select('id,start_time,status,group_parent_id,business_id,lead_id,customer_name,customer_phone')
    .eq('owner_id', tenantId).gte('start_time', vonIso.toISOString()).lte('start_time', bisIso.toISOString());
  if (e2) throw e2;
  const liste = betroffene(termine, sondertage, jetzt);
  const leadIds = [...new Set(liste.map(x => x.termin.lead_id).filter(Boolean))];
  const bookingIds = liste.map(x => x.termin.id);
  const [leadsR, einwR, protR, profR] = await Promise.all([
    leadIds.length ? supabase.from('leads').select('id,email').eq('owner_id', tenantId).in('id', leadIds) : { data: [] },
    leadIds.length ? supabase.from('patient_consents').select('patient_id,consent_type,text_version,text_snapshot,consented_at,revoked_at')
      .eq('owner_id', tenantId).eq('consent_type', 'datenschutz').in('patient_id', leadIds) : { data: [] },
    bookingIds.length ? supabase.from('termin_mitteilungen').select('booking_id,termin_beginn,status,fehler_code').eq('owner_id', tenantId).eq('anlass', ANLASS).in('booking_id', bookingIds) : { data: [] },
    supabase.from('profiles').select('business_name,phone,b2b_from_email').eq('id', tenantId).maybeSingle(),
  ]);
  for (const r of [leadsR, einwR, protR, profR]) if (r.error) throw r.error;
  const leads = new Map((leadsR.data || []).map(l => [l.id, l]));
  const einw = new Map();
  for (const e of einwR.data || []) { if (!einw.has(e.patient_id)) einw.set(e.patient_id, []); einw.get(e.patient_id).push(e); }
  const weg = versandWeg(env, kutu);
  const versandMoeglich = weg === 'smtp' || (weg === 'gmail' && !!profR.data?.b2b_from_email);
  const geteilt = einteilen(liste, leads, einw, protokollZustand(protR.data), versandMoeglich);
  return { ...geteilt, weg: versandMoeglich ? weg : null, profil: profR.data || {} };
}

/**
 * Ein Versandlauf (ohne HTTP, testbar). Ablauf je Empfaenger:
 *  1. Reservieren: Protokollzeile status='fehler', fehler_code=IN_ARBEIT (UNIQUE verhindert Doppelversand auch bei
 *     gleichzeitigen Laeufen). Konflikt: nur eine echte Fehlerzeile (nicht IN_ARBEIT) darf atomar uebernommen werden.
 *  2. Senden.
 *  3. Abschluss: Erfolg -> 'gesendet', Fehler -> fehler_code = Transportcode. Jedes Update wird ausgewertet; misslingt
 *     es, bleibt IN_ARBEIT stehen -> Vorschau zeigt „Versandstatus unklar – bitte anrufen", nie automatisch erneut.
 *     Ein Prozessabbruch zwischen 1 und 3 hinterlaesst ebenso IN_ARBEIT, nie einen falschen Erfolg (Review 02.11.).
 */
export async function sendeLauf(supabase, { tenantId, userId, ids, lage, transportFabrik = createSMTPTransport, gmail = null, jetzt = new Date() }) {
  const gewuenscht = new Set(ids);
  // Nur, was die frische Pruefung erlaubt — nie dem Vorschau-Ergebnis des Browsers vertrauen.
  const ziele = lage.mail.filter(x => gewuenscht.has(x.termin.id));
  const abgelehnt = ids.length - ziele.length;
  const seit = new Date(jetzt.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: cErr } = await supabase.from('termin_mitteilungen').select('id', { count: 'exact', head: true })
    .eq('owner_id', tenantId).gte('created_at', seit);
  if (cErr) throw cErr;
  if ((count || 0) + ziele.length > TAGESDECKEL) {
    return { status: 429, body: { error: `Tagesgrenze von ${TAGESDECKEL} Mitteilungen erreicht.`, code: 'TAGESDECKEL' } };
  }
  const zaehler = { gesendet: 0, fehler: 0, doppelt: 0, abgelehnt, unklar: 0 };
  const abschliessen = async (zeileId, werte) => {
    const { data, error } = await supabase.from('termin_mitteilungen').update(werte)
      .eq('id', zeileId).eq('owner_id', tenantId).eq('fehler_code', IN_ARBEIT).select('id').maybeSingle();
    if (error || !data) zaehler.unklar += 1;
  };
  for (const { termin, tag, email } of ziele) {
    const reservierung = { status: 'fehler', fehler_code: IN_ARBEIT, freigegeben_von: userId, gesendet_am: null };
    const { data: zeile, error: iErr } = await supabase.from('termin_mitteilungen').insert({
      owner_id: tenantId, booking_id: termin.id, custom_day_id: tag.id || null, anlass: ANLASS, termin_beginn: termin.start_time, ...reservierung,
    }).select('id').maybeSingle();
    let zeileId = zeile?.id;
    if (iErr) {
      if (iErr.code !== '23505') throw iErr;
      const { data: alt, error: uErr } = await supabase.from('termin_mitteilungen').update(reservierung)
        .eq('owner_id', tenantId).eq('booking_id', termin.id).eq('anlass', ANLASS).eq('termin_beginn', termin.start_time)
        .eq('status', 'fehler').neq('fehler_code', IN_ARBEIT).select('id').maybeSingle();
      if (uErr) throw uErr;
      if (!alt) { zaehler.doppelt += 1; continue; }
      zeileId = alt.id;
    }
    if (!zeileId) { zaehler.unklar += 1; continue; }
    const { betreff, text } = mitteilungsText({ praxis: lage.profil.business_name, telefon: lage.profil.phone, startIso: termin.start_time });
    try {
      if (lage.weg === 'smtp') {
        await transportFabrik({ requireTLS: true }).sendMail({ from: getMailFrom(lage.profil.business_name), to: email, subject: betreff, text });
      } else {
        if (!gmail) { const f = new Error('gmail fehlt'); f.code = 'GMAIL_NICHT_VERBUNDEN'; throw f; }
        await sendeUeberGmail({ supabase, ...gmail, userId: tenantId, to: email, subject: betreff, text, senderName: lage.profil.business_name });
      }
    } catch (e) {
      zaehler.fehler += 1;
      const code = String(e?.code || 'VERSAND_FEHLER').slice(0, 64);
      await abschliessen(zeileId, { status: 'fehler', fehler_code: code === IN_ARBEIT ? 'VERSAND_FEHLER' : code });
      // SMTP nicht erreichbar / Gmail getrennt: sofort abbrechen statt je Empfaenger auf den Timeout zu warten (onprem O-240).
      if (SMTP_ABBRUCH.has(code)) {
        console.error('[sondertag/senden] SMTP abgebrochen', code, zaehler);
        return { status: 409, body: { error: 'Der Mailserver der Praxis ist nicht erreichbar. Bitte später erneut oder telefonisch informieren.', code, ...zaehler } };
      }
      if (code === 'GMAIL_NICHT_VERBUNDEN' || code === 'gmail_reauth_required') {
        console.error('[sondertag/senden] abgebrochen', code, zaehler);
        return { status: 409, body: { error: 'Gmail ist nicht verbunden. Bitte unter Einstellungen → E-Mail verbinden.', code, ...zaehler } };
      }
      continue;
    }
    zaehler.gesendet += 1;
    await abschliessen(zeileId, { status: 'gesendet', fehler_code: null, gesendet_am: new Date().toISOString() });
  }
  if (zaehler.fehler || zaehler.unklar) console.error('[sondertag/senden]', zaehler);
  return { status: 200, body: zaehler };
}

const kurz = ({ termin }) => ({ bookingId: termin.id, start: termin.start_time, name: termin.customer_name || null });

export function createSondertagMitteilungRouter({ supabase, transportFabrik = createSMTPTransport, env = process.env, kutu = istKutu, gmail = null, jetzt = () => new Date() } = {}) {
  const router = express.Router();
  const schluessel = req => req.auth?.tenantId || req.ip;
  const vorschauLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: schluessel,
    message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' } });
  const sendeLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 3, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: schluessel,
    message: { error: 'Höchstens drei Versandläufe pro Stunde.' } });

  router.post('/sondertag/mitteilung/vorschau', requireAuth, vorschauLimit, async (req, res) => {
    const { tenantId } = req.auth;
    try {
      const lage = await ladeLage(supabase, tenantId, String(req.body?.von || ''), String(req.body?.bis || req.body?.von || ''), { env, kutu: kutu(), jetzt: jetzt() });
      if (lage.fehler) return res.status(lage.status).json({ error: lage.fehler });
      const muster = lage.mail[0] || lage.anruf[0];
      return res.json({
        weg: lage.weg,
        mail: lage.mail.map(kurz),
        anruf: lage.anruf.map(x => ({ ...kurz(x), telefon: x.termin.customer_phone || null, grund: x.grund, grundText: GRUND_TEXT[x.grund] })),
        bereits: lage.schon.map(kurz),
        beispiel: muster ? mitteilungsText({ praxis: lage.profil.business_name, telefon: lage.profil.phone, startIso: muster.termin.start_time }) : null,
      });
    } catch (e) {
      console.error('[sondertag/vorschau]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Vorschau konnte nicht erstellt werden.' });
    }
  });

  router.post('/sondertag/mitteilung/senden', requireAuth, sendeLimit, async (req, res) => {
    const { tenantId, userId } = req.auth;
    const ids = req.body?.bookingIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > MAX_IDS || !ids.every(istUuid)) {
      return res.status(400).json({ error: `Bitte 1 bis ${MAX_IDS} Termine freigeben.` });
    }
    try {
      const lage = await ladeLage(supabase, tenantId, String(req.body?.von || ''), String(req.body?.bis || req.body?.von || ''), { env, kutu: kutu(), jetzt: jetzt() });
      if (lage.fehler) return res.status(lage.status).json({ error: lage.fehler });
      if (!lage.weg) return res.status(409).json({ error: 'E-Mail-Versand ist nicht eingerichtet.', code: 'VERSAND_NICHT_EINGERICHTET' });
      const { status, body } = await sendeLauf(supabase, { tenantId, userId, ids, lage, transportFabrik, gmail, jetzt: jetzt() });
      return res.status(status).json(body);
    } catch (e) {
      console.error('[sondertag/senden]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Versand konnte nicht durchgeführt werden.' });
    }
  });

  return router;
}
