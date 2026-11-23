/** V3.03: Emoji-Entfernung (seit 23.11.2026 in beiden Designs) (module/ohne-emoji.js).
 *  Synthetische App ohne Login (redesign-harness). Hart: Exit 1 bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
process.env.REDESIGN_PORT ||= '18303';
const server = await starteServer(); const browser = await starteBrowser();
const FUEHREND = /^\s*[\u{1F000}-\u{1FAFF}⚠⚡⏳⏰⌛⌚✏✎✉✍⭐✔✅❌⚕❗❓☎☀✨❤⛔]/u;
const oeffne = (design) => oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, rolle: 'owner', design });
const setze = async (page) => page.evaluate(() => {
  const h = document.createElement('div'); h.id = 'v303'; h.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#fff;color:#000';
  h.innerHTML = '<p id="a">⚠️ Zertifikat läuft ab</p><p id="b">Anna 🌴 Beispiel</p><input id="c" value="⚠️ Notiz"><p id="d" data-px-emoji-roh>⚠️ roh</p>';
  document.body.appendChild(h);
});
const lesen = (page) => page.evaluate(() => ({
  a: document.getElementById('a')?.textContent, b: document.getElementById('b')?.textContent, c: document.getElementById('c')?.value, d: document.getElementById('d')?.textContent,
  wrap: document.querySelectorAll('.px-sym-wrap').length, wrapA: document.querySelectorAll('#a .px-sym-wrap').length,
  alleText: document.getElementById('v303')?.textContent,
}));
const wechsel = async (page, d) => { await page.evaluate((x) => { document.documentElement.dataset.design = x; }, d); await ruhe(page, 400); };
const erg = {};
try {
  const n = await oeffne('neu'); const { page } = n;
  await ruhe(page, 800);
  erg.echteFuehrendeEmojisFixtureNeu = await page.evaluate((re) => {
    const r = new RegExp(re.s, re.f); let c = 0;
    const g = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (g.nextNode()) { if (g.currentNode.parentElement?.closest('script,style')) continue; if (r.test(g.currentNode.nodeValue)) c++; }
    return c;
  }, { s: FUEHREND.source, f: FUEHREND.flags });
  await setze(page); await ruhe(page, 300);
  const neu = await lesen(page);
  assert.equal(neu.wrapA, 1, '(i) führendes ⚠️ → .px-sym-wrap');
  assert.equal(neu.a, ' Zertifikat läuft ab', '(i) Text bleibt');
  assert.equal(neu.b, 'Anna 🌴 Beispiel', '(i) Emoji mitten im Text bleibt');
  assert.equal(neu.c, '⚠️ Notiz', '(i) Eingabewert bleibt');
  assert.equal(neu.d, '⚠️ roh', '(i) data-px-emoji-roh bleibt');
  // Seit 23.11.2026 (Kemal, redesign/HANDWERK-LOGIK.md Regel 4): auch im alten Design ohne Emojis.
  await wechsel(page, 'alt');
  const alt = await lesen(page);
  assert.equal(alt.wrapA, 1, '(ii) alt: bleibt ersetzt');
  assert.equal(alt.a, ' Zertifikat läuft ab', '(ii) alt: Text bleibt');
  assert.deepEqual(n.protokoll.seitenfehler, [], 'keine Seitenfehler');
  await n.kontext.close();
  erg.neuAlt = true;

  const a = await oeffne('alt'); await ruhe(a.page, 800);
  await setze(a.page); await ruhe(a.page, 300);
  const nur = await lesen(a.page);
  assert.equal(nur.wrapA, 1, '(iv) alt von Anfang an: führendes ⚠️ ersetzt');
  assert.equal(nur.b, 'Anna 🌴 Beispiel', '(iv) alt: Emoji mitten im Text bleibt');
  assert.equal(nur.c, '⚠️ Notiz', '(iv) alt: Eingabewert bleibt');
  assert.deepEqual(a.protokoll.seitenfehler, [], 'keine Seitenfehler');
  await a.kontext.close();
  console.log(JSON.stringify({ ok: true, ...erg }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, fehler: e.message, ...erg }));
  process.exitCode = 1;
} finally { await browser.close(); await server.close?.(); }
process.exit(process.exitCode ?? 0);
