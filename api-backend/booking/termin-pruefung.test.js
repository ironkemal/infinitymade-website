import test from 'node:test';
import assert from 'node:assert/strict';
import { terminPruefen, terminAlternativen } from './termin-pruefung.js';

const start = Date.parse('2026-11-23T09:00Z'); // Montag, 10 Uhr.
const termin = { empId: 'Chrome1911 A', roomId: 'R1', start, dauer: 25 };
function stand() {
  return { ownerId: 'Chrome1911 Praxis', jetzt: start - 86400000, bis: start + 36*3600000,
    team: [{id: termin.empId}, {id:'Chrome1911 B'}],
    bookings: [], raeume: ['R1','R2'].map(id => ({ id, name:id, plaetze:1, ausstattung:['Liege'] })),
    leistungen: [{raum_ausstattung:['Liege'],required_certificate:'MT'}],
    zertifikate: [termin.empId,'Chrome1911 B'].map(profile_id => ({profile_id,certificate:'MT'})),
    tage: [], abwesenheiten: [], pausen: [], zuordnung: [], plan: [], geschlossen: [],
    zeiten: [1,2].map(day_of_week => ({ user_id:'Chrome1911 Praxis',day_of_week,is_active:true,start_time:'09:00',end_time:'17:00' })) };
}
const buchung = (user_id, room_id) => ({ id:'Chrome1911 Termin', user_id, room_id, status:'confirmed',start_time:new Date(start).toISOString(),end_time:new Date(start+25*60000).toISOString() });
for (const [name, aendern, art] of [
  ['Raum', d=>d.bookings.push(buchung('andere Person','R1')),'roomId'],
  ['Therapeut', d=>d.bookings.push(buchung(termin.empId,'R2')),'empId'],
  ['Urlaub', d=>d.abwesenheiten.push({employee_id:termin.empId,start_date:'2026-11-23',end_date:'2026-11-23'}),'empId'],
  ['Geschlossen', d=>d.tage.push({date:'2026-11-23',type:'closed'}),'startIso'],
  ['Arbeitszeit', d=>d.zeiten[0].start_time='11:00','startIso'],
  ['Qualifikation', d=>d.zertifikate.shift(),'empId'],
]) test('Chrome1911 '+name+': Vorschlag übernehmen und erneut prüfen', () => {
  const d=stand(); aendern(d);
  const { konflikte,vorschlaege }=terminAlternativen(d,termin);
  assert.ok(konflikte.length); assert.ok(vorschlaege.length<=3);
  const v=vorschlaege.find(v=>v[art]); assert.ok(v);
  for(const w of vorschlaege) assert.deepEqual(terminPruefen(d,{...termin,...w,start:w.startIso?Date.parse(w.startIso):start}),[]);
});
test('Chrome1911 eigener Termin, Anschluss und Gruppenraumkapazität',()=>{
  const d=stand(), b=buchung(termin.empId,'R1');d.bookings=[b];
  assert.deepEqual(terminPruefen(d,{...termin,id:b.id}),[]);
  assert.deepEqual(terminPruefen(d,{...termin,start:Date.parse(b.end_time)}),[]);
  d.raeume[0].plaetze=2;
  const t={...termin,empId:'Chrome1911 B'};
  assert.ok(terminPruefen(d,t).some(k=>k.sperre));
  d.raeume[0].ausstattung.push('Gruppenraum');
  assert.deepEqual(terminPruefen(d,t).map(k => k.sperre),[false]);
  d.bookings.push({...b,id:'Chrome1911 parallel',user_id:'dritte Person'});assert.ok(terminPruefen(d,t).some(k=>k.sperre));
});

test('Chrome1911 geschlossener Berliner Kalendertag: Bestand bleibt änderbar, neue Zeit gesperrt', () => {
  const d = stand(), b = buchung(termin.empId, 'R1'); d.bookings.push(b);
  d.tage.push({date:'2026-11-23',type:'closed'});
  assert.equal(terminPruefen(d,{...termin,id:b.id}).find(k => k.grund.includes('geschlossen')).sperre, false);
  assert.equal(terminPruefen(d,{...termin,id:b.id,start:start+60000}).find(k => k.grund.includes('geschlossen')).sperre, true);
});
