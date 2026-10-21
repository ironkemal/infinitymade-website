// Browser-Probe: einbettbares Termin-Anfrage-Widget (widget/), vier Schritte.
// Startet einen eigenen statischen Server (Widget-Ursprung) und einen zweiten (fremde Host-Seite),
// damit der Fremd-Ursprung-Fall echt ist. Mock-Backend, erfundene Daten, kein Login.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
const OWNER = '00000000-0000-4000-8000-000000000001';

function dateiServer(port, hostSeite) {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x').pathname;
    if (hostSeite && url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(hostSeite);
      return;
    }
    const p = path.join(ROOT, url);
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(p));
  }).listen(port);
}

const ergebnisse = [];
const ok = (name, bedingung, detail = '') => ergebnisse.push({ name, ok: Boolean(bedingung), detail: bedingung ? detail : detail || 'Bedingung nicht erfüllt' });

const PORT_WIDGET = 18081;
const PORT_HOST = 18090;
const widgetServer = dateiServer(PORT_WIDGET);
const hostServer = dateiServer(PORT_HOST, `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><title>Host</title></head>
<body><p id="secret">Host-Geheimnis 42</p>
<script src="http://localhost:${PORT_WIDGET}/widget/embed.js" data-owner="${OWNER}" data-mock="pending"></script></body></html>`);

const browser = await chromium.launch();
const konsolenfehler = [];
async function neueSeite(ctx) {
  const p = await ctx.newPage();
  p.on('pageerror', (e) => konsolenfehler.push(String(e.message)));
  p.on('console', (m) => { if (m.type() === 'error') konsolenfehler.push(m.text()); });
  return p;
}
const URL_W = (q) => `http://localhost:${PORT_WIDGET}/widget/booking-widget.html?owner=${OWNER}&${q}`;
// Titel steht am Anfang der Karte; hasText mit RegExp, weil Hinweistexte („mit oder ohne Rezept“) sonst mittreffen.
const karte = (p, text) => p.locator('label.bw__opt-row', { hasText: new RegExp('^\\s*' + text) }).first();
const sichtbar = (p, id) => p.locator(id).isVisible();
const fehlerSichtbar = (p) => p.locator('.bw__error:not([hidden])').count();

async function oeffne(ctx, q) {
  const p = await neueSeite(ctx);
  await p.goto(URL_W(q));
  await p.waitForSelector('[data-bw-panel="1"]:not([hidden])');
  return p;
}
async function schritt1(p, { anliegen, versicherung }) {
  if (anliegen) await karte(p, anliegen).click();
  await karte(p, versicherung).click();
  await p.click('#bw-next');
  await p.waitForSelector('[data-bw-panel="2"]:not([hidden])');
}
async function schritt2(p) {
  await p.locator('.bw__day', { hasText: 'Mo' }).first().click();
  await p.locator('.bw__day', { hasText: 'Mi' }).first().click();
  await karte(p, 'Vormittag').click();
  await karte(p, 'In 2 bis 3 Wochen').click();
  await p.click('#bw-next');
  await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
}
async function schritt3(p, o = {}) {
  await p.fill('#bw-vorname', o.vorname ?? 'Erika');
  await p.fill('#bw-nachname', o.nachname ?? 'Musterfrau');
  await p.fill('#bw-tag', '12');
  await p.fill('#bw-monat', '4');
  await p.fill('#bw-jahr', '1975');
  await p.fill('#bw-telefon', o.telefon ?? '0151 1234567');
  await p.click('#bw-next');
  await p.waitForSelector('[data-bw-panel="4"]:not([hidden])');
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1040, height: 900 } });

  // 1 · Ungueltige Praxis-ID
  {
    const p = await neueSeite(ctx);
    await p.goto(`http://localhost:${PORT_WIDGET}/widget/booking-widget.html?owner=kaputt`);
    ok('Ungültige Praxis-ID: Formular gesperrt', await sichtbar(p, '#bw-banner') && !(await sichtbar(p, '#bw-form')));
    await p.close();
  }

  // 2 · Schritt 1: Pflicht, Filter, Zuruecksetzen
  {
    const p = await oeffne(ctx, 'mock=pending');
    ok('Vier Anliegen-Karten (Podologie), Akut-Hinweis sichtbar', (await p.locator('#bw-anliegen-opts label').count()) === 4 && await sichtbar(p, '.bw__akut'));
    await p.click('#bw-next');
    ok('Leerer Schritt 1: Fehler an Anliegen und Versicherung', (await fehlerSichtbar(p)) === 2);
    ok('Fokus liegt auf dem ersten Fehler', (await p.evaluate(() => document.activeElement?.closest('#bw-anliegen-opts') !== null)));
    // a11y: Fehler ist mit den Eingaben verbunden, Fokus bleibt beim Auswaehlen erhalten
    ok('Anliegen-Fehler hängt per aria-describedby an den Karten', (await p.locator('#bw-anliegen-opts input').first().getAttribute('aria-describedby')) === 'bw-anliegen-error');
    await p.locator('#bw-anliegen-opts input').first().focus();
    await p.keyboard.press('ArrowDown');
    ok('Pfeiltaste in Radiogruppe: Auswahl wechselt, Fokus bleibt in der Gruppe', await p.evaluate(() => document.activeElement?.name === 'bw-anliegen' && document.activeElement.checked));
    await karte(p, 'Ohne Rezept').click();
    const opt = await p.locator('#bw-zahlart-opts label').allInnerTexts();
    ok('„Ohne Rezept“ zeigt nur Privat und Selbstzahler', opt.length === 2 && /Privat/.test(opt[0]) && /Selbstzahler/.test(opt[1]), opt.join(' | '));
    await karte(p, 'Selbstzahler').click();
    await karte(p, 'Behandlung mit Rezept').click();
    const gewaehlt = await p.locator('#bw-zahlart-opts input:checked').count();
    ok('Anliegen gewechselt: unpassende Versicherung wird geleert', gewaehlt === 0);
    await p.close();
  }

  // 3 · Schritt 2: flexibel vs. Auswahl, Pflicht
  {
    const p = await oeffne(ctx, 'mock=pending');
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    await p.click('#bw-next');
    ok('Leere Zeiten: Fehlertext', /flexibel/.test(await p.locator('#bw-zeit-error').innerText()));
    await p.locator('.bw__day', { hasText: 'Di' }).first().click();
    await p.click('#bw-next');
    ok('Nur Tag gewählt: Tageszeit wird verlangt', /Tageszeit/.test(await p.locator('#bw-zeit-error').innerText()));
    await p.locator('#bw-flexibel-row').click();
    ok('„flexibel“ löscht die Tage', (await p.locator('.bw__day input:checked').count()) === 0 && await p.locator('#bw-flexibel').isChecked());
    await p.locator('.bw__day', { hasText: 'Fr' }).first().click();
    ok('Tag gewählt schaltet „flexibel“ aus', !(await p.locator('#bw-flexibel').isChecked()));
    await p.close();
  }

  // 4 · Schritt 3: Validierung
  {
    const p = await oeffne(ctx, 'mock=pending');
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    await p.locator('#bw-flexibel-row').click();
    await p.click('#bw-next');
    await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
    await p.click('#bw-next');
    ok('Leerer Schritt 3: Fehler an Namen, Geburtsdatum, Kontakt', (await fehlerSichtbar(p)) === 4);
    ok('Fokus auf Vorname', (await p.evaluate(() => document.activeElement?.id)) === 'bw-vorname');
    await p.fill('#bw-vorname', 'Erika');
    await p.fill('#bw-nachname', 'Musterfrau');
    await p.fill('#bw-tag', '31'); await p.fill('#bw-monat', '2'); await p.fill('#bw-jahr', '1975');
    await p.fill('#bw-email', 'kaputt');
    await p.click('#bw-next');
    ok('Geburtsdatum-Fehler an allen drei Feldern', (await p.getAttribute('#bw-tag', 'aria-describedby')) === 'bw-geburtsdatum-error' && (await p.getAttribute('#bw-jahr', 'aria-invalid')) === 'true');
    ok('31.02. wird abgelehnt, E-Mail wird geprüft', /Geburtsdatum/.test(await p.locator('#bw-geburtsdatum-error').innerText()) && /E-Mail/.test(await p.locator('#bw-email-error').innerText()));
    await p.fill('#bw-email', '');
    await p.click('#bw-next');
    ok('Kontaktfehler: Telefon und E-Mail sind mit der Meldung verbunden und als ungültig markiert',
      (await p.getAttribute('#bw-telefon', 'aria-describedby')).includes('bw-kontakt-error') && (await p.getAttribute('#bw-email', 'aria-invalid')) === 'true');
    await p.close();
  }

  // 5 · Glueckspfad mit Pruefen, Aendern, Datenminimierung
  {
    const p = await oeffne(ctx, 'mock=accepted');
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    await schritt2(p);
    { const side = await p.locator('#bw-side-list').innerText(); ok('Seitenleiste (Desktop) zeigt die bisherigen Angaben', /Nagelspange/.test(side) && /Mo, Mi · Vormittag/.test(side) && /Gesetzlich/.test(side), side.replace(/\n/g, ' | ').slice(0, 100)); }
    await schritt3(p);
    const review = await p.locator('#bw-review').innerText();
    ok('Prüfen-Schritt zeigt alles in Schrittreihenfolge', /Anliegen[\s\S]*Versicherung[\s\S]*Zeiten[\s\S]*Für wen[\s\S]*Kontakt/.test(review), review.slice(0, 120).replace(/\n/g, ' | '));
    ok('Prüfen: Zeiten lesbar', /Mo, Mi · Vormittag \(8–12\)/.test(review));
    await p.locator('#bw-review > div', { hasText: 'Zeiten' }).locator('button').click();
    await p.waitForSelector('[data-bw-panel="2"]:not([hidden])');
    ok('„Ändern“ springt zum Schritt, Eingaben bleiben', await p.locator('#bw-flexibel').isChecked() === false && (await p.locator('.bw__day input:checked').count()) === 2);
    await p.click('#bw-next'); await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
    await p.click('#bw-next'); await p.waitForSelector('[data-bw-panel="4"]:not([hidden])');
    ok('Zurück/Weiter behält Eingaben (Name steht noch)', /Erika Musterfrau/.test(await p.locator('#bw-review').innerText()));
    await p.click('#bw-next');
    await p.waitForSelector('[data-bw-panel="5"]:not([hidden])');
    ok('Nach Absenden: „das ist noch kein Termin“', /noch kein Termin/.test(await p.locator('#bw-status-title').innerText()));
    const speicher = await p.evaluate(() => ({ s: { ...sessionStorage }, l: { ...localStorage }, c: document.cookie }));
    const roh = JSON.stringify(speicher);
    ok('Speicher enthält nach Absenden keine Personendaten', !/Musterfrau|Erika|1975|1234567/.test(roh), roh.slice(0, 120));
    ok('Nur Kennung + Token in sessionStorage, sonst nichts', Object.keys(speicher.s).join() === 'bw:req' && Object.keys(JSON.parse(speicher.s['bw:req'])).sort().join() === 'id,owner,token' && Object.keys(speicher.l).length === 0 && speicher.c === '');
    ok('Formularfelder geleert', (await p.inputValue('#bw-nachname')) === '');
    await p.waitForFunction(() => /bestätigt/.test(document.getElementById('bw-status-title').textContent), null, { timeout: 40000 });
    const text = await p.locator('#bw-status-text').innerText();
    ok('Status „Termin bestätigt“ mit Datum', /Uhr/.test(text), text);
    ok('Nach Endzustand ist die Kennung gelöscht', (await p.evaluate(() => sessionStorage.getItem('bw:req'))) === null);
    await p.close();
  }

  // 6 · Abgelehnt, Fehler, Limit
  for (const [modus, name, endzustand] of [['rejected', 'Abgelehnt', true], ['error', 'Serverfehler', false], ['limit', 'Rate-Limit', false]]) {
    const p = await oeffne(ctx, `mock=${modus}`);
    await schritt1(p, { anliegen: 'Etwas anderes', versicherung: 'Selbstzahler' });
    await p.locator('#bw-flexibel-row').click();
    await p.click('#bw-next'); await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
    await schritt3(p);
    await p.click('#bw-next');
    if (endzustand) {
      await p.waitForFunction(() => /nicht möglich/.test(document.getElementById('bw-status-title').textContent), null, { timeout: 40000 });
      ok(`${name}: Status angezeigt`, true);
    } else {
      await p.waitForSelector('#bw-banner:not([hidden])');
      ok(`${name}: Banner hat den Fokus`, (await p.evaluate(() => document.activeElement?.id)) === 'bw-banner');
      ok(`${name}: Hinweis, Eingaben bleiben erhalten`, await sichtbar(p, '[data-bw-panel="4"]') && /Erika Musterfrau/.test(await p.locator('#bw-review').innerText()));
    }
    await p.close();
  }

  // 7 · Anderer Fachbereich: keine Anliegen-Karten
  {
    const p = await oeffne(ctx, 'mock=pending&bereich=physiotherapie');
    ok('Physio: keine Anliegen-Karten, Überschrift „Wie sind Sie versichert?“',
      !(await sichtbar(p, '[data-bw="anliegen-block"]')) && /versichert/.test(await p.locator('#bw-h1').innerText()) && (await p.locator('#bw-zahlart-opts label').count()) === 4);
    await p.close();
  }

  // 8 · Datenschutzhinweis, Honeypot, Zaehler
  {
    const p = await oeffne(ctx, 'mock=pending');
    await p.fill('#bw-mitteilung', 'x'.repeat(200));
    ok('Mitteilung ist auf 140 Zeichen begrenzt, Zähler zeigt es', (await p.inputValue('#bw-mitteilung')).length === 140 && /140 von 140 Zeichen/.test(await p.locator('#bw-mitteilung-count').innerText()));
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    await p.locator('#bw-flexibel-row').click();
    await p.click('#bw-next'); await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
    await schritt3(p);
    await p.click('#bw-privacy-link');
    await p.waitForSelector('#bw-dialog[open]');
    ok('Datenschutzhinweise öffnen sich als Dialog (Version v3 mit Anliegen/Verfügbarkeit)', (await p.locator('#bw-dialog-body h3').count()) > 3 && /Anliegen, zeitliche Verfügbarkeit/.test(await p.locator('#bw-dialog-body').innerText()));
    await p.click('#bw-dialog-close');
    const box = await p.locator('#bw-website').boundingBox();
    ok('Honeypot liegt außerhalb des Sichtbereichs', !box || box.x < 0);
    await p.close();
  }

  // 9 · Breiten: kein Ueberlauf, Zielgroessen
  for (const breite of [320, 375, 768]) {
    const c = await browser.newContext({ viewport: { width: breite, height: 800 } });
    const p = await neueSeite(c);
    await p.goto(URL_W('mock=pending'));
    await p.waitForSelector('[data-bw-panel="1"]:not([hidden])');
    const messe = async () => p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    let max = await messe();
    let klein = [];
    const kleinsucher = () => p.evaluate(() => [...document.querySelectorAll('.bw__btn, .bw__input, .bw__opt-row, .bw__day, .bw__switch')]
      .filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).map((e) => e.id || e.className));
    klein.push(...await kleinsucher());
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    max = Math.max(max, await messe()); klein.push(...await kleinsucher());
    await p.locator('.bw__day', { hasText: 'Mo' }).first().click();
    await karte(p, 'Vormittag').click();
    await p.click('#bw-next'); await p.waitForSelector('[data-bw-panel="3"]:not([hidden])');
    max = Math.max(max, await messe()); klein.push(...await kleinsucher());
    await schritt3(p);
    max = Math.max(max, await messe()); klein.push(...await kleinsucher());
    ok(`${breite} px: kein horizontaler Überlauf in Schritt 1–4`, max <= 0, `Überlauf ${max}`);
    ok(`${breite} px: Bedienelemente mindestens 44 px hoch`, klein.length === 0, [...new Set(klein)].join(', '));
    ok(`${breite} px: „Weiter“ steht direkt nach dem Inhalt (keine Seitenleiste davor)`, !(await sichtbar(p, '#bw-side')));
    await c.close();
  }

  // 10 · Einbettung von fremdem Ursprung
  {
    const p = await neueSeite(ctx);
    await p.goto(`http://localhost:${PORT_HOST}/`);
    const frame = p.locator('iframe[title="Terminanfrage"]');
    await frame.waitFor();
    const sb = await frame.getAttribute('sandbox');
    ok('iframe mit sandbox, ohne top-navigation', sb.includes('allow-scripts') && !sb.includes('allow-top-navigation'));
    const inner = p.frameLocator('iframe[title="Terminanfrage"]');
    await inner.locator('#bw-anliegen-opts label').first().waitFor();
    await p.waitForFunction(() => document.querySelector('iframe').style.height !== '520px', null, { timeout: 5000 }).catch(() => {});
    const h = await p.evaluate(() => document.querySelector('iframe').style.height);
    ok('Höhenabgleich per postMessage funktioniert', h !== '520px' && /px$/.test(h), h);
    const zugriff = await p.evaluate(() => { try { return document.querySelector('iframe').contentDocument === null ? 'gesperrt' : 'offen'; } catch { return 'gesperrt'; } });
    ok('Host-Seite kann Formularinhalt nicht lesen (anderer Ursprung)', zugriff === 'gesperrt');
    await p.close();
  }

  // 11 · Unter der echten Widget-CSP aus vercel.json: kompletter Ablauf ohne Verletzung
  {
    const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const regel = v.headers.find((r) => r.source === '/widget/booking-widget.html' && r.has);
    const csp = regel.headers.find((h) => h.key === 'Content-Security-Policy').value;
    const p = await neueSeite(ctx);
    const verletzungen = [];
    p.on('console', (m) => { if (/Content Security Policy|violates/i.test(m.text())) verletzungen.push(m.text()); });
    await p.route('**/widget/booking-widget.html*', async (route) => {
      const res = await route.fetch();
      await route.fulfill({ response: res, headers: { ...res.headers(), 'content-security-policy': csp } });
    });
    await p.goto(URL_W('mock=pending'));
    await p.waitForSelector('[data-bw-panel="1"]:not([hidden])');
    await schritt1(p, { anliegen: 'Nagelspange', versicherung: 'Gesetzlich' });
    await schritt2(p);
    await schritt3(p);
    await p.click('#bw-privacy-link');
    await p.click('#bw-dialog-close');
    await p.click('#bw-next');
    await p.waitForSelector('[data-bw-panel="5"]:not([hidden])');
    ok('Unter der echten Widget-CSP: kompletter Ablauf ohne Verletzung', verletzungen.length === 0, verletzungen[0] || '');
    await p.close();
  }

  // 12 · Header-Regeln in vercel.json
  {
    const v = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const regeln = v.headers.filter((r) => r.source === '/widget/booking-widget.html');
    const frei = regeln.find((r) => r.has?.some((h) => h.value === 'praxura.de'));
    const zu = regeln.find((r) => r.missing?.some((h) => h.value === 'praxura.de'));
    const val = (r, k) => r?.headers.find((h) => h.key === k)?.value || '';
    ok('Host praxura.de: frame-ancestors https:, kein X-Frame-Options', /frame-ancestors https:;/.test(val(frei, 'Content-Security-Policy')) && !val(frei, 'X-Frame-Options'));
    ok('Andere Hosts: nur eigener Ursprung', /frame-ancestors 'self'/.test(val(zu, 'Content-Security-Policy')) && val(zu, 'X-Frame-Options') === 'SAMEORIGIN');
    ok('Widget-CSP ohne unsafe-inline und ohne Drittanbieter', !/unsafe-inline|stripe|sentry|google|wistia/.test(val(frei, 'Content-Security-Policy')));
    const global = v.headers[0];
    ok('Globale Regel nimmt die Widget-Seite aus', /\(\?!widget\/booking-widget/.test(global.source));
    ok('Globales frame-ancestors bleibt \'self\'', /frame-ancestors 'self'/.test(val(global, 'Content-Security-Policy')) && val(global, 'X-Frame-Options') === 'SAMEORIGIN');
  }
} finally {
  await browser.close();
  widgetServer.close();
  hostServer.close();
}

console.log('\n══ WIDGET: TERMIN-ANFRAGE (4 Schritte, Mock, Fremd-Ursprung, Header)');
let schlecht = 0;
for (const r of ergebnisse) {
  if (r.ok) console.log(`   ✓ ${r.name}${r.detail ? '  — ' + r.detail : ''}`);
  else { schlecht++; console.log(`   ✗ ${r.name}\n       ${r.detail}`); }
}
if (konsolenfehler.length) {
  schlecht++;
  console.log('\n   Konsolenfehler:');
  [...new Set(konsolenfehler)].forEach((f) => console.log('     · ' + f.slice(0, 200)));
}
console.log(`\n   ${ergebnisse.length - ergebnisse.filter((r) => !r.ok).length}/${ergebnisse.length} bestanden`);
process.exit(schlecht ? 1 : 0);
