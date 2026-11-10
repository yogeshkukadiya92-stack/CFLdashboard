import "server-only";
import type { CallFlowIdentity } from "./callflow-auth.ts";
import { withTenantTransaction } from "./platform/database.ts";

export async function personalApp(identity: CallFlowIdentity, kind: string, input?: Record<string, unknown>) {
  if (!identity.tenantId || !identity.sessionId) throw new Error("Invalid workspace session");
  return withTenantTransaction(identity.tenantId, async client => {
    const result = await client.query<{id:string}>("SELECT id FROM callflow_memberships WHERE tenant_id=$1 AND user_id=$2 AND status='active'", [identity.tenantId,identity.userId]);
    const member = result.rows[0]; if (!member) throw new Error("Account inactive");
    if (kind === "availability") {
      if (input) {
        if (typeof input.acceptingLeads !== "boolean") throw new Error("Invalid availability");
        await client.query("SELECT id FROM callflow_memberships WHERE id=$1 FOR UPDATE",[member.id]);
        const previous = await client.query("SELECT accepting_leads FROM callflow_sales_availability WHERE membership_id=$1", [member.id]);
        await client.query(`INSERT INTO callflow_sales_availability (tenant_id,membership_id,accepting_leads) VALUES ($1,$2,$3)
          ON CONFLICT (tenant_id,membership_id) DO UPDATE SET accepting_leads=$3,updated_at=NOW()`,[identity.tenantId,member.id,input.acceptingLeads]);
        if (!previous.rowCount || previous.rows[0].accepting_leads !== input.acceptingLeads) await client.query(`INSERT INTO callflow_audit_logs (tenant_id,actor_user_id,action,entity_type,entity_id)
          VALUES ($1,$2,$3,'shift',$4)`,[identity.tenantId,identity.userId,input.acceptingLeads?'shift.start':'shift.end',member.id]);
      }
      const row = (await client.query("SELECT accepting_leads,updated_at FROM callflow_sales_availability WHERE membership_id=$1",[member.id])).rows[0];
      return { acceptingLeads: row?.accepting_leads ?? true, changedAt: row?.updated_at?.toISOString() ?? null };
    }
    if (kind === "engagement") return { whatsappTemplate:"Hi {{leadName}}, thank you for speaking with me. Please reply here if you need any help.", salespersonName:identity.name, noteTemplates:["No answer","Call back tomorrow","Interested","Meeting booked","Wrong number"] };
    if (kind === "location") {
      const latitude=Number(input?.latitude),longitude=Number(input?.longitude),accuracy=Number(input?.accuracyMeters);
      if (!Number.isFinite(latitude)||latitude < -90||latitude >90||!Number.isFinite(longitude)||longitude < -180||longitude >180) throw new Error("Invalid location");
      const owned = await client.query("SELECT id FROM callflow_follow_ups WHERE id=$1 AND lead_id=$2 AND owner_membership_id=$3",[input?.followUpId,input?.leadId,member.id]);
      if (!owned.rowCount) throw new Error("Follow-up not found");
      const checkedInAt=new Date().toISOString();
      await client.query(`INSERT INTO callflow_audit_logs (tenant_id,actor_user_id,action,entity_type,entity_id,metadata) VALUES ($1,$2,'location.check_in','follow_up',$3,$4::jsonb)`,[identity.tenantId,identity.userId,input?.followUpId,JSON.stringify({latitude,longitude,accuracyMeters:Number.isFinite(accuracy)?accuracy:null,checkedInAt})]);
      return { ok:true, checkedInAt };
    }
    const date = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
    const calls = (await client.query(`SELECT started_at,duration_seconds,result FROM callflow_call_events WHERE salesperson_membership_id=$1 AND started_at >= (CURRENT_TIMESTAMP - INTERVAL '8 days') ORDER BY started_at`,[member.id])).rows;
    const dayOf=(value:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(value);
    if (kind === "performance") {
      const today=calls.filter(row=>dayOf(row.started_at)===date), connected=today.filter(row=>row.result==='connected').length;
      const leads=(await client.query("SELECT count(*) FILTER (WHERE stage='won') AS won FROM callflow_leads WHERE assigned_membership_id=$1 AND deleted_at IS NULL",[member.id])).rows[0];
      const due=(await client.query("SELECT count(*) FROM callflow_follow_ups WHERE owner_membership_id=$1 AND status='pending' AND due_at <= NOW()",[member.id])).rows[0];
      return { date,callTarget:50,connectedTarget:20,calls:today.length,connected,connectionRate:today.length?Math.round(connected/today.length*100):0,talkTimeSeconds:today.reduce((sum,row)=>sum+row.duration_seconds,0),conversions:Number(leads.won),followUpsDue:Number(due.count),callTargetPercent:Math.min(100,today.length*2),connectedTargetPercent:Math.min(100,connected*5),leaderboardRank:1,leaderboardSize:1 };
    }
    const events=(await client.query("SELECT action,created_at FROM callflow_audit_logs WHERE actor_user_id=$1 AND action IN ('shift.start','shift.end') AND created_at >= NOW()-INTERVAL '8 days' ORDER BY created_at",[identity.userId])).rows;
    const rows=Array.from({length:7},(_,i)=>{
      const day=dayOf(new Date(Date.now()-(6-i)*86400000)); const items=calls.filter(row=>dayOf(row.started_at)===day), shifts=events.filter(row=>dayOf(row.created_at)===day);
      let start: number|null=null, seconds=0;
      for (const event of shifts) { if(event.action==='shift.start') start=event.created_at.getTime(); else if(start!==null) { seconds+=Math.max(0,(event.created_at.getTime()-start)/1000); start=null; } }
      if(start!==null&&day===date) seconds+=Math.max(0,(Date.now()-start)/1000);
      const activeSeconds=Math.floor(seconds);
      return { date:day,shiftStartedAt:shifts.find(e=>e.action==='shift.start')?.created_at?.toISOString()??null,shiftEndedAt:[...shifts].reverse().find(e=>e.action==='shift.end')?.created_at?.toISOString()??null,activeSeconds,calls:items.length,connected:items.filter(r=>r.result==='connected').length,firstCallAt:items[0]?.started_at?.toISOString()??null,lastCallAt:items.at(-1)?.started_at?.toISOString()??null,callsPerActiveHour:activeSeconds?Math.round(items.length*36000/activeSeconds)/10:0 };
    });
    return {today:rows.at(-1),last7Days:rows,totalActiveSeconds:rows.reduce((sum,row)=>sum+row.activeSeconds,0),totalCalls:rows.reduce((sum,row)=>sum+row.calls,0)};
  });
}
