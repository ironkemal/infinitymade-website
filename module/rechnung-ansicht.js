/**
 * rechnung-ansicht.js — Rechnungsliste + Druckansicht, und der Umschalter
 * zwischen Liste / Editor / Ansicht.
 *
 * Warum es das gibt
 * ─────────────────
 * `dashboard.js` wächst nicht mehr (Konsey 2026-08-13, tools/check-dashboard-size.sh).
 * `renderInvList()`, `openInvView()`, `closeInvView()` und `renderRezeptBadges()`
 * waren reiner Rechnungen-Code ohne externe Aufrufer (kein `window.*`, kein
 * `onclick=` im HTML) — mechanischer Umzug, Verhalten unverändert.
 *
 * Dabei gleich behoben: der Liste/Editor/Ansicht-Umschalter stand an fünf
 * Stellen von Hand da (openInvView-Ende, closeInvView, openInvEditor-Anfang,
 * closeInvEditor, und ein Flicken im invvEditBtn-Handler, der `invView.hidden`
 * allein setzte, weil openInvEditor es nicht tat). Die fünfte Stelle war ein
 * Symptom: `openInvEditor` fasste `#invView` nie an, also blieb es sichtbar,
 * wenn man während einer offenen Ansicht auf ein anderes Panel und über eine
 * Brücke (z. B. Podologie → „Rechnung erstellen") zurück in den Editor kam —
 * Ansicht und Editor lagen dann übereinander. `zeigeRechnungsModus()` setzt
 * jetzt immer alle vier Elemente, der Flicken fällt weg und der Überlapp kann
 * nicht mehr auftreten.
 *
 * Erste Verwendung: dashboard.js, Rechnungen-Panel (`#panel-rechnungen`).
 */

let d = null;

/** Muss vor jedem Aufruf einmal gesetzt sein — siehe dashboard.js. */
export function mountRechnungsansicht(deps) {
  d = deps;
}

/**
 * Die Regel allein — ohne DOM, damit sie prüfbar bleibt.
 * @param {'liste'|'editor'|'ansicht'} modus
 * @returns {{invListWrap:boolean, invEditor:boolean, invView:boolean, invNewBtn:boolean}} .hidden-Werte
 */
export function rechnungsModus(modus) {
  return {
    invListWrap: modus !== 'liste',
    invEditor:   modus !== 'editor',
    invView:     modus !== 'ansicht',
    invNewBtn:   modus !== 'liste',
  };
}

/** Wendet rechnungsModus() auf die vier DOM-Elemente an. */
export function zeigeRechnungsModus(modus) {
  const hidden = rechnungsModus(modus);
  for (const id in hidden) {
    const el = document.getElementById(id);
    if (el) el.hidden = hidden[id];
  }
}

export function renderRezeptBadges(inv) {
  const rx = inv.prescriptions;
  if (!rx) return '<span class="badge badge-gray" title="Kein verknüpftes Rezept">—</span>';
  const typLabel = { standard: 'Std', blanko: 'Blanko', lhb_bvb: 'LHB' }[rx.rezept_typ] || rx.rezept_typ;
  const typCls = { standard: 'badge-gray', blanko: 'badge-blue', lhb_bvb: 'badge-blue' }[rx.rezept_typ] || 'badge-gray';
  const typBadge = `<span class="badge ${typCls}" title="${d.escapeHtml(rx.heilmittel || '')}">${typLabel}</span>`;
  const dmrzBadge = rx.dmrz_exported_at
    ? `<span class="badge badge-green" title="DMRZ exportiert am ${new Date(rx.dmrz_exported_at).toLocaleString('de-DE')}">DMRZ ✓</span>`
    : `<span class="badge badge-gray" title="Noch nicht exportiert">DMRZ offen</span>`;
  return `<div style="display:flex;gap:4px;flex-wrap:wrap;">${typBadge}${dmrzBadge}</div>`;
}

export function renderInvList() {
  const tbody = document.getElementById('invListBody');
  const empty = document.getElementById('invListEmpty');
  if (!tbody) return;
  const invListCache = d.liste();
  if (invListCache.length === 0) {
    tbody.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;
  const statusMap = { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', cancelled: 'Storniert' };
  const statusCls = { draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green', cancelled: 'badge-red' };
  tbody.innerHTML = invListCache.map(inv => {
    const date = new Date(inv.issued_at || inv.created_at).toLocaleDateString('de-DE');
    const total = d.formatEur(inv.total_patient || 0);
    const st = inv.status || 'draft';
    const payBadge = inv.payment_status === 'paid'
      ? `<span class="badge badge-green" title="${inv.payment_method || ''}" style="margin-left:4px;">✓ Bezahlt</span>`
      : (inv.payment_status === 'pending' ? '<span class="badge badge-gray" style="margin-left:4px;">Offen</span>' : '');
    const invTypeBadgeHtml = inv.invoice_type
      ? `<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:8px;margin-left:5px;${inv.invoice_type==='gkv' ? 'background:rgba(59,130,246,0.15);color:var(--info);' : 'background:rgba(177,137,27,0.15);color:var(--bronze);'}">${inv.invoice_type==='gkv'?'GKV':'Privat'}</span>`
      : '';
    return `<tr>
      <td><strong>${inv.invoice_number || '—'}</strong>${invTypeBadgeHtml}</td>
      <td>${d.escapeHtml(inv.patient_name || '')}</td>
      <td>${date}</td>
      <td>${total}</td>
      <td><span class="badge ${statusCls[st] || 'badge-gray'}">${statusMap[st] || st}</span>${payBadge}</td>
      <td>${renderRezeptBadges(inv)}</td>
      <td><button class="btn-ghost-sm inv-view-btn" data-id="${inv.id}">Ansehen</button>${
        (st !== 'cancelled' && st !== 'draft' && inv.payment_status !== 'paid')
          ? `<button class="btn-ghost-sm inv-pay-btn" data-id="${inv.id}" title="Zahlungseingang verbuchen">Zahlung</button>`
          : ''}</td>
    </tr>`;
  }).join('');
  tbody.querySelectorAll('.inv-view-btn').forEach(btn => {
    btn.onclick = () => openInvView(btn.dataset.id);
  });
  tbody.querySelectorAll('.inv-pay-btn').forEach(btn => {
    btn.onclick = async () => {
      const gebucht = await d.starteZahlungseingang({
        invoiceId: btn.dataset.id, apiBasis: d.apiBasis, profile: d.profile(), showToast: d.showToast,
        token: d.token,
      });
      if (gebucht) await d.neuLaden();
    };
  });
}

export async function openInvView(invoiceId) {
  if (!invoiceId) return;
  const invListCache = d.liste();
  const inv = invListCache.find(i => i.id === invoiceId);
  if (!inv) { d.showToast('Rechnung nicht gefunden.', 'error'); return; }
  const currentProfile = d.profile();
  const escapeHtml = d.escapeHtml;

  // Resolve patient, prescription (with arzt), and booking range
  const [{ data: patient }, prescriptionRes, bookingsRes] = await Promise.all([
    d.supabase.from('leads')
      .select('first_name,last_name,title,geburtsdatum,street,plz,city,versichertennummer,krankenkasse,phone,email')
      .eq('id', inv.patient_id).maybeSingle(),
    inv.prescription_id
      ? d.supabase.from('prescriptions')
        .select('rezept_typ,status,heilmittel,icd10,diagnosegruppe,anzahl_einheiten,frequenz,ausstellungsdatum,gueltig_bis,dmrz_exported_at, aerzte ( arzt_name, lanr, bsnr )')
        .eq('id', inv.prescription_id).maybeSingle()
      : Promise.resolve({ data: null }),
    inv.prescription_id
      ? d.supabase.from('prescription_sessions')
        .select('bookings ( start_time )').eq('prescription_id', inv.prescription_id)
      : Promise.resolve({ data: null })
  ]);
  const rx = prescriptionRes.data;
  const arzt = rx?.aerzte;

  // Issuer (top-left)
  // Praxis logo (Madde 8)
  const invvLogo = document.getElementById('invvLogoImg');
  if (invvLogo) {
    const logoUrl = currentProfile.praxis_logo_url || '';
    if (logoUrl) { invvLogo.src = logoUrl; invvLogo.hidden = false; }
    else invvLogo.hidden = true;
  }
  document.getElementById('invvBizName').textContent = currentProfile.business_name || '—';
  const bizMeta = [];
  if (currentProfile.street) bizMeta.push(currentProfile.street);
  const cityLine = [currentProfile.plz, currentProfile.city].filter(Boolean).join(' ');
  if (cityLine) bizMeta.push(cityLine);
  if (currentProfile.phone) bizMeta.push('Tel: ' + currentProfile.phone);
  if (currentProfile.email) bizMeta.push(currentProfile.email);
  if (currentProfile.ik_number) bizMeta.push('IK: ' + currentProfile.ik_number);
  document.getElementById('invvBizMeta').textContent = bizMeta.join('\n');
  const footerEl = document.getElementById('invvFooterText');
  if (footerEl) footerEl.textContent = currentProfile.invoice_footer_text || '';

  // Meta (top-right)
  document.getElementById('invvNumber').textContent = inv.invoice_number || '—';
  document.getElementById('invvDate').textContent = new Date(inv.issued_at || inv.created_at).toLocaleDateString('de-DE');
  const statusMap = { draft: 'Entwurf', sent: 'Gesendet', paid: 'Bezahlt', cancelled: 'Storniert' };
  document.getElementById('invvStatus').textContent = statusMap[inv.status] || inv.status || '—';

  // Leistungszeitraum (§ 14 Abs. 4 Nr. 6 UStG). Zuerst das eingefrorene Feld
  // der Rechnung, sonst die Zeilen, erst zuletzt die verknüpften Termine.
  // Die alte Reihenfolge kannte nur die Termine — und weil die am Podologie-Topf
  // gar nicht hängen, blieb die Zeile dort immer leer.
  const zr = d.leistungszeitraum(inv.line_items || []);
  const fmt = date => new Date(date).toLocaleDateString('de-DE');
  let von = inv.leistung_von || zr.von, bis = inv.leistung_bis || zr.bis;
  if (!von) {
    const bd = (bookingsRes.data || []).map(r => r.bookings?.start_time).filter(Boolean).sort();
    if (bd.length) { von = bd[0]; bis = bd[bd.length - 1]; }
  }
  document.getElementById('invvLeistungszeitraumRow').hidden = !von;
  if (von) {
    document.getElementById('invvLeistungszeitraum').textContent =
      (!bis || fmt(von) === fmt(bis)) ? fmt(von) : `${fmt(von)} – ${fmt(bis)}`;
  }

  // Recipient (DIN 5008)
  //
  // Der Name kommt ausschliesslich aus der Patientenakte, nie aus dem
  // Freitextfeld invoices.patient_name. Das Feld ist eine Kopie vom Zeitpunkt
  // der Rechnungserstellung — nach einer Namenskorrektur (Heirat, Schreibfehler,
  // Namensangleichung) stuende dort weiter der alte Name, und die Rechnung waere
  // auf eine Person ausgestellt, die es so nicht gibt.
  const patientLines = [];
  const fullName = patient
    ? ([patient.first_name, patient.last_name].filter(Boolean).join(' ') || patient.title || '')
    : '';
  if (fullName) {
    patientLines.push(`<strong>${escapeHtml(fullName)}</strong>`);
    if (patient.street) patientLines.push(escapeHtml(patient.street));
    const pc = [patient.plz, patient.city].filter(Boolean).join(' ');
    if (pc) patientLines.push(escapeHtml(pc));
    if (patient.geburtsdatum) patientLines.push('Geboren: ' + new Date(patient.geburtsdatum).toLocaleDateString('de-DE'));
    if (patient.krankenkasse) patientLines.push('Krankenkasse: ' + escapeHtml(patient.krankenkasse));
    if (patient.versichertennummer) patientLines.push('Versichertennr.: ' + escapeHtml(patient.versichertennummer));
  } else {
    // Kein verknuepfter Patient → lieber sichtbar unvollstaendig als mit einem
    // veralteten Namen gedruckt.
    patientLines.push('<strong style="color:var(--danger);">Kein Patient verknüpft</strong>');
    patientLines.push('<span style="color:var(--text-muted);">Bitte die Rechnung einem Patienten zuordnen — der Name wird immer aus der Patientenakte übernommen.</span>');
  }
  document.getElementById('invvPatient').innerHTML = patientLines.join('<br>');

  if (rx) {
    document.getElementById('invvRxBlock').hidden = false;
    document.getElementById('invvRx').innerHTML = [
      `<div>Heilmittel: <strong>${escapeHtml(rx.heilmittel || '—')}</strong></div>`,
      rx.icd10 ? `<div>ICD-10: ${escapeHtml(rx.icd10)}${rx.diagnosegruppe ? ' · Diagnosegruppe ' + escapeHtml(rx.diagnosegruppe) : ''}</div>` : '',
      rx.ausstellungsdatum ? `<div>Ausgestellt: ${new Date(rx.ausstellungsdatum).toLocaleDateString('de-DE')}${rx.gueltig_bis ? ' · Gültig bis: ' + new Date(rx.gueltig_bis).toLocaleDateString('de-DE') : ''}</div>` : '',
      rx.frequenz ? `<div>Frequenz: ${escapeHtml(rx.frequenz)}</div>` : '',
      arzt?.arzt_name
        ? `<div>Verordnender Arzt: ${escapeHtml(arzt.arzt_name)}${arzt.lanr ? ' · LANR ' + escapeHtml(arzt.lanr) : ''}${arzt.bsnr ? ' · BSNR ' + escapeHtml(arzt.bsnr) : ''}</div>`
        : ''
    ].filter(Boolean).join('');
  } else {
    document.getElementById('invvRxBlock').hidden = true;
  }

  // Positionen + Summen: Kassenanteil bleibt vom Patientenbeleg fern.
  // Regel und Begründung in module/rechnung-druck.js.
  d.fuelleBelegPositionen(inv, { formatEur: d.formatEur, escapeHtml, aggregateInvLines: d.aggregateInvLines });

  if (inv.notes) {
    document.getElementById('invvNotesWrap').hidden = false;
    document.getElementById('invvNotes').textContent = inv.notes;
  } else {
    document.getElementById('invvNotesWrap').hidden = true;
  }

  // Steuerhinweis (§ 14 Abs. 4 Nr. 8 UStG). Der mit der Rechnung eingefrorene
  // Wortlaut hat Vorrang vor dem Profil: wer den Text in den Einstellungen
  // ändert, darf damit keine Rechnung aus dem Vorjahr rückwirkend anders
  // drucken (§ 146 Abs. 4 AO). Für Altrechnungen bleibt das Profil der Fallback.
  const taxNoteEl = document.getElementById('invvTaxExemptNote');
  const hinweis = inv.steuerhinweis_text ?? currentProfile.tax_exempt_note;
  taxNoteEl.textContent = hinweis || '';
  taxNoteEl.style.display = hinweis ? '' : 'none';

  // Footer: contact / bank / tax IDs
  const contact = [
    currentProfile.business_name,
    [currentProfile.street, [currentProfile.plz, currentProfile.city].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    currentProfile.phone ? 'Tel: ' + currentProfile.phone : '',
    currentProfile.email
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterContact').textContent = contact || '—';

  const bank = [
    currentProfile.bank_name,
    currentProfile.iban ? 'IBAN: ' + currentProfile.iban : '',
    currentProfile.bic ? 'BIC: ' + currentProfile.bic : ''
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterBank').textContent = bank || '—';

  // Ebenfalls Snapshot mit Profil-Fallback: die Steuernummer der Praxis kann
  // sich ändern, die einmal gedruckte Rechnung nicht (§ 14 Abs. 4 Nr. 2 UStG).
  const stNr  = inv.steuernummer_snapshot ?? currentProfile.steuernummer;
  const ustId = inv.ust_id_snapshot ?? currentProfile.ust_id;
  const tax = [
    stNr ? 'Steuernr.: ' + stNr : '',
    ustId ? 'USt-IdNr.: ' + ustId : '',
    currentProfile.ik_number ? 'IK: ' + currentProfile.ik_number : ''
  ].filter(Boolean).join('\n');
  document.getElementById('invvFooterTax').textContent = tax || '—';

  d.merkeRechnung(inv.id);
  zeigeRechnungsModus('ansicht');
}

export function closeInvView() {
  zeigeRechnungsModus('liste');
}
