import { API_BASE } from '../supabase-config.js';

const AMBIGUOUS_OR_INVALID_CHARS = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/;

/**
 * Normalisiert einen Einrichtungscode: entfernt Leerzeichen und Bindestriche,
 * wandelt Kleinbuchstaben in Großbuchstaben um.
 *
 * @param {string} code
 * @returns {string}
 */
export function normalizeCode(code) {
  if (typeof code !== 'string') return '';
  return code.toUpperCase().replace(/[\s\-_]/g, '').trim();
}

/**
 * Formatiert einen Einrichtungscode ins Anzeigeformat XXXXX-XXXXX.
 *
 * @param {string} code
 * @returns {string}
 */
export function formatCode(code) {
  const norm = normalizeCode(code);
  if (norm.length === 10) {
    return `${norm.slice(0, 5)}-${norm.slice(5)}`;
  }
  return norm;
}

/**
 * Prüft, ob ein Einrichtungscode gültig strukturiert ist:
 * Genau 10 Zeichen aus dem Alphabet ABCDEFGHJKLMNPQRSTUVWXYZ23456789.
 *
 * @param {string} code
 * @returns {boolean}
 */
export function isValidCodeFormat(code) {
  const norm = normalizeCode(code);
  if (norm.length !== 10) return false;
  return !AMBIGUOUS_OR_INVALID_CHARS.test(norm);
}

/**
 * Hilfsfunktion zum Auslesen des Bearer-Tokens und der Fetch-Optionen.
 */
function resolveOptions(opts) {
  let token = null;
  let apiBase = API_BASE;
  let fetchImpl = typeof fetch !== 'undefined' ? fetch : null;

  if (typeof opts === 'string') {
    token = opts;
  } else if (opts && typeof opts === 'object') {
    token = opts.token || null;
    if (opts.apiBase) apiBase = opts.apiBase;
    if (opts.fetchImpl) fetchImpl = opts.fetchImpl;
  }
  return { token, apiBase, fetchImpl };
}

/**
 * Legt einen Mitarbeiter an (Backend-Aufruf POST /api/team/mitarbeiter).
 *
 * @param {object} param0 { vorname, nachname, email, anrede }
 * @param {object|string} [options] { token, apiBase, fetchImpl } oder token
 * @returns {Promise<{ id: string, email: string, einrichtungscode: string, gueltig_bis: string }>}
 */
export async function mitarbeiterAnlegen({ vorname, nachname, email, anrede, telefon }, options = {}) {
  const { token, apiBase, fetchImpl } = resolveOptions(options);

  if (!token) {
    throw new Error('Keine aktive Sitzung gefunden. Bitte erneut anmelden.');
  }

  const res = await fetchImpl(`${apiBase}/team/mitarbeiter`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ vorname, nachname, email, anrede, telefon }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Mitarbeiter konnte nicht angelegt werden.');
  }
  return data;
}

/**
 * Erzeugt einen neuen Einrichtungscode für einen bestehenden Mitarbeiter
 * (Backend-Aufruf POST /api/team/mitarbeiter/:id/einrichtungscode).
 *
 * @param {string} mitarbeiterId
 * @param {object|string} [options] { token, apiBase, fetchImpl } oder token
 * @returns {Promise<{ einrichtungscode: string, gueltig_bis: string }>}
 */
export async function neuerEinrichtungscode(mitarbeiterId, options = {}) {
  if (!mitarbeiterId) {
    throw new Error('Mitarbeiter-ID fehlt.');
  }

  const { token, apiBase, fetchImpl } = resolveOptions(options);
  if (!token) {
    throw new Error('Keine aktive Sitzung gefunden. Bitte erneut anmelden.');
  }

  const res = await fetchImpl(`${apiBase}/team/mitarbeiter/${encodeURIComponent(mitarbeiterId)}/einrichtungscode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Einrichtungscode konnte nicht erzeugt werden.');
  }
  return data;
}

/**
 * Zeigt ein Modal mit dem Einrichtungscode, Kopierknopf und Erläuterung an.
 * Nutzt ausschließlich CSS-Variablen.
 *
 * @param {string} code
 * @param {string} gueltigBis ISO-Datumsstring
 * @param {string} [name] Name des Mitarbeiters
 * @returns {Promise<void>}
 */
export function zeigeEinrichtungscode(code, gueltigBis, name = '') {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve();
      return;
    }

    const existing = document.getElementById('einrichtungscodeModal');
    if (existing) existing.remove();

    const formattedCode = formatCode(code);

    let dateStr = gueltigBis || '7 Tage';
    try {
      if (gueltigBis) {
        const d = new Date(gueltigBis);
        if (!isNaN(d.getTime())) {
          dateStr = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
        }
      }
    } catch (_) {}

    const loginHost = (typeof window !== 'undefined' && window.location && window.location.host)
      ? window.location.host
      : 'app.praxura.de';

    const modal = document.createElement('div');
    modal.id = 'einrichtungscodeModal';
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';

    const titleText = name
      ? `Einrichtungscode für ${name}`
      : 'Einrichtungscode';

    modal.innerHTML = `
      <div class="modal" style="background:var(--bg-card-solid);color:var(--text-main);border:1px solid var(--border);border-radius:12px;max-width:520px;width:100%;padding:24px;box-shadow:0 12px 36px rgba(0,0,0,0.35);box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
          <h3 style="margin:0;font-size:18px;font-weight:600;color:var(--text-main);">${titleText}</h3>
          <button class="modal-close" id="ecCloseX" type="button" aria-label="Schließen" style="background:none;border:none;font-size:22px;color:var(--text-muted);cursor:pointer;padding:0 4px;line-height:1;">✕</button>
        </div>
        <div style="background:var(--bg-main, rgba(0,0,0,0.04));border:1px solid var(--border);border-radius:8px;padding:16px;display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;gap:12px;">
          <div style="font-family:var(--mono, monospace);font-size:26px;font-weight:700;letter-spacing:0.12em;color:var(--text-main);word-break:break-all;" id="ecCodeDisplay">${formattedCode}</div>
          <button class="btn-ghost btn-sm" id="ecCopyBtn" type="button" style="flex-shrink:0;padding:8px 14px;font-size:13px;border:1px solid var(--border);border-radius:6px;background:var(--bg-card-solid);color:var(--text-main);cursor:pointer;">Kopieren</button>
        </div>
        <p style="font-size:14px;line-height:1.55;color:var(--text-main);margin:0 0 12px 0;">
          Geben Sie diesen Code persönlich weiter. Ihre Mitarbeiterin/Ihr Mitarbeiter meldet sich unter <strong>${loginHost}/login.html</strong> → „Erstanmeldung mit Einrichtungscode" an und vergibt dort ein eigenes Passwort.
        </p>
        <p style="font-size:13px;color:var(--text-muted);margin:0 0 20px 0;">
          Gültig bis ${dateStr}.
        </p>
        <div style="display:flex;justify-content:flex-end;">
          <button class="btn-primary" id="ecCloseBtn" type="button" style="padding:10px 20px;font-size:14px;font-weight:600;border-radius:6px;cursor:pointer;">Schließen</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeHandler = () => {
      modal.remove();
      resolve();
    };

    document.getElementById('ecCloseX')?.addEventListener('click', closeHandler);
    document.getElementById('ecCloseBtn')?.addEventListener('click', closeHandler);

    document.getElementById('ecCopyBtn')?.addEventListener('click', () => {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(formattedCode).then(() => {
          const btn = document.getElementById('ecCopyBtn');
          if (btn) {
            btn.textContent = 'Kopiert ✓';
            setTimeout(() => {
              if (btn) btn.textContent = 'Kopieren';
            }, 2000);
          }
        }).catch(() => {});
      }
    });
  });
}

/**
 * HTML des Knopfes "Neuer Einrichtungscode" für eine Mitarbeiterkarte.
 * Leer, wenn der Aufrufer kein Inhaber ist oder die Karte kein Mitarbeiter.
 */
export function einrichtungscodeKnopfHtml(m, istOwner) {
  if (!istOwner || !m || m.role !== 'employee') return '';
  return `<button class="btn-ghost emp-neuer-code" type="button" data-emp-id="${m.id}" data-emp-name="${String(m.business_name || '').replace(/"/g, '&quot;')}" style="width:100%;font-size:12px;padding:6px;border-top:1px solid var(--border);">Neuer Einrichtungscode</button>`;
}

/**
 * Verdrahtet die "Neuer Einrichtungscode"-Knöpfe in der Mitarbeiterliste.
 * @param {HTMLElement} liste
 * @param {{ getToken: () => Promise<string|null>, confirm: Function, toast: Function }} deps
 */
export function verdrahteEinrichtungscodeKnoepfe(liste, { getToken, confirm, toast }) {
  liste.querySelectorAll('.emp-neuer-code').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      const name = btn.dataset.empName || '';
      const ok = await confirm({
        title: 'Neuer Einrichtungscode',
        message: `Für ${name || 'diese Person'} wird ein neuer Einrichtungscode erzeugt. Das bisherige Passwort wird ungültig; die Person muss sich über „Erstanmeldung mit Einrichtungscode" ein neues Passwort vergeben.`,
        confirmText: 'Code erzeugen',
      });
      if (!ok) return;
      btn.disabled = true;
      try {
        const token = await getToken();
        const r = await neuerEinrichtungscode(btn.dataset.empId, { token });
        await zeigeEinrichtungscode(r.einrichtungscode, r.gueltig_bis, name);
      } catch (err) {
        toast('Fehler: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
      }
    });
  });
}
