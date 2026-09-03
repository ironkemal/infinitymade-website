/**
 * zuzahlung-korrektur.js — den geforderten Zuzahlungsbetrag richtigstellen.
 *
 * Der Fall (Ops-Karte 31.08.2026, Podologie, Beta-1)
 * ──────────────────────────────────────────────────
 * Der Patient bricht nach 3 von 6 Einheiten ab. `prescriptions.zuzahlung_eur`
 * steht weiter auf dem Betrag fuer 6, weil er beim Anlegen der Verordnung von
 * Hand eingetragen wurde und seitdem niemand mehr anfasst. Kassieren, Mahnwesen
 * und Statistik lesen alle diesen einen Wert — er ist also nicht kosmetisch.
 * Beta-1 rechnet den richtigen Betrag heute im Kopf aus und traegt ihn nach.
 *
 * Dieses Formular kann genau drei Dinge:
 *   1. die Einheitenzahl senken — der Betrag folgt der Rechnung
 *   2. den Betrag selbst eintragen — die Rechnung folgt dem Menschen
 *   3. was zuviel gezahlt wurde als Guthaben stehen lassen
 *
 * Was es NICHT tut: rechnen. Jede angezeigte Zahl kommt aus derselben
 * Backend-Route, die sie beim Speichern auch schreibt (`vorschau: true`).
 * Eine im Browser nachgebaute Zuzahlungsformel waere der vierte Rechenweg
 * gewesen — und die drei vorhandenen auseinanderlaufen zu sehen ist genau der
 * Grund, warum es diese Karte gibt.
 *
 * Was es nicht darf
 * ─────────────────
 * Eine Verordnung, die schon in einer Kassendatei steckt, wird nicht angefasst
 * (`korrekturErlaubt`). Das entscheidet das Backend; hier wird der Knopf nur
 * vorher ausgeblendet, damit niemand gegen eine Wand laeuft.
 *
 * Und: kein stilles Ueberschreiben. Ohne Begruendung speichert das Formular
 * nicht, und jede Aenderung landet als eigene Zeile in `zuzahlung_korrekturen`
 * — wer, wann, alter Wert, neuer Wert, Grund. Das ist Geld und GoBD.
 */

import { korrekturErlaubt } from './zuzahlung-rechnen.js?v=20260902';

const GRUENDE = [
  ['abbruch',                'Behandlung abgebrochen'],
  ['korrektur_soll',         'Betrag war falsch erfasst'],
  ['befreiung_nachgereicht', 'Befreiungsnachweis nachgereicht'],
  ['sonstiges',              'Sonstiges'],
];

const eur = (v) => (Number(v) || 0).toLocaleString('de-DE', {
  style: 'currency', currency: 'EUR',
});

/**
 * Der Knopf im Zuzahlungsstreifen des Termin-Panels.
 *
 * Steht hier und nicht in dashboard.js, weil dashboard.js nicht mehr wachsen
 * darf (Konsey 2026-08-13) — und weil Beschriftung und Klick-Ziel ohnehin zu
 * diesem Formular gehoeren. Deutsch fest verdrahtet wie beim benachbarten
 * Druckknopf und wie in den Schwestermodulen (zuzahlung-befreiung.js).
 */
export const KORREKTUR_KNOPF =
  ' <button type="button" data-zuzahl="korrektur" title="Betrag anpassen — z. B. nach Abbruch"'
  + ' style="margin-left:4px;background:none;border:0;color:inherit;opacity:0.75;cursor:pointer;'
  + 'font-size:12px;font-family:inherit;">✎ anpassen</button>';

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

/**
 * Oeffnet das Korrekturformular. Aufloesung: true, wenn gespeichert wurde.
 *
 * @param {object} opts
 * @param {object} opts.supabase
 * @param {string} opts.apiBase          z. B. `${API}` — Basis der Backend-Routen
 * @param {string} opts.prescriptionId
 * @param {string} [opts.patientName]
 * @param {Function} [opts.toast]
 */
export async function oeffneZuzahlungKorrektur({
  supabase,
  apiBase,
  prescriptionId,
  patientName = '',
  toast = () => {},
}) {
  if (!prescriptionId) return false;

  const { data: rx } = await supabase
    .from('prescriptions')
    .select('id, anzahl_einheiten, zuzahlung_eur, zuzahlung_befreit, abrechnung_status, '
      + 'belegnummer, prescription_sessions(id, status)')
    .eq('id', prescriptionId)
    .maybeSingle();

  const riegel = korrekturErlaubt(rx);
  if (!riegel.erlaubt) { toast(riegel.grund, 'error'); return false; }

  const erbracht = (rx.prescription_sessions || []).filter(s => s.status === 'done').length;
  const verordnet = Number(rx.anzahl_einheiten) || 0;
  const altBetrag = Number(rx.zuzahlung_eur) || 0;

  const token = (await supabase.auth.getSession()).data?.session?.access_token || '';

  /** Ein Aufruf, zwei Zwecke: Vorschau und Speichern gehen denselben Weg. */
  async function ruf(body) {
    const res = await fetch(`${apiBase}/billing/zuzahlung/korrektur`, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prescription_id: prescriptionId, ...body }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Serverfehler (${res.status})`);
    return json;
  }

  return new Promise(resolve => {
    document.getElementById('_zkModal')?.remove();

    const overlay = document.createElement('div');
    overlay.id = '_zkModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:10001;'
      + 'display:flex;align-items:center;justify-content:center;padding:16px;';

    const feld = 'width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:7px;'
      + 'background:var(--bg-input,var(--bg-card));color:var(--text-main);font-size:13px;font-family:inherit;';
    const label = 'margin-bottom:4px;color:var(--text-muted);font-size:12px;';
    const zeile = 'display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:2px 0;';

    overlay.innerHTML = `
      <div role="dialog" aria-modal="true" aria-labelledby="_zkTitle"
        style="background:var(--bg-card-solid);border:1px solid var(--border);border-radius:12px;
               padding:24px;max-width:460px;width:100%;color:var(--text-main);font-family:inherit;
               max-height:90vh;overflow-y:auto;">
        <div id="_zkTitle" style="font-size:15px;font-weight:700;margin-bottom:2px;">Zuzahlung korrigieren</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px;">${esc(patientName)}</div>

        <div style="background:var(--bg-input,var(--bg-card));border:1px solid var(--border);
                    border-radius:8px;padding:10px 12px;margin-bottom:16px;">
          <div style="${zeile}"><span style="color:var(--text-muted);">Bisher gefordert</span>
            <span style="font-weight:600;">${esc(eur(altBetrag))}</span></div>
          <div style="${zeile}"><span style="color:var(--text-muted);">Bereits kassiert</span>
            <span id="_zkSaldo" style="font-weight:600;">—</span></div>
          <div style="${zeile}"><span style="color:var(--text-muted);">Sitzungen erbracht</span>
            <span style="font-weight:600;">${erbracht} von ${verordnet}</span></div>
        </div>

        <div style="display:grid;gap:12px;">
          <label style="display:block;">
            <div style="${label}">Einheiten für die Berechnung</div>
            <input id="_zkEinheiten" type="number" min="0" step="1" max="${verordnet || 999}"
                   value="${erbracht}" style="${feld}">
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">
              Vorbelegt mit den erbrachten Sitzungen. Die 10-€-Verordnungspauschale
              bleibt dabei stehen — sie hängt an der Verordnung, nicht an der Sitzung.
            </div>
          </label>

          <label style="display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input id="_zkManuell" type="checkbox" style="accent-color:var(--accent,#b1891b);">
            Betrag stattdessen selbst eintragen
          </label>
          <label id="_zkBetragWrap" style="display:none;">
            <div style="${label}">Betrag in €</div>
            <input id="_zkBetrag" type="number" min="0" step="0.01" style="${feld}">
          </label>

          <div id="_zkErgebnis" style="border:1px solid var(--border);border-radius:8px;
               padding:10px 12px;background:var(--bg-input,var(--bg-card));">
            <div style="${zeile}"><span style="color:var(--text-muted);">Neuer Betrag</span>
              <span id="_zkNeu" style="font-weight:700;">—</span></div>
            <div id="_zkGuthabenZeile" style="${zeile}display:none;">
              <span style="color:var(--text-muted);">Guthaben für den Patienten</span>
              <span id="_zkGuthaben" style="font-weight:700;color:var(--success);">—</span></div>
            <div id="_zkOffenZeile" style="${zeile}display:none;">
              <span style="color:var(--text-muted);">Bleibt offen</span>
              <span id="_zkOffen" style="font-weight:700;color:var(--warning-text,var(--warning));">—</span></div>
          </div>

          <label id="_zkGuthabenOpt" style="display:none;align-items:center;gap:8px;font-size:13px;cursor:pointer;">
            <input id="_zkGuthabenAn" type="checkbox" checked style="accent-color:var(--accent,#b1891b);">
            Als Guthaben führen und auf die nächste Verordnung anrechnen
          </label>

          <label style="display:block;">
            <div style="${label}">Grund</div>
            <select id="_zkGrundCode" style="${feld}">
              ${GRUENDE.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}
            </select>
          </label>
          <label style="display:block;">
            <div style="${label}">Anmerkung (wird protokolliert)</div>
            <input id="_zkGrund" type="text" maxlength="300"
                   placeholder="z. B. Patient nach 3 Sitzungen abgebrochen" style="${feld}">
          </label>
        </div>

        <div id="_zkErr" style="color:var(--danger,#f87171);font-size:12px;margin-top:8px;display:none;"></div>
        <div style="display:flex;gap:10px;margin-top:20px;justify-content:flex-end;">
          <button id="_zkCancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:7px;
            background:transparent;color:var(--text-main);cursor:pointer;font-size:13px;font-family:inherit;">Abbrechen</button>
          <button id="_zkSave" style="padding:8px 16px;border:none;border-radius:7px;
            background:var(--accent,#b1891b);color:#fff;cursor:pointer;font-size:13px;font-weight:600;
            font-family:inherit;">Speichern</button>
        </div>
      </div>`;

    document.body.appendChild(overlay);

    const $ = (id) => overlay.querySelector(id);
    const err = $('#_zkErr');
    const zeigeFehler = (t) => { err.textContent = t; err.style.display = ''; };
    const schliessen = (ergebnis) => {
      document.removeEventListener('keydown', onEsc);
      overlay.remove();
      resolve(ergebnis);
    };
    function onEsc(e) { if (e.key === 'Escape') schliessen(false); }
    document.addEventListener('keydown', onEsc);

    $('#_zkCancel').onclick = () => schliessen(false);
    overlay.onclick = e => { if (e.target === overlay) schliessen(false); };

    const manuell = $('#_zkManuell');
    manuell.onchange = () => {
      $('#_zkBetragWrap').style.display = manuell.checked ? 'block' : 'none';
      $('#_zkEinheiten').disabled = manuell.checked;
      vorschau();
    };

    /** Aktuelle Eingabe als Anfragekörper — einmal beschrieben, zweimal benutzt. */
    function eingabe() {
      const einheitenRoh = parseInt($('#_zkEinheiten').value, 10);
      const betragRoh = parseFloat($('#_zkBetrag').value);
      return {
        neue_einheiten: manuell.checked || !Number.isFinite(einheitenRoh) ? null : einheitenRoh,
        neuer_betrag_eur: manuell.checked && Number.isFinite(betragRoh) ? betragRoh : null,
      };
    }

    let laeuft = 0;
    async function vorschau() {
      const lauf = ++laeuft;
      const body = eingabe();
      if (body.neue_einheiten == null && body.neuer_betrag_eur == null) return;
      try {
        const r = await ruf({ ...body, vorschau: true });
        if (lauf !== laeuft) return;   // eine neuere Eingabe hat überholt
        err.style.display = 'none';
        $('#_zkSaldo').textContent = eur(r.saldo_eur);
        $('#_zkNeu').textContent = eur(r.neuBetrag);
        $('#_zkGuthabenZeile').style.display = r.guthaben > 0 ? 'flex' : 'none';
        $('#_zkGuthaben').textContent = eur(r.guthaben);
        $('#_zkGuthabenOpt').style.display = r.guthaben > 0 ? 'flex' : 'none';
        $('#_zkOffenZeile').style.display = r.restforderung > 0 ? 'flex' : 'none';
        $('#_zkOffen').textContent = eur(r.restforderung);
      } catch (e) {
        if (lauf === laeuft) zeigeFehler(e.message);
      }
    }

    let entprellen;
    const angestossen = () => { clearTimeout(entprellen); entprellen = setTimeout(vorschau, 250); };
    $('#_zkEinheiten').addEventListener('input', angestossen);
    $('#_zkBetrag').addEventListener('input', angestossen);

    $('#_zkSave').onclick = async () => {
      const btn = $('#_zkSave');
      const grund = $('#_zkGrund').value.trim();
      if (grund.length < 3) return zeigeFehler('Bitte kurz begründen, warum der Betrag geändert wird.');

      btn.disabled = true;
      const vorher = btn.textContent;
      btn.textContent = '…';
      try {
        const r = await ruf({
          ...eingabe(),
          grund,
          grund_code: $('#_zkGrundCode').value,
          guthaben_anlegen: $('#_zkGuthabenAn').checked,
        });
        toast(r.guthaben > 0
          ? `Zuzahlung korrigiert · ${eur(r.guthaben)} Guthaben angelegt ✓`
          : 'Zuzahlung korrigiert ✓');
        schliessen(true);
      } catch (e) {
        btn.disabled = false;
        btn.textContent = vorher;
        zeigeFehler(e.message);
      }
    };

    vorschau();
  });
}

/**
 * Der Ablauf hinter dem Knopf im Termin-Panel: Formular oeffnen, und wenn
 * gespeichert wurde, den geltenden Betrag frisch zurueckholen.
 *
 * Das Nachlesen gehoert dazu und nicht in den Aufrufer: das Panel rendert aus
 * einem Cache, in dem nach dem Speichern noch der alte Betrag steht — und
 * dieser Betrag ist es, der die ganze Zeile treibt (offen / bezahlt / Summe).
 * Ihn zu raten statt zu lesen war schon einmal die Fehlerquelle beim Kassieren.
 *
 * @returns {Promise<{zuzahlung_eur:number}|null>} null, wenn nichts gespeichert wurde
 */
export async function korrekturAusPanel({ supabase, apiBase, rxId, patientName, toast }) {
  const gespeichert = await oeffneZuzahlungKorrektur({
    supabase, apiBase, prescriptionId: rxId, patientName, toast,
  });
  if (!gespeichert) return null;
  const { data } = await supabase
    .from('prescriptions').select('zuzahlung_eur').eq('id', rxId).maybeSingle();
  return data || null;
}

/**
 * Offene Guthaben eines Patienten — fuer die Anzeige „hier liegt noch etwas".
 *
 * @returns {Promise<{guthaben: Array, summe_eur: number}>}
 */
export async function ladeGuthaben({ supabase, apiBase, patientId }) {
  const token = (await supabase.auth.getSession()).data?.session?.access_token || '';
  const url = `${apiBase}/billing/zuzahlung/guthaben`
    + (patientId ? `?patient_id=${encodeURIComponent(patientId)}` : '');
  const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + token } });
  if (!res.ok) return { guthaben: [], summe_eur: 0 };
  return res.json();
}

/**
 * Ein Guthaben auf eine Verordnung anrechnen.
 *
 * Der Betrag wird nicht mitgegeben: wieviel angerechnet werden kann, entscheidet
 * das Backend aus Rest und Forderung. Ein vom Browser vorgeschlagener Betrag
 * waere eine zweite Meinung darueber, wieviel Geld jemand noch hat.
 */
export async function verrechneGuthaben({ supabase, apiBase, guthabenId, prescriptionId }) {
  const token = (await supabase.auth.getSession()).data?.session?.access_token || '';
  const res = await fetch(`${apiBase}/billing/zuzahlung/guthaben/${guthabenId}/verrechnen`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prescription_id: prescriptionId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Serverfehler (${res.status})`);
  return json;
}
