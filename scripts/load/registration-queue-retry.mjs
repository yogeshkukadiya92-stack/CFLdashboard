import pg from 'pg';
import assert from 'node:assert/strict';
const url=process.env.TEST_DATABASE_URL;
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Disposable localhost database required');
const db=new pg.Client({connectionString:url});await db.connect();
const id='queue-retry-'+Date.now();
const entry={id,workshopId:id,workshopTitle:'Synthetic queue retry',batch:'main',fullName:'Synthetic',mobile:'+91 9000000001',createdAt:new Date().toISOString(),status:'Paid',registrationStatus:'confirmed',attendanceMatched:true,registrationNumber:'REG-TEST',amountPaid:0,amountDue:0,city:'',email:'',facilitator:'Test'};
await db.query(`UPDATE app_state SET workshops=workshops || $1::jsonb WHERE id=1`,[JSON.stringify([{id,name:entry.workshopTitle,mfwEnrollmentEnabled:true}])]);
await db.query(`INSERT INTO cfl_registration_records(external_id,workshop_id,batch_key,mobile_normalized,created_at,payload) VALUES($1,$1,'main','9000000001',NOW(),$2)`,[id,JSON.stringify(entry)]);
await db.query('INSERT INTO cfl_registration_jobs(registration_id) VALUES($1)',[id]);
async function waitFor(check){for(let i=0;i<30;i++){const row=(await db.query('SELECT * FROM cfl_registration_jobs WHERE registration_id=$1',[id])).rows[0];if(check(row))return row;await new Promise(r=>setTimeout(r,1000));}throw new Error('Queue condition timed out');}
const failed=await waitFor(r=>r.attempts>0);
assert.equal(failed.completed_at,null);
assert.ok(failed.last_error);
// Resolve the deliberately missing mapping without contacting an external provider.
await db.query(`UPDATE app_state SET workshops=(SELECT jsonb_agg(CASE WHEN w->>'id'=$1 THEN w || '{"mfwEnrollmentEnabled":false}'::jsonb ELSE w END) FROM jsonb_array_elements(workshops) w) WHERE id=1`,[id]);
await db.query('UPDATE cfl_registration_jobs SET available_at=NOW() WHERE registration_id=$1',[id]);
const recovered=await waitFor(r=>r.completed_at);
assert.equal(recovered.last_error,null);
console.log('PASS: durable provider failure recorded, retry scheduled, recovered job completed without an external message.');
await db.end();
