// Therapiebericht versenden: Mail (passwortgeschütztes PDF), Fax/Druck (offenes PDF).
//
// Rahmen — compliance/LEGAL_DECISIONS.md 2026-10-22 (legal-de), onprem O-216:
//   - Mail nur als AES-256-PDF, Passwort zufällig, NIE gespeichert/geloggt/gemailt;
//     es geht genau einmal in der Antwort an die Praxis, die es telefonisch übermittelt.
//   - requireTLS: ohne TLS kein Versand.
//   - Echter Versand NUR in der Box über das SMTP der Praxis. Im SaaS liefe die Mail
//     über den Praxura-Absender — Gesundheitsdaten an unseren
//     Mailanbieter. Dort (und in einer Box ohne SMTP) gibt es stattdessen das
//     verschlüsselte PDF zum Herunterladen + Passwort; die Praxis hängt es selbst an.
//   - Logs: nur err.code/responseCode — nodemailer-Meldungen enthalten Empfänger.
//
// Die Berichtzeile (therapieberichte, Migration 0087) entsteht beim Versand und ist
// danach festgeschrieben. Schreiben nur hier, mit service_role.

import express from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../ai/auth.js';
import { istKutu } from '../lib/dagitim.js';
import { createSMTPTransport, getMailFrom } from '../lib/mail.js';
import {
  ladeSnapshot, erzeugeBerichtPdf, erzeugePasswort, berichtDateiname,
  EMPFEHLUNG_CODES, BERICHT_ARTEN,
} from '../lib/therapiebericht.js';

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const MAX_TEXT = 4000;

/** Darf diese Instanz selbst mailen? Nur Box mit eigenem SMTP (siehe Kopf). */
export function versandMoeglich(env = process.env, kutu = istKutu()) {
  return !!(kutu && env.SMTP_HOST);
}

/** Eingaben prüfen und normalisieren. Gibt {fehler} oder {werte} zurück. */
export function pruefeEingabe(body = {}) {
  const aktion = String(body.aktion || '');
  if (!['vorschau', 'mail', 'fax', 'druck'].includes(aktion)) return { fehler: 'Unbekannte Aktion.' };
  const prescription_id = String(body.prescription_id || '');
  if (!/^[0-9a-f-]{36}$/i.test(prescription_id)) return { fehler: 'Verordnung fehlt.' };
  const art = body.art && BERICHT_ARTEN[body.art] ? body.art : 'zwischenbericht';
  const empfehlung_code = body.empfehlung_code && EMPFEHLUNG_CODES[body.empfehlung_code] ? body.empfehlung_code : null;
  const verlauf = String(body.verlauf || '').slice(0, MAX_TEXT);
  const empfehlung = String(body.empfehlung || '').slice(0, MAX_TEXT);
  const an_email = String(body.an_email || '').trim();
  if (aktion === 'mail' && an_email && !EMAIL_RE.test(an_email)) return { fehler: 'Die E-Mail-Adresse ist ungültig.' };
  return { werte: { aktion, prescription_id, art, empfehlung_code, verlauf, empfehlung, an_email } };
}

export function createDokumentMailRouter({ supabase, transportFabrik = createSMTPTransport, env = process.env, kutu = istKutu } = {}) {
  const router = express.Router();

  const limiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId || req.ip,
    message: { error: 'Zu viele Berichte in kurzer Zeit. Bitte später erneut versuchen.' },
  });

  router.post('/dokument/therapiebericht', requireAuth, limiter, async (req, res) => {
    const { fehler, werte } = pruefeEingabe(req.body);
    if (fehler) return res.status(400).json({ error: fehler });
    const { tenantId, userId } = req.auth;

    try {
      const { rx, snapshot } = await ladeSnapshot(supabase, tenantId, werte.prescription_id);
      const datum = new Date();
      const inhalt = { snapshot, art: werte.art, verlauf: werte.verlauf, empfehlung: werte.empfehlung, empfehlung_code: werte.empfehlung_code, datum };
      const dateiname = berichtDateiname(snapshot, datum);

      if (werte.aktion === 'vorschau') {
        const pdf = await erzeugeBerichtPdf(inhalt);
        return res.json({ pdf_base64: pdf.toString('base64'), dateiname });
      }

      const passwort = werte.aktion === 'mail' ? erzeugePasswort() : null;
      const pdf = await erzeugeBerichtPdf(inhalt, { passwort });
      const an = werte.aktion === 'mail' ? (werte.an_email || snapshot.arzt?.email || '')
        : werte.aktion === 'fax' ? (snapshot.arzt?.fax || '') : '';

      let gesendet = false;
      if (werte.aktion === 'mail' && versandMoeglich(env, kutu())) {
        if (!an) return res.status(400).json({ error: 'Für diesen Arzt ist keine E-Mail-Adresse hinterlegt.' });
        try {
          await transportFabrik({ requireTLS: true }).sendMail({
            from: getMailFrom(snapshot.praxis?.name),
            ...(snapshot.praxis?.email && EMAIL_RE.test(snapshot.praxis.email) ? { replyTo: snapshot.praxis.email } : {}),
            to: an,
            subject: `Therapiebericht${snapshot.verordnung?.ausstellungsdatum ? ' zur Verordnung vom ' + snapshot.verordnung.ausstellungsdatum.split('-').reverse().join('.') : ''}`,
            text: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie unseren Therapiebericht. '
              + 'Das PDF ist passwortgeschützt; das Passwort teilen wir Ihnen telefonisch mit.\n\n'
              + `Mit freundlichen kollegialen Grüßen\n${snapshot.praxis?.name || ''}\n${snapshot.praxis?.telefon ? 'Tel. ' + snapshot.praxis.telefon : ''}`,
            attachments: [{ filename: dateiname, content: pdf, contentType: 'application/pdf' }],
          });
          gesendet = true;
        } catch (e) {
          console.error('[dokument/therapiebericht] Versand fehlgeschlagen', e?.code || '', e?.responseCode || '');
          return res.status(502).json({ error: 'Die E-Mail konnte nicht versendet werden (Mailserver). Bitte Einstellungen prüfen oder als Fax/Druck senden.', code: 'SMTP_FEHLER' });
        }
      }

      const { data: zeile, error: insErr } = await supabase.from('therapieberichte').insert({
        owner_id: tenantId,
        business_id: rx.business_id || null,
        prescription_id: rx.id,
        lead_id: rx.patient_id || null,
        arzt_id: rx.arzt_id || null,
        art: werte.art,
        verlauf: werte.verlauf || null,
        empfehlung: werte.empfehlung || null,
        empfehlung_code: werte.empfehlung_code,
        inhalt_snapshot: snapshot,
        versand_weg: werte.aktion,
        empfaenger: an || null,
        verschluesselt: !!passwort,
        versendet_am: datum.toISOString(),
        versendet_von: userId,
      }).select('id').single();
      if (insErr) throw insErr;

      const { error: rxErr } = await supabase.from('prescriptions')
        .update({ bericht_status: 'erledigt' }).eq('id', rx.id).eq('owner_id', tenantId);
      if (rxErr) console.error('[dokument/therapiebericht] bericht_status', rxErr.code || '');

      return res.json({
        bericht_id: zeile.id,
        gesendet,
        ...(werte.aktion === 'mail' && !gesendet ? { code: 'SMTP_FEHLT' } : {}),
        ...(passwort ? { passwort } : {}),
        ...(gesendet ? {} : { pdf_base64: pdf.toString('base64'), dateiname }),
        empfaenger: an || null,
        // Für Passwort-Anruf und Fax-Deckblatt im Browser — keine Patientendaten.
        arzt: snapshot.arzt ? { name: snapshot.arzt.name, fax: snapshot.arzt.fax, telefon: snapshot.arzt.telefon } : null,
        praxis: snapshot.praxis,
      });
    } catch (e) {
      if (e?.status === 404) return res.status(404).json({ error: e.message });
      console.error('[dokument/therapiebericht]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Der Bericht konnte nicht erstellt werden.' });
    }
  });

  // Vermerk „Passwort telefonisch übermittelt" — die einzige Änderung nach dem Versand.
  router.post('/dokument/therapiebericht/:id/passwort-telefonisch', requireAuth, limiter, async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Ungültige ID.' });
    try {
      const { data, error } = await supabase.from('therapieberichte')
        .update({ passwort_telefonisch: true }).eq('id', id).eq('owner_id', req.auth.tenantId).select('id');
      if (error) throw error;
      if (!data?.length) return res.status(404).json({ error: 'Bericht nicht gefunden.' });
      return res.json({ ok: true });
    } catch (e) {
      console.error('[dokument/passwort-telefonisch]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Vermerk konnte nicht gespeichert werden.' });
    }
  });

  // Archiv: versandten Bericht aus dem Snapshot neu erzeugen (offen, nur für die Praxis).
  router.get('/dokument/therapiebericht/:id/pdf', requireAuth, limiter, async (req, res) => {
    const id = String(req.params.id || '');
    if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'Ungültige ID.' });
    try {
      const { data: b, error } = await supabase.from('therapieberichte')
        .select('inhalt_snapshot, art, verlauf, empfehlung, empfehlung_code, versendet_am')
        .eq('id', id).eq('owner_id', req.auth.tenantId).maybeSingle();
      if (error) throw error;
      if (!b) return res.status(404).json({ error: 'Bericht nicht gefunden.' });
      const datum = new Date(b.versendet_am);
      const pdf = await erzeugeBerichtPdf({ snapshot: b.inhalt_snapshot, art: b.art, verlauf: b.verlauf || '', empfehlung: b.empfehlung || '', empfehlung_code: b.empfehlung_code, datum });
      return res.json({ pdf_base64: pdf.toString('base64'), dateiname: berichtDateiname(b.inhalt_snapshot, datum) });
    } catch (e) {
      console.error('[dokument/therapiebericht/pdf]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Der Bericht konnte nicht erzeugt werden.' });
    }
  });

  return router;
}
