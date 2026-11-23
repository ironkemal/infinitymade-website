/**
 * module/panel-verlauf.js — Hash-Routing und Browser-Verlauf für Dashboard-Panels (F-08).
 *
 * Grundsätze (Option A):
 * - Einstieg ins Dashboard (`overview`) bleibt sauber ohne Hash (`pathname + search`).
 * - Alle anderen erlaubten Panels (insb. `#ueberblick`) erhalten `#<panelId>`
 *   über `history.pushState`, sodass Neuladen und Browser-Zurück/Vorwärts zuverlässig
 *   funktionieren.
 * - Schleifenschutz (`ausVerlauf`) verhindert doppelte History-Einträge bei
 *   `popstate` / `hashchange`.
 */

const PANEL_ID_RE = /^[a-z0-9-]+$/;

/**
 * Löst einen URL-Hash (z. B. `#ueberblick`) sicher auf eine gültige Panel-ID auf.
 * Ungültige, unbekannte oder leere Hashes fallen auf `'overview'` zurück.
 *
 * @param {string | null | undefined} hash
 * @param {{ existiert?: (id: string) => boolean }} [opts]
 * @returns {string}
 */
export function panelAusHash(hash, { existiert } = {}) {
  // Unterpfad (z. B. #settings/konto = Bereich der Einstellungen, 23.11.2026) gehört dem Panel selbst.
  const roh = String(hash || '').replace(/^#/, '').trim().toLowerCase().split('/')[0];
  if (!roh || roh === 'overview') return 'overview';
  if (!PANEL_ID_RE.test(roh)) return 'overview';
  if (typeof existiert === 'function' && !existiert(roh)) return 'overview';
  return roh;
}

/**
 * Baut die Ziel-URL für ein Panel. Für `'overview'` entfällt der Hash,
 * sodass der Dashboard-Einstieg unverändert bleibt.
 *
 * @param {string | null | undefined} id
 * @param {{ pathname?: string, search?: string }} [loc]
 * @returns {string}
 */
export function urlFuerPanel(id, { pathname = '/', search = '' } = {}) {
  const basis = `${pathname || '/'}${search || ''}`;
  const sauber = String(id || '').trim().toLowerCase();
  if (!sauber || sauber === 'overview' || !PANEL_ID_RE.test(sauber)) return basis;
  return `${basis}#${sauber}`;
}

/**
 * Erstellt den Verlauf-Controller für `switchPanel()`.
 *
 * @param {{
 *   wechslePanel: (id: string) => Promise<void> | void,
 *   getAktiv: () => string,
 *   existiert?: (id: string) => boolean,
 *   win?: any,
 * }} opts
 */
export function erstellePanelVerlauf({
  wechslePanel,
  getAktiv,
  existiert,
  win = typeof window !== 'undefined' ? window : null,
}) {
  let ausVerlauf = false;
  let verdrahtet = false;

  const merkePanel = (id) => {
    if (ausVerlauf || !win?.history || !win?.location) return;
    const zielUrl = urlFuerPanel(id, win.location);
    const aktuellUrl = `${win.location.pathname || '/'}${win.location.search || ''}${win.location.hash || ''}`;
    if (String(win.location.hash || '').toLowerCase().startsWith(`#${id}/`)) return; // Unterpfad des Panels behalten
    if (zielUrl !== aktuellUrl) {
      win.history.pushState({ panel: id || 'overview' }, '', zielUrl);
    }
  };

  const synchronisiereAusUrl = async () => {
    if (!win?.location) return 'overview';
    const ziel = panelAusHash(win.location.hash, { existiert });
    if (ziel === getAktiv()) return ziel;
    ausVerlauf = true;
    try {
      await wechslePanel(ziel);
    } finally {
      ausVerlauf = false;
    }
    return ziel;
  };

  const verdrahte = () => {
    if (verdrahtet || !win?.addEventListener) return;
    verdrahtet = true;
    const onNav = () => { void synchronisiereAusUrl(); };
    win.addEventListener('popstate', onNav);
    win.addEventListener('hashchange', onNav);
  };

  const startPanelAusUrl = async () => {
    if (!win?.location) return 'overview';
    const ziel = panelAusHash(win.location.hash, { existiert });
    if (ziel !== 'overview' && ziel !== getAktiv()) {
      ausVerlauf = true;
      try {
        await wechslePanel(ziel);
      } finally {
        ausVerlauf = false;
      }
    }
    return ziel;
  };

  return { merkePanel, verdrahte, startPanelAusUrl, synchronisiereAusUrl };
}
