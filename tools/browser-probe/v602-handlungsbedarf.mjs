/** V6.F02: Karte „Verordnungen – Handlungsbedarf“ der Startansicht (nur Inhaberin, nur Neu-Design).
 *  Synthetische App ohne Login (redesign-harness), nur lesend. Hart: process.exit(1) bei Abweichung. Eine JSON-Zeile. */
import assert from 'node:assert/strict';
import { oeffneDashboard, starteBrowser, starteServer, ruhe } from '../redesign-harness.mjs';
const server = await starteServer(); const browser = await starteBrowser();
const ORDER = ['Beginn verpasst', 'Pause droht', 'Pause überschritten', 'Beginn ohne Termin', 'Ohne Folgetermin'];
const TABELLEN = ['prescriptions', 'podologie_behandlungen', 'bookings', 'prescription_sessions', 'leads'];
const lauf = async (opt, fn) => {
  const { page, kontext, protokoll } = await oeffneDashboard(browser, { basis: server.basis, theme: 'hell', szenario: 'voll', breite: 1440, ...opt });
  await page.waitForFunction(() => !document.querySelector('.px-k-vo')?.textContent.includes('wird geladen'), null, { timeout: 15000 }).catch(() => {});
  await ruhe(page, 600);
  try {
    const stand = await page.evaluate(() => ({
      karte: document.querySelectorAll('.px-handlungsbedarf').length, alles: !!document.querySelector('.px-k-vo .px-karte-zustand--ruhig'),
      kachel: [...document.querySelectorAll('.px-handlungsbedarf .px-mini')].map(m => ({ lbl: m.querySelector('.lbl')?.textContent, zahl: m.querySelector('.zahl')?.textContent, klasse: m.className })),
      voText: document.querySelector('.px-k-vo')?.textContent || '', next: !!document.querySelector('.px-k-next'), liste: !!document.querySelector('.px-k-list'),
      voAlt: (() => { const e = document.getElementById('physioRezKpi'); return e ? { sichtbar: !!(e.offsetWidth || e.offsetHeight || e.getClientRects().length), inSlot: !!e.closest('[data-start-slot="vo"]'), eltern: e.parentElement?.id } : null; })(),
      ueberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      aussen: [...document.querySelectorAll('.px-handlungsbedarf .px-mini, .px-k-vo')].filter(e => { const r = e.getBoundingClientRect(); return r.right > innerWidth + 0.5 || r.left < -0.5; }).length,
      bedarfInDom: !!document.querySelector('[data-start-insel="bedarf"]') }));
    const extra = fn ? await fn(page) : null;
    const reads = await page.evaluate(() => (window.__rsFixture?.reads || []).filter(t => ['prescriptions', 'podologie_behandlungen', 'bookings', 'prescription_sessions', 'leads'].includes(t)));
    const zaehle = {}; for (const t of reads) zaehle[t] = (zaehle[t] || 0) + 1;
    const writes = await page.evaluate(() => (window.__rsFixture?.writes || []).length);
    return { stand, extra, reads: zaehle, writes, fehler: protokoll.seitenfehler };
  } finally { await kontext.close(); }
};
const erg = {};
try {
  const neu = await lauf({ design: 'neu', rolle: 'owner' }, async (page) => {
    // d) Designwechsel neu -> alt im selben Dokument
    await page.evaluate(() => { document.documentElement.dataset.design = 'alt'; }); await ruhe(page, 600);
    return page.evaluate(() => { const e = document.getElementById('physioRezKpi'); return { eltern: e?.parentElement?.id, ersetzt: e?.hasAttribute('data-px-start-ersetzt'),
      sichtbar: !!(e && (e.offsetWidth || e.offsetHeight || e.getClientRects().length)), start: document.getElementById('pxStartseite')?.hidden }; });
  });
  const altLauf = await lauf({ design: 'alt', rolle: 'owner' });
  // a)
  assert.equal(neu.stand.karte + (neu.stand.alles ? 1 : 0) >= 1, true, 'a) Karte da');
  if (neu.stand.karte) {
    assert.deepEqual(neu.stand.kachel.map(k => k.lbl), ORDER, 'a) Reihenfolge der fünf Kacheln');
    for (const k of neu.stand.kachel) {
      if (k.klasse.includes('px-unbekannt')) assert.equal(k.zahl, '–', 'a) unbekannt = „–“: ' + k.lbl);
      if (k.zahl === '0') assert.ok(k.klasse.includes('px-null'), 'a) 0 nur grau: ' + k.lbl);
    }
  } else assert.match(neu.stand.voText, /Alles im Plan/);
  assert.equal(neu.stand.voAlt.sichtbar, false, 'a) #physioRezKpi im Neu-Design unsichtbar'); assert.equal(neu.stand.voAlt.inSlot, false, 'a) nicht im Slot');
  assert.ok(neu.stand.kachel.some(k => k.zahl === '–') ? /Teilweise ungeklärt/.test(neu.stand.voText) : true, 'a) Hinweis bei Unbekanntem');
  assert.ok(neu.stand.next && neu.stand.liste, 'a) andere Karten da');
  // d)
  assert.deepEqual({ eltern: neu.extra.eltern, ersetzt: neu.extra.ersetzt, start: neu.extra.start }, { eltern: 'panel-overview', ersetzt: false, start: true }, 'd) Altknoten an Originalstelle, Neu-Start aus');
  assert.equal(neu.extra.sichtbar, altLauf.stand.voAlt.sichtbar, 'd) Sichtbarkeit wie im Alt-Design');
  assert.equal(altLauf.stand.karte, 0, 'Alt: keine Karte');
  // b)
  const fehl = await lauf({ design: 'neu', rolle: 'owner', szenario: 'fehler' });
  assert.ok(fehl.stand.karte >= 1 || /nicht verfügbar|ungeklärt/.test(fehl.stand.voText), 'b) Fehler/ungeklärt sichtbar');
  assert.ok(!fehl.stand.kachel.some(k => k.zahl === '0'), 'b) keine 0 bei Fehler');
  assert.ok(fehl.stand.next && fehl.stand.liste, 'b) Als Nächstes und Termine heute bleiben');
  // c)
  const maNeu = await lauf({ design: 'neu', rolle: 'employee' }), maAlt = await lauf({ design: 'alt', rolle: 'employee' });
  assert.equal(maNeu.stand.karte, 0, 'c) keine Karte'); assert.equal(maNeu.stand.bedarfInDom, false, 'c) keine Insel');
  assert.equal(maNeu.stand.voAlt?.inSlot, true, 'c) Altknoten wie bisher im Slot');
  // Neu liest je Tabelle höchstens so oft wie Alt; weniger nur bei Tabellen des Aktivitätsfeeds, den das neue Design
  // nicht lädt (V6.F05, E8). prescriptions darf sich nicht ändern (keine neue Handlungsbedarf-Abfrage für Mitarbeiterin).
  const FEED = new Set(['bookings', 'fahrten', 'invoices', 'leads', 'patient_notes']);
  for (const t of new Set([...Object.keys(maNeu.reads), ...Object.keys(maAlt.reads)])) {
    const n = maNeu.reads[t] || 0, a = maAlt.reads[t] || 0;
    assert.ok(n <= a, `c) Mitarbeiterin neu liest ${t} nicht öfter als alt (${n} > ${a})`);
    if (n < a) assert.ok(FEED.has(t), `c) weniger Reads nur bei Feed-Tabellen (${t})`);
  }
  assert.equal(maNeu.reads.prescriptions || 0, maAlt.reads.prescriptions || 0, 'c) prescriptions unverändert');
  // e)
  const klein = await lauf({ design: 'neu', rolle: 'owner', breite: 390 });
  assert.ok(klein.stand.ueberlauf <= 0, 'e) kein Dokument-Überlauf'); assert.equal(klein.stand.aussen, 0, 'e) Karte vollständig im Viewport');
  assert.ok(klein.stand.karte ? klein.stand.kachel.length === 5 : klein.stand.alles, 'e) fünf Kacheln oder Alles im Plan');
  // f)
  for (const [n, l] of Object.entries({ neu, fehl, maNeu, klein })) { assert.deepEqual(l.fehler, [], `f) ${n}: 0 Seitenfehler`); assert.equal(l.writes, 0, `f) ${n}: 0 Schreibversuche`); }
  erg.ok = true; erg.kacheln = neu.stand.kachel.map(k => `${k.lbl}=${k.zahl}`); erg.ownerReads = neu.reads; erg.maReads = maNeu.reads; erg.maAltReads = maAlt.reads;
  console.log(JSON.stringify(erg));
} catch (e) { console.error(JSON.stringify({ ok: false, fehler: String(e.message).slice(0, 400) })); process.exitCode = 1; }
finally { await browser.close(); await server.stop(); }
