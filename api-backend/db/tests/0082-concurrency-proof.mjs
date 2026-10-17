// Explicit local proof only. Not part of the default test suite.
// Run in a disposable network-none PostgreSQL container namespace; see proof report.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

export async function proveConcurrentWrites(config) {
  const a = new pg.Client(config), b = new pg.Client(config);
  await a.connect(); await b.connect();
  const owner = randomUUID(), af = randomUUID(), request = randomUUID();
  try {
    await a.query('INSERT INTO auth.users(id) VALUES ($1)', [owner]);
    await a.query("INSERT INTO profiles(id,role) VALUES ($1,'owner') ON CONFLICT(id) DO UPDATE SET role='owner'", [owner]);
    await a.query("INSERT INTO ausfallrechnungen(id,owner_id,amount_eur,faellig_am) VALUES ($1,$2,30,'2026-12-31')", [af, owner]);
    const pay = [owner, owner, af, 'bezahlt', 'bar'];
    await a.query('BEGIN');
    await a.query('SET LOCAL ROLE service_role');
    await a.query('SELECT ausfall_status_buchen($1,$2,$3,$4,$5)', pay);
    let done = false;
    const secondPay = b.query('SELECT ausfall_status_buchen($1,$2,$3,$4,$5)', pay).then(() => ({unexpected: true}), error => ({code: error.code})).finally(() => { done = true; });
    await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(done, false, 'second payment must wait for row lock');
    await a.query('COMMIT');
    assert.equal((await secondPay).code, '23514');
    assert.equal((await a.query("SELECT count(*)::int n FROM belegliste WHERE owner_id=$1 AND type='ausfall'", [owner])).rows[0].n, 1);
    assert.equal((await a.query('SELECT status FROM ausfallrechnungen WHERE id=$1', [af])).rows[0].status, 'bezahlt');

    await a.query("INSERT INTO booking_requests(id,owner_id,payment_type,updated_at) VALUES ($1,$2,'selbstzahler','2026-01-01T00:00:00Z')", [request,owner]);
    const rows = [{owner_id:owner,user_id:owner,customer_name:'QA concurrent synthetic',start_time:'2026-12-03T10:00:00Z',end_time:'2026-12-03T10:30:00Z'}];
    const args=[request,owner,owner,'2026-01-01T00:00:00Z',owner,{},JSON.stringify(rows),{}];
    const sql='SELECT approve_booking_request_atomic($1,$2,$3,$4,$5,$6,$7,$8)';
    await a.query('BEGIN'); await a.query('SET LOCAL ROLE service_role'); await a.query(sql,args);
    done=false;
    const secondApproval=b.query(sql,args).then(() => ({unexpected:true}), error=>({code:error.code})).finally(()=>{done=true;});
    await new Promise(resolve => setTimeout(resolve,100));
    assert.equal(done,false,'second approval must wait for request lock');
    await a.query('COMMIT');
    assert.equal((await secondApproval).code,'40001');
    assert.equal((await a.query('SELECT count(*)::int n FROM bookings WHERE owner_id=$1',[owner])).rows[0].n,1);
    assert.equal((await a.query('SELECT status FROM booking_requests WHERE id=$1',[request])).rows[0].status,'approved');
    console.log('PASS parallel payment: one journal; parallel approval: one booking; second writers blocked then rejected');
  } finally {
    await a.query('ROLLBACK').catch(()=>{});
    await Promise.all([a.end(),b.end()]);
  }
}
if (process.argv.includes('--run-disposable')) {
  assert.equal(process.env.PGHOST,'127.0.0.1','proof requires isolated local PostgreSQL');
  assert.equal(process.env.PRAXURA_DISPOSABLE_PROOF,'yes','explicit disposable fixture consent required');
  await proveConcurrentWrites({host:'127.0.0.1',port:5432,user:'supabase_admin',password:process.env.PGPASSWORD,database:'postgres'});
}
