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
 * Die Chip-Auswahl selbst (Markup + `.active`-Optik) kommt aus
 * module/zahlarten.js — dort auch von openKassierenDialog() benutzt, statt
 * einer zweiten, leicht abweichenden Kopie.
 *
 * Erste Verwendung: Kassenbuch-Panel (`#panel-belegliste`), Knopf
 * "+ Barverkauf eintragen".
 */

import { zahlartChipsHtml, zahlartLabel } from './zahlarten.js?v=20260910';

let d = null;
let gewaehlteZahlart = null;

export function mountKassenbuchBeleg(deps) {
  d = deps;
  document.getElementById('blManualAmount')?.addEventListener('input', pruefeVollstaendig);
  document.getElementById('blManualRef')?.addEventListener('input', pruefeVollstaendig);
  document.getElementById('blAddManualBtn')?.addEventListener('click', oeffneModal);
  document.getElementById('blManualSaveBtn')?.addEventListener('click', speichern);
}

function renderZahlartGrid() {
  const grid = document.getElementById('blManualZahlartGrid');
  if (!grid) return;
  grid.innerHTML = zahlartChipsHtml({ escapeHtml: d.escapeHtml, t: d.t });
  grid.querySelectorAll('.zahlart-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      gewaehlteZahlart = btn.dataset.zahlart;
      grid.querySelectorAll('.zahlart-chip').forEach(b => b.classList.toggle('active', b === btn));
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

/** Liest die drei Felder einmal, statt dass jede Funktion sie sich selbst holt. */
function formular() {
  const amount = Number(document.getElementById('blManualAmount')?.value);
  const ref = (document.getElementById('blManualRef')?.value || '').trim();
  return { amount, ref, zahlart: gewaehlteZahlart, fertig: belegVollstaendig({ amount, ref, zahlart: gewaehlteZahlart }) };
}

/** Save-Knopf nur an, wenn alle drei Felder da sind — Validierung sichtbar statt erst nach dem Klick als Toast. */
function pruefeVollstaendig() {
  const { fertig } = formular();
  const saveBtn = document.getElementById('blManualSaveBtn');
  if (saveBtn) saveBtn.disabled = !fertig;
  const fehlerEl = document.getElementById('blManualError');
  if (fehlerEl) fehlerEl.hidden = true;
  return fertig;
}

function oeffneModal() {
  const amountEl = document.getElementById('blManualAmount');
  const refEl = document.getElementById('blManualRef');
  if (amountEl) amountEl.value = '';
  if (refEl) refEl.value = '';
  gewaehlteZahlart = null;
  renderZahlartGrid();
  pruefeVollstaendig();
  d.openModal('manualBelegModal');
  setTimeout(() => document.getElementById('blManualAmount')?.focus(), 50);
}

async function speichern() {
  const eingabe = formular();
  if (!eingabe.fertig) { pruefeVollstaendig(); return; }
  const saveBtn = document.getElementById('blManualSaveBtn');
  saveBtn.disabled = true;
  const fehlerEl = document.getElementById('blManualError');

  try {
    const res = await fetch(`${d.apiBasis}/billing/belegliste`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await d.token()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'barverkauf', amount_eur: eingabe.amount, reference_text: eingabe.ref, zahlart: eingabe.zahlart }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Serverfehler');
    }
    d.closeModal('manualBelegModal');
    d.showToast(`Beleg erfolgreich gebucht ✓ · ${zahlartLabel(eingabe.zahlart, d.t)}`);
    d.neuLaden();
  } catch (err) {
    if (fehlerEl) { fehlerEl.textContent = 'Buchung gescheitert: ' + err.message; fehlerEl.hidden = false; }
    else d.showToast('Buchung gescheitert: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = !formular().fertig;
  }
}
