import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import pg from 'pg';
const url=process.env.TEST_DATABASE_URL,base=new URL(process.env.TEST_BASE_URL||'http://127.0.0.1:3319');
if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!['localhost','127.0.0.1'].includes(base.hostname))throw Error('Disposable localhost only');
const db=new pg.Pool({connectionString:url,max:2});
const login=await fetch(new URL('/api/auth/login',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'capacity@example.test',password:'local-capacity-only'})});
assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
async function api(path,body,method='POST',admin=false){const r=await fetch(new URL(path,base),{method,headers:{'Content-Type':'application/json',...(admin?{cookie}:{})},body:JSON.stringify(body)});return {status:r.status,body:await r.json()};}
const run='integrity-'+Date.now();
const form={id:run,workshopId:run,workshopSlug:run,batch:'main',allowDuplicate:true,responseLimit:1};
await db.query('UPDATE app_state SET forms=$1,workshops=$2,attendance_entries=$3 WHERE id=1',[JSON.stringify([form]),JSON.stringify([{id:run,name:'Synthetic integrity'}]),JSON.stringify([{id:run,mobile:'+91 9000000001',sessionId:run+'-intro',workshopId:run}])]);
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_attendance_lookup WHERE mobile_normalized=$1',['9000000001'])).rows[0].count),1);
const reg={id:run+'-same',mobile:'9000000001',fullName:'Synthetic',workshopId:run,workshopSlug:run,workshopTitle:'Synthetic integrity',batch:'main',createdAt:new Date().toISOString()};
const retries=await Promise.all(Array.from({length:30},()=>api('/api/public-registration-state',{registration:reg})));
assert.ok(retries.every(r=>r.status===200),JSON.stringify(retries.filter(r=>r.status!==200)));
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_registration_records WHERE external_id=$1',[reg.id])).rows[0].count),1);
assert.equal((await api('/api/public-registration-state',{registration:{...reg,mobile:'9000000002'}})).status,403); // The form's response limit is still enforced.
await db.query('UPDATE app_state SET forms=$1 WHERE id=1',[JSON.stringify([{...form,responseLimit:0,allowDuplicate:false,waitingMode:true}])]);
assert.equal((await api('/api/public-registration-state',{registration:{...reg,mobile:'9000000002'}})).status,409);
const waiting={...reg,id:run+'-waiting',mobile:'9000000003'};
assert.equal((await api('/api/public-registration-state',{registration:waiting})).body.registration.registrationStatus,'waiting');
const promotion=await api('/api/admin/registration-waiting',{workshopId:run,registrationIds:[waiting.id],responseScope:'workshop'},'PATCH',true);
assert.equal(promotion.status,200,JSON.stringify(promotion.body));assert.equal(promotion.body.promoted,1);assert.equal(promotion.body.scope,'workshop');
assert.ok(promotion.body.registrations.every(r=>r.workshopId===run));
assert.equal((await db.query('SELECT completed_at FROM cfl_registration_jobs WHERE registration_id=$1',[waiting.id])).rows[0].completed_at,null);
assert.equal(Number((await db.query('SELECT revision FROM cfl_registration_jobs WHERE registration_id=$1',[waiting.id])).rows[0].revision),1);
// A stale dashboard snapshot must never delete a newer public submission.
const before=Number((await db.query('SELECT count(*) FROM cfl_registration_records')).rows[0].count);
assert.equal((await api('/api/state',{registrations:[]},'POST',true)).status,200);
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_registration_records')).rows[0].count),before);
// Trigger updates are atomic for confirmation, moving between batches, and deletion.
await db.query(`UPDATE cfl_registration_records SET payload=payload || '{"batch":"other","batchId":"other-id"}'::jsonb,batch_key='other-id' WHERE external_id=$1`,[reg.id]);
const deleted=await api('/api/crm/registrations/sync',{ids:[reg.id]},'DELETE',true);
assert.equal(deleted.status,200,JSON.stringify(deleted.body));assert.equal(deleted.body.removed,1);
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_registration_records WHERE external_id=$1',[waiting.id])).rows[0].count),1);
const mismatches=await db.query(`WITH actual AS (
 SELECT workshop_id,COALESCE(payload->>'batchId','') batch_id,lower(btrim(COALESCE(payload->>'batch',''))) batch_name,COALESCE(payload->>'introductionSessionId','') intro_session,
 count(*) responses,count(*) FILTER(WHERE COALESCE(payload->>'registrationStatus','')<>'waiting') confirmed,count(*) FILTER(WHERE payload->>'registrationStatus'='waiting') waiting FROM cfl_registration_records GROUP BY 1,2,3,4)
 SELECT count(*) FROM actual a FULL OUTER JOIN cfl_registration_totals t USING(workshop_id,batch_id,batch_name,intro_session)
 WHERE COALESCE(a.responses,0)<>COALESCE(t.responses,0) OR COALESCE(a.confirmed,0)<>COALESCE(t.confirmed,0) OR COALESCE(a.waiting,0)<>COALESCE(t.waiting,0)`);
assert.equal(Number(mismatches.rows[0].count),0,'Stored totals match source rows after mutations');
await Promise.all([api('/api/state',{facilitators:[{id:run,name:'Synthetic facilitator'}]},'POST',true),api('/api/state',{workshopTypes:[{id:run,name:'Synthetic type'}]},'POST',true)]);
const state=(await db.query('SELECT facilitators,workshop_types FROM app_state WHERE id=1')).rows[0];assert.equal(state.facilitators[0].id,run);assert.equal(state.workshop_types[0].id,run);
// Seed a synthetic challenge directly; no OTP provider or real participant is contacted.
await api('/api/otp/verify',{mobile:'9000000004',otp:'123456'});
const hash=createHmac('sha256','local-capacity-test').update('9000000004:123456').digest('hex');
async function challenge(){await db.query(`INSERT INTO cfl_otp_challenges(mobile,code_hash,expires_at,attempts) VALUES('9000000004',$1,NOW()+interval '5 minutes',0) ON CONFLICT(mobile) DO UPDATE SET code_hash=$1,expires_at=EXCLUDED.expires_at,attempts=0`,[hash]);}
await challenge();
const otp=await Promise.all(Array.from({length:20},()=>api('/api/otp/verify',{mobile:'9000000004',otp:'123456'})));
assert.equal(otp.filter(r=>r.status===200).length,1,'One-time verification across server processes');
await challenge();for(let i=0;i<5;i++)assert.equal((await api('/api/otp/verify',{mobile:'9000000004',otp:'111111'})).status,400);
assert.equal((await api('/api/otp/verify',{mobile:'9000000004',otp:'123456'})).status,429);
console.log('PASS: concurrent idempotency, identity collision, response limit, manual confirmation, exact totals, batch moves/deletion, attendance projection, isolated settings writes, and shared one-time OTP.');
await db.end();
