import test from 'node:test';
import assert from 'node:assert/strict';
import {speichereRaum,weiseRaumZu,raeumeBeimSchreiben} from './raeume.mjs';
const tables=()=>({demo_rooms:[{id:'R',owner_id:'O',business_id:null,name:'Raum 1'}],demo_room_assignments:[],bookings:[
  {id:'A',owner_id:'O',business_id:null,start_time:'2026-11-02T09:00:00Z',end_time:'2026-11-02T09:30:00Z',status:'confirmed'},
  {id:'B',owner_id:'O',business_id:null,start_time:'2026-11-02T09:15:00Z',end_time:'2026-11-02T09:45:00Z',status:'confirmed'},
  {id:'C',owner_id:'O',business_id:null,start_time:'2026-11-02T09:30:00Z',end_time:'2026-11-02T10:00:00Z',status:'confirmed'},
]});
test('room creation and rename persist identity without duplicate names',()=>{
  const t=tables();speichereRaum(t,{name:'  Trainingsraum  ',ownerId:'O'});
  const id=t.demo_rooms[1].id;assert.equal(t.demo_rooms[1].name,'Trainingsraum');
  speichereRaum(t,{id,name:'Gymnastikraum',ownerId:'O'});assert.equal(t.demo_rooms[1].id,id);
  assert.throws(()=>speichereRaum(t,{name:'raum 1',ownerId:'O'}),/bereits/);
  assert.throws(()=>speichereRaum(t,{name:' ',ownerId:'O'}),/1–80/);
  assert.throws(()=>speichereRaum(t,{id:'R',name:'Fremd',ownerId:'OTHER'}),/Standort/);
});
test('assignment survives JSON reload; rename changes displayed source not booking identity',()=>{
  const t=tables();weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'});
  const next=JSON.parse(JSON.stringify(t));speichereRaum(next,{id:'R',name:'KG-Raum',ownerId:'O'});
  assert.equal(next.demo_room_assignments[0].booking_id,'A');assert.equal(next.demo_rooms[0].name,'KG-Raum');
});
test('overlap rejected atomically, adjacent interval accepted',()=>{
  const t=tables();weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'});const before=structuredClone(t);
  assert.throws(()=>weiseRaumZu(t,{bookingIds:['C','B'],roomId:'R',ownerId:'O'}),/bereits belegt/);
  assert.deepEqual(t,before);weiseRaumZu(t,{bookingIds:['C'],roomId:'R',ownerId:'O'});
  assert.equal(t.demo_room_assignments.length,2);
});
test('cancelled booking releases room; edit ignores itself and unassign removes only own row',()=>{
  const t=tables();weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'});
  weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'});assert.equal(t.demo_room_assignments.length,1);
  t.bookings[0].status='cancelled';weiseRaumZu(t,{bookingIds:['B'],roomId:'R',ownerId:'O'});
  weiseRaumZu(t,{bookingIds:['B'],roomId:'',ownerId:'O'});assert.equal(t.demo_room_assignments[0].booking_id,'A');
});
test('foreign room, foreign booking, wrong location and invalid interval rejected',()=>{
  const t=tables();
  assert.throws(()=>weiseRaumZu(t,{bookingIds:['A'],roomId:'missing',ownerId:'O'}),/verfügbar/);
  assert.throws(()=>weiseRaumZu(t,{bookingIds:['A'],roomId:'',ownerId:'OTHER'}),/Praxis/);
  t.bookings[0].business_id='OTHER';assert.throws(()=>weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'}),/Standorten/);
  t.bookings[0].business_id=null;t.bookings[0].end_time='bad';assert.throws(()=>weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'}),/ungültig/);
});
test('status-only writes preserve assignment; only explicit frozen booking payload changes room',()=>{
  const t=tables();t.demo_rooms.push({id:'R2',owner_id:'O',business_id:null,name:'Raum 2'});
  weiseRaumZu(t,{bookingIds:['A'],roomId:'R',ownerId:'O'});
  raeumeBeimSchreiben(t,{bookingIds:['A'],payload:{status:'completed'},ownerId:'O'});
  assert.equal(t.demo_room_assignments[0].room_id,'R');
  raeumeBeimSchreiben(t,{bookingIds:['A'],payload:{__demo_room_id:'R2'},ownerId:'O'});
  assert.equal(t.demo_room_assignments[0].room_id,'R2');
  raeumeBeimSchreiben(t,{bookingIds:['A'],payload:{__demo_room_id:''},ownerId:'O'});
  assert.equal(t.demo_room_assignments.length,0);
});
