import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { slotParameter } from './slot-parameter.js';
const source = readFileSync(new URL('../server.js', import.meta.url), 'utf8');
const routeSource = source.slice(source.indexOf("app.post('/api/booking/get-slots'"), source.indexOf("app.post('/api/booking/create'"));
function fixture() {
  let handler; const calls = [];
  vm.runInNewContext(routeSource, {
    app: { post: (_path, _limiter, fn) => { handler = fn; } }, slotsLookupLimiter() {},
    slotParameter, SLOT_STEP_MINUTES: 15, console: { error() {} },
    getAvailableSlots: async (...args) => { calls.push(args); return { slots: ['09:00', '09:15'] }; }
  });
  return { calls, async run(patch) {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await handler({ body: { userId: 'synthetic', date: '2099-06-01', duration: 30, ...patch } }, res);
    return res;
  } };
}
for (const patch of [{step:-1},{step:0},{step:'abc'},{step:0.1},{step:'5junk'},{duration:0},{duration:-30},{duration:'abc'},{buffer:-1},{buffer:'junk'}]) {
  test(`public slots rejects ${JSON.stringify(patch)} before engine call`, async () => {
    const f = fixture(); const r = await f.run(patch);
    assert.equal(r.code, 400); assert.equal(f.calls.length, 0);
  });
}
test('valid public lookup preserves slots and default cadence', async () => {
  const f = fixture(); const r = await f.run({});
  assert.equal(r.code, 200); assert.deepEqual(Array.from(r.body.slots), ['09:00','09:15']);
  assert.equal(f.calls[0][4], 0); assert.equal(f.calls[0][5], 15);
});

for (const value of [0,-1,0.1,Infinity,NaN,null,true,[],{},'', ' ', '1e2','5junk',1441,Number.MAX_SAFE_INTEGER]) {
  test(`strict step/duration reject ${String(value)}`, () => {
    assert.equal(slotParameter({duration:30,step:value}).ok,false);
    assert.equal(slotParameter({duration:value}).ok,false);
  });
}
test('minute strings and day boundaries remain supported', () => {
  assert.deepEqual(slotParameter({duration:'30',buffer:'0',step:'5'}),{ok:true,duration:30,buffer:0,step:5});
  assert.equal(slotParameter({duration:1440,buffer:1440,step:1440}).ok,true);
});
test('internal slot engine rejects invalid values before database reads', async () => {
  const start=source.indexOf('async function getAvailableSlots(');
  const end=source.indexOf('// 2. Booking Routes',start);
  let reads=0;
  const get=vm.runInNewContext(source.slice(start,end)+';getAvailableSlots',{
    slotParameter,SLOT_STEP_MINUTES:15,
    berlinDayOfWeek:()=>{reads++;throw new Error('invalid input reached calendar/DB');}
  });
  for (const args of [[30,0,-1],[0,0,15],[30,-1,15],[30,0,0],[30,0,'junk']]) {
    const result=await get('synthetic','2099-06-01',args[0],null,args[1],args[2]);
    assert.equal(result.reason,'invalid_slot_params');
  }
  assert.equal(reads,0);
});

test('actual slot engine keeps valid numeric/string lookup, buffer and bounded cadence', async () => {
  const start=source.indexOf('async function getAvailableSlots(');
  const end=source.indexOf('// 2. Booking Routes',start);
  const supabase={from(table){
    const data=table==='working_hours'?{is_active:true,start_time:'09:00',end_time:'10:00'}:
      ['bookings','breaks','time_offs'].includes(table)?[]:null;
    const q={}; for(const key of ['select','eq','is','gte','lte','in']) q[key]=()=>q;
    q.single=q.maybeSingle=async()=>({data,error:null});
    q.then=(resolve,reject)=>Promise.resolve({data,error:null}).then(resolve,reject);
    return q;
  }};
  const get=vm.runInNewContext(source.slice(start,end)+';getAvailableSlots',{
    slotParameter,SLOT_STEP_MINUTES:15,supabase,BUSINESS_TZ:'Europe/Berlin',
    berlinDayOfWeek:()=>1,berlinDayBoundsUTC:()=>({start:'2099-06-01T00:00Z',end:'2099-06-01T23:59Z'}),
    timeToMins:t=>{const[h,m]=t.split(':').map(Number);return h*60+m;},
    minsToTime:m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`
  });
  assert.deepEqual(Array.from((await get('synthetic','2099-06-01',30,null)).slots),['09:00','09:15','09:30']);
  assert.deepEqual(Array.from((await get('synthetic','2099-06-01','30',null,'15','15')).slots),['09:00','09:15']);
  assert.deepEqual(Array.from((await get('synthetic','2099-06-01',30,null,0,1440)).slots),['09:00']);
});
