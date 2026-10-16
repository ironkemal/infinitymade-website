/** Patient-bound loading and mutations: stale responses never become editable. */
export function erstelleNotizenController({ document, supabase, getOwnerId, showToast, onSaved = () => {} }) {
  const el = id => document.getElementById(id);
  let generation = 0, loaded = null, busy = false;
  function sync() {
    const ready = Boolean(loaded && loaded.leadId === el('notesPatient').value && loaded.ownerId === getOwnerId());
    for (const id of ['notesDoctor', 'notesTherapist', 'notesSaveBtn', 'aiGenBtn', 'notesSendBtn']) el(id).disabled = !ready || busy;
  }
  function invalidate() {
    generation++; loaded = null;
    el('notesDoctor').value = ''; el('notesTherapist').value = '';
    el('aiReportBox').textContent = ''; el('aiReportBox').style.display = 'none';
    el('notesForm').hidden = true; el('notesEmpty').hidden = false;
    sync(); return generation;
  }
  function ready(leadId = el('notesPatient').value) {
    return Boolean(!busy && loaded && loaded.leadId === leadId && loaded.ownerId === getOwnerId() && el('notesPatient').value === leadId);
  }
  async function load(leadId) {
    const token = invalidate(), ownerId = getOwnerId();
    el('notesForm').hidden = false; el('notesEmpty').hidden = true;
    try {
      const { data, error } = await supabase.from('patient_notes').select('*').eq('lead_id', leadId).eq('owner_id', ownerId).maybeSingle();
      if (token !== generation || el('notesPatient').value !== leadId || getOwnerId() !== ownerId) return false;
      if (error) throw error;
      el('notesDoctor').value = data?.doctor_notes || ''; el('notesTherapist').value = data?.therapist_notes || '';
      el('aiReportBox').textContent = data?.ai_summary || '';
      el('aiReportBox').style.display = data?.ai_summary ? 'block' : 'none';
      loaded = { leadId, ownerId }; sync(); return true;
    } catch {
      if (token === generation) { invalidate(); showToast('Notizen konnten nicht geladen werden. Bitte Patient erneut auswählen.', 'error'); }
      return false;
    }
  }
  async function save(summaryOnly = false) {
    if (!ready()) { showToast('Bitte Patient auswählen und Notizen vollständig laden.', 'error'); return false; }
    const { leadId, ownerId } = loaded, token = generation;
    const notes = el('notesTherapist').value.trim();
    if (summaryOnly && !notes) { showToast('Therapeutennotizen eingeben', 'error'); return false; }
    const payload = summaryOnly ? { ai_summary: notes } : {
      owner_id: ownerId, lead_id: leadId, doctor_notes: el('notesDoctor').value.trim(), therapist_notes: notes,
    };
    busy = true; sync();
    try {
      const { data: existing, error: lookupError } = await supabase.from('patient_notes').select('id').eq('lead_id', leadId).eq('owner_id', ownerId).maybeSingle();
      if (lookupError) throw lookupError;
      if (summaryOnly && !existing) { if (token === generation) showToast('Bitte Notizen zuerst speichern.', 'error'); return false; }
      const { data: saved, error } = existing
        ? await supabase.from('patient_notes').update(payload).eq('id', existing.id).eq('owner_id', ownerId).eq('lead_id', leadId).select('id')
        : await supabase.from('patient_notes').insert(payload).select('id');
      if (error || saved?.length !== 1) throw error || new Error('No notes row saved');
      if (token === generation) {
        if (summaryOnly) {
          el('aiReportBox').textContent = notes; el('aiReportBox').style.display = 'block';
          showToast('Automatische KI-Zusammenfassung ist derzeit deaktiviert. Therapeutennotizen als Entwurf übernommen.', 'info');
        } else { showToast('Gespeichert'); onSaved(); }
      }
      return true;
    } catch { if (token === generation) showToast('Notizen konnten nicht gespeichert werden.', 'error'); return false; }
    finally { busy = false; sync(); }
  }
  return { invalidate, load, ready, save, version: () => generation, isCurrent: token => token === generation };
}
