/** Benötigte Raumausstattung: gemeinsamer Editor für freie und GKV-Leistungen. */
import { raumDetails } from './raum-details.js';
const editoren = new WeakMap();
const esc = text => String(text ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

export function ausstattungsOptionen(raeume, erforderlich = []) {
  return [...new Set([...(erforderlich || []), ...(raeume || []).flatMap(r => r.ausstattung || [])])].sort((a, b) => a.localeCompare(b, 'de'));
}
export function anforderungenHtml(optionen, erforderlich) {
  return optionen.map(text => `<label style="display:flex;gap:8px;align-items:center;overflow-wrap:anywhere;"><input type="checkbox" value="${esc(text)}" ${erforderlich.includes(text) ? 'checked' : ''}>${esc(text)}</label>`).join('');
}

export function oeffneLeistungsRaum({ form, supabase, ownerId, anforderungen = [] }) {
  if (!form) return;
  const state = { verfuegbar: false, fehler: false };
  editoren.set(form, state);
  let feld = form.querySelector('.leistungs-raum');
  if (!feld) {
    feld = document.createElement('fieldset');
    feld.className = 'leistungs-raum';
    feld.style.cssText = 'min-width:0;margin:16px 0;padding:12px;border:1px solid var(--border);';
    form.querySelector('h3')?.after(feld);
    if (!feld.parentNode) form.append(feld);
  }
  feld.innerHTML = '<legend>Benötigte Raumausstattung</legend><p role="status">Ausstattung wird geladen …</p>';
  state.bereit = (async () => {
    try {
      const probe = await supabase.from('services').select('raum_ausstattung').eq('owner_id', ownerId).limit(1);
      if (editoren.get(form) !== state) return;
      if (probe.error) {
        if (!['42703', 'PGRST204'].includes(String(probe.error.code))) throw new Error('Laden fehlgeschlagen');
        feld.innerHTML = '<legend>Benötigte Raumausstattung</legend><p role="status">Raumanforderungen sind derzeit nicht verfügbar.</p>';
        return;
      }
      const rooms = await supabase.from('rooms').select('ausstattung').eq('owner_id', ownerId);
      if (editoren.get(form) !== state) return;
      const optionen = ausstattungsOptionen(rooms.error ? [] : rooms.data, anforderungen);
      state.verfuegbar = true;
      feld.innerHTML = `<legend>Benötigte Raumausstattung</legend><p class="form-hint">Ein passender Raum muss alle angehakten Ausstattungen besitzen. Ohne Haken ist keine besondere Ausstattung nötig.</p><div class="leistungs-raum-optionen">${anforderungenHtml(optionen, anforderungen)}</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;"><label style="flex:1;min-width:0;">Weitere benötigte Ausstattung<input class="form-input leistungs-raum-neu" maxlength="80" style="width:100%;box-sizing:border-box;"></label><button type="button" class="btn-ghost leistungs-raum-add">Hinzufügen</button></div><p class="leistungs-raum-status form-hint" role="status">${rooms.error ? 'Vorhandene Raumausstattung konnte nicht geladen werden. Eigene Punkte sind weiterhin möglich.' : 'Änderungen mit der Leistung speichern.'}</p>`;
      feld.querySelector('.leistungs-raum-add').addEventListener('click', () => {
        const input = feld.querySelector('.leistungs-raum-neu');
        const status = feld.querySelector('.leistungs-raum-status');
        try {
          const checks = [...feld.querySelectorAll('input[type="checkbox"]')];
          const wert = raumDetails('', [input.value]).ausstattung[0];
          const schon = checks.find(el => el.value === wert);
          if (schon) schon.checked = true;
          else {
            raumDetails('', [...checks.map(el => el.value), wert]);
            feld.querySelector('.leistungs-raum-optionen').insertAdjacentHTML('beforeend', anforderungenHtml([wert], [wert]));
          }
          input.value = ''; status.textContent = 'Änderungen mit der Leistung speichern.';
        } catch (err) { status.textContent = err.message; }
      });
    } catch {
      if (editoren.get(form) !== state) return;
      state.fehler = true;
      feld.innerHTML = '<legend>Benötigte Raumausstattung</legend><p role="alert">Raumanforderungen konnten nicht geladen werden. Leistung erneut öffnen.</p>';
    }
  })();
}

export async function leistungsRaumPayload(form) {
  const state = editoren.get(form);
  if (!state) return { ok: true, felder: {} };
  await state.bereit;
  if (editoren.get(form) !== state || state.fehler) return { ok: false, meldung: 'Raumanforderungen nicht verfügbar. Leistung erneut öffnen.' };
  if (!state.verfuegbar) return { ok: true, felder: {} };
  try {
    const liste = [...form.querySelectorAll('.leistungs-raum input[type="checkbox"]')].filter(el => el.checked).map(el => el.value);
    return { ok: true, felder: { raum_ausstattung: raumDetails('', liste).ausstattung } };
  } catch (err) { return { ok: false, meldung: err.message }; }
}
