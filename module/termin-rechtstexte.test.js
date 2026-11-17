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

// QA TEST-Physio 17.11.2026, Fund 5: Inhaber ohne Straße, Standort mit Anschrift.
test('Inhaber-/Mitarbeiterlink ohne Standort nutzt die Standortanschrift', async () => {
  const { ladePraxisAngabenMitStandort } = await import('./termin-rechtstexte.js');
  const ohneStrasse = { ...zeile, strasse: null, hausnummer: null };
  const kette = (data) => { const k = { select: () => k, eq: () => k, not: () => k, order: async () => ({ data }), then: (r) => r({ data }) }; return k; };
  const sb = {
    rpc: async (_n, p) => ({ data: [p.p_business_id === 'b2' ? { ...zeile, strasse: 'Teststraße', hausnummer: '1' } : ohneStrasse] }),
    from: (t) => kette(t === 'businesses' ? [{ id: 'b1' }, { id: 'b2' }] : [{ business_id: 'b2' }]),
  };
  const a = await ladePraxisAngabenMitStandort(sb, 'o1', null, null);
  assert.equal(a.vollstaendig, true);
  assert.equal(a.anschrift, 'Teststraße 1, 53721 Siegburg');
  const mitStandortLink = await ladePraxisAngabenMitStandort(sb, 'o1', 'b1', null);
  assert.equal(mitStandortLink.vollstaendig, false, 'Standortlink bleibt bei seinem Standort');
});
