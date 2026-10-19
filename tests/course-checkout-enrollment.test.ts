import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { enrollVerifiedCheckout } from '../lib/course-checkout-enrollment.ts';
const order = {id:'order_Test',status:'paid',amount:199900,amount_paid:199900,amount_due:0,currency:'INR',notes:{mfw_course:'signed-proof',mfw_course_signature:'original-proof-signature'}};
const payment = {id:'pay_Test',order_id:order.id,status:'captured',currency:'INR',amount:199900,amount_refunded:0};
function setup(o:any=order,p:any=payment) {
 const deliveries: any[]=[];
 return {deliveries, deps:{secret:'test-secret',read:async(path:string)=>path.startsWith('orders/')?o:p,send:async(rawBody:string,signature:string)=>{deliveries.push({rawBody,signature});return {assigned:true,skipped:false};}}};
}
test('verified checkout assigns without waiting for webhook, using only fetched provider entities',async()=>{
 const {deps,deliveries}=setup();
 assert.deepEqual(await enrollVerifiedCheckout(order.id,payment.id,deps),{assigned:true,skipped:false});
 assert.equal(deliveries.length,1);
 assert.equal(deliveries[0].signature,createHmac('sha256',deps.secret).update(deliveries[0].rawBody).digest('hex'));
 assert.equal(JSON.parse(deliveries[0].rawBody).payload.order.entity.notes.mfw_course,'signed-proof');
});
test('wrong order, uncaptured, partially paid and refunded payments never grant access',async()=>{
 for(const [o,p] of [[order,{...payment,order_id:'order_Other'}],[order,{...payment,status:'authorized'}],[{...order,amount_due:100},payment],[order,{...payment,amount_refunded:1}],[order,{...payment,amount:100}]]){
 const {deps,deliveries}=setup(o,p);await assert.rejects(enrollVerifiedCheckout(order.id,payment.id,deps));assert.equal(deliveries.length,0);
 }
});
test('unrelated checkout is skipped and assignment failures are not reported as success',async()=>{
 const {deps,deliveries}=setup({...order,notes:{}});assert.equal((await enrollVerifiedCheckout(order.id,payment.id,deps)).skipped,true);assert.equal(deliveries.length,0);
 const mapped=setup();mapped.deps.send=async()=>({assigned:false,skipped:true});await assert.rejects(enrollVerifiedCheckout(order.id,payment.id,mapped.deps));
});
