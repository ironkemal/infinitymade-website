import test from 'node:test';
import assert from 'node:assert/strict';
import { berechneHandlungsbedarf } from './startseite-handlungsbedarf.js';

const quelle = (daten = [], extra = {}) => ({ status: 'ok', vollstaendig: true, daten, ...extra });
const rezept = (extra = {}) => ({ id: 'vo-1', bereich: 'podologie', ausstellungsdatum: '2026-10-01', dringend: false, behandlungsbeginn: null, restbedarf: true, behandlungen: quelle(), termine: quelle(), ...extra });
const rechnen = (r = rezept(), heute = '2026-10-27', q = {}) => berechneHandlungsbedarf({ version: 1, heute, verordnungen: quelle(Array.isArray(r) ? r : [r], q) });
const k = (r, name) => r.kategorien[name];

for (const [tag, name] of [['2026-10-22', 'beginnBald'], ['2026-10-28', 'beginnBald'], ['2026-10-29', 'beginnBald'], ['2026-10-30', 'beginnVerpasst']]) {
  test(`Beginn Grenze ${tag}`, () => assert.equal(k(rechnen(rezept(), tag), name).anzahl, 1));
}
test('Außerhalb Warnfenster keine Aufgabe', () => assert.equal(k(rechnen(rezept(), '2026-10-20'), 'beginnBald').anzahl, 0));
test('Dringlich nutzt 14 statt28 Tage', () => assert.equal(k(rechnen(rezept({ dringend: true }), '2026-10-16'), 'beginnVerpasst').anzahl, 1));
test('Erfolgter Beginn verhindert Beginnwarnung trotz alter Ausstellung', () => assert.equal(k(rechnen(rezept({ behandlungsbeginn: '2026-10-02' }), '2026-12-01'), 'beginnVerpasst').anzahl, 0));
test('Heutige Behandlung verhindert falsche Pause und Beginnwarnung', () => {
  const r = rechnen(rezept({ behandlungen: quelle([{ behandlungsdatum: '2026-10-27', storniert_am: null }, { behandlungsdatum: '2026-01-01', storniert_am: null }]) }));
  for (const name of ['beginnVerpasst', 'beginnBald', 'pauseDroht', 'pauseVerpasst']) assert.equal(k(r, name).anzahl, 0);
});
for (const [delta, droht, verpasst] of [[76,0,0],[77,1,0],[83,1,0],[84,1,0],[85,0,1]]) {
  test(`Podo Pause ${delta} Tage`, () => {
    const datum = new Date(Date.UTC(2026,0,1+delta)).toISOString().slice(0,10);
    const r = rechnen(rezept({ behandlungsbeginn: '2026-01-01', behandlungen: quelle([{ behandlungsdatum:'2026-01-01', storniert_am:null }]) }), datum);
    assert.equal(k(r,'pauseDroht').anzahl,droht); assert.equal(k(r,'pauseVerpasst').anzahl,verpasst);
  });
}
test('Stornierte Behandlung erneuert Pause nicht', () => {
  const r = rechnen(rezept({ behandlungen: quelle([{ behandlungsdatum:'2026-08-01', storniert_am:null },{ behandlungsdatum:'2026-10-26', storniert_am:'2026-10-26' }]) }));
  assert.equal(k(r,'pauseVerpasst').anzahl,1);
});
for (const bereich of ['physiotherapie','ergotherapie','logopaedie']) test(`${bereich}: keine Podo Pause`,()=>{
  const r = rechnen(rezept({bereich,behandlungsbeginn:'2026-01-01'})); assert.equal(k(r,'pauseVerpasst').anzahl,0);
});
for (const extra of [{status:'laden'},{status:'fehler'},{vollstaendig:false},{daten:null}]) test(`Unbekannte Historie ${JSON.stringify(extra)}`,()=>{
  const r = rechnen(rezept({behandlungen:quelle([],extra)}));
  for(const name of ['beginnVerpasst','beginnBald','pauseDroht','pauseVerpasst','ohneFolgetermin']) assert.equal(k(r,name).anzahl,null);
  assert.equal(r.entwarnung,false);
});
test('Bestätigter Beginn aus Teilhistorie bleibt bekannt',()=>{
  const r=rechnen(rezept({behandlungen:quelle([{behandlungsdatum:'2026-10-20',storniert_am:null}],{vollstaendig:false})}));
  assert.equal(k(r,'beginnBald').anzahl,0); assert.equal(k(r,'pauseDroht').anzahl,null);
});
for(const status of ['geplant','abgesagt']) test(`Beginn bald mit Termin ${status}`,()=>{
  const r=rechnen(rezept({termine:quelle([{tag:'2026-10-28',status}])})); assert.equal(k(r,'beginnBald').anzahl,status==='geplant'?0:1);
});
test('Termin nach Beginnfrist verdeckt verpassten Beginn nicht',()=>{
  const r=rechnen(rezept({termine:quelle([{tag:'2026-11-10',status:'geplant'}])}),'2026-10-30'); assert.equal(k(r,'beginnVerpasst').anzahl,1);
});
test('Beginn bald ohne vollständige Termine unbekannt',()=>assert.equal(k(rechnen(rezept({termine:quelle([],{vollstaendig:false})})),'beginnBald').anzahl,null));
test('Bekannter geplanter Termin widerlegt fehlenden Termin auch in Teilquelle',()=>assert.equal(k(rechnen(rezept({termine:quelle([{tag:'2026-10-28',status:'geplant'}],{vollstaendig:false})})),'beginnBald').anzahl,0));
test('Ohne Folgetermin nur mit Beginn und bestätigtem Restbedarf',()=>{
  assert.equal(k(rechnen(rezept({behandlungsbeginn:'2026-10-20'})),'ohneFolgetermin').anzahl,1);
  assert.equal(k(rechnen(rezept()),'ohneFolgetermin').anzahl,0);
  assert.equal(k(rechnen(rezept({behandlungsbeginn:'2026-10-20',restbedarf:false})),'ohneFolgetermin').anzahl,0);
  assert.equal(k(rechnen(rezept({behandlungsbeginn:'2026-10-20',restbedarf:null})),'ohneFolgetermin').anzahl,null);
});
test('Termin heute genügt, abgesagt und vergangen nicht',()=>{
  for(const [tag,status,erwartet] of [['2026-10-27','geplant',0],['2026-10-26','geplant',1],['2026-10-28','abgesagt',1]]) assert.equal(k(rechnen(rezept({behandlungsbeginn:'2026-10-20',termine:quelle([{tag,status}])})),'ohneFolgetermin').anzahl,erwartet);
});
for(const bad of ['2026-02-30','2026-13-01','kein Datum','2026-10-20T12:00:00Z']) test(`Ungültige normalisierte Behandlung ${bad}`,()=>{
  const r=rechnen(rezept({behandlungen:quelle([{behandlungsdatum:bad,storniert_am:null}])})); assert.equal(k(r,'beginnBald').anzahl,null);assert.equal(r.entwarnung,false);
});
test('Zukunftsbehandlung ist kein erfolgter Beginn',()=>{
  const r=rechnen(rezept({behandlungen:quelle([{behandlungsdatum:'2026-10-28',storniert_am:null}])})); assert.equal(k(r,'beginnBald').anzahl,null);
});
test('Ungültiger Termin bleibt Unknown statt fehlender Termin',()=>assert.equal(k(rechnen(rezept({termine:quelle([{tag:'2026-10-28',status:'fremd'}])})),'beginnBald').anzahl,null));
test('Bekannte positive Teilmenge bleibt bei unvollständiger VO Quelle sichtbar',()=>{
  const r=rechnen(rezept(),'2026-10-30',{vollstaendig:false});assert.equal(k(r,'beginnVerpasst').bekanntAnzahl,1);assert.equal(k(r,'beginnVerpasst').anzahl,null);assert.equal(r.entwarnung,false);
});
test('Unabhängige positive VO bleibt neben ungültiger VO erhalten',()=>{
  const r=rechnen([rezept(),rezept({id:'vo-2',ausstellungsdatum:null})],'2026-10-30');assert.deepEqual(k(r,'beginnVerpasst').ids,['vo-1']);assert.equal(k(r,'beginnVerpasst').anzahl,null);
});
test('Doppelte IDs ergeben Unknown ohne Doppelzählung',()=>{
  const r=rechnen([rezept(),rezept()],'2026-10-30');assert.equal(k(r,'beginnVerpasst').anzahl,null);assert.equal(k(r,'beginnVerpasst').bekanntAnzahl,0);
});
test('Bestätigte leere Quelle erlaubt Entwarnung, fehlende Quelle nicht',()=>{
  assert.equal(rechnen([]).entwarnung,true);
  assert.equal(berechneHandlungsbedarf({version:1,heute:'2026-10-27'}).entwarnung,false);
});
test('Version und Stichtag strikt',()=>{
  for(const x of [{version:2,heute:'2026-10-27'},{version:1,heute:'2026-02-30'},null]) assert.throws(()=>berechneHandlungsbedarf(x),TypeError);
});
test('Input unverändert, keine Namen oder beliebigen Felder im DTO',()=>{
  const input={version:1,heute:'2026-10-30',verordnungen:quelle([rezept({name:'NICHT_KOPIEREN'})])};const before=JSON.stringify(input);
  const r=berechneHandlungsbedarf(input);assert.equal(JSON.stringify(input),before);assert.ok(!JSON.stringify(r).includes('NICHT_KOPIEREN'));
});

test('Acht Tage vor Beginnfrist noch außerhalb Warnfenster',()=>assert.equal(k(rechnen(rezept(),'2026-10-21'),'beginnBald').anzahl,0));
test('Ungültiger Stornovermerk kann Historie nicht still leeren',()=>{
  const r=rechnen(rezept({behandlungen:quelle([{behandlungsdatum:'2026-10-20',storniert_am:'kaputt'}])}));assert.equal(k(r,'beginnBald').anzahl,null);
});

for (const [ausstellungsdatum,heute,dringend] of [['2026-03-01','2026-03-29',false],['2026-10-01','2026-10-29',false],['2028-02-01','2028-02-29',false],['2026-12-18','2027-01-01',true]]) test(`Kalendergrenze ${ausstellungsdatum} → ${heute}`,()=>{
  const r=rechnen(rezept({ausstellungsdatum,dringend}),heute);assert.equal(k(r,'beginnBald').anzahl,1);assert.equal(k(r,'beginnVerpasst').anzahl,0);
});
