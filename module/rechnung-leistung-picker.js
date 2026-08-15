/**
 * rechnung-leistung-picker.js — Leistungsauswahl als eigenständiges Overlay
 *
 * Befund aus dem Live-Test (Kemal, 15.08.2026): Der Knopf „+ Leistung hinzufügen"
 * legte eine leere Zeile an, und der Nutzer musste danach im Zeilen-Select die
 * richtige Leistung heraussuchen. Bei langen Katalogen war das mühsam; Leistungen
 * ausserhalb des Katalogs (Befund, Verspätungsgebühr, individuelle Positionen)
 * liessen sich gar nicht sauber erfassen — der Select bot keinen freien Eintrag,
 * und der Titel, den man in das Textfeld tippte, überschrieb nur den Wert, ohne
 * den Preis zu setzen.
 *
 * Dieser Picker öffnet ein modales Overlay direkt beim Klick auf den Knopf.
 * Der Nutzer wählt entweder eine vorhandene Katalogposition (mit Suchfeld) oder
 * gibt eine freie Position (Name + Preis) ein. Erst dann wird die Zeile angelegt.
 * Das Overlay wird programmatisch erzeugt und wieder entfernt — kein statisches
 * Markup in dashboard.html nötig.
 */

/**
 * @param {Array} ownerServices  Einträge aus `services`: {id,title,price,duration_minutes,price_config,gkv_position_nr}
 * @param {object} deps
 * @param {Function} deps.escapeHtml
 * @param {Function} deps.formatEur
 * @param {Function} [deps.preisFuer]  optional: (service) => number — Preisauflösung des Aufrufers
 * @returns {Promise<{title:string, quantity:number, unit_price:number}|null>}  null = abgebrochen
 */
export function waehleLeistung(ownerServices, deps) {
  const { escapeHtml, formatEur, preisFuer } = deps;
  const katalog = ownerServices || [];

  return new Promise((resolve) => {
    let resolved = false;

    function schliessenMit(wert) {
      if (resolved) return;
      resolved = true;
      document.removeEventListener('keydown', onEsc);
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(wert);
    }

    function onEsc(e) {
      if (e.key === 'Escape') schliessenMit(null);
    }

    // ── Overlay-Rahmen ────────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) schliessenMit(null);
    });

    // ── Modaler Dialog ────────────────────────────────────────────────────────
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.maxWidth = '520px';
    overlay.appendChild(modal);

    // Header
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.innerHTML = `<span class="modal-title">Leistung hinzufügen</span>`;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-close';
    closeBtn.type = 'button';
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => schliessenMit(null));
    header.appendChild(closeBtn);
    modal.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '16px';
    modal.appendChild(body);

    // ── Suchfeld ─────────────────────────────────────────────────────────────
    const suchInput = document.createElement('input');
    suchInput.type = 'text';
    suchInput.className = 'form-input';
    suchInput.placeholder = 'Leistung suchen …';
    suchInput.setAttribute('autocomplete', 'off');
    body.appendChild(suchInput);

    // ── Katalogliste ──────────────────────────────────────────────────────────
    const listeWrap = document.createElement('div');
    listeWrap.style.cssText = [
      'max-height:240px',
      'overflow-y:auto',
      'border:1px solid var(--border)',
      'border-radius:var(--radius-sm)',
      'background:var(--bg-card)',
    ].join(';');
    body.appendChild(listeWrap);

    function preisVon(s) {
      return preisFuer ? preisFuer(s) : (parseFloat(s.price) || 0);
    }

    function baueListenZeilen(filter) {
      listeWrap.innerHTML = '';
      if (katalog.length === 0) {
        const hinweis = document.createElement('p');
        hinweis.style.cssText = 'padding:16px;color:var(--text-muted);font-size:14px;margin:0;';
        hinweis.textContent = 'Kein Leistungskatalog hinterlegt.';
        listeWrap.appendChild(hinweis);
        return;
      }
      const q = (filter || '').toLowerCase();
      const treffer = katalog.filter(s => (s.title || '').toLowerCase().includes(q));
      if (treffer.length === 0) {
        const hinweis = document.createElement('p');
        hinweis.style.cssText = 'padding:16px;color:var(--text-muted);font-size:14px;margin:0;';
        hinweis.textContent = 'Keine Treffer.';
        listeWrap.appendChild(hinweis);
        return;
      }
      treffer.forEach(s => {
        const zeile = document.createElement('button');
        zeile.type = 'button';
        zeile.style.cssText = [
          'display:flex',
          'justify-content:space-between',
          'align-items:center',
          'width:100%',
          'padding:10px 14px',
          'background:none',
          'border:none',
          'border-bottom:1px solid var(--border)',
          'cursor:pointer',
          'text-align:left',
          'gap:12px',
          'transition:background 0.15s',
        ].join(';');
        zeile.addEventListener('mouseenter', () => { zeile.style.background = 'var(--bg-hover)'; });
        zeile.addEventListener('mouseleave', () => { zeile.style.background = 'none'; });

        const titelSpan = document.createElement('span');
        titelSpan.style.cssText = 'color:var(--text-main);font-size:14px;flex:1;';
        titelSpan.textContent = s.title || '';

        const preisSpan = document.createElement('span');
        preisSpan.style.cssText = 'color:var(--text-muted);font-size:13px;white-space:nowrap;';
        preisSpan.textContent = formatEur(preisVon(s));

        zeile.appendChild(titelSpan);
        zeile.appendChild(preisSpan);
        zeile.addEventListener('click', () => {
          schliessenMit({ title: s.title || '', quantity: 1, unit_price: preisVon(s) });
        });
        listeWrap.appendChild(zeile);
      });
    }

    baueListenZeilen('');
    suchInput.addEventListener('input', () => baueListenZeilen(suchInput.value));

    // ── Freie Position ────────────────────────────────────────────────────────
    const freiWrap = document.createElement('div');
    freiWrap.style.cssText = 'border-top:1px solid var(--border);padding-top:14px;display:flex;flex-direction:column;gap:10px;';

    const freiTitel = document.createElement('p');
    freiTitel.style.cssText = 'font-size:12px;font-weight:600;color:var(--text-muted);margin:0;text-transform:uppercase;letter-spacing:0.05em;';
    freiTitel.textContent = 'Freie Position';
    freiWrap.appendChild(freiTitel);

    const freiFelder = document.createElement('div');
    freiFelder.style.cssText = 'display:flex;gap:10px;align-items:flex-start;flex-wrap:wrap;';
    freiWrap.appendChild(freiFelder);

    const freiNameInput = document.createElement('input');
    freiNameInput.type = 'text';
    freiNameInput.className = 'form-input';
    freiNameInput.placeholder = 'Bezeichnung';
    freiNameInput.style.cssText = 'flex:1;min-width:160px;';

    const freiPreisInput = document.createElement('input');
    freiPreisInput.type = 'number';
    freiPreisInput.className = 'form-input';
    freiPreisInput.placeholder = '0,00';
    freiPreisInput.step = '0.01';
    freiPreisInput.min = '0';
    freiPreisInput.style.width = '110px';

    const freiBtn = document.createElement('button');
    freiBtn.type = 'button';
    freiBtn.className = 'btn-primary';
    freiBtn.textContent = 'Übernehmen';
    freiBtn.disabled = true;

    freiFelder.appendChild(freiNameInput);
    freiFelder.appendChild(freiPreisInput);
    freiFelder.appendChild(freiBtn);
    body.appendChild(freiWrap);

    function updateFreiBtn() {
      freiBtn.disabled = (freiNameInput.value.trim() === '');
    }
    freiNameInput.addEventListener('input', updateFreiBtn);

    function freiUebernehmen() {
      const name = freiNameInput.value.trim();
      if (!name) return;
      schliessenMit({ title: name, quantity: 1, unit_price: parseFloat(freiPreisInput.value) || 0 });
    }
    freiBtn.addEventListener('click', freiUebernehmen);
    freiPreisInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') freiUebernehmen(); });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const abbrechenBtn = document.createElement('button');
    abbrechenBtn.type = 'button';
    abbrechenBtn.className = 'btn-ghost';
    abbrechenBtn.textContent = 'Abbrechen';
    abbrechenBtn.addEventListener('click', () => schliessenMit(null));
    footer.appendChild(abbrechenBtn);
    modal.appendChild(footer);

    document.body.appendChild(overlay);
    document.addEventListener('keydown', onEsc);
    suchInput.focus();
  });
}
