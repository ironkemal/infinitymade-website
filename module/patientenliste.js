/**
 * patientenliste.js — Die Tabelle unter „Patienten".
 *
 * Warum sie hier liegt: sie wurde am 14./15.08.2026 umgebaut (Beta-Gespräch
 * 12.08.), und der Beschluss vom 13.08. sagt, dass angefasster Code aus
 * `dashboard.js` auswandert statt dort weiterzuwachsen.
 *
 * Was die Tabelle zeigt und warum
 * ───────────────────────────────
 *     Nr. · Nachname · Vorname · Geburtsdatum · Straße · PLZ · Ort
 *
 * Vorher standen dort Name, Stadt, Telefon, E-Mail und der alte CRM-Status.
 * Beta-2: „Dieses ist besser so, weil dann hast du einen Überblick" — die
 * Angaben, für die man bisher jede Zeile aufklappen musste, stehen jetzt
 * nebeneinander. Telefon und E-Mail sind dafür gewichen: beim Überfliegen einer
 * Patientenliste braucht sie niemand, in der Patientenkarte stehen sie weiter.
 *
 * Die Nummer steht vorn und klein. Sie ist die Kennung, mit der in der Praxis
 * tatsächlich gesprochen wird („Patient 47"), aber Zahlen brauchen keine Breite.
 *
 * Der Status ist kein Feld des Patienten
 * ──────────────────────────────────────
 * Er wird aus dessen Verordnungen abgeleitet (`module/abrechnungsstatus.js`) und
 * nirgends gespeichert. Anklickbar ist er trotzdem: normalerweise entsteht er von
 * selbst — Behandlung dokumentiert, §302-Datei erzeugt, Kassenrückmeldung
 * eingelesen —, aber wenn etwas schiefgelaufen ist, muss man ihn von Hand
 * richtigstellen können. Geändert wird dann die massgebende Verordnung, nicht
 * „der Patient": einen Patientenstatus gibt es nicht.
 */

'use strict';

import { statusBadge } from './abrechnungsstatus.js?v=20260905a';

/**
 * @param {object} ctx  Alles, was die Tabelle von aussen braucht:
 *   daten:    () => { rows, meta, statusJePatient, filter, suche, businesses }
 *   helfer:   { displayName, geburtsdatum, passtZurSuche, escapeHtml, icons }
 *   aktionen: { oeffneKarte, bearbeite, aendereStatus }
 */
export function renderPatientenliste(ctx) {
  const tbody = document.getElementById('leadTableBody');
  const emptyEl = document.getElementById('leadEmpty');
  if (!tbody) return;

  const { rows: alle, meta, statusJePatient, filter, suche, businesses } = ctx.daten();
  const { displayName, geburtsdatum, passtZurSuche, escapeHtml, icons } = ctx.helfer;

  let rows = alle;
  if (filter !== 'all') rows = rows.filter(r => statusJePatient.get(r.id)?.status === filter);
  if (suche) {
    const q = suche.toLowerCase();
    rows = rows.filter(r => passtZurSuche(r, q) || (r.city || '').toLowerCase().includes(q));
  }

  // Standort-Spalte nur, wenn es überhaupt mehrere Standorte gibt. In der
  // Einzelpraxis sagt sie in jeder Zeile dasselbe und kostet nur Breite.
  // `hidden` reicht bei <th> nicht zuverlässig (Autoren-CSS überschreibt es) → display.
  const multiBiz = (businesses || []).length > 1;
  const standortTh = document.getElementById('leadStandortTh');
  if (standortTh) standortTh.style.display = multiBiz ? '' : 'none';

  if (rows.length === 0) {
    tbody.innerHTML = '';
    // Eine leere Liste hat zwei sehr verschiedene Bedeutungen: „diese Praxis hat
    // keine Patienten" oder „ein Filter steht noch". Ohne Unterscheidung sieht
    // das zweite wie Datenverlust aus — genau so wurde es am 15.08. gemeldet.
    // Also sagen, dass gefiltert wird, und den Ausweg gleich danebenlegen.
    if (emptyEl) {
      const gefiltert = filter !== 'all' || !!suche;
      emptyEl.hidden = false;
      if (gefiltert) {
        emptyEl.innerHTML = `${alle.length} Patient${alle.length === 1 ? '' : 'en'} vorhanden, `
          + `aber keiner passt zur aktuellen Auswahl. `
          + `<button type="button" id="leadFilterReset" class="btn-ghost btn-sm">Filter zurücksetzen</button>`;
        emptyEl.querySelector('#leadFilterReset')
          ?.addEventListener('click', () => ctx.aktionen.filterZuruecksetzen?.());
      } else {
        emptyEl.textContent = 'Noch keine Patienten.';
      }
    }
    return;
  }
  if (emptyEl) emptyEl.hidden = true;

  const bizNameById = new Map((businesses || []).map(b => [b.id, b.business_name]));

  tbody.innerHTML = rows.map(r => {
    const m = meta[r.phone_normalized] || {};
    const bkCount = m.bookings?.length || 0;
    const bd = geburtsdatum(r);
    const sessionLabel = bkCount > 0 ? `Seans ${bkCount + 1}` : '';
    const standort = bizNameById.get(r.business_id) || '—';
    const insBadge = r.insurance_type
      ? `<span style="font-size:10px;font-weight:600;padding:1px 5px;border-radius:8px;margin-left:5px;${r.insurance_type === 'gkv'
          ? 'background:rgba(59,130,246,0.15);color:#60a5fa;'
          : 'background:rgba(177,137,27,0.15);color:#b1891b;'}">${r.insurance_type.toUpperCase()}</span>`
      : '';

    // Ohne Verordnung gibt es keinen Abrechnungsstatus — und nichts anzuklicken.
    // Ein blosser Strich sah aber aus, als wäre die Schaltfläche kaputt. Also
    // sagt die Zelle, woran es liegt.
    const st = statusJePatient.get(r.id);
    const statusZelle = st?.verordnungId
      ? `<button class="lead-status-btn" data-vord-id="${st.verordnungId}" title="Abrechnungsstatus ändern"
           style="background:none;border:0;padding:0;cursor:pointer;">${statusBadge(st.status, { kurz: true })}</button>`
      : `<span title="Der Status gehört zur Verordnung. Sobald dieser Patient eine Verordnung hat, steht er hier."
           style="color:var(--text-muted);font-size:11px;">keine Verordnung</span>`;

    return `<tr class="lead-row" data-lead-id="${r.id}" style="cursor:pointer;">
      <td style="color:var(--text-muted);font-size:12px;font-variant-numeric:tabular-nums;">${r.patientennummer ?? '—'}</td>
      <td>${escapeHtml(r.last_name || '')}${insBadge}</td>
      <td>${escapeHtml(r.first_name || '')}</td>
      <td>${bd ? new Date(bd).toLocaleDateString('de-DE') : '—'}</td>
      <td>${escapeHtml(r.street || '—')}</td>
      <td>${escapeHtml(r.plz || '—')}</td>
      <td>${escapeHtml(r.city || '—')}</td>
      ${multiBiz ? `<td>${escapeHtml(standort)}</td>` : ''}
      <td>${sessionLabel ? `<span class="badge badge-blue">${sessionLabel}</span> ` : ''}${statusZelle}</td>
      <td><button class="btn-icon" data-lead-id="${r.id}" data-action="edit" title="Bearbeiten"
            style="display:inline-flex;align-items:center;justify-content:center;"><span class="svg-icon"
            style="width:14px;height:14px;display:inline-flex;">${icons.edit}</span></button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('.lead-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('button')) return;
      ctx.aktionen.oeffneKarte(row.dataset.leadId);
    });
  });
  tbody.querySelectorAll('.lead-status-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();          // sonst öffnet zusätzlich die Patientenkarte
      ctx.aktionen.aendereStatus(btn.dataset.vordId);
    });
  });
  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      ctx.aktionen.bearbeite(btn.dataset.leadId);
    });
  });
}

/**
 * Trifft die Suchanfrage diesen Patienten?
 *
 * Eine Praxis sucht auf drei Wegen, und alle drei müssen dasselbe Feld bedienen:
 * Name, Geburtsdatum (auch deutsch getippt: 12.3.1985) und Telefonnummer.
 *
 * Bei der Nummer zählen Festnetz UND Handy: wer eine Nummer im Kopf hat, weiss
 * nicht, in welchem der beiden Felder sie steht. Und `0170…` muss `+49170…`
 * finden — dieselbe Nummer, zwei Schreibweisen.
 *
 * @param {object} lead
 * @param {string} q
 * @param {{nameMitGeburt:Function, geburtsdatum:Function}} helfer
 */
export function patientPasstZurSuche(lead, q, helfer) {
  const query = (q || '').trim().toLowerCase();
  if (!query) return true;
  if (helfer.nameMitGeburt(lead).toLowerCase().includes(query)) return true;
  if ((lead.title || '').toLowerCase().includes(query)) return true;

  const bd = helfer.geburtsdatum(lead);
  const m = bd ? String(bd).match(/^(\d{4})-(\d{2})-(\d{2})/) : null;
  if (m) {
    const de = `${m[3]}.${m[2]}.${m[1]}`;          // 12.03.1985
    const deKurz = `${+m[3]}.${+m[2]}.${m[1]}`;    // 12.3.1985
    if (de.includes(query) || deKurz.includes(query)) return true;
  }

  const ziffern = query.replace(/\D/g, '');
  if (ziffern.length >= 3) {
    const roh  = [lead.phone, lead.handy].map(v => String(v || '').replace(/\D/g, '')).join(' ');
    const norm = [lead.phone_normalized, lead.handy_normalized].map(v => String(v || '').replace(/\D/g, '')).join(' ');
    if (roh.includes(ziffern) || norm.includes(ziffern)) return true;
    const mitVorwahl = ziffern.startsWith('0') ? '49' + ziffern.slice(1) : null;
    if (mitVorwahl && (roh.includes(mitVorwahl) || norm.includes(mitVorwahl))) return true;
  }
  return false;
}
