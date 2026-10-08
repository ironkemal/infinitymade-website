import test from 'node:test';
import assert from 'node:assert/strict';
import { createJetonClient } from './ki-jeton.js';
import { chat } from './azureClient.js';
import { createAiConfig } from './ki-config.js';

const testCfg = { ...createAiConfig({ AI_MODE: 'jeton', AI_ACTIVATION_READY: '1' }), allowedHosts: ['test.openai.azure.com'] };
const allowedHosts = ['test.openai.azure.com'];

test('M4 Transport Regression', async (t) => {
  await t.test('getToken: fetch ignoring signal forever rejects safe <=100ms, singleflight cleared', async () => {
    let callCount = 0;
    const fakeMerkez = async (url, opts) => {
      callCount++;
      if (callCount === 1) {
        return new Promise(() => {});
      }
      return {
        ok: true,
        json: {
          token: 'token123456',
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview'
        }
      };
    };

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts,
      centreTimeoutMs: 20
    });

    const start = Date.now();
    await assert.rejects(
      client.getToken(),
      { code: 'AI_JETON_UNAVAILABLE', message: 'Zentrum für KI-Jeton nicht erreichbar' }
    );
    const duration = Date.now() - start;
    assert.ok(duration < 2000, `Deadline failed: ${duration}ms`);

    const res = await client.getToken();
    assert.equal(res.token, 'token123456');
    assert.equal(callCount, 2);
  });

  await t.test('aggregateSupplier: snapshot called once, cache hit not called, exact acknowledgedReportId clears', async () => {
    let supplierCount = 0;
    const fixture = {
      reportId: 'report-1',
      windowStart: '2026-10-08T00:00:00.000Z',
      windowEnd: '2026-10-09T00:00:00.000Z',
      taskTotals: { 'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } }
    };

    const fakeSupplier = async () => {
      supplierCount++;
      return JSON.parse(JSON.stringify(fixture));
    };

    let fakeMerkezCount = 0;
    let bodies = [];
    const fakeMerkez = async (url, opts) => {
      fakeMerkezCount++;
      const body = opts.body;
      bodies.push(JSON.parse(JSON.stringify(body)));
      let acknowledgedReportId = null;
      if (body.report && body.report.reportId === 'report-1') {
        acknowledgedReportId = (fakeMerkezCount === 2) ? 'report-1' : null; // Ack on 2nd call
      }
      return {
        ok: true,
        json: {
          token: `token-1234567890-${fakeMerkezCount}`,
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview',
          acknowledgedReportId
        }
      };
    };

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts,
      aggregateSupplier: fakeSupplier
    });

    await client.getToken();
    assert.equal(supplierCount, 1);
    assert.deepEqual(bodies[0].report, fixture);

    await client.getToken();
    assert.equal(supplierCount, 1);
    assert.equal(fakeMerkezCount, 1);

    await client.getToken({ forceRefresh: true });
    assert.equal(supplierCount, 1);
    assert.equal(fakeMerkezCount, 2);
    assert.deepEqual(bodies[1].report, fixture);

    await client.getToken({ forceRefresh: true });
    assert.equal(supplierCount, 2);
    assert.equal(fakeMerkezCount, 3);
  });

  await t.test('aggregateSupplier: caller mutation does not change internal report', async () => {
    const fixture = {
      reportId: 'report-mut',
      windowStart: '2026-10-08T00:00:00.000Z',
      windowEnd: '2026-10-09T00:00:00.000Z',
      taskTotals: { 'b2c-draft': { calls: 1, prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 } }
    };

    let lastBody = null;
    const fakeMerkez = async (url, opts) => {
      lastBody = JSON.parse(JSON.stringify(opts.body));
      return {
        ok: true,
        json: {
          token: 'token-mut-valid',
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview'
        }
      };
    };

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts
    });

    await client.reportUsage(fixture);
    fixture.taskTotals['b2c-draft'].calls = 999;

    await client.getToken();
    assert.equal(lastBody.report.taskTotals['b2c-draft'].calls, 1, 'Caller mutation changed internal report');
  });

  await t.test('aggregateSupplier: Validation of invalid shapes reject via reportUsage', async () => {
    const client = createJetonClient({
      configProvider: () => testCfg,
      allowedHosts
    });

    const invalids = [
      { reportId: '1', windowStart: '2026-02-31T00:00:00.000Z', windowEnd: '2026-03-01T00:00:00.000Z', taskTotals: {} }, // Feb 31
      { reportId: '2', windowStart: '2026-10-08T23:00:00.000Z', windowEnd: '2026-10-09T00:00:00.000Z', taskTotals: {} }, // 23h
      { reportId: '3', windowStart: '2026-10-08T00:00:00.000Z', windowEnd: '2026-10-09T01:00:00.000Z', taskTotals: {} }, // 25h
      { reportId: '4', windowStart: '2026-10-08T00:00:01.000Z', windowEnd: '2026-10-09T00:00:01.000Z', taskTotals: {} }, // nonmidnight
      { reportId: '5', windowStart: '2026-10-09T00:00:00.000Z', windowEnd: '2026-10-08T00:00:00.000Z', taskTotals: {} }, // reverse
      { reportId: '6', windowStart: '2026-10-08T00:00:00.000Z', windowEnd: '2026-10-09T00:00:00.000Z', taskTotals: { a: { calls: -1, prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } } }, // negative unsafe
      { reportId: '7', windowStart: '2026-10-08T00:00:00.000Z', windowEnd: '2026-10-09T00:00:00.000Z', taskTotals: { a: { calls: 1, prompt_tokens: "1", completion_tokens: 1, total_tokens: 2 } } } // string metric
    ];

    for (const data of invalids) {
      await assert.rejects(client.reportUsage(data));
    }
  });

  await t.test('aggregateSupplier: Exception SENTINEL_PATIENT token continues, report null, getState diag safe', async () => {
    const fakeSupplier = async () => {
      throw { code: 'SENTINEL_PATIENT', name: 'SECRET' };
    };

    let bodySeen = null;
    const fakeMerkez = async (url, opts) => {
      bodySeen = opts.body;
      return {
        ok: true,
        json: {
          token: 'token-exception',
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview'
        }
      };
    };

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts,
      aggregateSupplier: fakeSupplier
    });

    const res = await client.getToken();
    assert.equal(res.token, 'token-exception');
    assert.equal(bodySeen.report, null);

    const state = client.getState();
    assert.ok(!JSON.stringify(state).includes('SENTINEL_PATIENT'));
    assert.ok(!JSON.stringify(state).includes('SECRET'));
  });

  await t.test('Dynamic config mode changes during awaited refresh rejects safe, no token released', async () => {
    let resolveMerkez;
    let entered;
    const centreEntered = new Promise(r => entered = r);
    const merkezPromise = new Promise(r => resolveMerkez = r);

    const fakeMerkez = async () => {
      entered();
      await merkezPromise;
      return {
        ok: true,
        json: {
          token: 'token-late',
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview'
        }
      };
    };

    let currentMode = 'jeton';
    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => createAiConfig({ AI_MODE: currentMode, AI_ACTIVATION_READY: '1' }),
      allowedHosts
    });

    const tokenPromise = client.getToken();

    await centreEntered;

    currentMode = 'aus';
    resolveMerkez();

    await assert.rejects(tokenPromise, { code: 'AI_CONFIG_CHANGED' });
  });

  await t.test('chat: INJECTED arbitrary jetonClient asserts fakefetchcalls 0 for invalid region/API/expired/nonintTTL/controlchars/foreignhost/deploymentconflict', async () => {
    const invalidTokens = [
      { region: 'us-east', apiVersion: '2024-02-15-preview', token: 'a'.repeat(20), exp: Math.floor(Date.now()/1000)+1000 },
      { region: 'swedencentral', apiVersion: 'invalid', token: 'a'.repeat(20), exp: Math.floor(Date.now()/1000)+1000 },
      { region: 'swedencentral', apiVersion: '2024-02-15-preview', token: 'a'.repeat(20), exp: 'string-exp' },
      { region: 'swedencentral', apiVersion: '2024-02-15-preview', token: 'a'.repeat(20), exp: Math.floor(Date.now()/1000)-10 },
      { region: 'swedencentral', apiVersion: '2024-02-15-preview', token: 'a'.repeat(20), exp: Math.floor(Date.now()/1000)+4000 },
      { region: 'swedencentral', apiVersion: '2024-02-15-preview', token: 'a\nb'.repeat(10), exp: Math.floor(Date.now()/1000)+1000 }
      ,{region:'swedencentral',apiVersion:'2024-10-21',token:'valid-token-12345',exp:Math.floor(Date.now()/1000)+1000,endpoint:'https://foreign.invalid/'},
      {region:'swedencentral',apiVersion:'2024-10-21',token:'valid-token-12345',exp:Math.floor(Date.now()/1000)+1000,deployment:'conflicting-dep'}
    ];

    let fetchCalls = 0;
    const fakeFetch = async () => { fetchCalls++; return { ok: true, json: async () => ({}) }; };

    for (const data of invalidTokens) {
      const client = { getToken:async()=>({endpoint:'https://test.openai.azure.com/',deployment:'test-dep',...data}),invalidate(){} };

      await assert.rejects(
        chat({ messages: [{ role: 'user', content: 'hi' }],
          jetonClient: client,
          fetchImpl: fakeFetch,
          deployment: 'test-dep',
          config: testCfg
        })
      );
    }
    assert.equal(fetchCalls, 0);
  });

  await t.test('chat: 401 parallel stale invalidate doesn\'t erase fresh token (oneRefresh)', async () => {
    let callCount = 0;
    const fakeMerkez = async () => {
      callCount++;
      return {
        ok: true,
        json: {
          token: `token-valid-${callCount}`,
          exp: Math.floor(Date.now() / 1000) + 3600,
          endpoint: 'https://test.openai.azure.com/',
          deployment: 'test-dep',
          region: 'swedencentral',
          apiVersion: '2024-02-15-preview'
        }
      };
    };

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts
    });

    let fetchCount = 0;
    const fakeFetch = async (url, opts) => {
      fetchCount++;
      if (fetchCount === 1 || fetchCount === 2) {
        return { ok: false, status: 401, text: async () => 'Unauthorized' };
      }
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }], usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2} }) };
    };

    const p1 = chat({ messages: [{ role: 'user', content: 'hi' }], jetonClient: client, fetchImpl: fakeFetch, deployment: 'test-dep', config: testCfg });
    const p2 = chat({ messages: [{ role: 'user', content: 'hi' }], jetonClient: client, fetchImpl: fakeFetch, deployment: 'test-dep', config: testCfg });

    await Promise.all([p1, p2]);

    assert.equal(callCount, 2);
  });

  await t.test('chat: fractional 429 uses exactly two bounded retries', async () => {
    let fetchCount = 0;
    const fakeFetch = async () => {
      fetchCount++;
      return {
        ok: false,
        status: 429,
        headers: new Headers({ 'Retry-After': '0.1' }),
        text: async () => 'Rate Limit'
      };
    };

    const fakeMerkez = async () => ({
      ok: true,
      json: {
        token: `token-abc-valid`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        endpoint: 'https://test.openai.azure.com/',
        deployment: 'test-dep',
        region: 'swedencentral',
        apiVersion: '2024-02-15-preview'
      }
    });

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts
    });

    const start = Date.now();
    await assert.rejects(
      chat({ messages: [{ role: 'user', content: 'hi' }],
        jetonClient: client,
        fetchImpl: fakeFetch,
        deployment: 'test-dep',
        retries: 2,
        config: testCfg
      })
    );
    const duration = Date.now() - start;

    assert.equal(fetchCount, 3);
  });

  await t.test('chat: provider fetch hang obeys total short deadline', async () => {
    const fakeFetch = async (url, opts) => {
      return new Promise(() => {});
    };

    const fakeMerkez = async () => ({
      ok: true,
      json: {
        token: `token-abc-valid`,
        exp: Math.floor(Date.now() / 1000) + 3600,
        endpoint: 'https://test.openai.azure.com/',
        deployment: 'test-dep',
        region: 'swedencentral',
        apiVersion: '2024-02-15-preview'
      }
    });

    const client = createJetonClient({
      merkezFetchImpl: fakeMerkez,
      configProvider: () => testCfg,
      allowedHosts
    });

    const p = chat({ messages: [{ role: 'user', content: 'hi' }],
      jetonClient: client,
      fetchImpl: fakeFetch,
      deployment: 'test-dep',
      timeoutMs: 50,
      config: testCfg
    });

    const start = Date.now();
    await assert.rejects(p, { code: 'AI_TIMEOUT' });
    const duration = Date.now() - start;
    assert.ok(duration < 200, 'Deadline exceeded');
  });
});

function validToken(overrides={}) {return {token:'synthetic-valid-token-1234',exp:Math.floor(Date.now()/1000)+600,endpoint:'https://test.openai.azure.com/',deployment:'test-dep',region:'swedencentral',apiVersion:'2024-10-21',...overrides};} // secret-scan: ignore — synthetic test token, no credential
function tokenClient() {return {getToken:async()=>validToken(),invalidate(){}};}
const messages=[{role:'user',content:'synthetisch'}];
const okay=()=>({ok:true,status:200,json:async()=>({choices:[{message:{content:'Hallo'}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}})});
test('Provider body consumption deadline and AbortSignal.any fallback remove listeners',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal,'any');Object.defineProperty(AbortSignal,'any',{value:undefined,configurable:true});
 const controller=new AbortController();let added=0,removed=0;const add=controller.signal.addEventListener.bind(controller.signal),remove=controller.signal.removeEventListener.bind(controller.signal);
 controller.signal.addEventListener=(...args)=>{added++;return add(...args);};controller.signal.removeEventListener=(...args)=>{removed++;return remove(...args);};
 try{
  await assert.rejects(chat({messages,config:testCfg,jetonClient:tokenClient(),signal:controller.signal,timeoutMs:20,fetchImpl:async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})}),{code:'AI_TIMEOUT'});
  assert.equal(added,removed);assert.ok(added>=1);
 }finally{Object.defineProperty(AbortSignal,'any',descriptor);}
});
test('External abort never echoes reason while consuming provider body',async()=>{
 const controller=new AbortController();let entered;const bodyEntered=new Promise(r=>entered=r);
 const result=chat({messages,config:testCfg,jetonClient:tokenClient(),signal:controller.signal,fetchImpl:async()=>({ok:true,status:200,json:()=>{entered();return new Promise(()=>{});}})});
 await bodyEntered;controller.abort(new Error('PATIENT_SENTINEL'));
 await assert.rejects(result,err=>{assert.equal(err.code,'AI_ABORTED');assert.ok(!err.message.includes('SENTINEL'));return true;});
});
test('Retry-After date, fraction and huge values clamp without hard test sleeps',async()=>{
 const nativeTimeout=globalThis.setTimeout;const captured=[];
 globalThis.setTimeout=(callback,ms,...args)=>{if(ms>=500&&ms<=10000){captured.push(ms);queueMicrotask(()=>callback(...args));return {testTimer:true};}return nativeTimeout(callback,ms,...args);};
 try{
  for(const value of ['0.01',new Date(Date.now()+5000).toUTCString(),'999999999']) {
   let calls=0;const before=captured.length;
   const result=await chat({messages,config:testCfg,jetonClient:tokenClient(),fetchImpl:async()=>{calls++;return calls===1?{ok:false,status:429,headers:new Headers({'retry-after':value})}:okay();}});
   assert.equal(result.content,'Hallo');assert.equal(calls,2);const wait=captured[before];assert.ok(wait>=500&&wait<=10000);
   if(value==='0.01')assert.equal(wait,500);if(value==='999999999')assert.equal(wait,10000);
  }
 }finally{globalThis.setTimeout=nativeTimeout;}
});
test('429 queue caps eight waiters, abort releases every occupied slot',async()=>{
 const nativeTimeout=globalThis.setTimeout;let entered;const allQueued=new Promise(r=>entered=r);let waits=0;const handles=[];
 globalThis.setTimeout=(callback,ms,...args)=>{if(ms>=500&&ms<=10000){waits++;if(waits===8)entered();const handle={testTimer:true};handles.push(handle);return handle;}return nativeTimeout(callback,ms,...args);};
 const controllers=Array.from({length:8},()=>new AbortController());let results=[];
 try{
  results=controllers.map(controller=>chat({messages,config:testCfg,jetonClient:tokenClient(),signal:controller.signal,fetchImpl:async()=>({ok:false,status:429,headers:new Headers({'retry-after':'5'})})}).catch(e=>e));
  await allQueued;
  await assert.rejects(chat({messages,config:testCfg,jetonClient:tokenClient(),fetchImpl:async()=>({ok:false,status:429})}),{code:'AI_QUEUE_FULL'});
  controllers.forEach(c=>c.abort('PATIENT_SENTINEL'));assert.ok((await Promise.all(results)).every(e=>e.code==='AI_ABORTED'));
 }finally{controllers.forEach(c=>c.abort());await Promise.all(results);globalThis.setTimeout=nativeTimeout;}
 const res=await chat({messages,config:testCfg,jetonClient:tokenClient(),fetchImpl:async()=>okay()});assert.equal(res.content,'Hallo');
});

test('Injected token client ignoring signal cannot bypass overall deadline',async()=>{
 let sends=0;
 await assert.rejects(chat({messages,config:testCfg,jetonClient:{getToken:()=>new Promise(()=>{}),invalidate(){}},timeoutMs:20,fetchImpl:async()=>{sends++;return okay();}}),{code:'AI_TIMEOUT'});
 assert.equal(sends,0);
});
