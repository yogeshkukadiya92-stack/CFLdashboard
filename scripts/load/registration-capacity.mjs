// Synthetic, disposable localhost DB only. Never point this runner at production.
import pg from 'pg';
import http from 'node:http';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
const url=process.env.TEST_DATABASE_URL;
const base=new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3319');
if(!url || !['localhost','127.0.0.1'].includes(new URL(url).hostname) || !['localhost','127.0.0.1'].includes(base.hostname)) throw Error('Disposable localhost targets required');
const count=Number(process.env.LOAD_USERS || 50), history=Number(process.env.LOAD_HISTORY || 5000), attendance=Number(process.env.LOAD_ATTENDANCE || 5000);
assert.ok(count>=1&&count<=5000 && history<=100000 && attendance<=100000);
const db=new pg.Pool({connectionString:url,max:2});
const run='capacity-'+Date.now(), seats=Math.floor(count/2);
const form={id:run,workshopId:run,workshopSlug:run,batch:'main',registrationCapacity:history+seats,whatsappConfirmationEnabled:false,requireAttendanceForConfirmation:true,requiredAttendanceSessionId:run+'-intro',attendanceOnlyConfirmation:true};
const entries=Array.from({length:Math.max(attendance,count)},(_,i)=>({id:run+'-att-'+i,mobile:String(9000000000+i),sessionId:run+'-intro',workshopId:run,submittedAt:new Date().toISOString()}));
await db.query('UPDATE app_state SET forms=$1,workshops=$2,attendance_entries=$3 WHERE id=1',[JSON.stringify([form]),JSON.stringify([{id:run,name:'Synthetic capacity',batches:[]}]),JSON.stringify(entries)]);
await db.query(`INSERT INTO cfl_registration_records(external_id,workshop_id,batch_key,mobile_normalized,created_at,payload)
 SELECT $1||'-history-'||n,$1,'main',(8000000000+n)::text,NOW(),jsonb_build_object('id',$1||'-history-'||n,'workshopId',$1::text,'batch','main','mobile',(8000000000+n)::text,'registrationStatus','confirmed','createdAt',NOW()) FROM generate_series(1,$2::int) n`,[run,history]);
const reads=[];
for(let i=0;i<2;i++){const t=performance.now(); const r=await fetch(new URL('/api/public-registration-state',base)); const b=await r.text(); reads.push({status:r.status,ms:Math.round(performance.now()-t),bytes:Buffer.byteLength(b)});}
let peakConnections=0,peakLockWait=0,monitorBusy=false;
const monitor=setInterval(async()=>{if(monitorBusy)return;monitorBusy=true;try{const r=await db.query("SELECT count(*) AS connections,count(*) FILTER (WHERE wait_event_type='Lock') locks FROM pg_stat_activity WHERE application_name='cfl-registration'");peakConnections=Math.max(peakConnections,Number(r.rows[0].connections));peakLockWait=Math.max(peakLockWait,Number(r.rows[0].locks));}finally{monitorBusy=false;}},200);
const preconnect=process.env.LOAD_PRECONNECT==='true';
const agents=preconnect?Array.from({length:count},()=>new http.Agent({keepAlive:true,maxSockets:1})):[];
function httpCall(agent,path,body) { return new Promise((resolve,reject)=>{
 const req=http.request(new URL(path,base),{agent,method:body?'POST':'HEAD',headers:body?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{},timeout:60000},res=>{let text='';res.setEncoding('utf8');res.on('data',v=>text+=v);res.on('end',()=>{try{resolve({status:res.statusCode,body:text?JSON.parse(text):{}});}catch(e){reject(e);}});res.on('error',reject);});
 req.on('error',reject);req.on('timeout',()=>req.destroy(Error('timeout')));req.end(body);
}); }
if(preconnect){for(let i=0;i<count;i+=50)await Promise.all(agents.slice(i,i+50).map(agent=>httpCall(agent,'/brand/coach-for-life-logo-stacked.png')));}
const start=performance.now();
const inputs=Array.from({length:count},(_,i)=>({id:run+'-new-'+i,fullName:'Synthetic '+i,mobile:String(9000000000+i),workshopId:run,workshopSlug:run,workshopTitle:'Synthetic capacity',batch:'main',createdAt:new Date().toISOString()}));
const results=await Promise.all(inputs.map(async(registration,i)=>{const t=performance.now();try{if(preconnect){const r=await httpCall(agents[i],'/api/public-registration-state',JSON.stringify({registration}));return {status:r.status,ms:performance.now()-t,error:r.body.error};}const r=await fetch(new URL('/api/public-registration-state',base),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({registration}),signal:AbortSignal.timeout(60000)});const b=await r.json();return {status:r.status,ms:performance.now()-t,error:b.error};}catch(e){return {status:0,ms:performance.now()-t,error:e.cause?.code||e.message};}}));
clearInterval(monitor);
for(const agent of agents)agent.destroy();
const elapsed=performance.now()-start;
const rows=(await db.query("SELECT payload FROM cfl_registration_records WHERE workshop_id=$1 AND external_id LIKE $2",[run,run+'-new-%'])).rows.map(r=>r.payload);
const jobs=Number((await db.query('SELECT count(*) FROM cfl_registration_jobs WHERE registration_id LIKE $1',[run+'-new-%'])).rows[0].count);
const confirmed=rows.filter(r=>r.registrationStatus==='confirmed'),waiting=rows.filter(r=>r.registrationStatus==='waiting');
const times=results.map(r=>r.ms).sort((a,b)=>a-b), pct=p=>Math.round(times[Math.min(times.length-1,Math.ceil(times.length*p)-1)]);
const errors={};for(const r of results.filter(r=>r.status!==200)){const k=r.status+':'+r.error;errors[k]=(errors[k]||0)+1;}
assert.equal(new Set(confirmed.map(r=>r.registrationNumber)).size,confirmed.length,'Unique registration numbers');
assert.equal(new Set(waiting.map(r=>r.waitingPosition)).size,waiting.length,'Unique waiting positions');
assert.ok(confirmed.length<=seats,'Never exceed capacity');
assert.equal(jobs,rows.length,'Every saved registration has a durable follow-up');
const report={run,users:count,preconnected:preconnect,history,attendance:entries.length,retries:0,httpSuccess:results.filter(r=>r.status===200).length,durableRows:rows.length,durableJobs:jobs,confirmed:confirmed.length,waiting:waiting.length,errors,elapsedMs:Math.round(elapsed),throughput:Math.round(count/(elapsed/1000)),p50:pct(.5),p90:pct(.9),p95:pct(.95),p99:pct(.99),max:pct(1),peakConnections,peakLockWait,reads};
console.log(JSON.stringify(report,null,2));
await db.end();
if(report.httpSuccess!==count||rows.length!==count)process.exitCode=1;
