// Rechnung an den Patienten als PDF — für den Mailversand (P1, K9, 31.10.2026).
//
// Der Bildschirm druckt die Rechnung aus dem DOM (module/rechnung-ansicht.js +
// module/rechnung-druck.js). Ein Mailanhang braucht ein PDF, das auf dem Server
// entsteht — deshalb hier dieselben Regeln, aus der eingefrorenen Rechnung:
//   - Aussteller/Empfänger aus aussteller_snapshot / empfaenger_snapshot (0075),
//     Akte/Profil nur als Rückfall für Altbelege.
//   - Kassenanteil > 0 → keine Einzelpreise, keine Zwischensumme (rechnung-druck.js).
//   - Steueraufschlüsselung nur aus tax_summary, Steuerhinweis aus steuerhinweis_text.
//   - BG: keine Diagnose auf der Rechnung (legal-de 05.10.2026).
// Mit `passwort` AES-256 (LEGAL_DECISIONS 2026-10-31), sonst offen (Vorschau).

import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';

const t = (v) => (v == null ? '' : String(v).trim());
const eur = (n) => `${(Number(n) || 0).toFixed(2).replace('.', ',')} €`;
function datumDE(iso) {
  if (!iso) return '';
  const s = String(iso).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.split('-').reverse().join('.') : s;
}

/** Wie aggregateInvLines (module/rechnung-editor.js): gleiche Leistung + Preis = eine Zeile. */
export function zeilenZusammenfassen(lines) {
  const groups = new Map();
  for (const l of lines || []) {
    const title = t(l.title);
    const price = parseFloat(l.unit_price) || 0;
    const key = `${title}::${price.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, { title, unit_price: price, quantity: 0, ust_satz: l.ust_satz });
    groups.get(key).quantity += parseFloat(l.quantity) || 1;
  }
  return [...groups.values()];
}

/** Wie summenAnzeige (module/rechnung-summen.js). */
export function summenLabel(typ) {
  if (typ === 'bg') return { eigen: false, kasse: false, label: 'Rechnungsbetrag (zahlbar durch den Unfallversicherungsträger)' };
  if (typ === 'privat' || typ === 'selbstzahler') return { eigen: false, kasse: false, label: 'Rechnungsbetrag' };
  return { eigen: true, kasse: true, label: 'Zu zahlen (Patient)' };
}

/** Rückfall für Altbelege ohne aussteller_snapshot. */
function ausstellerAusProfil(p = {}) {
  return {
    name: p.business_name || '',
    inhaber: [p.owner_first_name, p.owner_last_name].filter(Boolean).join(' '),
    strasse: [p.street, p.house_number].filter(Boolean).join(' '),
    plzOrt: [p.zip || p.plz, p.city].filter(Boolean).join(' '),
    telefon: p.phone || '', email: p.email || '', ik: p.ik_number || '',
  };
}

/** Empfängerzeilen — Snapshot vor Akte (§ 147 Abs. 2 Nr. 1 AO). */
export function empfaengerZeilen(inv, patient) {
  const emp = inv.empfaenger_snapshot;
  if (emp?.art === 'bg') return [...(emp.empfaenger || []), '', ...(emp.bezug || [])];
  if (emp?.art === 'patient' && emp.name) {
    return [emp.name, emp.strasse, emp.plzOrt, emp.geburtsdatum && `Geboren: ${datumDE(emp.geburtsdatum)}`,
      emp.krankenkasse && `Krankenkasse: ${emp.krankenkasse}`, emp.versichertennummer && `Versichertennr.: ${emp.versichertennummer}`].filter(Boolean);
  }
  if (!patient) return [];
  const name = [patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.title || '';
  return [name, patient.street, [patient.plz, patient.city].filter(Boolean).join(' '),
    patient.geburtsdatum && `Geboren: ${datumDE(patient.geburtsdatum)}`].filter(Boolean);
}

/**
 * @param {{inv:object, patient?:object, rx?:object, profil?:object}} daten
 * @param {{passwort?:string|null}} [opt]
 * @returns {Promise<Buffer>}
 */
export function erzeugeRechnungPdf({ inv, patient = null, rx = null, profil = {} }, { passwort = null } = {}) {
  const opts = { size: 'A4', margins: { top: 56, bottom: 56, left: 62, right: 62 }, info: { Title: 'Rechnung' } };
  if (passwort) {
    Object.assign(opts, {
      userPassword: passwort,
      ownerPassword: crypto.randomBytes(24).toString('hex'),
      pdfVersion: '1.7ext3',
      permissions: { printing: 'highResolution', copying: true },
    });
  }
  const doc = new PDFDocument(opts);
  const teile = [];
  doc.on('data', (b) => teile.push(b));
  const fertig = new Promise((res, rej) => { doc.on('end', () => res(Buffer.concat(teile))); doc.on('error', rej); });
  const links = 62;
  const breite = doc.page.width - 124;

  const aus = inv.aussteller_snapshot || ausstellerAusProfil(profil);
  doc.font('Helvetica-Bold').fontSize(12).text(aus.name || '', { width: breite });
  doc.font('Helvetica').fontSize(9).fillColor('#333');
  for (const z of [aus.inhaber && aus.inhaber !== aus.name && `Inhaber/in: ${aus.inhaber}`, aus.strasse, aus.plzOrt,
    aus.telefon && `Tel: ${aus.telefon}`, aus.email, aus.ik && `IK: ${aus.ik}`]) if (z) doc.text(z);
  doc.fillColor('#000').moveDown(1.2);

  doc.fontSize(10);
  for (const z of empfaengerZeilen(inv, patient)) doc.text(z || ' ');
  doc.moveDown(1);

  doc.font('Helvetica-Bold').fontSize(15).text('Rechnung');
  doc.font('Helvetica').fontSize(10).moveDown(0.3);
  const kv = (k, v) => { if (t(v)) doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(String(v)); };
  kv('Rechnungsnummer', inv.invoice_number);
  kv('Rechnungsdatum', datumDE(inv.issued_at || inv.created_at));
  const von = inv.leistung_von, bis = inv.leistung_bis;
  if (von) kv('Leistungszeitraum', !bis || von === bis ? datumDE(von) : `${datumDE(von)} – ${datumDE(bis)}`);

  const istBg = inv.invoice_type === 'bg' || inv.empfaenger_snapshot?.art === 'bg';
  if (rx) {
    doc.moveDown(0.6);
    kv('Heilmittel', rx.heilmittel);
    if (rx.icd10 && !istBg) kv('ICD-10', `${rx.icd10}${rx.diagnosegruppe ? ' · Diagnosegruppe ' + rx.diagnosegruppe : ''}`);
    if (rx.ausstellungsdatum) kv('Verordnung vom', datumDE(rx.ausstellungsdatum));
  }

  // Positionen
  const zeigePreise = !(Number(inv.kassenzuzahlung || 0) > 0);
  const zeilen = zeilenZusammenfassen(inv.line_items);
  doc.moveDown(1);
  const sp = zeigePreise ? [links, links + 24, links + breite - 190, links + breite - 120, links + breite - 60]
    : [links, links + 24, links + breite - 60];
  const kopfY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text('Pos.', sp[0], kopfY).text('Leistung', sp[1], kopfY);
  if (zeigePreise) {
    doc.text('Menge', sp[2], kopfY, { width: 60, align: 'right' }).text('Einzel', sp[3], kopfY, { width: 60, align: 'right' })
      .text('Gesamt', sp[4], kopfY, { width: 60, align: 'right' });
  } else doc.text('Menge', sp[2], kopfY, { width: 60, align: 'right' });
  doc.moveTo(links, doc.y + 2).lineTo(links + breite, doc.y + 2).strokeColor('#999').stroke();
  doc.font('Helvetica').fontSize(9).moveDown(0.4);
  zeilen.forEach((l, i) => {
    const y = doc.y;
    const titel = `${l.title}${Number(l.ust_satz) > 0 ? ` (${l.ust_satz} % USt)` : ''}`;
    const textBreite = (zeigePreise ? sp[2] : sp[2]) - sp[1] - 8;
    doc.text(String(i + 1), sp[0], y).text(titel, sp[1], y, { width: textBreite });
    const yEnde = doc.y;
    doc.text(`${l.quantity}×`, sp[2], y, { width: 60, align: 'right' });
    if (zeigePreise) {
      doc.text(eur(l.unit_price), sp[3], y, { width: 60, align: 'right' })
        .text(eur(l.quantity * l.unit_price), sp[4], y, { width: 60, align: 'right' });
    }
    doc.y = Math.max(yEnde, doc.y) + 2;
  });
  doc.moveTo(links, doc.y + 2).lineTo(links + breite, doc.y + 2).strokeColor('#999').stroke();
  doc.moveDown(0.6);

  // Summen
  const s = summenLabel(inv.invoice_type);
  const summe = (k, v, fett = false) => {
    const y = doc.y;
    doc.font(fett ? 'Helvetica-Bold' : 'Helvetica').fontSize(fett ? 11 : 10)
      .text(k, links, y, { width: breite - 90, align: 'right' }).text(v, links + breite - 80, y, { width: 80, align: 'right' });
    doc.moveDown(0.2);
  };
  if (zeigePreise) {
    summe('Zwischensumme', eur(inv.subtotal));
    if (s.eigen && Number(inv.eigenanteil_eur || 0) > 0) summe(`Eigenanteil (${inv.eigenanteil_pct || 0} %)`, eur(inv.eigenanteil_eur));
  }
  const steuer = Array.isArray(inv.tax_summary) ? inv.tax_summary : [];
  if (steuer.length && Number(inv.steuer_gesamt || 0) > 0) {
    for (const g of steuer) summe(Number(g.satz) > 0 ? `${g.satz} % USt auf ${eur(g.netto)}` : `steuerfrei ${eur(g.netto)}`, eur(g.steuer));
  }
  summe(s.label, eur(inv.total_patient), true);

  if (t(inv.notes)) { doc.moveDown(0.8).font('Helvetica').fontSize(9).text(t(inv.notes), links, doc.y, { width: breite }); }
  const hinweis = inv.steuerhinweis_text ?? profil.tax_exempt_note;
  if (t(hinweis)) doc.moveDown(0.6).fontSize(9).text(t(hinweis), links, doc.y, { width: breite });

  // Fuss: Bank + Steuer
  const bank = [aus.bank?.name, aus.bank?.iban && `IBAN: ${aus.bank.iban}`, aus.bank?.bic && `BIC: ${aus.bank.bic}`].filter(Boolean);
  const stNr = inv.steuernummer_snapshot ?? profil.steuernummer;
  const ustId = inv.ust_id_snapshot ?? profil.ust_id;
  const fuss = [...bank, stNr && `Steuernr.: ${stNr}`, ustId && `USt-IdNr.: ${ustId}`].filter(Boolean);
  if (fuss.length) doc.moveDown(1.2).fontSize(8).fillColor('#444').text(fuss.join('  ·  '), links, doc.y, { width: breite });
  if (t(profil.invoice_footer_text)) doc.moveDown(0.4).fontSize(8).text(t(profil.invoice_footer_text), links, doc.y, { width: breite });

  doc.end();
  return fertig;
}

/** Dateiname ohne Patientennamen — er wandert durch Postfächer. */
export function rechnungDateiname(inv) {
  const nr = t(inv.invoice_number).replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 40);
  return `Rechnung${nr ? '_' + nr : ''}.pdf`;
}
