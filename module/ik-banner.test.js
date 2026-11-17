import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('(async function renderIkMissingBanner()'), source.indexOf('  renderOvEmpChips();', source.indexOf('(async function renderIkMissingBanner()')));
for (const [ik, zertifikat] of [['460000000', null], [null, '460000000'], [null, null]]) test(`IK-Banner: Profil ${ik}, Zertifikat ${zertifikat}`, async () => {
  const el = { hidden: false, innerHTML: '', dataset: {} };
  const query = {select(){return this;},eq(){return this;},async maybeSingle(){return {data: zertifikat ? {ik_nummer:zertifikat} : null};}};
  await vm.runInNewContext(body, { currentProfile: { id: 'owner', role: 'owner', ik_number: ik },getOwnerId:()=> 'owner', document: { getElementById: () => el }, supabase: { from: () => query } });
  assert.equal(el.hidden, !!(ik || zertifikat));
  if (!ik && !zertifikat) assert.match(el.innerHTML, /IK-Nummer fehlt/);
});

test('IK-Speichern in Rechnungsdaten aktualisiert Banner sofort', () => {
 const ende = source.indexOf('  abrechnungsprofilCacheLeeren();', source.indexOf("ik_number: v('setIkNumber')"));
 const start = source.lastIndexOf('  Object.assign(currentProfile, patch);', ende);
 const code = source.slice(start, ende); const el = {hidden:false,dataset:{},toggleAttribute(name,an){assert.equal(name,'hidden');this.hidden=an;}};
 const c={currentProfile:{},patch:{ik_number:'460000000'},Event:class {},document:{getElementById:()=>el,dispatchEvent(){}}};
 vm.runInNewContext(code,c);assert.equal(el.hidden,true);c.patch.ik_number=null;vm.runInNewContext(code,c);assert.equal(el.hidden,false);el.dataset.zertifikatIk="460000000";vm.runInNewContext(code,c);assert.equal(el.hidden,true);
});

test('IK-Speichern unter Abrechnung merkt sich die Zertifikat-IK für den Banner', async () => {
  const quelle = readFileSync(new URL('./abrechnung-einstellungen.js', import.meta.url), 'utf8');
  const start = quelle.indexOf("    const banner = document.getElementById('ik-missing-banner');");
  const ende = quelle.indexOf("    deps.showToast(ik ? 'IK gespeichert ✓' : 'IK entfernt.');", start);
  const el = { hidden: false, dataset: {} };
  const deps = { supabase: { from: () => ({ upsert: async () => ({ error: null }) }) } };
  await vm.runInNewContext(`(async () => {${quelle.slice(start, ende)}})()`, { ik: '460000000', ownerId: 'o', deps, document: { getElementById: () => el }, console });
  assert.equal(el.dataset.zertifikatIk, '460000000');
  assert.equal(el.hidden, true);
});
