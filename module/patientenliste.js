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
 * Nausad: „Dieses ist besser so, weil dann hast du einen Überblick" — die
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

import { statusBadge } from './abrechnungsstatus.js?v=20260815';

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

  if (rows.length === 0) { tbody.innerHTML = ''; if (emptyEl) emptyEl.hidden = false; return; }
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

    const st = statusJePatient.get(r.id);
    const statusZelle = st?.verordnungId
      ? `<button class="lead-status-btn" data-vord-id="${st.verordnungId}" title="Abrechnungsstatus ändern"
           style="background:none;border:0;padding:0;cursor:pointer;">${statusBadge(st.status, { kurz: true })}</button>`
      : statusBadge(null);

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
