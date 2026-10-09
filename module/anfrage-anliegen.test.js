import test from 'node:test';
import assert from 'node:assert/strict';
import { anliegenFuerBereich, zahlungsartenFuer, hausbesuchFrageNoetig, anliegenNotiz, ANLIEGEN, WUNDE_HINWEIS, heilmittelFrage, behandlungsartFuer, HEILMITTEL_WORTLAUT } from './anfrage-anliegen.js';
import { slugAusKennung, kennungAusSuche, ladeOwnerId, ladeKennung } from './public-owner.js';

test('Anliegen nur fuer Podologie, drei Karten', () => {
  assert.equal(anliegenFuerBereich('podologie').length, 3);
  assert.equal(anliegenFuerBereich('Podologie').length, 3);
  assert.deepEqual(anliegenFuerBereich('physiotherapie'), []);
  assert.deepEqual(anliegenFuerBereich(null), []);
  assert.deepEqual(ANLIEGEN.map(a => a.key), ['rezept', 'nagelspange', 'ohne_rezept']);
});

test('Zahlungsarten je Anliegen', () => {
  assert.deepEqual(zahlungsartenFuer('rezept'), ['gkv', 'pkv', 'bg']);
  assert.deepEqual(zahlungsartenFuer('nagelspange'), ['gkv', 'pkv', 'selbstzahler']);
  assert.deepEqual(zahlungsartenFuer('ohne_rezept'), ['selbstzahler', 'pkv']);
  assert.ok(zahlungsartenFuer('nagelspange').includes('gkv'));
  assert.ok(!zahlungsartenFuer('ohne_rezept').includes('gkv'));
  assert.equal(zahlungsartenFuer(null).length, 4);
  assert.equal(zahlungsartenFuer('unbekannt').length, 4);
});

test('Wunden-Hinweis vorhanden', () => {
  assert.match(WUNDE_HINWEIS, /Wunde/);
});

test('hausbesuchFrageNoetig: nur bei Hausbesuch und Rezept/GKV/PKV', () => {
  assert.equal(hausbesuchFrageNoetig('rezept', 'gkv'), true);
  assert.equal(hausbesuchFrageNoetig('rezept', null), true);
  assert.equal(hausbesuchFrageNoetig('nagelspange', 'gkv'), true);
  assert.equal(hausbesuchFrageNoetig('nagelspange', 'pkv'), true);
  assert.equal(hausbesuchFrageNoetig('nagelspange', 'selbstzahler'), false);
  assert.equal(hausbesuchFrageNoetig('ohne_rezept', 'selbstzahler'), false);
  assert.equal(hausbesuchFrageNoetig('ohne_rezept', 'pkv'), true);
  assert.equal(hausbesuchFrageNoetig('rezept', 'gkv', false), false);
});

test('anliegenNotiz: Kopfzeile, Hausbesuch, Antwort, freie Notiz', () => {
  assert.equal(anliegenNotiz('nagelspange', {}, ''), 'Anliegen: Nagelspange');
  assert.equal(anliegenNotiz('rezept', { hausbesuch: true, adresse: ' Weg 1,  53721 Siegburg ', hbAufRezept: 'unklar' }, 'Klingel defekt'),
    'Anliegen: Behandlung mit Rezept — Hausbesuch — Adresse: Weg 1, 53721 Siegburg — Hausbesuch auf Rezept: unklar\nKlingel defekt');
  assert.equal(anliegenNotiz('rezept', { hausbesuch: true, adresse: 'X', hbAufRezept: 'ja' }, ''),
    'Anliegen: Behandlung mit Rezept — Hausbesuch — Adresse: X — Hausbesuch auf Rezept: ja');
  assert.ok(anliegenNotiz('rezept', { hausbesuch: true, adresse: 'X', hbAufRezept: 'nein' }, '').endsWith('auf Rezept: nein'));
  assert.equal(anliegenNotiz('rezept', { hausbesuch: true, adresse: 'X' }, ''), 'Anliegen: Behandlung mit Rezept — Hausbesuch — Adresse: X');
  assert.equal(anliegenNotiz(null, null, ' Hallo '), 'Hallo');
  assert.equal(anliegenNotiz(null, null, ''), null);
});

test('anliegenNotiz: Hausbesuch aus -> Adresse und Antwort werden nicht geschrieben', () => {
  const n = anliegenNotiz('rezept', { hausbesuch: false, adresse: 'Weg 1', hbAufRezept: 'ja' }, 'Hallo');
  assert.equal(n, 'Anliegen: Behandlung mit Rezept\nHallo');
  assert.ok(!n.includes('Weg 1') && !n.includes('Hausbesuch'));
});

test('anliegenNotiz: 500-Grenze kuerzt den freien Text, nie die Kopfzeile', () => {
  const kopf = 'Anliegen: Behandlung mit Rezept — Hausbesuch — Adresse: X — Hausbesuch auf Rezept: unklar';
  const lang = anliegenNotiz('rezept', { hausbesuch: true, adresse: 'X', hbAufRezept: 'unklar' }, 'a'.repeat(900));
  assert.equal(lang.length, 500);
  assert.ok(lang.startsWith(kopf + '\n'));
});

test('slugAusKennung / kennungAusSuche', () => {
  assert.equal(slugAusKennung('https://praxura.de/booking.html?u=kemal&x=1'), 'kemal');
  assert.equal(slugAusKennung(' kemal '), 'kemal');
  const id = 'c4fbded4-0000-4000-8000-000000000000';
  assert.deepEqual(kennungAusSuche(`?business=${id}&u=x`), { ownerId: id, kennung: null });
  assert.deepEqual(kennungAusSuche('?business=a,b&u=x'), { ownerId: null, kennung: null }); // kein UUID → ungültig
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
  assert.equal(await ladeOwnerId(sb, '?business=c4fbded4-0000-4000-8000-000000000000'), 'c4fbded4-0000-4000-8000-000000000000');
  assert.equal(await ladeOwnerId(sb, ''), null);
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'p', role: 'owner' } }), '?u=kemal'), 'p');
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'e', role: 'employee', owner_id: 'o' } }), '?u=kemal'), 'o');
  assert.equal(await ladeOwnerId(stub({ businesses: { owner_id: 'ob' } }), '?u=filiale'), 'ob');
  assert.equal(await ladeOwnerId(stub({}), '?u=nix'), null);
  assert.equal(await ladeOwnerId(stub({}, 'oc'), '?u=inf-123'), 'oc');
  assert.equal(await ladeOwnerId(stub({ profiles_public: { id: 'p', role: 'owner' } }), '?u=a,b.eq.c)'), null);
});

test('Heilmittel-Frage: Wortlaut statt Positionsnummer, nur Podologie-Anliegen', () => {
  assert.equal(HEILMITTEL_WORTLAUT.length, 4);
  assert.ok(!HEILMITTEL_WORTLAUT.some(t => /\d{4,5}/.test(t)));
  assert.equal(heilmittelFrage('rezept', 'gkv').typ, 'wahl');
  assert.equal(heilmittelFrage('rezept', 'pkv'), null);
  assert.equal(heilmittelFrage('nagelspange', 'gkv').typ, 'fest');
  assert.equal(heilmittelFrage('nagelspange', 'pkv').typ, 'fest');
  assert.equal(heilmittelFrage('nagelspange', 'selbstzahler'), null);
  assert.equal(heilmittelFrage('ohne_rezept', 'selbstzahler'), null);
  assert.equal(heilmittelFrage(null, 'gkv'), null);
});

test('behandlungsartFuer: freiwillig, nur gueltiger Wortlaut', () => {
  assert.equal(behandlungsartFuer('rezept', 'gkv', null), null);
  assert.equal(behandlungsartFuer('rezept', 'gkv', 'Hornhautabtragung'), 'Hornhautabtragung');
  assert.equal(behandlungsartFuer('rezept', 'gkv', '78002'), null);
  assert.equal(behandlungsartFuer('rezept', 'pkv', 'Hornhautabtragung'), null);
  assert.equal(behandlungsartFuer('nagelspange', 'gkv', null), 'Nagelspangenbehandlung');
  assert.equal(behandlungsartFuer('nagelspange', 'selbstzahler', null), null);
});

test('ladeKennung: Mitarbeiter-Link und Standort-Slug behalten employeeId / businessId (booking.js)', async () => {
  assert.deepEqual(await ladeKennung(stub({ profiles_public: { id: 'e', role: 'employee', owner_id: 'o' } }), '?u=anna'),
    { ownerId: 'o', employeeId: 'e', businessId: null, businessName: null });
  assert.deepEqual(await ladeKennung(stub({ businesses: { id: 'b1', owner_id: 'ob', business_name: 'Filiale Nord' } }), '?u=filiale'),
    { ownerId: 'ob', employeeId: null, businessId: 'b1', businessName: 'Filiale Nord' });
  assert.equal(await ladeKennung(stub({}), '?business=keine-uuid'), null);
});

test('patientenLeistungen: ohne Rezept nur privat/selbstzahler; Nagelspange/Rezept → Praxis wählt; ohne Anliegen alles', async () => {
  const { patientenLeistungen } = await import('./anfrage-anliegen.js');
  const liste = [
    { id: 'a', gkv_position_nr: '78010' },                 // HPNR-Seed → gkv
    { id: 'b', gkv_position_nr: '78530' },                 // Therapiebericht → gkv
    { id: 'c', kostentraeger_typ: 'selbstzahler' },
    { id: 'd' },                                           // ohne Nummer → privat
    { id: 'e', kostentraeger_typ: 'bg' },
    { id: 'f', is_internal: true },
  ];
  assert.deepEqual(patientenLeistungen(liste, 'ohne_rezept').map((s) => s.id), ['c', 'd']);
  assert.deepEqual(patientenLeistungen(liste, 'nagelspange'), []);
  assert.deepEqual(patientenLeistungen(liste, 'rezept'), []);
  assert.equal(patientenLeistungen(liste, null).length, 6);
});
