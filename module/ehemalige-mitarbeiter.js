/**
 * ehemalige-mitarbeiter.js — Urlaubs- und Anstellungsdaten entfernter Mitarbeiter löschen (Physio-Pilot M5).
 *
 * Beim Entfernen bleiben mitarbeiter_anstellung und time_offs stehen, weil der Inhaber beim Austritt den
 * Resturlaub abgelten muss (§ 7 Abs. 4 BUrlG). Löschfrist: 31.12. des dritten Kalenderjahres nach dem
 * Austrittsjahr (§§ 195, 199 BGB; legal-de 01.11.2026). Kein Cron (onprem): der Inhaber löscht hier selbst,
 * früher ist erlaubt. Austrittsdatum setzt POST /team/mitarbeiter/:id/entfernen (mitarbeiter_anstellung.austritt_am, 0098).
 * Profile und Auth-Konten bleiben (GoBD, Sperrmodell) — gelöscht werden nur diese zwei Tabellen.
 */

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** 31.12. des dritten Kalenderjahres nach dem Austrittsjahr; ohne gültiges Datum null. */
export function loeschbarAb(austrittAm) {
  if (typeof austrittAm !== 'string' || !DATUM_RE.test(austrittAm.slice(0, 10))) return null;
  return `${Number(austrittAm.slice(0, 4)) + 3}-12-31`;
}

const datumDe = tag => (tag ? new Date(`${tag}T12:00:00Z`).toLocaleDateString('de-DE', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

/**
 * Nur Ehemalige mit Daten zum Löschen; sortiert: fällige zuerst, dann nach Austritt.
 * @returns {Array<{id,name,austritt,loeschbar,faellig,abwesenheiten,anstellung}>}
 */
export function ehemaligeListe(profile, anstellungen, abwesenheiten, heute) {
  const anst = new Map((anstellungen || []).map(a => [a.employee_id, a]));
  const zahl = new Map();
  for (const t of abwesenheiten || []) zahl.set(t.employee_id, (zahl.get(t.employee_id) || 0) + 1);
  return (profile || []).map((p) => {
    const a = anst.get(p.id);
    const austritt = a?.austritt_am ? String(a.austritt_am).slice(0, 10) : null;
    const loeschbar = loeschbarAb(austritt);
    return {
      id: p.id,
      name: p.business_name || p.email?.split('@')[0] || 'Ehemaliger Mitarbeiter',
      austritt, loeschbar,
      faellig: !!(loeschbar && heute > loeschbar),
      abwesenheiten: zahl.get(p.id) || 0,
      anstellung: !!a,
    };
  }).filter(e => e.anstellung || e.abwesenheiten)
    .sort((x, y) => Number(y.faellig) - Number(x.faellig) || String(x.austritt || '').localeCompare(String(y.austritt || '')));
}

export function ehemaligeHtml(liste) {
  if (!liste.length) return '';
  const zeilen = liste.map(e => `
    <li class="${e.faellig ? 'ehem-faellig' : ''}">
      <span class="ehem-name">${escapeHtml(e.name)}</span>
      <span>${e.austritt ? `Austritt ${escapeHtml(datumDe(e.austritt))}` : 'Austritt unbekannt'}</span>
      <span>${e.loeschbar ? `${e.faellig ? 'Löschfrist abgelaufen seit' : 'löschbar ab'} ${escapeHtml(datumDe(e.loeschbar))}` : 'Frist: Austrittsdatum fehlt'}</span>
      <span>${e.abwesenheiten} Abwesenheit${e.abwesenheiten === 1 ? '' : 'en'}${e.anstellung ? ', Anstellung' : ''}</span>
      <button type="button" class="btn-ghost-sm ehem-loeschen" data-emp="${escapeHtml(e.id)}">Daten löschen</button>
    </li>`).join('');
  return `<section class="card ehemalige">
  <h4>Ehemalige Mitarbeiter</h4>
  <p class="form-hint">Urlaubs- und Anstellungsdaten bleiben nach dem Entfernen für die Resturlaub-Abgeltung erhalten.
    Empfohlene Löschung: 31.12. des dritten Jahres nach dem Austritt. Früheres Löschen ist möglich, wenn nichts mehr offen ist.</p>
  <ul>${zeilen}</ul>
</section>`;
}

/**
 * @param {HTMLElement} host
 * @param {object} deps supabase, ownerId, showToast, showConfirmModal, heute (für Tests)
 */
export async function mountEhemalige(host, deps = {}) {
  if (!host) return;
  const { supabase, ownerId, showToast = () => {}, showConfirmModal } = deps;
  const heute = deps.heute || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const { data: profile, error } = await supabase.from('profiles').select('id,business_name,email')
    .eq('owner_id', ownerId).eq('role', 'employee').eq('is_active', false);
  if (error || !profile?.length) { host.innerHTML = ''; return; }
  const ids = profile.map(p => p.id);
  const [anst, abw] = await Promise.all([
    supabase.from('mitarbeiter_anstellung').select('employee_id,austritt_am').eq('owner_id', ownerId).in('employee_id', ids),
    supabase.from('time_offs').select('employee_id').in('employee_id', ids),
  ]);
  if (anst.error || abw.error) { host.innerHTML = ''; return; }
  const liste = ehemaligeListe(profile, anst.data, abw.data, heute);
  host.innerHTML = ehemaligeHtml(liste);
  host.querySelectorAll('.ehem-loeschen').forEach(knopf => knopf.addEventListener('click', async () => {
    const e = liste.find(x => x.id === knopf.dataset.emp);
    if (!e) return;
    const vorzeitig = e.loeschbar && heute <= e.loeschbar;
    const ok = showConfirmModal ? await showConfirmModal({
      title: 'Daten endgültig löschen?',
      message: `Abwesenheiten und Anstellung von ${e.name} werden gelöscht. Das lässt sich nicht rückgängig machen.${vorzeitig ? ' Die empfohlene Frist läuft noch – nur löschen, wenn Resturlaub abgerechnet ist.' : ''}`,
      confirmText: 'Endgültig löschen', cancelText: 'Abbrechen', variant: 'danger',
    }) : false;
    if (!ok) return;
    knopf.disabled = true;
    const t = await supabase.from('time_offs').delete().eq('employee_id', e.id);
    if (t.error) { showToast('Abwesenheiten konnten nicht gelöscht werden.', 'error'); knopf.disabled = false; return; }
    const a = await supabase.from('mitarbeiter_anstellung').delete().eq('owner_id', ownerId).eq('employee_id', e.id);
    if (a.error) { showToast('Anstellung konnte nicht gelöscht werden.', 'error'); knopf.disabled = false; return; }
    showToast('Daten gelöscht ✓');
    await mountEhemalige(host, deps);
  }));
}
