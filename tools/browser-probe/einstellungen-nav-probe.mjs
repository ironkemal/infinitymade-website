/** Einstellungen-Navigation (Pflichtpunkt 8, 23.11.2026): linke Navigation am Desktop, Auswahlliste am Handy.
 *  Synthetische App ohne Login über HTTP (redesign-harness). Prüft: Navigation da, Kategorie filtert
 *  Abschnitte, gemerkte Wahl, Sprung gehZuEinstellung öffnet die richtige Kategorie, kein Querscrollen bei 390 px,
 *  keine Konsolenfehler. Exit 1 bei Befund. Aufruf: node tools/browser-probe/einstellungen-nav-probe.mjs */
import { oeffneDashboard, starteBrowser, starteServer, ruhe, wechsle } from '../redesign-harness.mjs';
import { konsoleBeobachten, konsoleAuswerten } from './konsole.mjs';
process.env.REDESIGN_PORT ||= '18524';
const server = await starteServer(); const browser = await starteBrowser();
const befunde = []; let sauber = true;
const sichtbar = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none'; }, sel);

try {
  for (const breite of [1280, 390]) {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite, hoehe: breite === 390 ? 844 : 900, rolle: 'owner' });
    const konsole = konsoleBeobachten(page);
    try {
      await wechsle(page, 'settings'); await ruhe(page, 600);
      await page.locator('.einst-nav').waitFor({ state: 'attached', timeout: 8000 });
      const eintraege = await page.locator('.einst-nav-eintrag').allTextContents();
      if (eintraege.length < 5) befunde.push(`${breite}px: nur ${eintraege.length} Kategorien (${eintraege.join(', ')})`);
      if (!eintraege.includes('Konto')) befunde.push(`${breite}px: Kategorie „Konto“ fehlt`);
      if (breite === 1280) {
        if (!(await sichtbar(page, '.einst-nav-liste'))) befunde.push('1280px: Navigation nicht sichtbar');
        await page.locator('.einst-nav-eintrag', { hasText: 'Konto' }).click();
      } else {
        if (await sichtbar(page, '.einst-nav-liste')) befunde.push('390px: Desktop-Liste statt Auswahl sichtbar');
        if (!(await sichtbar(page, '.einst-nav-auswahl'))) befunde.push('390px: Auswahlliste nicht sichtbar');
        await page.locator('.einst-nav-auswahl').selectOption({ label: 'Konto' });
      }
      await ruhe(page, 200);
      if (!(await sichtbar(page, '#settingsAccountSection'))) befunde.push(`${breite}px: „Konto“ zeigt den Konto-Abschnitt nicht`);
      if (await sichtbar(page, '#settingsProfileSection')) befunde.push(`${breite}px: „Konto“ zeigt weiterhin das Profil`);
      // Sprung von außen (gehZuEinstellung) muss die Kategorie wechseln
      await page.evaluate(() => window.gehZuEinstellung?.('settingsProfileSection'));
      await ruhe(page, 500);
      if (!(await sichtbar(page, '#settingsProfileSection'))) befunde.push(`${breite}px: gehZuEinstellung öffnet „Allgemein“ nicht`);
      // KI-Bereich zeigt den KI-Abschnitt (Altfehler: offener „Integrationen“-Abschnitt schluckte KI/System/DSGVO)
      if (breite === 1280) await page.locator('.einst-nav-eintrag', { hasText: 'KI-Unterstützung' }).click();
      else await page.locator('.einst-nav-auswahl').selectOption({ label: 'KI-Unterstützung' });
      await ruhe(page, 200);
      if (!(await sichtbar(page, '#settingsKiSection'))) befunde.push(`${breite}px: Bereich „KI-Unterstützung“ zeigt den KI-Abschnitt nicht`);
      // Suche über alle Bereiche
      await page.locator('.einst-suche').fill('datev');
      await ruhe(page, 200);
      if (!(await sichtbar(page, '#settingsDatevSection'))) befunde.push(`${breite}px: Suche „datev“ findet DATEV-Export nicht`);
      if (await sichtbar(page, '#settingsKiSection')) befunde.push(`${breite}px: Suche „datev“ zeigt weiter KI`);
      await page.locator('.einst-suche').fill('');
      // Deep-Link
      await page.evaluate(() => { location.hash = '#settings/konto'; });
      await ruhe(page, 300);
      if (!(await sichtbar(page, '#settingsAccountSection'))) befunde.push(`${breite}px: #settings/konto öffnet „Konto“ nicht`);
      const quer = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (quer) befunde.push(`${breite}px: horizontales Scrollen`);
    } finally {
      sauber = konsoleAuswerten(konsole, `einstellungen-nav ${breite}px`) && sauber;
      await kontext.close();
    }
  }
} finally { await browser.close(); await server.stop?.(); server.close?.(); }

console.log(JSON.stringify({ befunde }));
if (befunde.length || !sauber) { for (const b of befunde) console.error('FAIL:', b); process.exitCode = 1; }
else console.log('PASS: Einstellungen-Navigation Desktop + 390 px');
