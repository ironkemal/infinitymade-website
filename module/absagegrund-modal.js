/**
 * absagegrund-modal.js — Grund-Auswahl beim Absagen eines Termins.
 *
 * Bis 03.09.2026 gab es dafür zwei fast identische Kopien in `dashboard.js`
 * (Dashboard-Absageweg + No-Show-Weg), die an diesem Tag zu einer Funktion
 * zusammengelegt wurden. Am selben Fehler stand `kalender.html` — eine
 * DRITTE, eigenständige Seite mit eigenem `confirm()` statt dieses Dialogs
 * (Ops-Karte #249, 03.09.2026). Statt die Kopie ein drittes Mal zu schreiben,
 * steht der Dialog jetzt hier: `dashboard.js` UND `kalender.js` importieren
 * dieselbe Funktion, es gibt nur noch einen Ort, an dem der Absagegrund
 * gefragt wird.
 */

export const ABSAGE_GRUENDE = [
  'Patient hat abgesagt',
  'Patient krank',
  'Patient vergessen',
  'Urlaub (Patient)',
  'Persönliche Gründe (Patient)',
  'Therapeut krank',
  'Therapeut verhindert',
  'Urlaub (Therapeut)',
  'Notfall',
  'Terminkonflikt',
  'Sonstiges…',
];

/**
 * Zeigt den Grund-Dialog und löst mit dem gewählten Grund auf.
 * `null` = Dialog abgebrochen (Absage soll NICHT weiterlaufen).
 * `''`   = "Kein Grund angeben" gewählt (Absage läuft weiter, ohne Grund).
 */
export function showAbsagegrundModal({ title = 'Termin absagen', confirmText = 'Bestätigen', cancelText = 'Abbrechen', variant = 'danger' } = {}) {
  return new Promise(resolve => {
    const existing = document.getElementById('_absageModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = '_absageModal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card-solid,#1f2937);border:1px solid var(--border,#374151);border-radius:12px;padding:24px;width:100%;max-width:420px;';

    const optionsHtml = ABSAGE_GRUENDE.map(g =>
      `<option value="${g}" style="background:#1f2937;color:#f9fafb;">${g}</option>`
    ).join('');

    box.innerHTML = `
      <h3 style="margin:0 0 8px;font-size:16px;font-weight:700;color:var(--text-main,#f9fafb);">${title}</h3>
      <p style="margin:0 0 14px;font-size:13px;color:var(--text-muted,#9ca3af);">Absagegrund auswählen (optional)</p>
      <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#9ca3af);margin-bottom:6px;">Grund</label>
      <select id="_absageSelect" style="width:100%;padding:9px 12px;background:#1f2937;border:1px solid var(--border,#374151);border-radius:8px;color:#f9fafb;font-size:13px;box-sizing:border-box;outline:none;cursor:pointer;appearance:none;-webkit-appearance:none;">
        <option value="" style="background:#1f2937;color:#9ca3af;">— Kein Grund angeben —</option>
        ${optionsHtml}
      </select>
      <div id="_absageCustomWrap" style="display:none;margin-top:10px;">
        <label style="display:block;font-size:12px;font-weight:600;color:var(--text-muted,#9ca3af);margin-bottom:6px;">Eigener Grund</label>
        <input id="_absageCustom" type="text" placeholder="Freitext…"
          style="width:100%;padding:9px 12px;background:var(--bg-input,#111827);border:1px solid var(--border,#374151);border-radius:8px;color:var(--text-main,#f9fafb);font-size:13px;box-sizing:border-box;outline:none;" />
      </div>
      <div style="display:flex;gap:10px;margin-top:18px;justify-content:flex-end;">
        <button id="_absageCancel" style="padding:8px 16px;background:none;border:1px solid var(--border,#374151);border-radius:8px;color:var(--text-muted,#9ca3af);cursor:pointer;font-size:13px;">${cancelText}</button>
        <button id="_absageConfirm" style="padding:8px 16px;background:${variant === 'danger' ? '#dc2626' : 'var(--accent,#b1891b)'};border:none;border-radius:8px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;">${confirmText}</button>
      </div>
    `;

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    const sel = document.getElementById('_absageSelect');
    const customWrap = document.getElementById('_absageCustomWrap');
    const customField = document.getElementById('_absageCustom');

    sel.addEventListener('change', () => {
      const isSonstiges = sel.value === 'Sonstiges…';
      customWrap.style.display = isSonstiges ? 'block' : 'none';
      if (isSonstiges) setTimeout(() => customField.focus(), 50);
    });

    const cleanup = (cancelled) => {
      overlay.remove();
      if (cancelled) { resolve(null); return; }
      const selected = sel.value;
      if (!selected) { resolve(''); return; }
      if (selected === 'Sonstiges…') { resolve(customField.value.trim() || ''); return; }
      resolve(selected);
    };

    document.getElementById('_absageCancel').addEventListener('click', () => cleanup(true));
    document.getElementById('_absageConfirm').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(true); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', esc); cleanup(true); }
    });
  });
}
