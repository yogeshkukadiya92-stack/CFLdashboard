import { ensurePersistenceTable, ensureRegistrationRecordsTable, getDbPool, reserveRegistrationNumber, upsertRegistrationRecord } from "@/lib/db";
import { ensureRegistrationHotPath } from "@/lib/registration-hot-path";
import { drainRegistrationJobs, ensureRegistrationJobs } from "@/lib/registration-jobs";
import type { RegistrationEntry } from "@/lib/types";
import { after, NextResponse } from "next/server";

export const runtime = "nodejs";
export async function PATCH(request: Request) {
  const database=getDbPool();
  if(!database)return NextResponse.json({error:"Database is required to update the waiting list."},{status:503});
  try {
    const body=await request.json() as Record<string,unknown>;
    const workshopId=String(body.workshopId??"").trim();
    const ids=[...new Set((Array.isArray(body.registrationIds)?body.registrationIds:[]).map(String).map(v=>v.trim()).filter(Boolean))].slice(0,5000);
    if(!workshopId||!ids.length)return NextResponse.json({error:"Workshop and waiting registrations are required."},{status:400});
    await ensurePersistenceTable();await ensureRegistrationRecordsTable();await ensureRegistrationJobs();await ensureRegistrationHotPath();
    const client=await database.connect();
    let promoted=0;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`registration-workshop:${workshopId}`]);
      const selected=await client.query<{payload:RegistrationEntry}>(`SELECT payload FROM cfl_registration_records
        WHERE workshop_id=$1 AND external_id=ANY($2::text[]) AND payload->>'registrationStatus'='waiting' ORDER BY external_id FOR UPDATE`,[workshopId,ids]);
      const now=new Date().toISOString();
      for(const {payload:entry} of selected.rows){
        const next={...entry,confirmationStatus:"confirmed",confirmationSource:"manual",confirmationUpdatedAt:now,
          confirmationUpdatedBy:"Workshop Master Admin",registrationStatus:"confirmed",waitingPosition:undefined,waitingReason:undefined,
          registrationNumber:entry.registrationNumber||await reserveRegistrationNumber(client)};
        await upsertRegistrationRecord(client,next);
        await client.query(`INSERT INTO cfl_registration_jobs(registration_id) VALUES($1)
          ON CONFLICT(registration_id) DO UPDATE SET completed_at=NULL,available_at=NOW(),attempts=0,last_error=NULL,
          revision=cfl_registration_jobs.revision+1`,[entry.id]);
        promoted++;
      }
      if(!promoted){await client.query("ROLLBACK");return NextResponse.json({error:"No matching waiting registrations were found."},{status:404});}
      await client.query(`WITH positions AS (
        SELECT external_id,row_number() OVER(ORDER BY created_at,external_id) position FROM cfl_registration_records
        WHERE workshop_id=$1 AND payload->>'registrationStatus'='waiting')
        UPDATE cfl_registration_records r SET payload=jsonb_set(r.payload,'{waitingPosition}',to_jsonb(p.position)),updated_at=NOW()
        FROM positions p WHERE r.external_id=p.external_id AND r.payload->>'waitingPosition' IS DISTINCT FROM p.position::text`,[workshopId]);
      await client.query("COMMIT");
    }catch(error){await client.query("ROLLBACK").catch(()=>undefined);throw error;}finally{client.release();}
    // External providers run after the durable confirmation; no provider call
    // holds participant rows or a database transaction open.
    after(()=>process.env.REGISTRATION_WORKER_ENABLED==="false"?Promise.resolve():drainRegistrationJobs());
    const scoped=body.responseScope==="workshop";
    const result=await database.query<{payload:RegistrationEntry}>(`SELECT payload FROM cfl_registration_records
      WHERE ($1::text IS NULL OR workshop_id=$1) ORDER BY created_at DESC,external_id DESC`,[scoped?workshopId:null]);
    return NextResponse.json({promoted,registrations:result.rows.map(r=>r.payload),...(scoped?{scope:"workshop",workshopId}:{})});
  }catch(error){console.error("Waiting confirmation failed",error instanceof Error?error.message:"unknown");return NextResponse.json({error:"Could not convert waiting registrations."},{status:500});}
}
