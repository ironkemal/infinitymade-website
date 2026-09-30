import test from 'node:test';
import assert from 'node:assert/strict';
import { anliegenFuerBereich, zahlungsartenFuer, adressePflicht, anliegenNotiz, ANLIEGEN } from './anfrage-anliegen.js';
import { slugAusKennung, kennungAusSuche, ladeOwnerId } from './public-owner.js';

test('Anliegen nur fuer Podologie', () => {
  assert.equal(anliegenFuerBereich('podologie').length, 5);
  assert.equal(anliegenFuerBereich('Podologie').length, 5);
  assert.deepEqual(anliegenFuerBereich('physiotherapie'), []);
  assert.deepEqual(anliegenFuerBereich(null), []);
});

test('Zahlungsarten je Anliegen', () => {
  assert.deepEqual(zahlungsartenFuer('verordnung'), ['gkv', 'pkv', 'bg']);
  assert.deepEqual(zahlungsartenFuer('nagelspange'), ['selbstzahler']);
  assert.deepEqual(zahlungsartenFuer('fusspflege'), ['selbstzahler']);
  assert.ok(!zahlungsartenFuer('erst').includes('gkv'));
  assert.equal(zahlungsartenFuer(null).length, 4);
  assert.equal(zahlungsartenFuer('unbekannt').length, 4);
  for (const a of ANLIEGEN) assert.ok(a.zahlung.length >= 1);
});

test('Adresse nur beim Hausbesuch Pflicht', () => {
  assert.equal(adressePflicht('hausbesuch'), true);
  assert.equal(adressePflicht('verordnung'), false);
});

test('anliegenNotiz: Kopfzeile + freie Notiz, 500-Grenze', () => {
  assert.equal(anliegenNotiz('hausbesuch', ' Weg 1,  53721 Siegburg ', 'Klingel defekt'),
    'Anliegen: Hausbesuch — Adresse: Weg 1, 53721 Siegburg\nKlingel defekt');
  assert.equal(anliegenNotiz('nagelspange', 'egal', ''), 'Anliegen: Nagelspange');
  assert.equal(anliegenNotiz(null, null, ' Hallo '), 'Hallo');
  assert.equal(anliegenNotiz(null, null, ''), null);
  const lang = anliegenNotiz('hausbesuch', 'X', 'a'.repeat(900));
  assert.equal(lang.length, 500);
  assert.ok(lang.startsWith('Anliegen: Hausbesuch — Adresse: X\n'));
});

test('slugAusKennung / kennungAusSuche', () => {
  assert.equal(slugAusKennung('https://praxura.de/booking.html?u=kemal&x=1'), 'kemal');
  assert.equal(slugAusKennung(' kemal '), 'kemal');
  assert.deepEqual(kennungAusSuche('?business=abc&u=x'), { ownerId: 'abc', kennung: null });
  assert.deepEqual(kennungAusSuche('?u=kemal'), { ownerId: null, kennung: 'kemal' });
  assert.deepEqual(kennungAusSuche('?c=INF-1'), { ownerId: null, kennung: 'INF-1' });
  assert.deepEqual(kennungAusSuche(''), { ownerId: null, kennung: null });
});

// Kettenfaehiger Stub: jede Abfrage endet in maybeSingle() und liefert antworten[tabelle].
function stub(antworten, rpcAntwort) {
  return {
    from(t) {
      const q = { select: () => q, eq: () => q, or: () => q, maybeSingle: async () => ({ data: antworten[t] ?? null }) };
      return q;
    },
    rpc: async () => ({ data: rpcAntwort ?? null }),
  };
}

test('ladeOwnerId: business direkt, Slug ueber Profil/Business, Mitarbeiter -> Owner', async () => {
  const sb = stub({});
  assert.equal(await ladeOwnerId(sb, '?business=o1'), 'o1');
  assert.equal(await ladeOwnerId(sb, ''), null);
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'p', role: 'owner' } }), '?u=kemal'), 'p');
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'e', role: 'employee', owner_id: 'o' } }), '?u=kemal'), 'o');
  assert.equal(await ladeOwnerId(stub({ businesses: { owner_id: 'ob' } }), '?u=filiale'), 'ob');
  assert.equal(await ladeOwnerId(stub({}), '?u=nix'), null);
  assert.equal(await ladeOwnerId(stub({}, 'oc'), '?u=inf-123'), 'oc');
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'p', role: 'owner' } }), '?u=a,b.eq.c)'), null);
});
