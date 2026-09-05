import assert from 'node:assert/strict';
const base = new URL(process.env.TEST_BASE_URL || 'http://127.0.0.1:3320');
if (!['localhost','127.0.0.1'].includes(base.hostname)) throw new Error('Local test server required');
const login = await fetch(new URL('/api/auth/login', base), {method:'POST', headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'workflow-test@example.test',password:'local-workflow-test'})});
assert.equal(login.status,200);
const cookie=login.headers.get('set-cookie').split(';')[0];
async function request(path, data) {const r=await fetch(new URL(path,base),{method:data?'PUT':'GET',headers:{cookie,'Content-Type':'application/json'},body:data?JSON.stringify(data):undefined});const body=await r.json();if(r.status>=500)console.log(body);return {status:r.status,body};}
const prefix='library-check-'+Date.now();
const first={id:prefix+'-a',name:prefix+' Draft',status:'draft',nodes:[],connections:[],note:''};
const second={...first,id:prefix+'-b',name:prefix+' Active',status:'active'};
assert.equal((await request('/api/workflows',first)).status,200);
assert.equal((await request('/api/workflows',second)).status,200);
const list=await request('/api/workflows?view=library&q='+prefix);
assert.equal(list.body.workflows.length,2);
assert.equal(list.body.workflows[0].nodes,undefined);
assert.equal(list.body.salesPeople,undefined);
for (const item of [first,second]) {
 const loaded=await request('/api/workflows?id='+item.id);
 assert.equal(loaded.body.workflow.id,item.id);
 assert.equal(loaded.body.workflow.name,item.name);
 assert.equal(loaded.body.workflow.nodes.length,0);
}
const active=await request('/api/workflows?view=library&status=active&q='+prefix);
assert.deepEqual(active.body.workflows.map(i=>i.id),[second.id]);
const drafts=await request('/api/workflows?view=library&status=draft&q='+prefix);
assert.deepEqual(drafts.body.workflows.map(i=>i.id),[first.id]);
await request('/api/workflows',{...first,name:prefix+' Renamed'});
assert.equal((await request('/api/workflows?id='+second.id)).body.workflow.name,second.name);
assert.equal((await request('/api/workflows?id=missing-'+prefix)).status,404);
assert.equal((await fetch(new URL('/api/workflows?view=library',base))).status,401);
console.log('PASS: lightweight library, active/inactive filters, independent workflow saves, empty draft reload, missing ID and auth checks.');
