// Der Seitenbereich rechts — ein Aufbau, zwei Zustaende (Ops #308).
//
// Hintergrund: derselbe Kasten (#bkActionModal) wurde von zwei Zeichnern
// befuellt. Der zweite zeichnete nichts, er versteckte vierzehn von Hand
// gepflegte Block-Ids. Wer einen Block ergaenzte und die Liste vergass, bekam
// ihn im falschen Zustand zu sehen; wer einen umbenannte, bekam ihn nie wieder
// weg. Ergebnis: „Das rechte Termin-Panel sieht bei jedem Patienten anders aus."
//
// Diese Tests halten die Zusage fest: die INFORMATIONSBLOECKE sind in beiden
// Zustaenden dieselben, nur die HANDLUNGEN haengen am Termin. Faellt ein Block
// aus PANEL_BLOECKE kuenftig wieder in die Aktionsliste, faellt hier ein Test.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PANEL_BLOECKE, TERMIN_AKTIONEN, setzeAktionsSichtbarkeit,
  zeichneTerminkarte, zeichneSitzungenLeer, zeigeSitzungenArbeit,
} from './termin-panel.js';

const WEITERE = ['bkDetailService', 'bkDetailDateTime', 'bkDetailTherapist', 'bkDetailDuration',
  'bkRxSessionsLeer', 'bkRxSessionsLeerText', 'bkRxSessionsLeerBtn', 'bkRxSessionsBadge',
  'bkRxSerieBtn', 'bkRxLeistungenBtn', 'bkRxSitzungTabs', 'bkRxUnvergebeneBox', 'bkRxVergebeneBox'];

/** Minimales DOM: nur `hidden`, `dataset`, Text und ein Klickziel je Id. */
function baueDom(vorbelegt = {}) {
  const kartei = {};
  for (const id of [...PANEL_BLOECKE, ...TERMIN_AKTIONEN, ...WEITERE]) {
    kartei[id] = {
      id, hidden: !!vorbelegt[id], dataset: {}, style: {},
      textContent: '', innerHTML: '', onclick: null,
      querySelector: () => null,
    };
  }
  globalThis.document = { getElementById: (id) => kartei[id] || null };
  return kartei;
}

// ── Die Zusage: gleiche Bloecke in beiden Zustaenden ──────────────────────

test('Informationsbloecke bleiben stehen — mit Termin wie ohne', () => {
  const dom = baueDom();

  setzeAktionsSichtbarkeit(false);          // Patient ohne kommenden Termin
  const ohne = PANEL_BLOECKE.filter(id => dom[id].hidden);
  assert.deepEqual(ohne, [], 'kein Informationsblock darf wegen fehlendem Termin schliessen');

  setzeAktionsSichtbarkeit(true);           // Termin angeklickt
  const mit = PANEL_BLOECKE.filter(id => dom[id].hidden);
  assert.deepEqual(mit, [], 'und im Terminmodus erst recht nicht');
});

test('kein Block steht in beiden Listen — sonst widersprechen sie sich', () => {
  const doppelt = PANEL_BLOECKE.filter(id => TERMIN_AKTIONEN.includes(id));
  assert.deepEqual(doppelt, []);
});

test('ohne Termin schliessen die terminbezogenen Handlungen', () => {
  const dom = baueDom();
  setzeAktionsSichtbarkeit(false);
  for (const id of TERMIN_AKTIONEN) {
    assert.equal(dom[id].hidden, true, `${id} muss ohne Termin zu sein`);
    assert.equal(dom[id].dataset.ohneTermin, '1', `${id} muss als „von mir zugemacht" markiert sein`);
  }
});

test('mit Termin gehen genau diese Handlungen wieder auf', () => {
  const dom = baueDom();
  setzeAktionsSichtbarkeit(false);
  setzeAktionsSichtbarkeit(true);
  for (const id of TERMIN_AKTIONEN) {
    assert.equal(dom[id].hidden, false, `${id} muss mit Termin wieder offen sein`);
    assert.equal(dom[id].dataset.ohneTermin, undefined, `${id} darf die Markierung nicht behalten`);
  }
});

test('was aus eigenem Grund zu war, bleibt zu', () => {
  // bkActionHbInfo ist ohne Hausbesuch zu. Der Patientenmodus darf das nicht
  // uebernehmen und beim Zurueckschalten einen Hausbesuch behaupten.
  const dom = baueDom({ bkActionHbInfo: true });
  setzeAktionsSichtbarkeit(false);
  assert.equal(dom.bkActionHbInfo.dataset.ohneTermin, undefined);
  setzeAktionsSichtbarkeit(true);
  assert.equal(dom.bkActionHbInfo.hidden, true);
});

// ── Terminkarte oben ──────────────────────────────────────────────────────

test('ohne Termin nennt die Karte den Patienten statt eines fremden Termins', () => {
  const dom = baueDom();
  zeichneTerminkarte({ booking: null, patientName: 'Max Muster' });
  assert.equal(dom.bkDetailService.textContent, 'Kein kommender Termin');
  assert.equal(dom.bkDetailDateTime.textContent, 'Max Muster');
  assert.equal(dom.bkDetailDuration.textContent, '');
});

test('mit Termin steht Leistung, Datum und Dauer da', () => {
  const dom = baueDom();
  zeichneTerminkarte({
    booking: {
      start_time: '2026-09-18T09:00:00Z', end_time: '2026-09-18T09:30:00Z',
      services: { title: 'Podologische Behandlung' }, employee_name: 'Anna',
    },
    patientName: 'Max Muster',
  });
  assert.equal(dom.bkDetailService.textContent, 'Podologische Behandlung');
  assert.notEqual(dom.bkDetailDateTime.textContent, '');
  assert.equal(dom.bkDetailDuration.textContent, '30 Min.');
  assert.match(dom.bkDetailTherapist.textContent, /Anna/);
});

// ── Einheitenblock: Grund statt Verschwinden ──────────────────────────────

test('Podologie bekommt einen Hinweis MIT Weg — ein Hinweis ohne Weg waere eine Sackgasse', () => {
  const dom = baueDom();
  let gesprungen = 0;
  zeichneSitzungenLeer('podologie', { aufBehandlungen: () => { gesprungen++; } });

  assert.equal(dom.bkRxSessionsPanel.hidden, false, 'der Block darf nicht verschwinden');
  assert.equal(dom.bkRxSessionsLeer.hidden, false);
  assert.match(dom.bkRxSessionsLeerText.textContent, /Einheiten-Hauptbuch/);
  assert.equal(dom.bkRxSessionsLeerBtn.hidden, false);
  dom.bkRxSessionsLeerBtn.onclick();
  assert.equal(gesprungen, 1);
  // Die bedienbaren Teile haben im Leerzustand nichts zu bedienen.
  assert.equal(dom.bkRxUnvergebeneBox.hidden, true);
  assert.equal(dom.bkRxSitzungTabs.hidden, true);
});

test('die uebrigen vier Gruende nennen den Grund, ohne einen Knopf anzubieten', () => {
  for (const art of ['keinTermin', 'keineVo', 'ladefehler', 'keineSitzungen']) {
    const dom = baueDom();
    zeichneSitzungenLeer(art);
    assert.equal(dom.bkRxSessionsPanel.hidden, false, art);
    assert.notEqual(dom.bkRxSessionsLeerText.textContent, '', `${art} braucht einen Text`);
    assert.equal(dom.bkRxSessionsLeerBtn.hidden, true, `${art} hat keinen Weg anzubieten`);
  }
});

test('ein unbekannter Uebersetzer-Schluessel faellt auf Deutsch zurueck, nicht auf den Schluessel', () => {
  const dom = baueDom();
  zeichneSitzungenLeer('keineVo', { t: (k) => k });   // t() gibt bei Unbekanntem den Schluessel
  assert.match(dom.bkRxSessionsLeerText.textContent, /keine aktive Verordnung/);
});

test('der Uebersetzer schlaegt den deutschen Rueckfall, wenn er etwas kennt', () => {
  const dom = baueDom();
  zeichneSitzungenLeer('keineVo', { t: () => 'No active prescription on file.' });
  assert.equal(dom.bkRxSessionsLeerText.textContent, 'No active prescription on file.');
});

test('zurueck in den Arbeitszustand — aber Serien- und Leistungsknopf bleiben fremdbestimmt', () => {
  const dom = baueDom();
  zeichneSitzungenLeer('keineVo');
  zeigeSitzungenArbeit();

  assert.equal(dom.bkRxSessionsLeer.hidden, true);
  assert.equal(dom.bkRxUnvergebeneBox.hidden, false);
  assert.equal(dom.bkRxSitzungTabs.hidden, false);
  assert.equal(dom.bkRxSessionsBadge.hidden, false);
  // Ueber diese beiden entscheidet loadRxSessionsPanel nach eigenen Regeln
  // (weniger als zwei offene Einheiten / nicht Podologie) — hier nicht anfassen.
  assert.equal(dom.bkRxSerieBtn.hidden, true);
  assert.equal(dom.bkRxLeistungenBtn.hidden, true);
});
