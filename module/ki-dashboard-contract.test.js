import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateTaskPayload} from '../api-backend/ai/ki-schema.js';
const source=fs.readFileSync(new URL('../dashboard.js',import.meta.url),'utf8');
function extract(name) {const start=source.indexOf(`async function ${name}(`);assert.ok(start>=0);const end=name==='loadSettings' ? source.indexOf('\nfunction updateBrandingLogoPreview(',start) : source.indexOf('\n}',start)+2;return source.slice(start,end);}
test('real dashboard B2B mapping satisfies closed backend payload schema',async()=>{
 let captured;
 const code=extract('runB2bMailDraft');
 const run=new Function('b2bCache','getMailOwnerInfo','runMailDraftInUi','makeKiUiDependencies','API','supabase','currentProfile','openModal','closeModal','zeigeKiRueckfrageDialog','aiAddMsg','openComposeModal',code+'\nreturn runB2bMailDraft("Synthetic Anfrage");');
 await run([{id:'synthetic-id',company_name:'Synthetic Praxis',contact_name:'Synthetic User',email:'synthetic@example.invalid',phone:'030123456',notes:''}],()=>({business_name:'Synthetic Praxis',sector:'physiotherapy'}),async options=>{captured=options;},()=>({dispose(){}}),'/api',{}, {role:'owner'},()=>{},()=>{},()=>{},()=>{},()=>{});
 assert.equal(captured.contacts[0].company,'Synthetic Praxis');
 assert.ok(!Object.hasOwn(captured.contacts[0],'company_name'));
 assert.doesNotThrow(()=>validateTaskPayload('b2b-draft',{intent:captured.intent,contacts:captured.contacts,owner_info:captured.ownerInfo},{mode:'direkt',allowFreeText:true}));
});
test('KI settings mount precedes unrelated async integrations and billing render',async()=>{
 const body=extract('loadSettings');
 const mount=body.indexOf('mountKiEinstellungen(');
 assert.ok(mount>=0);
 assert.ok(mount<body.indexOf("await supabase.from('calendar_integrations')"));
 assert.ok(mount<body.indexOf('await loadAerzte()'));
 assert.ok(mount<body.indexOf('renderAbrechnungSettings('));
 // Execute actual leading dashboard statements: no Supabase dependency needed.
 const prefix=body.slice(0,body.indexOf("  document.getElementById('setBiz')"))+'\n}';
 let mounted=false;
 const run=new Function('document','mountKiEinstellungen','API','supabase','currentProfile','currentSession','getOwnerId','showToast','showConfirmModal',prefix+'\nreturn loadSettings();');
 await run({getElementById:()=>({})},async()=>{mounted=true;},'/api',{}, {role:'owner'}, {user:{id:'synthetic'}},()=> 'synthetic',()=>{},()=>{});
 assert.equal(mounted,true);
});

for(const kind of ['B2b','B2c']) test(`real dashboard ${kind} nullable DB fields satisfy backend string contract`,async()=>{
 let captured;
 const name=`run${kind}MailDraft`;
 const cache=kind==='B2b' ? [{id:'synthetic',company_name:'Synthetic Praxis',contact_name:null,email:null,phone:null,notes:null}] : [{id:'synthetic',title:null,email:null,phone:null}];
 const run=new Function(kind==='B2b'?'b2bCache':'b2cCache','getMailOwnerInfo','runMailDraftInUi','makeKiUiDependencies','API','supabase','currentProfile','openModal','closeModal','zeigeKiRueckfrageDialog','aiAddMsg','openComposeModal',extract(name)+`\nreturn ${name}("Synthetic Anfrage");`);
 await run(cache,()=>({business_name:'',sector:'physiotherapy'}),async options=>{captured=options;},()=>({dispose(){}}),'/api',{}, {role:'owner'},()=>{},()=>{},()=>{},()=>{},()=>{});
 const contact=captured.contacts[0];
 assert.equal(contact.email,'');assert.equal(contact.phone,'');assert.equal(contact.notes,'');
 assert.equal(kind==='B2b' ? contact.contact_name : contact.name,'');
 assert.doesNotThrow(()=>validateTaskPayload(captured.task,{intent:captured.intent,contacts:captured.contacts,owner_info:captured.ownerInfo},{mode:'direkt',allowFreeText:true}));
});
test('actual getMailOwnerInfo maps nullable profile strings to empty strings',()=>{
 const start=source.indexOf('function getMailOwnerInfo()');
 const code=source.slice(start,source.indexOf('\n}',start)+2);
 const read=new Function('currentProfile',code+'\nreturn getMailOwnerInfo();');
 const result=read({business_name:null,b2b_sender_name:null,city:null,sector:null,system_prompt:null});
 assert.deepEqual(result,{business_name:'',sender_name:'',city:'',sector:'',extra_context:''});
 assert.doesNotThrow(()=>validateTaskPayload('b2b-draft',{intent:'Synthetic',contacts:[],owner_info:result},{mode:'direkt',allowFreeText:true}));
});
