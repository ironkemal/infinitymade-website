/**
 * rechnung-dmrz.js — DMRZ-XML-Export einer Rechnung.
 *
 * Herkunft: am 08.09.2026 aus `dashboard.js` (Zeilen 15369-15508) herausgelöst.
 * Grund für den Umzug ist die Regel „neuer Code in neue Datei" (Konsey
 * 2026-08-13): `dashboard.js` lag exakt auf der Größen-Baseline, und für das
 * Zahlungseingangs-Feature mussten Zeilen frei werden. Dieser Block war die
 * sauberste Grenze im ganzen Rechnungs-Bildschirm — eigenes Thema, zwei
 * Einstiegspunkte, und mit `buildDmrzXml()` eine rein rechnende Funktion, die
 * sich ohne DOM testen lässt.
 *
 * ⚠️ Diese Datei erzeugt KEINE §302-Übermittlung. Das Format ist unser eigenes
 *    (`xmlns` = infinitymade.de/dmrz/v1); die einzige gültige Übermittlung nach
 *    § 302 ist EDIFACT SLGA/SLLA (Anlage 1 V21 § 5), erzeugt in
 *    `api-backend/billing/dta/`. Der Bestätigungsdialog sagt das ausdrücklich,
 *    weil ein Nutzer den Export einmal für die echte Abrechnung hielt und die
 *    eigentliche DTA-Datei nie versendet hat.
 */

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

/**
 * Baut das DMRZ-XML einer Rechnung. Rein — keine DB, kein DOM.
 *
 * @param {object} opts
 * @param {object} opts.invoice       Zeile aus `invoices`
 * @param {object|null} opts.patient  Zeile aus `leads`
 * @param {object|null} opts.prescription  Zeile aus `prescriptions`
 * @param {object|null} opts.arzt     Zeile aus `aerzte`
 * @param {object} opts.owner         {business_name, city, phone, ik_number}
 * @returns {string} XML
 */
export function buildDmrzXml({ invoice, patient, prescription, arzt, owner }) {
  const tag = (name, val) => `    <${name}>${xmlEscape(val)}</${name}>`;
  const now = new Date().toISOString();
  const lines = (invoice.line_items || []).map((l, i) =>
    `    <Leistung position="${i + 1}">
      <Bezeichnung>${xmlEscape(l.title || '')}</Bezeichnung>
      <Anzahl>${Number(l.quantity || 1)}</Anzahl>
      <Einzelpreis>${(Number(l.unit_price) || 0).toFixed(2)}</Einzelpreis>
      <Gesamt>${((Number(l.quantity) || 1) * (Number(l.unit_price) || 0)).toFixed(2)}</Gesamt>
    </Leistung>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<DMRZExport xmlns="https://infinitymade.de/dmrz/v1" erzeugt="${now}" format="§302-vereinfacht-v1">
  <Leistungserbringer>
    <Name>${xmlEscape(owner?.business_name || '')}</Name>
    <Stadt>${xmlEscape(owner?.city || '')}</Stadt>
    <Telefon>${xmlEscape(owner?.phone || '')}</Telefon>
    <IK>${xmlEscape(owner?.ik_number || '')}</IK>
  </Leistungserbringer>
  <Versicherter>
${tag('Name', [patient?.first_name, patient?.last_name].filter(Boolean).join(' ') || patient?.title || '')}
${tag('Geburtsdatum', patient?.dob || '')}
${tag('Versichertennummer', patient?.versichertennummer || '')}
${tag('Krankenkasse', patient?.krankenkasse || '')}
  </Versicherter>
  <Arzt>
${tag('Name', arzt?.arzt_name || '')}
${tag('LANR', arzt?.lanr || '')}
${tag('BSNR', arzt?.bsnr || '')}
  </Arzt>
  <Verordnung typ="${xmlEscape(prescription?.rezept_typ || 'standard')}">
${tag('Ausstellungsdatum', prescription?.ausstellungsdatum || '')}
${tag('Behandlungsbeginn', prescription?.behandlungsbeginn || '')}
${tag('ICD10', prescription?.icd10 || '')}
${tag('Diagnosegruppe', prescription?.diagnosegruppe || '')}
${tag('Heilmittel', prescription?.heilmittel || '')}
${tag('AnzahlEinheiten', prescription?.anzahl_einheiten || '')}
${tag('Frequenz', prescription?.frequenz || '')}
${tag('Hausbesuch', prescription?.hausbesuch ? 'true' : 'false')}
${tag('Dringend', prescription?.is_dringend ? 'true' : 'false')}
  </Verordnung>
  <Rechnung nummer="${xmlEscape(invoice.invoice_number || '')}">
${tag('Zwischensumme', (Number(invoice.subtotal) || 0).toFixed(2))}
${tag('EigenanteilProzent', invoice.eigenanteil_pct || 0)}
${tag('EigenanteilEuro', (Number(invoice.eigenanteil_eur) || 0).toFixed(2))}
${tag('Kassenzuzahlung', (Number(invoice.kassenzuzahlung) || 0).toFixed(2))}
${tag('GesamtPatient', (Number(invoice.total_patient) || 0).toFixed(2))}
    <Leistungen>
${lines}
    </Leistungen>
${invoice.notes ? tag('Notizen', invoice.notes) : ''}
  </Rechnung>
</DMRZExport>
`;
}

/**
 * Lädt die Rechnung samt Umfeld, erzeugt die Datei und markiert das Rezept als
 * abgerechnet.
 *
 * `profile` und `invoiceId` kommen als Funktionen herein, nicht als Werte: beide
 * ändern sich zur Laufzeit (Anmeldung bzw. geöffnete Rechnung), und die
 * Verdrahtung passiert einmalig beim Binden der Knöpfe.
 *
 * @param {object} deps
 * @param {object} deps.supabase
 * @param {Function} deps.invoiceId  () => string|null
 * @param {Function} deps.getOwnerId
 * @param {Function} deps.profile    () => currentProfile
 * @param {Function} deps.showToast
 * @param {Function} deps.showConfirmModal
 */
export async function downloadDmrzForInvoice(deps) {
  const { supabase, invoiceId, getOwnerId, profile, showToast, showConfirmModal } = deps;
  const invId = invoiceId();
  if (!invId) { showToast('Bitte zuerst die Rechnung speichern.', 'error'); return; }

  const okExport = await showConfirmModal({
    title: 'DMRZ-Export (§302) erstellen?',
    message: 'Es wird eine lokale Exportdatei erzeugt und die Rechnung als „abgerechnet" markiert.\n\nACHTUNG: Dies ist KEINE §302-Übermittlung an die Krankenkasse. Die eigentliche §302-Abrechnung erfolgt weiterhin über den Abrechnungs-Bereich.',
    confirmText: 'Exportieren',
    cancelText: 'Abbrechen',
    variant: 'danger'
  });
  if (!okExport) return;

  try {
    const ownerId = getOwnerId();
    const { data: invoice, error: e1 } = await supabase.from('invoices')
      .select('*').eq('id', invId).eq('owner_id', ownerId).maybeSingle();
    if (e1 || !invoice) throw new Error(e1?.message || 'Rechnung nicht gefunden');

    const { data: patient } = await supabase.from('leads')
      .select('id,first_name,last_name,title,dob,versichertennummer,krankenkasse,email,phone')
      .eq('id', invoice.patient_id).maybeSingle();

    let prescription = null;
    if (invoice.prescription_id) {
      const { data: p } = await supabase.from('prescriptions')
        .select('*').eq('id', invoice.prescription_id).maybeSingle();
      prescription = p || null;
    }
    if (!prescription) {
      const { data: prescriptions } = await supabase.from('prescriptions')
        .select('*').eq('patient_id', invoice.patient_id)
        .order('created_at', { ascending: false }).limit(1);
      prescription = prescriptions?.[0] || null;
    }

    let arzt = null;
    if (prescription?.arzt_id) {
      const { data: a } = await supabase.from('aerzte')
        .select('arzt_name,lanr,bsnr').eq('id', prescription.arzt_id).maybeSingle();
      arzt = a;
    }

    const prof = profile() || {};
    const xml = buildDmrzXml({
      invoice, patient, prescription, arzt,
      owner: {
        business_name: prof.business_name,
        city: prof.city,
        phone: prof.phone,
        ik_number: prof.ik_number || ''
      }
    });

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DMRZ-${invoice.invoice_number || invId}.xml`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);

    if (prescription?.id) {
      await supabase.from('prescriptions')
        .update({ dmrz_exported_at: new Date().toISOString(), status: 'billed' })
        .eq('id', prescription.id);
    }
    showToast('DMRZ XML heruntergeladen ✓');
  } catch (e) {
    console.error('[dmrz-export]', e);
    showToast('Fehler: ' + e.message, 'error');
  }
}
