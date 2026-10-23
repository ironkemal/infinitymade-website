/**
 * redesign-harness.mjs — gemeinsamer Unterbau für tools/redesign-shots.mjs (T4)
 * und tools/redesign-smoke.mjs (T5), siehe redesign/AUFTRAG.md Abschnitt 6.
 *
 * Warum ohne Login
 * ────────────────
 * Die echte App hängt an der Produktivdatenbank. Für Optik-Vergleiche braucht es
 * aber feste, wiederholbare Daten — sonst zeigt jeder Pixel-Diff nur, dass sich
 * zwischen zwei Läufen ein Termin geändert hat. Darum:
 *   - eigener statischer Server auf einem freien Port, liefert DIESEN Checkout
 *     (Port 8081 kann vom Haupt-Checkout belegt sein — falscher Code im Bild),
 *   - `/vendor/supabase-js.js` wird gegen tools/browser-probe/redesign-fixture.js
 *     getauscht (synthetische Praxis, nur lesend),
 *   - `/api/config` und `/api/*` werden im Browser beantwortet,
 *   - jede Anfrage an einen fremden Host wird abgebrochen und protokolliert,
 *   - die Uhr steht fest (Fr 23.10.2026, 10:15 Berlin), damit „heute“ stabil ist.
 * Es fließt also weder ein Zugangsdatum noch ein Patientendatensatz, und kein
 * Klick kann etwas in eine echte Datenbank schreiben.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

export const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
export const TAG = '2026-10-23';
const UHR = new Date('2026-10-23T10:15:00+02:00');

/** Panels in der Reihenfolge von redesign/STATUS.md. */
export const PANELS = ['overview', 'calendar', 'anfragen', 'kunden', 'podologie-billing', 'fussstatus', 'verordnungen',
  'abrechnung', 'rechnungen', 'belegliste', 'mahnwesen', 'warteliste', 'ueberblick', 'anamnese', 'doctors',
  'fahrtenbuch', 'statistik', 'notizen', 'services', 'hours', 'team', 'vorlagen', 'settings', 'b2b', 'b2c',
  'feedback', 'beispielmodus'];

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

/** Statischer Server nur für diesen Checkout. Fester Port (REDESIGN_PORT, Standard 18081), weil die
 *  Adresse in Bildern sichtbar wird (z. B. QR-Code der Mitarbeiter-App) — ein Zufallsport
 *  erzeugte bei jedem Lauf einen Pixel-Diff. */
export async function starteServer() {
  const server = createServer(async (req, res) => {
    try {
      const pfad = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const datei = normalize(join(WURZEL, pfad === '/' ? '/dashboard.html' : pfad));
      if (!datei.startsWith(WURZEL)) { res.writeHead(403); res.end(); return; }
      if (!(await stat(datei)).isFile()) throw new Error('kein File');
      res.writeHead(200, { 'Content-Type': MIME[extname(datei)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(await readFile(datei));
    } catch { res.writeHead(404); res.end('nicht gefunden'); }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(Number(process.env.REDESIGN_PORT || 18081), '127.0.0.1', ok); });
  return { basis: `http://127.0.0.1:${server.address().port}`, stop: () => new Promise((ok) => server.close(ok)) };
}

export async function starteBrowser() { return chromium.launch(); }

/**
 * Öffnet dashboard.html in einem frischen Kontext.
 * @param {object} o  { basis, breite, hoehe, theme: 'hell'|'dunkel', design: 'alt'|'neu', rolle, szenario }
 */
export async function oeffneDashboard(browser, o) {
  const fixture = await readFile(join(WURZEL, 'tools/browser-probe/redesign-fixture.js'), 'utf8');
  const kontext = await browser.newContext({ viewport: { width: o.breite, height: o.hoehe || 900 },
    deviceScaleFactor: 1, locale: 'de-DE', timezoneId: 'Europe/Berlin' });
  // Kein reducedMotion: 'reduce' — dashboard.css:7139 setzt dann `transform: none !important` auf alles,
  // und mobil bleibt die Seitenleiste offen über dem Inhalt (vorbestehend, STATUS.md Fehlerbuch R-01).
  // Bewegung stoppen die Bilder selbst (`animations: 'disabled'`).
  const page = await kontext.newPage();
  const protokoll = { konsole: [], seitenfehler: [], fremd: [], api: [] };
  page.on('console', (m) => { if (m.type() === 'error') protokoll.konsole.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => protokoll.seitenfehler.push(String(e.message).slice(0, 300)));

  await page.clock.setFixedTime(UHR);
  await page.addInitScript(({ theme, rolle, szenario, tag }) => {
    try {
      if (theme === 'dunkel') localStorage.setItem('im-theme', 'dark'); else localStorage.setItem('im-theme', 'light');
    } catch { /* egal */ }
    window.__rsDay = tag; window.__rsRolle = rolle; window.__rsSzenario = szenario;
  }, { theme: o.theme, rolle: o.rolle || 'owner', szenario: o.szenario || 'voll', tag: TAG });

  await page.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== o.basis) { protokoll.fremd.push(url.host); return route.abort(); }
    if (url.pathname === '/vendor/supabase-js.js') {
      return route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: fixture });
    }
    if (url.pathname === '/api/config') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        supabaseUrl: 'https://synthetic.invalid', supabaseAnonKey: 'synthetisch-anon', apiBase: '/api',
        istKutu: false, telemetryEnabled: false }) });
    }
    if (url.pathname.startsWith('/api/')) {
      protokoll.api.push(route.request().method() + ' ' + url.pathname);
      return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
    return route.continue();
  });

  const suche = o.design === 'neu' ? '?design=neu' : '?design=alt';
  await page.goto(`${o.basis}/dashboard.html${suche}`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#sidebarNav .sidebar-item', { timeout: 20000 });
  await ruhe(page);
  return { kontext, page, protokoll };
}

/** Wartet, bis das Netz ruhig ist (begrenzt) und ein Frame gezeichnet wurde. */
export async function ruhe(page, ms = 500) {
  await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** Bereich wechseln über die echte switchPanel-Funktion. Liefert false, wenn das Panel nicht aktiv wurde. */
export async function wechsle(page, id) {
  const ok = await page.evaluate(async (pid) => {
    if (typeof window.switchPanel !== 'function') return false;
    try { await window.switchPanel(pid); } catch { return false; }
    const el = document.getElementById('panel-' + pid);
    if (el) document.getElementById('mainArea')?.scrollTo(0, 0);
    return !!el?.classList.contains('active');
  }, id);
  await ruhe(page, 700);
  return ok;
}

/** Fixture-Protokoll aus der Seite (Lesen/Schreiben/unbekannte Tabellen). */
export async function fixtureLog(page) {
  return page.evaluate(() => {
    const l = window.__rsFixture || {};
    return { writes: l.writes || [], unbekannt: [...new Set(l.unbekannt || [])], rpc: [...new Set(l.rpc || [])],
      functions: l.functions || [], storage: l.storage || [] };
  });
}
