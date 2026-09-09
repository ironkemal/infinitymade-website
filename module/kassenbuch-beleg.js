/**
 * kassenbuch-beleg.js — "Barverkauf eintragen"-Modal im Kassenbuch.
 *
 * Warum es das gibt
 * ─────────────────
 * Umzug + Redesign aus dashboard.js (Konsey 2026-08-13: was angefasst wird,
 * zieht um). Zwei echte Lücken behoben (Ops-Meldung 10.09.2026, fonksiyon-
 * ustasi bestätigt):
 *
 *  1. Das "Typ"-Feld war ein <select> mit genau einer Option — kein Feld,
 *     ein Etikett, das sich als Feld verkleidete. dashboard.js schrieb den
 *     Typ ohnehin fest auf 'barverkauf', las das Feld nie.
 *  2. Es gab keine Zahlart. Jeder Barverkauf landete in `belegliste` mit
 *     zahlart=NULL — für einen Filter auf "Bar" (§146 AO Kassensturz-
 *     fähigkeit) unsichtbar. Jetzt Pflichtfeld, OHNE Vorauswahl (Muster aus
 *     dashboard.js openKassierenDialog(): eine per Gewohnheit durchgeklickte
 *     Zahlart macht das Kassenbuch falsch, und Belege lassen sich
 *     nachträglich nicht korrigieren).
 *
 * Erste Verwendung: Kassenbuch-Panel (`#panel-belegliste`), Knopf
 * "+ Barverkauf eintragen".
 */

import { ZAHLARTEN, zahlartLabel } from './zahlarten.js?v=20260910';

let d = null;
let gewaehlteZahlart = null;

export function mountKassenbuchBeleg(deps) {
  d = deps;
  renderZahlartGrid();
  document.getElementById('blManualAmount')?.addEventListener('input', pruefeVollstaendig);
  document.getElementById('blManualRef')?.addEventListener('input', pruefeVollstaendig);
  document.getElementById('blAddManualBtn')?.addEventListener('click', oeffneModal);
  document.getElementById('blManualSaveBtn')?.addEventListener('click', speichern);
}

function renderZahlartGrid() {
  const grid = document.getElementById('blManualZahlartGrid');
  if (!grid) return;
  grid.innerHTML = ZAHLARTEN.map(z => `
    <button type="button" class="bl-zahlart-chip" data-zahlart="${z.key}"
      style="display:flex;align-items:center;gap:6px;padding:9px 10px;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;color:var(--text-main);cursor:pointer;font-size:13px;font-weight:600;font-family:inherit;text-align:left;">
      <span aria-hidden="true">${z.icon}</span><span>${d.escapeHtml(d.t(z.i18n))}</span>
    </button>`).join('');
  grid.querySelectorAll('.bl-zahlart-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      gewaehlteZahlart = btn.dataset.zahlart;
      grid.querySelectorAll('.bl-zahlart-chip').forEach(b => {
        const aktiv = b === btn;
        b.style.borderColor = aktiv ? 'var(--primary)' : 'var(--border)';
        b.style.background = aktiv ? 'var(--primary-dim)' : 'var(--bg-input)';
      });
      pruefeVollstaendig();
    });
  });
}

/**
 * Die Regel allein — ohne DOM, damit sie prüfbar bleibt.
 * @param {{amount:number, ref:string, zahlart:string|null}} eingabe
 */
export function belegVollstaendig({ amount, ref, zahlart }) {
  return amount > 0 && !!(ref && ref.trim()) && !!zahlart;
}

/** Save-Knopf nur an, wenn alle drei Felder da sind — Validierung sichtbar statt erst nach dem Klick als Toast. */
function pruefeVollstaendig() {
  const amount = Number(document.getElementById('blManualAmount')?.value);
  const ref = document.getElementById('blManualRef')?.value || '';
  const fertig = belegVollstaendig({ amount, ref, zahlart: gewaehlteZahlart });
  const saveBtn = document.getElementById('blManualSaveBtn');
  if (saveBtn) saveBtn.disabled = !fertig;
  const fehlerEl = document.getElementById('blManualError');
  if (fehlerEl) fehlerEl.hidden = true;
  return fertig;
}

function oeffneModal() {
  document.getElementById('blManualAmount').value = '';
  document.getElementById('blManualRef').value = '';
  gewaehlteZahlart = null;
  renderZahlartGrid();
  pruefeVollstaendig();
  d.openModal('manualBelegModal');
  setTimeout(() => document.getElementById('blManualAmount')?.focus(), 50);
}

async function speichern() {
  if (!pruefeVollstaendig()) return;
  const amount = Number(document.getElementById('blManualAmount').value);
  const ref = document.getElementById('blManualRef').value.trim();
  const saveBtn = document.getElementById('blManualSaveBtn');
  saveBtn.disabled = true;
  const fehlerEl = document.getElementById('blManualError');

  try {
    const res = await fetch(`${d.apiBasis}/billing/belegliste`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await d.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'barverkauf', amount_eur: amount, reference_text: ref, zahlart: gewaehlteZahlart }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Serverfehler');
    }
    d.closeModal('manualBelegModal');
    d.showToast(`Beleg erfolgreich gebucht ✓ · ${zahlartLabel(gewaehlteZahlart, d.t)}`);
    d.neuLaden();
  } catch (err) {
    if (fehlerEl) { fehlerEl.textContent = 'Buchung gescheitert: ' + err.message; fehlerEl.hidden = false; }
    else d.showToast('Buchung gescheitert: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = !pruefeVollstaendig();
  }
}
