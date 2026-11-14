// Therapiebericht an den verordnenden Arzt: Daten sammeln (Snapshot) und PDF erzeugen.
//
// Warum hier und nicht im Browser: der Snapshot ist das, was in der Akte bleibt
// (therapieberichte.inhalt_snapshot, Migration 0087, § 630f BGB). Er wird aus der
// DB zusammengestellt, nicht aus dem, was ein Browser schickt.
//
// PDF mit pdfkit (MIT, reines JS, keine Systempakete — onprem O-216). Für Mail
// passwortgeschützt mit AES-256 (pdfVersion 1.7ext3 → /V 5 /R 5). Das Passwort
// verlässt diese Datei nur als Rückgabewert; es wird nirgends gespeichert oder
// geloggt (legal-de 22.10.2026, compliance/LEGAL_DECISIONS.md).
//
// Inhalt nach podoloji 22.10.2026: automatischer Teil (Patient, Arzt, VO,
// Behandlungen, Befund erster/letzter) + zwei Freitexte (Verlauf, Empfehlung).
// Keine Preise, keine Kassendaten — der Arzt braucht sie nicht (Art. 5 Abs. 1 lit. c).

import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { findPodologiePosition } from '../billing/codes/podologie_positions.js';
import { baueBefundBlock, befundBlockZeilen, filtereBefundeFuerVo } from './physio-befund-bericht.js';

export { baueBefundBlock, befundBlockZeilen, filtereBefundeFuerVo };

/**
 * @typedef {import('./physio-befund-bericht.js').PhysioBefundRow} PhysioBefundRow
 * @typedef {import('./physio-befund-bericht.js').PhysioMessungRow} PhysioMessungRow
 * @typedef {import('./physio-befund-bericht.js').PhysioBefundBlock} PhysioBefundBlock
 *
 * @typedef {{
 *   plz?: string | null,
 *   zip?: string | null,
 *   business_name?: string | null,
 *   praxis_inhaber?: string | null,
 *   owner_first_name?: string | null,
 *   owner_last_name?: string | null,
 *   street?: string | null,
 *   house_number?: string | null,
 *   city?: string | null,
 *   phone?: string | null,
 *   email?: string | null,
 *   fax?: string | null,
 * }} TherapieberichtProfilInput
 *
 * @typedef {{
 *   id?: string | null,
 *   therapie_bereich?: string | null,
 *   patient_name?: string | null,
 *   ausstellungsdatum?: string | null,
 *   diagnosegruppe?: string | null,
 *   icd10?: string | null,
 *   icd10_2?: string | null,
 *   diagnose_freitext?: string | null,
 *   heilmittel?: string | null,
 *   anzahl_einheiten?: number | null,
 * }} TherapieberichtRxInput
 *
 * @typedef {{
 *   first_name?: string | null,
 *   last_name?: string | null,
 *   title?: string | null,
 *   geburtsdatum?: string | null,
 * }} TherapieberichtLeadInput
 *
 * @typedef {{
 *   arzt_name?: string | null,
 *   praxis_name?: string | null,
 *   adresse?: string | null,
 *   lanr?: string | null,
 *   fax?: string | null,
 *   email?: string | null,
 *   telefon?: string | null,
 * }} TherapieberichtArztInput
 *
 * @typedef {{
 *   behandlungsdatum?: string | null,
 *   hpnr_codes?: string[] | null,
 *   lokalisation?: string | null,
 *   done_at?: string | null,
 * }} TherapieberichtBehandlungInput
 *
 * @typedef {{
 *   erstellt_am?: string | null,
 *   wagner_grad?: number | string | null,
 *   notiz?: string | null,
 *   ist_aktuell?: boolean | null,
 * }} TherapieberichtPodoBefundInput
 *
 * @typedef {{
 *   datum: string,
 *   wagner_grad: number | string | null,
 *   notiz: string,
 * }} PodoBefundKurz
 *
 * @typedef {{
 *   v: number,
 *   praxis: { name: string, inhaber: string, strasse: string, plzOrt: string, telefon: string, email: string, fax: string },
 *   patient: { name: string, geburtsdatum: string },
 *   arzt: { name: string, praxis: string, adresse: string, lanr: string, fax: string, email: string, telefon: string } | null,
 *   verordnung: { bereich: string, ausstellungsdatum: string, diagnosegruppe: string, icd: string[], diagnose: string, heilmittel: string, einheiten_verordnet: number | null },
 *   behandlungen: Array<{ datum: string, massnahmen: string[], lokalisation: string }>,
 *   befund: { erster: PodoBefundKurz | null, letzter: PodoBefundKurz | null } | PhysioBefundBlock | null,
 * }} TherapieberichtSnapshot
 */

/** @param {unknown} err */
export function istSchemaFehler(err) {
  if (!err) return false;
  const code = String((/** @type {{ code?: unknown } | null} */ (err))?.code || '');
  return code === '42P01' || code === 'PGRST205' || code === '42703' || code === 'PGRST204';
}

export const EMPFEHLUNG_CODES = Object.freeze({
  fortsetzung: 'Fortsetzung der Behandlung empfohlen.',
  ziel_erreicht: 'Das Therapieziel ist erreicht.',
  abklaerung: 'Wir bitten um ärztliche Abklärung.',
});

export const BERICHT_ARTEN = Object.freeze({
  zwischenbericht: 'Zwischenbericht',
  abschlussbericht: 'Abschlussbericht',
});

/** @param {unknown} w */
const t = (w) => String(w ?? '').trim();

/** @param {unknown} w */
export function datumDE(w) {
  if (!w) return '';
  const s = String(w).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

// Ohne 0/O, 1/l/I — wird am Telefon diktiert (podoloji 22.10.2026).
const PASSWORT_ZEICHEN = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

/** 10 Zeichen aus 54 → ~57 Bit. Zufall aus crypto, nicht Math.random. */
export function erzeugePasswort(laenge = 10) {
  const out = [];
  while (out.length < laenge) {
    const b = crypto.randomBytes(1)[0];
    if (b < 216) out.push(PASSWORT_ZEICHEN[b % 54]);   // 216 = 4·54, kein Modulo-Bias
  }
  return out.join('');
}

/**
 * Die reine Umformung DB-Zeilen → Snapshot. Ohne Supabase testbar.
 * @param {{
 *   profil?: TherapieberichtProfilInput,
 *   rx?: TherapieberichtRxInput,
 *   lead?: TherapieberichtLeadInput | null,
 *   arzt?: TherapieberichtArztInput | null,
 *   behandlungen?: TherapieberichtBehandlungInput[],
 *   befunde?: TherapieberichtPodoBefundInput[],
 *   physioBefunde?: PhysioBefundRow[],
 *   physioMessungen?: PhysioMessungRow[],
 *   prescriptionId?: string | null,
 * }} [daten]
 * @returns {TherapieberichtSnapshot}
 */
export function baueSnapshot({
  profil = {},
  rx = {},
  lead = null,
  arzt = null,
  behandlungen = [],
  befunde = [],
  physioBefunde = [],
  physioMessungen = [],
  prescriptionId = rx?.id,
} = {}) {
  const plz = t(profil.plz) || t(profil.zip);
  const istPodo = rx.therapie_bereich === 'podo';
  const aktuell = befunde.filter(b => b && b.ist_aktuell !== false)
    .sort((a, b) => String(a.erstellt_am).localeCompare(String(b.erstellt_am)));
  /**
   * @param {TherapieberichtPodoBefundInput | undefined | null} b
   * @returns {PodoBefundKurz | null}
   */
  const befundKurz = (b) => b ? { datum: String(b.erstellt_am || '').slice(0, 10), wagner_grad: b.wagner_grad ?? null, notiz: t(b.notiz) } : null;

  const zeilen = behandlungen.map(b => istPodo
    ? {
        datum: String(b.behandlungsdatum || '').slice(0, 10),
        massnahmen: (b.hpnr_codes || []).map(c => findPodologiePosition(c, b.behandlungsdatum ?? undefined)?.label || c),
        lokalisation: t(b.lokalisation),
      }
    : { datum: String(b.done_at || '').slice(0, 10), massnahmen: /** @type {string[]} */ ([]), lokalisation: '' })
    .filter(z => z.datum)
    .sort((a, b) => a.datum.localeCompare(b.datum));

  const pId = prescriptionId || rx?.id || null;
  const physioBefund = !istPodo && physioBefunde && physioBefunde.length > 0
    ? baueBefundBlock({ befunde: physioBefunde, messungen: physioMessungen, prescriptionId: pId })
    : null;

  return {
    v: 1,
    praxis: {
      name: t(profil.business_name),
      inhaber: t(profil.praxis_inhaber) || [t(profil.owner_first_name), t(profil.owner_last_name)].filter(Boolean).join(' '),
      strasse: [t(profil.street), t(profil.house_number)].filter(Boolean).join(' '),
      plzOrt: [plz, t(profil.city)].filter(Boolean).join(' '),
      telefon: t(profil.phone),
      email: t(profil.email),
      fax: t(profil.fax),
    },
    patient: lead ? {
      name: [t(lead.first_name), t(lead.last_name)].filter(Boolean).join(' ') || t(lead.title),
      geburtsdatum: lead.geburtsdatum ? String(lead.geburtsdatum).slice(0, 10) : '',
    } : { name: t(rx.patient_name), geburtsdatum: '' },
    arzt: arzt ? {
      name: t(arzt.arzt_name), praxis: t(arzt.praxis_name), adresse: t(arzt.adresse),
      lanr: t(arzt.lanr), fax: t(arzt.fax), email: t(arzt.email), telefon: t(arzt.telefon),
    } : null,
    verordnung: {
      bereich: t(rx.therapie_bereich),
      ausstellungsdatum: rx.ausstellungsdatum ? String(rx.ausstellungsdatum).slice(0, 10) : '',
      diagnosegruppe: t(rx.diagnosegruppe),
      icd: [t(rx.icd10), t(rx.icd10_2)].filter(Boolean),
      diagnose: t(rx.diagnose_freitext),
      heilmittel: t(rx.heilmittel),
      einheiten_verordnet: rx.anzahl_einheiten ?? null,
    },
    behandlungen: zeilen,
    befund: istPodo
      ? { erster: befundKurz(aktuell[0]), letzter: befundKurz(aktuell.length > 1 ? aktuell[aktuell.length - 1] : null) }
      : physioBefund,
  };
}

/**
 * Alles für den Snapshot aus der DB holen. Wirft {status, message} bei fremder/fehlender VO.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} tenantId
 * @param {string} prescriptionId
 */
export async function ladeSnapshot(supabase, tenantId, prescriptionId) {
  const { data: rx, error } = await supabase.from('prescriptions')
    .select('id, owner_id, business_id, patient_id, arzt_id, patient_name, therapie_bereich, ausstellungsdatum, diagnosegruppe, icd10, icd10_2, diagnose_freitext, heilmittel, anzahl_einheiten')
    .eq('id', prescriptionId).maybeSingle();
  if (error) throw error;
  if (!rx || rx.owner_id !== tenantId) {
    /** @type {Error & { status?: number }} */
    const e = new Error('Verordnung nicht gefunden.'); e.status = 404; throw e;
  }

  const istPodo = rx.therapie_bereich === 'podo';

  const [profilR, leadR, arztR, behR, befR, physioBefR] = await Promise.all([
    supabase.from('profiles')
      .select('business_name, praxis_inhaber, owner_first_name, owner_last_name, street, house_number, plz, zip, city, phone, email')
      .eq('id', tenantId).maybeSingle(),
    rx.patient_id
      ? supabase.from('leads').select('first_name, last_name, title, geburtsdatum').eq('id', rx.patient_id).eq('owner_id', tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    rx.arzt_id
      ? supabase.from('aerzte').select('arzt_name, praxis_name, adresse, lanr, fax, email, telefon').eq('id', rx.arzt_id).eq('owner_id', tenantId).maybeSingle()
      : Promise.resolve({ data: null }),
    istPodo
      ? supabase.from('podologie_behandlungen').select('behandlungsdatum, hpnr_codes, lokalisation')
          .eq('verordnung_id', rx.id).eq('owner_id', tenantId).is('storniert_am', null)
      : supabase.from('prescription_sessions').select('done_at').eq('prescription_id', rx.id).eq('status', 'done'),
    istPodo && rx.patient_id
      ? supabase.from('pat_fussbefund').select('erstellt_am, wagner_grad, notiz, ist_aktuell')
          .eq('lead_id', rx.patient_id).eq('owner_id', tenantId).eq('ist_aktuell', true)
      : Promise.resolve({ data: [] }),
    !istPodo && rx.patient_id
      ? supabase.from('physio_befunde')
          .select('id, prescription_id, befundart, befund_datum, ist_aktuell, daten, created_at')
          .eq('lead_id', rx.patient_id)
          .eq('owner_id', tenantId)
          .eq('ist_aktuell', true)
          .order('befund_datum', { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);
  for (const r of [profilR, leadR, arztR, behR, befR]) if ('error' in r && r.error) throw r.error;
  if ('error' in physioBefR && physioBefR.error && !istSchemaFehler(physioBefR.error)) {
    throw physioBefR.error;
  }

  const rohePhysioBefunde = physioBefR.data || [];
  const physioBefunde = filtereBefundeFuerVo(rohePhysioBefunde, rx.id);
  /** @type {PhysioMessungRow[]} */
  let physioMessungen = [];
  const physioIds = physioBefunde.map(b => b.id).filter(Boolean);
  if (!istPodo && physioIds.length) {
    try {
      const messR = await supabase.from('messreihen')
        .select('id, befund_id, typ, koerperteil, wert, einheit, seite, notiz')
        .in('befund_id', physioIds)
        .eq('owner_id', tenantId);
      if (messR.error) {
        if (!istSchemaFehler(messR.error)) {
          throw messR.error;
        }
      } else {
        physioMessungen = messR.data || [];
      }
    } catch (err) {
      if (!istSchemaFehler(err)) throw err;
    }
  }

  return {
    rx,
    snapshot: baueSnapshot({
      profil: profilR.data || {}, rx, lead: leadR.data, arzt: arztR.data,
      behandlungen: behR.data || [], befunde: befR.data || [],
      physioBefunde, physioMessungen,
      prescriptionId: rx.id,
    }),
  };
}

/**
 * PDF erzeugen. Mit `passwort` verschlüsselt (AES-256), sonst offen (Fax/Druck/Vorschau).
 * @param {{
 *   snapshot?: Partial<TherapieberichtSnapshot> | null,
 *   art?: string,
 *   verlauf?: string,
 *   empfehlung?: string,
 *   empfehlung_code?: string | null,
 *   datum?: Date | string,
 * }} daten
 * @param {{ passwort?: string | null, faxDeckblatt?: boolean }} [opt]
 * @returns {Promise<Buffer>}
 */
export function erzeugeBerichtPdf({ snapshot, art = 'zwischenbericht', verlauf = '', empfehlung = '', empfehlung_code = null, datum = new Date() }, { passwort = null, faxDeckblatt = false } = {}) {
  const opts = { size: 'A4', margins: { top: 56, bottom: 56, left: 62, right: 62 }, info: { Title: 'Therapiebericht' } };
  if (passwort) {
    Object.assign(opts, {
      userPassword: passwort,
      ownerPassword: crypto.randomBytes(24).toString('hex'),
      pdfVersion: '1.7ext3',
      permissions: { printing: 'highResolution', copying: true },
    });
  }
  const doc = new PDFDocument(opts);
  const emitter = /** @type {NodeJS.EventEmitter} */ (/** @type {unknown} */ (doc));
  /** @type {Buffer[]} */
  const teile = [];
  emitter.on('data', (b) => teile.push(b));
  const fertig = new Promise((res, rej) => { emitter.on('end', () => res(Buffer.concat(teile))); emitter.on('error', rej); });

  /** @type {Partial<TherapieberichtSnapshot>} */
  const s = snapshot || {};
  /** @type {Partial<TherapieberichtSnapshot['praxis']>} */
  const p = s.praxis || {};
  const breite = doc.page.width - 124;

  if (faxDeckblatt) {
    // Fax-Deckblatt als Seite 1 (onprem O-231).
    // KEIN Patientenname, KEINE Diagnose, KEIN Geburtsdatum auf dem Deckblatt.
    doc.font('Helvetica-Bold').fontSize(22).text('TELEFAX');
    doc.moveDown(0.8);

    // Kopf Praxis (aus snapshot.praxis)
    doc.font('Helvetica-Bold').fontSize(10).text('Absender (Praxis):');
    doc.font('Helvetica').fontSize(10).fillColor('#000');
    if (p.name) doc.text(p.name);
    const anschrift = [p.strasse, p.plzOrt].filter(Boolean).join(', ');
    if (anschrift) doc.text(anschrift);
    if (p.telefon) doc.text(`Tel.: ${p.telefon}`);
    if (p.fax) doc.text(`Fax: ${p.fax}`);
    doc.moveDown(0.8);

    // Empfänger (aus snapshot.arzt)
    doc.font('Helvetica-Bold').fontSize(10).text('Empfänger:');
    doc.font('Helvetica').fontSize(10);
    if (s.arzt) {
      if (s.arzt.name) doc.text(s.arzt.name);
      if (s.arzt.praxis) doc.text(s.arzt.praxis);
      if (s.arzt.fax) doc.text(`Fax: ${s.arzt.fax}`);
      if (s.arzt.telefon) doc.text(`Tel.: ${s.arzt.telefon}`);
    } else {
      doc.text('—');
    }
    doc.moveDown(0.8);

    // Datum & Betreff
    const dStr = datumDE(datum instanceof Date ? datum.toISOString() : datum);
    if (dStr) doc.text(`Datum: ${dStr}`);
    doc.font('Helvetica-Bold').fontSize(10).text('Betreff: ', { continued: true })
      .font('Helvetica').text('Therapiebericht');
    doc.moveDown(1.2);

    // Hinweise
    doc.font('Helvetica-Bold').fontSize(9).text('Bei Fehlzustellung bitte telefonisch benachrichtigen.');
    doc.moveDown(0.4);
    doc.font('Helvetica').fontSize(8).fillColor('#333')
      .text('Vertraulich – dieses Fax kann Gesundheitsdaten enthalten, die der ärztlichen Schweigepflicht (§ 203 StGB) unterliegen. Es ist ausschließlich für den oben genannten Empfänger bestimmt. Sollten Sie dieses Fax irrtümlich erhalten haben, benachrichtigen Sie uns bitte umgehend telefonisch und vernichten Sie die Unterlagen.', { width: breite });

    doc.fillColor('#000');
    doc.addPage();
  }

  // Kopf: Praxis
  doc.font('Helvetica-Bold').fontSize(12).text(p.name || '', { width: breite });
  doc.font('Helvetica').fontSize(9).fillColor('#333')
    .text([p.strasse, p.plzOrt].filter(Boolean).join(' · '))
    .text([p.telefon && `Tel. ${p.telefon}`, p.email].filter(Boolean).join(' · '));
  doc.fillColor('#000').moveDown(1.5);

  // Empfänger
  if (s.arzt) {
    doc.fontSize(10).text(s.arzt.name || '');
    if (s.arzt.praxis) doc.text(s.arzt.praxis);
    if (s.arzt.adresse) doc.text(s.arzt.adresse);
  }
  doc.moveDown(1).fontSize(10).text(datumDE(datum instanceof Date ? datum.toISOString() : datum), { align: 'right' });
  doc.moveDown(1);

  /** @type {Record<string, string>} */
  const BERICHT_ARTEN_MAP = BERICHT_ARTEN;
  doc.font('Helvetica-Bold').fontSize(14).text(`Therapiebericht – ${BERICHT_ARTEN_MAP[art] || BERICHT_ARTEN.zwischenbericht}`);
  doc.moveDown(0.6);

  /** @param {string} label @param {unknown} wert */
  const zeile = (label, wert) => {
    if (!t(wert)) return;
    doc.font('Helvetica-Bold').fontSize(10).text(`${label}: `, { continued: true })
      .font('Helvetica').text(String(wert));
  };
  /** @type {Partial<TherapieberichtSnapshot['patient']>} */
  const pat = s.patient || {};
  zeile('Patient/in', [pat.name, pat.geburtsdatum && `geb. ${datumDE(pat.geburtsdatum)}`].filter(Boolean).join(', '));
  /** @type {Partial<TherapieberichtSnapshot['verordnung']>} */
  const v = s.verordnung || {};
  zeile('Verordnung vom', datumDE(v.ausstellungsdatum));
  zeile('Diagnose', [v.icd?.join(', '), v.diagnosegruppe && `Diagnosegruppe ${v.diagnosegruppe}`, v.diagnose].filter(Boolean).join(' · '));
  zeile('Heilmittel', v.heilmittel);
  const beh = s.behandlungen || [];
  if (beh.length) {
    const zeitraum = beh.length > 1 ? `${datumDE(beh[0].datum)} – ${datumDE(beh[beh.length - 1].datum)}` : datumDE(beh[0].datum);
    const menge = v.einheiten_verordnet ? `${beh.length} von ${v.einheiten_verordnet} verordneten Einheiten` : `${beh.length} Behandlung${beh.length === 1 ? '' : 'en'}`;
    zeile('Behandlungszeitraum', `${zeitraum} (${menge})`);
  }

  /** @param {string} titel */
  const abschnitt = (titel) => { doc.moveDown(0.9).font('Helvetica-Bold').fontSize(11).text(titel); doc.moveDown(0.2).font('Helvetica').fontSize(10); };

  if (beh.length && beh.some(b => b.massnahmen.length)) {
    abschnitt('Durchgeführte Behandlungen');
    for (const b of beh) {
      const was = [b.massnahmen.join(', '), b.lokalisation].filter(Boolean).join(' · ');
      doc.text(`${datumDE(b.datum)}${was ? '  ' + was : ''}`, { width: breite });
    }
  }

  const bf = s.befund;
  if (bf && 'erst' in bf && bf.erst) {
    abschnitt('Befund');
    const zeilen = befundBlockZeilen(bf);
    for (const z of zeilen) {
      doc.text(z, { width: breite });
    }
  } else if (bf && 'erster' in bf && (bf.erster || bf.letzter)) {
    abschnitt('Befund');
    /** @param {string} label @param {PodoBefundKurz | null | undefined} b */
    const befundZeile = (label, b) => {
      if (!b) return;
      const teile = [b.wagner_grad != null ? `Wagner-Grad ${b.wagner_grad}` : '', b.notiz].filter(Boolean).join(' · ');
      doc.text(`${label} (${datumDE(b.datum)}): ${teile || 'dokumentiert'}`, { width: breite });
    };
    befundZeile(bf.letzter ? 'Erstbefund' : 'Befund', bf.erster);
    befundZeile('Aktueller Befund', bf.letzter);
  }

  if (t(verlauf)) { abschnitt('Verlauf / Besonderheiten'); doc.text(t(verlauf), { width: breite }); }

  /** @type {Record<string, string>} */
  const EMPFEHLUNG_CODES_MAP = EMPFEHLUNG_CODES;
  const empf = [empfehlung_code && EMPFEHLUNG_CODES_MAP[empfehlung_code], t(empfehlung)].filter(Boolean).join(' ');
  if (empf) { abschnitt('Empfehlung'); doc.text(empf, { width: breite }); }

  doc.moveDown(2).font('Helvetica').fontSize(10).text('Mit freundlichen kollegialen Grüßen');
  doc.moveDown(2.2).text(p.inhaber || p.name || '');

  doc.moveDown(2).fontSize(8).fillColor('#444')
    .text('Vertraulich – enthält Gesundheitsdaten, die der Schweigepflicht (§ 203 StGB) unterliegen. Nur für den genannten Empfänger bestimmt.', { width: breite });

  doc.end();
  return fertig;
}

/**
 * Dateiname ohne Patientennamen — er steht im Anhang einer Mail, die durch Postfächer wandert.
 * @param {unknown} snapshot
 * @param {Date | string} [datum]
 */
export function berichtDateiname(snapshot, datum = new Date()) {
  const d = (datum instanceof Date ? datum.toISOString() : String(datum)).slice(0, 10);
  return `Therapiebericht_${d}.pdf`;
}
