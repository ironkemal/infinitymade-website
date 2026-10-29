import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {zuzahlungFuerRezept} from './zuzahlung-rechnen.js';
import {baueGruppen,auswahlStand,kassenanteil} from './abrechnung-auswahl.js';

const ui=readFileSync(new URL('./abrechnung-auswahl.js',import.meta.url),'utf8');
const backend=readFileSync(new URL('../api-backend/billing/api/abrechnung.routes.js',import.meta.url),'utf8');
const mapperText=backend.slice(backend.indexOf('function mapPrescriptionToDtaShape('),backend.indexOf('\n//',backend.indexOf('\n}',backend.indexOf('function mapPrescriptionToDtaShape('))));
function rx(indices) { return {id:'rx',patient_id:'p',heilmittel_position:'X0501',anzahl_einheiten:6,kostentraeger_ik:'123',leads:{last_name:'Synthetisch'},prescription_sessions:indices.map((i,n)=>({id:`s${n}`,status:'done',heilmittel_index:i,done_at:'2026-10-01'}))}; }
function zeilen(rezept) {
  const result={zeilen:[],fehlerhaft:[]};let rechnungen=0;
  const code=ui.slice(ui.indexOf('  for (const rx of physioRes.data || [])'),ui.indexOf('  // ── Podologie ─',ui.indexOf('  for (const rx of physioRes.data || [])')));
  vm.runInNewContext(code,{physioRes:{data:[rezept]},_st:{rxRoh:new Map()},imZeitraum:()=>true,_findePhysioPosition:()=>({preis:20}),positionen:[],zuzahlungFuerRezept:(...a)=>{rechnungen++;return zuzahlungFuerRezept(...a);},checkPrescriptionCompliance:()=>({}),certsMap:new Map(),kasseAbrechnungsbereit:()=>true,istHarterRiegel:()=>false,_physioHinweise:()=>[],kassenanteil,...result});
  return {...result,rechnungen};
}
for(const index of [1,undefined,-1,'0',false]) {
  test(`Auswahl sperrt Index ${String(index)} ohne Rechnung oder 0-Euro-Ersatz`,()=>{
    const r=zeilen(rx([0,index]));assert.equal(r.rechnungen,0);assert.equal(r.zeilen.length,0);
    const f=r.fehlerhaft[0];assert.equal(f.uebersteuerbar,false);assert.equal(f.zeile.soll,null);assert.equal(f.zeile.brutto,null);assert.equal(f.zeile.blockiert,true);
    assert.match(f.gruende[0],/Betrag unbekannt/);
    const bekannte=zeilen(rx([0,null]));const gruppen=baueGruppen([...r.zeilen,...bekannte.zeilen]);
    assert.equal(gruppen[0].zeilen.length,1);assert.equal(gruppen[0].brutto,40);
    assert.equal(auswahlStand(gruppen,new Set(['rx'])).zeilen,1);
  });
  test(`DTA sperrt Index ${String(index)} vor Positions-/Preisauflösung`,()=>{
    let preise=0;
    const map=vm.runInNewContext(mapperText+'\nmapPrescriptionToDtaShape',{resolvePreis(){preise++;throw new Error('Preis darf nicht laufen');}});
    assert.throws(()=>map(rx([0,index]),{}),e=>e.status===422&&e.code==='HEILMITTEL_ZUORDNUNG_UNGEKLAERT');assert.equal(preise,0);
  });
}
test('Hauptindex 0/NULL unverändert; geplantes weiteres Heilmittel sperrt nicht',()=>{
  const r=rx([0,null]);r.prescription_sessions.push({status:'planned',heilmittel_index:1});
  const result=zeilen(r);assert.equal(result.rechnungen,1);assert.equal(result.fehlerhaft.length,0);assert.equal(result.zeilen[0].brutto,40);
});
test('Original-Frontendabfrage liefert erbrachte Leistungsindizes an Auswahl',async()=>{
  const rezept=rx([0,1]);let projektion='';
  const supabase={from(table){const q={select(s){if(table==='prescriptions'&&!projektion)projektion=s;return q;},eq(){return q;},neq(){return q;},or(){return q;},order(){return Promise.resolve({data:table==='prescriptions'&&projektion.includes('heilmittel_index')?[rezept]:[]});},then(resolve){return Promise.resolve({data:[]}).then(resolve);}};return q;}};
  const start=ui.indexOf('  const [physioRes, podoRes, certsRes] = await Promise.all(');
  const end=ui.indexOf('\n  if (physioRes.error)',start);
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const daten=await new AsyncFunction('ctx','ownerId','TOPF','PODO_SELECT','PODO_ARBEITSLISTE_OR',ui.slice(start,end)+'\nreturn physioRes.data;')({supabase},'owner','prescriptions','','');
  assert.equal(daten[0].prescription_sessions[1].heilmittel_index,1);
  assert.equal(zeilen(daten[0]).fehlerhaft.length,1);
});
test('DTA-Hauptpositionen 0/NULL bleiben zwei tatsächlich erbrachte Positionen',()=>{
  let preise=0;
  const map=vm.runInNewContext(mapperText+'\nmapPrescriptionToDtaShape',{
    nameParts:()=>({nachname:'Synthetisch',vorname:'Test'}),kartenIkFehler:()=>null,abrechnungscodeFuer:()=> '21',resolvePositionsnummer:x=>x,
    resolvePreis:()=>{preise++;return {preis_eur:7,zuzahlung_eur:1};},buildBelegnummer:()=> 'TEST',icdOhneStrich:x=>x||'',verordnungsartFuer:()=> '1',
    leitsymptomatikAlsBitmaske:()=> '000',heilmittelBereichFuer:()=> 'B',therapiefrequenzFuer:()=> '1',frequenzToDigit:()=> '1',isUnter18:()=>false,
    tarifkennzeichenAusLegs:()=> 'TEST',legsFuerSector:()=> 'TEST',
  });
  const r=rx([0,null]);r.prescription_sessions.push({status:'planned',heilmittel_index:1});
  const result=map(r,{});assert.equal(preise,2);assert.equal(result.sessions.length,2);assert.ok(result.sessions.every(s=>s.positionsnummer==='X0501'&&s.einzelbetrag===7));
});
test('Alle eingebetteten Quellen projizieren Index; unbekannte Zeile zeigt keinen Nullbetrag',()=>{
  for(const source of [ui,backend]) {
    const projektionen=[...source.matchAll(/prescription_sessions\s*\(([^)]*)\)/g)].filter(m=>!m[1].includes('`'));
    assert.ok(projektionen.length>0);
    for(const p of projektionen) assert.match(p[1],/heilmittel_index/);
  }
  assert.match(ui,/zeile\.soll === null \? 'Betrag unbekannt'/);
});
