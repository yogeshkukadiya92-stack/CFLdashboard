import { NextRequest, NextResponse } from "next/server";
import { readCallFlowBearer } from "@/lib/callflow-auth";
import { readAccountBackup, writeAccountBackup } from "@/lib/callflow-account-backup";
import { getAppState } from "@/lib/db";

async function backupIdentity(request: NextRequest) {
  const identity = await readCallFlowBearer(request) as (NonNullable<Awaited<ReturnType<typeof readCallFlowBearer>>> & { tenantId?: string; sessionId?: string }) | null;
  if (!identity) return null;
  if (request.headers.get("X-CallFlow-Backup-Account") !== `${identity.tenantId || "legacy"}:${identity.userId}`) return null;
  // Central sessions have already been checked for revocation. Legacy users must still be active.
  if (!identity.sessionId) {
    const state = await getAppState();
    const users = state?.salesTeamUsers as Array<{id:string;active:boolean}> | undefined;
    if (!users?.some(user => user.id === identity.userId && user.active)) return null;
  }
  return identity;
}
export async function GET(request: NextRequest) {
  try {
    const identity = await backupIdentity(request);
    if (!identity) return NextResponse.json({error:"Unauthorized"},{status:401});
    return NextResponse.json(await readAccountBackup(identity, request.nextUrl.searchParams.get("cursor")),{headers:{"Cache-Control":"no-store"}});
  } catch { return NextResponse.json({error:"Server backup could not be read. Retry shortly."},{status:503}); }
}
export async function POST(request: NextRequest) {
  try {
    const identity = await backupIdentity(request);
    if (!identity) return NextResponse.json({error:"Unauthorized"},{status:401});
    if (Number(request.headers.get("content-length")) > 1200000) return NextResponse.json({error:"Backup batch too large"},{status:413});
    const body = await request.json();
    if (body.schemaVersion !== 9) return NextResponse.json({error:"Update CallFlow before backing up"},{status:409});
    return NextResponse.json(await writeAccountBackup(identity,body.records));
  } catch { return NextResponse.json({error:"Server backup was not saved. Your device data is unchanged."},{status:503}); }
}
