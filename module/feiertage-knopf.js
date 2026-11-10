/**
 * feiertage-knopf.js — Knopf „Gesetzliche Feiertage eintragen" unter Verfügbarkeit → Sondertage.
 *
 * Warum: canli-test 10.11.2026 — 25.12. war online frei buchbar. Statt neuer Sperrlogik legt der Knopf die Feiertage
 * als ganztägige Sondertage (custom_days, type 'holiday') an; Online-Sperre, Kalender-Etikett, Warnung und Anrufliste
 * greifen damit ohne weiteren Code. Bestehende Einträge am selben Datum bleiben unberührt (ignoreDuplicates).
 * Bundesland wird aus der Praxis-PLZ vorbelegt (module/plz.js), ist änderbar; Landesgrenz-PLZ -> keine Vorbelegung.
 * Berechnung: module/feiertage.js. Erstes Verwendungsziel: dashboard.js renderSpecialDaysList().
 */
import { BUNDESLAENDER, feiertage, feiertageZeilen } from './feiertage.js';
import { bundeslandKandidaten } from './plz.js?v=20260814';

const BOX_ID = 'fnFeiertageBox';

/**
 * Zählt aktive Termine an den angelegten Feiertagen (für den Hinweis nach dem Eintragen).
 * @returns {Promise<number>}
 */
async function termineAnTagen(supabase, ownerId, daten) {
  if (!daten.length) return 0;
  const sortiert = [...daten].sort();
  const { data } = await supabase.from('bookings').select('start_time')
    .eq('owner_id', ownerId)
    .gte('start_time', sortiert[0] + 'T00:00:00').lte('start_time', sortiert[sortiert.length - 1] + 'T23:59:59')
    .not('status', 'in', '("cancelled","completed","no_show")');
  const set = new Set(daten);
  return (data || []).filter(b => set.has(String(b.start_time).slice(0, 10))).length;
}

/**
 * Idempotent: baut die Box nur einmal unter die Sondertage-Liste.
 * @param {HTMLElement} liste  #specialDaysList
 * @param {{supabase:any, ownerId:string, profil?:object, showToast:Function, nachher:Function}} o
 */
export function feiertageKnopf(liste, { supabase, ownerId, profil, showToast, nachher } = {}) {
  if (!liste || !supabase || !ownerId || liste.parentNode.querySelector('#' + BOX_ID)) return;
  const box = document.createElement('div');
  box.id = BOX_ID;
  box.style.cssText = 'margin:10px 0;padding:10px;border:1px solid var(--border-color);border-radius:8px;font-size:13px;';
  box.innerHTML = `
    <div style="font-weight:600;margin-bottom:6px;">Gesetzliche Feiertage</div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <select class="form-input" id="fnLand" style="max-width:220px;"><option value="">Bundesland wählen …</option>${
        Object.entries(BUNDESLAENDER).map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
      <button type="button" class="btn-ghost btn-sm" id="fnEintragen">Eintragen (dieses und nächstes Jahr)</button>
    </div>
    <div id="fnOptional" style="margin-top:6px;"></div>
    <div id="fnHinweis" style="margin-top:6px;color:var(--text-faint);">Als geschlossene Tage eingetragen: online nicht buchbar, im Kalender markiert. Bestehende Sondertage bleiben unverändert. Einen Feiertag freischalten: Eintrag löschen oder als Sondertermin ändern.</div>`;
  liste.insertAdjacentElement('afterend', box);

  const land = box.querySelector('#fnLand');
  const optionalBox = box.querySelector('#fnOptional');
  const hinweis = box.querySelector('#fnHinweis');
  const jahre = () => { const j = new Date().getFullYear(); return [j, j + 1]; };

  const zeigeOptionale = () => {
    const namen = [...new Set(jahre().flatMap(j => feiertage(j, land.value)).filter(f => f.optional).map(f => f.name))];
    optionalBox.innerHTML = namen.map((n, i) =>
      `<label style="display:block;"><input type="checkbox" data-fn-opt="${i}"> ${n.replace(/</g, '&lt;')}</label>`).join('');
    optionalBox.dataset.namen = JSON.stringify(namen);
  };
  land.addEventListener('change', zeigeOptionale);

  const plz = profil?.plz || profil?.zip || '';
  bundeslandKandidaten(plz).then(k => {
    if (k.length === 1 && !land.value) { land.value = k[0]; zeigeOptionale(); }
    else if (k.length > 1) hinweis.textContent = `Ihre PLZ liegt auf einer Landesgrenze (${k.join(' / ')}) — bitte Bundesland wählen.`;
  }).catch(() => {});

  box.querySelector('#fnEintragen').addEventListener('click', async (ev) => {
    if (!land.value) { showToast?.('Bitte Bundesland wählen', 'error'); return; }
    const namen = JSON.parse(optionalBox.dataset.namen || '[]');
    const gewaehlt = [...optionalBox.querySelectorAll('[data-fn-opt]:checked')].map(c => namen[Number(c.dataset.fnOpt)]);
    const heute = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
    const zeilen = feiertageZeilen({ ownerId, land: land.value, heute, jahre: jahre(), optionaleNamen: gewaehlt });
    if (!zeilen.length) { showToast?.('Keine kommenden Feiertage'); return; }
    ev.target.disabled = true;
    try {
      const { error } = await supabase.from('custom_days').upsert(zeilen, { onConflict: 'owner_id,date', ignoreDuplicates: true });
      if (error) { showToast?.('Feiertage konnten nicht eingetragen werden', 'error'); return; }
      const betroffen = await termineAnTagen(supabase, ownerId, zeilen.map(z => z.date)).catch(() => 0);
      showToast?.(betroffen
        ? `${zeilen.length} Feiertage eingetragen — ${betroffen} Termin(e) liegen auf Feiertagen, bitte im Kalender prüfen`
        : `${zeilen.length} Feiertage eingetragen`);
      await nachher?.();
    } finally { ev.target.disabled = false; }
  });
}
