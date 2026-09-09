const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

export async function ladePatientTermine(sb, { ownerId, lead, patientName, mitAbgesagten = false }) {
  let query = sb.from('bookings')
    .select('id,start_time,end_time,status,cancellation_reason,cancelled_at,customer_name,services(title,code)')
    .eq('owner_id', ownerId)
    .order('start_time', { ascending: false });
  if (!mitAbgesagten) query = query.neq('status', 'cancelled');
  if (lead?.phone) query = query.eq('customer_phone', lead.phone);
  else if (patientName) query = query.eq('customer_name', patientName);
  else return [];
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export function patientTerminZeile(b, { fmtDate, fmtTime }) {
  const datum = b.start_time ? `${fmtDate(b.start_time)} · ${fmtTime(b.start_time)}` : '—';
  const dauer = b.end_time && b.start_time ? `${Math.round((new Date(b.end_time) - new Date(b.start_time)) / 60000)} min` : '';
  const abgesagt = b.status === 'cancelled';
  const klasse = b.status === 'confirmed' ? 'badge-green' : (abgesagt || b.status === 'no_show') ? 'badge-red' : 'badge-gray';
  return `<div class="pd-term-item">
    <div class="pd-term-row"><span class="pd-term-date">${escapeHtml(datum)}</span>
      <span class="badge ${klasse}">${escapeHtml(abgesagt ? 'Abgesagt' : b.status || '—')}</span></div>
    <div class="pd-term-service">${escapeHtml(b.services?.title || '—')} ${escapeHtml(b.services?.code || '')} ${escapeHtml(dauer)}</div>
    ${abgesagt ? `<div class="form-hint">${b.cancelled_at ? `Abgesagt am ${escapeHtml(fmtDate(b.cancelled_at))} · ` : ''}${escapeHtml(b.cancellation_reason || 'Kein Grund angegeben')}</div>` : ''}
  </div>`;
}

// Der Umschalter lebt nur in der Patientenakte. Kalender und Kennzahlen bleiben
// auf aktive Termine beschränkt; historische Einträge haben hier keine Aktionen.
export async function zeigePatientTermine({ sb, ownerId, lead, patientName, content, loading, fmtDate, fmtTime }) {
  let mitAbgesagten = false;
  let version = 0;
  content.innerHTML = '<label class="form-hint"><input type="checkbox" data-stornos> Abgesagte Termine anzeigen</label><div data-termine></div>';
  const liste = content.querySelector('[data-termine]');
  const lade = async () => {
    const lauf = ++version;
    try {
      const rows = await ladePatientTermine(sb, { ownerId, lead, patientName, mitAbgesagten });
      if (lauf !== version) return;
      liste.innerHTML = rows.length ? rows.map(b => patientTerminZeile(b, { fmtDate, fmtTime })).join('')
        : '<div class="pd-empty">Keine Termine vorhanden.</div>';
    } catch {
      if (lauf === version) liste.innerHTML = '<div class="pd-empty">Termine konnten nicht geladen werden.</div>';
    } finally {
      if (lauf === version) loading.hidden = true;
    }
  };
  content.querySelector('[data-stornos]').addEventListener('change', event => {
    mitAbgesagten = event.target.checked;
    lade();
  });
  await lade();
}
