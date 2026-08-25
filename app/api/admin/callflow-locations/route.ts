import { NextResponse } from "next/server";
import { getAppState } from "@/lib/db";
export async function GET(){const state=await getAppState();if(!state)return NextResponse.json({error:"Database unavailable"},{status:503});const connector=(state.integrations?.callflow&&typeof state.integrations.callflow==="object"?state.integrations.callflow:{}) as Record<string,unknown>;return NextResponse.json({shiftEvents:Array.isArray(connector.shiftEvents)?connector.shiftEvents:[],checkIns:Array.isArray(connector.locationCheckIns)?connector.locationCheckIns:[]})}
