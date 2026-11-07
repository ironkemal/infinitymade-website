import test from 'node:test';
import assert from 'node:assert/strict';
import { entlassFelderAusFormular, entlassFeldHtml, merkmalZuAuswahl } from './rezept-entlass.js';
import { entlassFelderAusRezept } from '../api-backend/lib/rezept-felder.js';

const an = { schemaAktiv: true };

test('Schema aus: keine Felder, kein HTML (Alt-Verhalten)', () => {
  assert.deepEqual(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-11-01' }), { ok: true, felder: {} });
  assert.equal(entlassFeldHtml({ entlassmanagement: true }), '');
});

test('Roundtrip: jedes Formularergebnis besteht die Serverprüfung', () => {
  for (const werte of [
    { auswahl: 'ja', datum: '2026-11-01' }, { auswahl: 'nein', datum: '' }, { auswahl: '', datum: '2026-11-01' },
  ]) {
    const r = entlassFelderAusFormular(werte, an);
    assert.equal(r.ok, true);
    assert.deepEqual(entlassFelderAusRezept(r.felder), r.felder);
  }
});

test('Ja ohne/mit kaputtem Datum und Blanko+Ja werden abgelehnt; ungeprüft bleibt null, nie false', () => {
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '' }, an).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-13-45' }, an).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: 'ja', datum: '2026-11-01' }, { ...an, istBlanko: true }).ok, false);
  assert.equal(entlassFelderAusFormular({ auswahl: '', datum: '' }, an).felder.entlassmanagement, null);
});

test('HTML: gespeicherter Stand wird abgebildet, Datum nur bei Ja aktiv', () => {
  assert.equal(merkmalZuAuswahl(null), '');
  assert.match(entlassFeldHtml({ entlassmanagement: true, entlassungsdatum: '2026-11-01' }, an), /value="2026-11-01"/);
  assert.match(entlassFeldHtml({ entlassmanagement: false }, an), /disabled/);
});
