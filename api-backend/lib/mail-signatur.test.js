import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';
import {pruefeSignatur,mailMitSignatur} from './mail-signatur.js';
const src=fs.readFileSync(new URL('../server.js',import.meta.url),'utf8');
/**
 * @typedef {{
 *   statusCode: number,
 *   value: { success?: boolean } | undefined,
 *   status: (n: number) => MockRes,
 *   json: (x: { success?: boolean }) => MockRes,
 * }} MockRes
 * @typedef {{ userId?: string, text?: string, html?: string }} SentMail
 * @typedef {(req: { auth: { userId: string }, body: Record<string, unknown> }, res: MockRes) => Promise<unknown>} RouteHandler
 */
function fixture(){
  /** @type {RouteHandler | undefined} */
  let handler;
  /** @type {SentMail[]} */
  const sent=[];
  vm.runInNewContext(
    src.slice(src.indexOf("app.post('/api/gmail/send'"),src.indexOf("app.post('/api/apify/search'")),
    {
      app:{post:(/** @type {unknown[]} */ ...args)=>{ handler = /** @type {RouteHandler | undefined} */ (args.at(-1)); }},
      requireAuthAI(){},
      pruefeSignatur,
      mailMitSignatur,
      supabase:{},
      newOAuthClient(){},
      fetchWithTimeout(){},
      sendeUeberGmail:async (/** @type {SentMail} */ opts)=>{sent.push(opts);return{messageId:'mock'};},
      console:{error(){}},
    }
  );
  return {
    sent,
    /** @param {Record<string, unknown>} body */
    call:async body=>{
      /** @type {MockRes} */
      const res={
        statusCode:200,
        value:undefined,
        status(n){this.statusCode=n;return this;},
        json(x){this.value=x;return this;},
      };
      await handler?.({auth:{userId:'owner'},body},res);
      return res;
    },
  };
}
test('gmail route rejects malformed footer without invoking sender',async()=>{const f=fixture();const r=await f.call({to_email:'qa@example.org',subject:'Test',body:'Hallo',signatur:{html:'<script>'}});assert.equal(r.statusCode,400);assert.equal(f.sent.length,0);});
test('gmail route pins sender and builds safe footer; no KI instruction appendix',async()=>{const f=fixture();const r=await f.call({userId:'foreign',to_email:'qa@example.org',subject:'Test',body:'Hallo',signatur:{praxis:'QA<script>',logoUrl:'javascript:1'}});assert.equal(r.value?.success,true);assert.equal(f.sent[0].userId,'owner');assert.equal(f.sent[0].text,'Hallo\n\nQA<script>');assert.ok(!f.sent[0].html?.includes('<script>'));assert.ok(!f.sent[0].html?.includes('javascript:'));});
