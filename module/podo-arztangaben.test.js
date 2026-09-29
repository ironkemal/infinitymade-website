import { test } from 'node:test';
import assert from 'node:assert/strict';
import { behandlungGesperrt, arztangabenLage, BEHANDLUNG_GESPERRT_TEXT } from './podo-arztangaben.js';
import { fehlendeArztangaben } from '../api-backend/billing/utils/arztangaben.js';

const ok = { therapie_bereich: 'podo', doctor_lanr: '123456601', unterschrift_vorhanden: true };

test('vollstaendig -> nicht gesperrt', () => {
  assert.deepEqual(behandlungGesperrt(ok), { gesperrt: false, text: '' });
});
test('LANR fehlt -> gesperrt mit Vertragstext', () => {
  for (const l of ['', null, undefined, ' ', '999999999']) {
    const r = behandlungGesperrt({ ...ok, doctor_lanr: l });
    assert.equal(r.gesperrt, true);
    assert.equal(r.text, BEHANDLUNG_GESPERRT_TEXT);
  }
});
test('Unterschrift fehlt -> gesperrt', () => {
  for (const u of [false, null, undefined]) assert.equal(behandlungGesperrt({ ...ok, unterschrift_vorhanden: u }).gesperrt, true);
});
test('BSNR fehlt sperrt NICHT', () => {
  assert.equal(behandlungGesperrt({ ...ok, doctor_bsnr: '' }).gesperrt, false);
});
test('Physio/Ergo/Logo und leer: nie gesperrt', () => {
  for (const b of ['physio', 'ergo', 'logo', null, undefined]) {
    assert.equal(behandlungGesperrt({ therapie_bereich: b, doctor_lanr: '', unterschrift_vorhanden: false }).gesperrt, false);
  }
  assert.equal(behandlungGesperrt(null).gesperrt, false);
});
test('Entscheidung stimmt mit dem Server-Riegel ueberein', () => {
  const faelle = [ok, { ...ok, doctor_lanr: '' }, { ...ok, unterschrift_vorhanden: false }, { therapie_bereich: 'podo' }, { ...ok, doctor_lanr: '999999999' }];
  for (const f of faelle) assert.equal(behandlungGesperrt(f).gesperrt, fehlendeArztangaben(f).length > 0);
});
test('arztangabenLage', () => {
  assert.deepEqual(arztangabenLage({ lanr: '123456601', unterschrift: true }), { lanrFehlt: false, unterschriftFehlt: false });
  assert.deepEqual(arztangabenLage({}), { lanrFehlt: true, unterschriftFehlt: true });
});

import { podoArztHinweise, SPEICHERN_HINWEIS, BSNR_HINWEIS } from './podo-arztangaben.js';
import { LANR_PRUEFZIFFER_HINWEIS } from './lanr-pruefung.js';

test('podoArztHinweise: nicht podo -> leer', () => {
  assert.deepEqual(podoArztHinweise({ bereich: 'physio', lanr: '', bsnr: '', unterschrift: false }), { hinweise: [], satz: '' });
});
test('podoArztHinweise: LANR + Unterschrift fehlen -> Satz, BSNR-Hinweis', () => {
  const r = podoArztHinweise({ bereich: 'podo', lanr: '', bsnr: '', unterschrift: false });
  assert.equal(r.satz, SPEICHERN_HINWEIS);
  assert.deepEqual(r.hinweise, [BSNR_HINWEIS]);
});
test('podoArztHinweise: nur Pruefziffer falsch -> Warnung ohne Satz', () => {
  const r = podoArztHinweise({ bereich: 'podo', lanr: '123456701', bsnr: '123456789', unterschrift: true });
  assert.equal(r.satz, '');
  assert.deepEqual(r.hinweise, [LANR_PRUEFZIFFER_HINWEIS]);
});
test('podoArztHinweise: alles da -> nichts', () => {
  assert.deepEqual(podoArztHinweise({ bereich: 'podo', lanr: '123456601', bsnr: '123456789', unterschrift: true }), { hinweise: [], satz: '' });
});
