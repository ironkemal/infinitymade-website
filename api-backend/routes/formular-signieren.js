// formular-signieren.js — Formular mit Unterschriften versehen (K6 Teil A).
//
// Endpunkt: POST /api/dokument/formular-signieren
//
// Ablauf:
//   1. Eingabeprüfung (UUIDs, max 10 Signaturen, Base64-PNG <= 400 KB, eindeutige Indizes)
//   2. Formular (aktiv) und Patient laden (Mandantenprüfung owner_id=tenantId)
//   3. Signaturfelder gegen Formular-Definition prüfen (alle müssen unterschrieben sein)
//   4. Vorlagenpfad validieren (tenantId-Präfix, kein .., kein //), aus Bucket laden und SHA-256 prüfen
//   5. Signaturen einbetten (lib/formular-pdf.js)
//   6. Signiertes PDF im Bucket ablegen
//   7. Eintrag in patient_dokumente anlegen (Rollback der Datei bei Fehler)
//   8. Falls formular.ist_einwilligung: Signatur 0 ablegen und patient_consents schreiben (bei Fehler PNG löschen)
//   9. Antwort 200 { dokument_id, einwilligung_gespeichert }

import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { requireAuth as defaultRequireAuth } from '../ai/auth.js';
import {
  pruefePng,
  bettePdfSignaturen,
  saubererName,
} from '../lib/formular-pdf.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Reine Validierungsfunktion für den Request-Body.
 *
 * @param {object} body
 * @returns {{ ok: true, werte: { formular_id: string, lead_id: string, signaturen: Array, signed_name: string|null }, fehler: null }
 *          | { ok: false, fehler: string, error: string }}
 */
export function pruefeFormularSignierenEingabe(body = {}) {
  if (!body || typeof body !== 'object') {
    const f = 'Anfrage-Daten fehlen oder sind ungültig.';
    return { ok: false, fehler: f, error: f };
  }

  const formular_id = String(body.formular_id || '').trim();
  if (!UUID_RE.test(formular_id)) {
    const f = 'Formular-ID fehlt oder ist ungültig.';
    return { ok: false, fehler: f, error: f };
  }

  const lead_id = String(body.lead_id || '').trim();
  if (!UUID_RE.test(lead_id)) {
    const f = 'Patienten-ID (lead_id) fehlt oder ist ungültig.';
    return { ok: false, fehler: f, error: f };
  }

  const signaturen = body.signaturen;
  if (!Array.isArray(signaturen) || signaturen.length === 0) {
    const f = 'Mindestens eine Signatur ist erforderlich.';
    return { ok: false, fehler: f, error: f };
  }

  if (signaturen.length > 10) {
    const f = 'Maximal 10 Signaturen erlaubt.';
    return { ok: false, fehler: f, error: f };
  }

  const geseheneIndizes = new Set();
  const normalisierteSignaturen = [];

  for (let i = 0; i < signaturen.length; i++) {
    const s = signaturen[i];
    if (!s || typeof s !== 'object') {
      const f = `Signatur an Position ${i} ist ungültig.`;
      return { ok: false, fehler: f, error: f };
    }

    const feldIndex = s.feld_index;
    if (!Number.isInteger(feldIndex) || feldIndex < 0) {
      const f = 'Der Feld-Index muss eine nicht-negative Ganzzahl sein.';
      return { ok: false, fehler: f, error: f };
    }

    if (geseheneIndizes.has(feldIndex)) {
      const f = `Doppelter feld_index ${feldIndex} in den Signaturen.`;
      return { ok: false, fehler: f, error: f };
    }
    geseheneIndizes.add(feldIndex);

    const pngCheck = pruefePng(s.png_base64);
    if (!pngCheck.ok) {
      const f = `Signatur ${feldIndex}: ${pngCheck.fehler}`;
      return { ok: false, fehler: f, error: f };
    }

    normalisierteSignaturen.push({
      feld_index: feldIndex,
      png_base64: s.png_base64,
      buffer: pngCheck.buffer,
    });
  }

  let signed_name = null;
  if (typeof body.signed_name === 'string' && body.signed_name.trim()) {
    signed_name = body.signed_name.trim().slice(0, 200);
  }

  return {
    ok: true,
    fehler: null,
    werte: {
      formular_id,
      lead_id,
      signaturen: normalisierteSignaturen,
      signed_name,
    },
  };
}

/**
 * Erzeugt den Router für Formular-Signaturen.
 *
 * @param {object} [options]
 * @param {object} options.supabase - Supabase Service-Role-Client
 * @param {Function} [options.requireAuth] - Auth-Middleware
 * @param {boolean} [options.skipRateLimit] - Deaktiviert Rate-Limiter (für Tests)
 * @returns {express.Router}
 */
export function createFormularSignierenRouter(options = {}) {
  const router = express.Router();
  const supabase = options.supabase;
  const authMiddleware = options.requireAuth || defaultRequireAuth;
  const noopMiddleware = (_req, _res, next) => next();

  // Rate-Limit: 30 pro Stunde je Nutzer
  const limiter = options.skipRateLimit ? noopMiddleware : rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: (req) => req.auth?.userId || 'unauth',
    message: { error: 'Zu viele Signiervorgänge in kurzer Zeit. Bitte später erneut versuchen.' },
  });

  router.post('/dokument/formular-signieren', authMiddleware, limiter, async (req, res) => {
    // 1. Eingabe prüfen
    const pruefung = pruefeFormularSignierenEingabe(req.body);
    if (!pruefung.ok) {
      return res.status(400).json({ error: pruefung.fehler });
    }

    const { tenantId, userId } = req.auth || {};
    if (!tenantId) {
      return res.status(401).json({ error: 'Mandanten-Kontext fehlt.' });
    }

    const { formular_id, lead_id, signaturen, signed_name } = pruefung.werte;

    try {
      // 2. praxis_formulare und leads laden (Mandantenprüfung owner_id=tenantId, leads nur .select('id'))
      const { data: formular, error: fErr } = await supabase
        .from('praxis_formulare')
        .select('*')
        .eq('id', formular_id)
        .eq('owner_id', tenantId)
        .eq('aktiv', true)
        .maybeSingle();

      if (fErr) throw fErr;
      if (!formular) {
        return res.status(404).json({ error: 'Formular nicht gefunden oder nicht aktiv.' });
      }

      const { data: lead, error: lErr } = await supabase
        .from('leads')
        .select('id')
        .eq('id', lead_id)
        .eq('owner_id', tenantId)
        .maybeSingle();

      if (lErr) throw lErr;
      if (!lead) {
        return res.status(404).json({ error: 'Patient nicht gefunden.' });
      }

      // 3. Anzahl und feld_index müssen exakt zu signatur_felder passen
      const felder = Array.isArray(formular.signatur_felder) ? formular.signatur_felder : [];
      if (signaturen.length !== felder.length) {
        return res.status(400).json({ error: 'Alle Unterschriftsfelder muessen unterschrieben sein.' });
      }

      const pngBuffers = new Array(felder.length);
      for (const sig of signaturen) {
        if (sig.feld_index < 0 || sig.feld_index >= felder.length) {
          return res.status(400).json({ error: 'Alle Unterschriftsfelder muessen unterschrieben sein.' });
        }
        pngBuffers[sig.feld_index] = sig.buffer;
      }

      // 4. Vorlagenpfad prüfen: muss mit tenantId/ beginnen, kein .. und kein //
      const storagePath = formular.storage_path;
      if (
        !storagePath ||
        typeof storagePath !== 'string' ||
        !storagePath.startsWith(`${tenantId}/`) ||
        /(^|\/)\.\.(\/|$)/.test(storagePath) ||
        storagePath.includes('//')
      ) {
        return res.status(400).json({ error: 'Ungültiger Vorlagenpfad.' });
      }

      // PDF aus Bucket 'patient-documents' laden und Hash prüfen
      const { data: fileBlob, error: dlErr } = await supabase.storage
        .from('patient-documents')
        .download(storagePath);

      if (dlErr || !fileBlob) {
        console.error('[dokument/formular-signieren] DOWNLOAD_FEHLER', dlErr?.code || '');
        return res.status(500).json({ error: 'Formular-Vorlage konnte nicht geladen werden.' });
      }

      let pdfBytes;
      if (typeof fileBlob.arrayBuffer === 'function') {
        pdfBytes = Buffer.from(await fileBlob.arrayBuffer());
      } else if (Buffer.isBuffer(fileBlob)) {
        pdfBytes = fileBlob;
      } else if (fileBlob instanceof Uint8Array) {
        pdfBytes = Buffer.from(fileBlob.buffer, fileBlob.byteOffset, fileBlob.byteLength);
      } else {
        pdfBytes = Buffer.from(fileBlob);
      }

      const hash = crypto.createHash('sha256').update(pdfBytes).digest('hex');
      if (hash !== formular.pdf_sha256) {
        return res.status(409).json({ error: 'Formular wurde veraendert' });
      }

      // 5. Signaturen einbetten (MediaBox, 10MB- und 100-Seiten-Limit)
      let signedPdfBytes;
      try {
        signedPdfBytes = await bettePdfSignaturen(pdfBytes, felder, pngBuffers);
      } catch (embErr) {
        console.error('[dokument/formular-signieren] PDF_EMBED_FEHLER', embErr?.code || '');
        return res.status(500).json({ error: embErr?.message || 'Signaturen konnten nicht in das PDF eingebettet werden.' });
      }

      // 6. Ergebnis-PDF nach 'patient-documents' hochladen
      const dateiUuid = crypto.randomUUID();
      const ergebnisStoragePath = `${tenantId}/${lead_id}/dokumente/${dateiUuid}-formular.pdf`;
      const dateiSha256 = crypto.createHash('sha256').update(signedPdfBytes).digest('hex');
      const groesseBytes = signedPdfBytes.length;

      const { error: upErr } = await supabase.storage
        .from('patient-documents')
        .upload(ergebnisStoragePath, signedPdfBytes, {
          contentType: 'application/pdf',
          upsert: false,
        });

      if (upErr) {
        console.error('[dokument/formular-signieren] STORAGE_UPLOAD_FEHLER', upErr?.code || '');
        return res.status(500).json({ error: 'Signiertes Dokument konnte nicht gespeichert werden.' });
      }

      // 7. Insert patient_dokumente (bei Fehler Datei entfernen)
      const dateiname = `${saubererName(formular.titel)}-unterschrieben.pdf`;
      const dokRow = {
        owner_id: tenantId,
        business_id: formular.business_id || null,
        lead_id,
        kategorie: 'formular_signiert',
        formular_id: formular.id,
        storage_path: ergebnisStoragePath,
        dateiname,
        mime_type: 'application/pdf',
        groesse_bytes: groesseBytes,
        datei_sha256: dateiSha256,
        created_by: userId || null,
      };

      const { data: dokZeile, error: docErr } = await supabase
        .from('patient_dokumente')
        .insert(dokRow)
        .select('id')
        .maybeSingle();

      if (docErr || !dokZeile) {
        console.error('[dokument/formular-signieren] DOKUMENT_INSERT_FEHLER', docErr?.code || '');
        try {
          await supabase.storage.from('patient-documents').remove([ergebnisStoragePath]);
        } catch (cleanErr) {
          console.error('[dokument/formular-signieren] CLEANUP_FEHLER', cleanErr?.code || '');
        }
        return res.status(500).json({ error: 'Dokument konnte nicht in der Akte abgelegt werden.' });
      }

      // 8. Falls formular.ist_einwilligung: Signatur 0 als Datei hochladen und patient_consents schreiben
      let einwilligung_gespeichert = false;
      if (formular.ist_einwilligung) {
        const png0 = pngBuffers[0];
        const sigUuid = crypto.randomUUID();
        const sigStoragePath = `${tenantId}/${lead_id}/einwilligung_praxis_formular_${sigUuid}.png`;

        try {
          const { error: sigUpErr } = await supabase.storage
            .from('patient-documents')
            .upload(sigStoragePath, png0, {
              contentType: 'image/png',
              upsert: false,
            });

          if (sigUpErr) throw sigUpErr;

          const version = formular.version || 1;
          const consentType = formular.consent_type || 'praxis_formular';
          const consentRow = {
            owner_id: tenantId,
            business_id: formular.business_id || null,
            patient_id: lead_id,
            consent_type: consentType,
            text_version: `v${version}`,
            text_sha256: formular.pdf_sha256,
            text_snapshot: `Praxis-Formular „${formular.titel}" (Version ${version}), PDF SHA-256 ${formular.pdf_sha256}`,
            signature_path: sigStoragePath,
            signed_name: signed_name || null,
            captured_by_user_id: userId || null,
            device_label: 'Praxis-Formular',
          };

          const { error: consentErr } = await supabase
            .from('patient_consents')
            .insert(consentRow);

          if (consentErr) throw consentErr;

          einwilligung_gespeichert = true;
        } catch (cErr) {
          console.error('[dokument/formular-signieren] CONSENT_INSERT_FEHLER', cErr?.code || '');
          // Im Fehlerfall die hochgeladene Signatur-PNG wieder entfernen
          try {
            await supabase.storage.from('patient-documents').remove([sigStoragePath]);
          } catch (cleanSigErr) {
            console.error('[dokument/formular-signieren] CLEANUP_SIG_FEHLER', cleanSigErr?.code || '');
          }
          // Dokument bleibt erhalten (kein Rollback des Dokuments)
          return res.status(500).json({
            error: 'Dokument wurde signiert und abgelegt, aber die Einwilligung konnte nicht protokolliert werden.',
            dokument_id: dokZeile.id,
            einwilligung_gespeichert: false,
          });
        }
      }

      // 9. Antwort 200
      return res.status(200).json({
        dokument_id: dokZeile.id,
        einwilligung_gespeichert,
      });
    } catch (e) {
      console.error('[dokument/formular-signieren] ALLGEMEINER_FEHLER', e?.code || '');
      return res.status(500).json({ error: 'Das Formular konnte nicht signiert werden.' });
    }
  });

  return router;
}
