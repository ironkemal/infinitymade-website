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
import { hatAbrechnungsRecht } from '../lib/modulrecht.js';
import { requireAuth } from '../ai/auth.js';
import { istKutu } from '../lib/dagitim.js';
import { createSMTPTransport, mailKanal, transportFabrikFuer, meldeVerbindungsfehler } from '../lib/mail.js';
import {
  ladeSnapshot, erzeugeBerichtPdf, erzeugePasswort, berichtDateiname,
  EMPFEHLUNG_CODES, BERICHT_ARTEN,
} from '../lib/therapiebericht.js';
import { erzeugeRechnungPdf, rechnungDateiname } from '../lib/rechnung-pdf.js';
import { sendeUeberGmail } from '../lib/gmail-senden.js';
import { pruefeFaxMuster, faxNummerNormalisieren, baueFaxAdresse } from '../lib/fax-adresse.js';

const EMAIL_RE = /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]+$/;
const MAX_TEXT = 4000;

/**
 * Darf diese Instanz selbst mailen? Box mit SMTP der Praxis (siehe Kopf). Mit `kanal` (lib/mail.js mailKanal)
 * zählt auch das in den Einstellungen verbundene Postfach — auch im SaaS, denn dann ist es das eigene Postfach
 * der Praxis, nicht der Praxura-Absender.
 */
export function versandMoeglich(env = process.env, kutu = istKutu(), kanal = null) {
  if (kanal) return kanal.weg === 'smtp' && (kanal.quelle === 'db' || !!kutu);
  return !!(kutu && env.SMTP_HOST);
}

/**
 * Reine Entscheidung über Faxversand (onprem O-231).
 * Gibt { senden: true, adresse } oder { senden: false, code } zurück.
 * Codes: 'SAAS' | 'KEIN_SMTP' | 'KEIN_MUSTER' | 'KEINE_FAXNUMMER'.
 */
export function entscheideFaxVersand({ kutu = false, smtp = null, muster = null, nummer = null } = {}) {
  if (!kutu) return { senden: false, code: 'SAAS' };
  if (!smtp) return { senden: false, code: 'KEIN_SMTP' };
  const p = pruefeFaxMuster(muster);
  if (!p.ok) return { senden: false, code: 'KEIN_MUSTER' };
  const nr = faxNummerNormalisieren(nummer);
  if (!nr) return { senden: false, code: 'KEINE_FAXNUMMER' };
  const adresse = baueFaxAdresse(muster, nummer);
  if (!adresse) return { senden: false, code: 'KEIN_MUSTER' };
  return { senden: true, adresse };
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

/**
 * Versandweg für Dokumente an Patienten (onprem O-233): Box → nur Praxis-SMTP,
 * SaaS → nur das Gmail-Konto der Praxis. Nie ein Praxura-SMTP als Rückfall.
 * @returns {'smtp'|'gmail'|null}
 */
export function versandWeg(env = process.env, kutu = istKutu(), kanal = null) {
  if (kanal) return kanal.weg === 'kein' ? null : kanal.weg;
  if (kutu) return env.SMTP_HOST ? 'smtp' : null;
  return 'gmail';
}

/** Kanal für Dokumente einer Praxis (Einstellung → SMTP_* → kein), mit den injizierten env/kutu der Tests. */
export function dokumentKanal(supabase, tenantId, env = process.env, kutu = istKutu()) {
  return mailKanal({ supabase, ownerId: tenantId, zweck: 'dokument', env, kutu });
}

/**
 * Darf der Aufrufer diese Rechnung sehen/versenden? Inhaber: ja. Mitarbeiter: nur mit dem Recht 'abrechnung' für die Praxis der
 * Rechnung (wie api-backend/billing/api/rechnung-zahlung.routes.js und die Datenbank-Policy 0121). Die Prüfung selbst steht in
 * lib/modulrecht.js (gemeinsam mit dem Abrechnungsstatus, guvenlik S-65). Rechnung ohne Praxis: für Mitarbeiter nein.
 */
export function abrechnungRechtFuerRechnung(auth, inv, token, rpc) {
  return hatAbrechnungsRecht({ auth, ownerId: inv?.owner_id, businessIds: inv?.business_id ? [inv.business_id] : [], token, rpc });
}

export function createDokumentMailRouter({ supabase, transportFabrik = createSMTPTransport, env = process.env, kutu = istKutu, gmail = null } = {}) {
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
      const faxDeckblatt = werte.aktion === 'fax';
      const pdf = await erzeugeBerichtPdf(inhalt, { passwort, faxDeckblatt });
      const an = werte.aktion === 'mail' ? (werte.an_email || snapshot.arzt?.email || '')
        : werte.aktion === 'fax' ? (snapshot.arzt?.fax || '') : '';

      let gesendet = false;
      const kanal = werte.aktion === 'vorschau' || werte.aktion === 'druck' ? null : await dokumentKanal(supabase, tenantId, env, kutu());
      const fabrik = transportFabrikFuer(kanal, transportFabrik);
      if (werte.aktion === 'mail' && versandMoeglich(env, kutu(), kanal)) {
        if (!an) return res.status(400).json({ error: 'Für diesen Arzt ist keine E-Mail-Adresse hinterlegt.' });
        try {
          await fabrik({ requireTLS: true }).sendMail({
            from: kanal.from(snapshot.praxis?.name),
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
          await meldeVerbindungsfehler(supabase, tenantId, kanal, e);
          return res.status(502).json({ error: 'Die E-Mail konnte nicht versendet werden (Mailserver). Bitte Einstellungen prüfen oder als Fax/Druck senden.', code: 'SMTP_FEHLER' });
        }
      }

      let faxEntscheidung = null;
      if (werte.aktion === 'fax') {
        let muster = null;
        try {
          const { data: prof, error: profErr } = await supabase
            .from('profiles')
            .select('fax_mail_muster')
            .eq('id', tenantId)
            .maybeSingle();
          if (!profErr && prof?.fax_mail_muster) {
            muster = prof.fax_mail_muster;
          }
        } catch {
          muster = null;
        }

        faxEntscheidung = entscheideFaxVersand({
          kutu: kutu(),
          smtp: kanal?.weg === 'smtp',
          muster,
          nummer: an,
        });

        if (faxEntscheidung.senden) {
          try {
            await fabrik({ requireTLS: true }).sendMail({
              from: kanal.from(snapshot.praxis?.name),
              to: faxEntscheidung.adresse,
              subject: 'Fax',
              text: 'Sehr geehrte Damen und Herren,\n\nanbei erhalten Sie ein Telefax.\n\nMit freundlichen Grüßen\n' + (snapshot.praxis?.name || ''),
              attachments: [{ filename: dateiname, content: pdf, contentType: 'application/pdf' }],
            });
            gesendet = true;
          } catch (e) {
            console.error('[dokument/therapiebericht] Fax-Versand fehlgeschlagen', e?.code || '', e?.responseCode || '');
            await meldeVerbindungsfehler(supabase, tenantId, kanal, e);
            return res.status(502).json({
              error: 'Das Fax konnte nicht über den Mailserver versendet werden. Bitte Einstellungen prüfen oder das PDF drucken.',
              code: 'SMTP_FEHLER',
            });
          }
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
        ...(werte.aktion === 'fax' && !gesendet ? { code: 'FAX_NICHT_GESENDET', fax_hinweis: faxEntscheidung?.code } : {}),
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

  // Rechnung an den Patienten: Vorschau (offen) oder Mail (immer passwortgeschützt).
  // LEGAL_DECISIONS 2026-10-31. Inhalt, Empfänger und PDF werden nicht gespeichert/geloggt.
  router.post('/dokument/rechnung', requireAuth, limiter, async (req, res) => {
    const aktion = String(req.body?.aktion || '');
    const invoice_id = String(req.body?.invoice_id || '');
    const an_email = String(req.body?.an_email || '').trim();
    if (!['vorschau', 'mail'].includes(aktion)) return res.status(400).json({ error: 'Unbekannte Aktion.' });
    if (!/^[0-9a-f-]{36}$/i.test(invoice_id)) return res.status(400).json({ error: 'Rechnung fehlt.' });
    if (an_email && !EMAIL_RE.test(an_email)) return res.status(400).json({ error: 'Die E-Mail-Adresse ist ungültig.' });
    const { tenantId } = req.auth;
    try {
      const { data: inv, error } = await supabase.from('invoices').select('*')
        .eq('id', invoice_id).eq('owner_id', tenantId).maybeSingle();
      if (error) throw error;
      if (!inv) return res.status(404).json({ error: 'Rechnung nicht gefunden.' });
      const bearer = String(req.headers.authorization || '');
      if (!(await abrechnungRechtFuerRechnung(req.auth, inv, bearer.startsWith('Bearer ') ? bearer.slice(7) : null))) {
        return res.status(403).json({ error: 'Für Rechnungen fehlt die Berechtigung „Abrechnung“. Bitte die Praxisinhaberin oder den Praxisinhaber fragen.', code: 'KEINE_BERECHTIGUNG' });
      }
      if (inv.status === 'draft') return res.status(409).json({ error: 'Entwürfe werden nicht versendet. Bitte die Rechnung zuerst abschließen.' });
      const rezeptId = inv.prescription_id || inv.verordnung_id;
      const [patR, rxR, profR] = await Promise.all([
        inv.patient_id ? supabase.from('leads').select('first_name,last_name,title,geburtsdatum,street,plz,city,email')
          .eq('id', inv.patient_id).eq('owner_id', tenantId).maybeSingle() : Promise.resolve({ data: null }),
        rezeptId ? supabase.from('prescriptions').select('heilmittel,icd10,diagnosegruppe,ausstellungsdatum')
          .eq('id', rezeptId).eq('owner_id', tenantId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from('profiles').select('business_name,owner_first_name,owner_last_name,street,house_number,zip,plz,city,phone,email,ik_number,tax_exempt_note,steuernummer,ust_id,invoice_footer_text')
          .eq('id', tenantId).maybeSingle(),
      ]);
      const daten = { inv, patient: patR.data, rx: rxR.data, profil: profR.data || {} };
      const dateiname = rechnungDateiname(inv);
      if (aktion === 'vorschau') {
        const pdf = await erzeugeRechnungPdf(daten);
        return res.json({ pdf_base64: pdf.toString('base64'), dateiname });
      }

      const an = an_email || patR.data?.email || '';
      const passwort = erzeugePasswort();
      const pdf = await erzeugeRechnungPdf(daten, { passwort });
      const praxis = (inv.aussteller_snapshot?.name) || profR.data?.business_name || '';
      const praxisMail = inv.aussteller_snapshot?.email || profR.data?.email || '';
      const betreff = `Ihre Rechnung${inv.invoice_number ? ' ' + inv.invoice_number : ''}${praxis ? ' – ' + praxis : ''}`;
      const text = 'Guten Tag,\n\nanbei erhalten Sie Ihre Rechnung als PDF. '
        + 'Das PDF ist passwortgeschützt; das Passwort teilen wir Ihnen persönlich oder telefonisch mit.\n\n'
        + `Mit freundlichen Grüßen\n${praxis}`;
      const kanal = await dokumentKanal(supabase, tenantId, env, kutu());
      const weg = versandWeg(env, kutu(), kanal);
      let gesendet = false;
      if (weg && an) {
        try {
          if (weg === 'smtp') {
            await transportFabrikFuer(kanal, transportFabrik)({ requireTLS: true }).sendMail({
              from: kanal.from(praxis),
              ...(praxisMail && EMAIL_RE.test(praxisMail) ? { replyTo: praxisMail } : {}),
              to: an, subject: betreff, text,
              attachments: [{ filename: dateiname, content: pdf, contentType: 'application/pdf' }],
            });
            gesendet = true;
          } else if (gmail) {
            await sendeUeberGmail({ supabase, ...gmail, userId: tenantId, to: an, subject: betreff, text, senderName: praxis,
              attachments: [{ filename: dateiname, content: pdf, contentType: 'application/pdf' }] });
            gesendet = true;
          }
        } catch (e) {
          console.error('[dokument/rechnung] Versand fehlgeschlagen', e?.code || '', e?.responseCode || '');
          await meldeVerbindungsfehler(supabase, tenantId, kanal, e);
          if (e?.code === 'GMAIL_NICHT_VERBUNDEN' || e?.code === 'gmail_reauth_required') {
            return res.status(409).json({ error: 'Gmail ist nicht verbunden. Bitte unter Einstellungen → E-Mail-Versand verbinden – oder das PDF herunterladen und selbst senden.', code: e.code, passwort, pdf_base64: pdf.toString('base64'), dateiname });
          }
          return res.status(502).json({ error: 'Die E-Mail konnte nicht versendet werden. Bitte das PDF herunterladen und selbst senden.', code: 'VERSAND_FEHLER', passwort, pdf_base64: pdf.toString('base64'), dateiname });
        }
      }
      return res.json({
        gesendet, weg: gesendet ? weg : null, empfaenger: gesendet ? an : null, passwort,
        ...(gesendet ? {} : { pdf_base64: pdf.toString('base64'), dateiname, code: !an ? 'KEINE_EMAIL' : 'VERSAND_NICHT_EINGERICHTET' }),
      });
    } catch (e) {
      console.error('[dokument/rechnung]', e?.code || 'Fehler');
      return res.status(500).json({ error: 'Die Rechnung konnte nicht erstellt werden.' });
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
