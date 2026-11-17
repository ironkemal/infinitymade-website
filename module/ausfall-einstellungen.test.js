import test from 'node:test';
import assert from 'node:assert/strict';
import {renderAusfallSettings} from './ausfall-einstellungen.js';
test('P2-7: aktivierte Ausfallgebühr ohne positiven Betrag wird bereits abgewiesen',async()=>{
  for(const value of ['', '0', '-1']){
    let speichern,writes=0;const toasts=[];const ids=['settingsAusfallSection','setAusfallEnabled','setAusfallFields','setAusfallMode','setAusfallAmount','setAusfallAmountLabel','setAusfallCutoff','setAusfallHinweis','setAusfallSaveBtn'];
    const dom=Object.fromEntries(ids.map(id=>[id,{dataset:{},value:'',checked:false,addEventListener:(event,fn)=>{if(id==='setAusfallSaveBtn')speichern=fn;}}]));
    global.document={getElementById:id=>dom[id]};
    renderAusfallSettings({profile:{role:'owner'},config:{ausfall_enabled:true},supabase:{from:()=>{writes++;throw Error('kein DB-Aufruf');}},showToast:m=>toasts.push(m)});
    dom.setAusfallAmount.value=value;await speichern();assert.equal(writes,0);assert.ok(toasts.some(m=>/Betrag/.test(m)));
  }
});
