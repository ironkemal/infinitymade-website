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
      for (const muss of ['Mein Konto', 'Praxisdaten', 'Termine & Online-Buchung', 'Ärzte', 'Paket & Abo']) if (!eintraege.includes(muss)) befunde.push(`${breite}px: Bereich „${muss}“ fehlt`);
      const ober = await page.locator('.einst-nav-ober').allTextContents();
      if (breite === 1280 && !(ober.includes('PERSÖNLICH') && ober.includes('PRAXIS'))) befunde.push(`1280px: Obergruppen fehlen (${ober.join(', ')})`);
      if (breite === 1280) {
        if (!(await sichtbar(page, '.einst-nav-liste'))) befunde.push('1280px: Navigation nicht sichtbar');
        await page.locator('.einst-nav-eintrag', { hasText: 'Paket & Abo' }).click();
      } else {
        if (await sichtbar(page, '.einst-nav-liste')) befunde.push('390px: Desktop-Liste statt Auswahl sichtbar');
        if (!(await sichtbar(page, '.einst-nav-auswahl'))) befunde.push('390px: Auswahlliste nicht sichtbar');
        await page.locator('.einst-nav-auswahl').selectOption({ label: 'Paket & Abo' });
      }
      await ruhe(page, 200);
      if (!(await sichtbar(page, '#settingsAccountSection'))) befunde.push(`${breite}px: „Paket & Abo“ zeigt den Abo-Abschnitt nicht`);
      if (await sichtbar(page, '#settingsProfileSection')) befunde.push(`${breite}px: „Paket & Abo“ zeigt weiterhin Praxisdaten`);
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
      await page.evaluate(() => { location.hash = '#settings/abo'; });
      await ruhe(page, 300);
      if (!(await sichtbar(page, '#settingsAccountSection'))) befunde.push(`${breite}px: #settings/abo öffnet „Paket & Abo“ nicht`);
      // alter Link (bis Phase 7b) wird weitergeleitet
      await page.evaluate(() => { location.hash = '#settings/allgemein'; });
      await ruhe(page, 300);
      if (!(await sichtbar(page, '#settingsProfileSection'))) befunde.push(`${breite}px: alter Link #settings/allgemein landet nicht in „Praxisdaten“`);
      // Gefahrenzone (SaaS-Harness: Löschen vorhanden)
      await page.evaluate(() => { location.hash = '#settings/datenschutz'; });
      await ruhe(page, 300);
      if (!(await sichtbar(page, '.einst-gefahrenzone #dsgvoDeleteBtn'))) befunde.push(`${breite}px: Gefahrenzone mit „Konto & Daten löschen“ nicht sichtbar`);
      // Verweis „Auch hier einstellen“ springt in den Arbeitsbereich
      await page.evaluate(() => { location.hash = '#settings/termine'; });
      await ruhe(page, 300);
      const vk = page.locator('#settingsVerweis-termine [data-panel="hours"]');
      if (!(await vk.isVisible())) befunde.push(`${breite}px: Verweis „Öffnungszeiten“ fehlt in „Termine“`);
      else {
        await vk.click(); await ruhe(page, 500);
        const aktiv = await page.evaluate(() => { const p = document.getElementById('panel-hours'); return !!p && (p.classList.contains('active') || getComputedStyle(p).display !== 'none'); });
        if (!aktiv) befunde.push(`${breite}px: Verweis öffnet „Öffnungszeiten“ nicht`);
        await wechsle(page, 'settings'); await ruhe(page, 400);
      }
      const quer = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (quer) befunde.push(`${breite}px: horizontales Scrollen`);
    } finally {
      sauber = konsoleAuswerten(konsole, `einstellungen-nav ${breite}px`) && sauber;
      await kontext.close();
    }
  }
  // Sprünge aus anderen Bereichen (Regression 23.11.2026): Ziel muss sichtbar UND im Bild sein, Feld fokussiert.
  {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1280, hoehe: 900, rolle: 'owner' });
    const konsole = konsoleBeobachten(page);
    const imBild = (id) => page.evaluate((i) => { const e = document.getElementById(i); if (!e || !e.getClientRects().length || getComputedStyle(e).display === 'none') return false; const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }, id);
    try {
      await wechsle(page, 'settings'); await ruhe(page, 600);
      // a) „Was fehlt noch?“ im Briefkopf: jeden Link prüfen, der in einen ANDEREN Bereich zeigt
      // Liste „Was fehlt noch?“ entsteht erst, wenn „Briefkopf & Belege“ sichtbar ist
      await page.evaluate(() => { location.hash = '#settings/briefkopf'; }); await ruhe(page, 500);
      const links = await page.evaluate(() => [...document.querySelectorAll('#settingsBrandingSection [data-sprung]')].map((a) => ({ ziel: a.dataset.sprung, feld: a.dataset.feld || '' })));
      let geprueft = 0;
      for (const l of links) {
        await page.evaluate(() => { location.hash = '#settings/briefkopf'; });
        await ruhe(page, 250);
        const link = page.locator(`#settingsBrandingSection [data-sprung="${l.ziel}"][data-feld="${l.feld}"]`).first();
        if (!(await link.isVisible())) continue;
        await link.click(); await ruhe(page, 700);
        geprueft++;
        if (!(await imBild(l.ziel))) befunde.push(`„Was fehlt noch?“ → ${l.ziel}: Ziel nicht sichtbar/im Bild`);
        if (l.feld) {
          const fokus = await page.evaluate(() => document.activeElement?.id || '');
          if (fokus !== l.feld) befunde.push(`„Was fehlt noch?“ → ${l.ziel}: Feld ${l.feld} nicht fokussiert (aktiv: ${fokus || '—'})`);
        }
      }
      console.log(`Sprünge „Was fehlt noch?“ geprüft: ${geprueft}`);
      if (!geprueft) befunde.push('„Was fehlt noch?“: kein Sprung-Link im Szenario — Probe greift nicht');
      // b) Einrichtungsring (Kopfzeile): jeden offenen Punkt anklicken
      await wechsle(page, 'overview'); await ruhe(page, 400);
      const ringZiele = await page.evaluate(() => [...document.querySelectorAll('#einrichtungPopover [data-ziel]')].map((b) => b.dataset.ziel));
      let ring = 0;
      for (const ziel of [...new Set(ringZiele)]) {
        await wechsle(page, 'overview'); await ruhe(page, 300);
        const knopf = page.locator('#einrichtungRing, [aria-controls="einrichtungPopover"]').first();
        if (!(await knopf.isVisible().catch(() => false))) break;
        await knopf.click(); await ruhe(page, 200);
        await page.locator(`#einrichtungPopover [data-ziel="${ziel}"]`).first().click(); await ruhe(page, 800);
        ring++;
        if (!(await imBild(ziel))) befunde.push(`Einrichtungsring → ${ziel}: Ziel nicht sichtbar/im Bild`);
      }
      console.log(`Sprünge Einrichtungsring geprüft: ${ring}`);
    } finally {
      sauber = konsoleAuswerten(konsole, 'einstellungen-nav Sprünge') && sauber;
      await kontext.close();
    }
  }
  // Mitarbeiter (Melih 23.11.2026): Einstellungen erreichbar, nur persönliche Abschnitte
  {
    const { kontext, page } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1280, hoehe: 900, rolle: 'employee' });
    const konsole = konsoleBeobachten(page);
    try {
      await wechsle(page, 'settings'); await ruhe(page, 600);
      const aktiv = await page.evaluate(() => document.getElementById('panel-settings')?.classList.contains('active') || getComputedStyle(document.getElementById('panel-settings')).display !== 'none');
      if (!aktiv) befunde.push('Mitarbeiter: Einstellungen nicht erreichbar');
      await page.locator('.einst-nav').waitFor({ state: 'attached', timeout: 8000 });
      const bereiche = await page.locator('.einst-nav-eintrag').allTextContents();
      for (const verboten of ['Praxisdaten', 'Rechnung', 'Krankenkasse', 'Buchhaltung', 'System', 'Termine & Online-Buchung', 'Ärzte', 'Team', 'Paket & Abo']) if (bereiche.includes(verboten)) befunde.push(`Mitarbeiter sieht Bereich „${verboten}“`);
      if (!bereiche.includes('Mein Konto')) befunde.push(`Mitarbeiter sieht „Mein Konto“ nicht (${bereiche.join(', ')})`);
      await page.locator('.einst-suche').fill('a');
      await ruhe(page, 200);
      for (const id of ['settingsProfileSection', 'settingsBillingSection', 'settingsBrandingSection', 'settingsDsgvoSection']) if (await sichtbar(page, '#' + id)) befunde.push(`Mitarbeiter sieht ${id}`);
      await page.locator('.einst-suche').fill('passwort');
      await ruhe(page, 200);
      const pw = await page.evaluate(() => [...document.querySelectorAll('.settings-section-title[data-i18n="set_password"]')].some((t) => t.closest('.settings-section').getClientRects().length > 0));
      if (!pw) befunde.push('Mitarbeiter findet „Passwort“ nicht');
    } finally {
      sauber = konsoleAuswerten(konsole, 'einstellungen-nav Mitarbeiter') && sauber;
      await kontext.close();
    }
  }
} finally { await browser.close(); await server.stop?.(); server.close?.(); }

console.log(JSON.stringify({ befunde }));
if (befunde.length || !sauber) { for (const b of befunde) console.error('FAIL:', b); process.exitCode = 1; }
else console.log('PASS: Einstellungen-Navigation Desktop + 390 px');
