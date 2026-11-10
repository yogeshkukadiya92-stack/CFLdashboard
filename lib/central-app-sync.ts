import "server-only";
import type { PoolClient } from "pg";
import type { CallFlowIdentity } from "./callflow-auth.ts";
import { withTenantTransaction } from "./platform/database.ts";
import { enqueueOutboxJob } from "./platform/outbox.ts";
import { deriveBillingAccess, requireBillingWriteAccess } from "./subscription-billing.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedEntities = new Set(["CALL","CALL_DISPOSITION","NOTE","FOLLOW_UP","LEAD"]);
type AppEvent={eventUuid:string;entityType:string;entityId:string;operation:string;payload?:Record<string,unknown>};
type Membership={id:string;tenant_id:string;user_id:string;name:string};
const text=(value:unknown,max=500)=>String(value??"").trim().slice(0,max);
const phone=(value:unknown)=>{const valueDigits=String(value??"").replace(/\D/g,"").slice(-15);return valueDigits.length>=10?valueDigits:""};
const millis=(value:unknown,fallback=Date.now())=>{const number=Number(value);return Number.isFinite(number)&&number>0?new Date(number):new Date(fallback)};
const payloadOf=(event:AppEvent)=>{const raw=event.payload?.raw;if(typeof raw==="string"){try{return JSON.parse(raw) as Record<string,unknown>}catch{return {}}}return event.payload||{}};
const nextCursor=(date:Date)=>Buffer.from(String(date.getTime())).toString("base64url");
type SyncMark=[string,string];type SyncCursor={v:1;leads:SyncMark;calls:SyncMark;notes:SyncMark;followUps:SyncMark;stages:SyncMark;dispositions:SyncMark;tombstones:SyncMark;assignments:SyncMark};
const ZERO_UUID="00000000-0000-0000-0000-000000000000";
function decodeSyncCursor(value:string|null):SyncCursor{
  const zero:SyncMark=[new Date(0).toISOString(),ZERO_UUID];
  try{const decoded=Buffer.from(value||"MA","base64url").toString("utf8");if(decoded.startsWith("{")){const parsed=JSON.parse(decoded) as SyncCursor;if(parsed.v===1&&parsed.tombstones&&parsed.assignments)return parsed}const legacy=Number(decoded);const mark:SyncMark=[Number.isFinite(legacy)&&legacy>0?new Date(legacy).toISOString():zero[0],ZERO_UUID];return{v:1,leads:mark,calls:mark,notes:mark,followUps:mark,stages:mark,dispositions:mark,tombstones:[mark[0],"0"],assignments:[mark[0],"0"]}}catch{return{v:1,leads:zero,calls:zero,notes:zero,followUps:zero,stages:zero,dispositions:zero,tombstones:[zero[0],"0"],assignments:[zero[0],"0"]}}
}
const encodeSyncCursor=(cursor:SyncCursor)=>Buffer.from(JSON.stringify(cursor)).toString("base64url");
function advancedMark(rows:Record<string,unknown>[],timeKey:string,idKey:string,prior:SyncMark,limit:number,highWater:Date,emptyId=ZERO_UUID):SyncMark{if(rows.length<limit)return[highWater.toISOString(),emptyId];const last=rows.at(-1);return last?[new Date(last[timeKey] as string|Date).toISOString(),String(last[idKey])]:prior}

async function membership(client:PoolClient,identity:CallFlowIdentity):Promise<Membership>{
  const result=await client.query<Membership>(`SELECT membership.id,membership.tenant_id,membership.user_id,users.display_name AS name FROM callflow_memberships membership JOIN callflow_users users ON users.id=membership.user_id WHERE membership.tenant_id=$1 AND membership.user_id=$2 AND membership.role='salesperson' AND membership.status='active' AND users.status='active'`,[identity.tenantId,identity.userId]);
  if(!result.rows[0])throw new Error("ACCOUNT_INACTIVE");return result.rows[0];
}
async function ownedLead(client:PoolClient,tenantId:string,membershipId:string,leadId:string){
  if(!UUID.test(leadId))return false;
  const result=await client.query(`SELECT 1 FROM callflow_leads WHERE tenant_id=$1 AND id=$2 AND assigned_membership_id=$3 AND deleted_at IS NULL`,[tenantId,leadId,membershipId]);return Boolean(result.rowCount);
}
async function applyEvent(client:PoolClient,member:Membership,deviceId:string,event:AppEvent){
  if(!UUID.test(event.eventUuid)||!UUID.test(event.entityId)||!allowedEntities.has(event.entityType))throw new Error("INVALID_EVENT");
  const payload=payloadOf(event);if(JSON.stringify(payload).length>32_000)throw new Error("PAYLOAD_TOO_LARGE");
  let leadId=text(payload.leadId,36);const operation=text(event.operation,20).toUpperCase();
  if(event.entityType==="CALL"){
    const normalized=phone(payload.phone);
    if(!leadId&&normalized){const matches=await client.query<{id:string}>(`SELECT id FROM callflow_leads WHERE tenant_id=$1 AND assigned_membership_id=$2 AND mobile_normalized=$3 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 2`,[member.tenant_id,member.id,normalized]);if(matches.rows.length===1)leadId=matches.rows[0].id}
    if(leadId&&!(await ownedLead(client,member.tenant_id,member.id,leadId)))throw new Error("LEAD_NOT_ASSIGNED");
    if(operation==="UPDATE"&&leadId){
      const updated=await client.query(`UPDATE callflow_call_events SET lead_id=$1,updated_at=NOW() WHERE tenant_id=$2 AND id=$3 AND salesperson_membership_id=$4`,[leadId,member.tenant_id,event.entityId,member.id]);
      if(!updated.rowCount)throw new Error("CALL_NOT_FOUND");return;
    }
    if(!normalized)return; // Dial initiation is acknowledged; completed call-log event carries canonical metadata.
    const direction=text(payload.direction,20).toLowerCase()==="incoming"?"incoming":"outgoing";
    const duration=Math.min(86_400,Math.max(0,Math.trunc(Number(payload.durationSeconds)||0)));
    const started=millis(payload.startedAt??payload.createdAt);const ended=payload.endedAt?millis(payload.endedAt):null;
    const result=duration>0?"connected":direction==="incoming"?"missed":"not_connected";
    const simSlot=Number.isInteger(Number(payload.simSlot))?Math.min(7,Math.max(0,Number(payload.simSlot)-1)):null;
    await client.query(`INSERT INTO callflow_call_events (id,tenant_id,event_key,lead_id,salesperson_membership_id,direction,result,phone_normalized,sim_slot,sim_label,phone_account_id,started_at,connected_at,ended_at,duration_seconds,device_id,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()) ON CONFLICT (tenant_id,id) DO UPDATE SET
      lead_id=COALESCE(EXCLUDED.lead_id,callflow_call_events.lead_id),result=EXCLUDED.result,phone_normalized=EXCLUDED.phone_normalized,sim_slot=EXCLUDED.sim_slot,sim_label=EXCLUDED.sim_label,phone_account_id=EXCLUDED.phone_account_id,connected_at=EXCLUDED.connected_at,ended_at=EXCLUDED.ended_at,duration_seconds=EXCLUDED.duration_seconds,updated_at=NOW()
      WHERE callflow_call_events.salesperson_membership_id=EXCLUDED.salesperson_membership_id`,[event.entityId,member.tenant_id,event.eventUuid,leadId||null,member.id,direction,result,normalized,simSlot,text(payload.simLabel,100)||null,text(payload.phoneAccountId,200)||null,started,duration>0?started:null,ended,duration,deviceId]);
    if(leadId)await client.query(`UPDATE callflow_leads SET first_contacted_at=COALESCE(first_contacted_at,$1),last_contacted_at=GREATEST(COALESCE(last_contacted_at,$1),COALESCE($2,$1)),updated_at=NOW(),version=version+1 WHERE tenant_id=$3 AND id=$4`,[started,ended,member.tenant_id,leadId]);
    return;
  }
  if(event.entityType==="LEAD"&&!leadId)leadId=event.entityId;
  if(!leadId||!(await ownedLead(client,member.tenant_id,member.id,leadId)))throw new Error("LEAD_NOT_ASSIGNED");
  if(event.entityType==="NOTE"){
    const body=text(payload.body??payload.note,500);if(!body)throw new Error("NOTE_REQUIRED");
    const callId=text(payload.callId,36);if(callId&& !UUID.test(callId))throw new Error("INVALID_CALL");
    if(callId){const call=await client.query(`SELECT 1 FROM callflow_call_events WHERE tenant_id=$1 AND id=$2 AND lead_id=$3 AND salesperson_membership_id=$4`,[member.tenant_id,callId,leadId,member.id]);if(!call.rowCount)throw new Error("CALL_NOT_FOUND")}
    await client.query(`INSERT INTO callflow_lead_notes (id,tenant_id,lead_id,call_id,author_membership_id,body,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,NOW()) ON CONFLICT (tenant_id,id) DO NOTHING`,[event.entityId,member.tenant_id,leadId,callId||null,member.id,body,millis(payload.createdAt)]);return;
  }
  if(event.entityType==="FOLLOW_UP"){
    if(operation==="CREATE")await client.query(`INSERT INTO callflow_follow_ups (id,tenant_id,lead_id,owner_membership_id,kind,due_at,note,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW()) ON CONFLICT (tenant_id,id) DO NOTHING`,[event.entityId,member.tenant_id,leadId,member.id,text(payload.type,40)||"call",millis(payload.scheduledAt),text(payload.note,500)||null,millis(payload.createdAt)]);
    else if(operation==="UPDATE")await client.query(`UPDATE callflow_follow_ups SET due_at=$1,note=$2,status='pending',updated_at=NOW() WHERE tenant_id=$3 AND id=$4 AND owner_membership_id=$5`,[millis(payload.scheduledAt),text(payload.note,500)||null,member.tenant_id,event.entityId,member.id]);
    else if(operation==="COMPLETE")await client.query(`UPDATE callflow_follow_ups SET status='completed',completed_at=$1,updated_at=NOW() WHERE tenant_id=$2 AND id=$3 AND owner_membership_id=$4`,[millis(payload.completedAt),member.tenant_id,event.entityId,member.id]);
    else if(operation==="CANCEL")await client.query(`UPDATE callflow_follow_ups SET status='cancelled',updated_at=NOW() WHERE tenant_id=$1 AND id=$2 AND owner_membership_id=$3`,[member.tenant_id,event.entityId,member.id]);
    else throw new Error("INVALID_OPERATION");return;
  }
  if(event.entityType==="CALL_DISPOSITION"){
    const callId=text(payload.callId,36);if(!UUID.test(callId))throw new Error("INVALID_CALL");
    const call=await client.query(`SELECT 1 FROM callflow_call_events WHERE tenant_id=$1 AND id=$2 AND lead_id=$3 AND salesperson_membership_id=$4`,[member.tenant_id,callId,leadId,member.id]);if(!call.rowCount)throw new Error("CALL_NOT_FOUND");
    const dispositionCode=text(payload.dispositionCode??payload.dispositionId,60).toUpperCase();if(!dispositionCode)throw new Error("DISPOSITION_REQUIRED");
    await client.query(`INSERT INTO callflow_call_dispositions (id,tenant_id,call_id,lead_id,disposition_code,note,meeting_link,created_by_membership_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (tenant_id,call_id) DO NOTHING`,[event.entityId,member.tenant_id,callId,leadId,dispositionCode,text(payload.note,500)||null,text(payload.meetingLink,1000)||null,member.id,millis(payload.createdAt)]);
    const configured=await client.query<{target_stage:string|null}>(`SELECT target_stage FROM callflow_dispositions WHERE tenant_id=$1 AND code=$2 AND active LIMIT 1`,[member.tenant_id,dispositionCode]);
    const wrongNumber=dispositionCode==="WRONG_NUMBER";
    await client.query(`UPDATE callflow_leads SET stage=COALESCE($1,stage),opted_out_at=CASE WHEN $2 THEN NOW() ELSE opted_out_at END,opt_out_reason=CASE WHEN $2 THEN 'Wrong number' ELSE opt_out_reason END,last_contacted_at=NOW(),updated_at=NOW(),version=version+1 WHERE tenant_id=$3 AND id=$4`,[configured.rows[0]?.target_stage||(wrongNumber?"lost":null),wrongNumber,member.tenant_id,leadId]);return;
  }
  if(event.entityType==="LEAD"){
    const stage=text(payload.stageId,40).toLowerCase();
    await client.query(`UPDATE callflow_leads SET stage=COALESCE(NULLIF($1,''),stage),next_action_at=$2,updated_at=NOW(),version=version+1 WHERE tenant_id=$3 AND id=$4 AND assigned_membership_id=$5`,[stage,payload.followUpAt?millis(payload.followUpAt):null,member.tenant_id,leadId,member.id]);
  }
}

export async function applyCentralSync(identity:CallFlowIdentity,deviceId:string,events:AppEvent[]){
  if(!identity.tenantId||!identity.sessionId||!identity.deviceId||identity.deviceId!==deviceId)throw new Error("DEVICE_MISMATCH");
  if(events.length>100)throw new Error("TOO_MANY_EVENTS");
  await requireBillingWriteAccess(identity.tenantId);
  return withTenantTransaction(identity.tenantId,async client=>{
    const member=await membership(client,identity);const accepted:string[]=[];const failed:string[]=[];
    for(const event of events){
      if(!event?.eventUuid){continue}
      if(!UUID.test(event.eventUuid)){failed.push(event.eventUuid);continue}
      const exists=await client.query(`SELECT 1 FROM callflow_sync_receipts WHERE tenant_id=$1 AND event_uuid=$2`,[identity.tenantId,event.eventUuid]);
      if(exists.rowCount){accepted.push(event.eventUuid);continue}
      await client.query("SAVEPOINT app_event");
      try{
        await applyEvent(client,member,deviceId,event);
        await client.query(`INSERT INTO callflow_sync_receipts (tenant_id,event_uuid,user_id,device_id,entity_type,entity_id) VALUES ($1,$2,$3,$4,$5,$6)`,[identity.tenantId,event.eventUuid,identity.userId,deviceId,event.entityType,event.entityId]);
        await enqueueOutboxJob(client,{tenantId:member.tenant_id,eventKey:`app:${event.eventUuid}`,topic:"callflow.app_event.accepted",payload:{eventUuid:event.eventUuid,entityType:event.entityType,entityId:event.entityId}});
        await client.query("RELEASE SAVEPOINT app_event");accepted.push(event.eventUuid);
      }catch{await client.query("ROLLBACK TO SAVEPOINT app_event");failed.push(event.eventUuid)}
    }
    const now=new Date();return{acceptedEventIds:accepted,failedEventIds:failed,nextSyncCursor:nextCursor(now),serverTimestamp:now.toISOString()};
  });
}

export async function centralChanges(identity:CallFlowIdentity,cursor:string|null){
  if(!identity.tenantId||!identity.sessionId)throw new Error("CENTRAL_SESSION_REQUIRED");
  const position=decodeSyncCursor(cursor);
  return withTenantTransaction(identity.tenantId,async client=>{
    const member=await membership(client,identity);const clock=await client.query<{now:Date}>("SELECT clock_timestamp() AS now");const now=clock.rows[0].now;const billing=deriveBillingAccess((await client.query(`SELECT status,access_until,grace_until FROM callflow_billing_profiles WHERE tenant_id=$1`,[identity.tenantId])).rows[0]||null,now);
    const leadLimit=1000,detailLimit=2000;
    const [leads,calls,notes,followUps,stages,dispositions,tombstones,assignmentRemovals]=await Promise.all([
      client.query(`SELECT lead.*,users.display_name AS assigned_name FROM callflow_leads lead LEFT JOIN callflow_memberships assignee ON assignee.id=lead.assigned_membership_id LEFT JOIN callflow_users users ON users.id=assignee.user_id WHERE lead.assigned_membership_id=$1 AND lead.deleted_at IS NULL AND (lead.updated_at,lead.id)>($2::timestamptz,$3::uuid) ORDER BY lead.updated_at,lead.id LIMIT ${leadLimit}`,[member.id,...position.leads]),
      client.query(`SELECT * FROM callflow_call_events WHERE salesperson_membership_id=$1 AND (updated_at,id)>($2::timestamptz,$3::uuid) ORDER BY updated_at,id LIMIT ${detailLimit}`,[member.id,...position.calls]),
      client.query(`SELECT note.* FROM callflow_lead_notes note JOIN callflow_leads lead ON lead.id=note.lead_id AND lead.tenant_id=note.tenant_id WHERE lead.assigned_membership_id=$1 AND (note.updated_at,note.id)>($2::timestamptz,$3::uuid) ORDER BY note.updated_at,note.id LIMIT ${detailLimit}`,[member.id,...position.notes]),
      client.query(`SELECT follow.* FROM callflow_follow_ups follow JOIN callflow_leads lead ON lead.id=follow.lead_id AND lead.tenant_id=follow.tenant_id WHERE lead.assigned_membership_id=$1 AND (follow.updated_at,follow.id)>($2::timestamptz,$3::uuid) ORDER BY follow.updated_at,follow.id LIMIT ${detailLimit}`,[member.id,...position.followUps]),
      client.query(`SELECT * FROM callflow_lead_stages WHERE tenant_id=$3 AND active AND (updated_at,id)>($1::timestamptz,$2::uuid) ORDER BY updated_at,id LIMIT ${detailLimit}`,[...position.stages,identity.tenantId]),
      client.query(`SELECT * FROM callflow_dispositions WHERE tenant_id=$3 AND active AND (updated_at,id)>($1::timestamptz,$2::uuid) ORDER BY updated_at,id LIMIT ${detailLimit}`,[...position.dispositions,identity.tenantId]),
      client.query(`SELECT entity_type,entity_id,deleted_at,id FROM callflow_sync_tombstones WHERE user_id=$1 AND (deleted_at,id)>($2::timestamptz,$3::bigint) ORDER BY deleted_at,id LIMIT ${detailLimit}`,[identity.userId,...position.tombstones]),
      client.query(`SELECT change.lead_id,change.changed_at,change.id FROM callflow_assignment_changes change JOIN callflow_leads lead ON lead.id=change.lead_id AND lead.tenant_id=change.tenant_id WHERE change.user_id=$1 AND change.assigned=false AND (change.changed_at,change.id)>($2::timestamptz,$3::bigint) AND lead.assigned_membership_id IS DISTINCT FROM $4 ORDER BY change.changed_at,change.id LIMIT ${detailLimit}`,[identity.userId,...position.assignments,member.id]),
    ]);
    const next:SyncCursor={v:1,leads:advancedMark(leads.rows,"updated_at","id",position.leads,leadLimit,now),calls:advancedMark(calls.rows,"updated_at","id",position.calls,detailLimit,now),notes:advancedMark(notes.rows,"updated_at","id",position.notes,detailLimit,now),followUps:advancedMark(followUps.rows,"updated_at","id",position.followUps,detailLimit,now),stages:advancedMark(stages.rows,"updated_at","id",position.stages,detailLimit,now),dispositions:advancedMark(dispositions.rows,"updated_at","id",position.dispositions,detailLimit,now),tombstones:advancedMark(tombstones.rows,"deleted_at","id",position.tombstones,detailLimit,now,"0"),assignments:advancedMark(assignmentRemovals.rows,"changed_at","id",position.assignments,detailLimit,now,"0")};
    return{
      leads:leads.rows.map(row=>({id:row.id,serverId:row.id,name:row.name,company:row.company_name,city:row.city,normalizedPhone:row.mobile_normalized||"",displayPhone:row.mobile_normalized||"",stageId:row.stage,assignedUserId:identity.userId,campaignId:row.source,nextFollowUpAt:row.next_action_at?.getTime?.()??null,updatedAt:row.updated_at.getTime(),updatedBy:"company-crm",version:Number(row.version),doNotCall:Boolean(row.opted_out_at),duplicateCount:1,score:row.score||0,quality:row.quality,email:row.email_normalized,interest:row.description,state:null,country:null,assignedTo:row.assigned_name,bestTime:null,revenuePotential:0,createdAt:row.created_at.getTime(),tags:row.tags||[],sourceDetails:[],workshopsAttended:[]})),
      calls:calls.rows.map(row=>({id:row.id,serverId:row.id,leadId:row.lead_id,employeeId:identity.userId,campaignId:null,normalizedPhone:row.phone_normalized,direction:String(row.direction).toUpperCase(),startedAt:row.started_at.getTime(),answeredAt:row.connected_at?.getTime?.()??null,endedAt:row.ended_at?.getTime?.()??null,failureReason:row.result==="connected"?null:row.result,simSlot:row.sim_slot==null?null:Number(row.sim_slot)+1,simLabel:row.sim_label,phoneAccountId:row.phone_account_id})),
      callEvents:[],notes:notes.rows.map(row=>({id:row.id,leadId:row.lead_id,callId:row.call_id,body:row.body,createdAt:row.created_at.getTime(),createdBy:member.name,deviceId:"company-crm"})),
      followUps:followUps.rows.map(row=>({id:row.id,leadId:row.lead_id,scheduledAt:row.due_at.getTime(),note:row.note,priority:1,assignedTo:identity.userId,type:String(row.kind).toUpperCase(),status:String(row.status).toUpperCase(),createdAt:row.created_at.getTime(),updatedAt:row.updated_at.getTime(),version:row.updated_at.getTime()})),
      leadStages:stages.rows.map(row=>({id:row.code,code:String(row.code).toUpperCase(),name:row.name,sortOrder:row.sort_order,active:row.active})),
      dispositions:dispositions.rows.map(row=>({id:row.id,code:row.code,name:row.name,icon:null,sortOrder:row.sort_order,active:row.active,requiresNote:row.requires_note,requiresFollowUp:row.requires_follow_up,targetStageId:row.target_stage})),appConfiguration:[{key:"subscription_access",value:JSON.stringify(billing),updatedAt:now.getTime()}],
      deletedLeadIds:[...new Set([...tombstones.rows.filter(row=>row.entity_type==="LEAD").map(row=>row.entity_id),...assignmentRemovals.rows.map(row=>row.lead_id)])],deletedFollowUpIds:tombstones.rows.filter(row=>row.entity_type==="FOLLOW_UP").map(row=>row.entity_id),nextCursor:encodeSyncCursor(next),serverTimestamp:now.toISOString()
    };
  });
}
