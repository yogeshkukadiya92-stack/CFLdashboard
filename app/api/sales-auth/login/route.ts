import { NextRequest, NextResponse } from "next/server";
import { getAppState, saveAppState } from "@/lib/db";
import { verifySalesPassword } from "@/lib/sales-auth";
import { createSalesSession, SALES_SESSION_COOKIE, salesSessionMaxAge } from "@/lib/sales-session";
import type { SalesTeamUser } from "@/lib/types";

export async function POST(request:NextRequest){
  try{const body=await request.json() as {identifier?:string;mobile?:string;password?:string};const identifier=String(body.identifier||body.mobile||"").trim().toLowerCase();const mobile=identifier.replace(/\D/g,"").slice(-10);const state=await getAppState();const users=(Array.isArray(state?.salesTeamUsers)?state?.salesTeamUsers:[]) as SalesTeamUser[];const user=users.find((u)=>u.email.trim().toLowerCase()===identifier||(mobile.length===10&&u.mobile===mobile));
  if(!user||!user.active||!verifySalesPassword(String(body.password||""),user))return NextResponse.json({error:"Invalid email/mobile number or password."},{status:401});const updated={...user,lastLoginAt:new Date().toISOString(),loginCount:user.loginCount+1};await saveAppState({salesTeamUsers:[updated,...users.filter((u)=>u.id!==user.id)]});const response=NextResponse.json({ok:true,name:user.name});response.cookies.set({name:SALES_SESSION_COOKIE,value:await createSalesSession(updated),httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:salesSessionMaxAge});return response;}catch{return NextResponse.json({error:"Could not sign in."},{status:500})}
}
