// § 302 SGB V Sammelabrechnung HTTP routes.
//
// POST /api/billing/abrechnung/create
//   body: { ownerId, kostentraegerIk, prescriptionIds[] }
//   - Validates therapist cert + Krankenkasse routing
//   - Builds DTA EDIFACT file (Anlage 1 V21)
//   - Renders Begleitzettel HTML
//   - Uploads both to Storage bucket "abrechnungen"
//   - Inserts abrechnung row, links prescriptions
//
// Faz A2: DTA is plain (no PKCS#7). Signing is Sprint 9-10.

import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { buildDtaFile } from '../dta/builder.js';
import { findPosition, resolvePositionsnummer, PHYSIO_POSITIONS } from '../codes/physio_positions.js';
import { renderBegleitzettel } from '../pdf/begleitzettel.template.js';
import { parseZaaFile } from '../zaa/parser.js';

const router = express.Router();
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// ---------- helpers ----------

function isoWeek(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week };
}

function buildSammelRechnungsnummer(year, week, seq) {
  return `R${year}-W${String(week).padStart(2, '0')}-${String(seq).padStart(3, '0')}`;
}

function nameParts(lead) {
  return { vorname: lead?.first_name || '', nachname: lead?.last_name || '' };
}

// Map a DB prescription row → buildDtaFile prescription shape.
function mapPrescriptionToDtaShape(rx, lead, doctor) {
  const np = nameParts(lead);
  const abrechnungscode = '22'; // Physiotherapie (Faz A2 default)

  // Resolve Positionsnummer (template like 'X0501' or stored numeric).
  const stored = rx.heilmittel_position;
  if (!stored) {
    throw new Error(`prescription ${rx.id}: heilmittel_position fehlt`);
  }
  const pos = findPosition(stored, abrechnungscode);
  const positionsnummer = pos?.positionsnummer || resolvePositionsnummer(stored, abrechnungscode);
  const einzelbetrag    = pos?.preis ?? 0;
  const zuzahlungProPos = pos?.zuzahlung ?? Number(einzelbetrag) * 0.10;

  const sessions = [{
    positionsnummer,
    datumLeistung: rx.ausstellungsdatum || new Date().toISOString().slice(0, 10),
    anzahl:        rx.anzahl_einheiten || 1,
    einzelbetrag:  einzelbetrag,
    zuzahlungProPos: rx.zuzahlung_befreit ? 0 : zuzahlungProPos,
  }];

  return {
    patient: {
      kvnr:               lead?.versichertennummer || '',
      versichertenstatus: '1',
      nachname:           np.nachname,
      vorname:            np.vorname,
      geburtsdatum:       lead?.geburtsdatum || '',
      belegnummer:        rx.id.slice(0, 10),
    },
    doctor: {
      lanr: rx.doctor_lanr || doctor?.lanr || '999999999',
      bsnr: rx.doctor_bsnr || doctor?.bsnr || '999999999',
    },
    verordnung: {
      ausstellungsdatum:        rx.ausstellungsdatum,
      icd10:                    rx.icd10 || '',
      diagnosegruppe:           rx.diagnosegruppe || '9999',
      verordnungsart:           rx.is_blanko ? '04' : (rx.is_lhb_bvb ? '02' : '01'),
      hausbesuch:               !!rx.hausbesuch,
      leitsymptomatik:          '',
      dringend:                 !!rx.is_dringend,
      heilmittelBereich:        '1',
      therapiefrequenz:         rx.frequenz || '',
      zuzahlungskennzeichen:    rx.zuzahlung_befreit ? '1' : '0',
      kostentraegerIk:          rx.kostentraeger_ik,
      krankenkasseIk:           rx.kostentraeger_ik,
    },
    tarif: {
      abrechnungscode,
      tarifkennzeichen: '00000000',
    },
    sessions,
  };
}

// ---------- route ----------

router.post('/abrechnung/create', async (req, res) => {
  try {
    // ---- auth ----
    const hdr   = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('id, role, owner_id, business_name, phone, city, address')
      .eq('id', u.user.id)
      .single();
    if (pErr || !profile) return res.status(403).json({ error: 'Profile not found' });

    const tenantId = profile.role === 'employee' && profile.owner_id
      ? profile.owner_id
      : profile.id;

    // ---- input ----
    const { ownerId, kostentraegerIk, prescriptionIds } = req.body || {};
    if (!kostentraegerIk || !Array.isArray(prescriptionIds) || !prescriptionIds.length) {
      return res.status(400).json({ error: 'kostentraegerIk and prescriptionIds required' });
    }
    if (ownerId && ownerId !== tenantId) {
      return res.status(403).json({ error: 'ownerId mismatch' });
    }

    // ---- therapist cert / IK ----
    let { data: cert } = await supabase
      .from('terapeut_zertifikat')
      .select('ik_nummer, cert_subject, cert_valid_to')
      .eq('owner_id', tenantId)
      .maybeSingle();

    // Fallback: profiles.ik_number (legacy DMRZ field). If present, materialize
    // a terapeut_zertifikat row so subsequent calls find it.
    if (!cert?.ik_nummer) {
      const { data: tenantProfile } = await supabase
        .from('profiles').select('ik_number').eq('id', tenantId).maybeSingle();
      if (tenantProfile?.ik_number) {
        cert = { ik_nummer: tenantProfile.ik_number };
        await supabase.from('terapeut_zertifikat').upsert({
          owner_id: tenantId, ik_nummer: tenantProfile.ik_number,
        }, { onConflict: 'owner_id' });
      }
    }

    if (!cert?.ik_nummer) {
      return res.status(412).json({
        error: 'Kein Institutionskennzeichen (IK) hinterlegt. Bitte unter Einstellungen → Abrechnung Ihre 9-stellige IK eintragen.',
      });
    }

    // ---- Krankenkasse + Datenannahmestelle ----
    const { data: kk, error: kkErr } = await supabase
      .from('kostentraeger')
      .select('ik, name, das_ik')
      .eq('ik', kostentraegerIk)
      .maybeSingle();
    if (kkErr || !kk) return res.status(400).json({ error: 'Krankenkasse unbekannt' });

    let dasIk = kk.das_ik;
    let dasName = '';
    if (dasIk && dasIk !== kk.ik) {
      const { data: das } = await supabase
        .from('kostentraeger').select('name').eq('ik', dasIk).maybeSingle();
      dasName = das?.name || '';
    } else {
      dasIk = kk.ik;
      dasName = kk.name;
    }

    // ---- fetch prescriptions joined with patient & doctor ----
    const { data: rxRows, error: rxErr } = await supabase
      .from('prescriptions')
      .select(`
        id, owner_id, patient_id, arzt_id, kostentraeger_ik,
        ausstellungsdatum, behandlungsbeginn, icd10, diagnosegruppe,
        heilmittel, heilmittel_position, anzahl_einheiten, frequenz,
        is_dringend, hausbesuch, is_blanko, is_lhb_bvb,
        doctor_lanr, doctor_bsnr,
        zuzahlung_eur, zuzahlung_befreit,
        abrechnung_status,
        leads:patient_id (first_name, last_name, geburtsdatum, versichertennummer, krankenkasse),
        aerzte:arzt_id   (lanr, bsnr, name)
      `)
      .eq('owner_id', tenantId)
      .in('id', prescriptionIds);

    if (rxErr) return res.status(500).json({ error: rxErr.message });
    if (!rxRows || rxRows.length !== prescriptionIds.length) {
      return res.status(400).json({ error: 'Einige Rezepte wurden nicht gefunden oder gehören nicht zu Ihnen.' });
    }
    for (const r of rxRows) {
      if (r.kostentraeger_ik !== kostentraegerIk) {
        return res.status(400).json({ error: `Rezept ${r.id.slice(0,8)} gehört zu einer anderen Krankenkasse.` });
      }
      if (r.abrechnung_status && r.abrechnung_status !== 'bereit') {
        return res.status(409).json({ error: `Rezept ${r.id.slice(0,8)} ist bereits in einer Abrechnung (${r.abrechnung_status}).` });
      }
    }

    // ---- numbering ----
    const now = new Date();
    const { year, week } = isoWeek(now);

    const { count: weekCount } = await supabase
      .from('abrechnung')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', tenantId)
      .gte('created_at', `${year}-01-01`);

    const sammelRechnungsnummer = buildSammelRechnungsnummer(year, week, (weekCount || 0) + 1);
    const datennummer = String((weekCount || 0) + 1).padStart(5, '0');

    // ---- map prescriptions ----
    const prescriptions = rxRows.map(r => mapPrescriptionToDtaShape(r, r.leads, r.aerzte));

    // ---- build DTA ----
    const dta = buildDtaFile({
      absender:   { ik: cert.ik_nummer, name: profile.business_name || 'Praxis' },
      empfaenger: { ik: dasIk,          name: dasName || kk.name },
      rechnung: {
        sammelRechnungsnummer,
        einzelRechnungsnummer: '0',
        datum: now,
        datennummer,
        rechnungsart: '1',
      },
      prescriptions,
      kind: 'test',  // Faz A2 starts in test mode; flip to 'echt' once DAS portal acks
      vkz: '01',
      rechnungssteller: {
        name:    profile.business_name || 'Praxis',
        telefon: profile.phone || '',
      },
    });

    // ---- compute totals ----
    let totalBrutto = 0, totalZu = 0;
    for (const p of prescriptions) {
      const brutto = p.sessions.reduce((a, s) => a + (Number(s.einzelbetrag) || 0) * (Number(s.anzahl) || 1), 0);
      totalBrutto += brutto;
      if (p.verordnung.zuzahlungskennzeichen === '0') {
        const proz = p.sessions.reduce((a, s) => a + (Number(s.zuzahlungProPos) || 0) * (Number(s.anzahl) || 1), 0);
        totalZu += Math.min(brutto, proz + 10);
      }
    }
    totalBrutto = +totalBrutto.toFixed(2);
    totalZu     = +totalZu.toFixed(2);

    // ---- insert abrechnung row ----
    const abrechnungInsert = {
      owner_id:           tenantId,
      kostentraeger_ik:   kostentraegerIk,
      dateiname:          dta.filename,
      rechnungsnummer:    sammelRechnungsnummer,
      total_eur:          totalBrutto,
      zuzahlung_total:    totalZu,
      status:             'erstellt',
      dta_file_size:      dta.byteLength,
      dta_segment_count:  dta.segmentCount,
      prescription_count: prescriptions.length,
    };
    const { data: ab, error: abErr } = await supabase
      .from('abrechnung')
      .insert(abrechnungInsert)
      .select('id')
      .single();
    if (abErr) return res.status(500).json({ error: 'abrechnung insert failed: ' + abErr.message });

    // ---- upload DTA + Begleitzettel ----
    const datePath = `${year}/${String(now.getMonth()+1).padStart(2,'0')}`;
    const dtaPath  = `${tenantId}/${datePath}/${ab.id}/${dta.filename}.dta`;

    const dtaBuffer = Buffer.from(dta.content, 'latin1');
    const upDta = await supabase.storage.from('abrechnungen').upload(dtaPath, dtaBuffer, {
      contentType: 'application/octet-stream', upsert: true,
    });
    if (upDta.error) {
      // best-effort cleanup
      await supabase.from('abrechnung').delete().eq('id', ab.id);
      return res.status(500).json({ error: 'Storage upload failed: ' + upDta.error.message });
    }

    const belege = rxRows.map(r => {
      const np = nameParts(r.leads);
      const brutto = (() => {
        const pos = findPosition(r.heilmittel_position, '22');
        return ((pos?.preis ?? 0) * (r.anzahl_einheiten || 1)).toFixed(2);
      })();
      return {
        belegnummer:        r.id.slice(0, 10),
        patient_nachname:   np.nachname,
        patient_vorname:    np.vorname,
        verordnungsdatum:   r.ausstellungsdatum,
        brutto,
      };
    });

    const begleitHtml = renderBegleitzettel({
      praxis: {
        name:     profile.business_name || 'Praxis',
        strasse:  profile.address || '',
        plz_ort:  profile.city || '',
        telefon:  profile.phone || '',
        ik:       cert.ik_nummer,
      },
      empfaenger: {
        name:    dasName || kk.name,
        ik:      dasIk,
      },
      abrechnung: {
        dateiname:             dta.filename,
        sammelRechnungsnummer,
        datum:                 now,
        belegCount:            prescriptions.length,
        brutto:                totalBrutto,
        zuzahlung:             totalZu,
        netto:                 +(totalBrutto - totalZu).toFixed(2),
      },
      belege,
    });

    const begleitPath = `${tenantId}/${datePath}/${ab.id}/begleitzettel.html`;
    const upBeg = await supabase.storage.from('abrechnungen').upload(begleitPath, Buffer.from(begleitHtml, 'utf8'), {
      contentType: 'text/html; charset=utf-8', upsert: true,
    });
    if (upBeg.error) console.warn('[abrechnung] begleitzettel upload failed:', upBeg.error.message);

    // ---- update abrechnung paths + flip prescriptions ----
    await supabase.from('abrechnung').update({
      storage_path:       dtaPath,
      begleitzettel_path: upBeg.error ? null : begleitPath,
    }).eq('id', ab.id);

    const { error: upRxErr } = await supabase.from('prescriptions').update({
      abrechnung_id:     ab.id,
      abrechnung_status: 'in_abrechnung',
      status:            'billed',
    }).in('id', prescriptionIds);
    if (upRxErr) console.warn('[abrechnung] prescription link failed:', upRxErr.message);

    return res.json({
      ok: true,
      abrechnungId: ab.id,
      dateiname: dta.filename,
      sammelRechnungsnummer,
      prescriptionCount: prescriptions.length,
      totalBrutto, totalZu,
      storagePath: dtaPath,
      begleitzettelPath: upBeg.error ? null : begleitPath,
    });
  } catch (e) {
    console.error('[abrechnung/create]', e);
    return res.status(500).json({ error: e.message || 'Server error' });
  }
});

// Fetch unsigned DTA bytes so the browser can PKCS#7-sign them locally.
router.get('/abrechnung/:id/dta-bytes', async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabase
      .from('profiles').select('id, role, owner_id').eq('id', u.user.id).single();
    const tenantId = profile?.role === 'employee' && profile?.owner_id
      ? profile.owner_id
      : u.user.id;

    const { data: ab, error } = await supabase
      .from('abrechnung')
      .select('id, owner_id, dateiname, storage_path')
      .eq('id', req.params.id)
      .single();
    if (error || !ab) return res.status(404).json({ error: 'Abrechnung nicht gefunden' });
    if (ab.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
    if (!ab.storage_path) return res.status(409).json({ error: 'Kein DTA-Inhalt vorhanden' });

    const { data: blob, error: dlErr } = await supabase.storage
      .from('abrechnungen').download(ab.storage_path);
    if (dlErr || !blob) return res.status(500).json({ error: 'Download fehlgeschlagen' });

    const buf = Buffer.from(await blob.arrayBuffer());
    return res.json({
      ok: true,
      dateiname: ab.dateiname,
      contentBase64: buf.toString('base64'),
    });
  } catch (e) {
    console.error('[abrechnung/dta-bytes]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Receive browser-signed PKCS#7 payload and store as .p7m next to the .dta.
router.post('/abrechnung/:id/upload-signed', async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabase
      .from('profiles').select('id, role, owner_id').eq('id', u.user.id).single();
    const tenantId = profile?.role === 'employee' && profile?.owner_id
      ? profile.owner_id
      : u.user.id;

    const { signedBase64, certSubject, certValidTo, certThumbprint, certSerial } = req.body || {};
    if (!signedBase64 || typeof signedBase64 !== 'string') {
      return res.status(400).json({ error: 'signedBase64 required' });
    }
    const signedBytes = Buffer.from(signedBase64, 'base64');
    if (signedBytes.length < 64) {
      return res.status(400).json({ error: 'Signiertes Payload zu klein — Signierung fehlgeschlagen?' });
    }
    if (signedBytes.length > 20 * 1024 * 1024) {
      return res.status(413).json({ error: 'Signiertes Payload zu groß (>20 MB)' });
    }

    const { data: ab, error } = await supabase
      .from('abrechnung')
      .select('id, owner_id, storage_path')
      .eq('id', req.params.id)
      .single();
    if (error || !ab) return res.status(404).json({ error: 'Abrechnung nicht gefunden' });
    if (ab.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    const signedPath = (ab.storage_path || `${tenantId}/${req.params.id}/payload`) + '.p7m';
    const up = await supabase.storage.from('abrechnungen').upload(signedPath, signedBytes, {
      contentType: 'application/pkcs7-mime',
      upsert: true,
    });
    if (up.error) return res.status(500).json({ error: 'Upload fehlgeschlagen: ' + up.error.message });

    await supabase.from('abrechnung').update({
      signed_storage_path:        signedPath,
      signed_at:                  new Date().toISOString(),
      signed_by_cert_thumbprint:  certThumbprint || null,
    }).eq('id', req.params.id);

    // Persist cert metadata for the therapist (private key never sees the server).
    if (certSubject || certValidTo || certThumbprint) {
      await supabase.from('terapeut_zertifikat').update({
        cert_subject:    certSubject || null,
        cert_valid_to:   certValidTo || null,
        cert_thumbprint: certThumbprint || null,
        cert_serial:     certSerial || null,
        updated_at:      new Date().toISOString(),
      }).eq('owner_id', tenantId);
    }

    return res.json({ ok: true, signedPath });
  } catch (e) {
    console.error('[abrechnung/upload-signed]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Upload + parse a ZAA response file. Inserts zaa_fehler rows and flips
// the abrechnung status to 'rejected' (if errors found) or 'accepted' (no errors).
router.post('/abrechnung/:id/upload-zaa', async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabase
      .from('profiles').select('id, role, owner_id').eq('id', u.user.id).single();
    const tenantId = profile?.role === 'employee' && profile?.owner_id
      ? profile.owner_id
      : u.user.id;

    const { contentBase64, filename } = req.body || {};
    if (!contentBase64) return res.status(400).json({ error: 'contentBase64 required' });
    const buf = Buffer.from(contentBase64, 'base64');
    if (buf.length > 5 * 1024 * 1024) return res.status(413).json({ error: 'ZAA-Datei zu groß (>5 MB)' });

    const { data: ab, error } = await supabase
      .from('abrechnung')
      .select('id, owner_id')
      .eq('id', req.params.id)
      .single();
    if (error || !ab) return res.status(404).json({ error: 'Abrechnung nicht gefunden' });
    if (ab.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });

    // Pull all prescriptions linked to this abrechnung to map belegnummer → prescription_id.
    const { data: rxRows } = await supabase
      .from('prescriptions')
      .select('id')
      .eq('abrechnung_id', req.params.id);
    const belegToRxId = new Map(
      (rxRows || []).map(r => [r.id.slice(0, 10), r.id])
    );

    const parsed = parseZaaFile(buf);

    // Wipe stale errors for this abrechnung (re-upload semantics).
    await supabase.from('zaa_fehler').delete().eq('abrechnung_id', req.params.id);

    const inserts = parsed.errors.map(e => ({
      abrechnung_id:   req.params.id,
      prescription_id: e.belegnummer ? (belegToRxId.get(e.belegnummer) || null) : null,
      fehler_code:     e.code,
      fehler_text:     e.text || null,
      uebersetzung:    e.uebersetzung || null,
      loesung_hint:    e.loesung || null,
      status:          'offen',
    }));

    if (inserts.length) {
      const { error: insErr } = await supabase.from('zaa_fehler').insert(inserts);
      if (insErr) return res.status(500).json({ error: 'zaa_fehler insert failed: ' + insErr.message });
    }

    const newStatus = inserts.length ? 'rejected' : 'accepted';
    await supabase.from('abrechnung').update({
      status:          newStatus,
      rejected_count:  inserts.length,
      zaa_uploaded_at: new Date().toISOString(),
    }).eq('id', req.params.id);

    // Flip affected prescriptions back to 'bereit' so they can be re-billed after fix.
    const rejectedRxIds = [...new Set(inserts.map(e => e.prescription_id).filter(Boolean))];
    if (rejectedRxIds.length) {
      await supabase.from('prescriptions').update({
        abrechnung_status: 'rejected',
      }).in('id', rejectedRxIds);
    }

    return res.json({
      ok: true,
      format: parsed.format,
      errorCount: inserts.length,
      status: newStatus,
      errors: parsed.errors,
      filename: filename || null,
    });
  } catch (e) {
    console.error('[abrechnung/upload-zaa]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Manual status flip (after the therapist uploaded the .dta to the DAS portal).
router.post('/abrechnung/:id/mark-sent', async (req, res) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const id = req.params.id;
    const { error } = await supabase
      .from('abrechnung')
      .update({ status: 'gesendet', zaa_uploaded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('owner_id', u.user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.json({ ok: true });
  } catch (e) {
    console.error('[abrechnung/mark-sent]', e);
    return res.status(500).json({ error: e.message });
  }
});

// ---------- Sprint 7-1: position list + per-prescription override ----------

// Public list of physio positions for UI pickers.
// Authed (any logged-in user) — data is bundeseinheitlich, not tenant-specific.
router.get('/positions', async (req, res) => {
  try {
    const hdr   = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    // Return the template list. UI shows x/label/kat; preis is informational.
    const list = PHYSIO_POSITIONS.map(p => ({
      x:        p.x,
      label:    p.label,
      kat:      p.kat,
      preis:    p.preis,
      gruppe:   !!p.gruppe,
      telemed:  !!p.telemed,
    }));
    res.set('Cache-Control', 'private, max-age=3600');
    return res.json({ ok: true, positions: list });
  } catch (e) {
    console.error('[billing/positions]', e);
    return res.status(500).json({ error: e.message });
  }
});

// Override heilmittel_position on a single 'bereit' prescription before billing.
router.patch('/prescription/:id/position', async (req, res) => {
  try {
    const hdr   = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing bearer token' });
    const { data: u, error: uErr } = await supabase.auth.getUser(token);
    if (uErr || !u?.user) return res.status(401).json({ error: 'Invalid token' });

    const { data: profile } = await supabase
      .from('profiles').select('id, role, owner_id').eq('id', u.user.id).single();
    if (!profile) return res.status(403).json({ error: 'Profile not found' });
    const tenantId = profile.role === 'employee' && profile.owner_id
      ? profile.owner_id : profile.id;

    const { position } = req.body || {};
    if (!position || typeof position !== 'string') {
      return res.status(400).json({ error: 'position required (X-template, e.g. "X0501")' });
    }
    // Validate against the static list — accept template (X0501) or resolved (20501).
    const entry = PHYSIO_POSITIONS.find(p => p.x === position)
      || (/^\d{5}$/.test(position)
            ? PHYSIO_POSITIONS.find(p => p.x === 'X' + position.slice(1))
            : null);
    if (!entry) {
      return res.status(400).json({ error: `Unknown Positionsnummer: ${position}` });
    }
    // Persist template form (X-prefixed) — DTA builder resolves prefix per Abrechnungscode.
    const storeValue = entry.x;

    // Tenant + status guard: only the owner's prescriptions, only while still 'bereit'.
    const { data: rx, error: rxErr } = await supabase
      .from('prescriptions')
      .select('id, owner_id, abrechnung_status')
      .eq('id', req.params.id)
      .maybeSingle();
    if (rxErr || !rx) return res.status(404).json({ error: 'Prescription not found' });
    if (rx.owner_id !== tenantId) return res.status(403).json({ error: 'Forbidden' });
    if (rx.abrechnung_status !== 'bereit') {
      return res.status(409).json({
        error: `Prescription nicht mehr änderbar (status: ${rx.abrechnung_status || 'offen'})`,
      });
    }

    const { error: upErr } = await supabase
      .from('prescriptions')
      .update({ heilmittel_position: storeValue })
      .eq('id', req.params.id);
    if (upErr) return res.status(500).json({ error: upErr.message });

    return res.json({
      ok: true,
      id: req.params.id,
      heilmittel_position: storeValue,
      label: entry.label,
    });
  } catch (e) {
    console.error('[billing/prescription/position]', e);
    return res.status(500).json({ error: e.message });
  }
});

export default router;
