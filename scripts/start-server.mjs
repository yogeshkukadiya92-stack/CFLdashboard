// Use the stock Next server in supervised processes sharing one listening port.
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const count=Number(process.env.WEB_CONCURRENCY || 2);
if(!Number.isInteger(count)||count<1||count>4)throw Error('WEB_CONCURRENCY must be between 1 and 4; check the database connection budget before increasing it');
const workers=Math.min(count,availableParallelism());
const args=['start',...process.argv.slice(2)];
if(!args.some(a=>a==='--keepAliveTimeout'))args.push('--keepAliveTimeout','65000');
cluster.setupPrimary({exec:require.resolve('next/dist/bin/next'),args});
let stopping=false;
let failures=[];
for(let i=0;i<workers;i++)cluster.fork();
console.log(`CFL server: ${workers} web processes`);
cluster.on('exit',(_worker,code,signal)=>{
 if(stopping)return;
 const now=Date.now();failures=failures.filter(t=>now-t<60000);failures.push(now);
 console.error(`CFL web process exited (${signal||code}); restarting`);
 if(failures.length>8){console.error('Repeated startup failures; exiting for container recovery');shutdown(1);return;}
 setTimeout(()=>{if(!stopping)cluster.fork();},1000);
});
function shutdown(code=0){
 if(stopping)return;stopping=true;
 // Next handles SIGTERM and drains requests before exiting.
 for(const worker of Object.values(cluster.workers))worker?.process.kill('SIGTERM');
 const timer=setTimeout(()=>{for(const worker of Object.values(cluster.workers))worker?.process.kill('SIGKILL');process.exit(code);},30000);timer.unref();
 const finish=()=>{if(!Object.values(cluster.workers).some(Boolean)){clearTimeout(timer);process.exit(code);}};
 cluster.on('exit',finish);finish();
}
process.on('SIGTERM',()=>shutdown());process.on('SIGINT',()=>shutdown());
