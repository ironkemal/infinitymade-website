import test from 'node:test';
import assert from 'node:assert/strict';
import { praxisAngabenAus, ladePraxisAngaben } from './termin-rechtstexte.js';

const zeile = { praxis_name: 'Podologie Nord', inhaber_name: 'Eva Muster', strasse: 'Hauptstr.', hausnummer: '5',
  plz: '53721', ort: 'Siegburg', impressum_url: 'https://pn.de/impressum', datenschutz_url: 'javascript:alert(1)' };

test('Anschrift mit Hausnummer, URLs nur https', () => {
  const a = praxisAngabenAus(zeile);
  assert.equal(a.anschrift, 'Hauptstr. 5, 53721 Siegburg');
  assert.equal(a.impressumUrl, 'https://pn.de/impressum');
  assert.equal(a.datenschutzUrl, '');
  assert.equal(a.vollstaendig, true);
});

test('fehlt Name oder ein Adressteil → nicht vollständig (Formular gesperrt)', () => {
  assert.equal(praxisAngabenAus({ ...zeile, praxis_name: ' ' }).vollstaendig, false);
  assert.equal(praxisAngabenAus({ ...zeile, plz: null }).vollstaendig, false);
  assert.equal(praxisAngabenAus({ ...zeile, strasse: '' }).vollstaendig, false);
  assert.equal(praxisAngabenAus(null).vollstaendig, false);
});

test('RPC: richtige Parameter, leere Antwort → null, Fehler wird geworfen', async () => {
  const aufrufe = [];
  const sb = (antwort) => ({ rpc: async (n, p) => { aufrufe.push([n, p]); return antwort; } });
  assert.equal((await ladePraxisAngaben(sb({ data: [zeile] }), 'o1', 'b1')).name, 'Podologie Nord');
  assert.deepEqual(aufrufe[0], ['public_praxis_angaben', { p_owner_id: 'o1', p_business_id: 'b1' }]);
  assert.equal(await ladePraxisAngaben(sb({ data: [] }), 'o1'), null);
  await assert.rejects(ladePraxisAngaben(sb({ error: new Error('x') }), 'o1'));
  assert.equal(await ladePraxisAngaben(sb({}), null), null);
});
