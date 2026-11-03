import test from 'node:test';
import assert from 'node:assert/strict';
import {
  optionenFuerAuswahl, felderAusWahl, ladeRaumliste, ladeBelegungen, raumWarnung, freieRaeumeHinweis, raumFelder, terminWarnungen, tagesgrenzen,
} from './raum-auswahl.js';

const raeume = [
  { id: 'R', name: 'Raum 1', plaetze: 1, business_id: 'B' },
  { id: 'W', name: 'Wärme', plaetze: 2, business_id: 'B' },
  { id: 'E', name: 'Einzelpraxis', plaetze: 1, business_id: null },
];
const termine = [
  { id: 'a', room_id: 'R', status: 'confirmed', start_time: '2026-11-02T09:00:00Z', end_time: '2026-11-02T09:30:00Z' },
  { id: 'b', room_id: 'W', status: 'confirmed', start_time: '2026-11-02T09:00:00Z', end_time: '2026-11-02T09:30:00Z' },
];
const start = '2026-11-02T09:10:00Z';
const ende = '2026-11-02T09:40:00Z';

test('Optionen: „Kein Raum" zuerst, freie vor belegten, Plätze im Text', () => {
  const optionen = optionenFuerAuswahl(raeume, termine, start, ende);
  assert.equal(optionen[0].text, 'Kein Raum');
  assert.deepEqual(optionen.slice(1).map(o => o.text), ['Wärme (1 von 2 Plätzen belegt)', 'Einzelpraxis', 'Raum 1 (belegt)']);
});

test('Optionen ohne Zeit zeigen nur die Namen', () => {
  assert.deepEqual(optionenFuerAuswahl(raeume, termine, null, null).map(o => o.text), ['Kein Raum', 'Raum 1', 'Wärme', 'Einzelpraxis']);
});

test('Der eigene Termin blockiert seinen Raum beim Bearbeiten nicht', () => {
  const optionen = optionenFuerAuswahl([raeume[0]], termine, start, ende, { ohneTerminId: 'a' });
  assert.equal(optionen[1].text, 'Raum 1');
});

test('Der Raum bestimmt den Standort des Termins', () => {
  assert.deepEqual(felderAusWahl('R', raeume), { room_id: 'R', business_id: 'B' });
});

test('Raum ohne Standort setzt keinen Standort', () => {
  assert.deepEqual(felderAusWahl('E', raeume), { room_id: 'E' });
});

test('„Kein Raum" leert den Raum, unbekannter Raum fasst nichts an', () => {
  assert.deepEqual(felderAusWahl('', raeume), { room_id: null });
  assert.deepEqual(felderAusWahl('weg', raeume), {});
});

test('Warnung nennt den Raum, sonst null', () => {
  assert.match(raumWarnung(raeume[0], termine, start, ende), /Raum „Raum 1" ist zu dieser Zeit belegt/);
  assert.equal(raumWarnung(raeume[1], termine, start, ende), null);
  assert.equal(raumWarnung(undefined, termine, start, ende), null);
});

test('Lesefehler führen zu leerer Liste, nie zu einer Ausnahme', async () => {
  const kaputt = { from() { throw new Error('Tabelle fehlt'); } };
  assert.deepEqual(await ladeRaumliste(kaputt, 'O'), []);
  assert.deepEqual(await ladeBelegungen(kaputt, 'O', 'a', 'b'), []);
  const fehler = { from: () => ({ select: () => ({ eq: async () => ({ data: null, error: { code: '42P01' } }) }) }) };
  assert.deepEqual(await ladeRaumliste(fehler, 'O'), []);
});

test('Ohne verdrahtetes Modul bleibt alles beim Alten', async () => {
  assert.deepEqual(raumFelder(), {});
  assert.equal(await terminWarnungen({ empId: 'x', startIso: start, endIso: ende }), true);
});

test('Tagesgrenzen umfassen den ganzen lokalen Tag', () => {
  const { vonISO, bisISO } = tagesgrenzen('2026-11-02T09:10:00Z');
  assert.ok(Date.parse(vonISO) <= Date.parse('2026-11-02T09:10:00Z'));
  assert.ok(Date.parse(bisISO) >= Date.parse('2026-11-02T09:10:00Z'));
  assert.ok(Date.parse(bisISO) - Date.parse(vonISO) < 864e5);
});

test('Hinweis: nennt die freien Räume, belegte nicht', () => {
  assert.equal(freieRaeumeHinweis(raeume, termine, start, ende), 'Frei zu dieser Zeit: Wärme, Einzelpraxis');
});

test('Hinweis: alles belegt, ohne Zeit oder ohne Räume', () => {
  assert.equal(freieRaeumeHinweis([raeume[0]], termine, start, ende), 'Zu dieser Zeit ist kein Raum frei.');
  assert.equal(freieRaeumeHinweis(raeume, termine, null, null), '');
  assert.equal(freieRaeumeHinweis([], termine, start, ende), '');
});


test('Raumvorschlag verlangt Union aller Leistungsanforderungen und freien richtigen Standort', async () => {
  const { terminRaumAnforderungen, raumVorschlag } = await import('./raum-auswahl.js');
  const dienste = [{ id:'s1', raum_ausstattung:['Liege'] }, { id:'s2', raum_ausstattung:['Becken','Liege'] }];
  const anforderungen = terminRaumAnforderungen([{serviceId:'s1'}, {serviceId:'s2'}], dienste);
  assert.deepEqual(anforderungen, ['Liege','Becken']);
  assert.equal(terminRaumAnforderungen([{serviceId:'fremd'}], dienste), null);
  assert.equal(terminRaumAnforderungen([{serviceId:'s1'}], [{id:'s1'}]), null);
  const raeume = [
    {id:'falsch', name:'A', business_id:'anderer', ausstattung:['Liege','Becken']},
    {id:'wenig', name:'B', business_id:'b', ausstattung:['Liege']},
    {id:'voll', name:'C', business_id:'b', ausstattung:['Liege','Becken']},
    {id:'frei', name:'D', business_id:'b', ausstattung:['Liege','Becken']},
  ];
  const termine = [{id:'t',room_id:'voll',start_time:'2026-11-04T09:00:00Z',end_time:'2026-11-04T10:00:00Z',status:'confirmed'}];
  const zeit = ['2026-11-04T09:30:00Z','2026-11-04T09:50:00Z'];
  assert.equal(raumVorschlag(raeume, termine, ...zeit, {businessId:'b',anforderungen}).id, 'frei');
  assert.equal(raumVorschlag(raeume, termine, ...zeit, {businessId:null,anforderungen}), null);
  assert.equal(raumVorschlag(raeume.slice(0,3), termine, ...zeit, {businessId:'b',anforderungen}), null);
  assert.equal(raumVorschlag(raeume, termine, ...zeit, {businessId:'b',anforderungen:null}), null);
  assert.equal(raumVorschlag(raeume, termine, ...zeit, {businessId:'b',anforderungen,ohneTerminId:'t'}).id, 'voll');
});

test('Raumladung fällt nur bei fehlender Ausstattungsspalte zurück', async () => {
  const selects = [];
  const db = { from: () => ({ select(s) { selects.push(s); return { eq: async () => s.endsWith(',ausstattung') ? { error:{code:'42703'} } : {data:[{id:'alt'}],error:null} }; } }) };
  assert.deepEqual(await ladeRaumliste(db,'o'), [{id:'alt'}]);
  assert.equal(selects.length,2);
});


test('Belegungsabfrage berücksichtigt über Mitternacht reichende Termine und meldet Lesefehler', async () => {
  const { ladeBelegungsstand } = await import('./raum-auswahl.js');
  const filter = [];
  const query = { select() { return query; }, eq() { return query; }, not() { return query; }, lt(k,v) {filter.push(['lt',k,v]);return query;}, gt(k,v){filter.push(['gt',k,v]);return query;}, then(resolve) {return Promise.resolve({data:[{id:'nacht'}],error:null}).then(resolve);} };
  const result = await ladeBelegungsstand({from:()=>query},'o','von','bis');
  assert.deepEqual(filter,[['lt','start_time','bis'],['gt','end_time','von']]);
  assert.equal(result.fehler,false);
  assert.equal(result.termine[0].id,'nacht');
  const kaputt = await ladeBelegungsstand({from(){throw new Error('offline');}},'o','von','bis');
  assert.deepEqual(kaputt,{termine:[],fehler:true});
});


test('Nur vollständig online erbrachte Kombinationen und Hausbesuch brauchen keinen Praxisraum', async () => {
  const { keinPraxisraumNoetig } = await import('./raum-auswahl.js');
  const services = [{id:'online',is_online_meeting:true},{id:'praxis',is_online_meeting:false}];
  assert.equal(keinPraxisraumNoetig([{serviceId:'online'}],services),true);
  assert.equal(keinPraxisraumNoetig([{serviceId:'online'},{serviceId:'praxis'}],services),false);
  assert.equal(keinPraxisraumNoetig([],services),false);
  assert.equal(keinPraxisraumNoetig([{serviceId:'fremd'}],services),false);
  assert.equal(keinPraxisraumNoetig([{serviceId:'praxis'}],services,true),true);
});
