/**
 * datev-einstellungen.js — DATEV-Angaben der Praxis + der Export-Knopf im Zahlungsjournal.
 *
 * Herkunft: Kemal 22.10.2026 (Interessenten-Anfrage „Schnittstellen, insbesondere
 * DATEV"). Gespeichert in `profiles.datev_einstellungen` (Migration 0088, db-ustasi:
 * eine jsonb-Spalte, Owner-Einstellung → profiles). Die Vorschlagswerte und die
 * Prüfung stehen im Backend (api-backend/lib/datev.js) — hier nur Eingabe.
 *
 * Kontenvorschläge sind KEINE Steuerberatung (§ 5 StBerG): der Text sagt das, und
 * die Felder zeigen den Vorschlag nur als Platzhalter.
 */
import { API_BASE } from '../supabase-config.js';

'use strict';

const ERLOES = [
  ['gkv', 'Krankenkassen (GKV)'],
  ['zuzahlung', 'Zuzahlungen'],
  ['privat', 'Privatrechnungen'],
  ['selbstzahler', 'Selbstzahler'],
  ['bg', 'Berufsgenossenschaft'],
  ['ausfall', 'Ausfallhonorar'],
  ['verkauf', 'Verkauf'],
];
const VORSCHLAG = {
  SKR03: { kasse: '1000', bank: '1200', erloes: '8100' },
  SKR04: { kasse: '1600', bank: '1800', erloes: '4100' },
};

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

/** Formularwerte → gespeichertes Objekt (leere Felder fallen weg = Vorschlag gilt). */
export function ausFormular(get) {
  const nur = (w) => String(w ?? '').replace(/\D/g, '');
  const obj = {
    beraternummer: nur(get('beraternummer')),
    mandantennummer: nur(get('mandantennummer')),
    wj_beginn: String(get('wj_beginn') || '').trim(),
    sachkontenlaenge: Number(get('sachkontenlaenge')) || 4,
    kontenrahmen: get('kontenrahmen') === 'SKR04' ? 'SKR04' : 'SKR03',
    geldkonten: { kasse: nur(get('kasse')), bank: nur(get('bank')) },
    erloeskonten: Object.fromEntries(ERLOES.map(([k]) => [k, nur(get('e_' + k))])),
  };
  for (const g of [obj.geldkonten, obj.erloeskonten]) for (const k of Object.keys(g)) if (!g[k]) delete g[k];
  if (!obj.wj_beginn) delete obj.wj_beginn;
  return obj;
}

export async function renderDatevSettings(deps) {
  const section = document.getElementById('settingsDatevSection');
  if (!section) return;
  const zeigen = deps.profile?.role === 'owner';
  section.hidden = !zeigen;
  if (!zeigen) return;

  const ownerId = deps.ownerId();
  const { data } = await deps.supabase.from('profiles').select('datev_einstellungen').eq('id', ownerId).maybeSingle();
  const d = data?.datev_einstellungen || {};
  const skr = d.kontenrahmen === 'SKR04' ? 'SKR04' : 'SKR03';
  const v = VORSCHLAG[skr];
  const feld = (name, label, wert, ph, extra = '') => `
    <label style="font-size:12px;color:var(--text-muted);display:block;">${esc(label)}
      <input class="form-input" data-datev="${name}" value="${esc(wert ?? '')}" placeholder="${esc(ph)}" ${extra}
             style="display:block;width:100%;margin-top:2px;">
    </label>`;

  section.querySelector('.settings-section-body').innerHTML = `
    <p class="form-hint" style="margin-bottom:12px;">
      Für den Export an Ihren Steuerberater (DATEV-Buchungsstapel). Berater- und Mandantennummer
      erhalten Sie von Ihrem Steuerberater. Die Konten sind <strong>Vorschläge</strong>
      (steuerfreie Heilbehandlung) — bitte mit dem Steuerberater abstimmen; leere Felder nutzen den Vorschlag.
      Exportiert werden die Geldeingänge (Zahlungsjournal und Kassenzahlungen), nicht die offenen Rechnungen.
    </p>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px;">
      ${feld('beraternummer', 'Beraternummer', d.beraternummer, 'z. B. 1234567', 'inputmode="numeric" maxlength="7"')}
      ${feld('mandantennummer', 'Mandantennummer', d.mandantennummer, 'z. B. 10001', 'inputmode="numeric" maxlength="5"')}
      ${feld('wj_beginn', 'Beginn Wirtschaftsjahr (MM-TT)', d.wj_beginn, '01-01', 'maxlength="5"')}
      <label style="font-size:12px;color:var(--text-muted);display:block;">Kontenrahmen
        <select class="form-select" data-datev="kontenrahmen" style="display:block;width:100%;margin-top:2px;">
          <option value="SKR03" ${skr === 'SKR03' ? 'selected' : ''}>SKR03</option>
          <option value="SKR04" ${skr === 'SKR04' ? 'selected' : ''}>SKR04</option>
        </select>
      </label>
      ${feld('sachkontenlaenge', 'Sachkontenlänge', d.sachkontenlaenge || '', '4', 'inputmode="numeric" maxlength="1"')}
      ${feld('kasse', 'Geldkonto Kasse (bar)', d.geldkonten?.kasse, v.kasse, 'inputmode="numeric"')}
      ${feld('bank', 'Geldkonto Bank (Karte, Überweisung, Kassen)', d.geldkonten?.bank, v.bank, 'inputmode="numeric"')}
    </div>
    <div class="form-label" style="font-size:12px;margin-bottom:6px;">Erlöskonten</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px;margin-bottom:12px;">
      ${ERLOES.map(([k, l]) => feld('e_' + k, l, d.erloeskonten?.[k], v.erloes, 'inputmode="numeric"')).join('')}
    </div>
    <button class="btn-primary" type="button" data-datev-speichern>Speichern</button>`;

  section.querySelector('[data-datev-speichern]').addEventListener('click', async () => {
    const get = (n) => section.querySelector(`[data-datev="${n}"]`)?.value;
    const wert = ausFormular(get);
    if (wert.wj_beginn && !/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(wert.wj_beginn)) {
      deps.showToast('Beginn des Wirtschaftsjahres bitte als MM-TT, z. B. 01-01.', 'error');
      return;
    }
    const { error } = await deps.supabase.from('profiles').update({ datev_einstellungen: wert }).eq('id', ownerId);
    if (error) { deps.showToast('DATEV-Angaben konnten nicht gespeichert werden.', 'error'); return; }
    deps.showToast('DATEV-Angaben gespeichert.');
  });
}

/** Knopf „DATEV-Export" im Zahlungsjournal: gleicher Zeitraum wie der Bildschirm. */
export function verdrahteDatevExport({ supabase, showToast }) {
  const knopf = document.getElementById('blDatevExportBtn');
  if (!knopf || knopf.dataset.wired) return;
  knopf.dataset.wired = '1';
  knopf.addEventListener('click', async () => {
    const von = document.getElementById('blFilterFrom')?.value || '';
    const bis = document.getElementById('blFilterTo')?.value || '';
    if (!von || !bis) { showToast('Bitte zuerst einen Zeitraum (von/bis) wählen.', 'error'); return; }
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) { showToast('Bitte erneut anmelden.', 'error'); return; }
    knopf.disabled = true;
    try {
      const url = `${API_BASE.replace(/\/+$/, '')}/billing/datev/export?from=${encodeURIComponent(von)}&to=${encodeURIComponent(bis)}`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        showToast(j.error || 'DATEV-Export fehlgeschlagen.', 'error');
        return;
      }
      const blob = await res.blob();
      const name = /filename="?([^";]+)"?/.exec(res.headers.get('Content-Disposition') || '')?.[1] || 'EXTF_Buchungsstapel.csv';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      showToast('DATEV-Export fehlgeschlagen.', 'error');
    } finally {
      knopf.disabled = false;
    }
  });
}
