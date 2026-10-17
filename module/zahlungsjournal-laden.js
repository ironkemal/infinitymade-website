/** Latest filter request owns the rendered journal; stale responses never append. */
export function erstelleZahlungsjournalLader({ document, supabase, API, location, fetch,
  escapeHtml, zahlartLabel, fmtEur, getUserId, showToast, triggerStorno }) {
  let generation = 0;
return async function loadBelegliste() {
  const request = ++generation;
  const tbody = document.getElementById('beleglisteBody');
  const empty = document.getElementById('beleglisteEmpty');
  if (!tbody) return;
  tbody.innerHTML = '';

  const from = document.getElementById('blFilterFrom')?.value || '';
  const to = document.getElementById('blFilterTo')?.value || '';
  const type = document.getElementById('blFilterType')?.value || 'all';
  const zahlart = document.getElementById('blFilterZahlart')?.value || 'all';

  try {
  const { data: { session } } = await supabase.auth.getSession();
  if (request !== generation) return;
  const token = session?.access_token || '';

  // Use the Express backend endpoint to fetch and filter Belege
  const url = new URL(`${API}/billing/belegliste`, location.origin); // Box: API="/api" (relativ)
  if (type !== 'all') url.searchParams.append('type', type);
  if (zahlart !== 'all') url.searchParams.append('zahlart', zahlart);
  if (from) url.searchParams.append('from', from);
  if (to) url.searchParams.append('to', to);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token
      }
    });

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Serverfehler');
    }

    const rows = await res.json();
    if (request !== generation) return;

    if (!rows || !rows.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;

    rows.forEach(r => {
      const dateStr = new Date(r.created_at).toLocaleString('de-DE', { timeZone: 'Europe/Berlin' });
      const isNegative = Number(r.amount_eur) < 0;
      const color = isNegative ? 'var(--danger)' : 'var(--success)';
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px solid var(--border)';

      const stornoBtn = r.type !== 'storno' && !r.bereits_storniert
        ? `<button class="btn-ghost btn-sm bl-storno-btn" data-id="${escapeHtml(r.id || '')}" data-nr="${r.beleg_nr}" data-val="${r.amount_eur}" data-rx="${r.prescription_id || ''}" data-pat="${r.patient_id || ''}" data-ref="${escapeHtml(r.reference_text || '')}">Storno</button>`
        : '';

      tr.innerHTML = `
        <td style="font-family:monospace;font-weight:600;color:var(--text-main);">${String(r.beleg_nr).padStart(6, '0')}</td>
        <td style="color:var(--text-main);">${dateStr}</td>
        <td><span class="badge" style="background:var(--border);color:var(--text-main);">${r.type}</span></td>
        <td style="color:var(--text-muted);">${r.zahlart ? escapeHtml(zahlartLabel(r.zahlart)) : '—'}</td>
        <td style="color:${color};font-weight:600;text-align:right;">${fmtEur(r.amount_eur)}</td>
        <td style="color:var(--text-main);">${escapeHtml(r.reference_text || '')}</td>
        <td style="color:var(--text-muted);font-size:12px;">${escapeHtml(r.storno_reason || (r.type === 'storno' ? '—' : ''))}</td>
        <td style="color:var(--text-muted);">${r.created_by ? (r.created_by === getUserId() ? 'Sie' : 'Benutzer ' + String(r.created_by).slice(0, 8)) : 'System'}</td>
        <td>${stornoBtn}</td>
      `;
      tbody.appendChild(tr);
    });

    // Wire Storno Event
    tbody.querySelectorAll('.bl-storno-btn').forEach(btn => {
      btn.addEventListener('click', () => triggerStorno(btn.dataset.nr, btn.dataset.val, btn.dataset.ref, btn.dataset.rx || null, btn.dataset.pat || null, btn.dataset.id || null));
    });
  } catch (err) {
    if (request !== generation) return;
    showToast('Zahlungsjournal Fehler: ' + err.message, 'error');
  }
}

}
