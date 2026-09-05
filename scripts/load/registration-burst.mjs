// Disposable localhost database only. Run a production Next server against the
// same TEST_DATABASE_URL, with WhatsApp/MFW credentials unset.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const databaseUrl = process.env.TEST_DATABASE_URL;
const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3319');
if (!databaseUrl || !['localhost','127.0.0.1'].includes(new URL(databaseUrl).hostname) || !['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('This fixture runner only supports disposable localhost databases and servers');
const db = new pg.Pool({connectionString:databaseUrl});
const source = readFileSync('lib/db.ts','utf8');
const setup = source.slice(source.indexOf('export async function ensurePersistenceTable'),source.indexOf('export async function ensureRegistrationRecordsTable'));
for (const match of setup.matchAll(/await client.query\(`([\s\S]*?)`\)/g)) await db.query(match[1]);
const run = 'burst-'+Date.now();
const form = {id:run,workshopId:run,workshopSlug:run,batch:'main',registrationCapacity:300,whatsappConfirmationEnabled:false};
await db.query('UPDATE app_state SET forms=$1,workshops=$2 WHERE id=1',[JSON.stringify([form]),JSON.stringify([{id:run,name:'Synthetic burst',batches:[]}])]);
function registration(i) { return {id:run+'-'+i,fullName:'Synthetic '+i,mobile:String(9000000000+i),workshopId:run,workshopSlug:run,workshopTitle:'Synthetic burst',batch:'main',createdAt:new Date().toISOString()}; }
let transportRetries = 0;
async function submit(registration) {
 const start = performance.now();
 for (let attempt=0; attempt<3; attempt++) {
  try {
   const response = await fetch(new URL('/api/public-registration-state',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration}),signal:AbortSignal.timeout(20000)});
   const body=await response.json();
   if ([408,429,500,502,503,504].includes(response.status) && attempt<2) throw new Error('Retryable HTTP '+response.status);
   return {status:response.status,body,ms:performance.now()-start};
  } catch(error) {
   if(attempt===2) return {status:0,body:{error:String(error)},ms:performance.now()-start};
   transportRetries++;
   await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)+Math.random()*500));
  }
 }
}
const inputs=Array.from({length:600},(_,i)=>registration(i));
const results=await Promise.all(inputs.map(submit));
const failures=results.filter(r=>r.status!==200);
assert.equal(failures.length,0,JSON.stringify(failures.slice(0,3)));
const stored=(await db.query('SELECT payload FROM cfl_registration_records WHERE workshop_id=$1',[run])).rows.map(r=>r.payload);
assert.equal(stored.length,600);
assert.equal(stored.filter(r=>r.registrationStatus==='confirmed').length,300);
assert.equal(stored.filter(r=>r.registrationStatus==='waiting').length,300);
assert.equal(new Set(stored.filter(r=>r.registrationNumber).map(r=>r.registrationNumber)).size,300);
assert.equal(new Set(stored.filter(r=>r.waitingPosition).map(r=>r.waitingPosition)).size,300);
const retries=await Promise.all(Array.from({length:20},()=>submit(inputs[0])));
assert.ok(retries.every(r=>r.status===200));
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_registration_records WHERE workshop_id=$1',[run])).rows[0].count),600);
const duplicate=await submit({...inputs[0],id:run+'-duplicate'});
assert.equal(duplicate.status,409);
const collision=await submit({...inputs[0],mobile:'9999999999'});
assert.equal(collision.status,409);
assert.equal((await db.query('SELECT mobile_normalized FROM cfl_registration_records WHERE external_id=$1',[inputs[0].id])).rows[0].mobile_normalized,inputs[0].mobile);
assert.equal(Number((await db.query('SELECT count(*) FROM cfl_registration_jobs WHERE registration_id LIKE $1',[run+'-%'])).rows[0].count),600);
const times=results.map(r=>r.ms).sort((a,b)=>a-b);
console.log(JSON.stringify({run,requests:600,failures:0,transportRetries,p50:Math.round(times[299]),p95:Math.round(times[569]),p99:Math.round(times[593]),max:Math.round(times[599]),confirmed:300,waiting:300,retries:20,duplicateRejected:true,durableJobs:600},null,2));
await db.end();
