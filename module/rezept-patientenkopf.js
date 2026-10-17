/** One patient prefill owns one mask generation, including delayed doctor data. */
export function erstelleRezeptPatientenkopf({ document, supabase, getOwnerId, leadGeburtsdatum,
  leadHausbesuch, setHausbesuch, vorauswahlArtAusPatient, tazeleIkHinweis, aktualisiereArztSperreBanner }) {
  const g = id => document.getElementById(id);
  const patientFelder = ['rzPatName','rzPatVorname','rzPatGeb','rzPatStrasse','rzPatOrt',
    'rzPatVersNr','rzPatStatus','rzPatKasse','rzPatKasseIk'];
  const arztFelder = ['rzArztName','rzLanr','rzBsnr'];
  let generation = 0;
  let sperre = null;
  const automatischeArztwerte = new Map();
  let automatischerHausbesuch = false;
  let letzterPatient = null;
  function entsperre() {
    if (!sperre) return;
    for (const { feld, disabled } of sperre) feld.disabled = disabled;
    delete g('rzSaveBtn')?.dataset.patientLoading;
    sperre = null;
  }
  function invalidate() {
    generation++; entsperre(); automatischeArztwerte.clear(); automatischerHausbesuch = false; letzterPatient = null;
    return generation;
  }
  async function load(leadId) {
    const token = ++generation, ownerId = getOwnerId(); entsperre();
    const idFeld = g('rzPatientId'), wrap = g('rzMaskeWrap'), parent = wrap?.parentElement;
    const modal = wrap?.closest?.('.modal-overlay'), hidden = modal?.hidden;
    const current = () => token === generation && getOwnerId() === ownerId
      && g('rzPatientId') === idFeld && idFeld?.value === (leadId || '')
      && (!wrap || (wrap.isConnected !== false && wrap.parentElement === parent && modal?.hidden === hidden));
    if (!idFeld) return false;
    if (letzterPatient !== leadId) {
      // Name, LANR and BSNR form one identity. Preserve the whole manually
      // edited group instead of mixing a new name with an old manual number.
      if (automatischeArztwerte.size && arztFelder.every(id => (g(id)?.value || '') === automatischeArztwerte.get(id))) {
        for (const id of arztFelder) { const feld = g(id); if (feld) feld.value = ''; }
      }
      automatischeArztwerte.clear();
      if (automatischerHausbesuch && g('rzHausbesuch')?.checked) setHausbesuch(false);
      automatischerHausbesuch = false;
    }
    letzterPatient = leadId || null;
    idFeld.value = leadId || '';
    for (const id of patientFelder) { const feld = g(id); if (feld) feld.value = ''; }
    const hint = g('rzPatientHint'); if (hint) hint.textContent = '';
    if (!leadId) return true;
    const save = g('rzSaveBtn');
    sperre = [...patientFelder, 'rzArztName','rzLanr','rzBsnr','rzSaveBtn']
      .map(g).filter(Boolean).map(feld => ({ feld, disabled: feld.disabled }));
    for (const { feld } of sperre) feld.disabled = true;
    if (save) save.dataset.patientLoading = '1';
    if (hint) hint.textContent = 'Patientendaten werden geladen…';
    try {
      const { data: lead, error } = await supabase.from('leads').select('*').eq('id', leadId).maybeSingle();
      if (!current()) return false;
      if (error || !lead) throw new Error('Patientendaten konnten nicht geladen werden. Bitte Patient erneut auswählen.');
      const md = lead.metadata || {};
      const set = (id,value) => { const feld = g(id); if (feld) feld.value = value; };
      set('rzPatName',lead.last_name || ''); set('rzPatVorname',lead.first_name || '');
      const bd = leadGeburtsdatum(lead) || '', m = String(bd).match(/^(\d{4})-(\d{2})-(\d{2})/);
      set('rzPatGeb',m ? `${m[3]}.${m[2]}.${m[1]}` : bd);
      set('rzPatStrasse',lead.street || ''); set('rzPatOrt',[lead.plz,lead.city].filter(Boolean).join(' '));
      set('rzPatVersNr',lead.versichertennummer || md.krankenkassennummer || '');
      set('rzPatStatus',lead.versichertenstatus || '');
      const kasse = lead.krankenkasse || md.krankenkasse || '';
      set('rzPatKasse',kasse); vorauswahlArtAusPatient(lead);
      set('rzPatKasseIk',lead.krankenkasse_ik || ''); tazeleIkHinweis(g('rzPatKasseIk'));
      if (leadHausbesuch(lead) && !g('rzHausbesuch')?.checked) {
        setHausbesuch(true); automatischerHausbesuch = true;
      }
      if (lead.arzt_id && arztFelder.every(id => !g(id)?.value)) {
        try {
          const { data: arzt } = await supabase.from('aerzte').select('arzt_name,lanr,bsnr').eq('id',lead.arzt_id).maybeSingle();
          if (!current()) return false;
          if (arzt && arztFelder.every(id => !g(id)?.value)) {
            set('rzArztName',arzt.arzt_name || '');
            set('rzLanr',arzt.lanr || ''); set('rzBsnr',arzt.bsnr || '');
            for (const id of arztFelder) automatischeArztwerte.set(id,g(id)?.value || '');
            aktualisiereArztSperreBanner();
          }
        } catch { /* Optional doctor lookup does not block patient selection. */ }
      }
      if (!current()) return false;
      if (hint) {
        const missing = [];
        if (!g('rzPatGeb')?.value) missing.push('Geb.-Datum');
        if (!g('rzPatVersNr')?.value) missing.push('Vers.-Nr.');
        if (!kasse) missing.push('Kasse');
        hint.textContent = missing.length ? `⚠ fehlt beim Patienten: ${missing.join(', ')} — bitte manuell ergänzen` : '✓ Patientendaten übernommen';
        hint.style.color = missing.length ? 'var(--warning-text)' : 'var(--success)';
      }
      entsperre(); return true;
    } catch (error) {
      if (current() && hint) hint.textContent = error.message;
      return false; // Save stays locked until reselect/reset; empty data is not ready.
    }
  }
  return { load, invalidate, version: () => generation };
}
