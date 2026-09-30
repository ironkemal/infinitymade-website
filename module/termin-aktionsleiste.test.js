// Termin-Aktionen (Konsey 30.09.2026): hoechstens sechs sichtbare Handlungen, der Rest hinter „…".
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SICHTBARE_AKTIONEN, MENUE_AKTIONEN, verordnungsZiel } from './termin-aktionsleiste.js';
import { TERMIN_AKTIONEN, setzeAktionsSichtbarkeit } from './termin-panel.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'dashboard.html'), 'utf8');

/** Innerer Text von <div id="…">…</div> (verschachtelte divs mitgezaehlt). */
function block(id) {
  const start = html.indexOf(`id="${id}"`);
  assert.ok(start > 0, `${id} fehlt in dashboard.html`);
  const open = html.lastIndexOf('<div', start);
  let tiefe = 0;
  const re = /<\/?div\b/g;
  re.lastIndex = open;
  let m;
  while ((m = re.exec(html))) {
    tiefe += m[0] === '<div' ? 1 : -1;
    if (tiefe === 0) return html.slice(open, m.index);
  }
  throw new Error(`${id} nicht geschlossen`);
}

test('Aktionsleiste: genau die sechs Zellen + Menue-Knopf, keine weiteren Knoepfe daneben', () => {
  const leiste = block('bkAktionsleiste');
  const ohneMenue = leiste.replace(block('bkAktionsMenue'), '');
  // Knoepfe, die NICHT im No-Show-Block stehen, sind die Handlungen der Leiste.
  const ohneNoShow = ohneMenue.replace(block('bkActionNoShowGroup'), '');
  const knoepfe = [...ohneNoShow.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(knoepfe, ['bkActionVeroBtn', 'bkOpenPatientBtn', 'bkActionFolgeBtn', 'bkActionEditBtn', 'bkActionMehrBtn']);
  assert.ok(ohneMenue.includes('id="bkActionNoShowGroup"'));
  // Sechs sichtbare: Statusknopf (eigene Gruppe oben) + die fuenf oben.
  assert.equal(SICHTBARE_AKTIONEN.length, 5);
  for (const id of SICHTBARE_AKTIONEN) assert.ok(html.includes(`id="${id}"`), id);
});

test('Menue: Absagen, Terminzettel, Adresse kopieren, Fussbefund — und nur diese', () => {
  const menue = block('bkAktionsMenue');
  const ids = [...menue.matchAll(/<button\b[^>]*\bid="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(ids, MENUE_AKTIONEN);
});

test('Absagen heisst Absagen; ein dauerhaftes Loeschen gibt es nicht', () => {
  assert.match(html, /id="bkActionDeleteBtn"[^>]*>Absagen</);
  assert.doesNotMatch(block('bkAktionsMenue'), />\s*(Termin )?löschen\s*</i);
});

test('Statusknopf-Gruppen bleiben oben, vor der Leiste', () => {
  const leiste = html.indexOf('id="bkAktionsleiste"');
  for (const id of ['bkActionFahrtStartedGroup', 'bkActionArrivedGroup', 'bkActionStartTerminGroup', 'bkActionFahrtEndGroup']) {
    const pos = html.indexOf(`id="${id}"`);
    assert.ok(pos > 0 && pos < leiste, id);
  }
});

test('alle alten Knopf-Ids leben weiter (dashboard.js verdrahtet sie ueber getElementById)', () => {
  for (const id of ['bkActionEditBtn', 'bkActionDeleteBtn', 'bkActionNoShowBtn', 'bkActionAusfallBtn',
    'bkActionKorrekturBtn', 'bkActionTerminzettelBtn', 'bkActionFussbefundBtn', 'bkOpenPatientBtn', 'bkActionHbCopyBtn',
    'bkActionNoShowHint']) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${id}: genau einmal`);
  }
});

test('TERMIN_AKTIONEN verweist nur auf vorhandene Elemente', () => {
  for (const id of TERMIN_AKTIONEN) assert.ok(html.includes(`id="${id}"`), id);
});

test('Verordnung: vorhandener Block → springen, sonst neu anlegen', () => {
  assert.deepEqual(verordnungsZiel([{ id: 'a', sichtbar: false }, { id: 'b', sichtbar: true }]), { art: 'springen', id: 'b' });
  assert.deepEqual(verordnungsZiel([{ id: 'a', sichtbar: false }]), { art: 'anlegen' });
  assert.deepEqual(verordnungsZiel([]), { art: 'anlegen' });
  assert.deepEqual(verordnungsZiel(undefined), { art: 'anlegen' });
});

test('Folgetermin bleibt ausserhalb der Podologie zu, in der Podologie folgt er dem Termin', () => {
  const knoten = (id, hidden) => ({ id, hidden, dataset: {} });
  const kartei = Object.fromEntries(TERMIN_AKTIONEN.map(id => [id, knoten(id, id === 'bkActionFolgeBtn')]));
  globalThis.document = { getElementById: (id) => kartei[id] || null };
  try {
    setzeAktionsSichtbarkeit(true, false);
    assert.equal(kartei.bkActionFolgeBtn.hidden, true, 'Physio: bleibt zu');
    setzeAktionsSichtbarkeit(true, true);
    assert.equal(kartei.bkActionFolgeBtn.hidden, false, 'Podologie mit Termin: sichtbar');
    setzeAktionsSichtbarkeit(false, true);
    assert.equal(kartei.bkActionFolgeBtn.hidden, true, 'Patient ohne Termin: zu');
    setzeAktionsSichtbarkeit(true, true);
    assert.equal(kartei.bkActionFolgeBtn.hidden, false, 'wieder mit Termin: wieder da');
  } finally {
    delete globalThis.document;
  }
});
