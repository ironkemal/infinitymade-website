import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const source = readFileSync(new URL('../dashboard.js', import.meta.url), 'utf8');
const body = source.slice(source.indexOf('(async function renderIkMissingBanner()'), source.indexOf('  renderOvEmpChips();', source.indexOf('(async function renderIkMissingBanner()')));
for (const ik of ['460000000', null]) test(`IK-Banner liest Profil-IK ${ik}`, async () => {
  const el = { hidden: false, innerHTML: '' };
  await vm.runInNewContext(body, { currentProfile: { id: 'owner', role: 'owner', ik_number: ik }, document: { getElementById: () => el }, supabase: { from: () => { throw new Error('Zertifikat ist keine Profil-IK'); } } });
  assert.equal(el.hidden, !!ik);
  if (!ik) assert.match(el.innerHTML, /IK-Nummer fehlt/);
});

test('IK-Speichern in Rechnungsdaten aktualisiert Banner sofort', () => {
 const ende = source.indexOf('  abrechnungsprofilCacheLeeren();', source.indexOf("ik_number: v('setIkNumber')"));
 const start = source.lastIndexOf('  Object.assign(currentProfile, patch);', ende);
 const code = source.slice(start, ende); const el = {hidden:false,toggleAttribute(name,an){assert.equal(name,'hidden');this.hidden=an;}};
 const c={currentProfile:{},patch:{ik_number:'460000000'},Event:class {},document:{getElementById:()=>el,dispatchEvent(){}}};
 vm.runInNewContext(code,c);assert.equal(el.hidden,true);c.patch.ik_number=null;vm.runInNewContext(code,c);assert.equal(el.hidden,false);
});
