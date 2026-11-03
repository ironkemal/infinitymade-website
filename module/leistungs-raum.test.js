import test from 'node:test';
import assert from 'node:assert/strict';
import { ausstattungsOptionen, anforderungenHtml, oeffneLeistungsRaum, leistungsRaumPayload } from './leistungs-raum.js';

function formFixture(checks = []) {
  const feld = { innerHTML:'', parentNode:{}, querySelector: () => ({ addEventListener() {} }), querySelectorAll: () => [] };
  return { feld, querySelector: () => feld, querySelectorAll: () => checks };
}
function dbFixture(error, raeume = []) {
  return { from(table) { return { select() { return { eq() { return table === 'services' ? { limit:async () => ({error}) } : Promise.resolve({data:raeume,error:null}); } }; } }; } };
}

test('Ausstattungswortschatz vereinigt vorhandene und nötige Punkte ohne HTML-Injektion', () => {
  assert.deepEqual(ausstattungsOptionen([{ausstattung:['Liege','Becken']}], ['Liege','Licht']), ['Becken','Licht','Liege']);
  const html = anforderungenHtml(['<img src=x>'], ['<img src=x>']);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('checked'));
  assert.ok(html.includes('<label'));
});
test('Editor speichert angehakte benötigte Ausstattung, nicht vorhandene ungewählte Punkte', async () => {
  const form = formFixture([{value:'Liege',checked:true},{value:'Becken',checked:false}]);
  oeffneLeistungsRaum({form,supabase:dbFixture(null,[{ausstattung:['Liege','Becken']}]),ownerId:'o',anforderungen:['Liege']});
  assert.deepEqual(await leistungsRaumPayload(form), {ok:true,felder:{raum_ausstattung:['Liege']}});
});
test('Alte Datenbank behält Leistungsweg ohne unbekannte Spalte, technische Fehler blockieren', async () => {
  const alt = formFixture();
  oeffneLeistungsRaum({form:alt,supabase:dbFixture({code:'42703'}),ownerId:'o'});
  assert.deepEqual(await leistungsRaumPayload(alt), {ok:true,felder:{}});
  assert.match(alt.feld.innerHTML,/derzeit nicht verfügbar/);
  const kaputt = formFixture();
  oeffneLeistungsRaum({form:kaputt,supabase:dbFixture({code:'42501'}),ownerId:'o'});
  assert.equal((await leistungsRaumPayload(kaputt)).ok,false);
});
test('Verspätete alte Editorantwort überschreibt neu geöffneten Editor nicht', async () => {
  let resolve;
  const pending = new Promise(r => { resolve = r; });
  const old = {from:()=>({select:()=>({eq:()=>({limit:()=>pending})})})};
  const form = formFixture([{value:'Neu',checked:true}]);
  oeffneLeistungsRaum({form,supabase:old,ownerId:'o',anforderungen:['Alt']});
  const oldPayload = leistungsRaumPayload(form);
  oeffneLeistungsRaum({form,supabase:dbFixture(null),ownerId:'o',anforderungen:['Neu']});
  assert.deepEqual(await leistungsRaumPayload(form),{ok:true,felder:{raum_ausstattung:['Neu']}});
  resolve({error:{code:'42703'}});
  assert.equal((await oldPayload).ok,false);
  assert.match(form.feld.innerHTML,/Neu/);
  assert.doesNotMatch(form.feld.innerHTML,/Alt/);
});
