import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as front from './mail-signatur.js';
import * as back from '../api-backend/lib/mail-signatur.js';
import { baueMimeNachricht } from '../api-backend/lib/gmail-senden.js';
import { signaturEinstellungen, vorlageAusProfil, importiereMailVorlage } from './mail-signatur-editor.js';
const s={id:'a',name:'Praxis',praxis:'QA <Praxis>',adresse:'A\nB',logoUrl:'https://example.org/logo.png',layout:'kompakt',zusatz:'<script>alert(1)</script>'};
test('frontend/backend exact renderer parity',()=>assert.equal(fs.readFileSync(new URL('./mail-signatur.js',import.meta.url),'utf8'),fs.readFileSync(new URL('../api-backend/lib/mail-signatur.js',import.meta.url),'utf8')));
test('escaped body and footer, logo in both layouts',()=>{for(const layout of ['kompakt','klassisch']){const r=front.mailMitSignatur('<img onerror=alert(1)>',{...s,layout});assert.ok(r.html.includes('&lt;script&gt;'));assert.ok(!r.html.includes('<script>'));assert.ok(r.html.includes('&lt;img onerror'));assert.ok(r.html.includes('https://example.org/logo.png'));assert.ok(r.text.includes('QA <Praxis>'));}});
test('unsafe URLs never render',()=>{for(const logoUrl of ['javascript:alert(1)','https://user:pass@example.org/a','http://example.org','https://example.org/\nx'])assert.equal(front.normalisiereSignatur({...s,logoUrl}).logoUrl,'');});
test('reject oversized, arbitrary html and nonobject request',()=>{assert.equal(back.pruefeSignatur({zusatz:'a'.repeat(2001)}),false);assert.equal(back.pruefeSignatur({html:'hi'}),false);assert.equal(back.pruefeSignatur([]),false);assert.equal(back.pruefeSignatur(null),true);});
test('legacy no footer retains plain text',()=>{assert.deepEqual(front.mailMitSignatur('Hallo',null),{text:'Hallo',html:null});const raw=baueMimeNachricht({from:'a',to:'b',subject:'c',text:'Hallo'});assert.ok(raw.includes('text/plain'));assert.ok(!raw.includes('text/html'));});
test('MIME alternative nests within mixed attachments and UTF8 survives',()=>{const r=front.mailMitSignatur('Grüße',s),raw=baueMimeNachricht({from:'a',to:'b',subject:'Grüße',...r,attachments:[{filename:'rechnung.pdf',content:Buffer.from('PDF'),contentType:'application/pdf'}]});assert.ok(raw.includes('multipart/mixed'));assert.ok(raw.includes('multipart/alternative'));assert.ok(raw.includes('text/plain'));assert.ok(raw.includes('text/html'));assert.ok(raw.includes('application/pdf'));assert.ok(raw.includes(Buffer.from(r.html).toString('base64').slice(0,60)));});
test('settings empty/malformed and max ten; invalid standard ignored',()=>{assert.deepEqual(signaturEinstellungen({}),{vorlagen:[],standard_id:''});const r=signaturEinstellungen({mail_signatur_einstellungen:{vorlagen:Array(12).fill(s),standard_id:'missing'}});assert.equal(r.vorlagen.length,10);assert.equal(r.standard_id,'');});
test('owner branding prefill uses existing canonical fields',()=>{const v=vorlageAusProfil({business_name:'QA',praxis_inhaber:'Person',street:'Weg',house_number:'2',zip:'12345',city:'Ort',phone:'123'},'a');assert.equal(v.praxis,'QA');assert.equal(v.adresse,'Weg 2\n12345 Ort');assert.equal(v.telefon,'123');});

test('own JSON template import validates structure and assigns new identity',()=>{assert.equal(importiereMailVorlage(JSON.stringify({...s,id:'old'}),'new').id,'new');for(const x of ['{"html":"<script>"}','null','[]','{"name":""}', 'a'.repeat(16001)])assert.throws(()=>importiereMailVorlage(x,'new'));});
