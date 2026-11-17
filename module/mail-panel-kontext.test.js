import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('P3-5a: Patientenpost-Versandstatus bleibt im Ursprungsbereich',async()=>{
 const s=readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
 const open=s.slice(s.indexOf('function openComposeModal(draft)'),s.indexOf("document.getElementById('composeDiscardBtn').addEventListener"));
 const send=s.slice(s.indexOf("document.getElementById('composeSendBtn').addEventListener"),s.indexOf('function aiAddMsg('));
 let click;const messages=[];const nodes=new Map();const doc={getElementById:id=>{if(!nodes.has(id))nodes.set(id,{value:'',dataset:{},textContent:'',addEventListener:(name,fn)=>{click=fn;}});return nodes.get(id);}};
 const c=vm.createContext({activePanel:'b2c',document:doc,currentDraftContactId:null,currentSession:{user:{id:'owner',email:'qa@example.invalid'}},currentProfile:{},gmailConnectedEmail:'',getMailSignaturen:()=>({entwurf(){},auswahl:()=>null}),openModal(){},closeModal(){},t:String,supabase:{auth:{getSession:async()=>({data:{session:{access_token:'synthetic'}}})},from:()=>({insert:async()=>({})})},API:'/api',fetch:async()=>({json:async()=>({success:true})}),getOwnerId:()=> 'owner',window:{},aiAddMsg:(...a)=>messages.push(a),showToast(){}});
 vm.runInContext(open+send,c);c.draft={contact_id:'contact',to_email:'qa@example.invalid',to_name:'Test',subject:'Test',body:'Nur synthetisch'};vm.runInContext('openComposeModal(draft)',c);c.activePanel='b2b';await click();
 assert.equal(messages.length,1);assert.equal(messages[0][2],'b2cAiMessages');
});
