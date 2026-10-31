import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FAX_MUSTER_RE,
  pruefeFaxMusterClient,
  FAX_HINWEIS_TEXT,
} from './fax-einstellungen.js';

test('pruefeFaxMusterClient: leere Eingaben ergeben null (Spalte leeren)', () => {
  assert.deepEqual(pruefeFaxMusterClient(''), { ok: true, muster: null });
  assert.deepEqual(pruefeFaxMusterClient('   '), { ok: true, muster: null });
  assert.deepEqual(pruefeFaxMusterClient(null), { ok: true, muster: null });
  assert.deepEqual(pruefeFaxMusterClient(undefined), { ok: true, muster: null });
});

test('pruefeFaxMusterClient: gültige Muster werden formatiert übernommen', () => {
  assert.deepEqual(pruefeFaxMusterClient('{nummer}@fax.ihr-anbieter.de'), {
    ok: true,
    muster: '{nummer}@fax.ihr-anbieter.de',
  });
  assert.deepEqual(pruefeFaxMusterClient('  {nummer}@fax.de  '), {
    ok: true,
    muster: '{nummer}@fax.de',
  });
  assert.deepEqual(pruefeFaxMusterClient('fax-{nummer}@provider.com'), {
    ok: true,
    muster: 'fax-{nummer}@provider.com',
  });
  assert.deepEqual(pruefeFaxMusterClient('0049{nummer}@mail.de'), {
    ok: true,
    muster: '0049{nummer}@mail.de',
  });
});

test('pruefeFaxMusterClient: fehlerhafte Muster werden mit deutscher Fehlermeldung abgewiesen', () => {
  // Kein {nummer}
  const o1 = pruefeFaxMusterClient('info@fax.de');
  assert.equal(o1.ok, false);
  assert.match(o1.fehler, /Platzhalter \{nummer\}/);

  // Mehr als ein {nummer}
  const o2 = pruefeFaxMusterClient('{nummer}.{nummer}@fax.de');
  assert.equal(o2.ok, false);
  assert.match(o2.fehler, /genau einmal/);

  // Ungültige Zeichen / Format
  const o3 = pruefeFaxMusterClient('{nummer}@fax.de, test@test.de');
  assert.equal(o3.ok, false);
  assert.match(o3.fehler, /Ungültiges/);

  const o4 = pruefeFaxMusterClient('{nummer} @fax.de');
  assert.equal(o4.ok, false);
  assert.match(o4.fehler, /Ungültiges/);

  // Fehlende Domain
  const o5 = pruefeFaxMusterClient('{nummer}@');
  assert.equal(o5.ok, false);
  assert.match(o5.fehler, /Ungültiges/);

  // Länger als 200 Zeichen
  const lang = '{nummer}@' + 'x'.repeat(200) + '.de';
  const o6 = pruefeFaxMusterClient(lang);
  assert.equal(o6.ok, false);
  assert.match(o6.fehler, /maximal 200/);
});

test('FAX_HINWEIS_TEXT und FAX_MUSTER_RE sind definiert', () => {
  assert.ok(FAX_HINWEIS_TEXT.includes('{nummer}@fax.ihr-anbieter.de'));
  assert.ok(FAX_MUSTER_RE instanceof RegExp);
});
